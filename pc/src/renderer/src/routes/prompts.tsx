import { renderTemplate } from '@shared/ecommerce-workflow/utils'
import type { PromptTemplate } from '@shared/types/prompt-system'
import type { PromptDetail, PromptListItem } from '@shared/types/prompts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search, Sparkles, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FilterBar, { type FilterValue } from '@/components/prompts/FilterBar'
import Masonry from '@/components/prompts/Masonry'
import PromptLibraryCard from '@/components/prompts/PromptLibraryCard'
import VariableInputModal from '@/components/prompts/VariableInputModal'
import { error as toastError } from '@/components/ui/toast'
import { useChatStore } from '@/stores/chat'

export const Route = createFileRoute('/prompts')({
  component: PromptsPage
})

const DEFAULT_PAGE_SIZE = 20

function toPromptTemplate(item: PromptListItem, typeLabels: Record<string, string>): PromptTemplate {
  const typeLabel = typeLabels[item.type] || item.type
  const description = [typeLabel, ...(item.tags || [])].filter(Boolean).join(' · ')
  const now = new Date().toISOString()
  return {
    id: String(item.id),
    name: item.title || 'Untitled',
    description: description || '',
    prompt: '', // content not available in list — loaded on demand
    variables: [],
    category: item.type,
    tags: item.tags || [],
    example: undefined,
    createdAt: item.created_at || now,
    updatedAt: item.updated_at || now,
    usageCount: 0,
    coverImage: undefined,
    isFavorite: false
  }
}

function buildListFilters(value: FilterValue, page: number, pageSize: number) {
  const filters: {
    page?: number
    pageSize?: number
    type?: 'image' | 'agent' | 'package'
    keyword?: string
    category_id?: number
  } = {
    page,
    pageSize
  }
  if (value.type) filters.type = value.type
  if (value.keyword?.trim()) filters.keyword = value.keyword.trim()
  if (value.category_id) filters.category_id = value.category_id
  return filters
}

