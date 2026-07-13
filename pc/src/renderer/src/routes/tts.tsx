import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Clock, StopCircle, Trash2, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTTSStore } from '@/stores/tts'

export const Route = createFileRoute('/tts')({ component: TTSPage })

function TTSPage() {
  const { t } = useTranslation()
  const {
    voices,
    tasks,
    selectedVoiceId,
    speed,
    pitch,
    isPlaying,
    error,
    loadVoices,
    setVoice,
    setSpeed,
    setPitch,
    generate,
    stop,
    deleteTask
  } = useTTSStore()

  const [text, setText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load voices on mount
  useEffect(() => {
    loadVoices()
  }, [loadVoices])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId) || voices[0]

  const handleGenerate = () => {
    if (!text.trim()) return
    stop()
    generate(text)
  }

  return (
    <div className='h-[calc(100vh-3rem)] flex' style={{ background: 'var(--juhe-void)' }}>
      {/* Left Panel */}
      <div
        className='w-80 shrink-0 border-r flex flex-col'
        style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
      >
        <div className='p-4 border-b' style={{ borderColor: 'var(--juhe-border)' }}>
          <h1 className='text-lg font-bold flex items-center gap-2' style={{ color: 'var(--juhe-text)' }}>
            <Volume2 className='w-5 h-5' style={{ color: 'var(--juhe-cyan)' }} />
            {t('tts.title')}
          </h1>
        </div>

        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {/* Text Input */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
              {t('tts.textInput')}
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`
              }}
              placeholder={t('tts.textInput')}
              rows={4}
              className='w-full p-3 rounded-xl border resize-none text-sm'
              style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-void-2)', color: 'var(--juhe-text)' }}
            />
          </div>

          {/* Voice Selector */}
          <div className='space-y-1.5' ref={dropdownRef}>
            <label className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
              {t('tts.voice')}
            </label>
            <button
              type='button'
              onClick={() => setShowDropdown(!showDropdown)}
              className='w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors'
              style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-void-2)', color: 'var(--juhe-text)' }}
            >
              <span>{selectedVoice?.name || t('tts.voice')}</span>
              <ChevronDown className='w-4 h-4' style={{ color: 'var(--juhe-text-3)' }} />
            </button>
            {showDropdown && (
              <div
                className='absolute z-30 mt-1 w-64 max-h-48 overflow-y-auto rounded-xl border shadow-xl p-1'
                style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
              >
                {voices.map((v) => (
                  <button
                    key={v.id}
                    type='button'
                    onClick={() => {
                      setVoice(v.id)
                      setShowDropdown(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      v.id === selectedVoiceId ? 'bg-[var(--juhe-cyan-glow)]' : 'hover:bg-[var(--juhe-surface-2)]'
                    }`}
                    style={{ color: v.id === selectedVoiceId ? 'var(--juhe-cyan)' : 'var(--juhe-text-2)' }}
                  >
                    <span>{v.name}</span>
                    <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                      {v.language}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Speed */}
          <div className='space-y-1.5'>
            <div className='flex justify-between'>
              <label className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
                {t('tts.speed')}
              </label>
              <span className='text-xs font-mono' style={{ color: 'var(--juhe-cyan)' }}>
                {speed.toFixed(1)}x
              </span>
            </div>
            <input
              type='range'
              min={0.5}
              max={2}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className='w-full h-2 rounded-full appearance-none cursor-pointer'
              style={{
                background: `linear-gradient(to right, var(--juhe-cyan) ${((speed - 0.5) / 1.5) * 100}%, var(--juhe-surface-2) 0)`
              }}
            />
          </div>

          {/* Pitch */}
          <div className='space-y-1.5'>
            <div className='flex justify-between'>
              <label className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
                {t('tts.pitch')}
              </label>
              <span className='text-xs font-mono' style={{ color: 'var(--juhe-cyan)' }}>
                {pitch.toFixed(1)}
              </span>
            </div>
            <input
              type='range'
              min={0.5}
              max={2}
              step={0.1}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className='w-full h-2 rounded-full appearance-none cursor-pointer'
              style={{
                background: `linear-gradient(to right, var(--juhe-cyan) ${((pitch - 0.5) / 1.5) * 100}%, var(--juhe-surface-2) 0)`
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className='text-xs p-2 rounded-lg'
              style={{ color: 'var(--juhe-magenta)', background: 'rgba(255,100,100,0.05)' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Generate / Stop */}
        <div className='p-4 border-t' style={{ borderColor: 'var(--juhe-border)' }}>
          <button
            type='button'
            onClick={isPlaying ? stop : handleGenerate}
            disabled={!text.trim() && !isPlaying}
            className='w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2'
            style={{
              background: isPlaying
                ? 'var(--juhe-magenta)'
                : text.trim()
                  ? 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-violet))'
                  : 'var(--juhe-surface-2)',
              color: isPlaying || text.trim() ? 'white' : 'var(--juhe-text-3)',
              cursor: text.trim() || isPlaying ? 'pointer' : 'not-allowed'
            }}
          >
            {isPlaying ? (
              <>
                <StopCircle className='w-4 h-4' />
                {t('common.stop')}
              </>
            ) : (
              <>
                <Volume2 className='w-4 h-4' />
                {t('tts.generate')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel — History */}
      <div className='flex-1 flex flex-col min-w-0'>
        <div className='flex-1 overflow-y-auto p-5'>
          <div className='flex items-center gap-2 mb-4'>
            <Clock className='w-4 h-4' style={{ color: 'var(--juhe-text-3)' }} />
            <h2 className='text-sm font-semibold' style={{ color: 'var(--juhe-text)' }}>
              {t('nav.history')}
            </h2>
            <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
              ({tasks.length})
            </span>
          </div>

          {tasks.length === 0 ? (
            <div
              className='flex flex-col items-center justify-center h-48 rounded-xl border border-dashed'
              style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface-2)' }}
            >
              <Volume2 className='w-10 h-10 mb-2 opacity-15' style={{ color: 'var(--juhe-text-3)' }} />
              <p className='text-sm' style={{ color: 'var(--juhe-text-3)' }}>
                {t('tts.noAudio')}
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className='flex items-center gap-3 p-3 rounded-xl border transition-colors'
                  style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface-2)/30' }}
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm truncate' style={{ color: 'var(--juhe-text)' }}>
                      {task.text}
                    </p>
                    <div className='flex items-center gap-2 mt-1'>
                      <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                        {task.voiceId}
                      </span>
                      <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                        ·
                      </span>
                      <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                        {task.speed}x
                      </span>
                      {task.duration && (
                        <>
                          <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                            ·
                          </span>
                          <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
                            {task.duration.toFixed(1)}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      onClick={() => {
                        stop()
                        generate(task.text)
                      }}
                      className='p-2 rounded-lg transition-colors hover:bg-[var(--juhe-surface-2)]'
                      style={{ color: 'var(--juhe-cyan)' }}
                      title={t('tts.generate')}
                    >
                      <Volume2 className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={() => deleteTask(task.id)}
                      className='p-2 rounded-lg transition-colors hover:bg-[var(--juhe-surface-2)]'
                      style={{ color: 'var(--juhe-magenta)' }}
                      title={t('common.delete')}
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
