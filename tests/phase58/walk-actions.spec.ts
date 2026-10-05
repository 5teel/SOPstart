/**
 * Phase 58 -- FOC-04 (D-09, D-10, D-15, D-22): server walk actions.
 * Filled by: 58-09.
 * Registration: playwright.config.ts `phase58` project.
 *
 * Source-contract over comment-stripped files, pinning the wiring (not just the
 * tokens): what each action reads, filters by, refuses and calls, in order.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const strip = (src: string) =>
  src
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')
const read = (rel: string) => strip(fs.readFileSync(path.join(ROOT, rel), 'utf-8'))

const walk = read('src/actions/walk.ts')
const completions = read('src/actions/completions.ts')

/** From `export async function name` to the next top-level declaration. */
function body(src: string, name: string): string {
  const start = src.search(new RegExp(`(?:export )?async function ${name}\\b`))
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const next = rest.search(/\n(?:export )?(?:async )?function |\nexport async function /)
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next)
}

test.describe('FOC-04 walk actions', () => {
  test('startWalk, recordWalkStep, startOverWalk take no organisation, user or agent parameter', () => {
    expect(walk.match(/^export (async )?function \w+/gm)?.sort()).toEqual([
      'export async function recordWalkStep',
      'export async function startOverWalk',
      'export async function startWalk',
    ])
    for (const field of ['organisationId', 'organisation_id', 'userId', 'workerId', 'worker_id', 'agent', 'role']) {
      for (const schema of ['startSchema', 'recordSchema', 'startOverSchema']) {
        const m = new RegExp(`const ${schema} = z\\.object\\(\\{[\\s\\S]*?\\}\\)\\n`).exec(walk)
        expect(m, schema).not.toBeNull()
        expect(m![0], `${schema} must not take ${field}`).not.toMatch(new RegExp(`\\b${field}\\s*:`))
      }
    }
  })

  test('every walk read and write is scoped to the session org and the session worker', () => {
    const chains = walk.split(/\.from\('sop_walks'\)/).slice(1)
    expect(chains.length).toBeGreaterThanOrEqual(5)
    for (const c of chains) {
      const q = c.slice(0, 600)
      // the insert carries both as column values instead of filters
      const insert = /^\s*\.insert\(/.test(q)
      expect(q.includes(".eq('organisation_id', organisationId)") || (insert && q.includes('organisation_id: organisationId')), q).toBe(true)
      expect(q.includes(".eq('worker_id', userId)") || (insert && q.includes('worker_id: userId')), q).toBe(true)
    }
    expect(walk).toContain('getSessionContext()')
  })

  test('startWalk only starts a published SOP of the session org, and survives the unique-index race', () => {
    const b = body(walk, 'openWalk')
    expect(b).toContain(".eq('organisation_id', organisationId)")
    expect(b).toContain("sop.status !== 'published'")
    expect(b).toContain("'23505'")
    expect(body(walk, 'startWalk')).toContain('openWalk(')
  })

  test("the step belongs to the walk's SOP", () => {
    const b = body(walk, 'recordWalkStep')
    expect(b).toContain('loadWalkSop(supabase, organisationId, walk.sop_id)')
    expect(b).toMatch(/sop\?\.order\.find\(\(e\) => e\.step\.id === stepId\)/)
    expect(b).toContain('That step is not part of this SOP.')
  })

  test('acknowledgements are accepted only on hazard and ppe steps', () => {
    const b = body(walk, 'recordWalkStep')
    expect(b).toMatch(/entry\.step\.kind === 'hazard' \|\| entry\.step\.kind === 'ppe'\)\s*acks\[stepId\]/)
    expect(b.match(/acks\[stepId\] =/g)).toHaveLength(1)
  })

  test('step order is enforced unless the SOP allows forward jump (D-08)', () => {
    const b = body(walk, 'recordWalkStep')
    expect(b).toContain('isReachable(sop.order, stepId, doneIds, sop.allow_forward_jump)')
    expect(b).toContain('Add a photo to continue.')
    expect(b).toMatch(/entry\.step\.photo_required && !walk\.photos\.some/)
  })

  test('photo paths match the exact {org}/completions/{walkId}/{photoId}.{jpg|png} shape', () => {
    const b = body(walk, 'recordWalkStep')
    expect(b).toContain('`${organisationId}/completions/${walkId}/${photo!.localId}`')
    expect(b).toContain('`${prefix}.png`')
    expect(b).toContain('`${prefix}.jpg`')
    expect(b).toContain('Invalid photo path.')
  })

  test('review CR-01: every sop_walks write is service-role, and a photo is recorded only once its object exists', () => {
    // 00072 dropped the authenticated insert/update policies; the session client would be a silent zero-row deny.
    expect(walk).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
    expect(walk).not.toMatch(/supabase\s*\.from\('sop_walks'\)/)
    expect(walk).not.toMatch(/supabase\s*\n\s*\.from\('sop_walks'\)/)
    expect((walk.match(/admin\s*\n?\s*\.from\('sop_walks'\)/g) ?? []).length).toBeGreaterThanOrEqual(5)
    const b = body(walk, 'recordWalkStep')
    const listed = b.indexOf(".storage.from('completion-photos').list(")
    expect(listed).toBeGreaterThan(-1)
    expect(b).toContain('That photo did not finish uploading.')
    expect(listed).toBeLessThan(b.indexOf('photos = ['))
    expect(fs.readFileSync(path.join(ROOT, 'supabase/migrations/00072_sop_walks_server_written.sql'), 'utf-8')).toMatch(
      /drop policy if exists "workers_can_start_own_sop_walks"[\s\S]*drop policy if exists "workers_can_update_own_sop_walks"/
    )
  })

  test('start over abandons the walk then opens a fresh one on the latest published version (D-12)', () => {
    const b = body(walk, 'startOverWalk')
    expect(b).toContain('latestPublishedOf(')
    expect(b).toContain("status: 'abandoned'")
    expect(b.indexOf("status: 'abandoned'")).toBeLessThan(b.indexOf('openWalk(ctx, latest.id)'))
    expect(b).toContain('sopId: latest.id')
  })

  test('getPhotoUploadUrl signs only for the session worker\'s own in-progress walk', () => {
    const b = body(completions, 'getPhotoUploadUrl')
    const gate = b.indexOf(".from('sop_walks')")
    expect(gate).toBeGreaterThan(-1)
    expect(b).toContain(".eq('id', parsed.data.completionLocalId)")
    expect(b).toContain(".eq('worker_id', userId)")
    expect(b).toContain(".eq('status', 'in_progress')")
    expect(gate).toBeLessThan(b.indexOf('createSignedUploadUrl'))
  })

  test('submitCompletion recomputes from the walk row and refuses a missing ack or photo (D-10, D-15, D-22)', () => {
    const b = body(completions, 'submitCompletion')
    // loaded by id + session org + session worker, never by client step data
    expect(b).toMatch(/\.from\('sop_walks'\)[\s\S]*?\.eq\('organisation_id', organisationId\)[\s\S]*?\.eq\('worker_id', userId\)/)
    expect(b).toContain('reviewMissing(')
    expect(b).toContain("row.status === 'submitted'")
    // the missing check runs before anything is inserted, and not conditional on allow_forward_jump
    expect(b.indexOf('reviewMissing(')).toBeLessThan(b.indexOf(".from('sop_completions')"))
    expect(b).not.toContain('allow_forward_jump')
    // hash and ids come from the server's own order and the walk id
    expect(b).toContain('hashInput(sop.order)')
    expect(b).toContain('const localId = walk.id')
    expect(b).toContain('const photoStoragePaths = walk.photos')
    // walk marked submitted only after the completion insert, then the worker's signature
    const sent = b.indexOf(".from('sop_completions')")
    const marked = b.indexOf("status: 'submitted'")
    const signed = b.indexOf('await recordSignature(')
    expect(sent).toBeGreaterThan(-1)
    expect(marked).toBeGreaterThan(sent)
    expect(signed).toBeGreaterThan(marked)
    expect(b).toContain("role: 'worker'")
  })

  test('review WR-07: a retake removes the earlier object, only after the row is saved and only under this walk\'s folder', () => {
    const b = body(walk, 'recordWalkStep')
    const rm = b.indexOf(".storage.from('completion-photos').remove([prev.storagePath])")
    expect(rm).toBeGreaterThan(-1)
    expect(rm).toBeGreaterThan(b.indexOf('Could not save that step.'))
    expect(b).toContain('prev.storagePath.startsWith(`${organisationId}/completions/${walkId}/`)')
    expect(b).toContain('prev.storagePath !== photo!.storagePath')
  })

  test('review CR-02: a worker signature is refused unless the completion is the caller\'s own', () => {
    const b = body(completions, 'recordSignature')
    expect(b).toMatch(/\.select\('[^']*worker_id[^']*'\)/)
    const own = b.indexOf("role === 'worker' && completion.worker_id !== userId")
    expect(own).toBeGreaterThan(-1)
    expect(own).toBeLessThan(b.indexOf(".from('sop_completion_signatures')"))
  })

  test('submitCompletion takes only { walkId }: no client step data, no ack trace, no hash, no photo list (T-58-walk)', () => {
    const b = body(completions, 'submitCompletion')
    expect(b).toContain("z.object({ walkId: z.string().uuid() }).strict().safeParse(rawInput)")
    expect(b).not.toContain('rawInput.')
    expect(b).toContain('`${organisationId}/completions/${localId}/`')
    expect(b).toContain("insertError?.code === '23505'")
  })
})
