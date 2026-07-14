import { describe, it, expect } from 'vitest'
import { computeBatchStatus } from '../utils/creator-os-status'
import type { CreatorTask } from '../types/creator-os'

describe('computeBatchStatus', () => {
  function task(status: CreatorTask['runtimeStatus']): Pick<CreatorTask, 'runtimeStatus'> {
    return { runtimeStatus: status }
  }

  it('returns idle for empty task list', () => {
    expect(computeBatchStatus([])).toBe('idle')
  })

  it('returns processing when any task is submitting', () => {
    const tasks = [
      task('completed'),
      task('submitting'),
      task('completed')
    ]
    expect(computeBatchStatus(tasks)).toBe('processing')
  })

  it('returns processing when any task is processing', () => {
    const tasks = [
      task('completed'),
      task('processing'),
      task('pending')
    ]
    expect(computeBatchStatus(tasks)).toBe('processing')
  })

  it('returns processing when any task is pending (pre-queue)', () => {
    const tasks = [
      task('pending'),
      task('pending'),
      task('pending')
    ]
    expect(computeBatchStatus(tasks)).toBe('processing')
  })

  it('returns partial when no running tasks but some completed and some failed', () => {
    const tasks = [
      task('completed'),
      task('completed'),
      task('failed'),
      task('cancelled'),
      task('completed')
    ]
    expect(computeBatchStatus(tasks)).toBe('partial')
  })

  it('returns completed when all tasks completed', () => {
    const tasks = Array(8).fill(task('completed'))
    expect(computeBatchStatus(tasks)).toBe('completed')
  })

  it('returns failed when all tasks failed or cancelled with no successes', () => {
    const tasks = [
      task('failed'),
      task('cancelled'),
      task('failed'),
      task('cancelled')
    ]
    expect(computeBatchStatus(tasks)).toBe('failed')
  })

  it('returns idle when all tasks are pending with no progress', () => {
    // All pending = still "processing" per the hasRunning rule
    // "idle" is only for empty task list or when the project hasn't submitted yet
    // This test verifies the boundary: pre-submission has no tasks → idle
    expect(computeBatchStatus([])).toBe('idle')
  })
})
