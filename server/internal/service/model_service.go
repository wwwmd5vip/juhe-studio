package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
)

var (
	ErrModelNotFound     = errors.New("模型不存在")
	ErrModelExists       = errors.New("模型已存在")
	ErrInvalidCapability = errors.New("无效的模型能力")
	ErrInvalidEndpoint   = errors.New("无效的端点类型")
)

type ModelService struct {
	modelRepo *repository.ModelRepository
}

func NewModelService(modelRepo *repository.ModelRepository) *ModelService {
	return &ModelService{modelRepo: modelRepo}
}

func (s *ModelService) CreateModel(ctx context.Context, req *dto.CreateModelRequest) (*domain.Model, error) {
	if existing, err := s.modelRepo.FindByName(ctx, req.ModelName); err == nil {
		return nil, fmt.Errorf("%w (id=%d)", ErrModelExists, existing.ID)
	}

	model := &domain.Model{
		ModelName:       req.ModelName,
		Type:            domain.ModelType(req.Type),
		ContextWindow:   req.ContextWindow,
		MaxOutputTokens: req.MaxOutputTokens,
		Status:          1,
		MatchRule:       domain.ModelMatchRule(req.MatchRule),
	}
	if req.DisplayName != "" {
		model.DisplayName = &req.DisplayName
	}
	if req.UpstreamName != "" {
		model.UpstreamName = &req.UpstreamName
	}
	for _, c := range req.Capabilities {
		if !domain.IsValidModelCapability(c) {
			return nil, ErrInvalidCapability
		}
		model.Capabilities = append(model.Capabilities, domain.ModelCapability(c))
	}
	for _, e := range req.Endpoints {
		if !domain.IsValidEndpointType(e) {
			return nil, ErrInvalidEndpoint
		}
		model.Endpoints = append(model.Endpoints, domain.EndpointType(e))
	}

	if err := s.modelRepo.Create(ctx, model); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *ModelService) GetModel(ctx context.Context, id uint64) (*domain.Model, error) {
	return s.modelRepo.FindByID(ctx, id)
}

func (s *ModelService) ListModels(ctx context.Context, page, pageSize int, keyword, typeFilter string) ([]domain.Model, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = 500
	}
	return s.modelRepo.List(ctx, page, pageSize, keyword, typeFilter)
}

func (s *ModelService) ListModelsByChannel(ctx context.Context, page, pageSize int, keyword string, channelID uint64) ([]domain.Model, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = 500
	}
	return s.modelRepo.ListByChannel(ctx, page, pageSize, keyword, channelID)
}

func (s *ModelService) UpdateModel(ctx context.Context, id uint64, req *dto.UpdateModelRequest) (*domain.Model, error) {
	model, err := s.modelRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrModelNotFound
	}

	if req.DisplayName != nil {
		model.DisplayName = req.DisplayName
	}
	if req.UpstreamName != nil {
		model.UpstreamName = req.UpstreamName
	}
	if req.Type != nil {
		model.Type = domain.ModelType(*req.Type)
	}
	if req.Capabilities != nil {
		model.Capabilities = nil
		for _, c := range req.Capabilities {
			if !domain.IsValidModelCapability(c) {
				return nil, ErrInvalidCapability
			}
			model.Capabilities = append(model.Capabilities, domain.ModelCapability(c))
		}
	}
	if req.Endpoints != nil {
		model.Endpoints = nil
		for _, e := range req.Endpoints {
			if !domain.IsValidEndpointType(e) {
				return nil, ErrInvalidEndpoint
			}
			model.Endpoints = append(model.Endpoints, domain.EndpointType(e))
		}
	}
	if req.ContextWindow != nil {
		model.ContextWindow = *req.ContextWindow
	}
	if req.MaxOutputTokens != nil {
		model.MaxOutputTokens = *req.MaxOutputTokens
	}
	if req.MatchRule != nil {
		model.MatchRule = domain.ModelMatchRule(*req.MatchRule)
	}
	if req.Status != nil {
		model.Status = *req.Status
	}

	if err := s.modelRepo.Update(ctx, model); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *ModelService) DeleteModel(ctx context.Context, id uint64) error {
	return s.modelRepo.Delete(ctx, id)
}

// PatchModelType updates a model's type and capabilities without requiring a full request body.
// Used by auto-inference after associating models with channels.
// Only sets capabilities when the model has none — preserves user-selected capabilities.
func (s *ModelService) PatchModelType(ctx context.Context, id uint64, mt domain.ModelType, caps []domain.ModelCapability) error {
	model, err := s.modelRepo.FindByID(ctx, id)
	if err != nil {
		return ErrModelNotFound
	}
	model.Type = mt
	if len(model.Capabilities) == 0 {
		model.Capabilities = domain.ModelCapabilities(caps)
	}
	return s.modelRepo.Update(ctx, model)
}
