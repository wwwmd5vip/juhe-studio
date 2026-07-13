/**
 * Product Showcase Flow — upload product, pick platform/market/language, generate multi-angle showcase
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { error as toastError } from '@/components/ui/toast'
import { outputsToUrls, runGeneration } from '@/utils/generation'
import { FlowLayout, ImageUploadArea, ModelSelector } from './shared'

const PLATFORMS = ['amazon', 'taobao', 'jd', 'douyin', 'xiaohongshu', 'shopify'] as const
const MARKETS = ['us', 'cn', 'jp', 'eu'] as const
const LANGUAGES = ['zh', 'en', 'ja'] as const

const SHOWCASE_PROMPTS: Record<string, string> = {
  zh: '专业电商商品展示摄影，多个角度展示商品细节，干净简洁的电商风格，高端质感，适合电商平台主图和详情页',
  en: 'Professional e-commerce product photography, show the product from multiple angles with clean minimalist e-commerce style, premium quality, suitable for e-commerce platform main images and detail pages',
  ja: 'プロフェッショナルなEコマース商品撮影、複数アングルから商品ディテールを表示、クリーンなミニマリストEコマーススタイル、プレミアム品質'
}

export function ProductShowcaseFlow() {
  const { t } = useTranslation()
  const [image, setImage] = useState<string | null>(null)
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [language, setLanguage] = useState('zh')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState<string[]>([])

  const canGenerate = !!image && !!platform && !!market && !!providerId && !!model && !isGenerating

  const handleGenerate = async () => {
    if (!canGenerate || !image) return
    setIsGenerating(true)
    setResults([])

    const base64 = image.includes(',') ? image.split(',')[1] : image

    try {
      const outputs = await runGeneration({
        params: {
          prompt: `${SHOWCASE_PROMPTS[language] || SHOWCASE_PROMPTS.en} — ${platform} ${market} marketplace`,
          model,
          providerId,
          referenceImages: [base64],
          referenceMode: 'fusion',
          referenceWeight: 0.55,
          n: 4,
          quality: 'high',
          size: '1024x1024'
        }
      })
      const urls = outputsToUrls(outputs)
      setResults(urls)
    } catch (err) {
      console.error('[ProductShowcase] Error:', err)
      toastError({ description: '生成商品展示图失败，请重试' })
    } finally {
      setIsGenerating(false)
    }
  }

  const ConfigSelect = ({
    label,
    value,
    options,
    onChange
  }: {
    label: string
    value: string
    options: { id: string; label: string }[]
    onChange: (v: string) => void
  }) => (
    <div className='space-y-1.5'>
      <span className='text-[11px] font-semibold' style={{ color: 'var(--juhe-text-3)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='w-full px-3 py-2 rounded-lg border text-xs'
        style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-void-2)', color: 'var(--juhe-text)' }}
      >
        <option value=''>--</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <FlowLayout
      canGenerate={canGenerate}
      isGenerating={isGenerating}
      results={results}
      generate={handleGenerate}
      resultsGrid='grid-cols-2'
    >
      <ImageUploadArea
        image={image}
        setImage={setImage}
        label={t('ecommerce.uploadProduct')}
        hint={t('ecommerce.uploadHint')}
      />

      <div className='grid grid-cols-3 gap-4'>
        <ConfigSelect
          label={t('ecommerceShowcase.platform')}
          value={platform}
          options={PLATFORMS.map((id) => ({ id, label: id }))}
          onChange={setPlatform}
        />
        <ConfigSelect
          label={t('ecommerceShowcase.market')}
          value={market}
          options={MARKETS.map((id) => ({ id, label: id.toUpperCase() }))}
          onChange={setMarket}
        />
        <ConfigSelect
          label={t('ecommerceShowcase.language')}
          value={language}
          options={LANGUAGES.map((id) => ({ id, label: id.toUpperCase() }))}
          onChange={setLanguage}
        />
      </div>

      <ModelSelector providerId={providerId} model={model} setProvider={setProviderId} setModel={setModel} />
    </FlowLayout>
  )
}
