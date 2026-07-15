/**
 * Brand Kit 服务 — CRUD + prompt 注入。
 */

import { eq } from 'drizzle-orm'
import { db } from '../db'
import { brandKits } from '../db/schema'
import type { BrandKit } from '@shared/types/creator-os'

export async function listBrandKits(): Promise<BrandKit[]> {
  return (await db.select().from(brandKits).orderBy(brandKits.name)) as unknown as BrandKit[]
}

export async function getBrandKit(id: string): Promise<BrandKit | null> {
  const rows = await db.select().from(brandKits).where(eq(brandKits.id, id)).limit(1)
  return (rows[0] as unknown as BrandKit) ?? null
}

export async function createBrandKit(data: {
  name: string
  primaryColor?: string
  secondaryColor?: string
  logoPath?: string
  fontFamily?: string
  styleDescription?: string
}): Promise<BrandKit> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record = {
    id,
    name: data.name,
    primaryColor: data.primaryColor || '#FF5733',
    secondaryColor: data.secondaryColor || null,
    logoPath: data.logoPath || null,
    fontFamily: data.fontFamily || 'Inter',
    styleDescription: data.styleDescription || null,
    createdAt: now,
    updatedAt: now
  }
  await db.insert(brandKits).values(record)
  return record as unknown as BrandKit
}

export async function updateBrandKit(
  id: string,
  data: Partial<{
    name: string
    primaryColor: string
    secondaryColor: string
    logoPath: string
    fontFamily: string
    styleDescription: string
  }>
): Promise<BrandKit | null> {
  const existing = await getBrandKit(id)
  if (!existing) return null

  const now = new Date().toISOString()
  await db
    .update(brandKits)
    .set({ ...data, updatedAt: now })
    .where(eq(brandKits.id, id))

  return getBrandKit(id)
}

export async function deleteBrandKit(id: string): Promise<void> {
  await db.delete(brandKits).where(eq(brandKits.id, id))
}

/**
 * 为品牌 Kit 生成 prompt 注入片段。
 * 可在生图时拼接到用户 prompt 末尾。
 */
export function buildBrandPrompt(brand: BrandKit | null): string {
  if (!brand) return ''
  const parts: string[] = []
  if (brand.primaryColor) parts.push(`主色调：${brand.primaryColor}`)
  if (brand.secondaryColor) parts.push(`辅助色：${brand.secondaryColor}`)
  if (brand.logoPath) parts.push(`Logo：放置在左上角作为水印`)
  if (brand.styleDescription) parts.push(`风格要求：${brand.styleDescription}`)
  return parts.length > 0 ? `\n\n——品牌规范——\n${parts.join('，')}` : ''
}