function PromptsPage() {
  const { t } = useTranslation()
  const createSession = useChatStore((s) => s.createSession)
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/prompts' })
  const [filters, setFilters] = useState<FilterValue>({ keyword: '' })
  const [debouncedKeyword, setDebouncedKeyword] = useState(filters.keyword)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<PromptListItem | null>(null)
  const [previewDetail, setPreviewDetail] = useState<PromptDetail | null>(null)
  const [previewRendered, setPreviewRendered] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [varModalOpen, setVarModalOpen] = useState(false)
  const [varModalVars, setVarModalVars] = useState<Record<string, string>>({})
  const [varModalContent, setVarModalContent] = useState('')
  const [varModalPromptType, setVarModalPromptType] = useState<string>('image')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [juheConnected, setJuheConnected] = useState<boolean | null>(null)
  const [_juheBaseUrl, setJuheBaseUrl] = useState('')

  const TYPE_LABELS: Record<string, string> = useMemo(
    () => ({
      image: t('prompts.library.filters.typeImage'),
      agent: t('prompts.library.filters.typeAgent'),
      package: t('prompts.library.filters.typePackage')
    }),
    [t]
  )

  // Debounce keyword
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(filters.keyword), 300)
    return () => clearTimeout(timer)
  }, [filters.keyword])

  // Check Juhe Management connection status
  useEffect(() => {
    const api = window.api.juhePrompts
    if (!api) {
      setJuheConnected(false)
      return
    }
    api
      .status()
      .then((res: { data?: { connected: boolean; baseUrl: string } }) => {
        if (res?.data) {
          setJuheConnected(res.data.connected)
          setJuheBaseUrl(res.data.baseUrl)
        } else {
          setJuheConnected(false)
        }
      })
      .catch(() => setJuheConnected(false))
  }, [])

  const handleJuheConnect = async () => {
    try {
      const api = window.api.juhePrompts
      if (!api) {
        console.error('juhePrompts API not available')
        return
      }
      await api.ensureKey()
      const status = await api.status()
      if (status?.data) {
        setJuheConnected(status.data.connected)
      }
    } catch (err) {
      console.error('Failed to connect to Juhe Management:', err)
    }
  }

  const listFilters = useMemo(
    () => buildListFilters({ ...filters, keyword: debouncedKeyword }, page, pageSize),
    [filters, debouncedKeyword, page, pageSize]
  )

  const {
    data: listResult,
    isLoading: listLoading,
    error: listError
  } = useQuery({
    queryKey: ['promptLibrary', 'list', listFilters],
    queryFn: () => window.api.promptLibrary.list(listFilters as Parameters<typeof window.api.promptLibrary.list>[0]),
    placeholderData: (previousData) => previousData
  })

  // Show toast on list error
  useEffect(() => {
    if (listError) {
      toastError({
        title: t('prompts.library.fetchError'),
        description: listError instanceof Error ? listError.message : String(listError)
      })
    }
  }, [listError, t])

  // Fetch detail for "Use" / "Copy" / "Preview"
  const fetchDetail = useCallback(
    async (id: number): Promise<{ item: PromptDetail; rendered?: string } | null> => {
      try {
        return await window.api.promptLibrary.get(id)
      } catch (err) {
        toastError({
          title: t('prompts.library.fetchError'),
          description: err instanceof Error ? err.message : String(err)
        })
        return null
      }
    },
    [t]
  )

  // Open preview modal — fetches detail
  const handlePreview = useCallback(
    async (item: PromptListItem) => {
      setPreviewItem(item)
      setPreviewDetail(null)
      setPreviewRendered('')
      setPreviewLoading(true)
      const result = await fetchDetail(item.id)
      setPreviewLoading(false)
      if (result) {
        setPreviewDetail(result.item)
        setPreviewRendered(result.rendered || result.item.content)
      }
    },
    [fetchDetail]
  )

  const handleClosePreview = useCallback(() => {
    setPreviewItem(null)
    setPreviewDetail(null)
    setPreviewRendered('')
    setPreviewLoading(false)
  }, [])

  // Close preview on Escape
  useEffect(() => {
    if (!previewItem) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePreview()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewItem, handleClosePreview])

  // 打开变量输入弹窗的辅助函数
  const openVarModal = useCallback((content: string, vars: Record<string, string>, promptType: string) => {
    setVarModalContent(content)
    setVarModalVars(vars)
    setVarModalPromptType(promptType)
    setVarModalOpen(true)
  }, [])

  const handleVarModalConfirm = useCallback(
    async (values: Record<string, string>) => {
      setVarModalOpen(false)
      const rendered = renderTemplate(varModalContent, values)
      if (varModalPromptType === 'image') {
        navigate({ to: '/generate', search: { prompt: rendered } })
      } else {
        // agent or package — directly create a chat session with the system prompt
        const sessionId = await createSession(undefined, undefined, rendered)
        navigate({ to: '/chat', search: { session: sessionId } })
      }
    },
    [navigate, varModalContent, varModalPromptType, createSession]
  )

  const handleVarModalCancel = useCallback(() => {
    setVarModalOpen(false)
  }, [])

  const handleUse = useCallback(
    async (id: string, _prompt: string) => {
      if (actionLoadingId) return // prevent double-click
      setActionLoadingId(String(id))

      const result = await fetchDetail(Number(id))
      setActionLoadingId(null)
      if (!result) return

      const content = result.rendered || result.item.content
      if (!content) return

      const promptType = result.item.type

      // 检查是否有模板变量需要用户填充
      const vars = result.item.variables
      if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
        openVarModal(content, vars, promptType)
        return
      }

      // 按 type 分流
      if (promptType === 'image') {
        navigate({ to: '/generate', search: { prompt: content } })
      } else {
        // agent or package — directly create a chat session with the system prompt
        const sessionId = await createSession(undefined, undefined, content)
        navigate({ to: '/chat', search: { session: sessionId } })
      }
    },
    [navigate, fetchDetail, actionLoadingId, openVarModal, createSession]
  )

  const handleCopy = useCallback(
    async (id: string) => {
      if (actionLoadingId) return
      setActionLoadingId(String(id))

      const result = await fetchDetail(Number(id))
      setActionLoadingId(null)
      if (!result) return

      const content = result.rendered || result.item.content
      if (!content) return

      try {
        await navigator.clipboard.writeText(content)
        setCopiedId(String(id))
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
      } catch {
        // clipboard unavailable
      }
    },
    [fetchDetail, actionLoadingId]
  )

  const handleUseApplied = useCallback((id: string) => {
    setCopiedId(`use-${id}`)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleFiltersChange = useCallback((next: FilterValue) => {
    setFilters(next)
    setPage(1)
  }, [])

  const handleSearch = useCallback((keyword: string) => {
    setDebouncedKeyword(keyword)
    setPage(1)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPage(1)
  }, [])

  const masonryItems = useMemo(() => {
    return (listResult?.data || []).map((item) => {
      const template = toPromptTemplate(item, TYPE_LABELS)
      return {
        key: String(item.id),
        node: (
          <PromptLibraryCard
            template={template}
            onUse={(savedPrompt) => handleUse(template.id, savedPrompt)}
            onUseApplied={() => handleUseApplied(template.id)}
            onCopy={() => handleCopy(template.id)}
            onPreview={() => handlePreview(item)}
            copiedId={copiedId}
            actionLoading={actionLoadingId === template.id}
          />
        )
      }
    })
  }, [listResult, copiedId, actionLoadingId, handleUse, handleUseApplied, handleCopy, handlePreview, TYPE_LABELS])

  const totalPages = listResult?.pagination?.totalPages ?? 0
  const total = listResult?.pagination?.total ?? 0

  const previewContent = previewRendered || previewDetail?.content || previewItem?.title || ''
  const typeLabel = previewDetail?.type ? TYPE_LABELS[previewDetail.type] || previewDetail.type : ''

  return (
    <div className='flex flex-col h-full' style={{ background: 'var(--juhe-void)' }}>
      <div className='shrink-0 px-6 pt-6 pb-4 space-y-4'>
        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)]'>
            <Sparkles className='w-5 h-5' />
          </div>
          <h1 className='text-2xl font-bold'>{t('prompts.library.title')}</h1>
        </div>
        {juheConnected === false && (
          <div className='flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)]'>
            <div className='flex items-center gap-2'>
              <WifiOff className='w-4 h-4 text-[var(--juhe-text-3)] shrink-0' />
              <span className='text-xs text-[var(--juhe-text-3)]'>{t('prompts.notConnected')}</span>
            </div>
            <button
              type='button'
              onClick={handleJuheConnect}
              className='px-3 py-1 rounded-md text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 transition-opacity'
            >
              {t('prompts.tryConnect')}
            </button>
          </div>
        )}
        <FilterBar value={filters} onChange={handleFiltersChange} onSearch={handleSearch} disabled={listLoading} />
      </div>

      <div className='flex-1 overflow-y-auto px-6 pb-8'>
        {listError ? (
          <div className='flex flex-col items-center justify-center py-20 text-[var(--juhe-text-3)]'>
            <p className='text-sm mb-4'>{t('prompts.library.serviceUnreachable')}</p>
            <button
              type='button'
              onClick={() => queryClient.invalidateQueries({ queryKey: ['promptLibrary'] })}
              className='px-4 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs hover:border-[var(--juhe-cyan)]/30'
            >
              {t('common.retry')}
            </button>
          </div>
        ) : listLoading && !listResult ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={`skeleton-${n}`}
                className='h-48 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] animate-pulse'
              />
            ))}
          </div>
        ) : !listLoading && masonryItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-[var(--juhe-text-3)]'>
            <Search className='w-10 h-10 mb-3 opacity-40' />
            <p className='text-sm'>{t('prompts.library.empty')}</p>
          </div>
        ) : (
          <>
            <Masonry
              items={masonryItems}
              breakpoints={[
                { minWidth: 1280, columns: 4 },
                { minWidth: 1024, columns: 3 },
                { minWidth: 640, columns: 2 },
                { minWidth: 0, columns: 1 }
              ]}
              gap={16}
            />
            {(totalPages > 1 || total > DEFAULT_PAGE_SIZE) && (
              <div className='flex items-center justify-center gap-2 mt-8'>
                <label className='flex items-center gap-1.5 text-xs text-[var(--juhe-text-2)]'>
                  <span>{t('prompts.library.pageSize')}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    disabled={listLoading}
                    className='px-2 py-1.5 rounded-md bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs text-[var(--juhe-text)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 disabled:opacity-50'
                  >
                    {[20, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type='button'
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || listLoading}
                  className='px-3 py-1.5 rounded-md bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs disabled:opacity-50'
                >
                  {t('common.previous')}
                </button>
                <span className='text-xs text-[var(--juhe-text-2)]'>
                  {t('prompts.library.pagination', { page, totalPages, total })}
                </span>
                <button
                  type='button'
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || listLoading}
                  className='px-3 py-1.5 rounded-md bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs disabled:opacity-50'
                >
                  {t('common.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Variable input modal */}
      {varModalOpen && (
        <VariableInputModal
          variables={varModalVars}
          onConfirm={handleVarModalConfirm}
          onCancel={handleVarModalCancel}
        />
      )}

      {/* Preview modal */}
      {previewItem && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <button
            type='button'
            className='absolute inset-0 bg-black/70'
            aria-label={t('common.close')}
            onClick={handleClosePreview}
          />
          <div className='relative max-w-3xl w-full max-h-[90vh] overflow-auto rounded-2xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] shadow-2xl'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
              <div className='flex items-center gap-2'>
                <h2 className='text-sm font-semibold text-[var(--juhe-text)]'>
                  {previewDetail?.title || previewItem.title || t('prompts.library.previewTitle')}
                </h2>
                {typeLabel && (
                  <span className='px-2 py-0.5 rounded-md bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)] text-[10px] font-medium'>
                    {typeLabel}
                  </span>
                )}
              </div>
              <button
                type='button'
                onClick={handleClosePreview}
                className='p-1.5 rounded-md text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
            <div className='p-4 space-y-4'>
              {previewDetail?.tags && previewDetail.tags.length > 0 && (
                <div className='flex flex-wrap gap-1'>
                  {previewDetail.tags.map((tag) => (
                    <span
                      key={tag}
                      className='inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] text-[10px] font-medium'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {previewLoading ? (
                <div className='w-full h-40 rounded-lg bg-[var(--juhe-void)]/60 animate-pulse' />
              ) : (
                <textarea
                  readOnly
                  value={previewContent}
                  className='w-full min-h-[160px] p-3 rounded-lg bg-[var(--juhe-void)]/60 border border-[var(--juhe-border)] text-xs text-[var(--juhe-text-2)] leading-relaxed resize-none focus:outline-none'
                />
              )}
              {previewContent && !previewLoading && (
                <div className='flex justify-end gap-2'>
                  <button
                    type='button'
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(previewContent)
                        setCopiedId(`preview-${previewItem.id}`)
                        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
                        copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
                      } catch {
                        // ignore
                      }
                    }}
                    className='px-3 py-1.5 rounded-lg border border-[var(--juhe-border)] text-xs text-[var(--juhe-text-2)] hover:border-[var(--juhe-cyan)]/30 transition-colors'
                  >
                    {copiedId === `preview-${previewItem.id}` ? t('prompts.copied') : t('prompts.copyTemplate')}
                  </button>
                  <button
                    type='button'
                    onClick={async () => {
                      handleClosePreview()
                      // 检查是否有变量需要填充
                      const vars = previewDetail?.variables
                      const promptType = previewDetail?.type || 'image'
                      if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
                        openVarModal(previewContent, vars, promptType)
                      } else if (promptType === 'image') {
                        navigate({ to: '/generate', search: { prompt: previewContent } })
                      } else {
                        const sessionId = await createSession(undefined, undefined, previewContent)
                        navigate({ to: '/chat', search: { session: sessionId } })
                      }
                    }}
                    className='px-3 py-1.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-xs font-medium hover:opacity-90 transition-opacity'
                  >
                    {t('prompts.useTemplate')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
