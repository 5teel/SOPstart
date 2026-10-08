/**
 * Phase 41 / Plan 41-01 — Admin-lens static-import leak guard (T-41-02,
 * guards SUR-05 / D-08). Modelled on
 * tests/lint/no-static-desktop-import.spec.ts (copied, not imported — that
 * file is self-contained).
 *
 * Two contracts:
 *
 *   1. Per-symbol allow-list (converted 54-05 from a shared file list, now
 *      that the three Phase 41 lens files are deleted): `WiringPatchBayShell`
 *      may only be statically imported from its own named file below. The
 *      retired governance queue row left the list when it was deleted in 59-14.
 *      `OfficePane` and the request/objective editors have empty allow-lists: each is
 *      only ever reached via `next/dynamic`, so ANY static import is a violation.
 *
 *   2. The home shell files (the worker download, 63-11) must
 *      not import any admin table/lens component, nor `DepartmentPicker`, nor
 *      `setSopCategory`, nor anything from `@/actions/governance`,
 *      `@/actions/org-model`, `@/actions/grants`. The admin section bodies are
 *      reached only through `dynamic(`.
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
  WiringPatchBayShell: [path.join('src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx')],
  // Phase 59: the Office pane is only ever reached through next/dynamic (A-11).
  OfficePane: [],
  // Phase 60: the composer and the ask picker are only ever reached through next/dynamic (A-07).
  RequestComposer: [],
  AskPicker: [],
  // Phase 60: the objective editor is only ever reached through the lazy ObjectiveSlot seam (A-07).
  ObjectiveEditor: [],
}

const WORKER_SHELL_FILES = [
  path.join(REPO_ROOT, 'src', 'components', 'shell', 'AccountControl.tsx'),
  ...['HomeShell.tsx', 'SectionMenu.tsx', 'TabBar.tsx'].map((f) => path.join(REPO_ROOT, 'src', 'components', 'home', f)),
]

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
  const importLine = new RegExp(`import\\s+[^;]*\\b${symbol}\\b[^;]*from`, 'i')
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

  test('the worker shell files do not import any admin lens/table code (live guard, no fixme)', () => {
    const forbidden = [
      'WiringPatchBayShell',
      'DepartmentPicker',
      'setSopCategory',
      '@/actions/governance',
      '@/actions/org-model',
      '@/actions/grants',
      // The admin data layer and the Access lens are the admin shell's.
      'listAdminSopRows',
      '@/actions/admin-sop-list',
      '@/lib/sop/admin-health',
      'AdminAccessLens',
    ]
    for (const file of WORKER_SHELL_FILES) {
      const src = fs.readFileSync(file, 'utf-8')
      const present = forbidden.filter((token) => src.includes(token))
      expect(present, `Forbidden admin imports found in ${path.basename(file)}: ${present.join(', ')}`).toEqual([])
    }
  })

  test('HomeShell reaches the admin-only section bodies only through dynamic()', () => {
    const home = fs.readFileSync(WORKER_SHELL_FILES.find((f) => f.endsWith('HomeShell.tsx')) as string, 'utf-8')
    for (const m of ['PeopleSection', 'ManageSection', 'SignOffsSection']) {
      expect(home, m).toMatch(new RegExp(`const ${m} = dynamic\\(\\(\\) => import\\('@/components/home/sections/${m}'\\)`))
      expect(home, m).not.toMatch(new RegExp(`^import[^\\n]*\\b${m}\\b[^\\n]*from`, 'm'))
    }
  })
})
