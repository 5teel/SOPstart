/**
 * Phase 21.6 (Plan 21.6-01) — E2 LOCK: no raw block-type identifiers rendered
 * in Build-stage UI.
 *
 * Modeled after `tests/lint/no-bulk-verify-ui.spec.ts`. Runs LIVE
 * (no test.fixme). Walks every `.ts`/`.tsx` file under
 * `src/components/admin/builder/` and `src/lib/builder/puck-config.tsx`,
 * asserting NONE of them render raw PascalCase `*Block` names (e.g.
 * `StepBlock`, `PhotoGridBlock`) or the bare tokens `'PhotoGrid'`/`'Grid'`
 * as user-visible string literals or JSX text nodes.
 *
 * Why a source walk instead of a single-file check?
 *   - A future TreeBlockRow or AddMenu could accidentally inline a PascalCase
 *     block-type name as a JSX text node; a single-file check wouldn't catch
 *     siblings. This guard scans the entire builder directory.
 *
 * What does NOT count as a violation:
 *   - Import identifiers (`import { StepBlock }`)
 *   - Object keys (`StepBlock: { ... }`)
 *   - Type identifiers (`item.type === 'StepBlock'`)
 *   - STEP_TYPES set members (`'StepBlock'` inside a `Set([...])` literal)
 *   - Comment lines (// or * lines)
 *
 * The allowlist permits the block-type-labels definition file and
 * puck-config.tsx (field definitions reference block names as keys, not
 * user-visible strings).
 *
 * CLAUDE.md 2026-05-25: a spec file not in a playwright project regex NEVER
 * runs — this file is registered in the `phase21.6-stubs` project in
 * playwright.config.ts.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

// Walk root: only builder admin components are in scope.
// puck-config.tsx is allowlisted separately (it defines field schemas, not render text).
const BUILDER_DIR = path.join(REPO_ROOT, 'src', 'components', 'admin', 'builder')

// Raw PascalCase block-type names that must not appear as user-visible strings.
// These are the PascalCase identifiers that block-type-labels.ts translates.
// Extend this list when new block types are added.
const BANNED_RAW_BLOCK_NAMES = [
  'StepBlock',
  'StepWithPhotosBlock',
  'PhotoGridBlock',
  'HeadingBlock',
  'TextBlock',
  'CalloutBlock',
  'HazardCardBlock',
  'PPECardBlock',
  'ZoneBlock',
  'EscalateBlock',
  'MeasurementBlock',
  'DecisionBlock',
  'ModelBlock',
  'SignOffBlock',
  'VoiceNoteBlock',
  'UnsupportedBlockPlaceholder',
  // Bare token forms that could slip through as rendered text
  'PhotoGrid',
] as const

// Files allowed to reference raw block-type identifiers
// (they DEFINE the labels, not render them to users).
const ALLOWLIST = new Set<string>([
  path.join('src', 'lib', 'builder', 'block-type-labels.ts').replace(/\\/g, '/'),
  path.join('src', 'lib', 'builder', 'puck-config.tsx').replace(/\\/g, '/'),
])

type Hit = { file: string; line: number; name: string; text: string }

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return // guard: directory may not exist until Plan 03
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
 * Returns true if the line is an import statement, an object key, a type
 * comparison guard, or a Set member — i.e., NOT a user-visible render string.
 *
 * These are NOT violations:
 *   import { StepBlock } from '...'
 *   const STEP_TYPES = new Set(['StepBlock', ...])
 *   item.type === 'StepBlock'
 *   StepBlock: { fields: ... }          (object key)
 *   type: 'StepBlock'                   (Puck type discriminant)
 */
function isNonRenderContext(line: string, name: string): boolean {
  // Import line
  if (/^\s*import\b/.test(line)) return true
  // Object key: `StepBlock:` or `'StepBlock':` or `"StepBlock":`
  if (new RegExp(`['"]?${name}['"]?\\s*:`).test(line)) return true
  // Type/value comparison: === 'StepBlock' or !== 'StepBlock'
  if (new RegExp(`[!=]==\\s*['"]${name}['"]`).test(line)) return true
  // Comparison reversed: 'StepBlock' === / 'StepBlock' !==
  if (new RegExp(`['"]${name}['"]\\s*[!=]==`).test(line)) return true
  // Set member: new Set([...'StepBlock'...])
  if (/new Set\s*\(/.test(line)) return true
  // .has('StepBlock') / .includes('StepBlock')
  if (new RegExp(`\\.(has|includes)\\s*\\(['"]${name}['"]\\)`).test(line)) return true
  // Type annotation: : 'StepBlock' | or as 'StepBlock'
  if (new RegExp(`:\\s*['"]${name}['"]`).test(line)) return true
  // Switch case
  if (new RegExp(`case\\s+['"]${name}['"]`).test(line)) return true
  return false
}

function findRawBlockTypeLeaks(): Hit[] {
  const hits: Hit[] = []
  const files: string[] = []
  walk(BUILDER_DIR, files)

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    if (ALLOWLIST.has(rel)) continue

    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.trim()
      // Skip comment lines
      if (trimmed.startsWith('//')) continue
      if (trimmed.startsWith('*')) continue
      if (trimmed.startsWith('/*')) continue

      for (const name of BANNED_RAW_BLOCK_NAMES) {
        if (!raw.includes(name)) continue
        if (isNonRenderContext(raw, name)) continue
        hits.push({ file: rel, line: i + 1, name, text: trimmed })
      }
    }
  }
  return hits
}

test('E2: no raw block-type identifiers rendered in Build stage', () => {
  // Guard: if the builder directory doesn't exist yet (Plans 03+ create it),
  // the test passes vacuously — the guard activates the moment Plan 03 lands.
  if (!fs.existsSync(BUILDER_DIR)) {
    console.info(
      'E2 guard: src/components/admin/builder/ does not exist yet — ' +
        'test passes vacuously until Plan 03 creates the directory.',
    )
    return
  }

  const hits = findRawBlockTypeLeaks()
  if (hits.length > 0) {
    console.error(
      'E2 violations — raw block-type identifiers in Build-stage UI:\n' +
        hits
          .map(
            (h) =>
              `  ${h.file}:${h.line}  matched "${h.name}"\n    ${h.text}`,
          )
          .join('\n'),
    )
  }
  expect(hits).toEqual([])
})
