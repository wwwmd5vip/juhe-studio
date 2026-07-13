import { createFileRoute, Navigate } from '@tanstack/react-router'

// Redirect to unified Smart Tools framework
export const Route = createFileRoute('/photo-repair')({
  component: () => <Navigate to='/smart-tools' search={{ tool: 'photo-repair' }} replace />
})
