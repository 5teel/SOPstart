/**
 * Phase 55 / Plan 55-01 -- CUT-01 worker-path rewire contract.
 *
 * The worker path (list, pins, Now card, walk, photo, completion) and the
 * admin builder autosave stop reading and writing the on-device cache and
 * talk to the server directly. Each block is fixme until the plan named in
 * its title lands; the plan that lands it deletes the fixme line.
 *
 * Source-contract reads are comment-stripped so prose in a file cannot
 * satisfy or trip an assertion. Where an assertion is about WIRING (a call
 * exists), it checks the call, not just that a name appears.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}
function code(rel: string): string {
  return read(rel)
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')
}
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

const OFFLINE = '@/lib/offline'

test.describe('worker list derives from the server (55-02)', () => {
  test('useWorkerSops takes requestedIds and reads the server', () => {
    const src = code('src/hooks/useWorkerSops.ts')
    expect(src).toMatch(/export function useWorkerSops\(\s*requestedIds/)
    expect(src).not.toMatch(/export function useWorkerSops\([^)]*assignedSops/)
    expect(src).toContain('getUserSopAssignments')
    expect(src).toContain("'library-sops'")
    expect(src).not.toContain(OFFLINE)
  })

  test('sops page has no sync, no offline labels, and still refreshes assignments', () => {
    const src = code('src/app/(protected)/sops/page.tsx')
    for (const gone of ['useAssignedSops', 'useSopSync', 'lastSyncMeta', "'assigned-sops'", 'Offline copy', 'Not saved for offline yet']) {
      expect(src, gone).not.toContain(gone)
    }
    expect(src).toContain("invalidateQueries({ queryKey: ['user-sop-assignments'] })")
  })

  test('worker-signal exports WorkerSopRow and has no cache import', () => {
    const src = code('src/lib/sop/worker-signal.ts')
    expect(src).toMatch(/export type WorkerSopRow/)
    expect(src).not.toContain(OFFLINE)
  })
})

test.describe('SOP detail and Now card read the server (55-02)', () => {

  test('useSopDetail has no cache branch', () => {
    const src = code('src/hooks/useSopDetail.ts')
    expect(src).not.toContain(OFFLINE)
    expect(src).not.toMatch(/\bdb\./)
  })

  test('NowCard sums step minutes from the server', () => {
    const src = code('src/components/sop/plant/NowCard.tsx')
    expect(src).toContain("from('sop_sections')")
    expect(src).not.toContain('networkMode')
    expect(src).not.toContain(OFFLINE)
  })
})

test.describe('builder autosave writes straight to the server (55-02)', () => {

  test('useBuilderAutosave debounces then calls updateSectionLayout', () => {
    const src = code('src/hooks/useBuilderAutosave.ts')
    expect(src).toContain('updateSectionLayout(')
    expect(src).toMatch(/DEBOUNCE_MS\s*=\s*750/)
    expect(src).toContain('server_newer')
    expect(src).toContain('useBuilderSaveStatus')
    expect(src).not.toContain(OFFLINE)
  })

  test('BuilderClient reads the save status store, not the cache', () => {
    const src = code('src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx')
    expect(src).not.toContain('useDraftLayoutSync')
    expect(src).not.toContain(OFFLINE)
    expect(src).not.toContain('useNetworkStore')
    expect(src).toContain('useBuilderSaveStatus')
  })
})

test.describe('walk photos upload directly (55-03)', () => {
  test('compressPhoto lives in lib/photo and useStepPhotos does the two-call upload', () => {
    expect(code('src/lib/photo/compress.ts')).toMatch(/export (async )?function compressPhoto/)
    const hook = code('src/hooks/useStepPhotos.ts')
    expect(hook).toContain('@/lib/photo/compress')
    expect(hook).toContain('getPhotoUploadUrl(')
    expect(hook).toContain("method: 'PUT'")
  })

  test('photos follow the active completion, so a second walk never submits the first walk photos', () => {
    const hook = code('src/hooks/useStepPhotos.ts')
    expect(hook).toContain('export function useStepPhotos(activeCompletionId')
    expect(hook).toContain('p.completionId === activeCompletionId')
    expect(code('src/components/sop/walkthrough/MobileWalkthrough.tsx')).toContain(
      'useStepPhotos(activeCompletion?.localId)'
    )
  })

  test('MobileWalkthrough submits with uploaded photos and nothing is queued', () => {
    const src = code('src/components/sop/walkthrough/MobileWalkthrough.tsx')
    expect(src).toContain('useStepPhotos(')
    expect(src).toContain('submitCompletion(')
    expect(src).not.toContain('window.confirm')
    expect(src).not.toContain(OFFLINE)
    expect(src).not.toContain('@/hooks/usePhotoQueue')
    expect(src).not.toMatch(/queued/i)
  })

  test('the other walk files and the store drop the cache', () => {
    const card = code('src/components/sop/walkthrough/ImmersiveStepCard.tsx')
    expect(card).not.toContain('@/hooks/usePhotoQueue')
    expect(card).not.toContain("'Queued'")
    expect(code('src/components/sop/walkthrough/DesktopWalkthrough.tsx')).not.toContain(OFFLINE)
    const store = code('src/stores/completionStore.ts')
    expect(store).not.toContain(OFFLINE)
    expect(store).not.toContain('restoreFromDexie')
  })
})

test.describe('photo upload URL takes its organisation from the session (55-03)', () => {
  test('getPhotoUploadUrl has no caller-supplied org and validates ids as UUIDs', () => {
    const src = code('src/actions/completions.ts')
    const start = src.indexOf('export async function getPhotoUploadUrl')
    expect(start).toBeGreaterThan(-1)
    const next = src.indexOf('export async function', start + 10)
    const body = src.slice(start, next === -1 ? undefined : next)
    expect(body).not.toContain('input.orgId')
    expect(body).not.toContain('orgId:')
    expect(body.includes('.uuid()') || /uuid/i.test(body)).toBe(true)
  })
})

test.describe('service worker retired (55-09)', () => {
  test('public/sw.js is a committed kill-switch', () => {
    const sw = read('public/sw.js')
    expect(sw).toContain('unregister()')
    expect(sw).toContain('caches.delete')
    expect(read('.gitignore').split('\n').map((l) => l.trim())).not.toContain('/public/sw.js')
  })

  test('next.config has no service worker wrapper and middleware lets sw.js through', () => {
    const cfg = code('next.config.ts')
    expect(cfg).not.toMatch(/serwist/i)
    expect(cfg).toContain('nextDynamic')
    expect(code('src/lib/supabase/middleware.ts')).toContain("'/sw.js'")
  })

  test('no worker source, manifest stays, and nothing imports the cache module', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/sw.ts'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/app/manifest.ts'))).toBe(true)
    const offenders: string[] = []
    for (const f of walk(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, f)
      if (code(rel).includes(OFFLINE)) offenders.push(rel)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
