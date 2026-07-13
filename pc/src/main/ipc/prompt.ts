/**
 * 提示词系统 IPC
 * Phase 4: prompt optimize + preset tags + templates
 */

import type { PromptOptimizeRequest, PromptTemplate, TemplateVariable } from '@shared/types/prompt-system'
import { desc, eq, like } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { db } from '../db'
import { promptTemplates } from '../db/schema'
import { optimizePrompt } from '../services/prompt-optimizer'

// 内置模板（预设）
const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tpl-portrait',
    name: '人物肖像',
    description: '生成高质量人物肖像',
    prompt: '{{subject}}, {{style}}, {{lighting}}, {{quality}}',
    variables: [
      {
        name: 'subject',
        label: '主体',
        type: 'text',
        default: 'a beautiful young woman with long hair',
        required: true
      },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'photorealistic',
        options: ['photorealistic', 'oil painting', 'anime', 'sketch'],
        required: true
      },
      {
        name: 'lighting',
        label: '光影',
        type: 'select',
        default: 'soft natural lighting',
        options: ['soft natural lighting', 'golden hour', 'neon lights', 'studio lighting'],
        required: false
      },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: '8k, ultra detailed',
        options: ['8k, ultra detailed', '4k, highly detailed', 'masterpiece, best quality'],
        required: false
      }
    ],
    category: 'portrait',
    tags: ['人物', '肖像'],
    example: 'a beautiful young woman with long hair, photorealistic, soft natural lighting, 8k, ultra detailed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'tpl-landscape',
    name: '风景场景',
    description: '生成壮美的自然或城市风景',
    prompt: '{{scene}}, {{time}}, {{style}}, {{quality}}, {{atmosphere}}',
    variables: [
      { name: 'scene', label: '场景', type: 'text', default: 'a majestic mountain range with a lake', required: true },
      {
        name: 'time',
        label: '时间',
        type: 'select',
        default: 'golden hour',
        options: ['golden hour', 'blue hour', 'midday', 'night', 'sunrise'],
        required: false
      },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'photorealistic',
        options: ['photorealistic', 'oil painting', 'watercolor', 'concept art'],
        required: false
      },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: '8k, ultra detailed',
        options: ['8k, ultra detailed', '4k, highly detailed', 'cinematic'],
        required: false
      },
      { name: 'atmosphere', label: '氛围', type: 'text', default: 'serene and peaceful', required: false }
    ],
    category: 'landscape',
    tags: ['风景', '自然'],
    example:
      'a majestic mountain range with a lake, golden hour, photorealistic, 8k, ultra detailed, serene and peaceful',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'tpl-character',
    name: '角色设计',
    description: '生成游戏/动画角色概念设计',
    prompt: 'character design, {{description}}, {{style}}, full body, {{pose}}, {{background}}, {{quality}}',
    variables: [
      {
        name: 'description',
        label: '描述',
        type: 'text',
        default: 'a fierce female warrior with silver armor',
        required: true
      },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'concept art',
        options: ['concept art', 'anime', 'realistic', 'chibi'],
        required: false
      },
      {
        name: 'pose',
        label: '姿态',
        type: 'select',
        default: 'standing pose',
        options: ['standing pose', 'action pose', 'sitting pose', 'fighting stance'],
        required: false
      },
      {
        name: 'background',
        label: '背景',
        type: 'select',
        default: 'simple gradient background',
        options: ['simple gradient background', 'detailed environment', 'white background', 'dark background'],
        required: false
      },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: 'masterpiece, best quality',
        options: ['masterpiece, best quality', 'highly detailed', '4k resolution'],
        required: false
      }
    ],
    category: 'character',
    tags: ['角色', '游戏'],
    example:
      'character design, a fierce female warrior with silver armor, concept art, full body, standing pose, simple gradient background, masterpiece, best quality',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'tpl-logo',
    name: 'Logo 设计',
    description: '生成品牌 Logo 概念图',
    prompt:
      'logo design for {{brand}}, {{style}}, {{color}}, minimalist, vector style, clean, professional, {{quality}}, white background',
    variables: [
      { name: 'brand', label: '品牌/主题', type: 'text', default: 'a tech startup', required: true },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'modern geometric',
        options: ['modern geometric', 'vintage badge', 'minimalist line art', 'abstract', 'mascot'],
        required: false
      },
      { name: 'color', label: '主色调', type: 'text', default: 'blue and white', required: false },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: 'high resolution',
        options: ['high resolution', 'vector quality', '4k'],
        required: false
      }
    ],
    category: 'design',
    tags: ['设计', 'Logo'],
    example:
      'logo design for a tech startup, modern geometric, blue and white, minimalist, vector style, clean, professional, high resolution, white background',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'tpl-product',
    name: '产品渲染',
    description: '生成产品展示图',
    prompt:
      'product photography, {{product}}, {{setting}}, {{lighting}}, {{style}}, {{quality}}, commercial photography',
    variables: [
      { name: 'product', label: '产品', type: 'text', default: 'a sleek wireless headphone', required: true },
      {
        name: 'setting',
        label: '场景',
        type: 'select',
        default: 'on a clean white surface',
        options: ['on a clean white surface', 'in a modern office', 'floating in air', 'on a wooden table'],
        required: false
      },
      {
        name: 'lighting',
        label: '光影',
        type: 'select',
        default: 'softbox studio lighting',
        options: ['softbox studio lighting', 'natural window light', 'dramatic side light', 'neon ambient'],
        required: false
      },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'photorealistic',
        options: ['photorealistic', 'minimalist', 'luxury', 'lifestyle'],
        required: false
      },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: '8k, ultra detailed',
        options: ['8k, ultra detailed', '4k, highly detailed', 'commercial quality'],
        required: false
      }
    ],
    category: 'product',
    tags: ['产品', '摄影'],
    example:
      'product photography, a sleek wireless headphone, on a clean white surface, softbox studio lighting, photorealistic, 8k, ultra detailed, commercial photography',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  },
  {
    id: 'tpl-anime',
    name: '动漫插画',
    description: '生成日式动漫风格插画',
    prompt: '{{subject}}, {{style}}, {{background}}, {{lighting}}, {{quality}}, anime art',
    variables: [
      { name: 'subject', label: '主体', type: 'text', default: 'a cute girl with cat ears', required: true },
      {
        name: 'style',
        label: '风格',
        type: 'select',
        default: 'anime style',
        options: ['anime style', 'Studio Ghibli style', 'Makoto Shinkai style', 'chibi', 'vintage anime'],
        required: false
      },
      { name: 'background', label: '背景', type: 'text', default: 'cherry blossom park', required: false },
      {
        name: 'lighting',
        label: '光影',
        type: 'select',
        default: 'soft daylight',
        options: ['soft daylight', 'golden hour', 'moonlight', 'indoor warm light'],
        required: false
      },
      {
        name: 'quality',
        label: '画质',
        type: 'select',
        default: 'masterpiece, best quality',
        options: ['masterpiece, best quality', 'highly detailed', '4k'],
        required: false
      }
    ],
    category: 'anime',
    tags: ['动漫', '插画'],
    example:
      'a cute girl with cat ears, anime style, cherry blossom park, soft daylight, masterpiece, best quality, anime art',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  }
]

