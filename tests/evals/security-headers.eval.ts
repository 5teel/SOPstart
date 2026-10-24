/**
 * Deployed-site eval: Phase 68 / ADR-0030 security headers.
 *
 * Signed out (no session minted, so no OTP budget spent). Every page response carries the CSP with a fresh
 * nonce and the static headers; Next's scripts carry that nonce; the login and welcome pages load and work
 * with no CSP violation; the public report route answers 204, also for an oversized body.
 * The signed-in screens (passkeys, /verify, sign-in codes, photos, the site map) are covered by their own
 * evals in the same run; their violations land in the Fly log through /api/csp-report.
 *
 * Self-skips when EVAL_BASE_URL is unset.
 */
import { test, expect, type Page } from '@playwright/test'
import { EVAL_ENV_READY } from './lib/session'
import { shot } from './lib/plant-fixture'
import { CSP_HEADER } from '../../src/lib/security/csp'

const H = CSP_HEADER.toLowerCase()

async function violations(page: Page) {
  return page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])
}

test.describe('security headers', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL not set')

  test('SEC-01 every page response carries the CSP with a fresh nonce and the static headers', async ({ request }) => {
    const a = await request.get('/welcome')
    const b = await request.get('/login')
    expect(a.status()).toBe(200)
    expect(b.status()).toBe(200)
    const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1]
    const ca = a.headers()[H] ?? ''
    const cb = b.headers()[H] ?? ''
    expect(ca).toContain("'strict-dynamic'")
    expect(ca).toContain("frame-ancestors 'none'")
    expect(ca).not.toContain("'unsafe-eval'")
    expect(nonceOf(ca)).toBeTruthy()
    expect(nonceOf(ca)).not.toBe(nonceOf(cb))
    // The page's scripts carry this response's nonce: no stale prerendered nonce.
    const html = await a.text()
    expect(html).toContain(`nonce="${nonceOf(ca)}"`)
    const h = a.headers()
    expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy']).toContain('camera=(self)')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['cross-origin-opener-policy']).toBe('same-origin')
  })

  test('SEC-02 welcome and login load and work with no CSP violation', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] }
      w.__csp = []
      document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`))
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/welcome')
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Sign in' }).first().click()
    await expect(page).toHaveURL(/\/login/)
    // Hydrated: the email field takes typing and the form reacts.
    const email = page.getByLabel(/email/i).first()
    await email.fill('nobody@example.com')
    await expect(email).toHaveValue('nobody@example.com')
    await shot(page, '68-login-desktop')
    expect(await violations(page)).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/welcome')
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    await shot(page, '68-welcome-phone')
    expect(await violations(page)).toEqual([])
  })

  test('SEC-03 the report route is public and always answers 204', async ({ request }) => {
    const ok = await request.post('/api/csp-report', {
      headers: { 'content-type': 'application/csp-report' },
      data: JSON.stringify({ 'csp-report': { 'effective-directive': 'eval-probe', 'blocked-uri': 'https://example.com/x?token=secret' } }),
      maxRedirects: 0,
    })
    expect(ok.status()).toBe(204)
    const big = await request.post('/api/csp-report', {
      headers: { 'content-type': 'application/csp-report' },
      data: 'x'.repeat(64 * 1024),
      maxRedirects: 0,
    })
    expect(big.status()).toBe(204)
  })
})
