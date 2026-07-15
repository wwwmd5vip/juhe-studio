import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Edit3, Palette } from 'lucide-react'
import type { BrandKit } from '@shared/types/creator-os'

interface BrandKitManagerProps {
  /** 当前选中品牌 Kit ID（由父组件管理） */
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}

export function BrandKitManager({ selectedId, onSelect }: BrandKitManagerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<BrandKit | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    primaryColor: '#FF5733',
    secondaryColor: '#333333',
    fontFamily: 'Inter',
    styleDescription: ''
  })

  const { data: brands = [] } = useQuery<BrandKit[]>({
    queryKey: ['brand-kits'],
    queryFn: () => (window.api as any).brandKit.list()
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => (window.api as any).brandKit.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] })
      setCreating(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      (window.api as any).brandKit.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] })
      setEditing(null)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => (window.api as any).brandKit.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-kits'] })
  })

  const resetForm = () => {
    setForm({ name: '', primaryColor: '#FF5733', secondaryColor: '#333333', fontFamily: 'Inter', styleDescription: '' })
  }

  const startEdit = (b: BrandKit) => {
    setEditing(b)
    setForm({
      name: b.name,
      primaryColor: b.primaryColor || '#FF5733',
      secondaryColor: b.secondaryColor || '#333333',
      fontFamily: b.fontFamily || 'Inter',
      styleDescription: b.styleDescription || ''
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-cos-heading text-sm text-cos-ink-secondary flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Brand Kits
        </h3>
        <button
          onClick={() => { setCreating(true); resetForm() }}
          className="text-cos-accent hover:text-cos-accent-hover text-xs flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="bg-cos-bg-alt border border-cos-border rounded-cos-md p-3 space-y-2">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Brand name"
            className="w-full text-sm border border-cos-border rounded-cos-sm bg-cos-surface
                       text-cos-ink px-2 py-1 focus:outline-none focus:border-cos-accent"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-cos-ink-muted">Primary</label>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                  className="w-8 h-6 rounded-cos-sm border border-cos-border cursor-pointer"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                  className="flex-1 text-[10px] border border-cos-border rounded-cos-sm
                             bg-cos-surface px-1 py-0.5 font-mono"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-cos-ink-muted">Secondary</label>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                  className="w-8 h-6 rounded-cos-sm border border-cos-border cursor-pointer"
                />
                <input
                  value={form.secondaryColor}
                  onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                  className="flex-1 text-[10px] border border-cos-border rounded-cos-sm
                             bg-cos-surface px-1 py-0.5 font-mono"
                />
              </div>
            </div>
          </div>
          <textarea
            value={form.styleDescription}
            onChange={(e) => setForm((p) => ({ ...p, styleDescription: e.target.value }))}
            placeholder="Style description (e.g. minimalist, luxury, tech...)"
            rows={2}
            className="w-full text-xs border border-cos-border rounded-cos-sm bg-cos-surface
                       text-cos-ink px-2 py-1 resize-none focus:outline-none focus:border-cos-accent"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setCreating(false); setEditing(null) }}
              className="text-cos-ink-muted text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!form.name.trim()) return
                if (editing) {
                  updateMutation.mutate({ id: editing.id, data: form })
                } else {
                  createMutation.mutate(form)
                }
              }}
              disabled={!form.name.trim()}
              className="bg-cos-accent hover:bg-cos-accent-hover text-white text-xs px-3 py-1
                         rounded-cos-sm disabled:opacity-50"
            >
              {editing ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Brand list */}
      <div className="space-y-1">
        {brands.map((b) => (
          <div
            key={b.id}
            onClick={() => onSelect?.(selectedId === b.id ? null : b.id)}
            className={`flex items-center gap-2 p-2 rounded-cos-sm cursor-pointer
                        transition-colors group
                        ${selectedId === b.id ? 'bg-cos-accent-muted ring-1 ring-cos-accent' : 'hover:bg-cos-bg-alt'}`}
          >
            <div className="flex gap-0.5 shrink-0">
              <div
                className="w-3 h-3 rounded-full border border-cos-border"
                style={{ backgroundColor: b.primaryColor || '#FF5733' }}
              />
              <div
                className="w-3 h-3 rounded-full border border-cos-border"
                style={{ backgroundColor: b.secondaryColor || '#333' }}
              />
            </div>
            <span className="text-xs text-cos-ink flex-1 truncate">{b.name}</span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(b) }}
                className="text-cos-ink-muted hover:text-cos-ink"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(b.id) }}
                className="text-cos-ink-muted hover:text-cos-error"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
