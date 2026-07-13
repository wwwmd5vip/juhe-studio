/**
 * Product Set Flow — upload product, generate 4 white-background images
 */

import { useTranslation } from 'react-i18next'
import { useEcommerceStore } from '@/stores/ecommerce'
import { FlowLayout, ImageUploadArea, ModelSelector } from './shared'

export function ProductSetFlow() {
  const { t } = useTranslation()
  const { providerId, model, productImage, isGenerating, results, setProductImage, generate, clearResults } =
    useEcommerceStore()
  const store = useEcommerceStore

  const canGenerate = !!productImage && !!providerId && !!model && !isGenerating

  return (
    <FlowLayout
      canGenerate={canGenerate}
      isGenerating={isGenerating}
      results={results}
      resultsGrid='grid-cols-2'
      generate={() => {
        store.getState().setMode('product-set')
        generate()
      }}
    >
      <ImageUploadArea
        image={productImage}
        setImage={(img) => {
          clearResults()
          setProductImage(img)
        }}
        label={t('ecommerce.uploadProduct')}
        hint={t('ecommerce.uploadHint')}
      />
      <ModelSelector
        providerId={providerId}
        model={model}
        setProvider={(id) => store.getState().setProviderId(id)}
        setModel={(m) => store.getState().setModel(m)}
      />
    </FlowLayout>
  )
}
