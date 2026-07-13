import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Download, Heart, ImageIcon, Loader2, Search, Tag, Trash2, Upload, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type CommunityTemplate, useCommunityStore } from '@/stores/community'

export const Route = createFileRoute('/community')({
  component: CommunityPage
})

const categories: Array<{ key: string; value: string }> = [
  { key: 'all', value: 'all' },
  { key: 'portrait', value: 'portrait' },
  { key: 'landscape', value: 'landscape' },
  { key: 'product', value: 'product' },
  { key: 'anime', value: 'anime' },
  { key: 'concept', value: 'concept' },
  { key: 'other', value: 'other' }
]

const sortOptions: Array<{ key: string; value: 'popular' | 'newest' | 'downloads' }> = [
  { key: 'popular', value: 'popular' },
  { key: 'newest', value: 'newest' },
  { key: 'mostDownloaded', value: 'downloads' }
]

function CommunityPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    templates,
    myTemplates,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    likeTemplate,
    downloadTemplate,
    uploadTemplate,
    deleteMyTemplate
  } = useCommunityStore()

  const [activeTab, setActiveTab] = useState<'explore' | 'my'>('explore')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const displayTemplates = activeTab === 'explore' ? templates : myTemplates

  const filteredTemplates = displayTemplates
    .filter((tpl) => {
      if (filter.category !== 'all' && tpl.category !== filter.category) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => {
      switch (filter.sort) {
        case 'popular':
          return b.likes - a.likes
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'downloads':
          return b.downloads - a.downloads
        default:
          return 0
      }
    })

  const handleUseTemplate = (tpl: CommunityTemplate) => {
    downloadTemplate(tpl.id)
    navigate({ to: '/generate', search: { prompt: tpl.prompt } })
  }

  const handleDelete = (id: string) => {
    deleteMyTemplate(id)
    setDeleteConfirmId(null)
  }

  return (
    <div
      className='h-[calc(100vh-3rem)] flex flex-col bg-[var(--juhe-void-2)]'
      style={{ background: 'var(--juhe-void)' }}
    >
      {/* Header */}
      <div className='shrink-0 border-b border-[var(--juhe-border)] px-6 py-4'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Users className='w-6 h-6 text-[var(--juhe-cyan)]' />
            <h1 className='text-xl font-bold'>{t('community.title')}</h1>
          </div>
          <button
            type='button'
            onClick={() => setShowUploadModal(true)}
            className='flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-lg text-sm font-medium hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
          >
            <Upload className='w-4 h-4' />
            {t('community.uploadTemplate')}
          </button>
        </div>

        {/* Search + Tabs */}
        <div className='flex items-center gap-4'>
          <div className='relative flex-1 max-w-md'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--juhe-text-3)]' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('community.search')}
              className='w-full pl-9 pr-4 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none transition-colors'
            />
            {searchQuery && (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              >
                <X className='w-4 h-4' />
              </button>
            )}
          </div>

          <div className='flex bg-[var(--juhe-surface-2)] rounded-lg p-0.5'>
            <button
              type='button'
              onClick={() => setActiveTab('explore')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'explore'
                  ? 'bg-[var(--juhe-void-2)] text-[var(--juhe-text)] shadow-sm'
                  : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              }`}
            >
              {t('community.all')}
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('my')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'my'
                  ? 'bg-[var(--juhe-void-2)] text-[var(--juhe-text)] shadow-sm'
                  : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              }`}
            >
              {t('community.myTemplates')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className='flex items-center justify-between mt-4'>
          <div className='flex items-center gap-1 overflow-x-auto'>
            {categories.map((cat) => (
              <button
                type='button'
                key={cat.key}
                onClick={() => setFilter({ category: cat.value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter.category === cat.value
                    ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                    : 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                }`}
              >
                {t(`community.${cat.key}`)}
              </button>
            ))}
          </div>

          <select
            value={filter.sort}
            onChange={(e) => setFilter({ sort: e.target.value as 'popular' | 'newest' | 'downloads' })}
            className='px-3 py-1.5 bg-[var(--juhe-surface-2)] rounded-lg text-xs font-medium border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none cursor-pointer'
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(`community.${opt.key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Grid */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        {filteredTemplates.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-[var(--juhe-text-3)]'>
            <ImageIcon className='w-12 h-12 mb-3 opacity-50' />
            <p className='text-sm'>{t('community.noTemplates')}</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {filteredTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                isMyTemplate={activeTab === 'my'}
                onUse={() => handleUseTemplate(tpl)}
                onLike={() => likeTemplate(tpl.id)}
                onDelete={() => setDeleteConfirmId(tpl.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={(data) => {
            uploadTemplate(data)
            setShowUploadModal(false)
          }}
          t={t}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='bg-[var(--juhe-void-2)] rounded-xl p-6 w-full max-w-sm shadow-lg border border-[var(--juhe-border)]'>
            <h3 className='text-lg font-semibold mb-2'>{t('community.delete')}</h3>
            <p className='text-sm text-[var(--juhe-text-3)] mb-4'>{t('community.confirmDelete')}</p>
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setDeleteConfirmId(null)}
                className='px-4 py-2 rounded-lg text-sm font-medium bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-2)]/80 transition-colors'
              >
                {t('common.cancel')}
              </button>
              <button
                type='button'
                onClick={() => handleDelete(deleteConfirmId)}
                className='px-4 py-2 rounded-lg text-sm font-medium bg-[var(--juhe-magenta)] text-[var(--juhe-magenta)]-foreground hover:bg-[var(--juhe-magenta)]/90 transition-colors'
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  template,
  isMyTemplate,
  onUse,
  onLike,
  onDelete,
  t
}: {
  template: CommunityTemplate
  isMyTemplate: boolean
  onUse: () => void
  onLike: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const gradientColors: Record<string, string> = {
    portrait: 'from-rose-400/20 to-orange-300/20',
    landscape: 'from-emerald-400/20 to-cyan-300/20',
    product: 'from-slate-400/20 to-zinc-300/20',
    anime: 'from-violet-400/20 to-fuchsia-300/20',
    concept: 'from-amber-400/20 to-yellow-300/20',
    other: 'from-gray-400/20 to-slate-300/20'
  }

  return (
    <div className='group bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-xl overflow-hidden hover:border-[var(--juhe-cyan)]/50 transition-colors flex flex-col'>
      {/* Preview */}
      <div
        className={`h-32 bg-gradient-to-br ${gradientColors[template.category] || gradientColors.other} flex items-center justify-center relative`}
      >
        <ImageIcon className='w-10 h-10 text-[var(--juhe-text)]/20' />
        <div className='absolute top-2 right-2'>
          <span className='px-2 py-0.5 bg-[var(--juhe-void-2)]/80 backdrop-blur-sm rounded-md text-[10px] font-medium text-[var(--juhe-text-3)] capitalize'>
            {t(`community.${template.category}`)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className='p-4 flex flex-col flex-1'>
        <h3 className='font-semibold text-sm mb-1 truncate'>{template.title}</h3>
        <p className='text-xs text-[var(--juhe-text-3)] mb-3 line-clamp-2'>{template.description}</p>

        {/* Author */}
        <div className='flex items-center gap-2 mb-3'>
          <div className='w-5 h-5 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 flex items-center justify-center text-[10px] font-medium text-[var(--juhe-cyan)]'>
            {template.author.charAt(0).toUpperCase()}
          </div>
          <span className='text-xs text-[var(--juhe-text-3)]'>
            {t('community.byAuthor').replace('{{author}}', template.author)}
          </span>
        </div>

        {/* Tags */}
        <div className='flex flex-wrap gap-1 mb-3'>
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className='inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--juhe-surface-2)] rounded text-[10px] text-[var(--juhe-text-3)]'
            >
              <Tag className='w-2.5 h-2.5' />
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className='px-1.5 py-0.5 text-[10px] text-[var(--juhe-text-3)]'>+{template.tags.length - 3}</span>
          )}
        </div>

        {/* Stats + Actions */}
        <div className='mt-auto flex items-center justify-between'>
          <div className='flex items-center gap-3 text-xs text-[var(--juhe-text-3)]'>
            <button
              type='button'
              onClick={onLike}
              className='flex items-center gap-1 hover:text-[var(--juhe-magenta)] transition-colors'
            >
              <Heart className='w-3.5 h-3.5' />
              {template.likes}
            </button>
            <span className='flex items-center gap-1'>
              <Download className='w-3.5 h-3.5' />
              {template.downloads}
            </span>
          </div>

          <div className='flex items-center gap-1'>
            {isMyTemplate && (
              <button
                type='button'
                onClick={onDelete}
                className='p-1.5 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10 transition-colors'
                title={t('community.delete')}
              >
                <Trash2 className='w-3.5 h-3.5' />
              </button>
            )}
            <button
              type='button'
              onClick={onUse}
              className='px-3 py-1.5 bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-lg text-xs font-medium hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
            >
              {t('community.useTemplate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadModal({
  onClose,
  onUpload,
  t
}: {
  onClose: () => void
  onUpload: (data: Omit<CommunityTemplate, 'id' | 'likes' | 'downloads' | 'createdAt'>) => void
  t: (key: string) => string
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState<CommunityTemplate['category']>('other')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !prompt.trim()) return

    setIsSubmitting(true)
    onUpload({
      title: title.trim(),
      description: description.trim(),
      prompt: prompt.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      author: 'Me',
      category
    })
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='bg-[var(--juhe-void-2)] rounded-xl p-6 w-full max-w-lg shadow-lg border border-[var(--juhe-border)]'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold'>{t('community.uploadTemplate')}</h3>
          <button
            type='button'
            onClick={onClose}
            className='p-1 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label htmlFor='community-title' className='block text-sm font-medium mb-1'>{t('community.title')}</label>
            <input
              id='community-title'
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('community.titlePlaceholder')}
              className='w-full px-3 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none'
              required
            />
          </div>

          <div>
            <label htmlFor='community-description' className='block text-sm font-medium mb-1'>{t('agents.description')}</label>
            <input
              id='community-description'
              type='text'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('community.descPlaceholder')}
              className='w-full px-3 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none'
            />
          </div>

          <div>
            <label htmlFor='community-prompt' className='block text-sm font-medium mb-1'>{t('generate.prompt')}</label>
            <textarea
              id='community-prompt'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('community.promptPlaceholder')}
              rows={4}
              className='w-full px-3 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none resize-none'
              required
            />
          </div>

          <div>
            <label htmlFor='community-tags' className='block text-sm font-medium mb-1'>{t('lora.details.tags')}</label>
            <input
              id='community-tags'
              type='text'
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('community.tagsPlaceholder')}
              className='w-full px-3 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none'
            />
          </div>

          <div>
            <label htmlFor='community-category' className='block text-sm font-medium mb-1'>{t('community.all')}</label>
            <select
              id='community-category'
              value={category}
              onChange={(e) => setCategory(e.target.value as CommunityTemplate['category'])}
              className='w-full px-3 py-2 bg-[var(--juhe-surface-2)] rounded-lg text-sm border border-transparent focus:border-[var(--juhe-cyan)] focus:outline-none cursor-pointer'
            >
              {categories
                .filter((c) => c.value !== 'all')
                .map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {t(`community.${cat.key}`)}
                  </option>
                ))}
            </select>
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-lg text-sm font-medium bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-2)]/80 transition-colors'
            >
              {t('common.cancel')}
            </button>
            <button
              type='submit'
              disabled={isSubmitting || !title.trim() || !prompt.trim()}
              className='flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <Check className='w-4 h-4' />
                  {t('community.uploadTemplate')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
