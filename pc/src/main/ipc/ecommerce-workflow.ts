import { createHash, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseModules } from '@main/services/ecommerce-workflow/module-generate-executor'
import { resolveStepPrompts } from '@main/services/ecommerce-workflow/prompt-resolver'
import { submitEcommerceModules } from '@main/services/ecommerce-workflow/submit-executor'
import { ECOMMERCE_PRODUCT_IMAGE_DIR } from '@shared/ecommerce-workflow/constants'
import { getWorkflowTemplate, WORKFLOW_TEMPLATES } from '@shared/ecommerce-workflow/templates'
import type { EcommerceWorkflow, WorkflowStepConfig } from '@shared/ecommerce-workflow/types'
import { createWorkflowFromTemplate } from '@shared/ecommerce-workflow/utils'
import { desc, eq } from 'drizzle-orm'
import { app, ipcMain } from 'electron'

import { db } from '../db'
import { ecommerceWorkflows } from '../db/schema'
import { runWorkflowStep } from '../services/ecommerce-workflow'
import {
  pushWorkflowStreamEvent,
  setWorkflowMainWindow,
  unsetWorkflowMainWindow
} from '../services/ecommerce-workflow/stream-events'

export { setWorkflowMainWindow, unsetWorkflowMainWindow }

interface CreateWorkflowRequest {
  templateId: string
  name?: string
  category?: string
}

interface RunStepRequest {
  workflowId: string
  stepId: string
  config: WorkflowStepConfig
  requestId?: string
}

interface SubmitRequest {
  workflowId: string
  modules?: EcommerceWorkflow['modules']
  referenceImage?: string
  referenceMode?: 'fusion' | 'controlnet' | 'ipadapter'
}

interface SaveImageRequest {
  dataUrl: string
  fileName?: string
}

function now() {
  return new Date().toISOString()
}

const runningRequests = new Map<string, { controller: AbortController; promise: Promise<unknown> }>()

function registerRequest(requestId: string, controller: AbortController, promise: Promise<unknown>) {
  const entry = { controller, promise }
  runningRequests.set(requestId, entry)
  promise.finally(() => {
    if (runningRequests.get(requestId) === entry) {
      runningRequests.delete(requestId)
    }
  })
}

export async function cancelWorkflowStep(requestId: string): Promise<void> {
  const entry = runningRequests.get(requestId)
  if (!entry) return
  entry.controller.abort()
  try {
    await entry.promise
  } catch {
    // Cancellation is best-effort; swallow rejections
  }
}

function parseDataUrl(dataUrl: string): { mime: string; ext: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 data URL')
  const mime = match[1]
  const base64 = match[2]
  const ext = mime.split('/')[1] || 'png'
  const buffer = Buffer.from(base64, 'base64')
  return { mime, ext, buffer }
}

