import { Tooltip } from '@cherrystudio/ui'
import {
  Camera,
  Check,
  Copy,
  Download,
  Focus,
  Grid3X3,
  Group,
  ImageIcon,
  LayoutGrid,
  MessageSquare,
  Palette,
  Redo2,
  Save,
  Settings2,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Zap
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { type CanvasBackgroundMode, type CanvasTheme, canvasThemes } from './canvas-theme'

interface CanvasToolbarProps {
  canUndo: boolean
  canRedo: boolean
  selectionCount: number
  isRunning: boolean
  onUndo: () => void
  onRedo: () => void
  onFitView: () => void
  onAutoLayout?: () => void
  onImport: () => void
  onExport: () => void
  onSave?: () => void
  onRunAll: () => void
  onDeleteSelected: () => void
  onDuplicateSelected: () => void
  onGroupSelected: () => void
  onClearCanvas: () => void
  onExportImage?: () => void
  onToggleAssistant?: () => void
  isAssistantOpen?: boolean
  /** 外观设置 */
  backgroundMode?: CanvasBackgroundMode
  showImageInfo?: boolean
  onBackgroundModeChange?: (mode: CanvasBackgroundMode) => void
  onToggleTheme?: () => void
  onToggleImageInfo?: () => void
  onAppearance?: () => void
  onAssets?: () => void
}

export function CanvasToolbar({
  canUndo,
  canRedo,
  selectionCount,
  isRunning,
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  onImport,
  onExport,
  onSave,
  onRunAll,
  onDeleteSelected,
  onDuplicateSelected,
  onGroupSelected,
  onExportImage,
  onToggleAssistant,
  isAssistantOpen,
  backgroundMode = 'dots',
  showImageInfo,
  onBackgroundModeChange,
  onToggleTheme,
  onToggleImageInfo,
  onAppearance,
  onAssets
}: CanvasToolbarProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const [showAppearance, setShowAppearance] = useState(false)

  const dockStyle = {
    background: theme.toolbar.panel,
    borderColor: theme.toolbar.border,
    color: theme.toolbar.item,
    boxShadow: themeResolved === 'dark' ? '0 18px 45px rgba(0,0,0,.32)' : '0 16px 40px rgba(28,25,23,.12)'
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='absolute bottom-5 left-1/2 z-50 -translate-x-1/2'
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className='flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-lg backdrop-blur' style={dockStyle}>
        <ToolbarButton onClick={onUndo} disabled={!canUndo} title={t('canvas.actions.undo')} theme={theme}>
          <Undo2 className='size-4' />
        </ToolbarButton>

        <ToolbarButton onClick={onRedo} disabled={!canRedo} title={t('canvas.actions.redo')} theme={theme}>
          <Redo2 className='size-4' />
        </ToolbarButton>

        <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />

        <ToolbarButton onClick={onFitView} title={t('canvas.actions.fitView')} theme={theme}>
          <Focus className='size-4' />
        </ToolbarButton>

        {onAutoLayout && (
          <ToolbarButton onClick={onAutoLayout} title={t('canvas.actions.autoLayout')} theme={theme}>
            <LayoutGrid className='size-4' />
          </ToolbarButton>
        )}

        <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />

        {selectionCount > 0 && (
          <>
            <ToolbarButton onClick={onDeleteSelected} title={t('canvas.menu.delete')} theme={theme}>
              <Trash2 className='size-4' />
            </ToolbarButton>
            <ToolbarButton onClick={onDuplicateSelected} title={t('canvas.menu.duplicate')} theme={theme}>
              <Copy className='size-4' />
            </ToolbarButton>
            {selectionCount >= 2 && (
              <ToolbarButton onClick={onGroupSelected} title={t('canvas.menu.createGroup')} theme={theme}>
                <Group className='size-4' />
              </ToolbarButton>
            )}
            <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />
          </>
        )}

        <ToolbarButton onClick={onImport} title={t('canvas.actions.import')} theme={theme}>
          <Upload className='size-4' />
        </ToolbarButton>
        <ToolbarButton onClick={onExport} title={t('canvas.actions.export')} theme={theme}>
          <Download className='size-4' />
        </ToolbarButton>
        {onExportImage && (
          <ToolbarButton onClick={onExportImage} title={t('canvas.actions.exportImage')} theme={theme}>
            <Camera className='size-4' />
          </ToolbarButton>
        )}
        {onAssets && (
          <ToolbarButton onClick={onAssets} title={t('canvas.toolbar.assets')} theme={theme}>
            <ImageIcon className='size-4' />
          </ToolbarButton>
        )}
        {onSave && (
          <ToolbarButton onClick={onSave} title={t('canvas.actions.save')} theme={theme}>
            <Save className='size-4' />
          </ToolbarButton>
        )}

        <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />

        <ToolbarButton onClick={onRunAll} disabled={isRunning} title={t('canvas.actions.runAll')} theme={theme}>
          <Zap className='size-4' />
        </ToolbarButton>

        {onToggleAssistant && (
          <>
            <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />
            <ToolbarButton onClick={onToggleAssistant} title={t('canvas.toolbar.assistant')} theme={theme}>
              <MessageSquare className='size-4' style={{ color: isAssistantOpen ? '#06b6d4' : undefined }} />
            </ToolbarButton>
          </>
        )}

        {/* Appearance settings */}
        {onBackgroundModeChange && (
          <>
            <div className='mx-1 h-4 w-px' style={{ background: theme.toolbar.border }} />
            <div className='relative'>
              <ToolbarButton
                onClick={() => setShowAppearance((v) => !v)}
                title={t('canvas.toolbar.appearanceSettings')}
                theme={theme}
              >
                <Palette className='size-4' style={{ color: showAppearance ? '#8b5cf6' : undefined }} />
              </ToolbarButton>
              {showAppearance && (
                // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
                  className='absolute bottom-full left-1/2 -translate-x-1/2 mb-3 rounded-xl border p-2.5 shadow-xl backdrop-blur flex flex-col gap-2 w-52'
                  style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Theme toggle */}
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px]' style={{ color: theme.toolbar.item }}>
                      {t('canvas.toolbar.theme')}
                    </span>
                    <button
                      type='button'
                      className='flex size-7 items-center justify-center rounded-lg transition-colors'
                      style={{
                        background: themeResolved === 'dark' ? '#3a3631' : '#e7e5df',
                        color: theme.toolbar.item
                      }}
                      onClick={onToggleTheme}
                      title={
                        themeResolved === 'dark' ? t('canvas.toolbar.switchLight') : t('canvas.toolbar.switchDark')
                      }
                    >
                      <Sun className='size-3.5' />
                    </button>
                  </div>

                  {/* Background mode */}
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px]' style={{ color: theme.toolbar.item }}>
                      {t('canvas.toolbar.grid')}
                    </span>
                    <div className='flex gap-0.5'>
                      {(['dots', 'lines', 'blank'] as CanvasBackgroundMode[]).map((m) => (
                        <button
                          type='button'
                          key={m}
                          className='flex size-7 items-center justify-center rounded-lg transition-colors'
                          style={{
                            background: backgroundMode === m ? theme.toolbar.activeBg : 'transparent',
                            color: backgroundMode === m ? theme.toolbar.activeText : theme.toolbar.item
                          }}
                          onClick={() => onBackgroundModeChange(m)}
                          title={
                            m === 'dots'
                              ? t('canvas.toolbar.gridDots')
                              : m === 'lines'
                                ? t('canvas.toolbar.gridLines')
                                : t('canvas.toolbar.gridBlank')
                          }
                        >
                          <Grid3X3 className='size-3.5' />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image info toggle */}
                  {onToggleImageInfo && (
                    <div className='flex items-center justify-between'>
                      <span className='text-[11px]' style={{ color: theme.toolbar.item }}>
                        {t('canvas.toolbar.imageInfo')}
                      </span>
                      <button
                        type='button'
                        className='flex size-7 items-center justify-center rounded-lg transition-colors'
                        style={{
                          background: showImageInfo ? theme.toolbar.activeBg : 'transparent',
                          color: showImageInfo ? theme.toolbar.activeText : theme.toolbar.item
                        }}
                        onClick={onToggleImageInfo}
                      >
                        {showImageInfo ? (
                          <Check className='size-3.5' />
                        ) : (
                          <span className='text-[11px]'>{t('canvas.toolbar.off')}</span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Appearance settings shortcut */}
                  {onAppearance && (
                    <div className='flex items-center justify-between'>
                      <span className='text-[11px]' style={{ color: theme.toolbar.item }}>
                        {t('canvas.toolbar.appearanceLabel')}
                      </span>
                      <button
                        type='button'
                        className='flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-white/5'
                        style={{ color: theme.toolbar.item }}
                        onClick={onAppearance}
                      >
                        <Settings2 className='size-3.5' />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
  theme
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  theme: CanvasTheme
}) {
  return (
    <Tooltip title={title}>
      <button
        type='button'
        onClick={onClick}
        disabled={disabled}
        className='flex size-8 items-center justify-center rounded-lg transition-colors hover:opacity-80 disabled:opacity-30'
        style={{ color: theme.toolbar.item }}
        aria-label={title}
      >
        {children}
      </button>
    </Tooltip>
  )
}
