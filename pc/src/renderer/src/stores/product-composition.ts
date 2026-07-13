import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { outputsToUrls, runGeneration } from '@/utils/generation'

export interface ProductTransform {
  x: number
  y: number
  scale: number
  rotation: number
}

export interface Lighting {
  brightness: number
  shadow: number
  temperature: number
}

export interface Blend {
  mode: string
  feather: number
}

export interface ProductCompositionState {
  productImage: string | null
  scenePrompt: string
  sceneTemplate: string | null
  productTransform: ProductTransform
  lighting: Lighting
  blend: Blend
  result: string | null
  isProcessing: boolean
  error: string | null
  providerId: string
  model: string
  setProductImage: (img: string | null) => void
  setScene: (
    template: string,
    prompt: string,
    options?: { transform?: Partial<ProductTransform>; lighting?: Partial<Lighting> }
  ) => void
  setTransform: (t: Partial<ProductTransform>) => void
  setLighting: (l: Partial<Lighting>) => void
  setBlend: (b: Partial<Blend>) => void
  setProviderId: (id: string) => void
  setModel: (model: string) => void
  generate: () => Promise<void>
  reset: () => void
}

type ScenePreset = {
  id: string
  labelKey: string
  descriptionKey: string
  promptKey: string
  defaultTransform: Partial<ProductTransform>
  defaultLighting: Partial<Lighting>
}

export const sceneTemplates: readonly ScenePreset[] = [
  {
    id: 'whiteBg',
    labelKey: 'productComposition.scenes.whiteBg',
    descriptionKey: 'productComposition.sceneDescriptions.whiteBg',
    promptKey: 'productComposition.scenePrompts.whiteBg',
    defaultTransform: { scale: 96, x: 0, y: 0 },
    defaultLighting: { brightness: 108, shadow: 30, temperature: 50 }
  },
  {
    id: 'marble',
    labelKey: 'productComposition.scenes.marble',
    descriptionKey: 'productComposition.sceneDescriptions.marble',
    promptKey: 'productComposition.scenePrompts.marble',
    defaultTransform: { scale: 88, x: 0, y: 12 },
    defaultLighting: { brightness: 104, shadow: 58, temperature: 52 }
  },
  {
    id: 'wood',
    labelKey: 'productComposition.scenes.wood',
    descriptionKey: 'productComposition.sceneDescriptions.wood',
    promptKey: 'productComposition.scenePrompts.wood',
    defaultTransform: { scale: 86, x: 0, y: 10 },
    defaultLighting: { brightness: 102, shadow: 60, temperature: 56 }
  },
  {
    id: 'grass',
    labelKey: 'productComposition.scenes.grass',
    descriptionKey: 'productComposition.sceneDescriptions.grass',
    promptKey: 'productComposition.scenePrompts.grass',
    defaultTransform: { scale: 84, x: 10, y: 20 },
    defaultLighting: { brightness: 98, shadow: 48, temperature: 48 }
  },
  {
    id: 'beach',
    labelKey: 'productComposition.scenes.beach',
    descriptionKey: 'productComposition.sceneDescriptions.beach',
    promptKey: 'productComposition.scenePrompts.beach',
    defaultTransform: { scale: 82, x: 0, y: 18 },
    defaultLighting: { brightness: 110, shadow: 42, temperature: 60 }
  },
  {
    id: 'city',
    labelKey: 'productComposition.scenes.city',
    descriptionKey: 'productComposition.sceneDescriptions.city',
    promptKey: 'productComposition.scenePrompts.city',
    defaultTransform: { scale: 88, x: 12, y: 8 },
    defaultLighting: { brightness: 96, shadow: 50, temperature: 46 }
  },
  {
    id: 'livingRoom',
    labelKey: 'productComposition.scenes.livingRoom',
    descriptionKey: 'productComposition.sceneDescriptions.livingRoom',
    promptKey: 'productComposition.scenePrompts.livingRoom',
    defaultTransform: { scale: 86, x: -8, y: 16 },
    defaultLighting: { brightness: 100, shadow: 58, temperature: 54 }
  },
  {
    id: 'cafe',
    labelKey: 'productComposition.scenes.cafe',
    descriptionKey: 'productComposition.sceneDescriptions.cafe',
    promptKey: 'productComposition.scenePrompts.cafe',
    defaultTransform: { scale: 84, x: 0, y: 12 },
    defaultLighting: { brightness: 98, shadow: 55, temperature: 58 }
  },
  {
    id: 'minimalist',
    labelKey: 'productComposition.scenes.minimalist',
    descriptionKey: 'productComposition.sceneDescriptions.minimalist',
    promptKey: 'productComposition.scenePrompts.minimalist',
    defaultTransform: { scale: 92, x: 0, y: 0 },
    defaultLighting: { brightness: 110, shadow: 24, temperature: 50 }
  },
  {
    id: 'luxury',
    labelKey: 'productComposition.scenes.luxury',
    descriptionKey: 'productComposition.sceneDescriptions.luxury',
    promptKey: 'productComposition.scenePrompts.luxury',
    defaultTransform: { scale: 80, x: 0, y: 22 },
    defaultLighting: { brightness: 90, shadow: 68, temperature: 58 }
  }
] as const

