/**
 * 收藏状态管理 (Zustand + persist)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { info, success } from '@/components/ui/toast'

export interface FavoriteItem {
  id: string
  type: 'image' | 'video' | 'text'
  prompt: string
  model?: string
  provider?: string
  base64?: string
  mediaType?: string
  url?: string
  width?: number
  height?: number
  createdAt: number
  favoritedAt: number
}

interface FavoritesState {
  items: FavoriteItem[]
  // Actions
  addFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void
  removeFavorite: (id: string) => void
  toggleFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void
  isFavorite: (id: string) => boolean
  getFavoritesByType: (type: FavoriteItem['type']) => FavoriteItem[]
  clearAll: () => void
}

// Maximum favorites to persist to prevent localStorage bloat
const MAX_FAVORITES = 50

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],

      addFavorite: (item) => {
        const exists = get().items.find((i) => i.id === item.id)
        if (exists) return
        const trimmedItem = {
          ...item,
          favoritedAt: Date.now()
        }
        set((state) => ({
          items: [trimmedItem, ...state.items].slice(0, MAX_FAVORITES)
        }))
        success({
          title: '已添加到收藏',
          description: '可在收藏页面查看',
          timeout: 2000
        })
      },

      removeFavorite: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id)
        }))
        info({
          title: '已取消收藏',
          timeout: 1500
        })
      },

      toggleFavorite: (item) => {
        const exists = get().items.find((i) => i.id === item.id)
        if (exists) {
          get().removeFavorite(item.id)
        } else {
          get().addFavorite(item)
        }
      },

      isFavorite: (id) => {
        return get().items.some((i) => i.id === id)
      },

      getFavoritesByType: (type) => {
        return get().items.filter((i) => i.type === type)
      },

      clearAll: () => {
        set({ items: [] })
      }
    }),
    {
      name: 'cherrystudio-favorites',
      partialize: (state) => ({
        // Ensure no base64 leaks into persisted state
        items: state.items.map((item) => ({
          ...item,
          base64: undefined
        }))
      })
    }
  )
)
