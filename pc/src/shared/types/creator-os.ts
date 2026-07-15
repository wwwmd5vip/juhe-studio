/**
 * Creator OS — 面向电商套图的项目型工作台领域类型
 *
 * 设计原则：
 * - Project 是顶层聚合根，一个 Project 包含多张 Asset、多个 CreatorTask、多个 Version、多个 Deliverable
 * - CreatorTask 表示「一次生成意图」，而非运行时队列任务
 * - Version 是 CreatorTask 的某个具体结果版本（支持重试生成多版本）
 * - Deliverable 是最终被选中用于导出的产物引用
 * - 所有 ID 使用 crypto.randomUUID()
 */

// ── Project ──

export type ProjectCategory = 'product_set' | 'general'

export type ProjectStatus = 'draft' | 'active' | 'archived'

export interface Project {
  id: string
  name: string
  category: ProjectCategory
  status: ProjectStatus
  description?: string | null
  /** 最近一次批量提交的状态 */
  batchStatus: BatchStatus
  /** 批量提交失败时的错误信息 */
  batchError?: string | null
  createdAt: string
  updatedAt: string
}

// ── Asset ──

export type AssetKind = 'source' | 'result'

export type AssetStatus = 'active' | 'deleted'

export interface Asset {
  id: string
  projectId: string
  kind: AssetKind
  filePath: string
  mimeType: string
  width?: number | null
  height?: number | null
  metadata?: Record<string, unknown> | null
  status: AssetStatus
  createdAt: string
  updatedAt: string
}

// ── CreatorTask (意图持久化行) ──

export type CreatorTaskIntentStatus = 'pending' | 'submitting' | 'completed' | 'failed' | 'needs_retry' | 'cancelled' | 'blocked'

export type CreatorTaskRuntimeStatus = 'pending' | 'submitting' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface CreatorTask {
  id: string
  projectId: string
  /** 关联到 generatons 表的 runtime id（生成队列中的 task.id） */
  runtimeTaskId: string
  /** 对应模板中的 slot id（如 'main', 'detail-1'）*/
  templateSlotId: string
  /** 套图内位置（0-7）*/
  slotIndex: number
  /** 意图层状态 */
  status: CreatorTaskIntentStatus
  /** 运行时状态 */
  runtimeStatus: CreatorTaskRuntimeStatus
  /** 失败时错误信息 */
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

// ── Version ──

export interface Version {
  id: string
  taskId: string
  /** 关联到 generations 表的 record id */
  generationId?: string | null
  versionNumber: number
  filePath: string
  mimeType: string
  isSelected: boolean
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// ── Template ──

export interface ProductSetSlotDefinition {
  id: string
  label: string
  modelId: string
  providerId: string
  type: 'image'
  required: boolean
}

export interface ProductSetTemplate {
  id: string
  name: string
  slots: ProductSetSlotDefinition[]
}

// ── Deliverable ──

export interface BrandKit {
  id: string
  name: string
  primaryColor: string
  secondaryColor: string | null
  logoPath: string | null
  fontFamily: string | null
  styleDescription: string | null
  createdAt: string
  updatedAt: string
}

export interface Deliverable {
  id: string
  projectId: string
  taskId: string
  versionId: string | null
  versionFilePath: string | null
  taskRuntimeStatus: string | null
  label: string
  slotIndex: number
  isSelected: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ── 批量状态机 ──

export type BatchStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'partial' | 'failed'

// ── IPC 返回值 ──

export interface ProductSetPreflightResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface ProductSetSubmitResult {
  ok: boolean
  error?: string
  warnings?: string[]
  taskCount?: number
  runtimeTaskIds?: string[]
}

export interface ProductSetRetryResult {
  ok: boolean
  retriedCount: number
  errors: string[]
}

export interface ProductSetCancelResult {
  ok: boolean
  cancelledCount: number
}

export interface ExportResult {
  ok: boolean
  exportedCount: number
  errors: string[]
}
