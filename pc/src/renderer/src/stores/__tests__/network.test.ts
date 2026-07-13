import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const addEventListener = vi.fn()
const removeEventListener = vi.fn()
const setTimeoutMock = vi.fn((_cb: () => void, _ms?: number) => {
  // Do NOT invoke the callback — preventing infinite recursion from scheduleCheck().
  return 123 as unknown as ReturnType<typeof setTimeout>
})
const clearTimeoutMock = vi.fn()

vi.stubGlobal('window', {
  addEventListener,
  removeEventListener
})

vi.stubGlobal('navigator', {
  onLine: true
})

vi.stubGlobal('setTimeout', setTimeoutMock)
vi.stubGlobal('clearTimeout', clearTimeoutMock)

describe('network store', () => {
  beforeEach(async () => {
    addEventListener.mockClear()
    removeEventListener.mockClear()
    setTimeoutMock.mockClear()
    clearTimeoutMock.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates listener registration and cleans up', async () => {
    const { initNetworkListener } = await import('../network')

    const cleanup1 = initNetworkListener()
    const cleanup2 = initNetworkListener()

    expect(addEventListener).toHaveBeenCalledTimes(2)
    expect(setTimeoutMock).toHaveBeenCalled()
    // clearTimeout may be called by fetchOnline (abort timeout cleanup) depending on
    // whether fetch is available in the test environment.
    const clearCountBefore = clearTimeoutMock.mock.calls.length
    expect(removeEventListener).toHaveBeenCalledTimes(0)

    cleanup1()
    expect(removeEventListener).toHaveBeenCalledTimes(0)
    // After cleanup1 (refCount 2→1), no cleanup yet
    expect(clearTimeoutMock).toHaveBeenCalledTimes(clearCountBefore)

    cleanup2()
    expect(removeEventListener).toHaveBeenCalledTimes(2)
    // After cleanup2 (refCount 1→0), interval timeout is cleared
    expect(clearTimeoutMock.mock.calls.length).toBeGreaterThan(clearCountBefore)
  })
})
