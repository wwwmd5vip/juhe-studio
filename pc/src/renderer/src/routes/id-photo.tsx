import { createFileRoute, Navigate } from '@tanstack/react-router'

// Redirect to unified Smart Tools framework
export const Route = createFileRoute('/id-photo')({
  component: () => <Navigate to='/smart-tools' search={{ tool: 'id-photo' }} replace />
})
