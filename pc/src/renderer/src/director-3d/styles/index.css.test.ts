// NOTE: This test originally validated the standalone 3D director desk CSS
// (root vars, home-screen layout, etc.). After migration to pc/ it has been
// narrowed to CSS-scoping invariants because the home screen was removed in
// Task 4 and all tokens are now scoped to .director3d-routing-wrapper.

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const cssPath = path.resolve(__dirname, 'index.css')
const css = fs.readFileSync(cssPath, 'utf-8')

describe('director-3d global CSS scoping', () => {
  it('does not use bare html/body/#root/global * selectors', () => {
    const globalSelectors = [/^html\s*\{/m, /^body\s*\{/m, /^#root\s*\{/m, /^\*\s*\{/m]
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
