/**
 * 用户文件路径安全校验（Creator OS 资产导入 / 交付物导出共用）。
 *
 * 允许的根目录集合刻意收窄：应用 userData、系统临时目录、以及用户内容目录
 * （桌面/文档/下载/图片/音乐/视频）。不放行整个 home（避免 ~/.ssh、~/.aws
 * 等敏感目录），更不放行系统目录（/etc、/usr、/System 等）。
 */
import { app } from 'electron'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'

/** 判断 target 是否位于 root 之内（含 root 本身） */
export function isPathWithinRoot(target: string, root: string): boolean {
  const t = resolve(target)
  const r = resolve(root)
  return t === r || t.startsWith(r + sep)
}

/** 判断 target 是否位于任一允许根目录之内 */
export function isPathWithinRoots(target: string, roots: string[]): boolean {
  return roots.some((root) => isPathWithinRoot(target, root))
}

/**
 * 允许的用户文件根目录：userData + 临时目录 + 用户内容目录。
 * 用户通过文件对话框/拖拽选择的文件以及手动输入的导出目录一般都落在这些位置。
 */
export function getAllowedUserFileRoots(): string[] {
  const roots = new Set<string>()
  const add = (p?: string) => {
    if (p) roots.add(resolve(p))
  }
  try {
    add(app.getPath('userData'))
  } catch {
    /* 非 Electron 环境（如单元测试未 mock）时忽略 */
  }
  add(tmpdir())
  const contentDirs = ['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos'] as const
  for (const name of contentDirs) {
    try {
      add(app.getPath(name))
    } catch {
      /* 该平台不支持该目录时忽略 */
    }
  }
  return [...roots]
}
