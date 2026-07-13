package relay

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// newRelayTestDB creates an in-memory SQLite database with Channel and Ability tables.
// Uses a unique DB name per call to ensure test isolation (no cache=shared).
func newRelayTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.Channel{}, &domain.Ability{}))
	return db
}

// seedChannel creates a channel in the DB and returns it.
func seedChannel(t *testing.T, repo *repository.ChannelRepository, ch *domain.Channel) *domain.Channel {
	t.Helper()
	require.NoError(t, repo.Create(context.Background(), ch))
	return ch
}

// seedAbility inserts an ability record.
func seedAbility(t *testing.T, db *gorm.DB, ability *domain.Ability) {
	t.Helper()
	require.NoError(t, db.Create(ability).Error)
}

// =========================================================================
// RelayInfo tests
// =========================================================================

func TestRelayInfo_Struct(t *testing.T) {
	tokenID := uint64(42)
	ch := &domain.Channel{ID: 1, Name: "test-channel", Type: domain.ChannelTypeOpenAI}
	tok := &domain.Token{ID: 99, Name: "test-token"}

	info := &RelayInfo{
		UserID:      10,
		TokenID:     &tokenID,
		ChannelID:   1,
		ModelName:   "gpt-4",
		Group:       "default",
		Channel:     ch,
		Token:       tok,
		RequestID:   "req-abc-123",
		Mode:        domain.LogModeNonStream,
		ContentType: "application/json",
		IPAddress:   "127.0.0.1",
		UserAgent:   "test-agent/1.0",
	}

	assert.Equal(t, uint64(10), info.UserID)
	assert.NotNil(t, info.TokenID)
	assert.Equal(t, uint64(42), *info.TokenID)
	assert.Equal(t, uint64(1), info.ChannelID)
	assert.Equal(t, "gpt-4", info.ModelName)
	assert.Equal(t, "default", info.Group)
	assert.Equal(t, ch, info.Channel)
	assert.Equal(t, tok, info.Token)
	assert.Equal(t, "req-abc-123", info.RequestID)
	assert.Equal(t, domain.LogModeNonStream, info.Mode)
	assert.Equal(t, "application/json", info.ContentType)
	assert.Equal(t, "127.0.0.1", info.IPAddress)
	assert.Equal(t, "test-agent/1.0", info.UserAgent)
}

func TestRelayInfo_DefaultValues(t *testing.T) {
	info := &RelayInfo{}
	assert.Zero(t, info.UserID)
	assert.Nil(t, info.TokenID)
	assert.Zero(t, info.ChannelID)
	assert.Empty(t, info.ModelName)
	assert.Empty(t, info.Group)
	assert.Nil(t, info.Channel)
	assert.Nil(t, info.Token)
	assert.Empty(t, info.RequestID)
	assert.Empty(t, info.Mode)
	assert.Empty(t, info.ContentType)
	assert.Empty(t, info.IPAddress)
	assert.Empty(t, info.UserAgent)
}

func TestRelayInfo_StreamMode(t *testing.T) {
	info := &RelayInfo{
		UserID:    1,
		ModelName: "gpt-4",
		Mode:      domain.LogModeStream,
	}
	assert.Equal(t, domain.LogModeStream, info.Mode)
}

// =========================================================================
// Dispatcher tests
// =========================================================================

func TestDispatcher_SelectChannel_ExactMatch(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "openai-1",
		Keys:   "sk-test-key",
		Models: "gpt-4",
		Groups: "default",
		Weight: 5,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch.ID,
		Weight:    5,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4", "default")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch.ID, result.ID)
	assert.Equal(t, "openai-1", result.Name)
}

func TestDispatcher_SelectChannel_FuzzyMatchPrefix(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "openai-1",
		Keys:   "sk-key",
		Models: "gpt-4-turbo",
		Groups: "default",
		Weight: 3,
		Status: domain.ChannelActive,
	})
	// Ability registered as "gpt-4-turbo" but we request "gpt-4" — fuzzy match via prefix
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4-turbo",
		ChannelID: ch.ID,
		Weight:    3,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4", "default")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch.ID, result.ID)
}

func TestDispatcher_SelectChannel_FuzzyMatchSuffix(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "openai-suffix",
		Keys:   "sk-key",
		Models: "gpt-4",
		Groups: "default",
		Weight: 2,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch.ID,
		Weight:    2,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4-0613", "default")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch.ID, result.ID)
}

func TestDispatcher_SelectChannel_FuzzyMatchContains(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "openai-contains",
		Keys:   "sk-key",
		Models: "claude",
		Groups: "default",
		Weight: 1,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "claude-3-opus",
		ChannelID: ch.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "claude", "default")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch.ID, result.ID)
}

func TestDispatcher_SelectChannel_NoAvailableChannel(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Empty DB — no channels or abilities
	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4", "default")
	require.Error(t, err)
	require.Nil(t, result)
	assert.ErrorIs(t, err, ErrNoAvailableChannel)
}

