import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MarkdownRendererProps {
  content: string
}

// Simple syntax highlighting for common keywords
const syntaxHighlight = (code: string, language?: string): string => {
  if (!language) return escapeHtml(code)

  const keywords = [
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'class',
    'import',
    'export',
    'from',
    'async',
    'await',
    'try',
    'catch',
    'throw',
    'new',
    'this',
    'typeof',
    'instanceof',
    'null',
    'undefined',
    'true',
    'false',
    'switch',
    'case',
    'break',
    'continue',
    'default',
    'interface',
    'type',
    'extends',
    'implements',
    'public',
    'private',
    'protected',
    'static',
    'readonly',
    'enum',
    'namespace',
    'module',
    'def',
    'class',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'return',
    'import',
    'from',
    'as',
    'try',
    'except',
    'finally',
    'with',
    'lambda',
    'yield',
    'raise',
    'assert',
    'del',
    'global',
    'nonlocal',
    'pass',
    'print',
    'len',
    'range',
    'list',
    'dict',
    'set',
    'tuple',
    'str',
    'int',
    'float',
    'bool',
    'None',
    'True',
    'False',
    'func',
    'package',
    'struct',
    'interface',
    'map',
    'chan',
    'go',
    'defer',
    'select',
    'range',
    'fallthrough',
    'goto',
    'let',
    'mut',
    'fn',
    'pub',
    'use',
    'mod',
    'match',
    'impl',
    'trait',
    'where',
    'loop',
    'move',
    'ref',
    'Box',
    'Vec',
    'Option',
    'Result',
    'String',
    'str',
    'echo',
    'function',
    'endfunction',
    'if',
    'endif',
    'foreach',
    'endforeach',
    'while',
    'endwhile',
    'macro',
    'endmacro',
    'require',
    'include',
    'target',
    'project',
    'add_executable',
    'add_library',
    'set',
    'get_property',
    'set_property'
  ]

  const types = [
    'string',
    'number',
    'boolean',
    'any',
    'void',
    'never',
    'unknown',
    'Array',
    'Promise',
    'Record',
    'Map',
    'Set',
    'Date',
    'RegExp',
    'Error',
    'Object',
    'Function',
    'Symbol',
    'BigInt',
    'int',
    'float',
    'double',
    'char',
    'byte',
    'short',
    'long',
    'unsigned',
    'signed',
    'bool',
    'size_t',
    'ssize_t',
    'ptrdiff_t',
    'uint8_t',
    'uint16_t',
    'uint32_t',
    'uint64_t',
    'int8_t',
    'int16_t',
    'int32_t',
    'int64_t'
  ]

  const builtins = [
    'console',
    'window',
    'document',
    'Math',
    'JSON',
    'parseInt',
    'parseFloat',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'fetch',
    'Promise',
    'Array',
    'Object',
    'String',
    'Number',
    'Boolean',
    'Date',
    'RegExp',
    'Error',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Reflect',
    'Proxy',
    'process',
    'require',
    'module',
    'exports',
    'global',
    'Buffer',
    '__dirname',
    '__filename',
    'print',
    'input',
    'open',
    'file',
    'os',
    'sys',
    'json',
    're',
    'math',
    'random',
    'datetime',
    'collections',
    'itertools',
    'functools',
    'typing',
    'pathlib',
    'path'
  ]

  let highlighted = escapeHtml(code)

  // Strings
  highlighted = highlighted.replace(
    /(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g,
    '<span class="text-green-400">$1</span>'
  )

  // Comments
  highlighted = highlighted.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|--.*$)/gm, '<span class="text-gray-500">$1</span>')

  // Numbers
  highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="text-orange-400">$1</span>')

  // Keywords
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g')
  highlighted = highlighted.replace(keywordRegex, '<span class="text-purple-400">$1</span>')

  // Types
  const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'g')
  highlighted = highlighted.replace(typeRegex, '<span class="text-yellow-300">$1</span>')

  // Builtins
  const builtinRegex = new RegExp(`\\b(${builtins.join('|')})\\b`, 'g')
  highlighted = highlighted.replace(builtinRegex, '<span class="text-cyan-400">$1</span>')

  // Function calls
  highlighted = highlighted.replace(/(\w+)(\s*\()/g, '<span class="text-blue-400">$1</span>$2')

  return highlighted
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Parse markdown into structured blocks
const parseMarkdown = (content: string) => {
  const blocks: Array<{
    type: string
    content?: string
    language?: string
    items?: string[]
    rows?: string[][]
    headers?: string[]
  }> = []

  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language: language || undefined
      })
      i++
      continue
    }

    // Tables
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().includes('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }

      // Parse table
      const rows = tableLines.map((row) =>
        row
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell !== '')
      )

      // Skip separator row (---)
      const dataRows = rows.filter((row) => !row.every((cell) => /^[-:]+$/.test(cell)))
      const separatorIndex = rows.findIndex((row) => row.every((cell) => /^[-:]+$/.test(cell)))

      blocks.push({
        type: 'table',
        headers: separatorIndex > 0 ? dataRows[0] : undefined,
        rows: separatorIndex > 0 ? dataRows.slice(1) : dataRows
      })
      continue
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trim())
        i++
      }
      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n')
      })
      continue
    }

    // Horizontal rules
    if (/^(---|___|\*\*\*)\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr', content: '' })
      i++
      continue
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      blocks.push({
        type: `h${level}`,
        content: headerMatch[2].trim()
      })
      i++
      continue
    }

    // Lists
    if (/^[\s]*[-*+]\s+/.test(line) || /^[\s]*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      const isOrdered = /^[\s]*\d+\.\s+/.test(line)
      while (i < lines.length && (/^[\s]*[-*+]\s+/.test(lines[i]) || /^[\s]*\d+\.\s+/.test(lines[i]))) {
        listItems.push(lines[i].replace(/^[\s]*(?:[-*+]|\d+\.)\s+/, ''))
        i++
      }
      blocks.push({
        type: isOrdered ? 'ol' : 'ul',
        items: listItems
      })
      continue
    }

    // Empty lines
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !/^[\s]*[-*+]\s+/.test(lines[i]) &&
      !/^[\s]*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('|') &&
      !/^(---|___|\*\*\*)\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({
      type: 'p',
      content: paraLines.join('\n')
    })
  }

  return blocks
}

