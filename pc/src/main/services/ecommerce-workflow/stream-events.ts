import { ECOMMERCE_WORKFLOW_STREAM_CHANNEL } from '@shared/ecommerce-workflow/constants'
import type { EcommerceWorkflowStreamEvent } from '@shared/ecommerce-workflow/types'

let mainWindowRef: WeakRef<Electron.BrowserWindow> | null = null

export function setWorkflowMainWindow(win: Electron.BrowserWindow) {
  mainWindowRef = new WeakRef(win)
}

export function unsetWorkflowMainWindow() {
  mainWindowRef = null
}

export function pushWorkflowStreamEvent(event: EcommerceWorkflowStreamEvent) {
  const win = mainWindowRef?.deref()
  if (win && !win.isDestroyed()) {
    win.webContents.send(ECOMMERCE_WORKFLOW_STREAM_CHANNEL, event)
  }
}
