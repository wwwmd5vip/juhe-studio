import path from 'node:path'
import { app, ipcMain } from 'electron'
import { z } from 'zod'
import { ECOMMERCE_PRODUCT_IMAGE_DIR } from '@shared/ecommerce-workflow/constants'
import {
  cancelTask,
  generateImages,
  generatePlan,
  generateSellingPoints,
  getTask,
  listTasks
} from '../services/ecommerce-showcase'

const IdSchema = z.string().min(1)
const LimitSchema = z.number().int().min(1).max(100).optional()

function validateProductImagePath(productImage: string): void {
  const rawPath = productImage.replace(/^(file:\/\/|juhe-image:\/\/)/, '')
  const resolved = path.resolve(rawPath)
  const allowedRoot = path.join(app.getPath('userData'), ECOMMERCE_PRODUCT_IMAGE_DIR)
  const relative = path.relative(allowedRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Access denied: productImage path is outside allowed directory`)
  }
}

function validateInput(input: unknown): void {
  if (input && typeof input === 'object' && 'productImage' in input) {
    const image = (input as Record<string, unknown>).productImage
    if (typeof image === 'string') {
      validateProductImagePath(image)
    }
  }
}

export function registerEcommerceShowcaseIpc() {
  ipcMain.handle('showcase:selling-points:generate', async (_, input) => {
    validateInput(input)
    return generateSellingPoints(input)
  })

  ipcMain.handle('showcase:plan:generate', async (_, input) => {
    validateInput(input)
    return generatePlan(input)
  })

  ipcMain.handle('showcase:images:generate', async (_, input) => {
    validateInput(input)
    return generateImages(input)
  })

  ipcMain.handle('showcase:tasks:get', async (_, id: string) => {
    const taskId = IdSchema.parse(id)
    return getTask(taskId)
  })

  ipcMain.handle('showcase:tasks:list', async (_, limit?: number) => {
    const validatedLimit = LimitSchema.parse(limit)
    return listTasks(validatedLimit)
  })

  ipcMain.handle('showcase:tasks:cancel', async (_, id: string) => {
    const taskId = IdSchema.parse(id)
    await cancelTask(taskId)
  })
}
