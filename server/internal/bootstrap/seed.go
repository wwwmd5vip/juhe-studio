package bootstrap

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"log"
	"os"
	"time"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

// SeedChannelFailures 在服务启动时重置所有渠道的连续失败计数，
// 并将因自动禁用（ChannelError）的渠道恢复为 Active。
// 这避免了重启前累积的失败次数导致渠道在重启后立即被禁用。
func SeedChannelFailures(db *gorm.DB) {
	repo := repository.NewChannelRepository(db)
	recovered, err := repo.ResetAllConsecutiveFailures(context.Background())
	if err != nil {
		log.Printf("WARNING: failed to reset channel failures: %v", err)
		return
	}
	if recovered > 0 {
		log.Printf("recovered %d auto-banned channel(s) on startup", recovered)
	}
}

// 默认需要支持的 image-only 模型清单。
// 桌面端 (pc/) 会以 "图生图" (img2img / 扩图 / 背景移除 / 变体 / 超分) 形式
// 把 source image inline 到 body.images 走 openai-compatible /v1/images/generations。
// 若 admin 没有为这些模型在 abilities + pricings 里铺路由 + image pricing，
// 桌面会撞 ERR_PROVIDER_NO_CHANNEL / ERR_PROVIDER_NO_PRICING。
//
// SeedImageCapabilities 在启动时为这些模型做"幂等补齐"：
//   1) 找当前所有 status=1 且 channels.models 含该模型名的渠道；
//   2) 把它们都加进 abilities（group='default'）；
//   3) 给 (model_name, group='default') 加一条 fixed billing_mode + 100 cents 起步定价。
//
// 注意：本函数只连接已存在的渠道，不会凭空创建；如果 admin 完全没 image 渠道，
// 仍需在 admin UI 手动新增一条 channel。
func SeedImageCapabilities(db *gorm.DB) {
	const defaultModels = `,juhe-gpt-image-2,juhe-nano,juhe-nano-pro,juhe-nano2,`
	const defaultGroup = "default"
	const defaultFixedPriceCents int64 = 100
	now := time.Now()

	for _, model := range []string{"juhe-gpt-image-2", "juhe-nano", "juhe-nano-pro", "juhe-nano2"} {
		_ = defaultModels
		// 找 channels.models 含 model 的 status=1 渠道
		var channels []domain.Channel
		if err := db.Model(&domain.Channel{}).
			Where("status = ? AND FIND_IN_SET(?, REPLACE(models, ' ', '')) > 0",
				domain.ChannelActive, model).
			Find(&channels).Error; err != nil {
			log.Printf("WARNING: SeedImageCapabilities query channels for %s failed: %v", model, err)
			continue
		}
		if len(channels) == 0 {
			continue
		}

		// 给每个有效渠道建 ability（已存在则刷新 enabled/priority/weight）
		for _, c := range channels {
			var existingID uint64
			err := db.Table("abilities").
				Select("id").
				Where("`group` = ? AND model_name = ? AND channel_id = ?",
					defaultGroup, model, c.ID).
				Limit(1).
				Scan(&existingID).Error
			if err == nil && existingID != 0 {
				if err := db.Table("abilities").
					Where("id = ?", existingID).
					Updates(map[string]any{
						"enabled":    true,
						"priority":   10,
						"weight":     10,
						"updated_at": now,
					}).Error; err != nil {
					log.Printf("WARNING: refresh ability (%s, %s, ch=%d): %v", defaultGroup, model, c.ID, err)
				}
				continue
			}
			if err := db.Table("abilities").Create(map[string]any{
				"`group`":    defaultGroup,
				"model_name": model,
				"channel_id": c.ID,
				"priority":   10,
				"weight":     10,
				"enabled":    true,
				"created_at": now,
				"updated_at": now,
			}).Error; err != nil {
				log.Printf("WARNING: create ability for %s ch=%d: %v", model, c.ID, err)
			}
		}

		// pricing：image 必须 fixed + cents>0，否则 CalculateImageCost 抛 ErrNoImagePricing
		var existingPricingID uint64
		err := db.Table("pricings").
			Select("id").
			Where("model_name = ? AND `group` = ?", model, defaultGroup).
			Limit(1).
			Scan(&existingPricingID).Error
		if err == nil && existingPricingID != 0 {
			if err := db.Table("pricings").
				Where("id = ?", existingPricingID).
				Updates(map[string]any{
					"billing_mode":     "fixed",
					"fixed_price_cents": defaultFixedPriceCents,
					"image_ratio":      1.0,
					"updated_at":       now,
				}).Error; err != nil {
				log.Printf("WARNING: refresh pricing (%s, %s): %v", model, defaultGroup, err)
			}
		} else {
			if err := db.Table("pricings").Create(map[string]any{
				"model_name":         model,
				"`group`":            defaultGroup,
				"billing_mode":       "fixed",
				"model_ratio":        1.0,
				"completion_ratio":   1.0,
				"cached_tokens_ratio": 1.0,
				"fixed_price_cents":  defaultFixedPriceCents,
				"image_ratio":        1.0,
				"effective_from":     now,
				"created_at":         now,
				"updated_at":         now,
			}).Error; err != nil {
				log.Printf("WARNING: create pricing for %s: %v", model, err)
			}
		}
	}
}

