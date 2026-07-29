/**
 * Phase 40 -- DUP-04: one shared admin page shell. Today each admin
 * creation-flow page hand-rolls its own header + "Back to library" link.
 * Plan 40-09 extracts AdminPageShell.tsx (renders <AdminNav + an optional
 * contextual back-link prop, RESEARCH Pitfall 5 -- the per-SOP back-link
 * must survive the consolidation) and rewires every creation-flow page onto
 * it.
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
const JOURNEYS_FILE = path.join(SRC_DIR, 'lib', 'journeys', 'journeys.ts')

const SHELL_TARGETS = [
  path.join(ADMIN_SOPS_DIR, 'upload', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'new', 'blank', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'new', 'ai', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, '[sopId]', 'versions', 'page.tsx'),
  path.join(ADMIN_SOPS_DIR, 'pipeline', '[pipelineId]', 'PipelineProgressClient.tsx'),
]

const ADMIN_PAGE_SHELL = path.join(SRC_DIR, 'components', 'admin', 'AdminPageShell.tsx')

// The pipeline page's `backLink` fallback (no sopId resolved yet) legitimately
// carries the literal "Back to library" as a prop VALUE passed into
// AdminPageShell -- it is not a second hand-rolled header. This is the one
// carve-out the plan's acceptance criteria names explicitly.
const PIPELINE_CLIENT = path.join(ADMIN_SOPS_DIR, 'pipeline', '[pipelineId]', 'PipelineProgressClient.tsx')

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

// Enumerates every page.tsx under admin/sops and derives its route path the
// same way journeys.ts spells routes (dynamic segments kept as `[x]`).
function collectAdminSopRoutes(): string[] {
  const files: string[] = []
  walk(ADMIN_SOPS_DIR, files)
  return files
    .filter((f) => path.basename(f) === 'page.tsx')
    .map((f) => {
      const rel = path
        .relative(path.join(SRC_DIR, 'app', '(protected)'), f)
        .replace(/\\/g, '/')
        .replace(/\/page\.tsx$/, '')
      return `/${rel}`
    })
}

test.describe('DUP-04 -- one shared admin page shell', () => {
  test('every creation-flow page imports AdminPageShell', () => {
    for (const file of SHELL_TARGETS) {
      const src = read(file)
      expect(src).toContain("import { AdminPageShell } from '@/components/admin/AdminPageShell'")
    }
  })

  test('none of the five creation-flow files renders <AdminNav directly', () => {
    for (const file of SHELL_TARGETS) {
      const src = read(file)
      expect(src).not.toContain('<AdminNav')
    }
  })

  test('zero occurrences of the literal "Back to library" outside the pipeline fallback', () => {
    const files: string[] = []
    walk(ADMIN_SOPS_DIR, files)
    const hits = files
      .filter((f) => f !== ADMIN_PAGE_SHELL && f !== PIPELINE_CLIENT)
      .filter((f) => read(f).includes('Back to library'))
    expect(hits).toEqual([])
  })

  test('AdminPageShell renders <AdminNav and accepts an optional contextual back-link prop (RESEARCH Pitfall 5)', () => {
    const src = read(ADMIN_PAGE_SHELL)
    expect(src).toContain('<AdminNav')
    expect(src).toMatch(/backHref\?:|backLink\?:/)
  })

  test('versions/page.tsx and PipelineProgressClient.tsx preserve the per-SOP back link', () => {
    const versionsSrc = read(path.join(ADMIN_SOPS_DIR, '[sopId]', 'versions', 'page.tsx'))
    const pipelineSrc = read(PIPELINE_CLIENT)
    expect(versionsSrc).toContain('/admin/sops/builder/')
    expect(pipelineSrc).toContain('/admin/sops/builder/')
  })

  test('upload/page.tsx uses the shared INTAKE_HINT, not the stale hardcoded format list', () => {
    const src = read(path.join(ADMIN_SOPS_DIR, 'upload', 'page.tsx'))
    expect(src).toContain('INTAKE_HINT')
    expect(src).not.toContain('Word (.docx), PDF, and photos')
  })

  test('PipelineProgressClient.tsx no longer renders its own <header', () => {
    const src = read(PIPELINE_CLIENT)
    expect(src).not.toMatch(/<header/)
  })

  test('route stability: every admin/sops page.tsx route resolves in journeys.ts', () => {
    const journeysSrc = read(JOURNEYS_FILE)
    const routes = collectAdminSopRoutes()
    expect(routes.length).toBeGreaterThan(0)
    const missing = routes.filter((route) => !journeysSrc.includes(`route: '${route}'`))
    expect(missing).toEqual([])
  })
})
