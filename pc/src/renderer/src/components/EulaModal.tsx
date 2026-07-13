import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface EulaModalProps {
  onAccept: () => void
}

export default function EulaModal({ onAccept }: EulaModalProps) {
  const [eulaContent, setEulaContent] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.app
      .getEula()
      .then((content) => {
        setEulaContent(content || '')
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const handleQuit = () => {
    window.api.app.quit()
  }

  const handleAccept = () => {
    if (!agreed) return
    onAccept()
  }

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='relative w-full max-w-2xl max-h-[90vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h1 className='text-lg font-semibold text-gray-900 dark:text-white'>用户协议 / End User License Agreement</h1>
          <button
            type='button'
            onClick={handleQuit}
            className='p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            aria-label='关闭 / Close'
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-hidden px-6 py-4'>
          {loading ? (
            <div className='flex items-center justify-center h-64'>
              <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
            </div>
          ) : (
            <textarea
              readOnly
              value={eulaContent}
              className='w-full h-[50vh] resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-mono whitespace-pre-wrap focus:outline-none'
            />
          )}
        </div>

        {/* Footer */}
        <div className='px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3'>
          {/* Checkbox */}
          <label className='flex items-center gap-3 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className='w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer'
            />
            <span className='text-sm text-gray-700 dark:text-gray-300'>我已阅读并同意 / I have read and agree</span>
          </label>

          {/* Buttons */}
          <div className='flex gap-3 justify-end'>
            <button
              type='button'
              onClick={handleQuit}
              className='px-5 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            >
              退出 / Exit
            </button>
            <button
              type='button'
              onClick={handleAccept}
              disabled={!agreed}
              className='px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            >
              同意并继续 / Agree and Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
