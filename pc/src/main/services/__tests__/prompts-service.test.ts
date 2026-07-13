import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──
// Variables used in hoisted vi.mock() must be declared via vi.hoisted()

const { mockStoreGet, mockListPrompts, mockGetPrompt, mockListCategories } = vi.hoisted(() => ({
  mockStoreGet: vi.fn(),
  mockListPrompts: vi.fn(),
  mockGetPrompt: vi.fn(),
  mockListCategories: vi.fn()
}))

vi.mock('../../stores/config', () => ({
  default: { get: mockStoreGet },
  getJuheBaseUrl: () => mockStoreGet('juheBaseUrl') ?? 'http://101.96.196.48:7075'
}))

vi.mock('@juhe-management/client', () => ({
  JuheClient: vi.fn().mockImplementation(() => ({
    listPrompts: mockListPrompts,
    getPrompt: mockGetPrompt,
    listPromptCategories: mockListCategories
  }))
}))

import { fetchFilters, fetchPrompt, fetchPrompts } from '../prompts-service'

// ── Helpers ──

function setupStore(apiKey = 'sk-test-valid-key', baseUrl?: string) {
  mockStoreGet.mockImplementation((key: string) => {
    if (key === 'auth.apiKey') return apiKey
    if (key === 'juheBaseUrl') return baseUrl ?? null
    return null
  })
}

// ── Tests ──

