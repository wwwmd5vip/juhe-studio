// Package errcode 定义统一的业务错误码体系
// 错误码分段：
//
//	1xxx — 参数/请求错误
//	2xxx — 业务逻辑错误
//	3xxx — 认证/权限错误
//	5xxx — 系统/上游错误
package errcode

// ============================================================================
// 1xxx — 参数/请求错误
// ============================================================================
const (
	ErrParamMissing   = 1001 // 缺少必要参数
	ErrParamInvalid   = 1002 // 参数格式无效
	ErrParamFormat    = 1003 // 参数格式错误
	ErrRequestBody    = 1004 // 请求体解析失败
	ErrInvalidID      = 1005 // 无效的 ID
	ErrInvalidPage    = 1006 // 无效的分页参数
	ErrJSONParse      = 1007 // JSON 解析失败
	ErrValidation     = 1008 // 数据校验失败
)

// ============================================================================
// 2xxx — 业务逻辑错误
// ============================================================================
const (
	ErrUserNotFound              = 2001 // 用户不存在
	ErrUserExists                = 2002 // 用户已存在
	ErrUserDisabled              = 2003 // 用户已禁用
	ErrInvalidCredentials        = 2004 // 用户名或密码错误
	ErrInvalidPassword           = 2005 // 密码不符合要求
	ErrCannotDeleteSelf          = 2006 // 不能删除自己
	ErrTokenNotFound             = 2010 // Token 不存在
	ErrTokenUnauthorized         = 2011 // Token 未授权
	ErrTokenExpired              = 2012 // Token 已过期
	ErrTokenQuotaExhausted       = 2013 // Token 额度已耗尽
	ErrChannelNotFound           = 2020 // 渠道不存在
	ErrChannelOffline            = 2021 // 渠道离线
	ErrChannelLimit              = 2022 // 渠道已达上限
	ErrUnsupportedChannelType    = 2023 // 不支持的渠道类型
	ErrModelNotFound             = 2030 // 模型不存在
	ErrModelExists               = 2031 // 模型已存在
	ErrModelNotSupported         = 2032 // 模型不支持
	ErrModelNotAllowed           = 2033 // 模型不在允许列表
	ErrPromptNotFound            = 2040 // 提示词不存在
	ErrPromptNotPublished        = 2041 // 提示词未发布
	ErrPricingNotFound           = 2045 // 定价不存在
	ErrVendorNotFound            = 2046 // 厂商不存在
	ErrInsufficientQuota         = 2050 // 额度不足
	ErrInvalidAmount             = 2051 // 无效的金额
	ErrTopUpNotFound             = 2060 // 充值订单不存在
	ErrTopUpAlreadyDone          = 2061 // 充值订单已完成
	ErrTopUpNotRefundable        = 2062 // 充值订单不可退款
	ErrRedemptionNotFound        = 2070 // 兑换码不存在
	ErrRedemptionUsed            = 2071 // 兑换码已使用
	ErrRedemptionExpired         = 2072 // 兑换码已过期
	ErrQuotaPackageNotFound      = 2075 // 额度包不存在
	ErrSubscriptionPlanNotFound  = 2080 // 订阅套餐不存在
	ErrSubscriptionNotFound      = 2081 // 订阅不存在
	ErrSubscriptionNotActive     = 2082 // 订阅未生效
	ErrSettingNotFound           = 2090 // 设置项不存在
	ErrNoAvailableChannel        = 2095 // 无可用渠道
	ErrStreamNotSupport          = 2096 // 不支持流式
	ErrNoImagePricing            = 2097 // 无图像定价
)

// ============================================================================
// 3xxx — 认证/权限错误
// ============================================================================
const (
	ErrUnauthorized    = 3001 // 未登录
	ErrForbidden       = 3002 // 无权限
	ErrTokenExpired2   = 3003 // Token 已过期
	ErrInvalidAPIKey   = 3004 // 无效的 API Key
	ErrIPNotAllowed    = 3005 // IP 不在白名单
)

// ============================================================================
// 5xxx — 系统/上游错误
// ============================================================================
const (
	ErrInternal         = 5001 // 内部错误
	ErrUpstreamError    = 5002 // 上游服务错误
	ErrDatabaseError    = 5003 // 数据库错误
	ErrUpstreamTimeout  = 5004 // 上游超时
	ErrRateLimit        = 5005 // 频率限制
	ErrServiceUnavailable = 5006 // 服务不可用
)

// Message 返回错误码对应的默认消息
func Message(code int) string {
	switch code {
	// 1xxx
	case ErrParamMissing:
		return "缺少必要参数"
	case ErrParamInvalid:
		return "参数格式无效"
	case ErrRequestBody:
		return "请求体解析失败"
	case ErrInvalidID:
		return "无效的 ID"
	// 2xxx
	case ErrUserNotFound:
		return "用户不存在"
	case ErrUserExists:
		return "用户已存在"
	case ErrUserDisabled:
		return "用户已禁用"
	case ErrInvalidCredentials:
		return "用户名或密码错误"
	case ErrCannotDeleteSelf:
		return "不能删除自己"
	case ErrTokenNotFound:
		return "Token 不存在"
	case ErrChannelNotFound:
		return "渠道不存在"
	case ErrChannelOffline:
		return "渠道离线"
	case ErrUnsupportedChannelType:
		return "不支持的渠道类型"
	case ErrModelNotFound:
		return "模型不存在"
	case ErrModelExists:
		return "模型已存在"
	case ErrModelNotSupported:
		return "模型不支持"
	case ErrInsufficientQuota:
		return "额度不足"
	case ErrTopUpNotFound:
		return "充值订单不存在"
	case ErrRedemptionNotFound:
		return "兑换码不存在"
	case ErrRedemptionUsed:
		return "兑换码已使用"
	case ErrSubscriptionPlanNotFound:
		return "订阅套餐不存在"
	case ErrSettingNotFound:
		return "设置项不存在"
	case ErrNoAvailableChannel:
		return "无可用渠道"
	// 3xxx
	case ErrUnauthorized:
		return "未登录"
	case ErrForbidden:
		return "无权限"
	case ErrInvalidAPIKey:
		return "无效的 API Key"
	case ErrIPNotAllowed:
		return "IP 不在白名单"
	// 5xxx
	case ErrInternal:
		return "内部错误"
	case ErrUpstreamError:
		return "上游服务错误"
	case ErrDatabaseError:
		return "数据库错误"
	case ErrRateLimit:
		return "请求过于频繁"
	default:
		return "未知错误"
	}
}
