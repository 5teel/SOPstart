/**
 * Phase 26 / Plan 26-05 (D-03 / R8) — Konva static-import leak guard.
 *
 * Konva is heavy and admin-only. It may ONLY be reached through
 * `AnnotationEditorLoader` (dynamic({ ssr:false })) from admin builder-v2 code.
 * A static `import ... from 'react-konva'` (or a direct `import AnnotationEditor`)
 * anywhere outside `src/components/admin/builder-v2/visual/` would pull the whole
 * canvas engine into whichever bundle imports it — including, fatally, the worker
 * `/sops/[sopId]` First Load JS.
 *
 * This is the Wave-0-style first line of defence; the `check-bundle-size`
 * postbuild gate is the second (it scans the actual worker chunk bytes).
 *
 * Allowed reference sites (both INSIDE `visual/`):
 *   - AnnotationEditor.tsx          → the leaf; statically imports react-konva.
 *   - AnnotationEditorLoader.tsx    → dynamic-imports ./AnnotationEditor.
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
// AnnotationEditor. Anything else is a leak.
const ALLOWED_DIR = path
  .join('src', 'components', 'admin', 'builder-v2', 'visual')
  .replace(/\\/g, '/')

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
  return hits.filter((h) => !h.file.startsWith(ALLOWED_DIR + '/'))
}

test('D-03: no static import of konva outside builder-v2/visual/', () => {
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

test('D-03: no static import of react-konva outside builder-v2/visual/', () => {
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

test('D-03: no direct AnnotationEditor import outside builder-v2/visual/ (use AnnotationEditorLoader)', () => {
  // Match the leaf module path in any form: '@/components/.../visual/AnnotationEditor'
  // or a relative './AnnotationEditor' — but NOT AnnotationEditorLoader.
  const hits = findStaticImports('[^\'"]*\\/AnnotationEditor')
  const violations = violationsOutsideAllowedDir(hits).filter(
    (h) => !/AnnotationEditorLoader/.test(h.text)
  )
  if (violations.length > 0) {
    console.error(
      'Direct AnnotationEditor import violations (import AnnotationEditorLoader instead):\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})
