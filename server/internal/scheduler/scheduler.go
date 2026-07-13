package scheduler

import (
	"context"
	"log"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
	"github.com/juhe-management/server/internal/ws"
	"github.com/robfig/cron/v3"
)

func ptr(t time.Time) *time.Time { return &t }

type Scheduler struct {
	cfg            *config.Config
	cron           *cron.Cron
	settingRepo    *repository.SettingRepository
	billing        *service.BillingService
	subscription   *service.SubscriptionService
	channelService *service.ChannelService
	logRepo        *repository.LogRepository
	logger         *log.Logger
	broadcaster    ws.Broadcaster
	jobs           map[string]*JobStatus
	entryIDs       map[string]cron.EntryID
	mu                   sync.RWMutex
	healthCheckRunning      atomic.Bool
	dailyBillRunning        atomic.Bool
	renewalRunning          atomic.Bool
	logCleanupRunning       atomic.Bool
}

// JobStatus represents the current state of a scheduled job.
type JobStatus struct {
	Name       string
	Schedule   string
	LastRun    *time.Time
	NextRun    time.Time
	LastResult string // "success" / "fail" / ""
	LastError  string
}

func New(cfg *config.Config, settingRepo *repository.SettingRepository, billing *service.BillingService, subscription *service.SubscriptionService, channelService *service.ChannelService, logRepo *repository.LogRepository, logger *log.Logger, broadcaster ws.Broadcaster) *Scheduler {
	return &Scheduler{
		cfg:            cfg,
		settingRepo:    settingRepo,
		billing:        billing,
		subscription:   subscription,
		channelService: channelService,
		logRepo:        logRepo,
		logger:         logger,
		broadcaster:    broadcaster,
		jobs:           make(map[string]*JobStatus),
		entryIDs:       make(map[string]cron.EntryID),
	}
}

func (s *Scheduler) Start() error {
	if !s.cfg.Scheduler.Enabled {
		s.logger.Println("[scheduler] scheduler is disabled")
		return nil
	}

	s.cron = cron.New(
		cron.WithLocation(time.UTC),
		cron.WithLogger(cron.VerbosePrintfLogger(s.logger)),
	)

	// 日账单聚合 — run every hour to keep dashboard data current
	const dailyBillSchedule = "@every 1h"
	s.mu.Lock()
	s.jobs["daily_bills"] = &JobStatus{Name: "日账单聚合", Schedule: dailyBillSchedule}
	s.mu.Unlock()
	eid, err := s.cron.AddFunc(dailyBillSchedule, func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Printf("[scheduler] PANIC in daily_bills: %v", r)
			}
		}()
		s.mu.Lock()
		s.jobs["daily_bills"].LastRun = ptr(time.Now().UTC())
		s.mu.Unlock()
		err := s.runAggregateDailyBills()
		s.setJobResult("daily_bills", err)
	})
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.entryIDs["daily_bills"] = eid
	s.mu.Unlock()

	// 订阅续费
	s.mu.Lock()
	s.jobs["subscription_renewal"] = &JobStatus{Name: "订阅续费", Schedule: s.cfg.Scheduler.Schedule}
	s.mu.Unlock()
	eid, err = s.cron.AddFunc(s.cfg.Scheduler.Schedule, func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Printf("[scheduler] PANIC in subscription_renewal: %v", r)
			}
		}()
		s.mu.Lock()
		s.jobs["subscription_renewal"].LastRun = ptr(time.Now().UTC())
		s.mu.Unlock()
		err := s.runRenewSubscriptions()
		s.setJobResult("subscription_renewal", err)
	})
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.entryIDs["subscription_renewal"] = eid
	s.mu.Unlock()

	// 日志自动清理
	s.mu.Lock()
	s.jobs["log_cleanup"] = &JobStatus{Name: "日志自动清理", Schedule: "0 3 * * *"}
	s.mu.Unlock()
	eid, err = s.cron.AddFunc("0 3 * * *", func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Printf("[scheduler] PANIC in log_cleanup: %v", r)
			}
		}()
		s.mu.Lock()
		s.jobs["log_cleanup"].LastRun = ptr(time.Now().UTC())
		s.mu.Unlock()
		err := s.runLogCleanup()
		s.setJobResult("log_cleanup", err)
	})
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.entryIDs["log_cleanup"] = eid
	s.mu.Unlock()

	// 渠道健康检查 (conditional)
	if s.cfg.HealthCheck.Enabled {
		s.mu.Lock()
		s.jobs["health_checks"] = &JobStatus{Name: "渠道健康检查", Schedule: s.cfg.HealthCheck.Interval}
		s.mu.Unlock()
		eid, err = s.cron.AddFunc(s.cfg.HealthCheck.Interval, func() {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Printf("[scheduler] PANIC in health_checks: %v", r)
				}
			}()
			s.mu.Lock()
			s.jobs["health_checks"].LastRun = ptr(time.Now().UTC())
			s.mu.Unlock()
			err := s.runHealthChecks()
			s.setJobResult("health_checks", err)
		})
		if err != nil {
			return err
		}
		s.mu.Lock()
		s.entryIDs["health_checks"] = eid
		s.mu.Unlock()
	}

	s.cron.Start()
	s.logger.Printf("[scheduler] started with schedule %q", s.cfg.Scheduler.Schedule)

	// Bootstrap: run daily bill aggregation synchronously before cron fires to avoid race
	s.logger.Println("[scheduler] running bootstrap daily bill aggregation")
	if err := s.runAggregateDailyBills(); err != nil {
		s.logger.Printf("[scheduler] bootstrap daily bill aggregation failed: %v", err)
	}

	return nil
}

