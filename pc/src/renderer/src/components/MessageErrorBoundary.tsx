import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

const ErrorFallback = ({ fallback, error }: { fallback?: React.ReactNode; error?: Error }) => {
  const { t } = useTranslation()

  const isDev = import.meta.env.DEV
  const errorDescription =
    isDev && error
      ? `${t('error.render.description', 'An error occurred')}: ${error.message}`
      : t('error.render.description', 'An error occurred')

  return (
    fallback || (
      <div
        role='alert'
        className='rounded-md border border-destructive/50 bg-[var(--juhe-magenta)]/10 px-3 py-2 text-sm'
      >
        <div className='font-medium text-[var(--juhe-magenta)]'>{t('error.render.title', 'Render Error')}</div>
        <div className='mt-1 text-[var(--juhe-text-3)]'>{errorDescription}</div>
      </div>
    )
  )
}

class MessageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback fallback={this.props.fallback} error={this.state.error} />
    }
    return this.props.children
  }
}

export default MessageErrorBoundary
