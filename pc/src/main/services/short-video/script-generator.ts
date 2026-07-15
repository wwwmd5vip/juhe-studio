/**
 * 短视频脚本生成器 — 8 组件 Prompt 管线 → LLM → JSON 解析
 */
import { generateText } from '@cherrystudio/ai-core'
import { resolveProvider } from '../../utils/provider-resolver'
import { buildScriptSystemPrompt, buildScriptUserPrompt } from '@shared/short-video/prompts'
import type {
  VideoScript,
  ScriptGenerateRequest,
  ScriptShot,
  VideoMode
} from '@shared/short-video/types'

/**
 * 从 LLM 响应中提取 JSON。
 * 处理 markdown code fences 和裸 JSON。
 */
function extractJson(text: string): string {
  // 去掉 markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }
  // 尝试找到 JSON 对象的起止位置
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim()
  }
  return text.trim()
}

function validateScript(json: unknown): VideoScript {
  const data = json as Record<string, unknown>

  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Missing or invalid "title" in script response')
  }
  if (!Array.isArray(data.shots) || data.shots.length === 0) {
    throw new Error('Missing or empty "shots" array in script response')
  }

  const shots = data.shots.map((s: unknown, i: number) => {
    const shot = s as Record<string, unknown>
    return {
      shotId: (shot.shotId as number) ?? i + 1,
      type: (shot.type || 'product_reveal') as ScriptShot['type'],
      duration: Number(shot.duration) || 3,
      description: String(shot.description || ''),
      camera: (shot.camera || 'static') as ScriptShot['camera'],
      voiceover: String(shot.voiceover || ''),
      prompt: String(shot.prompt || ''),
      motion: (shot.motion || 'ken_burns') as ScriptShot['motion'],
      transition: (shot.transition || 'ffmpeg_fade') as ScriptShot['transition']
    }
  })

  const seo = data.seo as Record<string, unknown> | undefined

  return {
    title: data.title as string,
    category: (data.category as VideoScript['category']) || 'digital',
    style: (data.style as VideoScript['style']) || 'scene',
    platform: (data.platform as VideoScript['platform']) || 'douyin',
    shots,
    seo: {
      title: String(seo?.title || data.title),
      hashtags: Array.isArray(seo?.hashtags) ? seo.hashtags.map(String) : [],
      coverText: String(seo?.coverText || '')
    }
  }
}

/**
 * 生成短视频脚本。
 * 使用 generateText（非流式）调用 LLM，解析 JSON 输出。
 */
export async function generateVideoScript(
  req: ScriptGenerateRequest
): Promise<VideoScript> {
  const mode: VideoMode = req.mode || 'short'

  // Step 1: 解析 Provider
  const resolved = await resolveProvider(req.providerId)

  // Step 2: 组装 prompts
  const systemPrompt = buildScriptSystemPrompt()
  const userPrompt = buildScriptUserPrompt({
    productName: req.productName,
    productDescription: req.productDescription,
    sellingPoints: req.sellingPoints,
    category: req.category,
    style: req.style,
    platform: req.platform,
    mode,
    customInstructions: req.customInstructions
  })

  // Step 3: 调用 LLM
  const settings: Record<string, string> = {}
  if (resolved.apiKey) settings.apiKey = resolved.apiKey
  if (resolved.baseURL) settings.baseURL = resolved.baseURL

  const result = await generateText(
    resolved.providerId as Parameters<typeof generateText>[0],
    settings as never,
    {
      model: req.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      maxRetries: 1,
      temperature: 0.7
    }
  )

  // Step 4: 提取并验证 JSON
  const rawText = result.text || ''
  if (!rawText) {
    throw new Error('LLM returned empty response')
  }

  const jsonStr = extractJson(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      `Failed to parse LLM response as JSON. Raw: ${rawText.slice(0, 500)}`
    )
  }

  return validateScript(parsed)
}
