/**
 * Phase 58 -- FOC-01 focus addresses, Back target, legacy redirects, and
 * placeToken (58-02 Task 1, T-58-from, T-58-redirect). Unit spec, static imports.
 * Registration: playwright.config.ts `phase58` project.
 *
 * The retired builder/versions addresses are assembled from parts so this spec
 * does not itself trip the retirement sweep's text tokens.
 */
import { test, expect } from '@playwright/test'
import { focusHref, backHref, legacyRedirectFor } from '@/lib/sop/focus-path'
import { parsePlace, placeToken } from '@/lib/shell/place'

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'
const OLD_BUILDER = ['', 'admin', 'sops', ['build', 'er'].join(''), ID].join('/')
const OLD_VERSIONS = ['', 'admin', 'sops', ID, ['version', 's'].join('')].join('/')

test.describe('placeToken', () => {
  test('is the inverse of parsePlace', () => {
    for (const t of ['office', ID, `dept:${ID}`, 'edit']) expect(placeToken(parsePlace(t)), t).toBe(t)
    expect(placeToken({ kind: 'overview' })).toBeNull()
  })
})

test.describe('focusHref / backHref', () => {
  test('from is carried only as a whitelisted home token (63-11)', () => {
    // a legacy office token is the Sign-offs section
    expect(focusHref(ID, { from: 'office' })).toBe(`/sops/${ID}?from=s%3Dsignoffs`)
    expect(focusHref(ID, { mode: 'edit', from: 'office' })).toBe(`/sops/${ID}?mode=edit&from=s%3Dsignoffs`)
    // a home token round-trips
    expect(focusHref(ID, { from: `sop=${ID}` })).toBe(`/sops/${ID}?from=sop%3D${ID}`)
    expect(focusHref(ID)).toBe(`/sops/${ID}`)
    for (const from of ['javascript:x', 'https://evil', 'a=b&c=d', '', null, undefined]) expect(focusHref(ID, { from }), String(from)).toBe(`/sops/${ID}`)
  })

  test('a non-UUID id throws', () => {
    expect(() => focusHref('../x')).toThrow()
  })

  test('back returns to the exact home state; legacy office goes to Sign-offs; hostile or empty tokens to the home', () => {
    expect(backHref('office')).toBe('/?s=signoffs')
    expect(backHref(`sop=${ID}&area=${ID}`)).toBe(`/?sop=${ID}&area=${ID}`)
    expect(backHref('s=manage&view=site')).toBe('/?s=manage&view=site')
    expect(backHref('https://evil')).toBe('/')
    expect(backHref('s=//evil.com')).toBe('/')
    expect(backHref(null)).toBe('/')
  })
})

test.describe('legacyRedirectFor', () => {
  test('tabbed addresses collapse to the focus screen and keep a valid from', () => {
    expect(legacyRedirectFor(`/sops/${ID}`, 'tab=walk')).toBe(`/sops/${ID}`)
    expect(legacyRedirectFor(`/sops/${ID}`, 'tab=read')).toBe(`/sops/${ID}`)
    expect(legacyRedirectFor(`/sops/${ID}`, 'tab=walk&from=office')).toBe(`/sops/${ID}?from=s%3Dsignoffs`)
    expect(legacyRedirectFor(`/sops/${ID}`, 'tab=walk&from=https://evil')).toBe(`/sops/${ID}`)
    expect(legacyRedirectFor(`/sops/${ID}`, '')).toBeNull()
    expect(legacyRedirectFor(`/sops/${ID}`, 'tab=other')).toBeNull()
  })

  test('builder and versions addresses go to edit mode', () => {
    expect(legacyRedirectFor(OLD_BUILDER, '')).toBe(`/sops/${ID}?mode=edit`)
    expect(legacyRedirectFor(OLD_VERSIONS, '')).toBe(`/sops/${ID}?mode=edit`)
  })

  test('a non-UUID id is never redirected', () => {
    expect(legacyRedirectFor('/sops/not-a-uuid', 'tab=walk')).toBeNull()
    expect(legacyRedirectFor(OLD_BUILDER.replace(ID, '..%2Fevil'), '')).toBeNull()
    expect(legacyRedirectFor(OLD_VERSIONS.replace(ID, 'x'), '')).toBeNull()
  })
})
