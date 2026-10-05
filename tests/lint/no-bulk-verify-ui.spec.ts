/**
 * Phase 21 (Plan 21-04) — D-21-07 LOCK: no bulk-verify UI affordance anywhere.
 *
 * Runs LIVE (no test.fixme). Walks every `.ts`/`.tsx` file under `src/` and asserts
 * NONE of them contain bulk-verify language patterns. The 2.5-minute
 * friction at 50 blocks IS the safety feature (Spike 004 verdict).
 *
 * Why a repo-wide grep instead of a single-file check?
 *   - A future PR could add an "Approve all flagged" button in a sibling
 *     component (e.g. AdminToolbar.tsx) and a per-component
 *     check would not catch it. This guard fails on a hit anywhere in src/.
 *
 * Allowlist: empty since 58-16 (the retired checklist gate and its test were the only entries).
 *
 * 58-15: the per-step tick lives in the focus editor's StepCard. The scan root (src/) covers src/components/focus, which
 * is asserted below, and the tick-all phrasings of the new editor are banned too.
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
  // 58-15: the same affordance under the focus editor's wording of a tick.
  'tick all',
  'check all',
  'mark all',
  'confirm all',
] as const

// Files allowed to mention the banned phrases (documentation / the lock itself).
// 58-16: the checklist gate that enumerated them is deleted, so nothing under src/ is allow-listed.
const ALLOWLIST = new Set<string>([])

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

test('58-15: the scan covers the focus editor (the tick lives in StepCard) and flags a tick-all phrase', () => {
  const files: string[] = []
  walk(SRC_DIR, files)
  const rel = files.map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'))
  expect(rel).toContain('src/components/focus/admin/StepCard.tsx')
  expect(rel).toContain('src/components/focus/admin/EditDocument.tsx')
  // The phrase list is live: a rendered "Tick all" label matches.
  expect(BANNED_PHRASES.some((p) => '<button>Tick all</button>'.toLowerCase().includes(p))).toBe(true)
})
