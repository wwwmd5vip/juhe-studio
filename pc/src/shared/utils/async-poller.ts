/**
 * Generic async task poller.
 * Replaces the repeated polling loop pattern across video/aliyun/jimeng generation services.
 */

export type PollStatus = 'pending' | 'succeeded' | 'failed'

export interface PollOptions<T> {
  /** Check whether the polling should be cancelled (e.g. task aborted) */
  isCancelled: () => boolean
  /** Maximum number of polling attempts */
  maxAttempts: number
  /** Interval between polls in milliseconds */
  intervalMs: number
  /** Optional callback invoked on each poll attempt */
  onPoll?: (attempt: number) => void
  /** Determine the status from the polled data */
  checkStatus: (data: unknown) => PollStatus
  /** Extract the final result from the polled data */
  extractResult: (data: unknown) => T
}

/**
 * Poll a fetch function until it completes, fails, or times out.
 *
 * @param fetchFn Function that returns the polled data
 * @param options Poll configuration
 * @returns The extracted result
 * @throws Error if the task fails, is cancelled, or times out
 */
export async function pollUntilComplete<T>(
  fetchFn: () => Promise<{ data: unknown }>,
  options: PollOptions<T>
): Promise<T> {
  const { isCancelled, maxAttempts, intervalMs, onPoll, checkStatus, extractResult } = options

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isCancelled()) {
      throw new Error('Task was cancelled')
    }

    onPoll?.(attempt)

    const { data } = await fetchFn()
    const status = checkStatus(data)

    if (status === 'succeeded') {
      return extractResult(data)
    }

    if (status === 'failed') {
      const errorMsg =
        typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>).message || (data as Record<string, unknown>).msg || 'Task failed'
          : 'Task failed'
      throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Task failed')
    }

    // pending — wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Task timed out after ${maxAttempts} attempts`)
}
