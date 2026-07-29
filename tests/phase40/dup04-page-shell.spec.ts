/**
 * Phase 40 -- DUP-04: one shared admin page shell. Today each admin
 * creation-flow page hand-rolls its own header + "Back to library" link.
 * Plan 40-09 extracts AdminPageShell.tsx (renders <AdminNav + an optional
 * contextual back-link prop, RESEARCH Pitfall 5 -- the per-SOP back-link
 * must survive the consolidation) and rewires every creation-flow page onto
 * it.
 *
 * `test.fixme` until 40-09.
 *
 * Registration: playwright.config.ts `phase40` project
 *   testDir: '.', testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase40`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const ADMIN_SOPS_DIR = path.join(SRC_DIR, 'app', '(protected)', 'admin', 'sops')

const SHELL_TARGETS = [
  path.join(ADMIN_SOPS_DIR, 'upload', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'new', 'blank', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'new', 'ai', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, '[sopId]', 'versions', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'pipeline', '[pipelineId]', 'PipelineProgressClient.tsx'),
]

const ADMIN_PAGE_SHELL = path.join(SRC_DIR, 'components', 'admin', 'AdminPageShell.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
}

test.describe('DUP-04 -- one shared admin page shell', () => {
  test.fixme('every creation-flow page imports AdminPageShell', () => {
    for (const file of SHELL_TARGETS) {
      const src = read(file)
      expect(src).toContain("import { AdminPageShell } from '@/components/admin/AdminPageShell'")
    }
  })

  test.fixme('zero occurrences of the literal "Back to library" outside AdminPageShell.tsx', () => {
    const files: string[] = []
    walk(ADMIN_SOPS_DIR, files)
    const hits = files
      .filter((f) => f !== ADMIN_PAGE_SHELL)
      .filter((f) => read(f).includes('Back to library'))
    expect(hits).toEqual([])
  })

  test.fixme('AdminPageShell renders <AdminNav and accepts an optional contextual back-link prop (RESEARCH Pitfall 5)', () => {
    const src = read(ADMIN_PAGE_SHELL)
    expect(src).toContain('<AdminNav')
    expect(src).toMatch(/backHref\?:|backLink\?:/)
  })
})
