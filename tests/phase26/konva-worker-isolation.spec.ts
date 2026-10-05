/**
 * Phase 26 / Plan 26-05 (D-03 / R8) — Konva static-import leak guard.
 *
 * Konva is heavy and admin-only. It may ONLY be reached through
 * `SiteEditorLoader` (dynamic({ ssr:false })) from Phase 51's site editor
 * (the image annotation editor was retired in Phase 55-10). A static
 * `import ... from 'react-konva'` (or a direct `import SiteEditor`) anywhere
 * outside the allow-listed directory would pull the whole canvas engine into whichever
 * bundle imports it — including, fatally, the worker `/sops/[sopId]` First
 * Load JS.
 *
 * This is the Wave-0-style first line of defence; the `check-bundle-size`
 * postbuild gate is the second (it scans the actual worker chunk bytes).
 *
 * Allowed reference sites:
 *   - src/components/admin/site/SiteEditor.tsx                          → the leaf; statically imports react-konva (Phase 51).
 *   - src/components/admin/site/SiteEditorLoader.tsx                    → dynamic-imports ./SiteEditor (Phase 51).
 *
 * Phase 52 (52 D-02): src/components/sop/plant/ is a WORKER-facing surface --
 * deny-listed for Konva/SiteEditor the same as any other
 * non-admin directory. It is not in ALLOWED_DIRS, so the deny-by-default
 * checks above already cover it; the test below makes that explicit for the
 * plant directory specifically (both static AND dynamic references), so a
 * future rename of ALLOWED_DIRS can't silently widen it.
 *
 * Registered under the `phase26` Playwright project (playwright.config.ts,
 * testMatch tests/phase26/**). CLAUDE.md 2026-05-25: a spec in no project
 * regex never runs — this dir is already covered.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')
// The ONLY directory permitted to statically import konva / react-konva /
// SiteEditor. Anything else is a leak.
const ALLOWED_DIRS = [
  path.join('src', 'components', 'admin', 'site').replace(/\\/g, '/'),
  // Phase 58-17 (D-03): image annotation returned on step photos, reached only through StepCard's nested lazy import.
  path.join('src', 'components', 'focus', 'admin', 'annotate').replace(/\\/g, '/'),
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

/**
 * Flags STATIC import sites for a banned specifier. A `dynamic(() => import(...))`
 * line is NOT a static import and is never flagged — that is the sanctioned path.
 */
function findStaticImports(specifierPattern: string): Hit[] {
  const hits: Hit[] = []
  const files: string[] = []
  walk(SRC_DIR, files)
  // `import <anything> from '<specifier>'` OR `import '<specifier>'` (side-effect).
  const staticImport = new RegExp(
    `^\\s*import\\s+(?:[^;]*?\\s+from\\s+)?['"]${specifierPattern}['"]`
  )
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // A dynamic import is allowed everywhere — skip lines that use it.
      if (/dynamic\s*\(/.test(line) || /=>\s*import\(/.test(line)) continue
      if (!staticImport.test(line)) continue
      hits.push({ file: rel, line: i + 1, text: line.trim() })
    }
  }
  return hits
}

function violationsOutsideAllowedDir(hits: Hit[]): Hit[] {
  return hits.filter((h) => !ALLOWED_DIRS.some((dir) => h.file.startsWith(dir + '/')))
}

test('D-03: no static import of konva outside admin/site/', () => {
  const hits = findStaticImports('konva')
  const violations = violationsOutsideAllowedDir(hits)
  if (violations.length > 0) {
    console.error(
      'konva static-import leak violations:\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})

test('D-03: no static import of react-konva outside admin/site/', () => {
  const hits = findStaticImports('react-konva')
  const violations = violationsOutsideAllowedDir(hits)
  if (violations.length > 0) {
    console.error(
      'react-konva static-import leak violations:\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})

test('52 D-02: nothing under src/components/sop/plant/ references konva, react-konva, SiteEditor or SiteEditorLoader -- static OR dynamic', () => {
  const plantDir = path.join(SRC_DIR, 'components', 'sop', 'plant')
  if (!fs.existsSync(plantDir)) {
    test.skip(true, 'src/components/sop/plant/ does not exist yet (lands in Plan 52-02)')
    return
  }
  const files: string[] = []
  walk(plantDir, files)
  const banned = /konva|SiteEditor/
  const violations: Hit[] = []
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (banned.test(lines[i])) violations.push({ file: rel, line: i + 1, text: lines[i].trim() })
    }
  }
  if (violations.length > 0) {
    console.error(
      'src/components/sop/plant/ Konva/SiteEditor reference violations:\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])

  expect(
    ALLOWED_DIRS.some((dir) => dir.startsWith('src/components/sop/plant')),
    'ALLOWED_DIRS must never include the plant directory'
  ).toBe(false)
})

test('T-51-02: no direct SiteEditor import anywhere except SiteEditorLoader', () => {
  // This rule is file-scoped, not directory-scoped: SiteWorkspace.tsx (Phase 51
  // Plan 51-05) will live in the SAME admin/site/ directory as SiteEditor.tsx
  // and must still go through the loader — being "inside the allowed dir" is
  // not sufficient for this specific leaf module.
  const hits = findStaticImports('[^\'"]*\\/SiteEditor')
  const violations = hits.filter((h) => {
    const isLoaderFile = h.file === 'src/components/admin/site/SiteEditorLoader.tsx'
    const mentionsLoader = /SiteEditorLoader/.test(h.text)
    return !isLoaderFile && !mentionsLoader
  })
  if (violations.length > 0) {
    console.error(
      'Direct SiteEditor import violations (import SiteEditorLoader instead):\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})
