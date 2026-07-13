package captcha

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewStore(t *testing.T) {
	s := NewStore()
	require.NotNil(t, s)
	defer s.Close()

	// Verify the store has been initialised with a map and a stop channel
	assert.NotNil(t, s.entries)
	assert.NotNil(t, s.stop)
}

func TestGenerate(t *testing.T) {
	s := NewStore()
	defer s.Close()

	id, code, pngDataURI := s.Generate()

	require.NotEmpty(t, id, "captcha id should not be empty")
	require.NotEmpty(t, code, "captcha code should not be empty")
	require.NotEmpty(t, pngDataURI, "captcha PNG should not be empty")

	assert.Len(t, code, codeLen, "code length should be %d", codeLen)
	assert.Len(t, id, 16, "id length should be 16")

	// Verify the data URI format
	assert.True(t, strings.HasPrefix(pngDataURI, "data:image/png;base64,"),
		"PNG should be a base64 data URI")

	// Verify entry was stored with the correct code
	s.mu.RLock()
	e, ok := s.entries[id]
	s.mu.RUnlock()
	require.True(t, ok, "entry should be stored in the map")
	assert.Equal(t, code, e.code)
}

func TestVerify_CorrectCode(t *testing.T) {
	s := NewStore()
	defer s.Close()

	id, code, _ := s.Generate()

	// Correct code, exact match
	assert.True(t, s.Verify(id, code), "verify should succeed with correct code")

	// Case-insensitive match
	assert.True(t, s.Verify(id, strings.ToUpper(code)), "verify should be case-insensitive")
	assert.True(t, s.Verify(id, strings.ToLower(code)), "verify should be case-insensitive")
}

func TestVerify_WrongCode(t *testing.T) {
	s := NewStore()
	defer s.Close()

	id, _, _ := s.Generate()

	// Wrong code
	assert.False(t, s.Verify(id, "XXXX"), "verify should fail with wrong code")

	// Verify that the entry still exists after failed verification (no consumption)
	s.mu.RLock()
	_, ok := s.entries[id]
	s.mu.RUnlock()
	assert.True(t, ok, "entry should still exist after failed verification")
}

func TestVerify_NonExistentID(t *testing.T) {
	s := NewStore()
	defer s.Close()

	assert.False(t, s.Verify("nonexistent-id", "ABCD"),
		"verify should fail with non-existent ID")
}

func TestConsume(t *testing.T) {
	s := NewStore()
	defer s.Close()

	id, _, _ := s.Generate()

	// Verify entry exists
	s.mu.RLock()
	_, ok := s.entries[id]
	s.mu.RUnlock()
	assert.True(t, ok, "entry should exist before consume")

	// Consume removes the entry
	s.Consume(id)

	s.mu.RLock()
	_, ok = s.entries[id]
	s.mu.RUnlock()
	assert.False(t, ok, "entry should be removed after consume")

	// Verify after consume returns false
	assert.False(t, s.Verify(id, ""), "verify should fail after consume")
}

func TestClose_StopsCleanupLoop(t *testing.T) {
	s := NewStore()

	// Close should be safe to call
	s.Close()

	// Double-close should be safe (idempotent)
	s.Close()
}

func TestGenerate_MultipleUniqueIDs(t *testing.T) {
	s := NewStore()
	defer s.Close()

	type captcha struct {
		id   string
		code string
	}
	captchas := make([]*captcha, 0, 10)

	for i := 0; i < 10; i++ {
		id, code, png := s.Generate()
		require.NotEmpty(t, id)
		require.NotEmpty(t, code)
		require.NotEmpty(t, png)
		captchas = append(captchas, &captcha{id: id, code: code})
	}

	// Verify each generated captcha works independently
	for _, c := range captchas {
		assert.True(t, s.Verify(c.id, c.code), "each captcha should verify with its own code")
	}

	// Verify all IDs are unique
	seenIDs := make(map[string]bool)
	for _, c := range captchas {
		require.False(t, seenIDs[c.id], "captcha IDs should be unique: %s", c.id)
		seenIDs[c.id] = true
	}
}

func TestFormatDataURI(t *testing.T) {
	uri := FormatDataURI([]byte{137, 80, 78, 71}) // PNG magic bytes
	assert.True(t, strings.HasPrefix(uri, "data:image/png;base64,"))
}
