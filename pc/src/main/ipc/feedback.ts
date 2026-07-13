/**
 * Feedback IPC Handler — sends user feedback to Juhe Management backend
 */

import { app, ipcMain, net } from 'electron'
import store, { getJuheBaseUrl } from '../stores/config'

export function registerFeedbackHandlers(): void {
  console.log('[Feedback] Registering feedback IPC handler...')

  ipcMain.handle(
    'feedback:submit',
    async (
      _event,
      data: {
        type: string
        title: string
        content: string
        contact?: string
      }
    ) => {
      const body = JSON.stringify({
        type: data.type,
        title: data.title,
        content: data.content,
        contact: data.contact || '',
        app_version: app.getVersion(),
        os: process.platform
      })

      const baseUrl = getJuheBaseUrl()
      const url = `${baseUrl}/api/public/feedback`

      console.log('[Feedback] Submitting feedback to:', url)

      const response = await net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(30_000) // 30s timeout
      })

      if (!response.ok) {
        let errBody = ''
        try {
          errBody = await response.text()
        } catch {
          /* ignore */
        }
        throw new Error(`Feedback submission failed: ${response.status} ${errBody}`)
      }

      return await response.json()
    }
  )
}
