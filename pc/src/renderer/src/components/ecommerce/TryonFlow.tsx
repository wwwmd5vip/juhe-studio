/**
 * Try-on Flow — upload product + model image, generate virtual try-on
 */

import { useTranslation } from 'react-i18next'
import { useEcommerceStore } from '@/stores/ecommerce'
import { FlowLayout, ImageUploadArea, ModelSelector } from './shared'

export function TryonFlow() {
  const { t } = useTranslation()
  const {
    providerId,
    model,
    productImage,
    modelImage,
    isGenerating,
    results,
    setProductImage,
    setModelImage,
    generate,
    clearResults
  } = useEcommerceStore()
  const store = useEcommerceStore

  const canGenerate = !!productImage && !!providerId && !!model && !isGenerating && !!modelImage

  return (
    <FlowLayout
      canGenerate={canGenerate}
      isGenerating={isGenerating}
      results={results}
      resultsGrid='grid-cols-1 max-w-sm mx-auto'
      generate={() => {
        store.getState().setMode('tryon')
        generate()
      }}
    >
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <ImageUploadArea
          image={productImage}
          setImage={(img) => {
            clearResults()
            setProductImage(img)
          }}
          label={t('ecommerce.uploadProduct')}
          hint={t('ecommerce.uploadHint')}
        />
        <ImageUploadArea
          image={modelImage}
          setImage={(img) => {
            clearResults()
            setModelImage(img)
          }}
          label={t('ecommerce.uploadModel')}
          hint={t('ecommerce.uploadModelHint')}
        />
      </div>
      <ModelSelector
        providerId={providerId}
        model={model}
        setProvider={(id) => store.getState().setProviderId(id)}
        setModel={(m) => store.getState().setModel(m)}
      />
    </FlowLayout>
  )
}
