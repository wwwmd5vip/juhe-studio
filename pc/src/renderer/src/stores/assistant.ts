import { create } from 'zustand'

export type AssistantMode = 'ecommerce' | 'style' | 'lighting'

export interface AssistantState {
  mode: AssistantMode
  providerId: string
  model: string
  ecommerce: {
    productType: string
    scene: string
    style: string
    material: string
    audience: string
  }
  style: {
    source: string
    target: string
    intensity: number
    preservation: string
  }
  lighting: {
    lightType: string
    timeOfDay: string
    composition: string
    depthOfField: string
    colorTone: string
  }
  generatedPrompt: string
  setMode: (mode: AssistantMode) => void
  setProviderId: (id: string) => void
  setModel: (model: string) => void
  setEcommerceField: (field: string, value: string) => void
  setStyleField: (field: string, value: string | number) => void
  setLightingField: (field: string, value: string) => void
  generatePrompt: () => void
  resetFields: () => void
}

const productTypes = [
  { id: 'clothing', label: 'Clothing' },
  { id: 'digital', label: 'Digital' },
  { id: 'food', label: 'Food' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'home', label: 'Home' },
  { id: 'jewelry', label: 'Jewelry' }
]

const scenes = [
  { id: 'whiteBg', label: 'White Background' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'festival', label: 'Festival' }
]

const styles = [
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'tech', label: 'Tech' }
]

const materials = [
  { id: 'cotton', label: 'Cotton & Linen' },
  { id: 'metal', label: 'Metal' },
  { id: 'glass', label: 'Glass' },
  { id: 'wood', label: 'Wood' },
  { id: 'ceramic', label: 'Ceramic' }
]

const audiences = [
  { id: 'young', label: 'Young Adults' },
  { id: 'mid', label: 'Middle-aged' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'family', label: 'Families' },
  { id: 'professional', label: 'Professionals' }
]

const styleOptions = [
  { id: 'realistic', label: 'Realistic' },
  { id: 'oil', label: 'Oil Painting' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'anime', label: 'Anime' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'chinese', label: 'Chinese Traditional' }
]

const preservationOptions = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' }
]

const lightTypes = [
  { id: 'natural', label: 'Natural Light' },
  { id: 'soft', label: 'Soft Light' },
  { id: 'hard', label: 'Hard Light' },
  { id: 'backlight', label: 'Backlight' },
  { id: 'sidelight', label: 'Side Light' },
  { id: 'toplight', label: 'Top Light' },
  { id: 'rembrandt', label: 'Rembrandt Light' }
]

const timesOfDay = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'morning', label: 'Morning' },
  { id: 'noon', label: 'Noon' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'night', label: 'Night' }
]

const compositions = [
  { id: 'ruleOfThirds', label: 'Rule of Thirds' },
  { id: 'center', label: 'Center' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'frame', label: 'Frame' },
  { id: 'symmetry', label: 'Symmetry' },
  { id: 'goldenSpiral', label: 'Golden Spiral' }
]

const depthOfFields = [
  { id: 'shallow', label: 'Shallow' },
  { id: 'deep', label: 'Deep' }
]

const colorTones = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'bw', label: 'Black & White' },
  { id: 'highSaturation', label: 'High Saturation' },
  { id: 'lowSaturation', label: 'Low Saturation' }
]

export const productTypeOptions = productTypes
export const sceneOptions = scenes
export const styleOptionsList = styles
export const materialOptions = materials
export const audienceOptions = audiences
export const sourceStyleOptions = styleOptions
export const preservationOptionsList = preservationOptions
export const lightTypeOptions = lightTypes
export const timeOfDayOptions = timesOfDay
export const compositionOptions = compositions
export const depthOfFieldOptions = depthOfFields
export const colorToneOptions = colorTones

// "none" 表示用户未选择该参数，生成提示词时不包含
const NONE_VALUE = 'none'