func SeedRootUser(db *gorm.DB, bcryptCost int) {
	var count int64
	if err := db.Model(&domain.User{}).Count(&count).Error; err != nil {
		log.Fatalf("failed to count users: %v", err)
	}
	if count > 0 {
		return
	}

	username := os.Getenv("ROOT_USERNAME")
	if username == "" {
		username = "root"
	}
	password := os.Getenv("ROOT_PASSWORD")
	if password == "" {
		randomBytes := make([]byte, 16)
		if _, err := rand.Read(randomBytes); err != nil {
			log.Fatalf("failed to generate random root password: %v", err)
		}
		password = base64.URLEncoding.EncodeToString(randomBytes)
		log.Printf("WARNING: ROOT_PASSWORD not set, generated random password (length=%d) — set ROOT_PASSWORD in .env for production!", len(password))
	}

	hash, err := utils.HashPassword(password, bcryptCost)
	if err != nil {
		log.Fatalf("failed to hash root password: %v", err)
	}

	user := &domain.User{
		Username:     username,
		PasswordHash: hash,
		Role:         domain.RoleRoot,
		Status:       domain.UserActive,
		Group:        "default",
		Quota:        0,
	}

	if err := repository.NewUserRepository(db).Create(context.Background(), user); err != nil {
		log.Fatalf("failed to seed root user: %v", err)
	}

	log.Printf("seeded root user: %s", username)
}