export function registerPromptIpc() {
  // 优化提示词
  ipcMain.handle('prompt:optimize', async (_event, request: PromptOptimizeRequest) => {
    return optimizePrompt(request)
  })

  // 获取预设模板列表
  ipcMain.handle('prompt:list-templates', async () => {
    // 合并内置模板和数据库中的自定义模板
    const custom = await db.select().from(promptTemplates).orderBy(desc(promptTemplates.updatedAt))
    const mappedCustom: PromptTemplate[] = custom.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      prompt: t.content,
      variables: (t.content ? [] : []) as TemplateVariable[],
      category: t.category || 'custom',
      tags: (t.tags ? JSON.parse(t.tags as string) : []) as string[],
      example: undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      usageCount: t.usageCount || 0
    }))
    return [...BUILTIN_TEMPLATES, ...mappedCustom]
  })

  // 创建自定义模板
  ipcMain.handle(
    'prompt:create-template',
    async (_event, data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.insert(promptTemplates).values({
        id,
        name: data.name,
        description: data.description,
        content: data.prompt,
        category: data.category,
        tags: JSON.stringify(data.tags),
        createdAt: now,
        updatedAt: now,
        usageCount: 0
      })
      return id
    }
  )

  // 更新模板
  ipcMain.handle('prompt:update-template', async (_event, id: string, data: Partial<PromptTemplate>) => {
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (data.name !== undefined) update.name = data.name
    if (data.description !== undefined) update.description = data.description
    if (data.prompt !== undefined) update.content = data.prompt
    if (data.category !== undefined) update.category = data.category
    if (data.tags !== undefined) update.tags = JSON.stringify(data.tags)
    await db.update(promptTemplates).set(update).where(eq(promptTemplates.id, id))
    return true
  })

  // 删除模板
  ipcMain.handle('prompt:delete-template', async (_event, id: string) => {
    await db.delete(promptTemplates).where(eq(promptTemplates.id, id))
    return true
  })

  // 搜索模板
  ipcMain.handle('prompt:search-templates', async (_event, query: string) => {
    const all = [...BUILTIN_TEMPLATES]
    const escapedQuery = query.replace(/[%_]/g, '\\$&')
    const custom = await db
      .select()
      .from(promptTemplates)
      .where(like(promptTemplates.name, `%${escapedQuery}%`))
    const mappedCustom: PromptTemplate[] = custom.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      prompt: t.content,
      variables: [] as TemplateVariable[],
      category: t.category || 'custom',
      tags: (t.tags ? JSON.parse(t.tags as string) : []) as string[],
      example: undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      usageCount: t.usageCount || 0
    }))
    all.push(...mappedCustom)
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    )
  })
}
