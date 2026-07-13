/**
 * canvas.tsx - 无限画布路由
 * 使用 canvas-v2 新引擎 (CSS Transform 视口，零外部依赖)
 */
import type { WorkflowResult } from '@shared/types/ipc'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasConnection, CanvasNode, ViewportTransform } from '@/components/canvas-v2/types'
import { useCanvasV2Store } from '@/stores/canvas-v2-store'
import { z } from 'zod'
import { error as toastError } from '@/components/ui/toast'

const workflowImportSchema = z.object({
  name: z.string().optional(),
  nodes: z.array(z.unknown()).optional().default([]),
  edges: z.array(z.unknown()).optional().default([]),
  viewport: z.object({ x: z.number(), y: z.number(), k: z.number() }).optional().default({ x: 0, y: 0, k: 1 }),
  viewMode: z.string().optional().default('smart')
})

// Lazy-load the heavy CanvasWorkspace only when entering editing mode
const CanvasWorkspace = lazy(() =>
  import('@/components/canvas-v2/CanvasWorkspace').then((m) => ({ default: m.CanvasWorkspace }))
)

export const Route = createFileRoute('/canvas')({
  component: CanvasPage
})

interface CanvasListItem {
  id: string
  name: string
  nodes: CanvasNode[]
  edges: CanvasConnection[]
  viewport: ViewportTransform & { zoom?: number }
  viewMode?: string
  updatedAt: string
  createdAt: string
}

