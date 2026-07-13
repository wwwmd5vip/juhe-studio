import { isMac, isWin } from '@/lib/platform'

export interface FileMetadata {
  id: string
  name: string
  path: string
  size: number
  ext: string
  type: string
  created_at: number
}

export type SendMessageShortcut = 'Enter' | 'Ctrl+Enter' | 'Command+Enter' | 'Shift+Enter' | 'Alt+Enter'

export const getTextFromDropEvent = async (e: React.DragEvent<HTMLDivElement>): Promise<string> => {
  return e.dataTransfer.getData('text')
}

export const getFilesFromDropEvent = async (e: React.DragEvent<HTMLDivElement>): Promise<FileMetadata[]> => {
  if (e.dataTransfer.files.length > 0) {
    const filePromises = [...e.dataTransfer.files].map(async (file) => {
      try {
        const fileApi = (
          window.api as unknown as {
            file: { getPathForFile: (file: File) => string | null; get: (path: string) => Promise<FileMetadata | null> }
          }
        ).file
        const filePath = fileApi.getPathForFile(file)
        if (filePath) {
          return fileApi.get(filePath)
        }
        return null
      } catch (error) {
        console.error('getFilesFromDropEvent - getPathForFile error:', error)
        return null
      }
    })

    const results = await Promise.allSettled(filePromises)
    const list: FileMetadata[] = []
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        list.push(result.value)
      } else if (result.status === 'rejected') {
        console.error('getFilesFromDropEvent:', result.reason)
      }
    }
    return list
  }

  return new Promise((resolve) => {
    let existCodefilesFormat = false
    for (const item of e.dataTransfer.items) {
      const { type } = item
      if (type === 'codefiles') {
        item.getAsString(async (filePathListString) => {
          try {
            const filePathList: string[] = JSON.parse(filePathListString)
            const fileApi = (window.api as unknown as { file: { get: (path: string) => Promise<FileMetadata | null> } })
              .file
            const filePathListPromises = filePathList.map((filePath) => fileApi.get(filePath))
            resolve(
              await Promise.allSettled(filePathListPromises).then((results) =>
                results
                  .filter((result) => result.status === 'fulfilled')
                  .filter((result) => result.value !== null)
                  .flatMap((result) => (result.value ? [result.value] : []))
              )
            )
          } catch {
            resolve([])
          }
        })

        existCodefilesFormat = true
        break
      }
    }

    if (!existCodefilesFormat) {
      resolve([])
    }
  })
}

// convert send message shortcut to human readable label
export const getSendMessageShortcutLabel = (shortcut: SendMessageShortcut) => {
  switch (shortcut) {
    case 'Enter':
      return 'Enter'
    case 'Ctrl+Enter':
      return 'Ctrl + Enter'
    case 'Alt+Enter':
      return `${isMac ? '⌥' : 'Alt'} + Enter`
    case 'Command+Enter':
      return `${isMac ? '⌘' : isWin ? 'Win' : 'Super'} + Enter`
    case 'Shift+Enter':
      return 'Shift + Enter'
    default:
      return shortcut
  }
}

// check if the send message key is pressed in textarea
export const isSendMessageKeyPressed = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  shortcut: SendMessageShortcut
) => {
  let isSendMessageKeyPressed = false
  switch (shortcut) {
    case 'Enter':
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) isSendMessageKeyPressed = true
      break
    case 'Ctrl+Enter':
      if (event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) isSendMessageKeyPressed = true
      break
    case 'Command+Enter':
      if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey) isSendMessageKeyPressed = true
      break
    case 'Alt+Enter':
      if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) isSendMessageKeyPressed = true
      break
    case 'Shift+Enter':
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) isSendMessageKeyPressed = true
      break
  }
  return isSendMessageKeyPressed
}