export function registerEcommerceWorkflowIpc() {
  ipcMain.handle('ecommerce:workflow:templates:list', () => {
    try {
      return Object.values(WORKFLOW_TEMPLATES).map((t) => ({
        id: t.id,
        category: t.category,
        nameI18nKey: t.nameI18nKey,
        descriptionI18nKey: t.descriptionI18nKey,
        defaultContext: t.defaultContext
      }))
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:create', async (_event, req: CreateWorkflowRequest) => {
    try {
      const template = getWorkflowTemplate(req.templateId)
      const workflow = createWorkflowFromTemplate(template, req.category)
      if (req.name) workflow.name = req.name

      await db.insert(ecommerceWorkflows).values({
        ...workflow,
        context: workflow.context,
        steps: workflow.steps,
        modules: workflow.modules
      })

      return workflow
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:list', async () => {
    try {
      return db.select().from(ecommerceWorkflows).orderBy(desc(ecommerceWorkflows.updatedAt)).limit(100)
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:get', async (_event, id: string) => {
    try {
      const rows = await db.select().from(ecommerceWorkflows).where(eq(ecommerceWorkflows.id, id)).limit(1)
      return rows[0] || null
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:update', async (_event, id: string, data: Partial<EcommerceWorkflow>) => {
    try {
      const rest = Object.fromEntries(
        Object.entries(data).filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
      ) as Partial<EcommerceWorkflow>
      await db
        .update(ecommerceWorkflows)
        .set({ ...rest, updatedAt: now() })
        .where(eq(ecommerceWorkflows.id, id))
      return true
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:delete', async (_event, id: string) => {
    try {
      await db.delete(ecommerceWorkflows).where(eq(ecommerceWorkflows.id, id))
      return true
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:image:save', async (_event, req: SaveImageRequest) => {
    try {
      const { ext, buffer } = parseDataUrl(req.dataUrl)
      const hash = createHash('md5').update(buffer).digest('hex')
      // Security: sanitize fileName to prevent path traversal — only use basename
      const rawName = req.fileName || `${hash}.${ext}`
      const fileName = path.basename(rawName)
      const dir = path.join(app.getPath('userData'), ECOMMERCE_PRODUCT_IMAGE_DIR)
      await mkdir(dir, { recursive: true })
      // Security: resolve symlinks before constructing file path
      const resolvedDir = realpathSync(dir)
      const filePath = path.join(resolvedDir, fileName)
      // Security: verify resolved path stays within resolved dir
      if (!filePath.startsWith(resolvedDir + path.sep) && filePath !== resolvedDir) {
        throw new Error('Invalid file path')
      }
      // Atomic write: write to temp then rename to avoid corruption on crash
      const tmpPath = filePath + '.tmp.' + process.pid
      await writeFile(tmpPath, buffer)
      await rename(tmpPath, filePath)
      return `juhe-image://${filePath}`
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('ecommerce:workflow:step:run', async (_event, req: RunStepRequest) => {
    const requestId = req.requestId || randomUUID()
    const controller = new AbortController()

    const promise = (async () => {
      const workflowRows = await db
        .select()
        .from(ecommerceWorkflows)
        .where(eq(ecommerceWorkflows.id, req.workflowId))
        .limit(1)
      const workflow = workflowRows[0] as EcommerceWorkflow | undefined
      if (!workflow) throw new Error(`Workflow not found: ${req.workflowId}`)

      const template = getWorkflowTemplate(workflow.templateId)
      const stepDef = template.steps.find((s) => s.id === req.stepId)
      if (!stepDef) throw new Error(`Step not found in template: ${req.stepId}`)

      const stepState = workflow.steps.find((s) => s.id === req.stepId)
      if (!stepState) throw new Error(`Step state not found: ${req.stepId}`)

      // Collect outputs from ALL dependencies (not just the first one)
      const previousOutput =
        stepDef.dependencies.length > 0
          ? stepDef.dependencies
              .map((depId) => workflow.context.outputs?.[depId] ?? '')
              .filter(Boolean)
              .join('\n')
          : ''

      const prompts = resolveStepPrompts(workflow.templateId, req.stepId, workflow.context, req.config.systemPrompt)

      // Mark step as running
      stepState.status = 'running'
      stepState.config = req.config
      stepState.error = undefined
      await db
        .update(ecommerceWorkflows)
        .set({ steps: workflow.steps, updatedAt: now() })
        .where(eq(ecommerceWorkflows.id, workflow.id))

      try {
        const result = await runWorkflowStep({
          requestId,
          workflowId: workflow.id,
          stepId: req.stepId,
          stepType: stepDef.type as Parameters<typeof runWorkflowStep>[0]['stepType'],
          context: workflow.context,
          config: req.config,
          previousOutput,
          prompt: prompts,
          signal: controller.signal
        })

        stepState.status = 'success'
        stepState.output = result.output
        const outputs = { ...workflow.context.outputs, [req.stepId]: result.output }
        workflow.context = { ...workflow.context, ...result.context, outputs }

        if (stepDef.id === 'module-generate' && result.modules !== undefined) {
          workflow.modules = result.modules
        } else if (stepDef.outputFormat === 'modules') {
          try {
            workflow.modules = parseModules(result.output, req.config, workflow.context.ratio)
          } catch (parseError) {
            const parseMessage = parseError instanceof Error ? parseError.message : String(parseError)
            console.warn(`[EcommerceWorkflowIPC] Failed to parse modules for step ${req.stepId}: ${parseMessage}`)
          }
        }

        await db
          .update(ecommerceWorkflows)
          .set({
            context: workflow.context,
            steps: workflow.steps,
            modules: workflow.modules,
            status: workflow.status === 'draft' ? 'running' : workflow.status,
            updatedAt: now()
          })
          .where(eq(ecommerceWorkflows.id, workflow.id))

        return { output: result.output, modules: workflow.modules, context: workflow.context }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        stepState.status = 'error'
        stepState.error = message
        await db
          .update(ecommerceWorkflows)
          .set({ steps: workflow.steps, status: 'error', updatedAt: now() })
          .where(eq(ecommerceWorkflows.id, workflow.id))

        pushWorkflowStreamEvent({
          workflowId: workflow.id,
          stepId: req.stepId,
          requestId,
          type: 'error',
          error: message
        })

        throw new Error(`Step ${req.stepId} failed: ${message}`, { cause: error })
      }
    })()

    registerRequest(requestId, controller, promise)

    return await promise
  })

  ipcMain.handle('ecommerce:workflow:step:cancel', async (_event, requestId: string) => {
    if (typeof requestId !== 'string') return
    await cancelWorkflowStep(requestId)
  })

  ipcMain.handle('ecommerce:workflow:submit', async (_event, req: SubmitRequest) => {
    const workflowRows = await db
      .select()
      .from(ecommerceWorkflows)
      .where(eq(ecommerceWorkflows.id, req.workflowId))
      .limit(1)
    const workflow = workflowRows[0] as EcommerceWorkflow | undefined
    if (!workflow) throw new Error(`Workflow not found: ${req.workflowId}`)

    const modules = req.modules ?? workflow.modules
    const submissions = await submitEcommerceModules({
      workflowId: req.workflowId,
      modules,
      referenceImage: req.referenceImage ?? workflow.context.productImage,
      referenceMode: req.referenceMode
    })

    const submissionMap = new Map(submissions.map((s) => [s.moduleId, s.taskId]))
    const updatedModules = workflow.modules.map((m) => {
      const taskId = submissionMap.get(m.moduleId)
      if (!taskId) return m
      return { ...m, submittedTaskId: taskId, status: 'submitted' as const }
    })

    await db
      .update(ecommerceWorkflows)
      .set({ modules: updatedModules, status: 'completed', updatedAt: now() })
      .where(eq(ecommerceWorkflows.id, workflow.id))

    return { submissions, modules: updatedModules }
  })
}