// SeedPromptTemplates 写入默认提示词模板
func SeedPromptTemplates(db *gorm.DB) {
	// Check if templates already exist
	var count int64
	if err := db.Model(&domain.PromptTemplate{}).Count(&count).Error; err != nil {
		log.Printf("WARNING: failed to count prompt templates: %v", err)
		return
	}
	if count > 0 {
		return
	}

	templates := []domain.PromptTemplate{
		// coding
		{Name: "代码助手", Category: "coding", Content: "你是一个专业的{{language}}开发助手。请帮我实现以下功能：\n\n功能描述：{{description}}\n\n要求：\n- 代码风格简洁清晰\n- 添加必要的注释\n- 考虑边界情况", Variables: "language,description", IsSystem: true},
		{Name: "代码审查", Category: "coding", Content: "请审查以下{{language}}代码，指出潜在的问题和改进建议：\n\n```{{language}}\n{{code}}\n```\n\n请从以下几个方面分析：\n1. 代码质量和可读性\n2. 性能问题\n3. 安全漏洞\n4. 最佳实践", Variables: "language,code", IsSystem: true},
		{Name: "Bug修复", Category: "coding", Content: "以下代码出现了 bug，请帮我分析原因并修复：\n\n错误信息：{{error_message}}\n\n代码：\n```{{language}}\n{{code}}\n```\n\n请给出修复后的完整代码。", Variables: "language,code,error_message", IsSystem: true},
		{Name: "API 设计", Category: "coding", Content: "请为{{project_name}}项目设计 RESTful API 接口。\n\n需求：{{requirements}}\n\n请输出：\n1. API 端点列表（方法、路径、描述）\n2. 请求/响应数据结构\n3. 错误处理方案", Variables: "project_name,requirements", IsSystem: true},
		{Name: "单元测试", Category: "coding", Content: "请为以下 {{language}} 函数编写单元测试：\n\n```{{language}}\n{{function_code}}\n```\n\n使用 {{test_framework}} 框架，覆盖正常路径和边界情况。", Variables: "language,function_code,test_framework", IsSystem: true},

		// writing
		{Name: "文章撰写", Category: "writing", Content: "请写一篇关于「{{topic}}」的文章。\n\n目标读者：{{audience}}\n字数要求：{{word_count}}字左右\n风格：{{style}}\n\n文章结构：\n1. 引人入胜的开头\n2. 核心内容分 3-4 个要点\n3. 总结与观点", Variables: "topic,audience,word_count,style", IsSystem: true},
		{Name: "邮件撰写", Category: "writing", Content: "请帮我写一封{{email_type}}邮件。\n\n收件人：{{recipient}}\n主题：{{subject}}\n要点：\n{{key_points}}\n\n语气：{{tone}}", Variables: "email_type,recipient,subject,key_points,tone", IsSystem: true},
		{Name: "文案润色", Category: "writing", Content: "请帮我润色以下文案，使其更加{{improvement_goal}}：\n\n原文：\n{{original_text}}\n\n请保持原意不变，优化表达方式和措辞。", Variables: "original_text,improvement_goal", IsSystem: true},
		{Name: "翻译助手", Category: "writing", Content: "请将以下内容从{{source_lang}}翻译成{{target_lang}}：\n\n{{text}}\n\n要求：\n- 保持原文风格和语气\n- 专业术语翻译准确\n- 如涉及文化特定表达，给出注释", Variables: "source_lang,target_lang,text", IsSystem: true},

		// analysis
		{Name: "数据分析", Category: "analysis", Content: "请分析以下数据，给出洞察和建议：\n\n数据类型：{{data_type}}\n数据内容：\n{{data}}\n\n分析维度：{{dimensions}}\n\n请输出：\n1. 关键发现\n2. 趋势分析\n3. 行动建议", Variables: "data_type,data,dimensions", IsSystem: true},
		{Name: "SWOT 分析", Category: "analysis", Content: "请对 {{target}} 进行 SWOT 分析：\n\n背景信息：\n{{background}}\n\n请输出详细 SWOT 矩阵：\n- 优势 (Strengths)\n- 劣势 (Weaknesses)\n- 机会 (Opportunities)\n- 威胁 (Threats)\n\n并给出战略建议。", Variables: "target,background", IsSystem: true},
		{Name: "竞品分析", Category: "analysis", Content: "请对以下竞品进行分析：\n\n我方产品：{{our_product}}\n竞品列表：\n{{competitors}}\n\n分析维度：\n- 核心功能对比\n- 定价策略\n- 用户体验\n- 市场定位\n- 优劣势总结", Variables: "our_product,competitors", IsSystem: true},

		// creative
		{Name: "头脑风暴", Category: "creative", Content: "请围绕「{{topic}}」进行头脑风暴，提出 10 个创意想法。\n\n约束条件：\n{{constraints}}\n\n目标：{{goal}}\n\n每个想法包含：\n1. 一句话描述\n2. 核心创新点\n3. 可行性评估（高/中/低）", Variables: "topic,constraints,goal", IsSystem: true},
		{Name: "故事创作", Category: "creative", Content: "请创作一个{{genre}}风格的故事。\n\n设定：{{setting}}\n角色：{{characters}}\n核心冲突：{{conflict}}\n字数：约{{word_count}}字", Variables: "genre,setting,characters,conflict,word_count", IsSystem: true},
		{Name: "产品命名", Category: "creative", Content: "请为以下产品生成命名方案：\n\n产品描述：{{product_desc}}\n目标用户：{{target_users}}\n品牌调性：{{brand_tone}}\n\n请提供 10 个命名候选，包括：\n1. 中文名称\n2. 英文/拼音\n3. 命名理由\n4. 域名可用性建议", Variables: "product_desc,target_users,brand_tone", IsSystem: true},

		// business
		{Name: "周报生成", Category: "business", Content: "请根据以下信息生成本周工作报告：\n\n本周完成：\n{{completed}}\n\n进行中：\n{{in_progress}}\n\n下周计划：\n{{next_week}}\n\n遇到的问题：\n{{blockers}}\n\n格式要求：清晰的结构化周报", Variables: "completed,in_progress,next_week,blockers", IsSystem: true},
		{Name: "会议纪要", Category: "business", Content: "请将以下会议记录整理为规范的会议纪要：\n\n会议主题：{{meeting_title}}\n时间：{{meeting_date}}\n参会人员：{{attendees}}\n\n讨论内容：\n{{discussion}}\n\n请输出：\n1. 会议概要\n2. 决议事项\n3. 行动项（负责人 + 截止日期）\n4. 下次会议安排", Variables: "meeting_title,meeting_date,attendees,discussion", IsSystem: true},
		{Name: "用户反馈分析", Category: "business", Content: "请分析以下用户反馈，提炼关键信息：\n\n产品：{{product_name}}\n反馈内容：\n{{feedback}}\n\n请输出：\n1. 正面反馈归纳\n2. 问题与痛点\n3. 功能建议（按优先级排序）\n4. 整体满意度评估", Variables: "product_name,feedback", IsSystem: true},
		{Name: "需求文档", Category: "business", Content: "请根据以下需求描述，生成结构化的产品需求文档（PRD）：\n\n产品名称：{{product_name}}\n需求概述：{{overview}}\n目标用户：{{target_users}}\n\n文档需包含：\n1. 背景与目标\n2. 用户故事\n3. 功能需求（含优先级）\n4. 非功能需求\n5. 验收标准", Variables: "product_name,overview,target_users", IsSystem: true},
	}

	if err := db.CreateInBatches(&templates, 100).Error; err != nil {
		log.Printf("WARNING: failed to seed prompt templates: %v", err)
	} else {
		log.Printf("seeded %d prompt templates", len(templates))
	}
}

