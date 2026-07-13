package ws

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/juhe-management/server/internal/repository"
)

// EventType defines the WebSocket event categories
type EventType string

const (
	EventChannelOffline    EventType = "channel.offline"
	EventChannelAutoBanned EventType = "channel.auto_banned"
	EventQuotaLow          EventType = "quota.low"
	EventHealthFailing     EventType = "health.failing"
	EventScheduler         EventType = "scheduler"
	EventHistory           EventType = "event.history"
	EventServerShutdown    EventType = "server.shutdown"
)

// Event is a typed WebSocket message
type Event struct {
	Type      EventType   `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

// EventDataAutoBanned is the payload for channel.auto_banned events
type EventDataAutoBanned struct {
	ChannelID           uint64 `json:"channel_id"`
	ChannelName         string `json:"channel_name"`
	ConsecutiveFailures int    `json:"consecutive_failures"`
}

// EventDataChannelOffline is the payload for channel.offline events
type EventDataChannelOffline struct {
	ChannelID   uint64 `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Error       string `json:"error"`
}

// EventDataQuotaLow is the payload for quota.low events
type EventDataQuotaLow struct {
	UserID         uint64 `json:"user_id"`
	KeyID          uint64 `json:"key_id"`
	RemainingQuota int64  `json:"remaining_quota"`
	Threshold      int64  `json:"threshold"`
}

// Client represents a single WebSocket connection
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	closed atomic.Bool // set to true before send channel is closed
	UserID uint64      // authenticated user ID, 0 if unknown
}

const maxRecentEvents = 50

// Hub manages all active WebSocket clients and broadcasts
type Hub struct {
	mu                   sync.RWMutex
	clients              map[*Client]bool
	recent               []Event
	settingRepo          *repository.SettingRepository
	shutdownDone         chan struct{}
	shutdownOnce         sync.Once
	notificationsEnabled atomic.Bool
	notificationsExpiry  atomic.Int64
}

// Broadcaster is the interface consumed by services
type Broadcaster interface {
	Broadcast(event Event)
}

// NewHub creates a new Hub
func NewHub(settingRepo *repository.SettingRepository) *Hub {
	h := &Hub{
		clients:      make(map[*Client]bool),
		recent:       make([]Event, 0, maxRecentEvents),
		settingRepo:  settingRepo,
		shutdownDone: make(chan struct{}),
	}
	h.notificationsEnabled.Store(true)
	return h
}

// Broadcast sends an event to all connected clients and pushes to ring buffer.
// Respects ws_notifications_enabled setting — skips if disabled.
func (h *Hub) Broadcast(event Event) {
	// Check if WS notifications are enabled (cached with 30s TTL)
	now := time.Now().UnixNano()
	if h.notificationsExpiry.Load() < now {
		h.refreshNotificationsSetting()
	}
	if !h.notificationsEnabled.Load() {
		return
	}

	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}

	// Ring buffer: append under lock, truncate from front if over max.
	// Copy tail to a new slice to release dead Event references from the backing array.
	h.mu.Lock()
	h.recent = append(h.recent, event)
	if len(h.recent) > maxRecentEvents {
		tail := make([]Event, maxRecentEvents)
		copy(tail, h.recent[len(h.recent)-maxRecentEvents:])
		h.recent = tail
	}
	// Snapshot client list
	clients := make([]*Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.Unlock()

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("ws: failed to marshal event: %v", err)
		return
	}

	for _, client := range clients {
		if client.closed.Load() {
			continue
		}
		// For quota.low events, only send to the affected user's clients
		if event.Type == EventQuotaLow {
			if quotaData, ok := event.Data.(EventDataQuotaLow); ok {
				if client.UserID != quotaData.UserID {
					continue
				}
			}
		}
		select {
		case client.send <- data:
		default:
			// Client send buffer full — client is too slow, log and skip
			log.Printf("ws: dropping message for slow client (user=%d), event type=%s", client.UserID, event.Type)
		}
	}
}

// refreshNotificationsSetting reads ws_notifications_enabled from the database
// and updates the cached value with a 30-second TTL.
func (h *Hub) refreshNotificationsSetting() {
	if h.settingRepo == nil {
		h.notificationsEnabled.Store(true)
		h.notificationsExpiry.Store(time.Now().Add(30 * time.Second).UnixNano())
		return
	}
	enabled := true
	if s, err := h.settingRepo.FindByKey(context.Background(), "ws_notifications_enabled"); err == nil && s != nil {
		if v, err := strconv.ParseBool(s.Value); err == nil {
			enabled = v
		}
	}
	h.notificationsEnabled.Store(enabled)
	h.notificationsExpiry.Store(time.Now().Add(30 * time.Second).UnixNano())
}

// GetRecentEvents returns the most recent events from the ring buffer
func (h *Hub) GetRecentEvents() []Event {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]Event, len(h.recent))
	copy(result, h.recent)
	return result
}

// ClientCount returns the number of active connections
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Shutdown sends a shutdown event to all connected clients and returns a channel
// that is closed once messages are dispatched. Callers can use this to synchronize.
// Safe to call multiple times — sync.Once ensures the shutdown logic runs once.
func (h *Hub) Shutdown() <-chan struct{} {
	h.shutdownOnce.Do(func() {
		shutdownEvent := Event{
			Type:      EventServerShutdown,
			Data:      nil,
			Timestamp: time.Now().UnixMilli(),
		}
		shutdownMsg, err := json.Marshal(shutdownEvent)
		if err != nil {
			log.Printf("ws: failed to marshal shutdown event: %v", err)
		} else {
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- shutdownMsg:
				default:
				}
			}
			h.mu.RUnlock()
		}

		// Signal completion after a brief flush window
		go func() {
			time.Sleep(100 * time.Millisecond)
			close(h.shutdownDone)
		}()
	})
	return h.shutdownDone
}
