package middleware

import (
	"crypto/rand"
	"fmt"

	"github.com/gin-gonic/gin"
)

const ContextRequestIDKey = "request_id"

// RequestID returns a middleware that generates a UUID v4 for each request,
// sets it in both the Gin context (c.Set) and the response header (X-Request-Id).
// It uses crypto/rand — no external dependencies.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := newUUID()
		c.Set(ContextRequestIDKey, uuid)
		c.Header("X-Request-Id", uuid)
		c.Next()
	}
}

// newUUID generates a random UUID v4 using crypto/rand.
func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	// Set version 4
	b[6] = (b[6] & 0x0f) | 0x40
	// Set variant bits (10xx)
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