func TestDispatcher_SelectChannel_NoMatchingModel(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Channel exists but with a different model
	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "openai-1",
		Keys:   "sk-key",
		Models: "gpt-3.5-turbo",
		Groups: "default",
		Weight: 3,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-3.5-turbo",
		ChannelID: ch.ID,
		Weight:    3,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4", "default")
	require.Error(t, err)
	require.Nil(t, result)
	assert.ErrorIs(t, err, ErrNoAvailableChannel)
}

func TestDispatcher_SelectChannel_NonActiveChannel(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Create a channel with error status (non-active).
	// NOTE: Cannot use ChannelDisabled (0) because GORM's default:1 tag
	// overrides zero-value fields on Create. Use ChannelError (2) instead.
	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "error-channel",
		Keys:   "sk-key",
		Models: "gpt-4",
		Groups: "default",
		Weight: 3,
		Status: domain.ChannelError,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch.ID,
		Weight:    3,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectChannel(ctx, "gpt-4", "default")
	require.Error(t, err)
	require.Nil(t, result)
	assert.ErrorIs(t, err, ErrNoAvailableChannel)
}

func TestDispatcher_SelectChannel_WeightedSelection(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Channel with high weight
	chHigh := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "high-weight",
		Keys:   "sk-key-high",
		Models: "gpt-4",
		Groups: "default",
		Weight: 100,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: chHigh.ID,
		Weight:    100,
		Priority:  0,
		Enabled:   true,
	})

	// Channel with low weight
	chLow := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "low-weight",
		Keys:   "sk-key-low",
		Models: "gpt-4",
		Groups: "default",
		Weight: 1,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: chLow.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)

	// Run many selections — the high-weight channel should be selected more often
	highCount := 0
	lowCount := 0
	for i := 0; i < 500; i++ {
		result, err := disp.SelectChannel(ctx, "gpt-4", "default")
		require.NoError(t, err)
		if result.ID == chHigh.ID {
			highCount++
		} else {
			lowCount++
		}
	}

	// With weight 100 vs 1 (+1 for the +1 in formula), the high channel should dominate
	assert.Greater(t, highCount, lowCount,
		"high-weight channel should be selected more often (got high=%d low=%d)", highCount, lowCount)
}

func TestDispatcher_SelectChannel_HighPriority(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Channel with high priority (priority*10 weight bonus)
	chHighPrio := seedChannel(t, repo, &domain.Channel{
		Type:     domain.ChannelTypeOpenAI,
		Name:     "high-priority",
		Keys:     "sk-key-prio",
		Models:   "gpt-4",
		Groups:   "default",
		Weight:   1,
		Priority: 10,
		Status:   domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: chHighPrio.ID,
		Weight:    1,
		Priority:  10,
		Enabled:   true,
	})

	// Channel with zero priority
	chLowPrio := seedChannel(t, repo, &domain.Channel{
		Type:     domain.ChannelTypeOpenAI,
		Name:     "low-priority",
		Keys:     "sk-key-low",
		Models:   "gpt-4",
		Groups:   "default",
		Weight:   1,
		Priority: 0,
		Status:   domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: chLowPrio.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)

	highCount := 0
	lowCount := 0
	for i := 0; i < 500; i++ {
		result, err := disp.SelectChannel(ctx, "gpt-4", "default")
		require.NoError(t, err)
		if result.ID == chHighPrio.ID {
			highCount++
		} else {
			lowCount++
		}
	}

	// High priority channel has weight 1+10*10+1 = 102, low has 1+0+1 = 2
	// Ratio ~51:1, so high should dominate
	assert.Greater(t, highCount, lowCount,
		"high-priority channel should be selected more often (got high=%d low=%d)", highCount, lowCount)
}

func TestDispatcher_SelectChannelExcluding(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch1 := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "ch-1",
		Keys:   "sk-key-1",
		Models: "gpt-4",
		Groups: "default",
		Weight: 1,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch1.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	ch2 := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "ch-2",
		Keys:   "sk-key-2",
		Models: "gpt-4",
		Groups: "default",
		Weight: 1,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch2.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)

	// Exclude ch1, should get ch2
	result, err := disp.SelectChannelExcluding(ctx, "gpt-4", "default", []uint64{ch1.ID})
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch2.ID, result.ID)
}

func TestDispatcher_SelectChannelExcluding_OnlyExcluded(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "only-ch",
		Keys:   "sk-key",
		Models: "gpt-4",
		Groups: "default",
		Weight: 1,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch.ID,
		Weight:    1,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)

	// Exclude the only channel
	result, err := disp.SelectChannelExcluding(ctx, "gpt-4", "default", []uint64{ch.ID})
	require.Error(t, err)
	require.Nil(t, result)
	assert.ErrorIs(t, err, ErrNoAvailableChannel)
}

// =========================================================================
// Dispatcher.PickKey tests
// =========================================================================

func TestDispatcher_PickKey_SingleKey(t *testing.T) {
	disp := NewDispatcher(nil)
	key := disp.PickKey("sk-juhe-key123")
	assert.Equal(t, "sk-juhe-key123", key)
}

