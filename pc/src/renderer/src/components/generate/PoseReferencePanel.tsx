/**
 * PoseReferencePanel - 模特姿势参考面板
 * 复用导演台的 3D 人体模型和姿势系统，嵌入创作中心右侧面板
 * 支持将当前姿势截图上传为参考图
 */

import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Camera, X } from 'lucide-react'
import { ProceduralMannequin } from '@/director-3d/editor/runtime/mannequin/ProceduralMannequin'
import { MANNEQUIN_POSE_PRESETS } from '@/director-3d/editor/presets/mannequinPosePresets'
import { CHARACTER_BODY_PRESETS, type CharacterBodyType } from '@/director-3d/editor/runtime/mannequin/bodyTypes'
import { useGenerationStore } from '@/stores/generation'

interface PoseReferencePanelProps {
  onClose: () => void
}

function CaptureHelper({ captureRef }: { captureRef: React.MutableRefObject<(() => string) | null> }) {
  const { gl, scene, camera } = useThree()
  captureRef.current = () => {
    gl.render(scene, camera)
    return gl.domElement.toDataURL('image/png')
  }
  return null
}

function MannequinScene({ bodyType, controls }: { bodyType?: CharacterBodyType; controls: Record<string, number> }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={0.4} />
      <group position={[0, -0.9, 0]}>
        <ProceduralMannequin
          bodyType={bodyType}
          color="#6B8FD8"
          rigState={{ rigType: 'mannequin', posePresetId: null, controls }}
        />
      </group>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={1.5}
        maxDistance={6}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI * 0.85}
        minPolarAngle={Math.PI * 0.15}
      />
    </>
  )
}

export function PoseReferencePanel({ onClose }: PoseReferencePanelProps) {
  const { t } = useTranslation()
  const setParams = useGenerationStore((s) => s.setParams)

  const [selectedBodyType, setSelectedBodyType] = useState<CharacterBodyType | undefined>(undefined)
  const [selectedPoseId, setSelectedPoseId] = useState('stand')
  const [poseControls, setPoseControls] = useState<Record<string, number>>(MANNEQUIN_POSE_PRESETS[0].controls)
  const [isCapturing, setIsCapturing] = useState(false)
  const captureRef = useRef<(() => string) | null>(null)

  const handlePoseSelect = useCallback((poseId: string) => {
    setSelectedPoseId(poseId)
    const preset = MANNEQUIN_POSE_PRESETS.find((p) => p.id === poseId)
    if (preset) {
      setPoseControls({ ...preset.controls })
    }
  }, [])

  const handleCaptureAndUpload = useCallback(() => {
    if (!captureRef.current) return
    setIsCapturing(true)
    try {
      const dataUrl = captureRef.current()
      const base64 = dataUrl.split(',')[1]
      setParams({
        referenceImages: [`data:image/png;base64,${base64}`]
      })
      onClose()
    } catch (err) {
      console.error('[PoseReference] Capture failed:', err)
    } finally {
      setIsCapturing(false)
    }
  }, [onClose, setParams])

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex-none flex items-center justify-between px-4 py-2.5 border-b' style={{ borderColor: 'var(--juhe-border)' }}>
        <h3 className='text-sm font-semibold' style={{ color: 'var(--juhe-text)' }}>
          {t('generate.poseReference.title', '模特姿势参考')}
        </h3>
        <button
          type='button'
          onClick={onClose}
          className='p-1 rounded hover:bg-[var(--juhe-surface)]'
          style={{ color: 'var(--juhe-text-3)' }}
        >
          <X className='w-4 h-4' />
        </button>
      </div>

      {/* Body Type Selector */}
      <div className='flex-none px-4 py-2 border-b' style={{ borderColor: 'var(--juhe-border)' }}>
        <label className='block text-xs font-medium mb-1' style={{ color: 'var(--juhe-text-2)' }}>
          {t('generate.poseReference.bodyType', '体型')}
        </label>
        <select
          value={selectedBodyType ?? ''}
          onChange={(e) => setSelectedBodyType((e.target.value || undefined) as CharacterBodyType | undefined)}
          className='w-full px-2 py-1 rounded-lg border text-xs outline-none'
          style={{
            borderColor: 'var(--juhe-border)',
            background: 'var(--juhe-void)',
            color: 'var(--juhe-text)'
          }}
        >
          <option value=''>{t('generate.poseReference.defaultBody', '默认')}</option>
          {CHARACTER_BODY_PRESETS.map((preset) => (
            <option key={preset.bodyType} value={preset.bodyType}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3D Viewport */}
      <div className='flex-1 relative mx-4 my-2 rounded-xl overflow-hidden' style={{ minHeight: 200, background: '#1a1a2e' }}>
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [0, 0, 4], fov: 35 }}
          style={{ background: '#1a1a2e' }}
        >
          <CaptureHelper captureRef={captureRef} />
          <MannequinScene bodyType={selectedBodyType} controls={poseControls} />
        </Canvas>
        <div className='absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded' style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
          {t('generate.poseReference.dragToRotate', '拖拽旋转')}
        </div>
      </div>

      {/* Capture Button */}
      <div className='flex-none px-4 py-2'>
        <button
          type='button'
          onClick={handleCaptureAndUpload}
          disabled={isCapturing}
          className='w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50'
          style={{ background: 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-violet))' }}
        >
          <Camera className='w-3.5 h-3.5' />
          {isCapturing
            ? t('generate.poseReference.capturing', '捕获中...')
            : t('generate.poseReference.captureAndUpload', '截图并上传参考图')}
        </button>
      </div>

      {/* Pose Grid - scrollable */}
      <div className='flex-1 overflow-y-auto px-4 pb-4'>
        <label className='block text-xs font-medium mb-2' style={{ color: 'var(--juhe-text-2)' }}>
          {t('generate.poseReference.poses', '姿势')}
        </label>
        <div className='grid grid-cols-3 gap-1.5'>
          {MANNEQUIN_POSE_PRESETS.map((pose) => (
            <button
              key={pose.id}
              type='button'
              onClick={() => handlePoseSelect(pose.id)}
              className='px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors'
              style={{
                background: selectedPoseId === pose.id ? 'var(--juhe-cyan)' : 'var(--juhe-surface)',
                color: selectedPoseId === pose.id ? '#fff' : 'var(--juhe-text-2)',
                border: `1px solid ${selectedPoseId === pose.id ? 'var(--juhe-cyan)' : 'var(--juhe-border)'}`
              }}
            >
              {pose.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
