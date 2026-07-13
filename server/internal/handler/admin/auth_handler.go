package admin

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/common/captcha"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type AuthHandler struct {
	authService  *service.AuthService
	userService  *service.UserService
	captchaStore *captcha.Store
}

func NewAuthHandler(authService *service.AuthService, userService *service.UserService, captchaStore *captcha.Store) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		userService:  userService,
		captchaStore: captchaStore,
	}
}

// Login 用户登录
// @Summary      用户登录
// @Description  使用用户名和密码登录，返回 JWT Token
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.LoginRequest  true  "登录信息"
// @Success      200   {object}  dto.Response{data=dto.LoginResponse}
// @Failure      400   {object}  dto.Response
// @Failure      401   {object}  dto.Response
// @Router       /api/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	// Verify captcha (mandatory)
	if !h.captchaStore.Verify(req.CaptchaID, req.CaptchaCode) {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "验证码错误或已过期"})
		return
	}

	token, expiresAt, user, err := h.authService.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) || errors.Is(err, service.ErrUserDisabled) {
			c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: err.Error()})
		} else {
			slog.Error("Login failed", "error", err)
			c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "登录失败，请稍后重试"})
		}
		return
	}

	// Login succeeded — consume captcha so it can't be reused
		h.captchaStore.Consume(req.CaptchaID)

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.LoginResponse{
			Token:     token,
			ExpiresAt: expiresAt,
			User:      service.ToUserInfo(user),
		},
	})
}

// Captcha 生成登录验证码
// @Summary      生成验证码
// @Description  返回图形验证码的 base64 图片和唯一 ID
// @Tags         Auth
// @Produce      json
// @Success      200  {object}  dto.Response{data=dto.CaptchaResponse}
// @Router       /api/auth/captcha [get]
func (h *AuthHandler) Captcha(c *gin.Context) {
	id, _, img := h.captchaStore.Generate()
	if id == "" {
		c.JSON(http.StatusServiceUnavailable, dto.Response{Code: 503, Message: "验证码服务繁忙，请稍后重试"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.CaptchaResponse{
			CaptchaID: id,
			Image:     img,
		},
	})
}

// UpdatePassword 修改密码
// @Summary      修改当前用户密码
// @Description  需要先登录，提供旧密码和新密码
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.UpdatePasswordRequest  true  "密码信息"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      401   {object}  dto.Response
// @Security     Bearer
// @Router       /api/auth/password [put]
func (h *AuthHandler) UpdatePassword(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "unauthorized"})
		return
	}

	var req dto.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if err := h.userService.UpdatePassword(c.Request.Context(), userID, req.OldPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "password updated"})
}

// Register 用户注册
// @Summary      用户注册
// @Description  用户自助注册账号，需要邮箱验证
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.RegisterRequest  true  "注册信息"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Router       /api/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	// Verify captcha (mandatory)
	if !h.captchaStore.Verify(req.CaptchaID, req.CaptchaCode) {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "验证码错误或已过期"})
		return
	}

	if err := h.authService.Register(c.Request.Context(), req.Username, req.Email, req.Password); err != nil {
		// Special message for SMTP not configured
		if err == service.ErrSMTPNotConfigured {
			c.JSON(http.StatusServiceUnavailable, dto.Response{Code: 503, Message: "注册功能暂未开放，请联系管理员"})
			return
		}
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	// Consume captcha after successful registration to prevent replay
		h.captchaStore.Consume(req.CaptchaID)

	c.JSON(http.StatusOK, dto.Response{
		Code:    0,
		Message: "注册成功，验证邮件已发送到 " + req.Email + "，请查收",
	})
}

// VerifyEmail 邮箱验证
// @Summary      邮箱验证
// @Description  通过验证码验证邮箱
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        code  query     string  true  "验证码"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Router       /api/auth/verify-email [get]
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	code := c.Query("code")
	captchaID := c.Query("captcha_id")
	captchaCode := c.Query("captcha_code")

	if code == "" {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "验证码不能为空"})
		return
	}

	// Verify captcha to prevent brute-force attacks on the 6-digit code
	if !h.captchaStore.Verify(captchaID, captchaCode) {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "验证码错误或已过期"})
		return
	}

	if err := h.authService.VerifyEmail(c.Request.Context(), code); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	// Consume captcha after successful verification to prevent replay
	h.captchaStore.Consume(captchaID)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "邮箱验证成功"})
}

// VerifyPassword 验证当前用户密码
// @Summary      验证当前用户密码
// @Description  用于危险操作前的二次确认
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.VerifyPasswordRequest  true  "密码"
// @Success      200   {object}  dto.Response{data=map[string]bool}
// @Failure      400   {object}  dto.Response
// @Failure      401   {object}  dto.Response
// @Security     Bearer
// @Router       /api/auth/verify-password [post]
func (h *AuthHandler) VerifyPassword(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "unauthorized"})
		return
	}

	var req dto.VerifyPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if err := h.authService.VerifyPassword(c.Request.Context(), userID, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "密码错误"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]bool{"valid": true}})
}

// ResendVerification 重新发送验证邮件
// @Summary      重新发送验证邮件
// @Description  对于未验证的注册邮箱重新发送验证码
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.ResendVerificationRequest  true  "邮箱"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Router       /api/auth/resend-verification [post]
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req dto.ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if err := h.authService.ResendVerification(c.Request.Context(), req.Email); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code:    0,
		Message: "验证邮件已重新发送到 " + req.Email + "，请查收",
	})
}
