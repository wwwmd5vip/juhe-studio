package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var ErrSettingNotFound = errors.New("setting not found")

type SettingService struct {
	settingRepo *repository.SettingRepository
}

func NewSettingService(settingRepo *repository.SettingRepository) *SettingService {
	return &SettingService{settingRepo: settingRepo}
}

func (s *SettingService) Set(ctx context.Context, key, value, typ, category, description string) (*domain.Setting, error) {
	if typ == "" {
		typ = "string"
	}
	if err := validateSettingValue(value, typ); err != nil {
		return nil, err
	}
	existing, err := s.settingRepo.FindByKey(ctx, key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			st := &domain.Setting{Key: key, Value: value, Type: typ, Category: category, Description: description}
			if err := s.settingRepo.Create(ctx, st); err != nil {
				return nil, err
			}
			return st, nil
		}
		return nil, err
	}
	existing.Value = value
	if typ != "" {
		existing.Type = typ
	}
	if category != "" {
		existing.Category = category
	}
	if description != "" {
		existing.Description = description
	}
	return existing, s.settingRepo.Update(ctx, existing)
}

func (s *SettingService) Get(ctx context.Context, key string) (*domain.Setting, error) {
	st, err := s.settingRepo.FindByKey(ctx, key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSettingNotFound
		}
		return nil, err
	}
	return st, nil
}

func (s *SettingService) GetString(ctx context.Context, key string) (string, error) {
	st, err := s.Get(ctx, key)
	if err != nil {
		return "", err
	}
	return st.Value, nil
}

func (s *SettingService) GetBool(ctx context.Context, key string) (bool, error) {
	st, err := s.Get(ctx, key)
	if err != nil {
		return false, err
	}
	v, err := strconv.ParseBool(st.Value)
	if err != nil {
		return false, fmt.Errorf("setting %s is not a bool: %w", key, err)
	}
	return v, nil
}

func (s *SettingService) GetJSON(ctx context.Context, key string, out any) error {
	st, err := s.Get(ctx, key)
	if err != nil {
		return err
	}
	if st.Value == "" {
		return nil
	}
	return json.Unmarshal([]byte(st.Value), out)
}

func (s *SettingService) Delete(ctx context.Context, key string) error {
	return s.settingRepo.Delete(ctx, key)
}

func (s *SettingService) BulkSet(ctx context.Context, items []dto.SettingItem) error {
	for _, item := range items {
		if _, err := s.Set(ctx, item.Key, item.Value, item.Type, item.Category, item.Description); err != nil {
			return err
		}
	}
	return nil
}

func (s *SettingService) List(ctx context.Context, page, pageSize int, category string) ([]domain.Setting, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.settingRepo.List(ctx, page, pageSize, category)
}

// ListCategorized 返回所有 settings 按 category 分组
func (s *SettingService) ListCategorized(ctx context.Context) (map[string][]domain.Setting, error) {
	all, err := s.settingRepo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	result := make(map[string][]domain.Setting)
	for _, st := range all {
		cat := st.Category
		if cat == "" {
			cat = "other"
		}
		result[cat] = append(result[cat], st)
	}
	return result, nil
}

func validateSettingValue(value, typ string) error {
	switch typ {
	case "bool":
		if _, err := strconv.ParseBool(value); err != nil {
			return fmt.Errorf("invalid bool value %q: %w", value, err)
		}
	case "number":
		if _, err := strconv.ParseFloat(value, 64); err != nil {
			return fmt.Errorf("invalid number value %q: %w", value, err)
		}
	case "json":
		var v interface{}
		if err := json.Unmarshal([]byte(value), &v); err != nil {
			return fmt.Errorf("invalid json value %q: %w", value, err)
		}
	}
	return nil
}