export const useAssistantStore = create<AssistantState>((set, get) => ({
  mode: 'ecommerce',
  providerId: '',
  model: '',
  ecommerce: {
    productType: NONE_VALUE,
    scene: NONE_VALUE,
    style: NONE_VALUE,
    material: NONE_VALUE,
    audience: NONE_VALUE
  },
  style: {
    source: NONE_VALUE,
    target: NONE_VALUE,
    intensity: 50,
    preservation: NONE_VALUE
  },
  lighting: {
    lightType: NONE_VALUE,
    timeOfDay: NONE_VALUE,
    composition: NONE_VALUE,
    depthOfField: NONE_VALUE,
    colorTone: NONE_VALUE
  },
  generatedPrompt: '',

  setMode: (mode) => set({ mode, generatedPrompt: '' }),
  setProviderId: (providerId) => set({ providerId }),
  setModel: (model) => set({ model }),

  setEcommerceField: (field, value) =>
    set((state) => ({
      ecommerce: { ...state.ecommerce, [field]: value }
    })),

  setStyleField: (field, value) =>
    set((state) => ({
      style: { ...state.style, [field]: value }
    })),

  setLightingField: (field, value) =>
    set((state) => ({
      lighting: { ...state.lighting, [field]: value }
    })),

  resetFields: () =>
    set({
      ecommerce: {
        productType: NONE_VALUE,
        scene: NONE_VALUE,
        style: NONE_VALUE,
        material: NONE_VALUE,
        audience: NONE_VALUE
      },
      style: {
        source: NONE_VALUE,
        target: NONE_VALUE,
        intensity: 50,
        preservation: NONE_VALUE
      },
      lighting: {
        lightType: NONE_VALUE,
        timeOfDay: NONE_VALUE,
        composition: NONE_VALUE,
        depthOfField: NONE_VALUE,
        colorTone: NONE_VALUE
      },
      generatedPrompt: ''
    }),

  generatePrompt: () => {
    const { mode, ecommerce, style: styleState, lighting } = get()
    let prompt = ''

    if (mode === 'ecommerce') {
      const parts: string[] = []
      if (ecommerce.productType !== NONE_VALUE) {
        const pt = productTypes.find((p) => p.id === ecommerce.productType)?.label || ecommerce.productType
        parts.push(`Professional product photography of ${pt} product`)
      } else {
        parts.push('Professional product photography')
      }
      if (ecommerce.scene !== NONE_VALUE) {
        const sc = scenes.find((s) => s.id === ecommerce.scene)?.label || ecommerce.scene
        parts.push(`${sc} scene`)
      }
      if (ecommerce.style !== NONE_VALUE) {
        const st = styles.find((s) => s.id === ecommerce.style)?.label || ecommerce.style
        parts.push(`${st} style`)
      }
      if (ecommerce.material !== NONE_VALUE) {
        const mt = materials.find((m) => m.id === ecommerce.material)?.label || ecommerce.material
        parts.push(`${mt} material texture`)
      }
      if (ecommerce.audience !== NONE_VALUE) {
        const au = audiences.find((a) => a.id === ecommerce.audience)?.label || ecommerce.audience
        parts.push(`targeting ${au} audience`)
      }
      parts.push('high quality, commercial photography, detailed textures, perfect lighting, 8k resolution')
      prompt = parts.join(', ')
    } else if (mode === 'style') {
      const parts: string[] = []
      if (styleState.source !== NONE_VALUE && styleState.target !== NONE_VALUE) {
        const src = styleOptions.find((s) => s.id === styleState.source)?.label || styleState.source
        const tgt = styleOptions.find((s) => s.id === styleState.target)?.label || styleState.target
        parts.push(`Transform image from ${src} style to ${tgt} style`)
      } else if (styleState.target !== NONE_VALUE) {
        const tgt = styleOptions.find((s) => s.id === styleState.target)?.label || styleState.target
        parts.push(`Apply ${tgt} style`)
      } else {
        parts.push('Style transformation')
      }
      if (styleState.intensity > 0) {
        parts.push(`intensity ${styleState.intensity}%`)
      }
      if (styleState.preservation !== NONE_VALUE) {
        const pres = preservationOptions.find((p) => p.id === styleState.preservation)?.label || styleState.preservation
        parts.push(`content preservation ${pres}`)
      }
      parts.push('maintain structural integrity while applying artistic transformation, high quality render')
      prompt = parts.join(', ')
    } else if (mode === 'lighting') {
      const parts: string[] = []
      parts.push('Photography')
      if (lighting.lightType !== NONE_VALUE) {
        const lt = lightTypes.find((l) => l.id === lighting.lightType)?.label || lighting.lightType
        parts.push(`with ${lt} lighting`)
      }
      if (lighting.timeOfDay !== NONE_VALUE) {
        const td = timesOfDay.find((t) => t.id === lighting.timeOfDay)?.label || lighting.timeOfDay
        parts.push(`shot during ${td}`)
      }
      if (lighting.composition !== NONE_VALUE) {
        const comp = compositions.find((c) => c.id === lighting.composition)?.label || lighting.composition
        parts.push(`${comp} composition`)
      }
      if (lighting.depthOfField !== NONE_VALUE) {
        const dof = depthOfFields.find((d) => d.id === lighting.depthOfField)?.label || lighting.depthOfField
        parts.push(`${dof}`)
      }
      if (lighting.colorTone !== NONE_VALUE) {
        const ct = colorTones.find((c) => c.id === lighting.colorTone)?.label || lighting.colorTone
        parts.push(`${ct} color tone`)
      }
      parts.push('cinematic quality, professional photography, masterful lighting setup, 8k resolution')
      prompt = parts.join(', ')
    }

    set({ generatedPrompt: prompt })
  }
}))
