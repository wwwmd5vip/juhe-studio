package email

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStaticConfigProvider_SMTPConfig(t *testing.T) {
	cfg := Config{
		Host:     "smtp.example.com",
		Port:     "587",
		Username: "user@example.com",
		Password: "secret",
		From:     "noreply@example.com",
	}
	p := NewStaticConfigProvider(cfg)
	result := p.SMTPConfig(context.Background())
	assert.Equal(t, cfg, result)
}

func TestGenerateCode(t *testing.T) {
	code := GenerateCode()
	assert.Len(t, code, 8)
	// verify it's all digits
	for _, c := range code {
		assert.True(t, c >= '0' && c <= '9', "expected digit, got %c", c)
	}
}

func TestGenerateCode_Uniqueness(t *testing.T) {
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code := GenerateCode()
		assert.Len(t, code, 8)
		codes[code] = true
	}
	// Most codes should be unique (allow a tiny collision margin for 10^8 space)
	assert.GreaterOrEqual(t, len(codes), 95)
}

func TestSend_ErrSMTPNotConfigured(t *testing.T) {
	s := NewSender(NewStaticConfigProvider(Config{}))
	err := s.send(Config{}, "to@example.com", "subject", "body")
	assert.ErrorIs(t, err, ErrSMTPNotConfigured)
}

func TestIsTemporary_Timeout(t *testing.T) {
	err := &net.OpError{
		Op:  "dial",
		Net: "tcp",
		Err: &timeoutError{},
	}
	assert.True(t, isTemporary(err))
}

func TestIsTemporary_DNSError(t *testing.T) {
	err := &net.DNSError{
		Err:         "no such host",
		Name:        "smtp.example.com",
		IsTimeout:   false,
		IsTemporary: true,
	}
	assert.True(t, isTemporary(err))
}

func TestIsTemporary_ConnectionRefused(t *testing.T) {
	// connection refused is detected via the error message on platforms
	// where it doesn't implement Temporary() (e.g. macOS).
	_, err := net.Dial("tcp", "127.0.0.1:19999")
	require.Error(t, err)
	assert.True(t, isTemporary(err))
}

func TestIsTemporary_NotTemporary(t *testing.T) {
	// A plain error without net.Error interface is not temporary.
	assert.False(t, isTemporary(assert.AnError))

	// A simple, non-network error.
	assert.False(t, isTemporary(fmt.Errorf("auth failed")))
}

// timeoutError implements net.Error with Timeout()==true, Temporary()==true.
type timeoutError struct{}

func (e *timeoutError) Error() string   { return "i/o timeout" }
func (e *timeoutError) Timeout() bool   { return true }
func (e *timeoutError) Temporary() bool { return true }

// Ensure compile-time interface satisfaction.
var _ net.Error = (*timeoutError)(nil)
var _ error = (*timeoutError)(nil)

// TestSendOnce_NoSMTP ensures the dial-and-send path fails fast when no
// real SMTP server is available.
func TestSendOnce_NoSMTP(t *testing.T) {
	s := NewSender(NewStaticConfigProvider(Config{
		Host: "127.0.0.1",
		Port: "19999",
		From: "test@example.com",
	}))
	err := s.sendOnce(Config{
		Host: "127.0.0.1",
		Port: "19999",
		From: "test@example.com",
	}, "to@example.com", "subject", "body")
	assert.Error(t, err)
}

// TestSend_RetryOnTemporary ensures send retries on temporary errors and
// eventually returns a wrapped error.
func TestSend_RetryOnTemporary(t *testing.T) {
	s := NewSender(NewStaticConfigProvider(Config{
		Host: "127.0.0.1",
		Port: "19999",
		From: "test@example.com",
	}))
	start := time.Now()
	err := s.send(Config{
		Host: "127.0.0.1",
		Port: "19999",
		From: "test@example.com",
	}, "to@example.com", "subject", "body")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "email send failed after 3 attempts")
	// Should have slept at least 1+2=3 seconds across retries.
	assert.GreaterOrEqual(t, time.Since(start), 3*time.Second)
}
