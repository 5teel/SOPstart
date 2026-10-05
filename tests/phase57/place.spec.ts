/**
 * Phase 57 -- SHL-02 the place address (57-01, D-11, D-15a, T-57-01).
 *
 * Unit spec over src/lib/shell/place.ts: parsePlace never throws and never
 * echoes an unknown token; formatPlace round-trips every kind; placeForPath
 * gives each bridged page its Back destination.
 *
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import { parsePlace, formatPlace, placeForPath, type Place } from '@/lib/shell/place'

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'

test.describe('SHL-02 place address', () => {
  test('unknown, empty and hostile tokens fall back to the overview', () => {
    for (const t of [null, undefined, '', 'x', 'dept:nope', 'dept:', '../evil', '<script>', 'office ', 'OFFICE', `${ID}x`]) {
      expect(parsePlace(t as string | null | undefined), String(t)).toEqual({ kind: 'overview' })
    }
  })

  test('the fallback never carries the raw token', () => {
    expect(JSON.stringify(parsePlace('<script>alert(1)</script>'))).not.toContain('script')
  })

  test('edit, rooms, machines and departments parse', () => {
    expect(parsePlace('edit')).toEqual({ kind: 'edit' })
    expect(parsePlace('office')).toEqual({ kind: 'room', id: 'office' })
    expect(parsePlace('smoko')).toEqual({ kind: 'room', id: 'smoko' })
    expect(parsePlace('workshop')).toEqual({ kind: 'room', id: 'workshop' })
    expect(parsePlace('noticeboard')).toEqual({ kind: 'room', id: 'noticeboard' })
    expect(parsePlace(ID)).toEqual({ kind: 'machine', id: ID })
    expect(parsePlace(`dept:${ID}`)).toEqual({ kind: 'dept', id: ID })
  })

  test('an upper-case UUID is accepted', () => {
    expect(parsePlace(ID.toUpperCase())).toEqual({ kind: 'machine', id: ID.toUpperCase() })
  })

  test('formatPlace round-trips every kind', () => {
    const cases: Array<[Place, string]> = [
      [{ kind: 'overview' }, '/'],
      [{ kind: 'edit' }, '/?place=edit'],
      [{ kind: 'room', id: 'office' }, '/?place=office'],
      [{ kind: 'machine', id: ID }, `/?place=${ID}`],
      [{ kind: 'dept', id: ID }, `/?place=dept:${ID}`],
    ]
    for (const [place, url] of cases) {
      expect(formatPlace(place)).toBe(url)
      const token = new URL(url, 'http://x').searchParams.get('place')
      expect(parsePlace(token)).toEqual(place)
    }
  })

  test('placeForPath sends Settings to the Office and the training bridge to the Smoko room', () => {
    expect(placeForPath('/admin/settings')).toBe('/?place=office')
    expect(placeForPath('/admin/training')).toBe('/?place=smoko')
  })

  test('placeForPath sends activity pages to the Smoko room', () => {
    expect(placeForPath('/activity')).toBe('/?place=smoko')
    expect(placeForPath('/activity/x')).toBe('/?place=smoko')
  })

  test('placeForPath sends new-SOP pages to the Workshop', () => {
    for (const p of ['/admin/sops/new', '/admin/sops/new/blank', '/admin/sops/upload']) {
      expect(placeForPath(p), p).toBe('/?place=workshop')
    }
  })

  test('placeForPath sends every other page to the site, and /pending nowhere', () => {
    for (const p of ['/admin/sops/abc/assign', '/profile']) expect(placeForPath(p), p).toBe('/')
    expect(placeForPath('/pending')).toBeNull()
  })

  test('placeForPath gives the SOP focus screen no Back bar: it owns its own top bar (Phase 58)', () => {
    for (const p of ['/sops/abc', '/sops/0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b']) expect(placeForPath(p), p).toBeNull()
  })
})