// SeedDefaultSettings 写入默认系统设置（敏感词过滤等）
func SeedDefaultSettings(db *gorm.DB) {
	settings := []domain.Setting{
		// 安全 - 敏感词
		{Key: "sensitive_words_enabled", Value: "true", Type: "bool", Category: "security", Description: "是否启用敏感词过滤"},
		{Key: "sensitive_words_list", Value: defaultSensitiveWordsJSON(), Type: "json", Category: "security", Description: "敏感词列表（JSON 数组）"},

		// 用户注册
		{Key: "registration_enabled", Value: "true", Type: "bool", Category: "auth", Description: "是否允许用户自助注册"},
		{Key: "email_verification_required", Value: boolToString(os.Getenv("SMTP_HOST") != ""), Type: "bool", Category: "auth", Description: "注册是否需要邮箱验证"},
		{Key: "password_min_length", Value: envOrDefault("MIN_PASSWORD_LENGTH", "8"), Type: "number", Category: "auth", Description: "密码最小长度"},

		// 邮件服务 — SMTP 配置从 .env 读取并写入 settings 表，运行时由 smtpConfigProvider 统一读取
		{Key: "smtp_host", Value: os.Getenv("SMTP_HOST"), Type: "string", Category: "email", Description: "SMTP 服务器地址"},
		{Key: "smtp_port", Value: os.Getenv("SMTP_PORT"), Type: "string", Category: "email", Description: "SMTP 服务器端口"},
		{Key: "smtp_username", Value: os.Getenv("SMTP_USERNAME"), Type: "string", Category: "email", Description: "SMTP 用户名"},
		// SECURITY: SMTP password is stored as plain text in the settings table.
		// For production, consider using environment variable SMTP_PASSWORD directly
		// instead of storing in DB, or encrypt the value at rest.
		{Key: "smtp_password", Value: os.Getenv("SMTP_PASSWORD"), Type: "string", Category: "email", Description: "SMTP 密码"},
		{Key: "smtp_from", Value: envOrDefault("SMTP_FROM", "noreply@juhe.studio"), Type: "string", Category: "email", Description: "发件人地址"},

		// 配额与限制
		{Key: "QUOTA_LOW_THRESHOLD", Value: "1000", Type: "number", Category: "quota", Description: "低额度告警阈值（单位：分，默认1000=10元）"},
		{Key: "PLAYGROUND_FREE_TRIALS", Value: "5", Type: "number", Category: "quota", Description: "模型试用免费次数（每个用户）"},

		// 速率与安全
		{Key: "rate_limit_rpm", Value: "60", Type: "number", Category: "rate", Description: "API 全局限流（每分钟请求数）"},
		{Key: "log_retention_days", Value: envOrDefault("LOG_RETENTION_DAYS", "90"), Type: "number", Category: "rate", Description: "消费日志保留天数"},
		{Key: "max_request_body_mb", Value: "10", Type: "number", Category: "rate", Description: "请求体最大大小（MB）"},

		// 调度器 — 通过 .env 控制，不在 DB 中持久化
		{Key: "scheduler_enabled", Value: "true", Type: "bool", Category: "system", Description: "启用定时任务（日账单、订阅续费、日志清理）"},
		{Key: "health_check_enabled", Value: "true", Type: "bool", Category: "system", Description: "启用渠道健康检查"},

		// 访问与通知
		{Key: "cors_allowed_origins", Value: envOrDefault("CORS_ALLOWED_ORIGINS", "*"), Type: "string", Category: "network", Description: "CORS 允许的来源（逗号分隔，* 表示全部）"},
		{Key: "ws_notifications_enabled", Value: "true", Type: "bool", Category: "network", Description: "启用 WebSocket 实时推送通知"},

		// 默认模型
		{Key: "DEFAULT_VISION_MODEL", Value: "", Type: "string", Category: "model", Description: "图像识别默认模型（如 gpt-4o，留空则使用本地配置）"},
		{Key: "DEFAULT_LLM_MODEL", Value: "", Type: "string", Category: "model", Description: "LLM 文本对话默认模型（如 gpt-4o，留空则使用本地配置）"},
	}

	for _, s := range settings {
		var existing domain.Setting
		if err := db.Where("`key` = ?", s.Key).First(&existing).Error; err == nil {
			// 已存在，仅更新 category（兼容旧数据）
			if existing.Category == "" && s.Category != "" {
				existing.Category = s.Category
				if err := db.Save(&existing).Error; err != nil {
					log.Printf("WARNING: failed to update setting category %s: %v", s.Key, err)
				}
			}
			continue
		}
		if err := db.Create(&s).Error; err != nil {
			log.Printf("WARNING: failed to seed setting %s: %v", s.Key, err)
		} else {
			log.Printf("seeded default setting: %s (category=%s)", s.Key, s.Category)
		}
	}
}

func boolToString(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// defaultSensitiveWordsJSON returns the default sensitive words list.
// Returns an empty array — operators should configure their own list
// via the admin settings page (sensitive_words_list).
func defaultSensitiveWordsJSON() string {
	return "[]"
}
