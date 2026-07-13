/**
 * Scene Composition Flow — upload product, pick a scene, generate composite
 */

import { useTranslation } from 'react-i18next'
import { sceneTemplates, useProductCompositionStore } from '@/stores/product-composition'
import { FlowLayout, ImageUploadArea, ModelSelector } from './shared'

const sceneIconMap: Record<string, string> = {
  whiteBg: '⬜',
  marble: '🪨',
  wood: '🪵',
  grass: '🌿',
  beach: '🏖️',
  city: '🏙️',
  livingRoom: '🛋️',
  cafe: '☕',
  minimalist: '◻️',
  luxury: '✨'
}

export function SceneCompositionFlow() {
  const { t } = useTranslation()
  const {
    productImage,
    sceneTemplate,
    result,
    isProcessing,
    providerId,
    model,
    setProductImage,
    setScene,
    setProviderId,
    setModel,
    generate,
    reset
  } = useProductCompositionStore()
  const store = useProductCompositionStore

  const canGenerate = !!productImage && !!sceneTemplate && !!providerId && !!model && !isProcessing

  return (
    <FlowLayout
      canGenerate={canGenerate}
      isGenerating={isProcessing}
      results={result ? [result] : []}
      generate={generate}
      resultsGrid='grid-cols-1 max-w-lg mx-auto'
      generateLabel={!providerId ? t('generate.modelSelector.selectProvider') : t('ecommerce.generate')}
    >
      <ImageUploadArea
        image={productImage}
        setImage={(img) => {
          reset()
          setProductImage(img)
        }}
        label={t('productComposition.uploadProduct')}
        hint={t('ecommerce.uploadHint')}
      />

      {/* Scene Grid */}
      <div className='space-y-2'>
        <span className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
          {t('productComposition.selectScene')}
        </span>
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3'>
          {sceneTemplates.map((scene) => (
            <button
              key={scene.id}
              type='button'
              onClick={() => {
                store.getState().reset()
                setProductImage(productImage)
                setScene(scene.id, t(scene.promptKey as never))
              }}
              className='flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:-translate-y-0.5'
              style={{
                borderColor: sceneTemplate === scene.id ? 'var(--juhe-cyan)' : 'var(--juhe-border)',
                background: sceneTemplate === scene.id ? 'var(--juhe-cyan-glow)' : 'var(--juhe-surface-2)'
              }}
            >
              <span className='text-lg'>{sceneIconMap[scene.id] ?? '🖼️'}</span>
              <span
                className='text-[11px] font-medium text-center'
                style={{ color: sceneTemplate === scene.id ? 'var(--juhe-cyan)' : 'var(--juhe-text-2)' }}
              >
                {t(scene.labelKey as never)}
              </span>
              <span className='text-[10px] text-center leading-tight' style={{ color: 'var(--juhe-text-3)' }}>
                {t(scene.descriptionKey as never)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ModelSelector providerId={providerId} model={model} setProvider={setProviderId} setModel={setModel} />
    </FlowLayout>
  )
}
