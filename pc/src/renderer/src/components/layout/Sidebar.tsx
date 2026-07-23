import { Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock,
  Globe,
  HardDrive,
  Heart,
  Home,
  Layers,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  UserSquare,
  Users,
  Volume2,
  Workflow,
  Wrench,
  Zap
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const navGroups = [
  {
    id: 'core',
    collapsible: false,
    defaultExpanded: true,
    items: [{ to: '/', labelKey: 'nav.home', icon: Home }]
  },
  {
    id: 'creator-os',
    labelKey: 'nav.groups.creator-os',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { to: '/projects', labelKey: 'creator-os.projects', icon: ShoppingBag }
    ]
  },
  {
    id: 'create',
    labelKey: 'nav.groups.create',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { to: '/generate', labelKey: 'nav.generate', icon: Sparkles },
      { to: '/smart-tools', labelKey: 'nav.smartTools', icon: Wrench },
      { to: '/ecommerce', labelKey: 'nav.ecommerce', icon: ShoppingBag },
      { to: '/ecommerce-workflow', labelKey: 'nav.ecommerceWorkflow', icon: Workflow },
      { to: '/ecommerce-showcase', labelKey: 'nav.ecommerceShowcase', icon: LayoutGrid },
      { to: '/director-3d', labelKey: 'nav.director3d', icon: Clapperboard },
      { to: '/tts', labelKey: 'nav.tts', icon: Volume2 },
      { to: '/community', labelKey: 'nav.community', icon: Users }
    ]
  },
  {
    id: 'chat',
    labelKey: 'nav.groups.chat',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { to: '/chat', labelKey: 'nav.chat', icon: MessageSquare },
      { to: '/conversations', labelKey: 'nav.conversations', icon: MessageSquare },
      { to: '/agent-squad', labelKey: 'nav.agentSquad', icon: Users },
      { to: '/agents', labelKey: 'nav.agents', icon: Brain },
      { to: '/research', labelKey: 'nav.research', icon: Search }
    ]
  },
  {
    id: 'tools',
    labelKey: 'nav.groups.tools',
    collapsible: true,
    defaultExpanded: true,
    items: [
      { to: '/canvas', labelKey: 'nav.canvas', icon: LayoutGrid },
      { to: '/prompts', labelKey: 'nav.prompts', icon: BookOpen },
      { to: '/skills', labelKey: 'nav.skills', icon: Wrench },
      { to: '/memory', labelKey: 'nav.memory', icon: Brain },
      { to: '/favorites', labelKey: 'favorites.title', icon: Heart },
      { to: '/queue', labelKey: 'nav.queue', icon: Zap },
      { to: '/video-editor', labelKey: 'nav.videoEditor', icon: Clapperboard },
      { to: '/id-photo', labelKey: 'nav.idPhoto', icon: UserSquare },
      { to: '/photo-repair', labelKey: 'nav.photoRepair', icon: Wrench },
      { to: '/product-composition', labelKey: 'nav.productComposition', icon: Layers }
    ]
  },
  {
    id: 'system',
    labelKey: 'nav.groups.system',
    collapsible: true,
    defaultExpanded: false,
    items: [
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
      { to: '/usage', labelKey: 'nav.usage', icon: BarChart3 },
      { to: '/backup', labelKey: 'nav.backup', icon: HardDrive }
    ]
  }
]