func (s *Scheduler) Stop() {
	if s.cron == nil {
		return
	}
	ctx := s.cron.Stop()
	select {
	case <-ctx.Done():
		s.logger.Println("[scheduler] stopped gracefully")
	case <-time.After(30 * time.Second):
		s.logger.Println("[scheduler] stop timed out after 30s")
	}
}

func (s *Scheduler) setJobResult(name string, jobErr error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	js, ok := s.jobs[name]
	if !ok {
		return
	}
	if jobErr != nil {
		js.LastResult = "fail"
		js.LastError = jobErr.Error()
	} else {
		js.LastResult = "success"
		js.LastError = ""
	}
}

// GetJobsStatus returns the current status of all registered jobs.
func (s *Scheduler) GetJobsStatus() []JobStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []JobStatus
	for name, js := range s.jobs {
		// Shallow-copy to avoid mutating the shared *JobStatus under RLock
		copied := *js
		eid, ok := s.entryIDs[name]
		if ok && s.cron != nil {
			entry := s.cron.Entry(eid)
			copied.NextRun = entry.Next
		}
		// Deep-copy LastRun to prevent shared-pointer mutation
		if copied.LastRun != nil {
			t := *copied.LastRun
			copied.LastRun = &t
		}
		result = append(result, copied)
	}
	return result
}

func (s *Scheduler) runAggregateDailyBills() error {
	// Prevent overlapping daily bill aggregation runs
	if !s.dailyBillRunning.CompareAndSwap(false, true) {
		s.logger.Println("[scheduler] daily bill aggregation already running, skipping this round")
		return nil
	}
	defer s.dailyBillRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	now := time.Now().UTC()
	yesterday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).Add(-24 * time.Hour)

	s.logger.Printf("[scheduler] aggregating daily bills for %s", yesterday.Format("2006-01-02"))
	if err := s.billing.AggregateDailyBill(ctx, yesterday); err != nil {
		return err
	}
	s.logger.Println("[scheduler] aggregate daily bills done")
	return nil
}

func (s *Scheduler) runRenewSubscriptions() error {
	// Prevent overlapping renewal runs
	if !s.renewalRunning.CompareAndSwap(false, true) {
		s.logger.Println("[scheduler] subscription renewal already running, skipping this round")
		return nil
	}
	defer s.renewalRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	now := time.Now().UTC()
	s.logger.Println("[scheduler] renewing due subscriptions")

	const batchSize = 100
	renewed := 0
	failed := 0
	var lastID uint64

	for {
		subs, err := s.subscription.ListPendingRenewalAfterID(ctx, now, lastID, batchSize)
		if err != nil {
			return err
		}

		for _, sub := range subs {
			if _, err := s.subscription.Renew(ctx, sub.ID); err != nil {
				s.logger.Printf("[scheduler] renew subscription %d failed: %v", sub.ID, err)
				failed++
			} else {
				renewed++
			}
			lastID = sub.ID
		}

		if len(subs) < batchSize {
			break
		}
	}

	s.logger.Printf("[scheduler] subscriptions renewed: %d, failed: %d", renewed, failed)
	return nil
}

