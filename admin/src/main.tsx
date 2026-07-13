import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, message } from 'antd'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: Error) => {
        message.error(error.message || '操作失败，请稍后重试')
      },
    },
  },
})

// Global query error listener — shows error toast for any useQuery failure
const shownErrors = new Set<string>()
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'removed') {
    shownErrors.delete(event.query.queryHash)
    return
  }
  if (
    event.type === 'updated' &&
    event.query.state.status === 'error' &&
    event.query.state.error
  ) {
    const key = event.query.queryHash
    if (shownErrors.has(key)) return
    shownErrors.add(key)
    const err = event.query.state.error as Error
    message.error(err.message || '数据加载失败')
  } else if (
    event.type === 'updated' &&
    event.query.state.status === 'success'
  ) {
    // Clear suppression after recovery so subsequent errors show again
    shownErrors.delete(event.query.queryHash)
  }
})

// Global error handlers — prevent white screen on uncaught errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error })
}
window.onunhandledrejection = (event) => {
  console.error('Unhandled rejection:', event.reason)
  event.preventDefault()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AntdApp>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AntdApp>
  </React.StrictMode>,
)
