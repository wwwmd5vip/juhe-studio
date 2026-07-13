package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type ChannelRepository struct {
	db *gorm.DB
}

func NewChannelRepository(db *gorm.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

type ModelSyncItem struct {
	ModelName string
	Type      domain.ModelType
}

func (r *ChannelRepository) UpdateChannelAndSyncModels(
	ctx context.Context,
	channel *domain.Channel,
	modelItems []ModelSyncItem,
) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(channel).Error; err != nil {
			return err
		}
		if err := tx.Where("channel_id = ?", channel.ID).Delete(&domain.Ability{}).Error; err != nil {
			return err
		}

		groups := SplitComma(channel.Groups)
		if len(groups) > 0 && len(modelItems) > 0 {
			abilities := make([]domain.Ability, 0, len(modelItems)*len(groups))
			for _, group := range groups {
				for _, item := range modelItems {
					abilities = append(abilities, domain.Ability{
						Group:     group,
						ModelName: item.ModelName,
						ChannelID: channel.ID,
						Priority:  channel.Priority,
						Weight:    channel.Weight,
						Enabled:   channel.Status == domain.ChannelActive,
					})
				}
			}
			if err := tx.CreateInBatches(&abilities, 100).Error; err != nil {
				return err
			}
		}

		// Batch-fetch existing models and deduplicate model names
		modelNames := make([]string, 0, len(modelItems))
		seenModel := make(map[string]bool, len(modelItems))
		for _, item := range modelItems {
			if !seenModel[item.ModelName] {
				seenModel[item.ModelName] = true
				modelNames = append(modelNames, item.ModelName)
			}
		}

		var existingModels []domain.Model
		if err := tx.Where("model_name IN ?", modelNames).Find(&existingModels).Error; err != nil {
			return err
		}
		existingMap := make(map[string]*domain.Model, len(existingModels))
		for i := range existingModels {
			existingMap[existingModels[i].ModelName] = &existingModels[i]
		}

		now := time.Now().UTC()
		for _, item := range modelItems {
			itemType := item.Type
			if existing, ok := existingMap[item.ModelName]; ok {
				existing.Type = itemType
				existing.UpdatedAt = now
				if err := tx.Save(existing).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Create(&domain.Model{
					ModelName: item.ModelName,
					Type:      itemType,
					Status:    1,
					MatchRule: domain.ModelMatchExact,
					CreatedAt: now,
					UpdatedAt: now,
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func IsRecordNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func (r *ChannelRepository) Create(ctx context.Context, channel *domain.Channel) error {
	return r.db.WithContext(ctx).Create(channel).Error
}

func (r *ChannelRepository) FindByID(ctx context.Context, id uint64) (*domain.Channel, error) {
	var channel domain.Channel
	if err := r.db.WithContext(ctx).First(&channel, id).Error; err != nil {
		return nil, err
	}
	return &channel, nil
}

// FindByIDs batch-loads channels by their IDs. Returns a map of channel ID → channel.
func (r *ChannelRepository) FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*domain.Channel, error) {
	if len(ids) == 0 {
		return map[uint64]*domain.Channel{}, nil
	}
	var channels []domain.Channel
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&channels).Error; err != nil {
		return nil, err
	}
	m := make(map[uint64]*domain.Channel, len(channels))
	for i := range channels {
		m[channels[i].ID] = &channels[i]
	}
	return m, nil
}

func (r *ChannelRepository) List(ctx context.Context, page, pageSize int, keyword, typeFilter string, statusFilter int) ([]domain.Channel, int64, error) {
	var channels []domain.Channel
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Channel{})
	if keyword != "" {
		query = query.Where("name LIKE ? OR models LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if typeFilter != "" {
		query = query.Where("type = ?", typeFilter)
	}
	if statusFilter >= 0 {
		query = query.Where("status = ?", statusFilter)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&channels).Error; err != nil {
		return nil, 0, err
	}

	return channels, total, nil
}

func (r *ChannelRepository) Update(ctx context.Context, channel *domain.Channel) error {
	return r.db.WithContext(ctx).Save(channel).Error
}

func (r *ChannelRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Channel{}, id).Error
}

func (r *ChannelRepository) DB() *gorm.DB {
	return r.db
}

func (r *ChannelRepository) DeleteAbilitiesByChannel(ctx context.Context, channelID uint64) error {
	return r.db.WithContext(ctx).Where("channel_id = ?", channelID).Delete(&domain.Ability{}).Error
}

func (r *ChannelRepository) CreateAbilities(ctx context.Context, abilities []domain.Ability) error {
	if len(abilities) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(&abilities, 100).Error
}

func (r *ChannelRepository) UpdateChannelAndAbilities(
	ctx context.Context,
	channel *domain.Channel,
	modelIDs []string,
) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Optimistic locking: only update if the channel hasn't been modified since we read it
		oldUpdatedAt := channel.UpdatedAt
		result := tx.Model(channel).Where("id = ? AND updated_at = ?", channel.ID, oldUpdatedAt).
			Select("*").Updates(channel)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("channel has been modified by another operation, please refresh and try again")
		}
		if err := tx.Where("channel_id = ?", channel.ID).Delete(&domain.Ability{}).Error; err != nil {
			return err
		}
		groups := SplitComma(channel.Groups)
		if len(modelIDs) == 0 || len(groups) == 0 {
			return nil
		}
		abilities := make([]domain.Ability, 0, len(modelIDs)*len(groups))
		for _, group := range groups {
			for _, model := range modelIDs {
				abilities = append(abilities, domain.Ability{
					Group:     group,
					ModelName: model,
					ChannelID: channel.ID,
					Priority:  channel.Priority,
					Weight:    channel.Weight,
					Enabled:   channel.Status == domain.ChannelActive,
				})
			}
		}
		return tx.CreateInBatches(&abilities, 100).Error
	})
}

