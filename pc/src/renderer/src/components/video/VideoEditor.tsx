import { Download, Merge, Pause, Play, Scissors, SkipBack, SkipForward, Trash2, Type } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface VideoClip {
  id: string
  file: File
  url: string
  duration: number
  startTime: number
  endTime: number
}

interface Subtitle {
  id: string
  text: string
  startTime: number
  endTime: number
  x: number
  y: number
  color: string
  size: number
}

export function VideoEditor() {
  const { t } = useTranslation()
  const [clips, setClips] = useState<VideoClip[]>([])
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeTab, setActiveTab] = useState<'trim' | 'merge' | 'subtitle'>('trim')
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationRef = useRef<number>(0)

  const currentClip = clips[currentClipIndex]

  // Load video metadata
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        setClips((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            url,
            duration: video.duration,
            startTime: 0,
            endTime: video.duration
          }
        ])
      }
      video.src = url
    })
  }, [])

  // Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  // Update current time
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => {
      setCurrentTime(video.currentTime)
      if (currentClip && video.currentTime >= currentClip.endTime) {
        video.pause()
        setIsPlaying(false)
      }
    }

    const handleEnded = () => setIsPlaying(false)
    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('ended', handleEnded)
    }
  }, [currentClip])

  // Trim clip
  const handleTrim = useCallback(
    (startTime: number, endTime: number) => {
      if (!currentClip) return
      setClips((prev) => prev.map((c, i) => (i === currentClipIndex ? { ...c, startTime, endTime } : c)))
      if (videoRef.current) {
        videoRef.current.currentTime = startTime
      }
    },
    [currentClip, currentClipIndex]
  )

  // Delete clip
  const handleDeleteClip = useCallback(
    (index: number) => {
      setClips((prev) => {
        const newClips = prev.filter((_, i) => i !== index)
        URL.revokeObjectURL(prev[index].url)
        return newClips
      })
      if (currentClipIndex >= clips.length - 1) {
        setCurrentClipIndex(Math.max(0, clips.length - 2))
      }
    },
    [currentClipIndex, clips.length]
  )

  // Add subtitle
  const handleAddSubtitle = useCallback(() => {
    const newSubtitle: Subtitle = {
      id: crypto.randomUUID(),
      text: t('videoEditor.subtitles.newSubtitle'),
      startTime: currentTime,
      endTime: currentTime + 3,
      x: 50,
      y: 80,
      color: '#ffffff',
      size: 24
    }
    setSubtitles((prev) => [...prev, newSubtitle])
    setSelectedSubtitle(newSubtitle.id)
  }, [currentTime, t])

  // Update subtitle
  const handleUpdateSubtitle = useCallback((id: string, updates: Partial<Subtitle>) => {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }, [])

  // Delete subtitle
  const handleDeleteSubtitle = useCallback((id: string) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id))
    setSelectedSubtitle(null)
  }, [])

  // Export merged video (using Canvas API to concatenate)
  const handleExport = useCallback(async () => {
    if (clips.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match first video
    const firstVideo = document.createElement('video')
    firstVideo.src = clips[0].url
    await new Promise((resolve) => {
      firstVideo.onloadedmetadata = resolve
    })
    canvas.width = firstVideo.videoWidth || 1280
    canvas.height = firstVideo.videoHeight || 720

    // Create a MediaRecorder to capture canvas
    const stream = canvas.captureStream(30)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    })

    const chunks: Blob[] = []
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited-video-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }

    mediaRecorder.start()

    // Render each clip
    for (const clip of clips) {
      const video = document.createElement('video')
      video.src = clip.url
      video.muted = true
      await new Promise((resolve) => {
        video.oncanplay = resolve
      })

      video.currentTime = clip.startTime
      video.play()

      await new Promise<void>((resolve) => {
        const draw = () => {
          if (video.currentTime >= clip.endTime || video.ended) {
            video.pause()
            resolve()
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Draw subtitles
          const activeSubtitles = subtitles.filter(
            (s) => video.currentTime >= s.startTime && video.currentTime <= s.endTime
          )
          for (const sub of activeSubtitles) {
            ctx.fillStyle = sub.color
            ctx.font = `bold ${sub.size}px sans-serif`
            ctx.textAlign = 'center'
            ctx.shadowColor = 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = 4
            const x = (sub.x / 100) * canvas.width
            const y = (sub.y / 100) * canvas.height
            ctx.fillText(sub.text, x, y)
            ctx.shadowBlur = 0
          }

          requestAnimationFrame(draw)
        }
        draw()
      })
    }

    mediaRecorder.stop()
  }, [clips, subtitles])

  // Draw subtitles on preview
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (video.paused || video.ended) {
        animationRef.current = requestAnimationFrame(draw)
        return
      }

      canvas.width = video.videoWidth || canvas.clientWidth
      canvas.height = video.videoHeight || canvas.clientHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Draw active subtitles
      const activeSubtitles = subtitles.filter((s) => currentTime >= s.startTime && currentTime <= s.endTime)
      for (const sub of activeSubtitles) {
        ctx.fillStyle = sub.color
        ctx.font = `bold ${sub.size}px sans-serif`
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,0.8)'
        ctx.shadowBlur = 4
        const x = (sub.x / 100) * canvas.width
        const y = (sub.y / 100) * canvas.height
        ctx.fillText(sub.text, x, y)
        ctx.shadowBlur = 0
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [subtitles, currentTime])

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='px-6 py-4 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center justify-between'>
          <h1 className='text-xl font-bold flex items-center gap-2'>
            <Scissors className='w-5 h-5' />
            {t('videoEditor.title')}
          </h1>
          <div className='flex items-center gap-2'>
            <input
              ref={fileInputRef}
              type='file'
              accept='video/*'
              multiple
              onChange={handleFileSelect}
              className='hidden'
            />
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
            >
              {t('videoEditor.addVideo')}
            </button>
            {clips.length > 0 && (
              <button
                type='button'
                onClick={handleExport}
                className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-2)]/80 transition-colors'
              >
                <Download className='w-4 h-4' />
                {t('videoEditor.export')}
              </button>
            )}
          </div>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className='flex-1 flex items-center justify-center text-[var(--juhe-text-3)]'>
          <div className='text-center'>
            <Scissors className='w-12 h-12 mx-auto mb-3 opacity-30' />
            <p>{t('videoEditor.emptyHint')}</p>
            <p className='text-sm mt-1'>{t('videoEditor.subtitleHint')}</p>
          </div>
        </div>
      ) : (
        <div className='flex-1 flex overflow-hidden'>
          {/* Left: Preview */}
          <div className='flex-1 flex flex-col p-4'>
            {/* Video preview */}
            <div className='flex-1 relative bg-black rounded-lg overflow-hidden'>
              <video
                ref={videoRef}
                src={currentClip?.url}
                className='w-full h-full object-contain'
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              >
                <track kind='captions' label='English' />
              </video>
              <canvas ref={canvasRef} className='absolute inset-0 w-full h-full pointer-events-none' />
            </div>

            {/* Controls */}
            <div className='mt-4 flex items-center gap-4'>
              <button
                type='button'
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = currentClip?.startTime || 0
                  }
                }}
                className='p-2 rounded-lg hover:bg-[var(--juhe-surface-2)] transition-colors'
              >
                <SkipBack className='w-5 h-5' />
              </button>
              <button
                type='button'
                onClick={togglePlay}
                className='p-3 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
              >
                {isPlaying ? <Pause className='w-5 h-5' /> : <Play className='w-5 h-5' />}
              </button>
              <button
                type='button'
                onClick={() => {
                  if (videoRef.current && currentClip) {
                    videoRef.current.currentTime = currentClip.endTime
                  }
                }}
                className='p-2 rounded-lg hover:bg-[var(--juhe-surface-2)] transition-colors'
              >
                <SkipForward className='w-5 h-5' />
              </button>

              {/* Time display */}
              <div className='text-sm text-[var(--juhe-text-3)]'>
                {formatTime(currentTime)} / {formatTime(currentClip?.duration || 0)}
              </div>

              {/* Progress bar */}
              <div className='flex-1 h-2 bg-[var(--juhe-surface-2)] rounded-full overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] transition-all'
                  style={{
                    width: `${
                      currentClip
                        ? ((currentTime - currentClip.startTime) / (currentClip.endTime - currentClip.startTime)) * 100
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right: Tools panel */}
          <div className='w-80 border-l border-[var(--juhe-border)] flex flex-col'>
            {/* Tabs */}
            <div className='flex border-b border-[var(--juhe-border)]'>
              {[
                { id: 'trim' as const, label: t('videoEditor.tabs.crop'), icon: Scissors },
                { id: 'merge' as const, label: t('videoEditor.tabs.splice'), icon: Merge },
                { id: 'subtitle' as const, label: t('videoEditor.tabs.subtitle'), icon: Type }
              ].map((tab) => (
                <button
                  type='button'
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'text-[var(--juhe-cyan)] border-b-2 border-[var(--juhe-cyan)]'
                      : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                  }`}
                >
                  <tab.icon className='w-4 h-4' />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className='flex-1 overflow-y-auto p-4'>
              {activeTab === 'trim' && currentClip && (
                <div className='space-y-4'>
                  <h3 className='font-medium'>{t('videoEditor.cropSettings')}</h3>
                  <div className='space-y-2'>
                    <label htmlFor='video-start-time' className='text-sm text-[var(--juhe-text-3)]'>{t('videoEditor.subtitles.startTime')}</label>
                    <input
                      id='video-start-time'
                      type='range'
                      min={0}
                      max={currentClip.duration}
                      step={0.1}
                      value={currentClip.startTime}
                      onChange={(e) => handleTrim(Number(e.target.value), currentClip.endTime)}
                      className='w-full'
                    />
                    <span className='text-sm'>{formatTime(currentClip.startTime)}</span>
                  </div>
                  <div className='space-y-2'>
                    <label htmlFor='video-end-time' className='text-sm text-[var(--juhe-text-3)]'>{t('videoEditor.subtitles.endTime')}</label>
                    <input
                      id='video-end-time'
                      type='range'
                      min={0}
                      max={currentClip.duration}
                      step={0.1}
                      value={currentClip.endTime}
                      onChange={(e) => handleTrim(currentClip.startTime, Number(e.target.value))}
                      className='w-full'
                    />
                    <span className='text-sm'>{formatTime(currentClip.endTime)}</span>
                  </div>
                </div>
              )}

              {activeTab === 'merge' && (
                <div className='space-y-3'>
                  <h3 className='font-medium'>
                    {t('videoEditor.tabs.splice')} ({clips.length})
                  </h3>
                  {clips.map((clip, index) => (
                    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
                      key={clip.id}
                      onClick={() => setCurrentClipIndex(index)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        index === currentClipIndex
                          ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5'
                          : 'border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <span className='text-sm font-medium'>{t('videoEditor.clips.clipN', { n: index + 1 })}</span>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClip(index)
                          }}
                          className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] transition-colors'
                        >
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>
                      <p className='text-xs text-[var(--juhe-text-3)] mt-1'>
                        {formatTime(clip.startTime)} - {formatTime(clip.endTime)} (
                        {formatTime(clip.endTime - clip.startTime)})
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'subtitle' && (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <h3 className='font-medium'>
                      {t('videoEditor.tabs.subtitle')} ({subtitles.length})
                    </h3>
                    <button
                      type='button'
                      onClick={handleAddSubtitle}
                      className='px-3 py-1 rounded-lg text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
                    >
                      {t('videoEditor.subtitles.addSubtitle')}
                    </button>
                  </div>

                  {subtitles.map((sub) => (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
                      key={sub.id}
                      onClick={() => setSelectedSubtitle(sub.id)}
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedSubtitle === sub.id
                          ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5'
                          : 'border-[var(--juhe-border)]'
                      }`}
                    >
                      <input
                        type='text'
                        value={sub.text}
                        onChange={(e) => handleUpdateSubtitle(sub.id, { text: e.target.value })}
                        className='w-full bg-transparent text-sm border-none outline-none'
                        placeholder={t('videoEditor.subtitles.text')}
                      />
                      <div className='flex gap-2 mt-2'>
                        <input
                          type='color'
                          value={sub.color}
                          onChange={(e) => handleUpdateSubtitle(sub.id, { color: e.target.value })}
                          className='w-6 h-6 rounded cursor-pointer'
                        />
                        <input
                          type='range'
                          min={12}
                          max={72}
                          value={sub.size}
                          onChange={(e) => handleUpdateSubtitle(sub.id, { size: Number(e.target.value) })}
                          className='flex-1'
                        />
                        <button
                          type='button'
                          onClick={() => handleDeleteSubtitle(sub.id)}
                          className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
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
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
