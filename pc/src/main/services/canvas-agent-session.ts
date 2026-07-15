/**
 * Canvas Agent Session Manager — MCP 工具调用的会话管理。
 *
 * 每个画布文档一个会话。负责：
 * 1. 缓存画布快照（避免频繁 IPC 往返）
 * 2. 记录操作历史（支持撤销/恢复）
 * 3. 管理并发操作锁
 */

import type { CanvasAgentSnapshot, CanvasAgentOp, CanvasAgentResult } from '@shared/types/canvas-agent'

interface CanvasSession {
  documentId: string
  snapshot: CanvasAgentSnapshot | null
  history: CanvasAgentOp[][]
  locked: boolean
  createdAt: number
  lastAccessedAt: number
}

const sessions = new Map<string, CanvasSession>()
const SESSION_TTL = 30 * 60 * 1000 // 30 分钟空闲过期

function getOrCreateSession(documentId: string): CanvasSession {
  let session = sessions.get(documentId)
  if (!session) {
    session = {
      documentId,
      snapshot: null,
      history: [],
      locked: false,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    }
    sessions.set(documentId, session)
  }
  session.lastAccessedAt = Date.now()
  return session
}

/** 清理过期会话 */
function cleanupStaleSessions(): void {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.lastAccessedAt > SESSION_TTL) {
      sessions.delete(id)
    }
  }
}

// 每 5 分钟清理一次
setInterval(cleanupStaleSessions, 5 * 60 * 1000)

/** 更新会话中的画布快照。通常由渲染进程推送。 */
export function updateSnapshot(documentId: string, snapshot: CanvasAgentSnapshot): void {
  const session = getOrCreateSession(documentId)
  session.snapshot = snapshot
}

/** 获取当前快照 */
export function getSnapshot(documentId: string): CanvasAgentSnapshot | null {
  return sessions.get(documentId)?.snapshot ?? null
}

/** 记录操作历史 */
export function recordOps(documentId: string, ops: CanvasAgentOp[]): void {
  const session = getOrCreateSession(documentId)
  session.history.push(ops)
  // 限制历史长度
  if (session.history.length > 100) {
    session.history = session.history.slice(-100)
  }
}

/** 获取最近的 N 条操作记录 */
export function getRecentOps(documentId: string, count = 5): CanvasAgentOp[][] {
  const session = sessions.get(documentId)
  if (!session) return []
  return session.history.slice(-count)
}

/** 加锁会话（防止并发操作冲突） */
export function lockSession(documentId: string): boolean {
  const session = getOrCreateSession(documentId)
  if (session.locked) return false
  session.locked = true
  return true
}

/** 解锁会话 */
export function unlockSession(documentId: string): void {
  const session = sessions.get(documentId)
  if (session) session.locked = false
}

/** 销毁会话 */
export function destroySession(documentId: string): void {
  sessions.delete(documentId)
}

/** 列出活跃会话 */
export function listActiveSessions(): string[] {
  return Array.from(sessions.keys())
}

/** 获取会话统计信息 */
export function getSessionStats(): { activeSessions: number; totalOps: number } {
  let totalOps = 0
  for (const s of sessions.values()) {
    totalOps += s.history.reduce((sum, ops) => sum + ops.length, 0)
  }
  return { activeSessions: sessions.size, totalOps }
}
