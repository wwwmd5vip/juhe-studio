import { beforeEach, describe, expect, it } from 'vitest'

// Simple queue implementation for testing
class TestQueue<T> {
  private items: T[] = []
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  enqueue(item: T): boolean {
    if (this.items.length >= this.maxSize) return false
    this.items.push(item)
    return true
  }

  dequeue(): T | undefined {
    return this.items.shift()
  }

  peek(): T | undefined {
    return this.items[0]
  }

  size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  isFull(): boolean {
    return this.items.length >= this.maxSize
  }

  clear(): void {
    this.items = []
  }

  toArray(): T[] {
    return [...this.items]
  }
}

describe('Queue', () => {
  let queue: TestQueue<string>

  beforeEach(() => {
    queue = new TestQueue<string>(5)
  })

  it('should enqueue items', () => {
    expect(queue.enqueue('a')).toBe(true)
    expect(queue.enqueue('b')).toBe(true)
    expect(queue.size()).toBe(2)
  })

  it('should dequeue items in FIFO order', () => {
    queue.enqueue('a')
    queue.enqueue('b')
    expect(queue.dequeue()).toBe('a')
    expect(queue.dequeue()).toBe('b')
    expect(queue.dequeue()).toBeUndefined()
  })

  it('should peek at front item without removing', () => {
    queue.enqueue('a')
    queue.enqueue('b')
    expect(queue.peek()).toBe('a')
    expect(queue.size()).toBe(2)
  })

  it('should respect max size', () => {
    queue.enqueue('a')
    queue.enqueue('b')
    queue.enqueue('c')
    queue.enqueue('d')
    queue.enqueue('e')
    expect(queue.isFull()).toBe(true)
    expect(queue.enqueue('f')).toBe(false)
    expect(queue.size()).toBe(5)
  })

  it('should clear all items', () => {
    queue.enqueue('a')
    queue.enqueue('b')
    queue.clear()
    expect(queue.isEmpty()).toBe(true)
    expect(queue.size()).toBe(0)
  })

  it('should check empty state', () => {
    expect(queue.isEmpty()).toBe(true)
    queue.enqueue('a')
    expect(queue.isEmpty()).toBe(false)
  })
})

describe('Priority Queue', () => {
  interface PriorityItem {
    id: string
    priority: number
  }

  class PriorityQueue {
    private items: PriorityItem[] = []

    enqueue(item: PriorityItem): void {
      const index = this.items.findIndex((i) => i.priority < item.priority)
      if (index === -1) {
        this.items.push(item)
      } else {
        this.items.splice(index, 0, item)
      }
    }

    dequeue(): PriorityItem | undefined {
      return this.items.shift()
    }

    size(): number {
      return this.items.length
    }
  }

  it('should order items by priority', () => {
    const pq = new PriorityQueue()
    pq.enqueue({ id: 'low', priority: 1 })
    pq.enqueue({ id: 'high', priority: 3 })
    pq.enqueue({ id: 'medium', priority: 2 })

    expect(pq.dequeue()?.id).toBe('high')
    expect(pq.dequeue()?.id).toBe('medium')
    expect(pq.dequeue()?.id).toBe('low')
  })
})
