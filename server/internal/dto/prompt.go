package dto

import "time"

type CreatePromptRequest struct {
	CategoryID uint64            `json:"category_id" binding:"required,gt=0"`
	Title      string            `json:"title" binding:"required,min=1,max=255"`
	Content    string            `json:"content" binding:"required,min=1,max=65535"`
	Variables  map[string]string `json:"variables"`
	Tags       []string          `json:"tags"`
	Status     int               `json:"status" binding:"required,oneof=0 1 2"`
}

type UpdatePromptRequest struct {
	CategoryID *uint64           `json:"category_id" binding:"omitempty,gt=0"`
	Title      *string           `json:"title" binding:"omitempty,min=1,max=255"`
	Content    *string           `json:"content" binding:"omitempty,min=1,max=65535"`
	Variables  map[string]string `json:"variables"`
	Tags       []string          `json:"tags"`
	Status     *int              `json:"status" binding:"omitempty,oneof=0 1 2"`
}

type CreateCategoryRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=128"`
	Description string `json:"description" binding:"max=500"`
	SortOrder   int    `json:"sort_order"`
}

type UpdateCategoryRequest struct {
	Name        *string `json:"name" binding:"omitempty,min=1,max=128"`
	Description *string `json:"description" binding:"omitempty,max=500"`
	SortOrder   *int    `json:"sort_order"`
}

type RenderPromptRequest struct {
	Variables map[string]string `json:"variables"`
}

type RenderPromptResponse struct {
	Content string `json:"content"`
}

type PromptInfo struct {
	ID         uint64            `json:"id"`
	Type       string            `json:"type"`
	CategoryID uint64            `json:"category_id"`
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	Variables  map[string]string `json:"variables"`
	Tags       []string          `json:"tags"`
	Status     int               `json:"status"`
	AuthorID   uint64            `json:"author_id"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

type PromptListItem struct {
	ID         uint64            `json:"id"`
	Type       string            `json:"type"`
	CategoryID uint64            `json:"category_id"`
	Title      string            `json:"title"`
	Variables  map[string]string `json:"variables"`
	Tags       []string          `json:"tags"`
	Status     int               `json:"status"`
	AuthorID   uint64            `json:"author_id"`
	CreatedAt  time.Time         `json:"created_at"`
	UpdatedAt  time.Time         `json:"updated_at"`
}

type CategoryInfo struct {
	ID          uint64      `json:"id"`
	Name        string      `json:"name"`
	Type        string      `json:"type"`
	Description *string     `json:"description,omitempty"`
	SortOrder   int         `json:"sort_order"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type PromptVersionInfo struct {
	ID        uint64            `json:"id"`
	PromptID  uint64            `json:"prompt_id"`
	Title     string            `json:"title"`
	Content   string            `json:"content"`
	Variables map[string]string `json:"variables"`
	Tags      []string          `json:"tags"`
	AuthorID  uint64            `json:"author_id"`
	CreatedAt time.Time         `json:"created_at"`
}

type PromptPackageItemInfo struct {
	ID        uint64 `json:"id"`
	PromptID  uint64 `json:"prompt_id"`
	SortOrder int    `json:"sort_order"`
}

type SetPackageItemsRequest struct {
	Items []struct {
		PromptID  uint64 `json:"prompt_id" binding:"required,gt=0"`
		SortOrder int    `json:"sort_order"`
	} `json:"items" binding:"required,dive"`
}

type RenderPackageResponse struct {
	Results []RenderPackageItemResult `json:"results"`
}

type RenderPackageItemResult struct {
	PromptID uint64 `json:"prompt_id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
}
