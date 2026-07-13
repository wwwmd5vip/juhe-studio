// 3D 导演台路由入口
import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'
import './director-3d-override.css'

const Director3DApp = lazy(() => import('../director-3d/App').then((m) => ({ default: m.default })))

export const Route = createFileRoute('/director-3d')({
  component: Director3DRoute
})

function Director3DRoute() {
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
        <Director3DApp />
      </Suspense>
    </div>
  )
}
