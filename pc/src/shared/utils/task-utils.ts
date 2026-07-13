import type { GenerationTask } from '@shared/types/generation'

/**
 * Update a generation task's current stage and progress, then notify listeners.
 *
 * @param task - The task to mutate.
 * @param stage - Human-readable label for the current processing stage.
 * @param progress - Completion percentage in the range 0–100.
 */
export function updateTaskProgress(task: GenerationTask, stage: string, progress: number): void {
  task.stage = stage
  task.progress = progress
  ;(task as GenerationTask & { emitUpdate?: () => void }).emitUpdate?.()
}

/**
 * Return a shallow copy of `params` without binary/image payload fields.
 *
 * Strips `referenceImages`, `referenceWeights`, `firstFrame`, and `lastFrame`
 * so the remaining object is safe to serialize (e.g. for logging or transport).
 *
 * @param params - The original parameters object.
 * @returns A new object containing only the non-binary fields.
 */
export function stripBinaryDataFromParams(params: Record<string, unknown>): Record<string, unknown> {
  const { referenceImages, referenceWeights, firstFrame, lastFrame, ...rest } = params
  return rest
}
