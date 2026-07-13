import { describe, expect, it } from 'vitest'
import type { GenerationTask, TaskPriority } from '../types/generation'

describe('Generation Types', () => {
  it('should create a valid generation task', () => {
    const task: GenerationTask = {
      id: 'test-id',
      type: 'image',
      status: 'pending',
      priority: 'normal',
      params: {
        prompt: 'test prompt',
        model: 'gpt-4'
      },
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    }

    expect(task.id).toBe('test-id')
    expect(task.type).toBe('image')
    expect(task.status).toBe('pending')
    expect(task.priority).toBe('normal')
    expect(task.params.prompt).toBe('test prompt')
    expect(task.outputs).toEqual([])
    expect(task.progress).toBe(0)
  })

  it('should support all generation types', () => {
    const types: Array<'image' | 'text' | 'video'> = ['image', 'text', 'video']
    for (const type of types) {
      const task: GenerationTask = {
        id: `test-${type}`,
        type,
        status: 'pending',
        priority: 'normal',
        params: { prompt: 'test' },
        outputs: [],
        progress: 0,
        stage: 'queued',
        createdAt: Date.now()
      }
      expect(task.type).toBe(type)
    }
  })

  it('should support all priority levels', () => {
    const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent']
    for (const priority of priorities) {
      const task: GenerationTask = {
        id: `test-${priority}`,
        type: 'image',
        status: 'pending',
        priority,
        params: { prompt: 'test' },
        outputs: [],
        progress: 0,
        stage: 'queued',
        createdAt: Date.now()
      }
      expect(task.priority).toBe(priority)
    }
  })

  it('should support all statuses', () => {
    const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'paused'] as const
    for (const status of statuses) {
      const task: GenerationTask = {
        id: `test-${status}`,
        type: 'image',
        status,
        priority: 'normal',
        params: { prompt: 'test' },
        outputs: [],
        progress: 0,
        stage: 'queued',
        createdAt: Date.now()
      }
      expect(task.status).toBe(status)
    }
  })
})
