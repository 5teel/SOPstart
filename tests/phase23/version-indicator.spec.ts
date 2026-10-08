/**
 * Phase 23 -- AFL-VER-04: Version update indicator source-contract assertions.
 *
 * D-08 (the "Updated" signal appears when a newer published version exists than
 *        the worker's last completion -- derived from published_at vs the last
 *        completion, not a hardcoded literal)
 * D-09 (the signal is a passive status only -- no forced re-do; workers see it
 *        as informational context)
 *
 * Repointed in 63-19: the plant stage, machine body and Now card are gone. The
 * signal is derived once in `useLibrary` (`hasNewerVersion`), classified once in
 * `rowStatus` (`src/lib/library/status.ts`, the `updated` kind) and shown as the
 * row's status text.
 *
 * CLAUDE.md 2026-06-05: assert WIRING, not token presence.
 * Registration: phase23-stubs project in playwright.config.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { rowStatus } from '@/lib/library/status'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

const signed = { sopId: 's1', status: 'signed_off', submittedAt: '2026-01-01T00:00:00Z' }
const input = { walk: null, order: null, latestCompletion: signed, currentId: 's1' }

test('AFL-VER-04: a newer published version classifies as the Updated state (not hardcoded)', () => {
  expect(rowStatus({ ...input, hasNewerVersion: true })).toMatchObject({ kind: 'updated' })
  expect(rowStatus({ ...input, hasNewerVersion: false })).toMatchObject({ kind: 'signed' })
})

test('AFL-VER-04 D-08: hasNewerVersion is derived from published_at vs the last completion', () => {
  const src = read('src/hooks/useLibrary.ts')
  expect(src).toContain('const hasNewerVersion = !!latest && !!s.published_at && new Date(s.published_at) > new Date(latest.submitted_at)')
})

test('AFL-VER-04: the row status reads the derived flag', () => {
  const src = read('src/hooks/useLibrary.ts')
  expect(src).toMatch(/hasNewerVersion,\s*\n/)
  expect(read('src/lib/library/status.ts')).toContain("i.hasNewerVersion")
})

test('AFL-VER-04 D-09: the status is informational only -- plain text, no handler', () => {
  const src = read('src/lib/library/status.ts')
  expect(src).not.toMatch(/onClick|router\.|<Link|href=/)
})
