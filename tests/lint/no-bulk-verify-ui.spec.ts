/**
 * Phase 21 (Plan 21-04) — D-21-07 LOCK: no bulk-verify UI affordance anywhere.
 *
 * Modeled after `tests/lint/no-static-desktop-import.spec.ts`. Runs LIVE
 * (no test.fixme). Walks every `.ts`/`.tsx` file under `src/` and asserts
 * NONE of them contain bulk-verify language patterns. The 2.5-minute
 * friction at 50 blocks IS the safety feature (Spike 004 verdict).
 *
 * Why a repo-wide grep instead of a single-file check?
 *   - A future PR could add an "Approve all flagged" button in a sibling
 *     component (e.g. AdminToolbar.tsx) and the per-component static
 *     analysis in VerifyChecklistGate.test.tsx wouldn't catch it.
 *   - This guard runs at the SAME layer as no-static-desktop-import:
 *     anywhere in src/ → fail.
 *
 * Allowlist (the lock + its tests AND surrounding documentation are
 * permitted to MENTION the banned phrases for documentation purposes):
 *   - src/components/admin/verify-checklist/VerifyChecklistGate.tsx
 *     (the lock comment itself enumerates the banned phrases)
 *   - src/components/admin/verify-checklist/__tests__/VerifyChecklistGate.test.tsx
 *     (the static-analysis test enumerates them too)
 *   - tests/lint/no-bulk-verify-ui.spec.ts (this file)
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')

// Each banned phrase is a JSX-rendered string a user could see in the UI.
// Match is case-insensitive AND requires the phrase to appear inside a
// string literal OR JSX text node — NOT in a comment. This avoids false
// positives in the documentation that lives alongside the lock.
const BANNED_PHRASES = [
  'approve all',
  'verify all',
  'select all',
  'bulk verify',
  'trust score',
  'skip remaining',
] as const

// Files allowed to mention the banned phrases (documentation / the lock itself).
const ALLOWLIST = new Set<string>([
  // The lock comment + the static-analysis test enumerate the banned phrases.
  path
    .join('src', 'components', 'admin', 'verify-checklist', 'VerifyChecklistGate.tsx')
    .replace(/\\/g, '/'),
  path
    .join(
      'src',
      'components',
      'admin',
      'verify-checklist',
      '__tests__',
      'VerifyChecklistGate.test.tsx',
    )
    .replace(/\\/g, '/'),
])

type Hit = { file: string; line: number; phrase: string; text: string }

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

function findUserFacingPhrases(): Hit[] {
  const hits: Hit[] = []
  const files: string[] = []
  walk(SRC_DIR, files)

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    if (ALLOWLIST.has(rel)) continue

    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.trim()
      // Skip single-line // and /* … */ comments — they're documentation.
      if (trimmed.startsWith('//')) continue
      if (trimmed.startsWith('*')) continue
      if (trimmed.startsWith('/*')) continue
      // For the check, use lowercase.
      const lower = raw.toLowerCase()
      for (const phrase of BANNED_PHRASES) {
        if (lower.includes(phrase)) {
          hits.push({ file: rel, line: i + 1, phrase, text: trimmed })
        }
      }
    }
  }
  return hits
}

test('D-21-07: no bulk-verify UI affordance anywhere in src/', () => {
  const hits = findUserFacingPhrases()
  if (hits.length > 0) {
    console.error(
      'Bulk-verify UI violations (D-21-07 / SCP-VERIFY-05 lock):\n' +
        hits
          .map(
            (h) =>
              `  ${h.file}:${h.line}  matched "${h.phrase}"\n    ${h.text}`,
          )
          .join('\n'),
    )
  }
  expect(hits).toEqual([])
})
