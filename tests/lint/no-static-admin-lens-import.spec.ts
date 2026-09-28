/**
 * Phase 41 / Plan 41-01 — Admin-lens static-import leak guard (T-41-02,
 * guards SUR-05 / D-08). Modelled on
 * tests/lint/no-static-desktop-import.spec.ts (copied, not imported — that
 * file is self-contained).
 *
 * Two contracts:
 *
 *   1. Per-symbol allow-list (converted 54-05 from a shared file list, now
 *      that the three Phase 41 lens files are deleted): `GovernanceQueueRow`,
 *      `WiringPatchBayShell`, `AdminFloorHealth` may each only be statically
 *      imported from their own named file below. `AdminLibraryTable` has an
 *      empty allow-list — it is only ever reached via `next/dynamic`
 *      (`src/app/(protected)/sops/page.tsx`), so ANY static import is a
 *      violation.
 *
 *   2. `src/app/(protected)/sops/page.tsx` (the merged worker/admin
 *      surface) must not import any admin table/lens component, nor
 *      `DepartmentPicker`, nor `setSopCategory`, nor anything from
 *      `@/actions/governance`, `@/actions/org-model`, `@/actions/grants`.
 *
 * Runs LIVE (no test.fixme).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')

// Per-symbol allow-list: the ONLY file(s) allowed to statically import each
// symbol. An empty array means the symbol must never be statically imported
// anywhere — only via next/dynamic.
const ALLOWED_IMPORTERS: Record<string, string[]> = {
  GovernanceQueueRow: [path.join('src', 'components', 'admin', 'governance', 'GovernanceInbox.tsx')],
  WiringPatchBayShell: [path.join('src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx')],
  AdminFloorHealth: [path.join('src', 'app', '(protected)', 'governance', 'page.tsx')],
  AdminLibraryTable: [],
}

const SOPS_PAGE = path.join(REPO_ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')

type Hit = { file: string; line: number; text: string }

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
    ) {
      out.push(full)
    }
  }
}

function findImports(symbol: string): Hit[] {
  const hits: Hit[] = []
  const files: string[] = []
  walk(SRC_DIR, files)
  const importLine = new RegExp(`import\\s+[^;]*${symbol}[^;]*from`, 'i')
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes(symbol)) continue
      if (!importLine.test(line)) continue
      // Skip comment-only references (e.g. "Deliberately NOT a reuse of X").
      if (/^\s*(\*|\/\/)/.test(line)) continue
      hits.push({ file: rel, line: i + 1, text: line.trim() })
    }
  }
  return hits
}

test.describe('T-41-02 — admin lens components cannot leak into the worker import graph', () => {
  for (const [symbol, allowedFiles] of Object.entries(ALLOWED_IMPORTERS)) {
    const allowed = allowedFiles.map((p) => p.replace(/\\/g, '/'))
    test(`${symbol} is only statically imported from an allowed file`, () => {
      const hits = findImports(symbol)
      const violations = hits.filter((h) => !allowed.includes(h.file))
      if (violations.length > 0) {
        console.error(
          `${symbol} import-leak violations:\n` +
            violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
        )
      }
      expect(violations).toEqual([])
    })
  }

  test('src/app/(protected)/sops/page.tsx does not import any admin lens/table code (live guard, no fixme)', () => {
    const src = fs.readFileSync(SOPS_PAGE, 'utf-8')
    const forbidden = [
      'GovernanceQueueRow',
      'WiringPatchBayShell',
      'DepartmentPicker',
      'setSopCategory',
      '@/actions/governance',
      '@/actions/org-model',
      '@/actions/grants',
      // Phase 54: page.tsx mounts AdminLibraryTable only via next/dynamic
      // (SC-4/T-54-04) — it must never import the data layer behind it, nor
      // the Access lens, directly.
      'listAdminSopRows',
      '@/actions/admin-sop-list',
      '@/lib/sop/admin-health',
      'AdminAccessLens',
    ]
    const present = forbidden.filter((token) => src.includes(token))
    expect(present, `Forbidden admin imports found in sops/page.tsx: ${present.join(', ')}`).toEqual([])
  })
})
