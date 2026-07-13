import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Check, Code, Edit3, FileText, Globe, Plus, Power, Puzzle, Trash2, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import { useSkillsStore } from '@/stores/skills'

export const Route = createFileRoute('/skills')({
  component: SkillsPage
})

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  builtin: <BookOpen className='w-3.5 h-3.5' />,
  custom: <Puzzle className='w-3.5 h-3.5' />,
  clawhub: <Globe className='w-3.5 h-3.5' />,
  coding: <Code className='w-3.5 h-3.5' />,
  writing: <FileText className='w-3.5 h-3.5' />
}

const CATEGORY_COLORS: Record<string, string> = {
  builtin: 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]',
  custom: 'bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]',
  clawhub: 'bg-[var(--juhe-violet)]/10 text-[var(--juhe-violet)]',
  coding: 'bg-[var(--juhe-amber)]/10 text-[var(--juhe-amber)]',
  writing: 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
}

function SkillsPage() {
  const { t } = useTranslation()
  const { skills, loadSkills, createSkill, updateSkill, deleteSkill, toggleSkill } = useSkillsStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<(typeof skills)[0] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof skills)[0] | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s) => s.category || 'custom'))
    return ['all', ...Array.from(cats)]
  }, [skills])

  const filteredSkills =
    activeCategory === 'all' ? skills : skills.filter((s) => (s.category || 'custom') === activeCategory)

  const handleAdd = () => {
    setEditingSkill(null)
    setFormTitle('')
    setFormName('')
    setFormContent('')
    setFormDescription('')
    setIsModalOpen(true)
  }

  const handleEdit = (skill: (typeof skills)[0]) => {
    setEditingSkill(skill)
    setFormTitle(skill.title)
    setFormName(skill.name)
    setFormContent(skill.content)
    setFormDescription(skill.description || '')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return

    if (editingSkill) {
      await updateSkill(editingSkill.id, {
        title: formTitle.trim(),
        name: formName.trim() || editingSkill.name,
        content: formContent.trim(),
        description: formDescription.trim()
      })
    } else {
      await createSkill({
        title: formTitle.trim(),
        name: formName.trim() || formTitle.trim().toLowerCase().replace(/\s+/g, '-'),
        content: formContent.trim()
      })
    }
    setIsModalOpen(false)
  }

  const handleDelete = async (skill: (typeof skills)[0]) => {
    if (skill.isBuiltin) return
    setDeleteTarget(skill)
  }

  return (
    <div className='h-full flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='h-14 border-b border-[var(--juhe-border)] flex items-center justify-between px-4 shrink-0'>
        <div className='flex items-center gap-2'>
          <Wrench className='w-5 h-5 text-[var(--juhe-cyan)]' />
          <h1 className='font-semibold'>{t('skills.title')}</h1>
          <span className='text-xs text-[var(--juhe-text-3)] ml-2'>
            ({skills.filter((s) => s.isEnabled).length}/{skills.length})
          </span>
        </div>
        <button
          type='button'
          onClick={handleAdd}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm hover:opacity-90 transition-opacity'
        >
          <Plus className='w-4 h-4' />
          {t('skills.add')}
        </button>
      </div>

      {/* Category Filter */}
      <div className='px-4 py-2 border-b border-[var(--juhe-border)] flex gap-1.5 overflow-x-auto'>
        {categories.map((cat: string) => (
          <button
            type='button'
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                : 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] hover:bg-white/[0.03]'
            }`}
          >
            {cat === 'all' ? t('skills.allCategories') : t(`skills.category.${cat}`, { defaultValue: cat })}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className='flex-1 overflow-y-auto p-4'>
        {filteredSkills.length === 0 ? (
          <div className='text-center py-12 text-[var(--juhe-text-3)]'>
            <Wrench className='w-10 h-10 mx-auto mb-3 opacity-30' />
            <p className='text-sm'>{t('skills.empty')}</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className={`group rounded-lg border p-3 transition-all ${
                  skill.isEnabled
                    ? 'border-[var(--juhe-border)] bg-[var(--juhe-surface)]'
                    : 'border-[var(--juhe-border)]/50 bg-[var(--juhe-surface-2)]/30 opacity-60'
                }`}
              >
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <div
                      className={`p-1.5 rounded-md ${CATEGORY_COLORS[skill.category || 'custom'] || CATEGORY_COLORS.custom}`}
                    >
                      {CATEGORY_ICONS[skill.category || 'custom'] || <Puzzle className='w-3.5 h-3.5' />}
                    </div>
                    <div className='min-w-0'>
                      <div className='text-sm font-medium truncate'>{skill.title}</div>
                      <div className='text-[10px] text-[var(--juhe-text-3)]'>{skill.name}</div>
                    </div>
                  </div>
                  <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      type='button'
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-1 rounded hover:bg-white/[0.03] ${skill.isEnabled ? 'text-[var(--juhe-cyan)]' : 'text-[var(--juhe-text-3)]'}`}
                      title={skill.isEnabled ? t('skills.disable') : t('skills.enable')}
                    >
                      <Power className='w-3.5 h-3.5' />
                    </button>
                    <button
                      type='button'
                      onClick={() => handleEdit(skill)}
                      className='p-1 rounded hover:bg-white/[0.03] text-[var(--juhe-text-3)]'
                      title={t('common.edit')}
                    >
                      <Edit3 className='w-3.5 h-3.5' />
                    </button>
                    {!skill.isBuiltin && (
                      <button
                        type='button'
                        onClick={() => handleDelete(skill)}
                        className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
                        title={t('common.delete')}
                      >
                        <Trash2 className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                </div>

                {skill.description && (
                  <p className='text-xs text-[var(--juhe-text-3)] mt-2 line-clamp-2'>{skill.description}</p>
                )}

                <div className='flex items-center gap-1.5 mt-2'>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[skill.category || 'custom'] || CATEGORY_COLORS.custom}`}
                  >
                    {skill.category || 'custom'}
                  </span>
                  {skill.isBuiltin && (
                    <span className='text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'>
                      {t('skills.builtin')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='bg-[var(--juhe-void-2)] rounded-xl border border-[var(--juhe-border)] shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
              <h3 className='font-semibold text-sm'>{editingSkill ? t('skills.edit') : t('skills.add')}</h3>
              <button
                type='button'
                onClick={() => setIsModalOpen(false)}
                className='p-1 rounded hover:bg-[var(--juhe-surface-2)]'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
            <div className='p-4 space-y-3 overflow-y-auto'>
              <div>
                <label htmlFor='skill-title' className='text-xs font-medium text-[var(--juhe-text-3)]'>{t('skills.form.title')}</label>
                <input
                  id='skill-title'
                  type='text'
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('skills.form.titlePlaceholder')}
                  className='w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
              </div>
              <div>
                <label htmlFor='skill-name' className='text-xs font-medium text-[var(--juhe-text-3)]'>{t('skills.form.name')}</label>
                <input
                  id='skill-name'
                  type='text'
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('skills.form.namePlaceholder')}
                  className='w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
              </div>
              <div>
                <label htmlFor='skill-description' className='text-xs font-medium text-[var(--juhe-text-3)]'>{t('skills.form.description')}</label>
                <input
                  id='skill-description'
                  type='text'
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('skills.form.descriptionPlaceholder')}
                  className='w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
              </div>
              <div>
                <label htmlFor='skill-content' className='text-xs font-medium text-[var(--juhe-text-3)]'>{t('skills.form.content')}</label>
                <textarea
                  id='skill-content'
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('skills.form.contentPlaceholder')}
                  rows={8}
                  className='w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] resize-none font-mono'
                />
              </div>
            </div>
            <div className='flex justify-end gap-2 px-4 py-3 border-t border-[var(--juhe-border)]'>
              <button
                type='button'
                onClick={() => setIsModalOpen(false)}
                className='px-3 py-1.5 text-sm rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
              >
                {t('common.cancel')}
              </button>
              <button
                type='button'
                onClick={handleSave}
                disabled={!formTitle.trim() || !formContent.trim()}
                className='flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity'
              >
                <Check className='w-3.5 h-3.5' />
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('skills.confirmDelete', { title: deleteTarget?.title || '' }) as string}
        description={t('skills.confirmDelete', { title: deleteTarget?.title || '' }) as string}
        confirmText={t('common.delete') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteSkill(deleteTarget.id)
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