// Render inline markdown (bold, italic, inline code, links)
const renderInline = (text: string): string => {
  let html = escapeHtml(text)

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 bg-[var(--juhe-surface-2)] rounded text-sm font-mono text-pink-400">$1</code>'
  )

  // Bold & italic combined
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
  html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through opacity-60">$1</del>')

  // Links — filter dangerous protocols
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_full: string, text: string, url: string) => {
      const safe = /^(https?:|mailto:|#|\/)/i.test(url) ? url : '#blocked'
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-[var(--juhe-cyan)] underline hover:opacity-80">${text}</a>`
    }
  )

  // Auto-detect URLs
  html = html.replace(
    /(?<!href=")https?:\/\/[^\s<]+/g,
    '<a href="$&" target="_blank" rel="noopener noreferrer" class="text-[var(--juhe-cyan)] underline hover:opacity-80">$&</a>'
  )

  return html
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { t } = useTranslation()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyCode = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const blocks = parseMarkdown(content)

  return (
    <div className='markdown-body space-y-3'>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-xl font-bold text-[var(--juhe-text)] mt-4 mb-2'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'h2':
            return (
              <h2
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-lg font-bold text-[var(--juhe-text)] mt-3 mb-2'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'h3':
            return (
              <h3
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-base font-bold text-[var(--juhe-text)] mt-3 mb-1'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'h4':
            return (
              <h4
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-sm font-bold text-[var(--juhe-text)] mt-2 mb-1'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'h5':
            return (
              <h5
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-sm font-semibold text-[var(--juhe-text)] mt-2 mb-1'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'h6':
            return (
              <h6
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-xs font-semibold text-[var(--juhe-text-3)] mt-2 mb-1'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '') }}
              />
            )
          case 'p':
            return (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='text-sm leading-relaxed text-[var(--juhe-text)]'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                dangerouslySetInnerHTML={{ __html: renderInline(block.content || '').replace(/\n/g, '<br />') }}
              />
            )
          case 'blockquote':
            return (
              <blockquote
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='border-l-4 border-[var(--juhe-cyan)]/30 pl-4 py-1 my-2 bg-[var(--juhe-surface-2)]/50 rounded-r'
              >
                <p
                  className='text-sm text-[var(--juhe-text-3)] italic'
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                  dangerouslySetInnerHTML={{ __html: renderInline(block.content || '').replace(/\n/g, '<br />') }}
                />
              </blockquote>
            )
          case 'ul':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<ul key={index} className='list-disc list-inside space-y-1 text-sm text-[var(--juhe-text)]'>
                {block.items?.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
// biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
<li key={itemIndex} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ul>
            )
          case 'ol':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<ol key={index} className='list-decimal list-inside space-y-1 text-sm text-[var(--juhe-text)]'>
                {block.items?.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
// biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
<li key={itemIndex} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ol>
            )
          case 'code': {
            const codeId = `code-${index}`
            const isCopied = copiedId === codeId
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={index} className='relative group my-3'>
                {block.language && (
                  <div className='flex items-center justify-between px-3 py-1.5 bg-zinc-800 rounded-t-lg border-b border-zinc-700'>
                    <span className='text-xs text-zinc-400 font-mono'>{block.language}</span>
                    <button
                      type='button'
                      onClick={() => block.content && handleCopyCode(block.content, codeId)}
                      className='flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors'
                    >
                      {isCopied ? (
                        <>
                          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                          <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                          </svg>
                          {t('chat.copied')}
                        </>
                      ) : (
                        <>
                          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                          <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                            />
                          </svg>
                          {t('chat.copyCode')}
                        </>
                      )}
                    </button>
                  </div>
                )}
                <pre
                  className={`overflow-x-auto p-4 bg-zinc-900 text-zinc-100 text-sm font-mono leading-relaxed ${block.language ? 'rounded-b-lg' : 'rounded-lg'}`}
                >
                  <code
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                    dangerouslySetInnerHTML={{
                      __html: syntaxHighlight(block.content || '', block.language)
                    }}
                  />
                </pre>
                {!block.language && (
                  <button
                    type='button'
                    onClick={() => block.content && handleCopyCode(block.content, codeId)}
                    className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-all bg-zinc-800 px-2 py-1 rounded'
                  >
                    {isCopied ? (
                      <>
                        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                        <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                        </svg>
                        {t('chat.copied')}
                      </>
                    ) : (
                      <>
                        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                        <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                          />
                        </svg>
                        {t('chat.copyCode')}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          }
          case 'table':
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={index} className='overflow-x-auto my-3'>
                <table className='w-full text-sm border-collapse'>
                  {block.headers && (
                    <thead>
                      <tr className='bg-[var(--juhe-surface-2)]'>
                        {block.headers.map((header, hIndex) => (
                          <th
                            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                            key={hIndex}
                            className='px-3 py-2 text-left font-semibold text-[var(--juhe-text)] border border-[var(--juhe-border)]'
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                            dangerouslySetInnerHTML={{ __html: renderInline(header) }}
                          />
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {block.rows?.map((row, rIndex) => (
                      <tr
                        // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                        key={rIndex}
                        className={rIndex % 2 === 0 ? 'bg-[var(--juhe-void-2)]' : 'bg-[var(--juhe-surface-2)]/30'}
                      >
                        {row.map((cell, cIndex) => (
                          <td
                            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                            key={cIndex}
                            className='px-3 py-2 text-[var(--juhe-text)] border border-[var(--juhe-border)]'
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: ignored using `--suppress`
                            dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
            return <hr key={index} className='border-[var(--juhe-border)] my-4' />
          default:
            return null
        }
      })}
    </div>
  )
})
