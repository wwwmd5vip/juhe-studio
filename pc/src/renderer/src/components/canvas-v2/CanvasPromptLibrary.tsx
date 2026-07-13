/**
 * CanvasPromptLibrary.tsx - 画布提示词库弹窗
 * 浏览、搜索预设提示词模板，一键发送到画布助手
 */

import { FileText, Image, Layout, Play, Search, Sparkles, Wand2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

interface PromptTemplate {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  icon: string
}

const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    id: 'p1',
    category: '文生图',
    title: '唯美风景',
    description: '生成一张唯美油画风格的风景图',
    prompt:
      '创建文生图工作流：一张唯美的自然风景画面，包含连绵的山脉、平静的湖泊和日落时分的暖色调天空，油画风格，高细节，尺寸 1024x1024',
    icon: 'image'
  },
  {
    id: 'p2',
    category: '文生图',
    title: '产品展示',
    description: '为电商产品生成白底展示图',
    prompt: '创建文生图工作流：专业产品摄影，纯白背景，柔和工作室灯光，高品质电商产品展示图，尺寸 1024x1024',
    icon: 'image'
  },
  {
    id: 'p3',
    category: '文生图',
    title: '角色设计',
    description: '生成动漫风格角色概念设计',
    prompt:
      '创建文生图工作流：动漫风格的角色概念设计图，完整全身像，动态姿势，精细服饰细节，鲜艳色彩，高质量插画，尺寸 1024x1024',
    icon: 'image'
  },
  {
    id: 'p4',
    category: '文生图',
    title: '赛博朋克',
    description: '生成赛博朋克城市夜景',
    prompt:
      '创建文生图工作流：赛博朋克风格的城市夜景，霓虹灯光，雨中的街道，未来科技感建筑，电影感光影，尺寸 1792x1024',
    icon: 'image'
  },
  {
    id: 'p5',
    category: '文生图',
    title: '水彩插画',
    description: '生成水彩风格的花卉插画',
    prompt:
      '创建文生图工作流：精致的水彩风格插画，盛开的牡丹花与蝴蝶，柔和色彩过渡，纸上纹理感，空白背景，尺寸 1024x1024',
    icon: 'image'
  },
  {
    id: 'p6',
    category: '文生图',
    title: '3D 渲染',
    description: '生成 3D 渲染风格图标',
    prompt: '创建文生图工作流：C4D 3D 渲染风格，等距视角，精致的光影和材质，现代设计感，纯色背景，尺寸 1024x1024',
    icon: 'image'
  },
  {
    id: 'p7',
    category: '文本创作',
    title: '创意文案',
    description: '生成营销文案创意',
    prompt: '在画布上创建一个文本节点，内容为一段关于智能产品的创意营销文案，突出产品特点和用户价值',
    icon: 'text'
  },
  {
    id: 'p8',
    category: '文本创作',
    title: '故事大纲',
    description: '生成短故事大纲',
    prompt: '在画布上创建文本节点，内容为一个科幻短篇故事的大纲，包含世界观设定、主要角色和情节主线',
    icon: 'text'
  },
  {
    id: 'p9',
    category: '布局整理',
    title: '网格排列',
    description: '将节点按网格排列',
    prompt: '帮我把画布上的节点重新排列成整齐的网格布局，每个节点间距约 200px，按类型分组排列',
    icon: 'layout'
  },
  {
    id: 'p10',
    category: '布局整理',
    title: '水平流程',
    description: '将节点排列为水平流程',
    prompt: '将画布上的节点排列成从左到右的水平工作流程，节点之间间距约 300px，按照 text→config→output 的顺序排列',
    icon: 'layout'
  },
  {
    id: 'p11',
    category: '视频生成',
    title: 'AI 短视频',
    description: '创建 AI 短视频生成流程',
    prompt:
      '创建一个视频节点和一个配置节点，配置节点设置视频生成提示词："一只可爱的猫咪在花园里散步，阳光明媚，电影质感"',
    icon: 'play'
  },
  {
    id: 'p12',
    category: '高级工作流',
    title: '批量生成',
    description: '创建批量图片生成工作流',
    prompt: '创建三个配置节点分别对应不同风格（写实/插画/卡通），共用同一个提示词文本节点，生成多版本对比',
    icon: 'workflow'
  }
]

interface CanvasPromptLibraryProps {
  isOpen: boolean
  onClose: () => void
  onSelectPrompt: (prompt: string) => void
}

const CATEGORIES = ['全部', '文生图', '文本创作', '布局整理', '视频生成', '高级工作流']

const CATEGORY_KEYS: Record<string, string> = {
  全部: 'canvas.promptLibrary.categories.all',
  文生图: 'canvas.promptLibrary.categories.imageGen',
  文本创作: 'canvas.promptLibrary.categories.textCreation',
  布局整理: 'canvas.promptLibrary.categories.layout',
  视频生成: 'canvas.promptLibrary.categories.videoGen',
  高级工作流: 'canvas.promptLibrary.categories.advancedWorkflow'
}