describe('prompts-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.JUHE_API_URL
    setupStore()
  })

  // ── fetchPrompts ──

  describe('fetchPrompts', () => {
    it('calls client.listPrompts and maps response', async () => {
      mockListPrompts.mockResolvedValue({
        data: [
          {
            id: 1,
            type: 'image',
            category_id: 5,
            title: '中式早餐',
            variables: { foo: 'bar' },
            tags: ['tag1', 'tag2'],
            status: 1,
            author_id: 10,
            created_at: '2025-01-01',
            updated_at: '2025-01-02'
          }
        ],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 }
      })

      const result = await fetchPrompts({ page: 1, pageSize: 20 })

      expect(mockListPrompts).toHaveBeenCalledWith('image', {
        page: 1,
        page_size: 20,
        category_id: undefined,
        tag: undefined,
        keyword: undefined
      })
      expect(result.data[0]).toMatchObject({
        id: 1,
        type: 'image',
        category_id: 5,
        title: '中式早餐',
        tags: ['tag1', 'tag2'],
        status: 1,
        author_id: 10
      })
      expect(result.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      })
    })

    it('calls client.listPrompts with filter params', async () => {
      mockListPrompts.mockResolvedValue({
        data: [],
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 }
      })

      await fetchPrompts({ category_id: 5, tag: 'food', keyword: 'test', pageSize: 50 })

      expect(mockListPrompts).toHaveBeenCalledWith('image', {
        page: undefined,
        page_size: 50,
        category_id: 5,
        tag: 'food',
        keyword: 'test'
      })
    })

    it('throws PROMPTS_SERVICE_ERROR when no API key is available', async () => {
      setupStore(null)

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_ERROR',
        message: '请先登录 Juhe Management 后使用提示词广场功能'
      })
    })

    it('throws PROMPTS_SERVICE_UNREACHABLE on network error', async () => {
      const error = new Error('ECONNREFUSED')
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      ;(error as any).code = 'ECONNREFUSED'
      mockListPrompts.mockRejectedValue(error)

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_UNREACHABLE'
      })
    })

    it('throws PROMPTS_SERVICE_UNREACHABLE on timeout', async () => {
      mockListPrompts.mockRejectedValue(new Error('timeout of 30000ms exceeded'))

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_UNREACHABLE'
      })
    })

    it('throws INVALID_PARAMETER on HTTP 400', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const axiosError: any = new Error('Bad Request')
      axiosError.response = { status: 400, data: { message: 'Invalid parameter' } }
      mockListPrompts.mockRejectedValue(axiosError)

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'INVALID_PARAMETER',
        status: 400
      })
    })

    it('throws PROMPT_NOT_FOUND on HTTP 404', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const axiosError: any = new Error('Not Found')
      axiosError.response = { status: 404, data: { message: 'Prompt not found' } }
      mockGetPrompt.mockRejectedValue(axiosError)

      await expect(fetchPrompt(999)).rejects.toMatchObject({
        code: 'PROMPT_NOT_FOUND',
        status: 404
      })
    })

    it('throws PROMPTS_SERVICE_ERROR on HTTP 500', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const axiosError: any = new Error('Server Error')
      axiosError.response = { status: 500, data: {} }
      mockListPrompts.mockRejectedValue(axiosError)

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_ERROR',
        status: 500
      })
    })

    it('throws PROMPTS_SERVICE_ERROR on unknown error', async () => {
      mockListPrompts.mockRejectedValue(new Error('Something went wrong'))

      await expect(fetchPrompts({})).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_ERROR',
        message: 'Something went wrong'
      })
    })
  })

  // ── fetchPrompt ──

  describe('fetchPrompt', () => {
    it('returns mapped prompt detail with rendered content', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 2,
        type: 'image',
        category_id: 3,
        title: 'Test Prompt',
        content: 'This is a long content string that exceeds thirty characters limit test',
        variables: { style: 'anime' },
        tags: ['tag1'],
        status: 1,
        author_id: 10,
        created_at: '2025-01-01',
        updated_at: '2025-01-02'
      })

      const result = await fetchPrompt(2)

      expect(mockGetPrompt).toHaveBeenCalledWith(2)
      expect(result.item).toMatchObject({
        id: 2,
        type: 'image',
        category_id: 3,
        title: 'Test Prompt',
        content: 'This is a long content string that exceeds thirty characters limit test',
        tags: ['tag1'],
        status: 1
      })
      expect(result.rendered).toBe('This is a long content string that exceeds thirty characters limit test')
    })

    it('returns null fields as-is', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 3,
        type: 'image',
        category_id: 0,
        title: '',
        content: '',
        variables: null,
        tags: null,
        status: 0,
        author_id: 0,
        created_at: '',
        updated_at: ''
      })

      const result = await fetchPrompt(3)

      expect(result.item.title).toBe('')
      expect(result.item.tags).toBeNull()
      expect(result.item.content).toBe('')
    })
  })

  // ── fetchFilters ──

  describe('fetchFilters', () => {
    it('calls client.listPromptCategories and maps to types array', async () => {
      mockListCategories.mockResolvedValue({
        data: [
          { id: 1, name: '食品饮料', type: 'image', description: null, sort_order: 1, created_at: '', updated_at: '' },
          { id: 2, name: '美妆护肤', type: 'image', description: null, sort_order: 2, created_at: '', updated_at: '' }
        ],
        pagination: { page: 1, page_size: 20, total: 2, total_pages: 1 }
      })

      const result = await fetchFilters()

      expect(mockListCategories).toHaveBeenCalledWith('image')
      expect(result).toEqual({
        types: ['食品饮料', '美妆护肤']
      })
    })

    it('throws PROMPTS_SERVICE_UNREACHABLE on network error', async () => {
      mockListCategories.mockRejectedValue(new Error('fetch failed'))

      await expect(fetchFilters()).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_UNREACHABLE'
      })
    })

    it('throws PROMPTS_SERVICE_ERROR on HTTP 503', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      const axiosError: any = new Error('Service Unavailable')
      axiosError.response = { status: 503, data: { message: 'Service unavailable' } }
      mockListCategories.mockRejectedValue(axiosError)

      await expect(fetchFilters()).rejects.toMatchObject({
        code: 'PROMPTS_SERVICE_ERROR',
        status: 503,
        message: 'Service unavailable'
      })
    })
  })
})
