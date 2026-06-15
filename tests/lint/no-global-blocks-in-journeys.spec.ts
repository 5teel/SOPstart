/**
 * Lint guard: no /admin/global-blocks references in journeys.ts or the src route tree.
 *
 * Phase 25 Plan 05 retired the global-blocks curation model:
 *   - /admin/global-blocks/page.tsx was deleted
 *   - /admin/global-blocks/suggestions/page.tsx was deleted
 *   - journeys.ts curate-globals journey was removed
 *
 * This spec ensures those routes never creep back in via Link, router.push, or
 * journey config — and that /admin/departments is present as the replacement.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const JOURNEYS_FILE = path.resolve(__dirname, '../../src/lib/journeys/journeys.ts')
const SRC_DIR = path.resolve(__dirname, '../../src')

function readJourneys(): string {
  return fs.readFileSync(JOURNEYS_FILE, 'utf8')
}

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, ext))
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

test('journeys.ts contains /admin/departments', () => {
  const content = readJourneys()
  expect(content).toContain('/admin/departments')
})

test('journeys.ts does NOT contain /admin/global-blocks', () => {
  const content = readJourneys()
  expect(content).not.toContain('/admin/global-blocks')
})

test('journeys.ts does NOT reference curate-globals journey', () => {
  const content = readJourneys()
  expect(content).not.toContain('curate-globals')
})

test('journeys.ts does NOT include Platform admin in JOURNEY_GROUPS', () => {
  const content = readJourneys()
  expect(content).not.toContain('Platform admin')
})

test('src tree has no /admin/global-blocks route directory', () => {
  const globalBlocksDir = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'global-blocks')
  const exists = fs.existsSync(globalBlocksDir)
  expect(exists).toBe(false)
})

test('src TypeScript files have no live href/push to /admin/global-blocks', () => {
  const tsFiles = [
    ...walkDir(SRC_DIR, '.tsx'),
    ...walkDir(SRC_DIR, '.ts'),
  ]

  const violations: string[] = []

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Exclude comment lines
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
      if (line.includes('/admin/global-blocks')) {
        const relPath = path.relative(SRC_DIR, file)
        violations.push(`${relPath}:${i + 1}: ${line.trim()}`)
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Live references to deleted route /admin/global-blocks found:\n${violations.join('\n')}`
    )
  }
})
