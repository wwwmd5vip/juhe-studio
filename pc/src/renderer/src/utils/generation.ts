/**
 * Generation utility — pure async functions for creating + polling generation tasks.
 * Usable from Zustand stores (no React dependency).
 */

import type { GenerationOutput, GenerationParams, GenerationType } from '@shared/types/generation'

export interface RunGenerationOptions {
  type?: GenerationType
  params: GenerationParams
  onProgress?: (progress: number, stage: string) => void
  signal?: AbortSignal
  pollInterval?: number
  maxPolls?: number
}

export async function runGeneration(options: RunGenerationOptions): Promise<GenerationOutput[]> {
  const { params, type = 'image', onProgress, signal, pollInterval = 500, maxPolls = 600 } = options

  const { taskId } = await window.api.generation.create({ type, params })

  return new Promise<GenerationOutput[]>((resolve) => {
    let pollCount = 0

    const poll = setInterval(async () => {
      if (signal?.aborted) {
        clearInterval(poll)
        resolve([])
        return
      }

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

        onProgress?.(task.progress ?? 0, task.stage ?? '')

        if (task.status === 'completed') {
          clearInterval(poll)
          resolve(task.outputs ?? [])
        } else if (task.status === 'failed') {
          clearInterval(poll)
          resolve([])
        } else if (task.status === 'cancelled') {
          clearInterval(poll)
          resolve([])
        } else if (pollCount >= maxPolls) {
          clearInterval(poll)
          resolve([])
        }
      } catch {
        clearInterval(poll)
        resolve([])
      }
    }, pollInterval)
  })
}

export function outputsToUrls(outputs: GenerationOutput[]): string[] {
  return outputs
    .filter((o) => o.url || o.base64)
    .map((o) => (o.url ? o.url : `data:${o.mediaType || 'image/png'};base64,${o.base64}`))
}
