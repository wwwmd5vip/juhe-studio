/**
 * 模型相关通用工具
 *
 * 负责本地 model id 与上游模型名之间的映射。
 * 本地 DB 用 models.id（如 juhe-4）作为内部标识，而上游 API 期望的是
 * models.name（如 juhe-gpt-image-2）。所有发往 upstream 的生成/处理请求
 * 都应先调用 resolveUpstreamModelName。
 */

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { models } from '../db/schema'

/**
 * 把本地 model id 解析成上游模型名。
 *
 * 如果 models 表查不到对应记录，回退到传入的 modelId，避免阻断非同步模型
 * 或自定义模型。DB 查询失败时同样回退，保证调用方可用性。
 */
export async function resolveUpstreamModelName(modelId: string): Promise<string> {
  try {
    const rows = await db.select({ name: models.name }).from(models).where(eq(models.id, modelId)).limit(1)
    return rows[0]?.name || modelId
  } catch (err) {
    console.warn('[ModelUtils] 解析上游模型名失败，已回退到本地 model id', err)
    return modelId
  }
}
