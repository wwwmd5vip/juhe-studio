/**
 * 短视频脚本引擎 — 品类 × 风格 Prompt 模板
 *
 * 8 组件管线 → 一体 LLM 调用:
 *   商品信息 → 品类指令 → 风格结构 → 视频模式 → 平台 SEO
 *   → 黄金 3 秒策略 → 组装 system/user prompt → JSON 输出
 */

import type { VideoCategory, VideoStyle, VideoPlatform, VideoMode } from '../types'

// ── 品类专属指令 ──

const CATEGORY_INSTRUCTIONS: Record<VideoCategory, string> = {
  beauty: `【美妆品类】
- 重点突出产品色号、质地、上妆效果
- 使用"妆前/妆后"对比手法
- 强调成分安全性、对敏感肌友好
- 适合展示涂抹过程、持妆测试
- 光线要求：柔和自然光为主`,

  food: `【食品品类】
- 重点突出食材新鲜度、制作过程
- 使用慢动作展示食物流动/拉丝效果
- 强调口感描述（酥脆/Q弹/软糯）
- 适合展示特写（切面、汤汁、蒸汽）
- 光线要求：暖色调、侧逆光`,

  fashion: `【服饰品类】
- 重点突出版型、面料质感、穿搭效果
- 使用多角度上身展示
- 强调显瘦/显高/百搭效果
- 适合展示动态走秀、细节特写
- 光线要求：自然光/棚拍柔光`,

  home: `【家居品类】
- 重点突出空间感、材质、收纳效果
- 使用"实用场景"展示日常使用
- 强调省空间/多功能/高颜值
- 适合展示安装过程、前后对比
- 光线要求：暖色自然光`,

  digital: `【数码品类】
- 重点突出性能参数、设计工艺
- 使用极简科技感视觉风格
- 强调性能提升/性价比/创新功能
- 适合展示跑分/散热/实际使用
- 光线要求：暗色调+局部打光`
}

// ── 风格结构指令 ──

const STYLE_INSTRUCTIONS: Record<VideoStyle, string> = {
  pain_point: `【痛点种草风格】
- Hook: 抛出让人共鸣的痛点场景
- 结构: 痛点 → 放大焦虑 → 产品方案 → 效果展示 → 限时优惠
- 语气: 共情+急迫感
- 黄金3秒示例: "你是不是也遇到过...""别再..."`,

  scene: `【场景安利风格】
- Hook: 美好生活场景开场
- 结构: 场景 → 产品自然融入 → 使用过程 → 效果 → 生活方式向往
- 语气: 轻松自然、种草感
- 黄金3秒示例: "每天5分钟的仪式感...""懒人必备的好物..."`,

  comparison: `【对比测评风格】
- Hook: 对比悬念/反常识结论
- 结构: 对比引入 → A方案 vs B方案 → 实测数据 → 结论 + 推荐
- 语气: 客观、数据驱动
- 黄金3秒示例: "同样是XX，差距竟然这么大...""用了10款XX，只有这款..."`,

  drama: `【剧情风格】
- Hook: 简短剧情冲突/反转
- 结构: 日常场景 → 遇到问题 → 产品登场 → 完美解决 → 幽默/温馨收尾
- 语气: 有故事感、轻松幽默
- 黄金3秒示例: 一个让人好奇的剧情开头`
}

// ── 视频模式指令 ──

const MODE_INSTRUCTIONS: Record<VideoMode, string> = {
  short: `【短视频带货模式】
- 总时长: 15-45 秒
- 分镜数: 4-8 个
- 节奏: 快速切换，3秒一个 hook
- 重点: 前3秒抓眼球，中间3秒展示产品，最后3秒促转化`,

  opening: `【开场引流模式】
- 总时长: 8-15 秒
- 分镜数: 2-4 个
- 节奏: 极快速切换，悬念导向
- 重点: 不展示完整产品，制造悬念引导点击`,

  review: `【深度测评模式】
- 总时长: 30-90 秒
- 分镜数: 6-12 个
- 节奏: 有张有弛，详解逐步展开
- 重点: 开箱→外观→功能→实测→总结，完整评测链路`
}

// ── 平台 SEO 指令 ──

