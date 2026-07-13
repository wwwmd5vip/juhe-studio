export interface Skill {
  id: string
  name: string
  title: string
  description?: string
  content: string
  category?: string
  isEnabled?: boolean
  isBuiltin?: boolean
  metadata?: Record<string, unknown>
  icon?: string
  orderKey?: number
  createdAt: string
  updatedAt: string
}

export interface SkillMetadata {
  name: string
  description: string
  homepage?: string
  metadata?: Record<string, unknown>
}
