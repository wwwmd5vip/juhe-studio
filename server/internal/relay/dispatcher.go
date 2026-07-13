package relay

import (
	"context"
	"errors"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
)

var (
	ErrNoAvailableChannel = errors.New("no available channel for model and group")
)

type Dispatcher struct {
	channelRepo *repository.ChannelRepository
	rng         *rand.Rand
	rngMu       sync.Mutex
}

func NewDispatcher(channelRepo *repository.ChannelRepository) *Dispatcher {
	return &Dispatcher{
		channelRepo: channelRepo,
		rng:         rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (d *Dispatcher) SelectChannel(ctx context.Context, modelName, group string) (*domain.Channel, error) {
	abilities, err := d.channelRepo.FindAbilitiesByGroupAndModel(ctx, group, modelName)
	if err != nil || len(abilities) == 0 {
		// 尝试模糊匹配（MatchRule）
		allAbilities, allErr := d.channelRepo.FindAllAbilitiesByGroup(ctx, group)
		if allErr != nil || len(allAbilities) == 0 {
			return nil, ErrNoAvailableChannel
		}
		matched := d.matchByRule(modelName, allAbilities)
		if len(matched) == 0 {
			return nil, ErrNoAvailableChannel
		}
		abilities = matched
	}

	return d.weightedSelect(ctx, abilities)
}

func (d *Dispatcher) SelectChannelExcluding(ctx context.Context, modelName, group string, exclude []uint64) (*domain.Channel, error) {
	abilities, err := d.channelRepo.FindAbilitiesByGroupAndModelExcludingChannel(ctx, group, modelName, exclude)
	if err != nil || len(abilities) == 0 {
		// 尝试模糊匹配
		allAbilities, allErr := d.channelRepo.FindAllAbilitiesByGroupExcluding(ctx, group, exclude)
		if allErr != nil || len(allAbilities) == 0 {
			return nil, ErrNoAvailableChannel
		}
		matched := d.matchByRule(modelName, allAbilities)
		if len(matched) == 0 {
			return nil, ErrNoAvailableChannel
		}
		abilities = matched
	}

	return d.weightedSelect(ctx, abilities)
}

// matchByRule 根据 model 的 MatchRule 进行模糊匹配
func (d *Dispatcher) matchByRule(modelName string, abilities []domain.Ability) []domain.Ability {
	var result []domain.Ability
	modelNameLower := strings.ToLower(modelName)

	for _, ab := range abilities {
		modelLower := strings.ToLower(ab.ModelName)

		// 针对简单前缀/后缀/包含做快速匹配（ability 表不给 match_rule，采用通用策略）
		matched := false
		switch {
		case modelLower == modelNameLower:
			matched = true
		case strings.HasPrefix(modelNameLower, modelLower):
			matched = true
		case strings.HasPrefix(modelLower, modelNameLower):
			matched = true
		case strings.Contains(modelLower, modelNameLower):
			matched = true
		case strings.Contains(modelNameLower, modelLower):
			matched = true
		}

		if matched {
			result = append(result, ab)
		}
	}

	return result
}

func (d *Dispatcher) weightedSelect(ctx context.Context, abilities []domain.Ability) (*domain.Channel, error) {
	totalWeight := 0
	for _, ab := range abilities {
		totalWeight += ab.Weight + ab.Priority*10 + 1
	}

	if totalWeight <= 0 {
		return nil, ErrNoAvailableChannel
	}

	// Batch-load all candidate channels in a single DB query
	channelIDs := make([]uint64, len(abilities))
	for i, ab := range abilities {
		channelIDs[i] = ab.ChannelID
	}
	channelMap, err := d.channelRepo.FindByIDs(ctx, channelIDs)
	if err != nil {
		return nil, err
	}

	d.rngMu.Lock()
	r := d.rng.Intn(totalWeight)
	d.rngMu.Unlock()
	for _, ab := range abilities {
		w := ab.Weight + ab.Priority*10 + 1
		r -= w
		if r < 0 {
			if ch, ok := channelMap[ab.ChannelID]; ok {
				return ch, nil
			}
			// Fallback: if channel disappeared between query and selection
			return d.channelRepo.FindByID(ctx, ab.ChannelID)
		}
	}

	// Fallback: return first available
	if ch, ok := channelMap[abilities[0].ChannelID]; ok {
		return ch, nil
	}
	return d.channelRepo.FindByID(ctx, abilities[0].ChannelID)
}

// SelectAnyChannelExcluding 跨所有分组选择可用渠道（用于跨组重试）
func (d *Dispatcher) SelectAnyChannelExcluding(ctx context.Context, modelName string, exclude []uint64) (*domain.Channel, error) {
	abilities, err := d.channelRepo.FindAllAbilitiesExcluding(ctx, exclude)
	if err != nil || len(abilities) == 0 {
		return nil, ErrNoAvailableChannel
	}

	// 精确匹配 + 模糊匹配
	var matched []domain.Ability
	for _, ab := range abilities {
		if ab.ModelName == modelName {
			matched = append(matched, ab)
		}
	}
	if len(matched) == 0 {
		matched = d.matchByRule(modelName, abilities)
	}
	if len(matched) == 0 {
		return nil, ErrNoAvailableChannel
	}

	return d.weightedSelect(ctx, matched)
}

// SelectChannelAsLastResort 在所有正常渠道(包括被自动禁用的)中选择一个最后手段渠道。
// 仅在正常渠道全部不可用时作为降级方案调用。
func (d *Dispatcher) SelectChannelAsLastResort(ctx context.Context, modelName, group string) (*domain.Channel, error) {
	abilities, err := d.channelRepo.FindAbilitiesByGroupAndModelIncludingBanned(ctx, group, modelName)
	if err != nil || len(abilities) == 0 {
		return nil, ErrNoAvailableChannel
	}

	// 优先选精确匹配
	var matched []domain.Ability
	for _, ab := range abilities {
		if ab.ModelName == modelName {
			matched = append(matched, ab)
		}
	}
	if len(matched) == 0 {
		matched = d.matchByRule(modelName, abilities)
	}
	if len(matched) == 0 {
		return nil, ErrNoAvailableChannel
	}

	return d.weightedSelect(ctx, matched)
}

func (d *Dispatcher) PickKey(keys string) string {
	list := repository.SplitLines(keys)
	if len(list) == 0 {
		return ""
	}
	d.rngMu.Lock()
	idx := d.rng.Intn(len(list))
	d.rngMu.Unlock()
	return list[idx]
}

func ParseModelMapping(s *string) map[string]string {
	if s == nil || *s == "" {
		return nil
	}
	m := make(map[string]string)
	for _, line := range strings.Split(*s, "\n") {
		parts := strings.SplitN(strings.TrimSpace(line), ":", 2)
		if len(parts) == 2 {
			m[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return m
}