export function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = expanded || pinned

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    navGroups.forEach((g) => {
      if (g.collapsible) initial[g.id] = !g.defaultExpanded
    })
    return initial
  })

  const handleMouseEnter = () => {
    if (!pinned) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => setExpanded(true), 60)
    }
  }

  const handleMouseLeave = () => {
    if (!pinned) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => setExpanded(false), 150)
    }
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  return (
    <aside
      className='flex flex-col transition-[width] duration-200 ease-out relative z-20 h-full'
      style={{
        width: isExpanded ? 210 : 56,
        background: 'linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(8,8,16,0.95) 100%)',
        borderRight: '1px solid rgba(0,240,255,0.06)',
        willChange: 'width'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Subtle vertical glow line */}
      <div
        className='absolute right-0 top-0 bottom-0 w-px pointer-events-none'
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,240,255,0.15), transparent)' }}
      />

      {/* Nav */}
      <nav className='flex-1 overflow-y-auto py-3 px-2 space-y-1'>
        {navGroups.map((group) => {
          const isGroupCollapsed = group.collapsible && collapsedGroups[group.id]
          return (
            <div key={group.id}>
              {/* Group header — clickable to collapse when expanded */}
              {group.labelKey && isExpanded && (
                <button
                  type='button'
                  className='w-full flex items-center justify-between px-2.5 py-1 mb-1 mt-2 first:mt-0 hover:bg-white/[0.02] rounded-md transition-colors'
                  onClick={() => group.collapsible && toggleGroup(group.id)}
                >
                  <span className='text-[9px] font-semibold tracking-[0.15em] uppercase text-[var(--juhe-text-dim)] [font-family:var(--font-display)]'>
                    {t(group.labelKey)}
                  </span>
                  {group.collapsible && (
                    <ChevronDown
                      size={10}
                      className='text-[var(--juhe-text-dim)] transition-transform duration-200'
                      style={{ transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    />
                  )}
                </button>
              )}

              {/* Divider between groups when collapsed */}
              {group.labelKey && !isExpanded && <div className='my-1.5 mx-3 border-t border-white/[0.04]' />}

              {/* Group items */}
              {(!isGroupCollapsed || !isExpanded) && (
                <div className='space-y-0.5'>
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.to
                    const isChildActive = !isActive && location.pathname.startsWith(item.to + '/')
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center gap-2.5 rounded-lg transition-all duration-200 group relative ${
                          isActive
                            ? 'border-l-2 border-l-[var(--juhe-cyan)]'
                            : 'border-l-2 border-l-transparent'
                        }`}
                        style={{
                          padding: isExpanded ? '6px 8px' : '6px',
                          justifyContent: isExpanded ? 'flex-start' : 'center',
                          background: isActive
                            ? 'linear-gradient(90deg, rgba(0,240,255,0.1) 0%, rgba(0,240,255,0.02) 100%)'
                            : 'transparent'
                        }}
                        title={!isExpanded ? t(item.labelKey) : undefined}
                      >
                        {/* Active / child-active glow */}
                        {(isActive || isChildActive) && (
                          <div
                            className='absolute inset-0 rounded-lg pointer-events-none'
                            style={{ boxShadow: 'inset 0 0 16px rgba(0,240,255,0.06)' }}
                          />
                        )}

                        <item.icon
                          size={17}
                          strokeWidth={1.8}
                          style={{
                            filter: isActive
                              ? 'drop-shadow(0 0 4px rgba(0,240,255,0.5))'
                              : isChildActive
                                ? 'drop-shadow(0 0 2px rgba(0,240,255,0.3))'
                                : 'none',
                            transition: 'all 0.2s',
                            flexShrink: 0
                          }}
                          className={`group-hover:text-[var(--juhe-text-2)] ${
                            isActive
                              ? 'text-[var(--juhe-cyan)]'
                              : isChildActive
                                ? 'text-[var(--juhe-text-2)]'
                                : 'text-[var(--juhe-text-3)]'
                          }`}
                        />
                        {isExpanded && (
                          <span
                            className={`text-[12px] truncate transition-colors ${
                              isActive
                                ? 'text-[var(--juhe-text)] font-medium'
                                : isChildActive
                                  ? 'text-[var(--juhe-text-2)] font-normal'
                                  : 'text-[var(--juhe-text-3)] font-normal'
                            }`}
                          >
                            {t(item.labelKey)}
                          </span>
                        )}

                        {/* Active indicator dot when collapsed */}
                        {isActive && !isExpanded && (
                          <div className='absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[var(--juhe-cyan)] shadow-[0 0 6px_var(--juhe-cyan)]' />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Pin toggle */}
      <div className='py-2 px-2 border-t flex justify-center shrink-0' style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <button
          type='button'
          onClick={() => setPinned((p) => !p)}
          className={`p-1.5 rounded-md transition-all ${pinned ? 'text-[var(--juhe-cyan)]' : 'text-[var(--juhe-text-dim)]'}`}
          title={pinned ? t('nav.unpinSidebar') : t('nav.pinSidebar')}
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            className='transition-transform duration-300'
            style={{ transform: pinned ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>

      {/* Language switcher */}
      <div className='py-2 px-2 border-t flex justify-center shrink-0' style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <LanguageSwitcher />
      </div>
    </aside>
  )
}

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const currentLang = i18n.language === 'zh-CN' ? '中文' : 'EN'

  const switchLang = (lng: string) => {
    i18n.changeLanguage(lng)
    setOpen(false)
  }

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='p-1.5 rounded-md text-[var(--juhe-text-dim)] hover:text-[var(--juhe-text-2)] transition-colors flex items-center gap-1.5'
        title='Language'
      >
        <Globe size={14} />
        <span className='text-[10px] font-medium'>{currentLang}</span>
      </button>
      {open && (
        <div className='absolute bottom-full left-0 mb-1 bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg shadow-xl overflow-hidden z-50 min-w-[90px]'>
          <button
            type='button'
            onClick={() => switchLang('zh-CN')}
            className={`w-full px-3 py-1.5 text-[11px] text-left transition-colors ${i18n.language === 'zh-CN' ? 'text-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5' : 'text-[var(--juhe-text-2)] hover:bg-[var(--juhe-surface-2)]'}`}
          >
            中文
          </button>
          <button
            type='button'
            onClick={() => switchLang('en')}
            className={`w-full px-3 py-1.5 text-[11px] text-left transition-colors ${i18n.language === 'en' ? 'text-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5' : 'text-[var(--juhe-text-2)] hover:bg-[var(--juhe-surface-2)]'}`}
          >
            English
          </button>
        </div>
      )}
    </div>
  )
}