func (s *Scheduler) runHealthChecks() error {
	// Prevent overlapping health check runs
	if !s.healthCheckRunning.CompareAndSwap(false, true) {
		s.logger.Println("[scheduler] health check already running, skipping this round")
		return nil
	}
	defer s.healthCheckRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	s.logger.Println("[scheduler] running channel health checks")

	// Load all active channels at once (no pagination — health checks run periodically
	// and the channel count is bounded).
	channels, err := s.channelService.ListAllActive(ctx)
	if err != nil {
		return err
	}

	// Worker pool: buffered channel as a semaphore to limit concurrent probes.
	concurrency := s.cfg.HealthCheck.Concurrency
	if concurrency <= 0 {
		concurrency = 10
	}
	sem := make(chan struct{}, concurrency)

	var wg sync.WaitGroup
	var mu sync.Mutex
	var checked, failed int

	for _, ch := range channels {
		wg.Add(1)
		sem <- struct{}{} // acquire semaphore slot

		go func(ch domain.Channel) {
			defer wg.Done()
			defer func() { <-sem }() // release semaphore slot
			defer func() {
				if r := recover(); r != nil {
					log.Printf("panic in health check probe for channel %d: %v", ch.ID, r)
				}
			}()

			ctxProbe, cancel := context.WithTimeout(ctx, time.Duration(s.cfg.HealthCheck.Timeout)*time.Second)
			defer cancel()

			responseTimeMs, probeErr := s.channelService.TestChannel(ctxProbe, ch.ID)

			mu.Lock()
			checked++
			if probeErr != nil {
				failed++
			}
			mu.Unlock()

			if probeErr != nil {
				// Broadcast offline event to WebSocket clients
				if s.broadcaster != nil {
					s.broadcaster.Broadcast(ws.Event{
						Type: ws.EventChannelOffline,
						Data: ws.EventDataChannelOffline{
							ChannelID:   ch.ID,
							ChannelName: ch.Name,
							Error:       probeErr.Error(),
						},
					})
				}
				if recordErr := s.channelService.RecordFailure(ctx, ch.ID, probeErr.Error(), s.cfg.HealthCheck.Threshold); recordErr != nil {
					s.logger.Printf("[scheduler] record failure for channel %d failed: %v", ch.ID, recordErr)
				}
			} else {
				if recordErr := s.channelService.RecordSuccess(ctx, ch.ID, responseTimeMs); recordErr != nil {
					s.logger.Printf("[scheduler] record success for channel %d failed: %v", ch.ID, recordErr)
				}
			}
		}(ch)
	}

	wg.Wait()
	s.logger.Printf("[scheduler] channel health checks done: checked %d, failed %d", checked, failed)
	return nil
}

func (s *Scheduler) runLogCleanup() error {
	// Prevent overlapping log cleanup runs
	if !s.logCleanupRunning.CompareAndSwap(false, true) {
		s.logger.Println("[scheduler] log cleanup already running, skipping this round")
		return nil
	}
	defer s.logCleanupRunning.Store(false)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	retentionDays := s.cfg.LogRetentionDays
	// Dynamic override from settings
	if s.settingRepo != nil {
		if st, err := s.settingRepo.FindByKey(ctx, "log_retention_days"); err == nil && st != nil {
			if v, err := strconv.Atoi(st.Value); err == nil && v > 0 {
				retentionDays = v
			}
		}
	}
	const batchSize = 1000

	s.logger.Printf("[scheduler] cleaning up logs older than %d days", retentionDays)

	totalDeleted := int64(0)
	for {
		result := s.logRepo.DeleteOlderThan(ctx, retentionDays, batchSize)
		if result.Error != nil {
			return result.Error
		}
		totalDeleted += result.RowsAffected
		if result.RowsAffected < int64(batchSize) {
			break
		}
	}

	if totalDeleted > 0 {
		s.logger.Printf("[scheduler] log cleanup done: deleted %d records", totalDeleted)
	}
	return nil
}
