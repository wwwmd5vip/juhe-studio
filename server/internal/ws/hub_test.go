package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewHub(t *testing.T) {
	h := NewHub(nil)

	require.NotNil(t, h)
	assert.NotNil(t, h.clients)
	assert.Empty(t, h.clients)
	assert.NotNil(t, h.recent)
	assert.Empty(t, h.recent)
	assert.Nil(t, h.settingRepo)
	assert.NotNil(t, h.shutdownDone)
	assert.True(t, h.notificationsEnabled.Load())
	assert.Equal(t, 0, h.ClientCount())
}

func TestHub_RegisterClient(t *testing.T) {
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	assert.Equal(t, 1, h.ClientCount())

	h.mu.RLock()
	_, exists := h.clients[client]
	h.mu.RUnlock()
	assert.True(t, exists)
}

func TestHub_UnregisterClient(t *testing.T) {
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}

	// Register
	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()
	assert.Equal(t, 1, h.ClientCount())

	// Unregister
	h.mu.Lock()
	delete(h.clients, client)
	h.mu.Unlock()
	assert.Equal(t, 0, h.ClientCount())

	h.mu.RLock()
	_, exists := h.clients[client]
	h.mu.RUnlock()
	assert.False(t, exists)
}

func TestHub_Broadcast(t *testing.T) {
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}

	// Register client directly
	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	event := Event{
		Type:      "test.event",
		Data:      map[string]string{"key": "value"},
		Timestamp: time.Now().UnixMilli(),
	}

	h.Broadcast(event)

	// Verify client received the broadcast
	select {
	case raw := <-client.send:
		var received Event
		err := json.Unmarshal(raw, &received)
		require.NoError(t, err)
		assert.Equal(t, event.Type, received.Type)
		assert.Equal(t, event.Timestamp, received.Timestamp)
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for broadcast message")
	}
}

func TestHub_Broadcast_SkipsClosedClient(t *testing.T) {
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}
	client.closed.Store(true)

	// Register the closed client
	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	event := Event{
		Type:      "test.event",
		Data:      nil,
		Timestamp: time.Now().UnixMilli(),
	}

	h.Broadcast(event)

	// Closed client should NOT receive the message
	select {
	case <-client.send:
		t.Fatal("closed client should not receive broadcast")
	case <-time.After(200 * time.Millisecond):
		// expected — no message received
	}
}

func TestHub_Broadcast_QuotaLowTargeted(t *testing.T) {
	h := NewHub(nil)

	// Client A — different user, should NOT receive quota.low
	clientA := &Client{
		hub:    h,
		send:   make(chan []byte, 256),
		UserID: 1,
	}

	// Client B — target user, should receive quota.low
	clientB := &Client{
		hub:    h,
		send:   make(chan []byte, 256),
		UserID: 42,
	}

	h.mu.Lock()
	h.clients[clientA] = true
	h.clients[clientB] = true
	h.mu.Unlock()

	event := Event{
		Type: EventQuotaLow,
		Data: EventDataQuotaLow{
			UserID:         42,
			KeyID:          10,
			RemainingQuota: 100,
			Threshold:      500,
		},
		Timestamp: time.Now().UnixMilli(),
	}

	h.Broadcast(event)

	// Client B should receive
	select {
	case raw := <-clientB.send:
		var received Event
		err := json.Unmarshal(raw, &received)
		require.NoError(t, err)
		assert.Equal(t, EventQuotaLow, received.Type)
	case <-time.After(time.Second):
		t.Fatal("timeout: clientB should have received quota.low")
	}

	// Client A should NOT receive
	select {
	case <-clientA.send:
		t.Fatal("clientA should not receive quota.low for different user")
	case <-time.After(200 * time.Millisecond):
		// expected
	}
}

func TestHub_Shutdown(t *testing.T) {
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	done := h.Shutdown()

	// Wait for the shutdown signal (100ms flush window)
	select {
	case <-done:
		// shutdown complete
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for shutdown to complete")
	}

	// Client should have received a shutdown message
	select {
	case raw := <-client.send:
		var received Event
		err := json.Unmarshal(raw, &received)
		require.NoError(t, err)
		assert.Equal(t, EventServerShutdown, received.Type)
	case <-time.After(200 * time.Millisecond):
		t.Fatal("client should have received shutdown event")
	}

	// Calling Shutdown again should return the same done channel (sync.Once)
	done2 := h.Shutdown()
	assert.Equal(t, done, done2)
}

func TestHub_GetRecentEvents(t *testing.T) {
	h := NewHub(nil)

	// Initially empty
	events := h.GetRecentEvents()
	assert.Empty(t, events)

	// Broadcast a few events
	for i := 0; i < 5; i++ {
		h.Broadcast(Event{
			Type:      "test.event",
			Data:      i,
			Timestamp: time.Now().UnixMilli(),
		})
	}

	events = h.GetRecentEvents()
	assert.Len(t, events, 5)
}

func TestHub_GetRecentEvents_RingBuffer(t *testing.T) {
	h := NewHub(nil)

	// Push more than maxRecentEvents
	for i := 0; i < maxRecentEvents+10; i++ {
		h.Broadcast(Event{
			Type:      "test.event",
			Data:      i,
			Timestamp: time.Now().UnixMilli(),
		})
	}

	events := h.GetRecentEvents()
	// Should be capped at maxRecentEvents
	assert.Len(t, events, maxRecentEvents)

	// The last event should have data = maxRecentEvents+9 (0-indexed)
	lastEvent := events[len(events)-1]
	lastData, ok := lastEvent.Data.(int)
	require.True(t, ok)
	assert.Equal(t, maxRecentEvents+9, lastData)
}

func TestHub_NotificationsDisabled(t *testing.T) {
	// Hub with nil settingRepo defaults to enabled
	h := NewHub(nil)

	client := &Client{
		hub:  h,
		send: make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[client] = true
	h.mu.Unlock()

	// Disable notifications and set a far-future expiry
	h.notificationsEnabled.Store(false)
	h.notificationsExpiry.Store(time.Now().Add(time.Hour).UnixNano())

	h.Broadcast(Event{
		Type:      "test.event",
		Data:      nil,
		Timestamp: time.Now().UnixMilli(),
	})

	// Should NOT receive because notifications are disabled
	select {
	case <-client.send:
		t.Fatal("should not broadcast when notifications are disabled")
	case <-time.After(200 * time.Millisecond):
		// expected
	}
}
