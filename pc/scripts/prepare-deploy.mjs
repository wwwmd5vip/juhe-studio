/**
 * Prepare a symlink-free app directory for electron-builder packaging.
 *
 * pnpm uses symlinks for its virtual store. electron-builder's file globbing
 * doesn't correctly follow symlinks into .pnpm — it includes package.json
 * but skips src/ subdirectories.
 *
 * This script creates a clean "app-deploy/" directory containing:
 * - package.json (copied from pc/)
 * - out/ (built artifacts, already symlink-free)
 * - resources/ (static resources)
 * - src/main/db/migrations/ (DB migrations)
 * - node_modules/ (real file copies, NO symlinks, NO .pnpm, NO devDependencies)
 *
 * electron-builder is then pointed at app-deploy/ via --config.appDir
 */

/* global console, process */
import { cp, rm, readdir, readlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const deployDir = join(root, 'app-deploy')
const nodeModules = join(root, 'node_modules')

// Production dependencies to keep (from package.json dependencies field)
// devDependencies are excluded automatically since we only copy what's needed
const PROD_DEP_DIRS_TO_SKIP = new Set([
  '.bin',
  '.pnpm',
  '.node-modules-backup',
  '.modules.yaml',
])

async function copySymlinkAsReal(src, dest) {
  const target = await readlink(src)
  const resolvedTarget = resolve(join(src, '..'), target)
  await copyDirRecursive(resolvedTarget, dest)
}

async function copyDirRecursive(src, dest) {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isSymbolicLink()) {
      await copySymlinkAsReal(srcPath, destPath)
    } else if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath)
    } else {
      await cp(srcPath, destPath, { recursive: false })
    }
  }
}

async function main() {
  console.log('[prepare-deploy] Creating symlink-free app-deploy/ directory...')

  // Clean previous deploy
  if (existsSync(deployDir)) {
    await rm(deployDir, { recursive: true, force: true })
  }
  await mkdir(deployDir, { recursive: true })

  // Copy package.json
  await cp(join(root, 'package.json'), join(deployDir, 'package.json'))

  // Copy out/ (build artifacts)
  console.log('[prepare-deploy] Copying out/...')
  await cp(join(root, 'out'), join(deployDir, 'out'), { recursive: true })

  // Copy resources/
  if (existsSync(join(root, 'resources'))) {
    console.log('[prepare-deploy] Copying resources/...')
    await cp(join(root, 'resources'), join(deployDir, 'resources'), { recursive: true })
  }

  // Copy src/main/db/migrations/
  const migrationsSrc = join(root, 'src', 'main', 'db', 'migrations')
  if (existsSync(migrationsSrc)) {
    console.log('[prepare-deploy] Copying migrations/...')
    const migrationsDest = join(deployDir, 'src', 'main', 'db', 'migrations')
    await mkdir(migrationsDest, { recursive: true })
    await cp(migrationsSrc, migrationsDest, { recursive: true })
  }

  // Copy legal/compliance docs referenced by electron-builder.yml extraResources
  for (const file of ['EULA.md', 'LICENSE.md', 'PRIVACY.md', 'THIRD-PARTY-LICENSES.txt']) {
    const src = join(root, file)
    if (existsSync(src)) {
      await cp(src, join(deployDir, file))
    }
  }

  // Copy node_modules/ (resolving all symlinks to real files)
  console.log('[prepare-deploy] Copying node_modules/ (resolving symlinks)...')
  const destModules = join(deployDir, 'node_modules')
  await mkdir(destModules, { recursive: true })

  const entries = await readdir(nodeModules, { withFileTypes: true })

  for (const entry of entries) {
    if (PROD_DEP_DIRS_TO_SKIP.has(entry.name)) continue

    const srcPath = join(nodeModules, entry.name)
    const destPath = join(destModules, entry.name)

    if (entry.isSymbolicLink()) {
      await copySymlinkAsReal(srcPath, destPath)
    } else if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath)
    } else {
      await cp(srcPath, destPath)
    }
  }

  // Also copy .pnpm/node_modules/ — pnpm hoists transitive deps (like debug, ms) there
  // These are real directories (not symlinks) and needed at runtime
  const pnpmNodeModules = join(nodeModules, '.pnpm', 'node_modules')
  if (existsSync(pnpmNodeModules)) {
    console.log('[prepare-deploy] Copying .pnpm/node_modules/ (hoisted transitive deps)...')
    const pnpmEntries = await readdir(pnpmNodeModules, { withFileTypes: true })
    for (const entry of pnpmEntries) {
      const destPath = join(destModules, entry.name)
      // Skip if already copied from top-level
      if (existsSync(destPath)) continue

      const srcPath = join(pnpmNodeModules, entry.name)
      if (entry.isSymbolicLink()) {
        await copySymlinkAsReal(srcPath, destPath)
      } else if (entry.isDirectory()) {
        await copyDirRecursive(srcPath, destPath)
      } else {
        await cp(srcPath, destPath)
      }
    }
  }

  console.log('[prepare-deploy] Done. app-deploy/ is ready for electron-builder.')
}

main().catch((err) => {
  console.error('[prepare-deploy] Failed:', err)
  process.exit(1)
})
