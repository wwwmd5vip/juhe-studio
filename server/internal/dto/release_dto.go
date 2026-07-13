package dto

import "time"

type CreateReleaseInput struct {
	Version       string `json:"version" binding:"required"`
	Platform      string `json:"platform" binding:"required"`
	DownloadURL   string `json:"download_url" binding:"required,url"`
	FileSize      int64  `json:"file_size"`
	SHA256        string `json:"sha256"`
	ReleaseNotes  string `json:"release_notes" binding:"max=50000"`
	MinAppVersion string `json:"min_app_version"`
}

type UpdateReleaseInput struct {
	Version       *string `json:"version"`
	Platform      *string `json:"platform"`
	DownloadURL   *string `json:"download_url"`
	FileSize      *int64  `json:"file_size"`
	SHA256        *string `json:"sha256"`
	ReleaseNotes  *string `json:"release_notes"`
	MinAppVersion *string `json:"min_app_version"`
}

type ReleaseInfo struct {
	ID            uint64     `json:"id"`
	Version       string     `json:"version"`
	Platform      string     `json:"platform"`
	DownloadURL   string     `json:"download_url"`
	FileSize      int64      `json:"file_size"`
	SHA256        string     `json:"sha256"`
	ReleaseNotes  string     `json:"release_notes"`
	MinAppVersion string     `json:"min_app_version"`
	Status        int        `json:"status"`
	PublishedAt   *time.Time `json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type LatestReleaseResponse struct {
	Version       string `json:"version"`
	Platform      string `json:"platform"`
	DownloadURL   string `json:"download_url"`
	FileSize      int64  `json:"file_size"`
	SHA256        string `json:"sha256"`
	ReleaseNotes  string `json:"release_notes"`
	MinAppVersion string `json:"min_app_version"`
}
