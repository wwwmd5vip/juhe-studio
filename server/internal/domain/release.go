package domain

import "time"

type Release struct {
	ID            uint64     `gorm:"primaryKey" json:"id"`
	Version       string     `gorm:"size:32;uniqueIndex;not null" json:"version"`
	Platform      string     `gorm:"size:20;not null;index" json:"platform"`
	DownloadURL   string     `gorm:"size:1024;not null" json:"download_url"`
	FileSize      int64      `gorm:"not null;default:0" json:"file_size"`
	SHA256        string     `gorm:"size:64" json:"sha256"`
	ReleaseNotes  string     `gorm:"type:text" json:"release_notes"`
	MinAppVersion string     `gorm:"size:32" json:"min_app_version"`
	Status        int        `gorm:"not null;default:0" json:"status"` // 0=draft, 1=published, 2=archived
	PublishedAt   *time.Time `json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (Release) TableName() string { return "releases" }
