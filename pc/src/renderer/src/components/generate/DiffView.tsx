import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface DiffViewProps {
  original: string
  modified: string
}

type DiffOp = { type: 'equal' | 'add' | 'remove'; text: string }

function computeDiff(original: string, modified: string): DiffOp[] {
  const a = original.split(/(\s+)/)
  const b = modified.split(/(\s+)/)

  // Simple LCS (Longest Common Subsequence) for word-level diff
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const ops: DiffOp[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'equal', text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', text: b[j - 1] })
      j--
    } else {
      ops.unshift({ type: 'remove', text: a[i - 1] })
      i--
    }
  }

  // Merge consecutive ops of same type
  const merged: DiffOp[] = []
  for (const op of ops) {
    const last = merged[merged.length - 1]
    if (last && last.type === op.type) {
      last.text += op.text
    } else {
      merged.push({ type: op.type, text: op.text })
    }
  }

  return merged
}

export default function DiffView({ original, modified }: DiffViewProps) {
  const { t } = useTranslation()
  const diff = useMemo(() => computeDiff(original, modified), [original, modified])

  return (
    <div className='space-y-2'>
      <div className='text-xs font-medium text-[var(--juhe-text-3)] flex items-center gap-2'>
        <span className='inline-block w-2 h-2 rounded-full bg-red-500' />
        {t('generate.promptOptimizer.original')}
        <span className='text-[var(--juhe-text-3)]/50'>→</span>
        <span className='inline-block w-2 h-2 rounded-full bg-green-500' />
        {t('generate.promptOptimizer.result')}
      </div>
      <div className='text-xs bg-[var(--juhe-surface-2)]/50 border border-[var(--juhe-border)] rounded-md px-2 py-1.5 max-h-32 overflow-y-auto leading-relaxed text-[var(--juhe-text)]'>
        {diff.map((op, idx) => {
          const key = `${op.type}-${idx}-${op.text.slice(0, 8)}`
          if (op.type === 'equal') {
            return <span key={key}>{op.text}</span>
          }
          if (op.type === 'add') {
            return (
              <span key={key} className='bg-green-500/20 text-green-700 dark:text-green-400 rounded px-0.5'>
                {op.text}
              </span>
            )
          }
          return (
            <span
              key={key}
              className='bg-red-500/20 text-red-700 dark:text-red-400 rounded px-0.5 line-through decoration-red-500/60'
            >
              {op.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}