func (r *ChannelRepository) ListDistinctModelsByGroup(ctx context.Context, group string) ([]string, error) {
	var rows []struct {
		ModelName string `gorm:"column:model_name"`
	}
	err := r.db.WithContext(ctx).
		Model(&domain.Ability{}).
		Where("`group` = ? AND enabled = ?", group, true).
		Distinct("model_name").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]string, len(rows))
	for i, r := range rows {
		result[i] = r.ModelName
	}
	return result, nil
}

func (r *ChannelRepository) FindAbilitiesByGroupAndModel(ctx context.Context, group, modelName string) ([]domain.Ability, error) {
	var abilities []domain.Ability
	err := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.`group` = ? AND abilities.model_name = ? AND abilities.enabled = ? AND channels.status = ?", group, modelName, true, domain.ChannelActive).
		Order("abilities.priority DESC, abilities.weight DESC").
		Find(&abilities).Error
	return abilities, err
}

func (r *ChannelRepository) ListActive(ctx context.Context, page, pageSize int) ([]domain.Channel, int64, error) {
	var channels []domain.Channel
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Channel{}).Where("status = ?", domain.ChannelActive)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("id ASC").Offset(offset).Limit(pageSize).Find(&channels).Error; err != nil {
		return nil, 0, err
	}
	return channels, total, nil
}

// ListAllActive returns all active channels without pagination.
func (r *ChannelRepository) ListAllActive(ctx context.Context) ([]domain.Channel, error) {
	var channels []domain.Channel
	if err := r.db.WithContext(ctx).Model(&domain.Channel{}).
		Where("status = ?", domain.ChannelActive).
		Order("id ASC").
		Find(&channels).Error; err != nil {
		return nil, err
	}
	return channels, nil
}

// ResetAllConsecutiveFailures 将所有渠道的 consecutive_failures 重置为 0，
// 并将因自动禁用（ChannelError）的渠道恢复为 Active。
// 在服务重启时调用，给渠道一个干净的起点。
func (r *ChannelRepository) ResetAllConsecutiveFailures(ctx context.Context) (recovered int64, err error) {
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var channelIDs []uint64
		if err := tx.Model(&domain.Channel{}).
			Where("status = ?", domain.ChannelError).
			Pluck("id", &channelIDs).Error; err != nil {
			return err
		}
		recovered = int64(len(channelIDs))

		if recovered > 0 {
			if err := tx.Model(&domain.Channel{}).
				Where("id IN ?", channelIDs).
				Updates(map[string]any{
					"status":               domain.ChannelActive,
					"consecutive_failures": 0,
					"last_error":           nil,
				}).Error; err != nil {
				return err
			}
			if err := tx.Model(&domain.Ability{}).
				Where("channel_id IN ?", channelIDs).
				Update("enabled", true).Error; err != nil {
				return err
			}
		}

		return tx.Model(&domain.Channel{}).
			Where("status != ? AND consecutive_failures > 0", domain.ChannelError).
			Update("consecutive_failures", 0).Error
	})
	return recovered, err
}