const iconMap: Record<string, React.ReactNode> = {
  image: <Image className='w-4 h-4' />,
  text: <FileText className='w-4 h-4' />,
  layout: <Layout className='w-4 h-4' />,
  play: <Play className='w-4 h-4' />,
  workflow: <Sparkles className='w-4 h-4' />
}

export function CanvasPromptLibrary({ isOpen, onClose, onSelectPrompt }: CanvasPromptLibraryProps) {
  const { t: tc } = useTranslation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')

  const themeResolved = useThemeStore((s) => s.resolved)
  const t = canvasThemes[themeResolved]
  const accent = '#2f80ff'

  const borderColor = t.toolbar.border
  const surfaceBg = t.node.panel
  const textColor = t.node.text
  const mutedColor = t.node.muted
  const hoverBg = t.toolbar.itemHover
  const canvasBg = t.node.fill

  const filteredPrompts = useMemo(() => {
    let result = BUILTIN_PROMPTS
    if (category !== '全部') {
      result = result.filter((p) => p.category === category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    return result
  }, [search, category])

  if (!isOpen) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/40' onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        className='w-[520px] max-h-[520px] flex flex-col rounded-2xl border shadow-2xl backdrop-blur'
        style={{ borderColor, background: surfaceBg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className='flex items-center justify-between px-4 py-3 shrink-0'
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <div className='flex items-center gap-2'>
            <Wand2 className='w-4 h-4' style={{ color: accent }} />
            <span className='text-sm font-medium' style={{ color: textColor }}>
              {tc('canvas.promptLibrary.title')}
            </span>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1 rounded transition-colors'
            style={{ color: mutedColor }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Search + Categories */}
        <div className='px-4 py-2 shrink-0 space-y-2' style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className='relative'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5' style={{ color: mutedColor }} />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tc('canvas.promptLibrary.searchPlaceholder')}
              className='w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none transition-colors'
              style={{
                borderColor,
                background: canvasBg,
                color: textColor
              }}
            />
          </div>
          <div className='flex gap-1 flex-wrap'>
            {CATEGORIES.map((cat) => (
              <button
                type='button'
                key={cat}
                onClick={() => setCategory(cat)}
                className='px-2 py-0.5 rounded text-[11px] transition-colors'
                style={{
                  background: category === cat ? `${accent}15` : 'transparent',
                  color: category === cat ? accent : mutedColor,
                  fontWeight: category === cat ? 500 : 400
                }}
                onMouseEnter={(e) => {
                  if (category !== cat) e.currentTarget.style.background = hoverBg
                }}
                onMouseLeave={(e) => {
                  if (category !== cat) e.currentTarget.style.background = 'transparent'
                }}
              >
                {tc(CATEGORY_KEYS[cat])}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt List */}
        <div className='flex-1 overflow-y-auto px-4 py-2 thin-scrollbar'>
          {filteredPrompts.length === 0 ? (
            <div className='flex items-center justify-center h-full text-xs' style={{ color: mutedColor }}>
              {tc('canvas.promptLibrary.noResults')}
            </div>
          ) : (
            <div className='space-y-1'>
              {filteredPrompts.map((p) => (
                <button
                  type='button'
                  key={p.id}
                  onClick={() => {
                    onSelectPrompt(p.prompt)
                    onClose()
                  }}
                  className='w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors group'
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div
                    className='w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5'
                    style={{ background: `${accent}1a`, color: accent }}
                  >
                    {iconMap[p.icon] || <Sparkles className='w-4 h-4' />}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs font-medium' style={{ color: textColor }}>
                        {p.title}
                      </span>
                      <span
                        className='text-[10px] px-1.5 py-0.5 rounded-full'
                        style={{ background: `${accent}1a`, color: accent }}
                      >
                        {p.category}
                      </span>
                    </div>
                    <p className='text-[11px] mt-0.5' style={{ color: mutedColor }}>
                      {p.description}
                    </p>
                  </div>
                  <div className='opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5'>
                    <div
                      className='w-5 h-5 rounded flex items-center justify-center'
                      style={{ background: `${accent}26` }}
                    >
                      {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                      <svg
                        className='w-3 h-3'
                        style={{ color: accent }}
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                      >
                        <path d='M5 12h14M12 5l7 7-7 7' />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className='px-4 py-2 text-[10px] text-center shrink-0'
          style={{ borderTop: `1px solid ${borderColor}`, color: mutedColor, opacity: 0.4 }}
        >
          {tc('canvas.promptLibrary.footer', { count: BUILTIN_PROMPTS.length })}
        </div>
      </div>
    </div>
  )
}
