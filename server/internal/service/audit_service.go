package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
)

// AuditService records administrative operations for audit trail purposes.
// All recording is done asynchronously (non-blocking) to avoid impacting response times.
type AuditService struct {
	repo   *repository.AdminAuditLogRepository
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func NewAuditService(repo *repository.AdminAuditLogRepository) *AuditService {
	ctx, cancel := context.WithCancel(context.Background())
	return &AuditService{repo: repo, ctx: ctx, cancel: cancel}
}

// Close waits for all in-flight audit goroutines to finish (with a 5s timeout), then cancels the context.
func (s *AuditService) Close() {
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		log.Printf("[AuditService] timed out waiting for audit goroutines to finish")
	}
	s.cancel()
}

// RecordCreate records a "create" audit entry asynchronously.
func (s *AuditService) RecordCreate(operatorID uint64, operatorName string, targetType domain.AuditTargetType, targetID uint64, newValue any) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[AuditService] panic recovered in RecordCreate: %v", r)
			}
		}()
		s.record(domain.AuditActionCreate, operatorID, operatorName, targetType, targetID, nil, toJSON(newValue))
	}()
}

// RecordUpdate records an "update" audit entry asynchronously.
func (s *AuditService) RecordUpdate(operatorID uint64, operatorName string, targetType domain.AuditTargetType, targetID uint64, oldValue, newValue any) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[AuditService] panic recovered in RecordUpdate: %v", r)
			}
		}()
		s.record(domain.AuditActionUpdate, operatorID, operatorName, targetType, targetID, toJSON(oldValue), toJSON(newValue))
	}()
}

// RecordDelete records a "delete" audit entry asynchronously.
func (s *AuditService) RecordDelete(operatorID uint64, operatorName string, targetType domain.AuditTargetType, targetID uint64, oldValue any) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[AuditService] panic recovered in RecordDelete: %v", r)
			}
		}()
		s.record(domain.AuditActionDelete, operatorID, operatorName, targetType, targetID, toJSON(oldValue), nil)
	}()
}

// RecordAdjust records a quota adjustment audit entry asynchronously.
func (s *AuditService) RecordAdjust(operatorID uint64, operatorName string, targetType domain.AuditTargetType, targetID uint64, oldValue, newValue any, amount int64, description string) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[AuditService] panic recovered in RecordAdjust: %v", r)
			}
		}()
		diff := map[string]any{
			"amount":      amount,
			"description": description,
		}
		oldJSON := toJSON(oldValue)
		newJSON := toJSON(newValue)
		diffJSON := toJSON(diff)
		entry := &domain.AdminAuditLog{
			OperatorID:   operatorID,
			OperatorName: operatorName,
			Action:       domain.AuditActionUpdate,
			TargetType:   targetType,
			TargetID:     targetID,
			OldValue:     oldJSON,
			NewValue:     newJSON,
			Diff:         diffJSON,
		}
		if err := s.repo.Create(s.ctx, entry); err != nil {
			log.Printf("[AuditService] failed to record adjust audit entry: %v", err)
		}
	}()
}

// record performs the actual database insertion.
func (s *AuditService) record(action domain.AuditAction, operatorID uint64, operatorName string, targetType domain.AuditTargetType, targetID uint64, oldValue, newValue *string) {
	entry := &domain.AdminAuditLog{
		OperatorID:   operatorID,
		OperatorName: operatorName,
		Action:       action,
		TargetType:   targetType,
		TargetID:     targetID,
		OldValue:     oldValue,
		NewValue:     newValue,
	}

	if err := s.repo.Create(s.ctx, entry); err != nil {
		log.Printf("[AuditService] failed to record audit entry: %v", err)
	}
}

// toJSON serializes a value to a JSON string pointer. Returns nil on error.
func toJSON(v any) *string {
	if v == nil {
		return nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("[AuditService] failed to marshal audit value: %v", err)
		return nil
	}
	s := string(data)
	return &s
}

// FormatID formats a uint64 ID as a string for logging.
func FormatID(id uint64) string {
	return fmt.Sprintf("%d", id)
}