func (r *ChannelRepository) UpdateHealth(ctx context.Context, channel *domain.Channel) error {
	return r.db.WithContext(ctx).Model(&domain.Channel{}).
		Where("id = ?", channel.ID).
		Updates(map[string]any{
			"status":               channel.Status,
			"fail_count":           channel.FailCount,
			"consecutive_failures": channel.ConsecutiveFailures,
			"last_error":           channel.LastError,
			"last_checked_at":      channel.LastCheckedAt,
			"response_time_ms":     channel.ResponseTimeMs,
		}).Error
}

// RecordFailure atomically increments failure counters. Returns new consecutive_failures.
func (r *ChannelRepository) RecordFailure(ctx context.Context, id uint64, errMsg string, now time.Time) (int64, error) {
	var consecutive int64
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&domain.Channel{}).Where("id = ?", id).
			Updates(map[string]any{
				"consecutive_failures": gorm.Expr("consecutive_failures + 1"),
				"fail_count":           gorm.Expr("fail_count + 1"),
				"last_error":           errMsg,
				"last_checked_at":      now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&domain.Channel{}).Where("id = ?", id).
			Select("consecutive_failures").Scan(&consecutive).Error
	})
	return consecutive, err
}

// RecordSuccess atomically resets consecutive_failures to 0 and
// restores the channel to active if it was auto-banned (ChannelError).
func (r *ChannelRepository) RecordSuccess(ctx context.Context, id uint64, responseTimeMs int, now time.Time) error {
	return r.db.WithContext(ctx).Model(&domain.Channel{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"consecutive_failures": 0,
			"last_error":           nil,
			"response_time_ms":     responseTimeMs,
			"last_checked_at":      now,
			"status":               gorm.Expr("CASE WHEN status = ? THEN ? ELSE status END", domain.ChannelError, domain.ChannelActive),
		}).Error
}

func (r *ChannelRepository) FindAbilitiesByGroupAndModelExcludingChannel(ctx context.Context, group, modelName string, exclude []uint64) ([]domain.Ability, error) {
	var abilities []domain.Ability
	query := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.`group` = ? AND abilities.model_name = ? AND abilities.enabled = ? AND channels.status = ?", group, modelName, true, domain.ChannelActive)
	if len(exclude) > 0 {
		query = query.Where("channels.id NOT IN ?", exclude)
	}
	err := query.Order("abilities.priority DESC, abilities.weight DESC").Find(&abilities).Error
	return abilities, err
}

// FindAbilitiesByGroupAndModelIncludingBanned 获取指定分组和模型的能力（包含被自动禁用的渠道），
// 作为最后手段使用。按 consecutive_failures ASC 排序，最少失败的优先。
func (r *ChannelRepository) FindAbilitiesByGroupAndModelIncludingBanned(ctx context.Context, group, modelName string) ([]domain.Ability, error) {
	var abilities []domain.Ability
	err := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.`group` = ? AND abilities.model_name = ? AND channels.status IN ?",
			group, modelName, []domain.ChannelStatus{domain.ChannelActive, domain.ChannelError}).
		Order("channels.consecutive_failures ASC, abilities.priority DESC, abilities.weight DESC").
		Find(&abilities).Error
	return abilities, err
}

// FindAllAbilitiesByGroup 获取某分组下所有启用的能力（用于模糊匹配）
func (r *ChannelRepository) FindAllAbilitiesByGroup(ctx context.Context, group string) ([]domain.Ability, error) {
	var abilities []domain.Ability
	err := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.`group` = ? AND abilities.enabled = ? AND channels.status = ?", group, true, domain.ChannelActive).
		Order("abilities.priority DESC, abilities.weight DESC").
		Find(&abilities).Error
	return abilities, err
}

