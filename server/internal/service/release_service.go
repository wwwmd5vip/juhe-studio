package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
)

var (
	ErrReleaseNotFound    = errors.New("release not found")
	ErrInvalidVersion     = errors.New("invalid version format, expected semver-like (e.g. 1.0.0)")
	ErrInvalidPlatform    = errors.New("invalid platform, must be one of: darwin, win32, linux")
	ErrNoLatestRelease    = errors.New("no published release found for the specified platform")
	ErrReleaseNotDraft    = errors.New("only draft releases can be published")
)

var (
	semverPattern = regexp.MustCompile(`^\d+\.\d+\.\d+$`)
	validPlatforms = map[string]bool{
		"darwin": true,
		"win32":  true,
		"linux":  true,
	}
)

type ReleaseService struct {
	repo *repository.ReleaseRepository
}

func NewReleaseService(repo *repository.ReleaseRepository) *ReleaseService {
	return &ReleaseService{repo: repo}
}

func (s *ReleaseService) CreateRelease(ctx context.Context, input *dto.CreateReleaseInput) (*domain.Release, error) {
	if !semverPattern.MatchString(input.Version) {
		return nil, ErrInvalidVersion
	}
	input.Platform = strings.ToLower(input.Platform)
	if !validPlatforms[input.Platform] {
		return nil, ErrInvalidPlatform
	}

	release := &domain.Release{
		Version:       input.Version,
		Platform:      input.Platform,
		DownloadURL:   input.DownloadURL,
		FileSize:      input.FileSize,
		SHA256:        input.SHA256,
		ReleaseNotes:  input.ReleaseNotes,
		MinAppVersion: input.MinAppVersion,
		Status:        0, // draft
	}

	if err := s.repo.Create(ctx, release); err != nil {
		return nil, err
	}
	return release, nil
}

func (s *ReleaseService) GetRelease(ctx context.Context, id uint64) (*domain.Release, error) {
	release, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrReleaseNotFound
		}
		return nil, err
	}
	return release, nil
}

func (s *ReleaseService) ListReleases(ctx context.Context, page, pageSize int, keyword string) ([]dto.ReleaseInfo, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	releases, total, err := s.repo.List(ctx, page, pageSize, keyword)
	if err != nil {
		return nil, 0, err
	}

	return ReleaseInfoList(releases), total, nil
}

func (s *ReleaseService) UpdateRelease(ctx context.Context, id uint64, input *dto.UpdateReleaseInput) error {
	release, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return ErrReleaseNotFound
		}
		return err
	}

	if input.Version != nil {
		if !semverPattern.MatchString(*input.Version) {
			return ErrInvalidVersion
		}
		release.Version = *input.Version
	}
	if input.Platform != nil {
		platform := strings.ToLower(*input.Platform)
		if !validPlatforms[platform] {
			return ErrInvalidPlatform
		}
		release.Platform = platform
	}
	if input.DownloadURL != nil {
		release.DownloadURL = *input.DownloadURL
	}
	if input.FileSize != nil {
		release.FileSize = *input.FileSize
	}
	if input.SHA256 != nil {
		release.SHA256 = *input.SHA256
	}
	if input.ReleaseNotes != nil {
		release.ReleaseNotes = *input.ReleaseNotes
	}
	if input.MinAppVersion != nil {
		release.MinAppVersion = *input.MinAppVersion
	}

	return s.repo.Update(ctx, release)
}

func (s *ReleaseService) DeleteRelease(ctx context.Context, id uint64) error {
	return s.repo.Delete(ctx, id)
}

func (s *ReleaseService) PublishRelease(ctx context.Context, id uint64) error {
	release, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return ErrReleaseNotFound
		}
		return err
	}

	if release.Status != 0 {
		return ErrReleaseNotDraft
	}

	now := time.Now().UTC()
	release.Status = 1
	release.PublishedAt = &now

	return s.repo.Update(ctx, release)
}

func (s *ReleaseService) ArchiveRelease(ctx context.Context, id uint64) error {
	release, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return ErrReleaseNotFound
		}
		return err
	}

	release.Status = 2
	return s.repo.Update(ctx, release)
}

func (s *ReleaseService) GetLatest(ctx context.Context, platform string) (*dto.LatestReleaseResponse, error) {
	release, err := s.repo.GetLatest(ctx, platform)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrNoLatestRelease
		}
		return nil, err
	}

	return ToLatestReleaseResponse(release), nil
}

func ToReleaseInfo(r *domain.Release) dto.ReleaseInfo {
	return dto.ReleaseInfo{
		ID:            r.ID,
		Version:       r.Version,
		Platform:      r.Platform,
		DownloadURL:   r.DownloadURL,
		FileSize:      r.FileSize,
		SHA256:        r.SHA256,
		ReleaseNotes:  r.ReleaseNotes,
		MinAppVersion: r.MinAppVersion,
		Status:        r.Status,
		PublishedAt:   r.PublishedAt,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

func ReleaseInfoList(releases []domain.Release) []dto.ReleaseInfo {
	result := make([]dto.ReleaseInfo, len(releases))
	for i := range releases {
		result[i] = ToReleaseInfo(&releases[i])
	}
	return result
}

func ToLatestReleaseResponse(r *domain.Release) *dto.LatestReleaseResponse {
	return &dto.LatestReleaseResponse{
		Version:       r.Version,
		Platform:      r.Platform,
		DownloadURL:   r.DownloadURL,
		FileSize:      r.FileSize,
		SHA256:        r.SHA256,
		ReleaseNotes:  r.ReleaseNotes,
		MinAppVersion: r.MinAppVersion,
	}
}
