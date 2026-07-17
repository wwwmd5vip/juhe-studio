// 3D 导演台路由入口
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import './director-3d-override.css'

const Director3DApp = lazy(() => import('../director-3d/App').then((m) => ({ default: m.default })))

const director3dSearchSchema = z.object({
  instanceId: z.string().optional(),
  projectId: z.string().optional()
})

export const Route = createFileRoute('/director-3d')({
  validateSearch: director3dSearchSchema,
  component: Director3DRoute
})

interface Director3DErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface Director3DErrorBoundaryState {
  hasError: boolean
}

class Director3DErrorBoundary extends Component<Director3DErrorBoundaryProps, Director3DErrorBoundaryState> {
  constructor(props: Director3DErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): Director3DErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Director3D] runtime error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function Director3DRoute() {
  const search = useSearch({ from: '/director-3d' })
  const { t } = useTranslation()

  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return (
    <div className='director3d-routing-wrapper'>
      <Director3DErrorBoundary
        fallback={
          <div className='flex h-full items-center justify-center'>
            <span className='text-sm'>{t('director3d.error.loadFailed')}</span>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className='flex h-full items-center justify-center'>
              <span className='text-sm'>{t('director3d.common.loading')}</span>
            </div>
          }
        >
          <Director3DApp instanceId={search.instanceId} projectId={search.projectId} />
        </Suspense>
      </Director3DErrorBoundary>
    </div>
  )
}
