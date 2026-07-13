package dto

import "time"

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type Pagination struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type PagedResponse struct {
	Data       interface{} `json:"data"`
	Pagination Pagination  `json:"pagination"`
}

// Auth

type LoginRequest struct {
	Username    string `json:"username" binding:"required"`
	Password    string `json:"password" binding:"required"`
	CaptchaID   string `json:"captcha_id" binding:"required"`
	CaptchaCode string `json:"captcha_code" binding:"required"`
}

type CaptchaResponse struct {
	CaptchaID string `json:"captcha_id"`
	Image     string `json:"image"` // base64 data URI
}

type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      UserInfo  `json:"user"`
}

// Register

type RegisterRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=32"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	CaptchaID   string `json:"captcha_id" binding:"required"`
	CaptchaCode string `json:"captcha_code" binding:"required"`
}

type RegisterResponse struct {
	Message string `json:"message"`
}

type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyEmailRequest struct {
	Code string `form:"code" binding:"required"`
}

// User

type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Email    string `json:"email" binding:"omitempty,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     int    `json:"role" binding:"required,oneof=1 10 100"`
	Group    string `json:"group" binding:"omitempty,max=64"`
}

type UpdateUserRequest struct {
	Email  *string `json:"email" binding:"omitempty,email"`
	Role   *int    `json:"role" binding:"omitempty,oneof=1 10 100"`
	Status *int    `json:"status" binding:"omitempty,oneof=0 1"`
	Group  *string `json:"group" binding:"omitempty,max=64"`
	Quota  *int64  `json:"quota"`
}

type AdjustQuotaRequest struct {
	Amount      int64  `json:"amount" binding:"required,ne=0"`
	Description string `json:"description" binding:"max=255"`
}

type BatchDeleteUsersRequest struct {
	IDs []uint64 `json:"ids" binding:"required,min=1"`
}

type BatchUpdateUserStatusRequest struct {
	IDs    []uint64 `json:"ids" binding:"required,min=1"`
	Status int      `json:"status" binding:"required,oneof=0 1"`
}

type BatchDeleteTokensRequest struct {
	IDs []uint64 `json:"ids" binding:"required,min=1"`
}

type UserInfo struct {
	ID                   uint64    `json:"id"`
	Username             string    `json:"username"`
	Email                *string   `json:"email,omitempty"`
	Role                 int       `json:"role"`
	Status               int       `json:"status"`
	Group                string    `json:"group"`
	Quota                int64     `json:"quota"`
	UsedQuota            int64     `json:"used_quota"`
	PlaygroundTrialsUsed int       `json:"playground_trials_used"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// Token

type CreateTokenRequest struct {
	Name            string   `json:"name" binding:"required,max=128"`
	RemainQuota     int64    `json:"remain_quota"`
	UnlimitedQuota  bool     `json:"unlimited_quota"`
	Group           string   `json:"group" binding:"omitempty,max=64"`
	ModelLimits     []string `json:"model_limits"`
	AllowedIPs      string   `json:"allowed_ips"`
	RateLimit       int      `json:"rate_limit"`
	CrossGroupRetry bool     `json:"cross_group_retry"`
}

type UpdateTokenRequest struct {
	Name            string   `json:"name" binding:"omitempty,max=128"`
	Status          *int     `json:"status" binding:"omitempty,oneof=0 1"`
	RemainQuota     *int64   `json:"remain_quota"`
	UnlimitedQuota  *bool    `json:"unlimited_quota"`
	Group           string   `json:"group" binding:"omitempty,max=64"`
	ModelLimits     []string `json:"model_limits"`
	AllowedIPs      *string  `json:"allowed_ips"`
	RateLimit       *int     `json:"rate_limit"`
	CrossGroupRetry *bool    `json:"cross_group_retry"`
}

type TokenInfo struct {
	ID              uint64     `json:"id"`
	UserID          uint64     `json:"user_id"`
	Name            string     `json:"name"`
	Key             string     `json:"key,omitempty"`
	KeyMask         string     `json:"key_mask"`
	Status          int        `json:"status"`
	RemainQuota     int64      `json:"remain_quota"`
	UnlimitedQuota  bool       `json:"unlimited_quota"`
	Group           string     `json:"group"`
	ModelLimits     []string   `json:"model_limits,omitempty"`
	AllowedIPs      *string    `json:"allowed_ips,omitempty"`
	RateLimit       int        `json:"rate_limit"`
	CrossGroupRetry bool       `json:"cross_group_retry"`
	LastUsedAt      *time.Time `json:"last_used_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// RevealTokenKeyRequest 管理员查看完整 API Key
type RevealTokenKeyRequest struct {
	Password string `json:"password" binding:"required"`
}
