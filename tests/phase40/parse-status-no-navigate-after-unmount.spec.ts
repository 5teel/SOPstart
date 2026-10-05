import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Regression guard: clicking "Manage SOPs" threw you into the last SOP you
 * were drafting, a second later, with no input.
 *
 * ParseJobStatus polls parse_jobs on an interval. Clearing that interval on
 * unmount does NOT cancel a request already in flight, so a poll fired just
 * before navigation resolved on a dead component and still ran its completion
 * branch — `onCompleted()`, which PromptClient binds
 * to router.push('/admin/sops/builder/…'). The user had left the page; the
 * app dragged them back.
 *
 * The fix is an effect-scoped `cancelled` flag set in the cleanup and checked
 * after every await and in the realtime handler. This spec pins it, because
 * the failure is invisible to every other gate: it type-checks, it builds, and
 * it only reproduces when a navigation races an in-flight poll.
 */

const ROOT = process.cwd()
// Phase 58-13: the realtime + polling engine moved out of ParseJobStatus into
// useParseJob (shared with the editor's parsing view); the guard lives with it.
const PARSE_JOB_STATUS = path.join(ROOT, 'src', 'components', 'admin', 'ParseJobStatus.tsx')
const PARSE_JOB_HOOK = path.join(ROOT, 'src', 'hooks', 'useParseJob.ts')

function read(): string {
  return fs.readFileSync(PARSE_JOB_HOOK, 'utf-8').replace(/\r\n/g, '\n')
}

/**
 * Comments discuss `onCompleted()` by name — including the one explaining this
 * very bug — so scanning raw source finds call sites that do not exist. Strip
 * comment lines before looking for real ones.
 */
function readCode(): string {
  return read()
    .split('\n')
    .map((line) => {
      const t = line.trimStart()
      return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') ? '' : line
    })
    .join('\n')
}

test('ParseJobStatus gets its engine from useParseJob and keeps no poll of its own', () => {
  const src = fs.readFileSync(PARSE_JOB_STATUS, 'utf-8')
  expect(src).toContain('useParseJob(')
  expect(src).not.toContain('POLL_INTERVAL_MS')
  expect(src).not.toContain('postgres_changes')
})

test('the focus editor view reads the same hook and the hook never navigates', () => {
  const progress = fs.readFileSync(path.join(ROOT, 'src', 'components', 'focus', 'admin', 'ParseProgress.tsx'), 'utf-8')
  expect(progress).toContain('useParseJob(')
  expect(read()).not.toMatch(/router\.|useRouter|window\.location/)
})

test('the parse-job hook declares a cancelled flag and sets it in the effect cleanup', () => {
  const src = read()
  expect(src, 'effect-scoped cancellation flag').toContain('let cancelled = false')
  expect(src, 'flag must be raised in the cleanup, not just declared').toContain('cancelled = true')

  // The declaration must come before the cleanup that raises it — i.e. they
  // belong to the same effect rather than being two unrelated occurrences.
  expect(src.indexOf('let cancelled = false')).toBeLessThan(src.indexOf('cancelled = true'))
})

test('every onCompleted call is preceded by a cancelled check', () => {
  const src = readCode()
  const completions = [...src.matchAll(/onCompleted\(\)/g)].map((m) => m.index ?? -1)
  expect(completions.length, 'useParseJob should still invoke onCompleted').toBeGreaterThan(0)

  for (const at of completions) {
    // Walk back to the nearest cancelled guard and the nearest await. A guard
    // must sit between the last suspension point and the navigation callback.
    const before = src.slice(0, at)
    const lastGuard = before.lastIndexOf('if (cancelled) return')
    const lastAwait = before.lastIndexOf('await ')
    expect(
      lastGuard,
      `onCompleted() at index ${at} has no cancelled guard before it — a poll ` +
        `resolving after unmount will navigate a user who has already left`
    ).toBeGreaterThan(-1)
    if (lastAwait > -1) {
      expect(
        lastGuard,
        `the cancelled guard must come AFTER the last await before onCompleted() ` +
          `at index ${at}, or the check happens before the suspension that outlives the component`
      ).toBeGreaterThan(lastAwait)
    }
  }
})

test('the async parse-job poll and the realtime handler are both guarded', () => {
  const src = read()
  // The poll's await and the realtime callback each need a guard before any
  // setState/callback runs.
  expect(src.match(/if \(cancelled\) return/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
})
