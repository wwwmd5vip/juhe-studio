import type { LucideIcon } from 'lucide-react'
import { ArrowRight, ShoppingBag, Smartphone, Sofa, Sparkle, Sparkles, UtensilsCrossed, Wand2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AssistantPanelProps {
  onApply: (prompt: string) => void
  onClose: () => void
}

// ===== 品类化提示词框架 =====
// 每个品类定义其专属的可选参数和提示词模板

interface CategoryField {
  key: string
  labelKey: string
  placeholderKey: string
}

interface PromptToggle {
  key: string
  labelKey: string
  prompt: string
}

interface PromptPackConfig {
  fixedPrompt: string
  toggles: PromptToggle[]
}

interface CategoryConfig {
  id: string
  icon: LucideIcon
  labelKey: string
  kind: 'form' | 'pack'
  fields?: CategoryField[]
  template?: (values: Record<string, string>) => string
  pack?: PromptPackConfig
}

const _NONE_VALUE = 'none'

const categories: CategoryConfig[] = [
  {
    id: 'clothing',
    icon: ShoppingBag,
    labelKey: 'assistant.categories.clothing',
    kind: 'form',
    fields: [
      {
        key: 'product',
        labelKey: 'assistant.clothing.product',
        placeholderKey: 'assistant.clothing.productPlaceholder'
      },
      { key: 'model', labelKey: 'assistant.clothing.model', placeholderKey: 'assistant.clothing.modelPlaceholder' },
      { key: 'scene', labelKey: 'assistant.clothing.scene', placeholderKey: 'assistant.clothing.scenePlaceholder' },
      {
        key: 'lighting',
        labelKey: 'assistant.clothing.lighting',
        placeholderKey: 'assistant.clothing.lightingPlaceholder'
      },
      {
        key: 'composition',
        labelKey: 'assistant.clothing.composition',
        placeholderKey: 'assistant.clothing.compositionPlaceholder'
      }
    ],
    template: (v) => {
      const parts: string[] = []
      if (v.product) parts.push(v.product)
      if (v.model) parts.push(`${v.model}穿着`)
      if (v.scene) parts.push(v.scene)
      if (v.lighting) parts.push(v.lighting)
      if (v.composition) parts.push(`${v.composition}构图`)
      parts.push('时尚摄影，高清，商业摄影')
      return parts.join('，')
    }
  },
  {
    id: 'food',
    icon: UtensilsCrossed,
    labelKey: 'assistant.categories.food',
    kind: 'form',
    fields: [
      { key: 'product', labelKey: 'assistant.food.product', placeholderKey: 'assistant.food.productPlaceholder' },
      { key: 'plate', labelKey: 'assistant.food.plate', placeholderKey: 'assistant.food.platePlaceholder' },
      {
        key: 'background',
        labelKey: 'assistant.food.background',
        placeholderKey: 'assistant.food.backgroundPlaceholder'
      },
      { key: 'angle', labelKey: 'assistant.food.angle', placeholderKey: 'assistant.food.anglePlaceholder' },
      { key: 'detail', labelKey: 'assistant.food.detail', placeholderKey: 'assistant.food.detailPlaceholder' }
    ],
    template: (v) => {
      const parts: string[] = []
      if (v.product) parts.push(v.product)
      if (v.plate) parts.push(v.plate)
      if (v.background) parts.push(v.background)
      parts.push('暖光')
      if (v.angle) parts.push(v.angle)
      if (v.detail) parts.push(v.detail)
      parts.push('新鲜诱人，商业美食摄影，4K')
      return parts.join('，')
    }
  },
  {
    id: 'beauty',
    icon: Sparkle,
    labelKey: 'assistant.categories.beauty',
    kind: 'form',
    fields: [
      { key: 'product', labelKey: 'assistant.beauty.product', placeholderKey: 'assistant.beauty.productPlaceholder' },
      {
        key: 'material',
        labelKey: 'assistant.beauty.material',
        placeholderKey: 'assistant.beauty.materialPlaceholder'
      },
      { key: 'surface', labelKey: 'assistant.beauty.surface', placeholderKey: 'assistant.beauty.surfacePlaceholder' },
      {
        key: 'lighting',
        labelKey: 'assistant.beauty.lighting',
        placeholderKey: 'assistant.beauty.lightingPlaceholder'
      },
      {
        key: 'composition',
        labelKey: 'assistant.beauty.composition',
        placeholderKey: 'assistant.beauty.compositionPlaceholder'
      }
    ],
    template: (v) => {
      const parts: string[] = []
      if (v.product) parts.push(v.product)
      if (v.material) parts.push(`${v.material}瓶身`)
      if (v.surface) parts.push(v.surface)
      if (v.lighting) parts.push(v.lighting)
      if (v.composition) parts.push(v.composition)
      parts.push('高级感，留白，商业产品摄影，4K')
      return parts.join('，')
    }
  },
  {
    id: '3c',
    icon: Smartphone,
    labelKey: 'assistant.categories.3c',
    kind: 'form',
    fields: [
      { key: 'product', labelKey: 'assistant.3c.product', placeholderKey: 'assistant.3c.productPlaceholder' },
      { key: 'background', labelKey: 'assistant.3c.background', placeholderKey: 'assistant.3c.backgroundPlaceholder' },
      { key: 'lighting', labelKey: 'assistant.3c.lighting', placeholderKey: 'assistant.3c.lightingPlaceholder' },
      { key: 'texture', labelKey: 'assistant.3c.texture', placeholderKey: 'assistant.3c.texturePlaceholder' },
      { key: 'angle', labelKey: 'assistant.3c.angle', placeholderKey: 'assistant.3c.anglePlaceholder' }
    ],
    template: (v) => {
      const parts: string[] = []
      if (v.product) parts.push(v.product)
      if (v.background) parts.push(v.background)
      if (v.lighting) parts.push(v.lighting)
      if (v.texture) parts.push(v.texture)
      if (v.angle) parts.push(v.angle)
      parts.push('科技感，高细节，专业产品图，4K')
      return parts.join('，')
    }
  },
  {
    id: 'home',
    icon: Sofa,
    labelKey: 'assistant.categories.home',
    kind: 'form',
    fields: [
      { key: 'product', labelKey: 'assistant.home.product', placeholderKey: 'assistant.home.productPlaceholder' },
      { key: 'scene', labelKey: 'assistant.home.scene', placeholderKey: 'assistant.home.scenePlaceholder' },
      { key: 'lighting', labelKey: 'assistant.home.lighting', placeholderKey: 'assistant.home.lightingPlaceholder' },
      {
        key: 'atmosphere',
        labelKey: 'assistant.home.atmosphere',
        placeholderKey: 'assistant.home.atmospherePlaceholder'
      },
      {
        key: 'composition',
        labelKey: 'assistant.home.composition',
        placeholderKey: 'assistant.home.compositionPlaceholder'
      }
    ],
    template: (v) => {
      const parts: string[] = []
      if (v.product) parts.push(v.product)
      if (v.scene) parts.push(`置于${v.scene}`)
      if (v.lighting) parts.push(v.lighting)
      if (v.atmosphere) parts.push(`${v.atmosphere}氛围`)
      if (v.composition) parts.push(`${v.composition}构图`)
      parts.push('生活方式摄影，4K')
      return parts.join('，')
    }
  },
  {
    id: 'photoRepair',
    icon: Sparkles,
    labelKey: 'assistant.categories.photoRepair',
    kind: 'pack',
    pack: {
      fixedPrompt: '修复老照片，清晰化面部细节，保持原照片的人物特征和构图',
      toggles: [
        {
          key: 'enhance',
          labelKey: 'assistant.photoRepair.enhance',
          prompt: '增强清晰度'
        },
        {
          key: 'colorize',
          labelKey: 'assistant.photoRepair.colorize',
          prompt: '智能上色（还原自然肤色和服装的真实色彩）'
        },
        {
          key: 'removeDamage',
          labelKey: 'assistant.photoRepair.removeDamage',
          prompt: '去除划痕与噪点'
        },
        {
          key: 'hdRestore',
          labelKey: 'assistant.photoRepair.hdRestore',
          prompt: '高清修复'
        }
      ]
    }
  }
]

export default function AssistantPanel({ onApply, onClose }: AssistantPanelProps) {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<string>('clothing')
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {}
    for (const cat of categories) {
      init[cat.id] = {}
    }
    return init
  })
  const [packSelections, setPackSelections] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {}
    for (const cat of categories) {
      if (cat.kind === 'pack' && cat.pack) {
        init[cat.id] = Object.fromEntries(cat.pack.toggles.map((toggle) => [toggle.key, false]))
      }
    }
    return init
  })
  const [generatedPrompt, setGeneratedPrompt] = useState('')

  const category = categories.find((c) => c.id === activeCategory) ?? categories[0]

  const setField = useCallback((categoryId: string, fieldKey: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [fieldKey]: value }
    }))
    setGeneratedPrompt('')
  }, [])

  const setPackToggle = useCallback((categoryId: string, toggleKey: string, enabled: boolean) => {
    setPackSelections((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [toggleKey]: enabled }
    }))
    setGeneratedPrompt('')
  }, [])

  const buildPackPrompt = useCallback(
    (categoryId: string) => {
      const current = categories.find((item) => item.id === categoryId)
      if (!current || current.kind !== 'pack' || !current.pack) return ''

      const selected = current.pack.toggles
        .filter((toggle) => packSelections[categoryId]?.[toggle.key])
        .map((toggle) => toggle.prompt)

      return [current.pack.fixedPrompt, ...selected].join('，')
    },
    [packSelections]
  )

  const handleGenerate = useCallback(() => {
    const prompt =
      category.kind === 'pack' ? buildPackPrompt(activeCategory) : category.template?.(values[activeCategory] || {})
    if (typeof prompt === 'string' && prompt.trim()) {
      setGeneratedPrompt(prompt)
    }
  }, [activeCategory, buildPackPrompt, category, values])

  const handleApply = useCallback(() => {
    if (generatedPrompt) {
      onApply(generatedPrompt)
    }
  }, [generatedPrompt, onApply])

  const _handleQuickFill = useCallback(
    (fieldKey: string, text: string) => {
      setField(activeCategory, fieldKey, text)
    },
    [activeCategory, setField]
  )

  const handleSetAllPackToggles = useCallback(
    (enabled: boolean) => {
      if (category.kind !== 'pack' || !category.pack) return
      const next = Object.fromEntries(category.pack.toggles.map((toggle) => [toggle.key, enabled]))
      setPackSelections((prev) => ({
        ...prev,
        [activeCategory]: next
      }))
      setGeneratedPrompt('')
    },
    [activeCategory, category]
  )

  return (
    <div className='h-full flex flex-col bg-[var(--juhe-surface)]'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h3 className='font-semibold text-sm flex items-center gap-2'>
          <Sparkles className='w-4 h-4 text-[var(--juhe-cyan)]' />
          {t('assistant.title')}
        </h3>
        <button
          type='button'
          onClick={onClose}
          className='p-1.5 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
        >
          <X className='w-4 h-4' />
        </button>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {/* Category Selection */}
        <div className='grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-6'>
          {categories.map((c) => {
            const Icon = c.icon
            const isActive = activeCategory === c.id
            return (
              <button
                type='button'
                key={c.id}
                onClick={() => {
                  setActiveCategory(c.id)
                  setGeneratedPrompt('')
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-colors ${
                  isActive
                    ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                    : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-3)]'
                }`}
              >
                <Icon className='w-4 h-4' />
                <span className='font-medium'>{t(c.labelKey)}</span>
              </button>
            )
          })}
        </div>

        {/* Description */}
        <div className='rounded-lg bg-[var(--juhe-surface-2)]/50 p-3 text-xs text-[var(--juhe-text-3)]'>
          {t(`assistant.${activeCategory}Desc`, {
            defaultValue: t('assistant.fillFieldsToGenerate')
          })}
        </div>

        {category.kind === 'form' && category.fields && (
          <div className='space-y-3'>
            {category.fields.map((field) => (
              <div key={field.key} className='space-y-1.5'>
                <label className='text-xs font-medium flex items-center gap-1 text-[var(--juhe-text)]'>
                  {t(field.labelKey)}
                  {values[activeCategory]?.[field.key] && (
                    <span className='w-1.5 h-1.5 rounded-full bg-[var(--juhe-cyan)]' />
                  )}
                </label>
                <input
                  type='text'
                  value={values[activeCategory]?.[field.key] || ''}
                  onChange={(e) => setField(activeCategory, field.key, e.target.value)}
                  placeholder={t(field.placeholderKey)}
                  className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                             placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
              </div>
            ))}
          </div>
        )}

        {category.kind === 'pack' && category.pack && (
          <div className='space-y-3'>
            <div className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] p-3 space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <label className='text-xs font-medium text-[var(--juhe-text)]'>
                  {t('assistant.photoRepair.fixedPrompt')}
                </label>
                <button
                  type='button'
                  onClick={() => setGeneratedPrompt(category.pack?.fixedPrompt ?? '')}
                  className='text-[10px] px-2 py-1 rounded-full border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]'
                >
                  {t('assistant.photoRepair.previewFixed')}
                </button>
              </div>
              <div className='text-xs leading-5 text-[var(--juhe-text)]'>{category.pack.fixedPrompt}</div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <label className='text-xs font-medium text-[var(--juhe-text-3)]'>
                  {t('assistant.photoRepair.switchPrompt')}
                </label>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => handleSetAllPackToggles(true)}
                    className='text-[10px] px-2 py-1 rounded-full border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]'
                  >
                    {t('assistant.photoRepair.selectAll')}
                  </button>
                  <button
                    type='button'
                    onClick={() => handleSetAllPackToggles(false)}
                    className='text-[10px] px-2 py-1 rounded-full border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]'
                  >
                    {t('assistant.photoRepair.clearAll')}
                  </button>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-2'>
                {category.pack.toggles.map((toggle) => {
                  const checked = !!packSelections[activeCategory]?.[toggle.key]
                  return (
                    <button
                      key={toggle.key}
                      type='button'
                      onClick={() => setPackToggle(activeCategory, toggle.key, !checked)}
                      className='flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors'
                      style={{
                        borderColor: checked ? 'var(--juhe-cyan)' : 'var(--juhe-border)',
                        background: checked ? 'rgba(0, 240, 255, 0.08)' : 'var(--juhe-void-2)'
                      }}
                    >
                      <span
                        className='mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border text-[10px]'
                        style={{
                          borderColor: checked ? 'var(--juhe-cyan)' : 'var(--juhe-border)',
                          color: checked ? 'var(--juhe-cyan)' : 'var(--juhe-text-3)'
                        }}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className='space-y-0.5'>
                        <span className='block text-xs font-medium text-[var(--juhe-text)]'>{t(toggle.labelKey)}</span>
                        <span className='block text-[10px] leading-4 text-[var(--juhe-text-3)]'>{toggle.prompt}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quick Examples */}
        <div className='space-y-2'>
          <label className='text-xs font-medium text-[var(--juhe-text-3)]'>{t('assistant.quickExamples')}</label>
          <div className='flex flex-wrap gap-1.5'>
            {getQuickExamples(t, activeCategory).map((ex, i) => (
              <button
                type='button'
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={i}
                onClick={() => {
                  // 快速填充所有字段
                  for (const [key, value] of Object.entries(ex.values)) {
                    setField(activeCategory, key, value)
                  }
                }}
                className='px-2 py-1 rounded-md text-[10px] bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-3)] transition-colors'
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          type='button'
          onClick={handleGenerate}
          className='w-full py-2.5 rounded-lg text-sm font-medium bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 transition-colors flex items-center justify-center gap-2'
        >
          <Wand2 className='w-4 h-4' />
          {t('assistant.generatePrompt')}
        </button>

        {/* Generated Prompt Preview */}
        {generatedPrompt && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label className='text-xs text-[var(--juhe-text-3)]'>{t('assistant.promptPreview')}</label>
            </div>
            <div className='p-3 rounded-lg bg-[var(--juhe-surface-2)] text-xs leading-relaxed max-h-32 overflow-y-auto text-[var(--juhe-text)]'>
              {generatedPrompt}
            </div>
            <button
              type='button'
              onClick={handleApply}
              className='w-full py-2 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 transition-colors flex items-center justify-center gap-2'
            >
              {t('assistant.usePrompt')}
              <ArrowRight className='w-3.5 h-3.5' />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// 快速示例数据
function getQuickExamples(
  t: (key: string) => string,
  categoryId: string
): { label: string; values: Record<string, string> }[] {
  switch (categoryId) {
    case 'clothing':
      return [
        {
          label: t('assistant.examples.dressStudio'),
          values: {
            product: '红色丝绸连衣裙，蕾丝花边，V领设计',
            model: '年轻女性，苗条身材，优雅站立',
            scene: '纯色白色背景棚拍',
            lighting: '柔和漫射光',
            composition: '全身'
          }
        },
        {
          label: t('assistant.examples.coatStreet'),
          values: {
            product: '驼色羊毛大衣，双排扣',
            model: '男性模特，挺拔身材，行走姿态',
            scene: '城市街道， autumn氛围',
            lighting: '自然侧光',
            composition: '半身'
          }
        }
      ]
    case 'food':
      return [
        {
          label: t('assistant.examples.sashimi'),
          values: {
            product: '新鲜三文鱼刺身，厚切5片',
            plate: '黑色石板盘，点缀柠檬片和紫苏叶',
            background: '深色木桌',
            angle: '俯拍',
            detail: '水珠点缀，新鲜光泽'
          }
        },
        {
          label: t('assistant.examples.cake'),
          values: {
            product: '草莓奶油蛋糕，三层夹心',
            plate: '白色陶瓷盘，撒糖粉',
            background: '大理石台面',
            angle: '45度',
            detail: '奶油拉丝，草莓切片装饰'
          }
        }
      ]
    case 'beauty':
      return [
        {
          label: t('assistant.examples.lipstick'),
          values: {
            product: '玫瑰金口红，哑光质地，正红色',
            material: '磨砂金属管身，磁吸盖',
            surface: '大理石台面',
            lighting: '环形柔光灯',
            composition: '倾斜45度，开盖展示'
          }
        },
        {
          label: t('assistant.examples.perfume'),
          values: {
            product: '透明玻璃香水瓶，淡粉色液体',
            material: '水晶切割瓶身，金色喷头',
            surface: '丝绒布面',
            lighting: '侧逆光',
            composition: '组合排列，大小不一'
          }
        }
      ]
    case '3c':
      return [
        {
          label: t('assistant.examples.phone'),
          values: {
            product: '银色智能手机，全面屏，超薄机身',
            background: '深空灰渐变背景',
            lighting: '顶部柔光，底部反光',
            texture: '金属边框质感，玻璃背板反光',
            angle: '45度微仰'
          }
        },
        {
          label: t('assistant.examples.earbuds'),
          values: {
            product: '白色无线耳机，入耳式设计',
            background: '纯黑背景',
            lighting: '边缘光勾勒轮廓',
            texture: '哑光塑料质感，金属网细节',
            angle: '特写，充电盒半开'
          }
        }
      ]
    case 'home':
      return [
        {
          label: t('assistant.examples.sofa'),
          values: {
            product: '米色布艺沙发，三人位，实木腿',
            scene: '现代简约客厅，落地窗',
            lighting: '自然光透过纱帘',
            atmosphere: '温馨舒适',
            composition: '场景化，搭配茶几绿植'
          }
        },
        {
          label: t('assistant.examples.lamp'),
          values: {
            product: '黄铜底座台灯，亚麻灯罩',
            scene: '北欧风卧室床头柜',
            lighting: '暖黄灯光，光晕效果',
            atmosphere: '静谧温馨',
            composition: '特写，夜晚氛围'
          }
        }
      ]
    default:
      return []
  }
}
