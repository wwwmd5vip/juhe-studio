package service

import (
	"context"
	"errors"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/microcosm-cc/bluemonday"
)

type FeedbackService struct {
	repo      *repository.FeedbackRepository
	sanitizer *bluemonday.Policy
}

func NewFeedbackService(repo *repository.FeedbackRepository) *FeedbackService {
	return &FeedbackService{
		repo:      repo,
		sanitizer: bluemonday.StrictPolicy(),
	}
}

func (s *FeedbackService) Submit(ctx context.Context, input *dto.SubmitFeedbackInput, ip, userAgent string) error {
	if len(input.Title) > 200 {
		return errors.New("title exceeds maximum length of 200")
	}
	if len(input.Content) > 5000 {
		return errors.New("content exceeds maximum length of 5000")
	}
	if len(input.Contact) > 200 {
		return errors.New("contact exceeds maximum length of 200")
	}

	title := s.sanitizer.Sanitize(input.Title)
	content := bluemonday.UGCPolicy().Sanitize(input.Content)
	contact := s.sanitizer.Sanitize(input.Contact)

	feedback := &domain.Feedback{
		Type:       input.Type,
		Title:      title,
		Content:    content,
		Contact:    contact,
		AppVersion: input.AppVersion,
		OS:         input.OS,
		IP:         ip,
		UserAgent:  userAgent,
	}

	return s.repo.Create(ctx, feedback)
}

func (s *FeedbackService) List(ctx context.Context, filter repository.FeedbackFilter, page, pageSize int) ([]domain.Feedback, int64, error) {
	return s.repo.List(ctx, filter, page, pageSize)
}

func (s *FeedbackService) Delete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}
