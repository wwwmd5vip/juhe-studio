// 3D 导演台路由入口
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'
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

function Director3DRoute() {
  const search = useSearch({ from: '/director-3d' })

  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return (
    <div className='director3d-routing-wrapper'>
      <Suspense
        fallback={
          <div className='flex h-full items-center justify-center'>
            <span className='text-sm'>加载 3D 导演台...</span>
          </div>
        }
      >
        <Director3DApp instanceId={search.instanceId} projectId={search.projectId} />
      </Suspense>
    </div>
  )
}
