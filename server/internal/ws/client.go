package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

// HandleWebSocket upgrades an HTTP connection to WebSocket and registers with the hub
func HandleWebSocket(hub *Hub, env string, allowedOrigins string) gin.HandlerFunc {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// In development, allow all origins
			if env != "production" {
				return true
			}
			// In production, validate Origin against allowed list
			origin := r.Header.Get("Origin")
			if origin == "" {
				return true // non-browser clients (no Origin header)
			}
			for _, allowed := range strings.Split(allowedOrigins, ",") {
				allowed = strings.TrimSpace(allowed)
				if allowed == "*" {
					// Accept wildcard but warn in production — CORS_ALLOWED_ORIGINS should be explicit
					log.Printf("ws: WARNING — CheckOrigin allows wildcard origin in production; set CORS_ALLOWED_ORIGINS to specific origin(s)")
					return true
				}
				if allowed == origin {
					return true
				}
			}
			return false
		},
	}

	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("ws: upgrade failed: %v", err)
			return
		}
		userID, _ := c.Get("user_id")
		uid, ok := userID.(uint64)
		if !ok {
			log.Printf("ws: WARNING — user_id not found or wrong type in context, uid=0")
		}
		client := &Client{
			hub:    hub,
			conn:   conn,
			send:   make(chan []byte, 256),
			UserID: uid,
		}
		hub.mu.Lock()
		hub.clients[client] = true
		hub.mu.Unlock()

		// Send recent events as event.history immediately after connection
		recentEvents := hub.GetRecentEvents()
		historyEvent := Event{
			Type:      EventHistory,
			Data:      recentEvents,
			Timestamp: time.Now().UnixMilli(),
		}
		if historyBytes, err := json.Marshal(historyEvent); err == nil {
			select {
			case client.send <- historyBytes:
			default:
			}
		}

		go client.writePump(conn)
		go client.readPump(conn, hub)
	}
}

func (c *Client) readPump(conn *websocket.Conn, hub *Hub) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in websocket readPump for user %d: %v", c.UserID, r)
		}
	}()
	defer func() {
		c.closed.Store(true)
		hub.mu.Lock()
		delete(hub.clients, c)
		hub.mu.Unlock()
		close(c.send)
		conn.Close()
	}()
	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump(conn *websocket.Conn) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in websocket writePump for user %d: %v", c.UserID, r)
		}
	}()
	defer func() {
		ticker.Stop()
		conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
