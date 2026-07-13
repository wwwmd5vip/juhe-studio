package service

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type SensitiveWordService struct {
	settingService     *SettingService
	wordsCache         atomicStringSlice
	wordsCacheExpiry   int64 // unix nano, 0 means cache miss
	enabledCache       bool
	enabledCacheExpiry int64 // unix nano, 0 means cache miss
}

func NewSensitiveWordService(settingService *SettingService) *SensitiveWordService {
	return &SensitiveWordService{
		settingService:    settingService,
		wordsCacheExpiry:   -1, // force first Check call to read from DB
		enabledCacheExpiry: -1, // force first IsEnabled call to read from DB
	}
}

// atomicStringSlice provides lock-free read access to a pre-lowered word list.
type atomicStringSlice struct {
	mu   sync.RWMutex
	data []string
}

func (a *atomicStringSlice) set(words []string) {
	lowered := make([]string, 0, len(words))
	for _, w := range words {
		trimmed := strings.TrimSpace(w)
		if trimmed == "" {
			continue
		}
		lowered = append(lowered, strings.ToLower(trimmed))
	}
	a.mu.Lock()
	a.data = lowered
	a.mu.Unlock()
}

func (a *atomicStringSlice) get() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.data
}

const (
	SettingSensitiveWordsEnabled = "sensitive_words_enabled"
	SettingSensitiveWordsList    = "sensitive_words_list"
)

// enabledCacheTTL is how long the IsEnabled cache lives before a DB refresh.
const enabledCacheTTL = 30 * time.Second

// wordsCacheTTL is how long the sensitive word list cache lives before a DB refresh.
const wordsCacheTTL = 30 * time.Second

func (s *SensitiveWordService) IsEnabled(ctx context.Context) bool {
	now := time.Now().UnixNano()
	if expiry := atomic.LoadInt64(&s.enabledCacheExpiry); expiry > now {
		return s.enabledCache
	}
	enabled, err := s.settingService.GetBool(ctx, SettingSensitiveWordsEnabled)
	if err != nil {
		return false
	}
	s.enabledCache = enabled
	atomic.StoreInt64(&s.enabledCacheExpiry, now+int64(enabledCacheTTL))
	return enabled
}

func (s *SensitiveWordService) Check(ctx context.Context, text string) (bool, string) {
	if !s.IsEnabled(ctx) {
		return false, ""
	}

	words := s.wordsCache.get()
	if len(words) == 0 || atomic.LoadInt64(&s.wordsCacheExpiry) <= time.Now().UnixNano() {
		// Reload from settings (first call, cache miss, or TTL expired)
		var rawWords []string
		if err := s.settingService.GetJSON(ctx, SettingSensitiveWordsList, &rawWords); err != nil {
			return false, ""
		}
		s.wordsCache.set(rawWords)
		atomic.StoreInt64(&s.wordsCacheExpiry, time.Now().UnixNano()+int64(wordsCacheTTL))
		words = s.wordsCache.get()
	}

	if len(words) == 0 {
		return false, ""
	}

	lower := strings.ToLower(text)
	for _, w := range words {
		if strings.Contains(lower, w) {
			return true, w
		}
	}
	return false, ""
}

// InvalidateCache clears the in-memory word cache and enabled flag so the next Check reloads from settings.
func (s *SensitiveWordService) InvalidateCache() {
	s.wordsCache.mu.Lock()
	s.wordsCache.data = nil
	s.wordsCache.mu.Unlock()
	atomic.StoreInt64(&s.wordsCacheExpiry, 0)
	atomic.StoreInt64(&s.enabledCacheExpiry, 0)
}

// Set replaces the entire sensitive word list and invalidates the cache.
func (s *SensitiveWordService) Set(ctx context.Context, words []string) error {
	data, err := json.Marshal(words)
	if err != nil {
		return err
	}
	if _, err := s.settingService.Set(ctx, SettingSensitiveWordsList, string(data), "json", "", ""); err != nil {
		return err
	}
	s.InvalidateCache()
	return nil
}

// Add appends a word to the sensitive word list and invalidates the cache.
func (s *SensitiveWordService) Add(ctx context.Context, word string) error {
	word = strings.TrimSpace(word)
	if word == "" {
		return nil
	}
	var words []string
	_ = s.settingService.GetJSON(ctx, SettingSensitiveWordsList, &words)
	for _, w := range words {
		if strings.EqualFold(w, word) {
			return nil
		}
	}
	words = append(words, word)
	return s.Set(ctx, words)
}

// Delete removes a word from the sensitive word list and invalidates the cache.
func (s *SensitiveWordService) Delete(ctx context.Context, word string) error {
	var words []string
	_ = s.settingService.GetJSON(ctx, SettingSensitiveWordsList, &words)
	filtered := make([]string, 0, len(words))
	for _, w := range words {
		if !strings.EqualFold(w, word) {
			filtered = append(filtered, w)
		}
	}
	return s.Set(ctx, filtered)
}