const PLATFORM_SEO: Record<VideoPlatform, string> = {
  douyin: `【抖音平台】
- 标题: 15-30 字，带情绪词和数字
- 话题标签: 3-5 个，包含品类词+场景词+热门词
- 封面文字: 大字报风格，一句话爆点`,

  kuaishou: `【快手平台】
- 标题: 接地气、带老铁/家人们语气
- 话题标签: 2-4 个，偏实用性
- 封面文字: 简单直接、突出实惠`,

  xiaohongshu: `【小红书平台】
- 标题: 精致、带 emoji、带关键词
- 话题标签: 5-8 个，精细化标签
- 封面文字: 高颜值排版，突出"种草""测评"`,

  wechat: `【视频号平台】
- 标题: 偏正式、有深度
- 话题标签: 2-3 个，质量>数量
- 封面文字: 简洁大气`,

  tiktok: `【TikTok 平台】
- 标题: Short and punchy, with emojis
- 话题标签: 3-5 trending hashtags
- 封面文字: Bold text overlay, hook-driven`
}

// ── 黄金 3 秒策略 ──

const HOOK_STRATEGY = `【黄金 3 秒策略】
第一个镜头（hook类型）必须包含以下元素之一：
1. 视觉冲击：高饱和度颜色、快速缩放、对比画面
2. 认知冲突：反常识结论、违背预期的画面
3. 情感共鸣：每个人都会遇到的痛点
4. 利益承诺："学会这招，XX提升10倍"
5. 悬念设置：不完整的画面/文字，引导看下去
禁止使用"大家好"、"今天给大家分享"等慢热开场。`

// ── System Prompt 组装 ──

export function buildScriptSystemPrompt(): string {
  return `你是一个专业的短视频带货脚本策划师。你需要根据商品信息生成完整的短视频分镜脚本。

输出必须是合法的 JSON，格式如下：
{
  "title": "视频标题",
  "shots": [
    {
      "shotId": 1,
      "type": "hook|pain_point|product_reveal|demo|social_proof|cta",
      "duration": 3,
      "description": "画面描述（中文）",
      "camera": "static|zoom_in_slow|zoom_out_slow|pan_left|pan_right|ken_burns|bounce",
      "voiceover": "配音文案（中文，口语化）",
      "prompt": "AI 生成图片/视频的英文 prompt（详细描述画面）",
      "motion": "zoom_in_slow|ken_burns|static|...",
      "transition": "ffmpeg_fade|ffmpeg_crossfade|cut|..."
    }
  ],
  "seo": {
    "title": "SEO 优化标题",
    "hashtags": ["标签1", "标签2", "标签3"],
    "coverText": "封面大字文案"
  }
}

要求：
- 每个 shot 的 description 要详细到能直接给 AI 生图使用
- voiceover 要口语化自然，像真人说话
- prompt 要用英文写，给 AI 图像生成用
- 镜头类型 type 的分布要符合视频结构
- 总镜头数 4-8 个，总时长 15-45 秒`
}

// ── User Prompt 组装 ──

export function buildScriptUserPrompt(params: {
  productName: string
  productDescription?: string
  sellingPoints?: string[]
  category: VideoCategory
  style: VideoStyle
  platform: VideoPlatform
  mode?: VideoMode
  customInstructions?: string
}): string {
  const mode = params.mode || 'short'
  const parts: string[] = []

  // 1. 商品信息
  parts.push(`【商品信息】`)
  parts.push(`商品名称：${params.productName}`)
  if (params.productDescription) {
    parts.push(`商品描述：${params.productDescription}`)
  }
  if (params.sellingPoints && params.sellingPoints.length > 0) {
    parts.push(`核心卖点：${params.sellingPoints.join('、')}`)
  }

  // 2-6. 品类 + 风格 + 模式 + 平台 + 黄金 3 秒
  parts.push('')
  parts.push(CATEGORY_INSTRUCTIONS[params.category])
  parts.push('')
  parts.push(STYLE_INSTRUCTIONS[params.style])
  parts.push('')
  parts.push(MODE_INSTRUCTIONS[mode])
  parts.push('')
  parts.push(PLATFORM_SEO[params.platform])
  parts.push('')
  parts.push(HOOK_STRATEGY)

  // 7. 自定义指令
  if (params.customInstructions) {
    parts.push('')
    parts.push(`【额外要求】`)
    parts.push(params.customInstructions)
  }

  // 8. 输出要求
  parts.push('')
  parts.push('请根据以上所有约束，直接生成 JSON 格式的分镜脚本。只输出 JSON，不要有任何额外说明。')

  return parts.join('\n')
}
