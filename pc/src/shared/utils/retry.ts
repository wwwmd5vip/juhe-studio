/**
 * Retry utilities for async operations and external task polling.
 */

import type { GenerationTask } from '@shared/types/generation'

/**
 * Options controlling the retry behavior of {@link withRetry}.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (excluding the initial call). */
  maxRetries: number
  /** Base delay in milliseconds; actual delay is `baseDelayMs * 2^attempt`. */
  baseDelayMs: number
  /** Predicate deciding whether a given error should trigger a retry. Defaults to always retry. */
  shouldRetry?: (error: unknown) => boolean
  /** Optional callback invoked before each retry attempt. */
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Executes `fn` and retries on failure using exponential backoff.
 *
 * On each error the {@link RetryOptions.shouldRetry} predicate is consulted
 * (defaulting to always retry). When retrying, the function waits
 * `baseDelayMs * 2^attempt` milliseconds, invokes {@link RetryOptions.onRetry},
 * then retries — up to {@link RetryOptions.maxRetries} times. If all retries
 * are exhausted the last error is re-thrown.
 *
 * @typeParam T - The resolved value type of `fn`.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs, shouldRetry, onRetry } = options

  let attempt = 0
   
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries || (shouldRetry && !shouldRetry(error))) {
        throw error
      }

      const delay = baseDelayMs * 2 ** attempt
      onRetry?.(attempt, error)

      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt++
    }
  }
}

/**
 * Determines whether a generation task should be retried by querying an
 * external provider's task endpoint rather than re-submitting the request.
 *
 * Returns `true` when the task carries an `externalTaskId` and its
 * `externalProvider` matches `providerName`.
 *
 * @param task - The generation task to inspect.
 * @param providerName - The provider identifier to match against.
 */
export function shouldRetryWithExternalTask(task: GenerationTask, providerName: string): boolean {
  return task.externalTaskId != null && task.externalProvider === providerName
}
