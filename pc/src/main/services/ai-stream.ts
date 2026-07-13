/**
 * AI stream consumption utility.
 * Centralizes the pattern of iterating over an AI SDK fullStream
 * and dispatching chunks to handlers.
 */

export interface StreamHandlers {
  onText?: (delta: string) => void
  onReasoning?: (delta: string) => void
  onError?: (error: unknown) => void
  onFinish?: (result: { usage?: unknown; finishReason?: string }) => void
}

/**
 * Consume an AI SDK streamText result, dispatching chunks to handlers.
 * Also catches delayed errors via consumeStream().
 */
export async function consumeStream(
  result: {
    fullStream: AsyncIterable<StreamChunk>
    consumeStream?: () => PromiseLike<void>
  },
  handlers: StreamHandlers
): Promise<void> {
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        if (chunk.text) {
          handlers.onText?.(chunk.text)
        }
        break
      case 'reasoning-start':
      case 'reasoning-delta':
        if (chunk.text) {
          handlers.onReasoning?.(chunk.text)
        }
        break
      case 'error':
        handlers.onError?.(chunk.error)
        break
      case 'finish':
        handlers.onFinish?.({
          usage: (chunk as { totalUsage?: unknown }).totalUsage,
          finishReason: (chunk as { finishReason?: string }).finishReason
        })
        break
    }
  }

  // Catch delayed errors that arrive after the stream ends
  if (result.consumeStream) {
    try {
      await result.consumeStream()
    } catch (e) {
      handlers.onError?.(e)
    }
  }
}

/**
 * Minimal chunk type for stream consumption.
 * The actual AI SDK chunk types are more complex, but we only need these fields.
 */
interface StreamChunk {
  type: string
  text?: string
  error?: unknown
  totalUsage?: unknown
  finishReason?: string
}