function CanvasPage() {
  const { t, i18n } = useTranslation()
  const [canvases, setCanvases] = useState<CanvasListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const isAutoSavePausedRef = useRef(true)

  const nodes = useCanvasV2Store((s) => s.nodes)
  const connections = useCanvasV2Store((s) => s.connections)
  const viewport = useCanvasV2Store((s) => s.viewport)
  const setNodes = useCanvasV2Store((s) => s.setNodes)
  const setConnections = useCanvasV2Store((s) => s.setConnections)
  const setViewport = useCanvasV2Store((s) => s.setViewport)
  const setSelection = useCanvasV2Store((s) => s.setSelection)

  const loadCanvases = useCallback(async () => {
    setIsLoading(true)
    try {
      const workflows = (await window.api.db.workflows.list()) as WorkflowResult[]
      setCanvases(
        workflows.map((wf) => ({
          id: wf.id,
          name: wf.name,
          nodes: Array.isArray(wf.nodes) ? (wf.nodes as CanvasNode[]) : [],
          edges: Array.isArray(wf.edges) ? (wf.edges as CanvasConnection[]) : [],
          viewport:
            wf.viewport && typeof wf.viewport === 'object'
              ? { x: 0, y: 0, k: 1, ...(wf.viewport as Record<string, unknown>) }
              : { x: 0, y: 0, k: 1 },
          viewMode: wf.viewMode ?? 'smart',
          updatedAt: wf.updatedAt,
          createdAt: wf.createdAt
        }))
      )
    } catch (err) {
      console.error('[CanvasPage] Failed to list workflows:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCanvases()
  }, [loadCanvases])

  const handleNewCanvas = useCallback(async () => {
    const name = t('canvas.newWorkflow')
    isAutoSavePausedRef.current = true
    try {
      const created = await window.api.db.workflows.create({
        name,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, k: 1 },
        viewMode: 'smart'
      })
      setActiveId(created.id)
      setDocumentName(name)
      setNodes([])
      setConnections([])
      setSelection([])
      setViewport({ x: 0, y: 0, k: 1 })
      setIsEditing(true)
      await loadCanvases()
      setTimeout(() => {
        isAutoSavePausedRef.current = false
      }, 600)
    } catch (err) {
      console.error('[CanvasPage] Failed to create canvas:', err)
    }
  }, [setNodes, setConnections, setSelection, setViewport, loadCanvases, t])

  const handleLoadCanvas = useCallback(
    (canvas: CanvasListItem) => {
      isAutoSavePausedRef.current = true
      const normalizedViewport: ViewportTransform = {
        x: canvas.viewport.x ?? 0,
        y: canvas.viewport.y ?? 0,
        k: canvas.viewport.k ?? canvas.viewport.zoom ?? 1
      }
      setNodes((canvas.nodes ?? []) as CanvasNode[])
      setConnections((canvas.edges ?? []) as CanvasConnection[])
      setSelection([])
      setViewport(normalizedViewport)
      setActiveId(canvas.id)
      setDocumentName(canvas.name)
      setIsEditing(true)
      setTimeout(() => {
        isAutoSavePausedRef.current = false
      }, 600)
    },
    [setNodes, setConnections, setSelection, setViewport]
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const payload = {
        name: documentName || t('canvas.newWorkflow'),
        nodes,
        edges: connections,
        viewport,
        viewMode: 'smart'
      }

      if (activeId) {
        await window.api.db.workflows.update(activeId, payload)
      } else {
        const created = await window.api.db.workflows.create(payload)
        setActiveId(created.id)
      }
      await loadCanvases()
    } catch (err) {
      console.error('[CanvasPage] Failed to save workflow:', err)
    } finally {
      setIsSaving(false)
    }
  }, [activeId, documentName, nodes, connections, viewport, loadCanvases, t])

  const handleDeleteCanvas = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await window.api.db.workflows.delete(id)
        if (activeId === id) {
          setIsEditing(false)
          setActiveId(null)
          setDocumentName('')
          setNodes([])
          setConnections([])
          setSelection([])
        }
        await loadCanvases()
      } catch (err) {
        console.error('[CanvasPage] Failed to delete workflow:', err)
      }
    },
    [activeId, setNodes, setConnections, setSelection, loadCanvases]
  )

  const handleBack = useCallback(() => {
    isAutoSavePausedRef.current = true
    setIsEditing(false)
    setActiveId(null)
    setDocumentName('')
    setNodes([])
    setConnections([])
    setSelection([])
    loadCanvases()
  }, [setNodes, setConnections, setSelection, loadCanvases])

  // Auto-save (2s debounce)
  useEffect(() => {
    if (!activeId || isAutoSavePausedRef.current) return
    const timer = setTimeout(() => {
      handleSave()
    }, 2000)
    return () => clearTimeout(timer)
  }, [activeId, handleSave])

  // Saved indicator
  useEffect(() => {
    if (isSaving || !activeId) return
    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [isSaving, activeId])

  // Import
  const handleImportCanvas = useCallback(async () => {
    if (!importText.trim()) return
    try {
      const raw = JSON.parse(importText)
      const doc = workflowImportSchema.parse(raw)
      const created = await window.api.db.workflows.create({
        name: doc.name || t('canvas.newWorkflow'),
        nodes: doc.nodes ?? [],
        edges: doc.edges ?? [],
        viewport: doc.viewport ?? { x: 0, y: 0, k: 1 },
        viewMode: doc.viewMode ?? 'smart'
      })

      setActiveId(created.id)
      setDocumentName(created.name)
      setNodes((doc.nodes ?? []) as CanvasNode[])
      setConnections((doc.edges ?? []) as CanvasConnection[])
      setSelection([])
      setViewport((doc.viewport as ViewportTransform) ?? { x: 0, y: 0, k: 1 })
      setIsEditing(true)
      setShowImport(false)
      setImportText('')
      setTimeout(() => {
        isAutoSavePausedRef.current = false
      }, 600)
      await loadCanvases()
    } catch (err) {
      console.error('[CanvasPage] Failed to import:', err)
      toastError({ description: t('canvas.messages.invalidJSON') })
    }
  }, [importText, setNodes, setConnections, setSelection, setViewport, loadCanvases, t])

  // ========== Editor View ==========
  if (isEditing) {
    return (
      <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
        {/* Top bar */}
        <div
          className='flex items-center justify-between px-4 py-2 border-b shrink-0'
          style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
        >
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleBack}
              className='p-1.5 rounded-md transition-colors hover:bg-[var(--juhe-surface-2)]'
              style={{ color: 'var(--juhe-text-2)' }}
              title={t('common.back')}
            >
              <ArrowLeft className='w-4 h-4' />
            </button>
            {(isSaving || showSaved) && (
              <div className='flex items-center gap-1.5 text-xs' style={{ color: 'var(--juhe-text-3)' }}>
                {isSaving ? (
                  <>
                    <Loader2 className='w-3 h-3 animate-spin' />
                    {t('canvas.saving')}
                  </>
                ) : (
                  <>
                    <Check className='w-3 h-3' style={{ color: 'var(--juhe-emerald)' }} />
                    {t('canvas.saved')}
                  </>
                )}
              </div>
            )}
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className='bg-transparent text-sm font-semibold outline-none w-48'
              style={{ color: 'var(--juhe-text)' }}
            />
          </div>
          <div className='flex items-center gap-2 text-xs' style={{ color: 'var(--juhe-text-3)' }}>
            <span>{activeId ? t('canvas.loadCanvas') : t('canvas.newWorkflow')}</span>
          </div>
        </div>

        {/* Canvas workspace (lazy-loaded) */}
        <div className='flex-1 min-h-0'>
          <Suspense
            fallback={
              <div
                className='flex items-center justify-center h-full gap-2 text-sm'
                style={{ color: 'var(--juhe-text-3)' }}
              >
                <Loader2 className='w-5 h-5 animate-spin' />
                {t('common.loading')}
              </div>
            }
          >
            <CanvasWorkspace onSave={handleSave} />
          </Suspense>
        </div>
      </div>
    )
  }

  // ========== Gate View (workflow list) ==========
  return (
    <div
      className='h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-6'
      style={{ background: 'var(--juhe-void)' }}
    >
      <div
        className='w-full max-w-2xl rounded-3xl border shadow-2xl p-10'
        style={{ background: 'var(--juhe-surface)', borderColor: 'var(--juhe-border)' }}
      >
        <h1 className='text-3xl font-bold mb-2 tracking-tight' style={{ color: 'var(--juhe-text)' }}>
          {t('canvas.gateTitle')}
        </h1>
        <p className='text-sm mb-8' style={{ color: 'var(--juhe-text-3)' }}>
          {t('canvas.gateSubtitle')}
        </p>

        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-sm font-semibold' style={{ color: 'var(--juhe-text-2)' }}>
            {t('canvas.workflowList')}
          </h2>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setShowImport(!showImport)}
              className='flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all hover:opacity-90'
              style={{ background: 'var(--juhe-surface-2)', color: 'var(--juhe-text)' }}
            >
              <Upload className='w-3.5 h-3.5' />
              {t('canvas.actions.import')}
            </button>
            <button
              type='button'
              onClick={handleNewCanvas}
              className='flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all hover:opacity-90'
              style={{ background: 'var(--juhe-cyan)', color: 'var(--juhe-void)' }}
            >
              <Plus className='w-3.5 h-3.5' />
              {t('canvas.newCanvas')}
            </button>
          </div>
        </div>

        {/* Import panel */}
        {showImport && (
          <div className='mb-4 p-3 rounded-xl border' style={{ borderColor: 'var(--juhe-border)' }}>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t('canvas.messages.importPlaceholder')}
              rows={4}
              className='w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-xs outline-none'
              style={{ borderColor: 'var(--juhe-border)', color: 'var(--juhe-text)' }}
            />
            <div className='flex justify-end gap-2 mt-2'>
              <button
                type='button'
                onClick={() => {
                  setShowImport(false)
                  setImportText('')
                }}
                className='px-3 py-1 rounded text-xs'
                style={{ color: 'var(--juhe-text-3)' }}
              >
                {t('canvas.messages.importCancel')}
              </button>
              <button
                type='button'
                onClick={handleImportCanvas}
                disabled={!importText.trim()}
                className='px-3 py-1 rounded text-xs font-medium disabled:opacity-30'
                style={{ background: 'var(--juhe-cyan)', color: 'var(--juhe-void)' }}
              >
                {t('canvas.messages.importAction')}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className='flex items-center justify-center py-12 gap-2 text-sm' style={{ color: 'var(--juhe-text-3)' }}>
            <Loader2 className='w-4 h-4 animate-spin' />
            {t('common.loading')}
          </div>
        ) : canvases.length === 0 ? (
          <div
            className='text-center py-12 rounded-2xl border border-dashed'
            style={{ borderColor: 'var(--juhe-border)', color: 'var(--juhe-text-3)' }}
          >
            {t('canvas.noCanvases')}
          </div>
        ) : (
          <div className='space-y-3 max-h-96 overflow-y-auto pr-1'>
            {canvases.map((canvas) => (
              // biome-ignore lint/a11y/useSemanticElements: custom interactive element, button semantics not appropriate
<div
                key={canvas.id}
                role='button'
                tabIndex={0}
                onClick={() => handleLoadCanvas(canvas)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleLoadCanvas(canvas)
                  }
                }}
                className='group flex items-center justify-between px-4 py-3 rounded-2xl border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg'
                style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface-2)' }}
              >
                <div className='flex-1 min-w-0'>
                  <div className='text-sm font-medium truncate' style={{ color: 'var(--juhe-text)' }}>
                    {canvas.name}
                  </div>
                  <div className='text-[10px] mt-1' style={{ color: 'var(--juhe-text-3)' }}>
                    {canvas.nodes.length} {t('canvas.stats.nodesCount')} · {canvas.edges.length}{' '}
                    {t('canvas.stats.edgesCount')} · {new Date(canvas.updatedAt).toLocaleDateString(i18n.language)}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                  className='p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--juhe-magenta)]/10'
                  style={{ color: 'var(--juhe-magenta)' }}
                  title={t('canvas.deleteCanvas')}
                >
                  <Trash2 className='w-3.5 h-3.5' />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