// FindAllAbilitiesByGroupExcluding 获取某分组下所有启用的能力（排除指定渠道）
func (r *ChannelRepository) FindAllAbilitiesByGroupExcluding(ctx context.Context, group string, exclude []uint64) ([]domain.Ability, error) {
	var abilities []domain.Ability
	query := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.`group` = ? AND abilities.enabled = ? AND channels.status = ?", group, true, domain.ChannelActive)
	if len(exclude) > 0 {
		query = query.Where("channels.id NOT IN ?", exclude)
	}
	err := query.Order("abilities.priority DESC, abilities.weight DESC").Find(&abilities).Error
	return abilities, err
}

// FindAllAbilitiesExcluding 获取所有分组下启用的能力（排除指定渠道，用于跨组重试）
func (r *ChannelRepository) FindAllAbilitiesExcluding(ctx context.Context, exclude []uint64) ([]domain.Ability, error) {
	var abilities []domain.Ability
	query := r.db.WithContext(ctx).
		Joins("JOIN channels ON channels.id = abilities.channel_id").
		Where("abilities.enabled = ? AND channels.status = ?", true, domain.ChannelActive)
	if len(exclude) > 0 {
		query = query.Where("channels.id NOT IN ?", exclude)
	}
	err := query.Order("abilities.priority DESC, abilities.weight DESC").Find(&abilities).Error
	return abilities, err
}

// ListDistinctGroups 获取所有不重复的分组名
// SyncModelAbilities replaces all ability entries for a model_name across the given channel IDs.
// It deletes existing abilities for this model_name, then creates new ones for each channel's groups.
// Channels are fetched in a single batch query to avoid N+1.
func (r *ChannelRepository) SyncModelAbilities(ctx context.Context, modelName string, channelIDs []uint64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("model_name = ?", modelName).Delete(&domain.Ability{}).Error; err != nil {
			return err
		}
		if len(channelIDs) == 0 {
			return nil
		}

		// Batch-fetch all channels in one query instead of N+1
		var channels []domain.Channel
		if err := tx.Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			return err
		}

		var allAbilities []domain.Ability
		for _, channel := range channels {
			groups := SplitComma(channel.Groups)
			if len(groups) == 0 {
				continue
			}
			for _, group := range groups {
				allAbilities = append(allAbilities, domain.Ability{
					Group:     group,
					ModelName: modelName,
					ChannelID: channel.ID,
					Priority:  channel.Priority,
					Weight:    channel.Weight,
					Enabled:   channel.Status == domain.ChannelActive,
				})
			}
		}
		if len(allAbilities) > 0 {
			return tx.CreateInBatches(&allAbilities, 100).Error
		}
		return nil
	})
}

func (r *ChannelRepository) ListDistinctGroups(ctx context.Context) ([]string, error) {
	var rows []struct {
		Group string `gorm:"column:group_name"`
	}
	err := r.db.WithContext(ctx).
		Model(&domain.Ability{}).
		Where("enabled = ?", true).
		Select("DISTINCT `group` as group_name").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]string, len(rows))
	for i, row := range rows {
		result[i] = row.Group
	}
	return result, nil
}

func SplitLines(s string) []string {
	parts := strings.Split(s, "\n")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// ModelChannelRow channels linked to a model via abilities
type ModelChannelRow struct {
	ID      uint64
	Name    string
	Type    string
	Status  int
	BaseURL *string
	Group   string
}

// FindByModelID returns channels linked to a model via abilities where ability.model_name matches.
func (r *ChannelRepository) FindByModelID(ctx context.Context, modelName string) ([]ModelChannelRow, error) {
	var rows []ModelChannelRow
	err := r.db.WithContext(ctx).
		Table("channels").
		Select("DISTINCT channels.id, channels.name, channels.type, channels.status, channels.base_url, abilities.group").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model_name = ?", modelName).
		Find(&rows).Error
	return rows, err
}

func SplitComma(s string) []string {
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
