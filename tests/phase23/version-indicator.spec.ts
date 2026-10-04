/**
 * Phase 23 -- AFL-VER-04: Version update indicator source-contract assertions.
 *
 * D-08 (the "Updated" signal appears when a newer published version exists than
 *        the worker's last completion -- derived from published_at vs the last
 *        completion, not a hardcoded literal)
 * D-09 (the signal is a passive badge only -- no forced re-walk; workers see it
 *        as informational context)
 *
 * Repointed in 57-08: the list page and its library card are gone. The signal is
 * derived once in `useWorkerSops` (`hasNewerVersion`), classified once in
 * `plantRelState` (`worker-signal.ts`, the `new` state, labelled "Updated") and
 * rendered by the shared `RelBadge` on machine bodies and the Now card.
 *
 * CLAUDE.md 2026-06-05: assert WIRING, not token presence.
 * Registration: phase23-stubs project in playwright.config.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { plantRelState, PLANT_REL_LABEL, type WorkerSop } from '@/lib/sop/worker-signal'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

const base = {
  isAssigned: true,
  isRefresherDue: false,
  isRefresherOverdue: false,
  hasNewerVersion: false,
  lastCompletedAt: '2026-01-01T00:00:00Z',
} as unknown as WorkerSop

test('AFL-VER-04: a newer published version classifies as the Updated state (not hardcoded)', () => {
  expect(plantRelState({ ...base, hasNewerVersion: true })).toBe('new')
  expect(plantRelState({ ...base, hasNewerVersion: false })).toBe('done')
  expect(PLANT_REL_LABEL.new).toBe('Updated')
})

test('AFL-VER-04 D-08: hasNewerVersion is derived from published_at vs the last completion', () => {
  const src = read('src/hooks/useWorkerSops.ts')
  const fn = src.slice(src.indexOf('function hasNewerVersion'))
  const body = fn.slice(0, fn.indexOf('\n  }'))
  expect(body).toContain('publishedAt')
  expect(body).toContain('lastCompletionByRoot')
  expect(body).toMatch(/>/)
  expect(src).toContain('hasNewerVersion: hasNewerVersion(sop.id, sop.published_at)')
})

test('AFL-VER-04: the shared RelBadge renders the state and the machine body and Now card call it', () => {
  const badge = read('src/components/sop/plant/RelBadge.tsx')
  expect(badge).toContain('PLANT_REL_LABEL[rel]')
  expect(badge).toContain('data-rel={rel}')
  expect(read('src/components/sop/plant/MachinePanel.tsx')).toContain('<RelBadge rel={rel} />')
  expect(read('src/components/sop/plant/NowCard.tsx')).toContain('<RelBadge rel={now.rel} />')
})

test('AFL-VER-04 D-09: the badge is informational only -- no handler, no navigation', () => {
  const badge = read('src/components/sop/plant/RelBadge.tsx')
  expect(badge).not.toMatch(/onClick|router\.|<Link|href=/)
})