func TestDispatcher_PickKey_MultipleKeys(t *testing.T) {
	disp := NewDispatcher(nil)
	keys := "key1\nkey2\nkey3"
	for i := 0; i < 30; i++ {
		key := disp.PickKey(keys)
		assert.Contains(t, []string{"key1", "key2", "key3"}, key)
	}
}

func TestDispatcher_PickKey_EmptyString(t *testing.T) {
	disp := NewDispatcher(nil)
	key := disp.PickKey("")
	assert.Empty(t, key)
}

func TestDispatcher_PickKey_WhitespaceOnly(t *testing.T) {
	disp := NewDispatcher(nil)
	key := disp.PickKey("\n  \n")
	assert.Empty(t, key)
}

// =========================================================================
// ParseModelMapping tests
// =========================================================================

func TestParseModelMapping_Valid(t *testing.T) {
	tt := []struct {
		name     string
		input    string
		expected map[string]string
	}{
		{
			name:     "single entry",
			input:    "gpt-4:o1-preview",
			expected: map[string]string{"gpt-4": "o1-preview"},
		},
		{
			name:     "multiple entries",
			input:    "gpt-4:o1-preview\nclaude-3:claude-3-opus",
			expected: map[string]string{"gpt-4": "o1-preview", "claude-3": "claude-3-opus"},
		},
		{
			name:     "trims whitespace",
			input:    " gpt-4 : o1-preview \n claude-3 : claude-3-opus ",
			expected: map[string]string{"gpt-4": "o1-preview", "claude-3": "claude-3-opus"},
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			s := tc.input
			result := ParseModelMapping(&s)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestParseModelMapping_NilPointer(t *testing.T) {
	result := ParseModelMapping(nil)
	assert.Nil(t, result)
}

func TestParseModelMapping_EmptyString(t *testing.T) {
	s := ""
	result := ParseModelMapping(&s)
	assert.Nil(t, result)
}

func TestParseModelMapping_NoColon(t *testing.T) {
	s := "gpt-4"
	result := ParseModelMapping(&s)
	assert.Empty(t, result)
}

func TestParseModelMapping_InvalidFormat(t *testing.T) {
	s := "gpt-4:o1:extra"
	result := ParseModelMapping(&s)
	// SplitN with limit 2, so "gpt-4" → "o1:extra"
	assert.Equal(t, map[string]string{"gpt-4": "o1:extra"}, result)
}


// =========================================================================
// Dispatcher.SelectAnyChannelExcluding tests
// =========================================================================

func TestDispatcher_SelectAnyChannelExcluding(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	ch := seedChannel(t, repo, &domain.Channel{
		Type:   domain.ChannelTypeOpenAI,
		Name:   "any-ch",
		Keys:   "sk-key",
		Models: "gpt-4",
		Groups: "default",
		Weight: 5,
		Status: domain.ChannelActive,
	})
	seedAbility(t, db, &domain.Ability{
		Group:     "default",
		ModelName: "gpt-4",
		ChannelID: ch.ID,
		Weight:    5,
		Priority:  0,
		Enabled:   true,
	})

	disp := NewDispatcher(repo)
	result, err := disp.SelectAnyChannelExcluding(ctx, "gpt-4", nil)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, ch.ID, result.ID)
}

func TestDispatcher_SelectAnyChannelExcluding_Empty(t *testing.T) {
	db := newRelayTestDB(t)
	repo := repository.NewChannelRepository(db)
	ctx := context.Background()

	disp := NewDispatcher(repo)
	result, err := disp.SelectAnyChannelExcluding(ctx, "gpt-4", nil)
	require.Error(t, err)
	require.Nil(t, result)
	assert.ErrorIs(t, err, ErrNoAvailableChannel)
}

// =========================================================================
// Table-driven test: Dispatcher.SelectChannel scenarios
// =========================================================================

func TestDispatcher_SelectChannel_TableDriven(t *testing.T) {
	tests := []struct {
		name          string
		abilities     []domain.Ability
		modelName     string
		group         string
		expectError   bool
		expectedError error
	}{
		{
			name:          "no abilities -> error",
			abilities:     nil,
			modelName:     "gpt-4",
			group:         "default",
			expectError:   true,
			expectedError: ErrNoAvailableChannel,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db := newRelayTestDB(t)
			repo := repository.NewChannelRepository(db)
			ctx := context.Background()

			for _, ab := range tc.abilities {
				// Create channel first
				ch := &domain.Channel{
					Type:   domain.ChannelTypeOpenAI,
					Name:   "ch-" + ab.ModelName,
					Keys:   "sk-key",
					Models: ab.ModelName,
					Groups: ab.Group,
					Weight: ab.Weight,
					Status: domain.ChannelActive,
				}
				require.NoError(t, repo.Create(ctx, ch))
				ab.ChannelID = ch.ID
				seedAbility(t, db, &ab)
			}

			disp := NewDispatcher(repo)
			result, err := disp.SelectChannel(ctx, tc.modelName, tc.group)
			if tc.expectError {
				require.Error(t, err)
				assert.ErrorIs(t, err, tc.expectedError)
				require.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
			}
		})
	}
}
