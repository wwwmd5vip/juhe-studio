package domain

import (
	"time"

	"github.com/juhe-management/server/internal/common/utils"
)

const (
	PromptTypeImage   = "image"
	PromptTypeAgent   = "agent"
	PromptTypePackage = "package"
)

type PromptStatus int

const (
	PromptStatusDraft     PromptStatus = 0
	PromptStatusPublished PromptStatus = 1
	PromptStatusArchived  PromptStatus = 2
)

type PromptCategory struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:128;not null;uniqueIndex:idx_prompt_categories_name" json:"name"`
	Type        string    `gorm:"size:32;not null;default:'image';index:idx_prompt_categories_type" json:"type"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	SortOrder   int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (PromptCategory) TableName() string { return "prompt_categories" }

type Prompt struct {
	ID         uint64       `gorm:"primaryKey" json:"id"`
	Type       string       `gorm:"size:32;not null;default:'image';index:idx_prompts_type_status_cat,idx_prompts_type_status_title" json:"type"`
	Status     PromptStatus `gorm:"not null;default:1;index:idx_prompts_type_status_cat,idx_prompts_type_status_title" json:"status"`
	CategoryID uint64       `gorm:"not null;index:idx_prompts_type_status_cat" json:"category_id"`
	Title      string       `gorm:"size:255;not null;index:idx_prompts_type_status_title" json:"title"`
	Content    string       `gorm:"type:longtext;not null" json:"content"`
	Variables  *string      `gorm:"type:json" json:"variables,omitempty"`
	Tags       *string      `gorm:"type:json" json:"tags,omitempty"`
	AuthorID   uint64       `gorm:"not null" json:"author_id"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

func (Prompt) TableName() string { return "prompts" }

func (p *Prompt) GetVariables() map[string]string {
	var m map[string]string
	utils.ParseJSONString(p.Variables, &m)
	return m
}

func (p *Prompt) SetVariables(m map[string]string) {
	p.Variables = utils.StringifyJSON(m)
}

func (p *Prompt) GetTags() []string {
	var t []string
	utils.ParseJSONString(p.Tags, &t)
	return t
}

func (p *Prompt) SetTags(t []string) {
	p.Tags = utils.StringifyJSON(t)
}
