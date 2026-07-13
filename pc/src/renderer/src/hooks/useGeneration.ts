/**
 * useGeneration — 封装图片/视频生成任务的创建、轮询、结果收集
 *
 * 使用方式：
 *   const { generate, isGenerating, progress, error } = useGeneration()
 *   const results = await generate({ prompt, referenceImages, ... })
 */

import type { GenerationOutput, GenerationParams, GenerationType } from '@shared/types/generation'
import { useCallback, useRef, useState } from 'react'

export interface GenerateOptions {
  type?: GenerationType
  params: GenerationParams
}

export interface GenerateProgress {
  status: string
  progress: number
  stage: string
}

export function useGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cancel = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setIsGenerating(false)
    setProgress(0)
  }, [])

  const generate = useCallback(
    async (options: GenerateOptions): Promise<GenerationOutput[]> => {
      cancel()
      setIsGenerating(true)
      setProgress(0)
      setError(null)

      const type = options.type ?? 'image'

      try {
        const { taskId } = await window.api.generation.create({ type, params: options.params })

        return await new Promise<GenerationOutput[]>((resolve) => {
          let pollCount = 0
          const maxPolls = 600 // 5 min at 500ms

          pollRef.current = setInterval(async () => {
            pollCount++

            try {
              const task = (await window.api.generation.get(taskId)) as {
                status: string
                progress?: number
                stage?: string
                outputs?: GenerationOutput[]
                error?: string
              } | null

              if (!task) return

              setProgress(task.progress ?? 0)

              if (task.status === 'completed') {
                if (pollRef.current) clearInterval(pollRef.current)
                pollRef.current = null
                setIsGenerating(false)
                setProgress(100)
                resolve(task.outputs ?? [])
              } else if (task.status === 'failed') {
                if (pollRef.current) clearInterval(pollRef.current)
                pollRef.current = null
                setIsGenerating(false)
                setError(task.error ?? 'Generation failed')
                resolve([] as GenerationOutput[])
              } else if (task.status === 'cancelled') {
                if (pollRef.current) clearInterval(pollRef.current)
                pollRef.current = null
                setIsGenerating(false)
                setError('Task cancelled')
                resolve([] as GenerationOutput[])
              } else if (pollCount >= maxPolls) {
                if (pollRef.current) clearInterval(pollRef.current)
                pollRef.current = null
                setIsGenerating(false)
                setError('Generation timed out after 5 minutes')
                resolve([] as GenerationOutput[])
              }
            } catch (err) {
              if (pollRef.current) clearInterval(pollRef.current)
              pollRef.current = null
              setIsGenerating(false)
              setError(err instanceof Error ? err.message : 'Unknown error')
              resolve([] as GenerationOutput[])
            }
          }, 500)
        })
      } catch (err) {
        setIsGenerating(false)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        return [] as GenerationOutput[]
      }
    },
    [cancel]
  )

  return {
    generate,
    cancel,
    isGenerating,
    progress,
    error,
    setError
  }
}

/**
 * 将 GenerationOutput[] 转换为可显示的 URL 列表
 */
export function outputsToUrls(outputs: GenerationOutput[]): string[] {
  return outputs
    .filter((o) => o.url || o.base64)
    .map((o) => (o.url ? o.url : `data:${o.mediaType || 'image/png'};base64,${o.base64}`))
}
