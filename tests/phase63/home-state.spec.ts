/**
 * Phase 63 -- the home address module. Requirement HOME-05; threats T-63-04, T-63-05. Owner: 63-02.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  HOME,
  SECTIONS,
  backForPath,
  formatHome,
  homeFrom,
  homeFromAddress,
  homeFromToken,
  legacyPathRedirect,
  legacyToHome,
  parseHome,
  resolveHome,
  sectionsForRole,
  tabsFor,
  type HomeState,
} from '../../src/lib/shell/home-state'
import { notificationPlace } from '../../src/lib/notifications/places'
import { NOTIFICATION_KINDS } from '../../src/lib/notifications/kinds'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const state = (p: Partial<HomeState>): HomeState => ({ ...HOME, ...p })

test.describe('home state', () => {
  test('sections and tabs by role', () => {
    expect(sectionsForRole('worker')).toEqual(['sops', 'record'])
    expect(sectionsForRole('supervisor')).toEqual(['sops', 'record', 'signoffs'])
    expect(sectionsForRole('admin')).toEqual(['sops', 'record', 'training', 'signoffs', 'people', 'manage'])
    expect(sectionsForRole('safety_manager')).toEqual(SECTIONS)
    expect(sectionsForRole(null)).toEqual(['sops'])
    expect(tabsFor('signoffs', 'supervisor')).toEqual(['inbox', 'requests'])
    expect(tabsFor('signoffs', 'admin')).toEqual(['inbox', 'requests', 'decisions'])
    expect(tabsFor('signoffs', 'safety_manager')).toEqual(['inbox', 'requests', 'decisions'])
    expect(tabsFor('people', 'admin')).toEqual(['people', 'access'])
    expect(tabsFor('people', 'safety_manager')).toEqual(['people', 'access'])
    expect(tabsFor('people', 'supervisor')).toEqual([])
    expect(tabsFor('manage', 'admin')).toEqual([])
    expect(tabsFor('sops', 'admin')).toEqual([])
  })

  test('parseHome whitelists and formatHome is its inverse', () => {
    expect(formatHome(HOME)).toBe('/')
    const valid: HomeState[] = [
      HOME,
      state({ sop: U1 }),
      state({ area: U2 }),
      state({ area: 'site-wide', sop: U1 }),
      state({ s: 'record' }),
      state({ s: 'training' }),
      state({ s: 'signoffs' }),
      state({ s: 'signoffs', tab: 'requests' }),
      state({ s: 'signoffs', tab: 'decisions' }),
      state({ s: 'people' }),
      state({ s: 'people', tab: 'access' }),
      state({ s: 'people', tab: 'access', pin: U1 }),
      state({ s: 'manage' }),
      state({ s: 'manage', view: 'site' }),
    ]
    for (const v of valid) expect(parseHome(formatHome(v).replace(/^\/\??/, '')), formatHome(v)).toEqual(v)
    expect(formatHome(state({ s: 'signoffs', tab: 'requests' }))).toBe('/?s=signoffs&tab=requests')
  })

  test('parseHome drops anything not whitelisted', () => {
    expect(parseHome('s=admin')).toEqual(HOME)
    expect(parseHome('sop=not-a-uuid&area=//evil.com')).toEqual(HOME)
    expect(parseHome(`s=record&sop=${U1}&area=site-wide`)).toEqual(state({ s: 'record' })) // sop/area only in sops
    expect(parseHome('s=sops&tab=access')).toEqual(HOME)
    expect(parseHome(`s=people&pin=${U1}`)).toEqual(state({ s: 'people' })) // pin only with access
    expect(parseHome('s=signoffs&tab=access')).toEqual(state({ s: 'signoffs' }))
    expect(parseHome('s=record&view=site')).toEqual(state({ s: 'record' }))
    expect(parseHome(`?sop=${U1.toUpperCase()}`)).toEqual(state({ sop: U1 }))
  })

  test('resolveHome gates sections and tabs by role', () => {
    expect(resolveHome(state({ s: 'people' }), 'worker')).toEqual(HOME)
    expect(resolveHome(state({ s: 'manage' }), 'supervisor')).toEqual(HOME)
    expect(resolveHome(state({ s: 'training' }), 'supervisor')).toEqual(HOME)
    expect(resolveHome(state({ s: 'signoffs', tab: 'decisions' }), 'supervisor')).toEqual(state({ s: 'signoffs' }))
    expect(resolveHome(state({ s: 'signoffs', tab: 'decisions' }), 'admin')).toEqual(state({ s: 'signoffs', tab: 'decisions' }))
    expect(resolveHome(state({ s: 'people', tab: 'access', pin: U1 }), 'admin')).toEqual(state({ s: 'people', tab: 'access', pin: U1 }))
    expect(resolveHome(state({ sop: U1 }), null)).toEqual(state({ sop: U1 }))
    expect(resolveHome(state({ s: 'record' }), null)).toEqual(HOME)
  })

  test('legacy place tokens map to the new addresses', () => {
    expect(legacyToHome('office')).toEqual(state({ s: 'signoffs' }))
    expect(legacyToHome('office', 'requests')).toEqual(state({ s: 'signoffs', tab: 'requests' }))
    expect(legacyToHome('office', 'decisions')).toEqual(state({ s: 'signoffs', tab: 'decisions' }))
    expect(legacyToHome('office', 'inbox')).toEqual(state({ s: 'signoffs' }))
    expect(legacyToHome('office', 'people')).toEqual(state({ s: 'people' }))
    expect(legacyToHome('office', 'access', U1)).toEqual(state({ s: 'people', tab: 'access', pin: U1 }))
    expect(legacyToHome('office', 'access', 'x')).toEqual(state({ s: 'people', tab: 'access' }))
    expect(legacyToHome('smoko')).toEqual(state({ s: 'record' }))
    expect(legacyToHome('workshop')).toEqual(state({ s: 'manage' }))
    expect(legacyToHome('noticeboard')).toEqual(HOME)
    expect(legacyToHome('edit')).toEqual(state({ s: 'manage', view: 'site' }))
    expect(legacyToHome(U1)).toEqual(HOME)
    expect(legacyToHome(`dept:${U1}`)).toEqual(state({ area: U1 }))
    expect(legacyToHome('dept:nope')).toEqual(HOME)
    expect(legacyToHome('whatever')).toEqual(HOME)
    expect(legacyToHome(null)).toEqual(HOME)
  })

  test('homeFromAddress resolves old and new addresses and refuses the rest', () => {
    expect(homeFromAddress('/')).toEqual(HOME)
    expect(homeFromAddress('/?place=office')).toEqual(state({ s: 'signoffs' }))
    expect(homeFromAddress('/?place=office&tab=requests')).toEqual(state({ s: 'signoffs', tab: 'requests' }))
    expect(homeFromAddress('/?s=signoffs&tab=requests')).toEqual(state({ s: 'signoffs', tab: 'requests' }))
    expect(homeFromAddress(`/sops/${U1}`)).toBeNull()
    expect(homeFromAddress(`/sops/${U1}?from=s%3Drecord`)).toBeNull()
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:x', '/?s=record&x=/evil', null, 42, '/?' + 'a'.repeat(400)]) {
      expect(homeFromAddress(bad), String(bad)).toEqual(HOME)
    }
  })

  test('homeFrom and homeFromToken never carry raw text', () => {
    expect(homeFrom(HOME)).toBe('')
    expect(homeFrom(state({ s: 'signoffs', tab: 'requests' }))).toBe('s=signoffs&tab=requests')
    expect(homeFromToken('s=signoffs')).toEqual(state({ s: 'signoffs' }))
    expect(homeFromToken(`sop=${U1}`)).toEqual(state({ sop: U1 }))
    expect(homeFromToken('office')).toEqual(state({ s: 'signoffs' }))
    expect(homeFromToken('edit')).toEqual(state({ s: 'manage', view: 'site' }))
    for (const bad of ['//evil.com', 'javascript:x', 'office&x=1', '', null, undefined, 's=<script>']) {
      expect(homeFromToken(bad), String(bad)).toEqual(HOME)
    }
  })

  test('Back for a bridged path', () => {
    expect(backForPath('/pending')).toBeNull()
    expect(backForPath(`/sops/${U1}`)).toBeNull()
    expect(backForPath('/activity')).toBe('/?s=record')
    expect(backForPath(`/activity/${U1}`)).toBe('/?s=record')
    expect(backForPath('/admin/training')).toBe('/?s=training')
    for (const p of ['/admin/settings', '/admin/sops/new', '/admin/sops/new/ai', '/admin/sops/upload']) {
      expect(backForPath(p), p).toBe('/?s=manage')
    }
    expect(backForPath('/anything/else')).toBe('/')
  })

  test('legacy paths redirect to fixed templates', () => {
    expect(legacyPathRedirect('/governance', '')).toBe('/?s=signoffs')
    expect(legacyPathRedirect('/governance', 'view=library')).toBe('/')
    expect(legacyPathRedirect('/admin/team', '')).toBe('/?s=people')
    expect(legacyPathRedirect('/admin/access', '')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/admin/access', `sop=${U1}`)).toBe(`/?s=people&tab=access&pin=${U1}`)
    expect(legacyPathRedirect('/admin/access', 'sop=//evil.com')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/sops', '')).toBe('/')
    expect(legacyPathRedirect('/sops', 'view=attention')).toBe('/?s=signoffs')
    expect(legacyPathRedirect('/sops', `view=access&sop=${U2}`)).toBe(`/?s=people&tab=access&pin=${U2}`)
    expect(legacyPathRedirect('/sops', 'view=access&sop=%2F%2Fevil.com&next=https://evil.com')).toBe('/?s=people&tab=access')
    expect(legacyPathRedirect('/dashboard', '')).toBeNull()
  })

  test('every old governance, team, access and list address lands on a home screen', () => {
    const search = [['/governance', ''], ['/governance', 'view=library'], ['/admin/team', ''], ['/admin/access', ''], ['/sops', 'view=attention'], ['/sops', '']] as const
    for (const [p, q] of search) {
      expect(legacyPathRedirect(p, q), `${p}?${q}`).not.toBeNull()
    }
  })

  test('every current notification place still resolves through the module', () => {
    for (const kind of NOTIFICATION_KINDS) {
      const place = notificationPlace(kind, { sopId: U1 })
      const home = homeFromAddress(place)
      if (place.startsWith('/sops/')) expect(home, kind).toBeNull()
      else expect(home, kind).not.toBeNull()
    }
    expect(homeFromAddress(notificationPlace('signoff'))).toEqual(state({ s: 'signoffs' }))
  })

  test('the module is plain: no Next import, no directive', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/shell/home-state.ts'), 'utf8')
    expect(src).not.toMatch(/from 'next\/|'use client'|'use server'/)
  })
})
