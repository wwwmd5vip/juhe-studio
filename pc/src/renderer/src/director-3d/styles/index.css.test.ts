import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.resolve(__dirname, 'index.css')
const css = fs.readFileSync(cssPath, 'utf-8')

describe('director-3d global CSS scoping', () => {
  it('does not use bare html/body/#root/global * selectors', () => {
    const globalSelectors = [
      /^html\s*\{/m,
      /^body\s*\{/m,
      /^#root\s*\{/m,
      /^\*\s*\{/m
    ]
    for (const pattern of globalSelectors) {
      expect(css).not.toMatch(pattern)
    }
  })

  it('does not use top-level :root selector', () => {
    expect(css).not.toMatch(/^:root\s*\{/m)
  })

  it('scopes variables and resets under .director3d-routing-wrapper', () => {
    expect(css).toMatch(/\.director3d-routing-wrapper\s*\{/)
  })

  it('uses ancestor-aware dark-mode selector', () => {
    expect(css).toMatch(/\.dark\s+\.director3d-routing-wrapper/)
  })
})
