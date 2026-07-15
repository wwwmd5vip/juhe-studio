import { createFileRoute } from '@tanstack/react-router'
import { ProjectList } from '@/pages/creator-os/ProjectList'

export const Route = createFileRoute('/projects/')({
  component: ProjectList
})
