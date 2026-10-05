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

  test('none of the creation-flow files renders <AdminNav directly', () => {
    for (const file of SHELL_TARGETS) {
      const src = read(file)
      expect(src).not.toContain('<AdminNav')
    }
  })

  test('zero occurrences of the literal "Back to library" outside the shell', () => {
    const files: string[] = []
    walk(ADMIN_SOPS_DIR, files)
    const hits = files
      .filter((f) => f !== ADMIN_PAGE_SHELL)
      .filter((f) => read(f).includes('Back to library'))
    expect(hits).toEqual([])
  })

  test('AdminPageShell has no nav of its own (header owns it, sketch 004) and accepts the back-link prop (RESEARCH Pitfall 5)', () => {
    const src = read(ADMIN_PAGE_SHELL)
    expect(src).not.toContain('AdminNav')
    expect(src).toMatch(/backHref\?:|backLink\?:/)
  })

  // 58-15: the per-SOP back link lived on the versions page (retired, no successor page).
  // Its job -- a way back from a SOP -- is the focus screen's Back, which sits in the
  // frame's top bar and is driven by useFocusBack (place-whitelisted ?from).
  test('the focus screen keeps a per-SOP Back in its top bar, fed by the frame', () => {
    const bar = read(path.join(SRC_DIR, 'components', 'focus', 'FocusTopBar.tsx'))
    expect(bar).toContain('onClick={onBack}')
    expect(read(path.join(SRC_DIR, 'components', 'focus', 'FocusFrame.tsx'))).toContain('onBack=')
  })

  test('upload/page.tsx uses the shared INTAKE_HINT, not the stale hardcoded format list', () => {
    const src = read(path.join(ADMIN_SOPS_DIR, 'upload', 'page.tsx'))
    expect(src).toContain('INTAKE_HINT')
    expect(src).not.toContain('Word (.docx), PDF, and photos')
  })

  test('route stability: every admin/sops page.tsx route resolves in journeys.ts', () => {
    const journeysSrc = read(JOURNEYS_FILE)
    const routes = collectAdminSopRoutes()
    expect(routes.length).toBeGreaterThan(0)
    // Phase 58-14: these two pages are redirect-only (the proxy 307s their addresses to the focus
    // editor before they render), so no pathway names them; 58-16 deletes the directories and this exemption.
    const redirectOnly = ['/admin/sops/builder/[sopId]', '/admin/sops/[sopId]/versions']
    const missing = routes.filter((route) => !redirectOnly.includes(route) && !journeysSrc.includes(`route: '${route}'`))
    expect(missing).toEqual([])
  })
})
