import { create } from 'zustand'
import { outputsToUrls, runGeneration } from '@/utils/generation'

export type EcommerceMode = 'tryon' | 'product-set'

export interface EcommerceState {
  mode: EcommerceMode
  providerId: string
  model: string
  productImage: string | null
  modelImage: string | null
  isGenerating: boolean
  error: string | null
  results: string[]
  history: Array<{ id: string; mode: EcommerceMode; results: string[]; createdAt: number }>
  setMode: (mode: EcommerceMode) => void
  setProviderId: (id: string) => void
  setModel: (model: string) => void
  setProductImage: (image: string | null) => void
  setModelImage: (image: string | null) => void
  generate: () => Promise<void>
  clearResults: () => void
  clearHistory: () => void
}

const PROMPTS: Record<EcommerceMode, string> = {
  'product-set': '专业商品摄影，高画质商业白底图，完美布光，产品居中展示，细节清晰可见，干净的白色背景，高端电商风格',
  tryon: 'AI虚拟试穿，将服装穿在模特身上，保持服装款式和颜色不变，模特姿势自然，专业时尚摄影棚拍摄，全身照，高质量'
}

export const useEcommerceStore = create<EcommerceState>((set, get) => ({
  mode: 'product-set',
  providerId: '',
  model: '',
  productImage: null,
  modelImage: null,
  isGenerating: false,
  error: null,
  results: [],
  history: [],

  setMode: (mode) => set({ mode, results: [], productImage: null, modelImage: null }),
  setProviderId: (providerId) => set({ providerId }),
  setModel: (model) => set({ model }),
  setProductImage: (image) => set({ productImage: image }),
  setModelImage: (image) => set({ modelImage: image }),

  generate: async () => {
    const { mode, productImage, modelImage, providerId, model } = get()
    if (!productImage || !providerId || !model) return
    if (mode === 'tryon' && !modelImage) return

    set({ isGenerating: true, error: null, results: [] })

    const strip = (s: string) => (s.includes(',') ? s.split(',')[1] : s)
    const referenceImages = [strip(productImage)]
    if (mode === 'tryon' && modelImage) referenceImages.push(strip(modelImage))

    try {
      const outputs = await runGeneration({
        params: {
          prompt: PROMPTS[mode],
          model,
          providerId,
          referenceImages,
          referenceMode: 'fusion',
          referenceWeight: 0.7,
          n: mode === 'product-set' ? 4 : 1,
          quality: 'high',
          size: '1024x1024'
        }
      })

      const urls = outputsToUrls(outputs)
      set((s) => ({
        results: urls,
        isGenerating: false,
        history:
          urls.length > 0
            ? [{ id: `hist-${Date.now()}`, mode, results: urls, createdAt: Date.now() }, ...s.history]
            : s.history
      }))
    } catch (err) {
      set({ isGenerating: false, error: err instanceof Error ? err.message : 'Generation failed' })
    }
  },

  clearResults: () => set({ results: [] }),
  clearHistory: () => set({ history: [] })
}))
