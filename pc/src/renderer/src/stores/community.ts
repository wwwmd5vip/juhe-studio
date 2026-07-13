/**
 * Community Template Sharing Store (Zustand + persist)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CommunityTemplate {
  id: string
  title: string
  description: string
  prompt: string
  tags: string[]
  author: string
  authorAvatar?: string
  likes: number
  downloads: number
  createdAt: string
  category: 'portrait' | 'landscape' | 'product' | 'anime' | 'concept' | 'other'
  preview?: string
}

interface CommunityState {
  templates: CommunityTemplate[]
  myTemplates: CommunityTemplate[]
  filter: { category: string; sort: 'popular' | 'newest' | 'downloads' }
  searchQuery: string
  isLoading: boolean
  error: string | null
  setFilter: (filter: Partial<CommunityState['filter']>) => void
  setSearchQuery: (query: string) => void
  likeTemplate: (id: string) => void
  downloadTemplate: (id: string) => void
  uploadTemplate: (template: Omit<CommunityTemplate, 'id' | 'likes' | 'downloads' | 'createdAt'>) => void
  deleteMyTemplate: (id: string) => void
}

const seedTemplates: CommunityTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Ethereal Portrait',
    description: 'Soft natural light portrait with dreamy bokeh background',
    prompt:
      'A portrait of a young woman, soft natural window light, shallow depth of field, dreamy bokeh background, pastel tones, editorial photography style, 85mm lens',
    tags: ['portrait', 'soft light', 'bokeh', 'editorial'],
    author: 'Alice Chen',
    likes: 342,
    downloads: 1280,
    createdAt: '2024-11-15T08:30:00Z',
    category: 'portrait'
  },
  {
    id: 'tpl-2',
    title: 'Cyberpunk Cityscape',
    description: 'Neon-lit futuristic city at night with rain reflections',
    prompt:
      'Cyberpunk cityscape at night, neon signs reflecting on wet streets, towering skyscrapers, flying vehicles, rain, volumetric fog, cinematic composition, 8k detail',
    tags: ['cyberpunk', 'city', 'neon', 'night'],
    author: 'Neo Zhang',
    likes: 891,
    downloads: 3200,
    createdAt: '2024-10-20T14:00:00Z',
    category: 'concept'
  },
  {
    id: 'tpl-3',
    title: 'Serene Mountain Lake',
    description: 'Peaceful alpine lake with mirror reflections at sunrise',
    prompt:
      'Alpine mountain lake at sunrise, perfect mirror reflection, snow-capped peaks, golden hour light, mist rising from water, landscape photography, ultra wide angle',
    tags: ['landscape', 'mountain', 'sunrise', 'reflection'],
    author: 'Mountain Walker',
    likes: 567,
    downloads: 1890,
    createdAt: '2024-11-01T06:00:00Z',
    category: 'landscape'
  },
  {
    id: 'tpl-4',
    title: 'Minimalist Product Shot',
    description: 'Clean white background product photography with soft shadows',
    prompt:
      'Minimalist product photography, sleek electronic device on white background, soft gradient shadows, studio lighting, high-end commercial style, sharp focus',
    tags: ['product', 'minimalist', 'commercial', 'studio'],
    author: 'Studio Pro',
    likes: 234,
    downloads: 950,
    createdAt: '2024-11-10T10:00:00Z',
    category: 'product'
  },
  {
    id: 'tpl-5',
    title: 'Anime Character Design',
    description: 'Vibrant anime-style character with detailed clothing',
    prompt:
      'Anime character design, vibrant colors, detailed clothing with intricate patterns, expressive eyes, dynamic pose, clean line art, studio ghibli inspired background',
    tags: ['anime', 'character', 'vibrant', 'illustration'],
    author: 'Manga Artist',
    likes: 1205,
    downloads: 4500,
    createdAt: '2024-09-15T16:30:00Z',
    category: 'anime'
  },
  {
    id: 'tpl-6',
    title: 'Fantasy Forest Creature',
    description: 'Mystical creature in an enchanted bioluminescent forest',
    prompt:
      'A mystical forest creature with glowing antlers, bioluminescent mushrooms and plants surrounding it, dappled moonlight filtering through ancient trees, fantasy art, highly detailed',
    tags: ['fantasy', 'creature', 'bioluminescent', 'forest'],
    author: 'Fantasy Dreamer',
    likes: 678,
    downloads: 2100,
    createdAt: '2024-10-05T20:00:00Z',
    category: 'concept'
  },
  {
    id: 'tpl-7',
    title: 'Street Fashion Portrait',
    description: 'Urban street style portrait with bold colors',
    prompt:
      'Street fashion portrait, urban backdrop with graffiti walls, bold colorful outfit, confident pose, natural daylight with harsh shadows, documentary style photography',
    tags: ['portrait', 'street', 'fashion', 'urban'],
    author: 'City Lens',
    likes: 445,
    downloads: 1320,
    createdAt: '2024-11-08T12:00:00Z',
    category: 'portrait'
  },
  {
    id: 'tpl-8',
    title: 'Desert Dunes at Sunset',
    description: 'Golden sand dunes with dramatic shadow patterns',
    prompt:
      'Vast desert sand dunes at sunset, dramatic shadow patterns, warm golden and orange tones, lone camel silhouette in distance, landscape photography, telephoto compression',
    tags: ['landscape', 'desert', 'sunset', 'golden hour'],
    author: 'Desert Rover',
    likes: 389,
    downloads: 1100,
    createdAt: '2024-10-28T17:00:00Z',
    category: 'landscape'
  },
  {
    id: 'tpl-9',
    title: 'Cosmetic Product Flat Lay',
    description: 'Elegant flat lay arrangement of beauty products',
    prompt:
      'Cosmetic product flat lay, elegant arrangement of skincare bottles and jars, marble surface, dried flowers and petals scattered, soft diffused light, beauty commercial photography',
    tags: ['product', 'cosmetic', 'flat lay', 'beauty'],
    author: 'Beauty Shot',
    likes: 312,
    downloads: 980,
    createdAt: '2024-11-12T09:00:00Z',
    category: 'product'
  },
  {
    id: 'tpl-10',
    title: 'Mecha Battle Scene',
    description: 'Intense mecha robot battle in a destroyed city',
    prompt:
      'Epic mecha robot battle scene, giant robots clashing in destroyed futuristic city, sparks and debris flying, dramatic lighting, dynamic action pose, anime mecha style, highly detailed mechanical parts',
    tags: ['anime', 'mecha', 'action', 'sci-fi'],
    author: 'Mecha Fan',
    likes: 756,
    downloads: 2800,
    createdAt: '2024-09-25T15:00:00Z',
    category: 'anime'
  },
  {
    id: 'tpl-11',
    title: 'Abstract Fluid Art',
    description: 'Colorful fluid art with marble-like patterns',
    prompt:
      'Abstract fluid art, swirling colors of teal, gold, and deep purple, marble-like patterns, glossy resin finish, macro photography style, vibrant and hypnotic',
    tags: ['abstract', 'fluid art', 'colorful', 'macro'],
    author: 'Color Flow',
    likes: 278,
    downloads: 890,
    createdAt: '2024-11-02T11:00:00Z',
    category: 'other'
  },
  {
    id: 'tpl-12',
    title: 'Steampunk Airship',
    description: 'Detailed steampunk airship floating above Victorian city',
    prompt:
      'Steampunk airship with brass gears and steam pipes, floating above Victorian era city, sunset clouds, highly detailed mechanical design, concept art style, dramatic perspective',
    tags: ['steampunk', 'airship', 'concept art', 'victorian'],
    author: 'Gear Head',
    likes: 523,
    downloads: 1750,
    createdAt: '2024-10-15T13:00:00Z',
    category: 'concept'
  }
]

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, _get) => ({
      templates: seedTemplates,
      myTemplates: [],
      filter: { category: 'all', sort: 'popular' },
      searchQuery: '',
      isLoading: false,
      error: null,

      setFilter: (filter) => {
        set((state) => ({
          filter: { ...state.filter, ...filter }
        }))
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      likeTemplate: (id) => {
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, likes: t.likes + 1 } : t)),
          myTemplates: state.myTemplates.map((t) => (t.id === id ? { ...t, likes: t.likes + 1 } : t))
        }))
      },

      downloadTemplate: (id) => {
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, downloads: t.downloads + 1 } : t)),
          myTemplates: state.myTemplates.map((t) => (t.id === id ? { ...t, downloads: t.downloads + 1 } : t))
        }))
      },

      uploadTemplate: (template) => {
        const newTemplate: CommunityTemplate = {
          ...template,
          id: `tpl-${Date.now()}`,
          likes: 0,
          downloads: 0,
          createdAt: new Date().toISOString()
        }
        set((state) => ({
          templates: [newTemplate, ...state.templates],
          myTemplates: [newTemplate, ...state.myTemplates]
        }))
      },

      deleteMyTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
          myTemplates: state.myTemplates.filter((t) => t.id !== id)
        }))
      }
    }),
    {
      name: 'cherrystudio-community',
      partialize: (state) => ({ myTemplates: state.myTemplates })
    }
  )
)
