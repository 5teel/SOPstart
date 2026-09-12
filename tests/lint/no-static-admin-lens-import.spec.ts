/**
 * Phase 41 / Plan 41-01 — Admin-lens static-import leak guard (T-41-02,
 * guards SUR-05 / D-08). Modelled on
 * tests/lint/no-static-desktop-import.spec.ts (copied, not imported — that
 * file is self-contained).
 *
 * Two contracts:
 *
 *   1. `SopMillerBrowser`, `GovernanceQueueRow`, `WiringPatchBayShell` may
 *      only be statically imported from one of ALLOWED_FILES. The fourth,
 *      TEMPORARY entry (`admin/sops/page.tsx`) is removed by 41-06 when
 *      that page becomes a redirect shim — see the comment on that entry.
 *
 *   2. `src/app/(protected)/sops/page.tsx` (the merged worker/admin
 *      surface) must not import any of the three lens components, nor
 *      `DepartmentPicker`, nor `setSopCategory`, nor anything from
 *      `@/actions/governance`, `@/actions/org-model`, `@/actions/grants`.
 *      This contract is LIVE and passes today — none of these are
 *      imported there yet — so it guards every intervening wave rather
 *      than waiting for 41-05 to add the lens wiring.
 *
 * Runs LIVE (no test.fixme).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')

const ALLOWED_FILES = [
  path.join('src', 'components', 'sop', 'lenses', 'AdminStatusLens.tsx'),
  path.join('src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx'),
  path.join('src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx'),
  // TEMPORARY: removed by 41-06 when this page becomes a redirect shim.
  path.join('src', 'app', '(protected)', 'admin', 'sops', 'page.tsx'),
].map((p) => p.replace(/\\/g, '/'))

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

const LENS_SYMBOLS = ['SopMillerBrowser', 'GovernanceQueueRow', 'WiringPatchBayShell']

test.describe('T-41-02 — admin lens components cannot leak into the worker import graph', () => {
  for (const symbol of LENS_SYMBOLS) {
    test(`${symbol} is only statically imported from an allowed file`, () => {
      const hits = findImports(symbol)
      const violations = hits.filter((h) => !ALLOWED_FILES.includes(h.file))
      if (violations.length > 0) {
        console.error(
          `${symbol} import-leak violations:\n` +
            violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
        )
      }
      expect(violations).toEqual([])
    })
  }

  test('src/app/(protected)/sops/page.tsx does not import any admin lens code (live guard, no fixme)', () => {
    const src = fs.readFileSync(SOPS_PAGE, 'utf-8')
    const forbidden = [
      'SopMillerBrowser',
      'GovernanceQueueRow',
      'WiringPatchBayShell',
      'DepartmentPicker',
      'setSopCategory',
      '@/actions/governance',
      '@/actions/org-model',
      '@/actions/grants',
    ]
    const present = forbidden.filter((token) => src.includes(token))
    expect(present, `Forbidden admin imports found in sops/page.tsx: ${present.join(', ')}`).toEqual([])
  })
})
