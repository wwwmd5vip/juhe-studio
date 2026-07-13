/**
 * 提示词优化服务
 * Phase 4: 调用文本模型优化/翻译/简化用户提示词
 */

import { generateText } from '@cherrystudio/ai-core'
import type { PromptOptimizeRequest, PromptOptimizeResult } from '@shared/types/prompt-system'
import { DEFAULT_MODELS_BY_PRESET } from '@shared/constants/provider-mapping'
import { resolveProvider, buildAiCoreSettings } from '@main/utils/provider-resolver'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { providers } from '../db/schema'

const SYSTEM_PROMPTS: Record<string, string> = {
  enhance: `你是一位专业的 AI 图像提示词工程师。请优化用户的提示词，使其更加详细、生动、有效，适用于 DALL-E、Midjourney、Stable Diffusion 等图像生成模型。

重要规则：
1. 保持用户原始提示词的核心主题和主体不变，严禁改变原意
2. 仅添加与主题相关的细节：光影、构图、风格、画质等
3. 如果用户输入是中文，优化后的提示词必须使用中文返回
4. 如果用户输入是英文，优化后的提示词使用英文返回
5. 不要添加与主题无关的内容
6. 只返回优化后的提示词，不要解释`,

  translate: `将以下文本翻译成高质量的图像生成提示词。

重要规则：
1. 保留所有含义和意图，严禁改变原意
2. 如果原文是中文，翻译成英文返回
3. 如果原文是英文，翻译成中文返回
4. 只返回翻译后的提示词，不要额外文字`,

  simplify: `简化以下图像生成提示词，保留核心要素，去除冗余或冲突的术语。

重要规则：
1. 保持核心概念不变，严禁改变原意
2. 保留用户指定的关键元素（如主体、风格、颜色等）
3. 如果用户输入是中文，使用中文返回
4. 如果用户输入是英文，使用英文返回
5. 只返回简化后的提示词`,

  creative: `你是一位创意提示词工程师。请将用户的想法扩展成一个富有创意、想象力和视觉冲击力的图像生成提示词。

重要规则：
1. 保持用户原始主题和核心概念不变，严禁改变原意
2. 可以添加艺术方向、氛围描写、构图建议等增强视觉效果的元素
3. 不要添加与主题无关的意外元素
4. 如果用户输入是中文，使用中文返回
5. 如果用户输入是英文，使用英文返回
6. 只返回创意提示词，不要解释`
}

export async function optimizePrompt(request: PromptOptimizeRequest): Promise<PromptOptimizeResult> {
  const { prompt, mode, providerId, modelId } = request

  if (!prompt.trim()) {
    return { original: prompt, optimized: prompt }
  }

  // 解析 provider ID — 未指定时自动选择第一个启用的 provider
  let targetProviderId = providerId
  if (!targetProviderId) {
    const enabledRows = await db.select().from(providers).where(eq(providers.isEnabled, true)).limit(1)
    if (enabledRows.length === 0) {
      throw new Error(
        'ERR_NO_PROMPT_OPTIMIZER_PROVIDER: 没有可用的提示词优化 provider。请到「设置 → 模型服务」启用一个，或在优化面板里重新选择。'
      )
    }
    targetProviderId = enabledRows[0].id
  }

  const resolved = await resolveProvider(targetProviderId)
  const settings = buildAiCoreSettings(resolved)
  const aiProviderId = resolved.providerId
  const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.enhance

  // 根据 provider presetId 选择默认模型，避免所有供应商都用 gpt-4o
  const defaultModel =
    resolved.presetId && DEFAULT_MODELS_BY_PRESET[resolved.presetId]
      ? DEFAULT_MODELS_BY_PRESET[resolved.presetId]
      : 'gpt-4o'

  const model = modelId || defaultModel

  // 检测用户输入语言，用于日志记录和后续处理
  const isChineseInput = /[\u4e00-\u9fff]/.test(prompt)

  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText(aiProviderId as Parameters<typeof generateText>[0], settings, {
      model,
      prompt: `原始提示词: """${prompt}"""\n\n优化后的提示词:`,
      system,
      temperature: 0.5, // 降低温度，减少创造性发散，保持主题稳定
      maxOutputTokens: 512
    })
  } catch (err) {
    console.error('[PromptOptimizer] 文本生成失败:', {
      providerId: targetProviderId,
      providerType: resolved.providerType,
      aiProviderId,
      model,
      mode,
      prompt: prompt.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  let optimized = result.text.trim()

  // 如果优化结果为空，返回原文
  if (!optimized) {
    optimized = prompt
  }

  // 如果用户输入是中文，但优化结果是英文，尝试追加提醒（部分模型可能不遵循中文指令）
  if (isChineseInput && !/[\u4e00-\u9fff]/.test(optimized) && mode !== 'translate') {
    console.warn('[PromptOptimizer] 中文输入但返回英文结果，可能模型未遵循语言保留指令:', {
      original: prompt.slice(0, 100),
      optimized: optimized.slice(0, 100)
    })
  }

  return {
    original: prompt,
    optimized,
    explanation: undefined
  }
}
