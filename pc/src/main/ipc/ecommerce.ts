/**
 * 电商套图 Agent IPC — 一键生成 4 张套图
 */
import { ipcMain } from 'electron'
import { generateProductSet } from '../services/ecommerce-showcase/product-set-service'
import type { ProductSetRequest, ProductSetResult } from '@shared/ecommerce-workflow/product-set-types'

export function registerEcommerceIpc(): void {
  ipcMain.handle(
    'ecommerce:product-set:generate',
    async (_event, req: ProductSetRequest): Promise<ProductSetResult> => {
      return generateProductSet(req)
    }
  )
}