const defaultTransform: ProductTransform = {
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0
}

const defaultLighting: Lighting = {
  brightness: 100,
  shadow: 50,
  temperature: 50
}

const defaultBlend: Blend = {
  mode: 'normal',
  feather: 0
}

export const useProductCompositionStore = create<ProductCompositionState>()(
  persist(
    (set, get) => ({
      productImage: null,
      scenePrompt: '',
      sceneTemplate: null,
      productTransform: { ...defaultTransform },
      lighting: { ...defaultLighting },
      blend: { ...defaultBlend },
      result: null,
      isProcessing: false,
      error: null,
      providerId: '',
      model: '',

      setProductImage: (img) => set({ productImage: img, result: null }),

      setScene: (template, prompt, options) =>
        set((state) => ({
          sceneTemplate: template,
          scenePrompt: prompt,
          result: null,
          productTransform: options?.transform
            ? { ...state.productTransform, ...options.transform }
            : state.productTransform,
          lighting: options?.lighting ? { ...state.lighting, ...options.lighting } : state.lighting
        })),

      setTransform: (t) =>
        set((state) => ({
          productTransform: { ...state.productTransform, ...t },
          result: null
        })),

      setLighting: (l) =>
        set((state) => ({
          lighting: { ...state.lighting, ...l },
          result: null
        })),

      setBlend: (b) =>
        set((state) => ({
          blend: { ...state.blend, ...b },
          result: null
        })),

      setProviderId: (providerId) => set({ providerId }),
      setModel: (model) => set({ model }),

      generate: async () => {
        const { productImage, scenePrompt, providerId, model } = get()
        if (!productImage || !scenePrompt.trim() || !providerId || !model) return

        set({ isProcessing: true, error: null, result: null })

        const base64 = productImage.includes(',') ? productImage.split(',')[1] : productImage

        try {
          const outputs = await runGeneration({
            params: {
              prompt: scenePrompt,
              model,
              providerId,
              referenceImages: [base64],
              referenceMode: 'fusion',
              referenceWeight: 0.6,
              n: 1,
              quality: 'high',
              size: '1024x1024'
            }
          })
          const urls = outputsToUrls(outputs)
          set({ result: urls[0] ?? null })
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Scene composition failed' })
        } finally {
          set({ isProcessing: false })
        }
      },

      reset: () =>
        set({
          productImage: null,
          scenePrompt: '',
          sceneTemplate: null,
          productTransform: { ...defaultTransform },
          lighting: { ...defaultLighting },
          blend: { ...defaultBlend },
          result: null,
          isProcessing: false,
          providerId: '',
          model: ''
        })
    }),
    {
      name: 'juhe-product-composition',
      partialize: (state) => ({
        productTransform: state.productTransform,
        lighting: state.lighting,
        blend: state.blend,
        providerId: state.providerId,
        model: state.model,
        sceneTemplate: state.sceneTemplate
      })
    }
  )
)
