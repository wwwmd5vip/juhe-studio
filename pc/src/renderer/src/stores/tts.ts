/**
 * TTS (Text-to-Speech) — Uses browser Web Speech API for real synthesis
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TTSVoice {
  id: string
  name: string
  language: string
  gender: 'male' | 'female' | 'neutral'
}

export interface TTSTask {
  id: string
  text: string
  voiceId: string
  speed: number
  pitch: number
  status: 'completed' | 'failed'
  duration?: number
  createdAt: number
  error?: string
}

interface TTSState {
  voices: TTSVoice[]
  tasks: TTSTask[]
  selectedVoiceId: string
  speed: number
  pitch: number
  isPlaying: boolean
  error: string | null

  loadVoices: () => void
  setVoice: (voiceId: string) => void
  setSpeed: (speed: number) => void
  setPitch: (pitch: number) => void
  generate: (text: string) => Promise<void>
  stop: () => void
  deleteTask: (taskId: string) => void
}

function inferGender(voice: SpeechSynthesisVoice): 'male' | 'female' | 'neutral' {
  const name = voice.name.toLowerCase()
  if (name.includes('male') || name.includes('guy') || name.includes('man') || name.includes('boy')) return 'male'
  if (name.includes('female') || name.includes('woman') || name.includes('girl') || name.includes('lady'))
    return 'female'
  return 'neutral'
}

function getVoices(): TTSVoice[] {
  const synth = window.speechSynthesis
  if (!synth) return []
  return synth.getVoices().map((v) => ({
    id: v.voiceURI,
    name: v.name,
    language: v.lang,
    gender: inferGender(v)
  }))
}

// Default voices used before real voices load
const FALLBACK_VOICES: TTSVoice[] = [{ id: 'default', name: 'System Default', language: 'zh-CN', gender: 'neutral' }]

export const useTTSStore = create<TTSState>()(
  persist(
    (set, get) => ({
      voices: FALLBACK_VOICES,
      tasks: [],
      selectedVoiceId: 'default',
      speed: 1.0,
      pitch: 1.0,
      isPlaying: false,
      error: null,

      loadVoices: () => {
        const realVoices = getVoices()
        if (realVoices.length > 0) {
          set({ voices: realVoices })
          // Auto-select Chinese voice if available
          const zhVoice = realVoices.find((v) => v.language.startsWith('zh'))
          if (zhVoice && get().selectedVoiceId === 'default') {
            set({ selectedVoiceId: zhVoice.id })
          }
        }
        // Listen for async voice loading
        window.speechSynthesis?.addEventListener(
          'voiceschanged',
          () => {
            const updated = getVoices()
            if (updated.length > 0) {
              set({ voices: updated })
              const zh = updated.find((v) => v.language.startsWith('zh'))
              if (zh && get().selectedVoiceId === 'default') {
                set({ selectedVoiceId: zh.id })
              }
            }
          },
          { once: true }
        )
      },

      setVoice: (voiceId) => set({ selectedVoiceId: voiceId }),

      setSpeed: (speed) => set({ speed: Math.min(Math.max(speed, 0.5), 2.0) }),

      setPitch: (pitch) => set({ pitch: Math.min(Math.max(pitch, 0.5), 2.0) }),

      generate: async (text) => {
        const { tasks, selectedVoiceId, speed, pitch } = get()
        if (!text.trim()) return

        const synth = window.speechSynthesis
        if (!synth) {
          set({ error: 'Speech synthesis not available' })
          return
        }

        // Stop any current speech
        synth.cancel()
        set({ isPlaying: false })

        const utterance = new SpeechSynthesisUtterance(text.trim())
        const voices = synth.getVoices()
        const voice = voices.find((v) => v.voiceURI === selectedVoiceId)
        if (voice) utterance.voice = voice
        utterance.rate = speed
        utterance.pitch = pitch

        const taskId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const startTime = Date.now()
        const newTask: TTSTask = {
          id: taskId,
          text: text.trim(),
          voiceId: selectedVoiceId,
          speed,
          pitch,
          status: 'completed',
          createdAt: Date.now()
        }

        utterance.addEventListener('start', () => {
          set({ isPlaying: true, error: null })
        })

        utterance.addEventListener('end', () => {
          const duration = (Date.now() - startTime) / 1000
          set((state) => ({
            isPlaying: false,
            tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, duration } : t))
          }))
        })

        utterance.addEventListener('error', (e) => {
          set((state) => ({
            isPlaying: false,
            error: `Speech error: ${e.error}`,
            tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'failed', error: e.error } : t))
          }))
        })

        set({ tasks: [newTask, ...tasks], error: null })
        synth.speak(utterance)
      },

      stop: () => {
        const synth = window.speechSynthesis
        if (synth) synth.cancel()
        set({ isPlaying: false })
      },

      deleteTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId)
        }))
      }
    }),
    {
      name: 'cherrystudio-tts',
      partialize: (state) => ({
        selectedVoiceId: state.selectedVoiceId,
        speed: state.speed,
        pitch: state.pitch,
        tasks: state.tasks
      })
    }
  )
)
