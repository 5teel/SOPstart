import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { buildCsp, CSP_HEADER } from '../../src/lib/security/csp'

// Phase 68 / ADR-0030: pins the security headers. The CSP is built per request in the proxy; the static
// headers live in next.config.ts.
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n')

test.describe('ADR-0030: security headers', () => {
  const csp = buildCsp('Tk9OQ0U=', 'https://example-ref.supabase.co')
  const directives = Object.fromEntries(csp.split('; ').map((d) => { const [k, ...v] = d.split(' '); return [k, v] }))

  test('the CSP allows only what the app loads', () => {
    expect(directives['default-src']).toEqual(["'self'"])
    expect(directives['script-src']).toEqual(["'self'", "'nonce-Tk9OQ0U='", "'strict-dynamic'"])
    expect(directives['connect-src']).toEqual(["'self'", 'https://example-ref.supabase.co', 'wss://example-ref.supabase.co'])
    expect(directives['img-src']).toEqual(["'self'", 'data:', 'blob:', 'https://example-ref.supabase.co'])
    expect(directives['frame-ancestors']).toEqual(["'none'"])
    expect(directives['object-src']).toEqual(["'none'"])
    expect(directives['base-uri']).toEqual(["'self'"])
    expect(directives['form-action']).toEqual(["'self'"])
    expect(directives['report-uri']).toEqual(['/api/csp-report'])
    expect(directives).toHaveProperty('upgrade-insecure-requests')
  })

  test("no 'unsafe-eval', no bare wildcard, no hard-coded Supabase host", () => {
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp.split(/[ ;]+/)).not.toContain('*')
    expect(csp).not.toMatch(/https?:\/\/\*|\*\./)
    const src = read('src/lib/security/csp.ts')
    expect(src).not.toMatch(/[a-z0-9]{20}\.supabase\.co/)
    expect(read('src/proxy.ts')).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL')
  })

  test('the proxy sends the CSP on the request (Next reads the nonce) and on the response', () => {
    const proxy = read('src/proxy.ts')
    expect(proxy).toContain('headers.set(CSP_HEADER, csp)')
    expect(proxy).toContain('response.headers.set(CSP_HEADER, csp)')
    expect(proxy).toContain('crypto.randomUUID()')
    expect(proxy).toMatch(/matcher: \[[^\n]*_next\/static[^\n]*sw\\\.js[^\n]*webmanifest[^\n]*woff2/)
    expect(CSP_HEADER).toBe('Content-Security-Policy')
    expect(read('src/instrumentation-client.ts')).toContain('config({ jitless: true })')
  })

  test('every page renders per request, so no page ships a stale nonce', () => {
    expect(read('src/app/layout.tsx')).toContain('await connection()')
    const pages = fs.readdirSync(path.join(process.cwd(), 'src/app'), { recursive: true }) as string[]
    for (const f of pages.filter((p) => /\.(tsx|ts)$/.test(p))) {
      expect(read(path.join('src/app', f)), f).not.toMatch(/dynamic\s*=\s*['"]force-static['"]/)
    }
  })

  test('next.config.ts sends the static headers on every path', () => {
    const cfg = read('next.config.ts')
    expect(cfg).toContain("source: '/:path*'")
    expect(cfg).toContain("{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }")
    expect(cfg).toContain("{ key: 'X-Content-Type-Options', value: 'nosniff' }")
    expect(cfg).toContain("{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }")
    expect(cfg).toMatch(/key: 'Permissions-Policy', value: 'camera=\(self\), microphone=\(self\), geolocation=\(\)/)
    expect(cfg).toContain("{ key: 'X-Frame-Options', value: 'DENY' }")
    expect(cfg).toContain("{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }")
  })

  test('the report route is public, capped, and never logs the body', () => {
    const mw = read('src/lib/supabase/middleware.ts')
    expect(mw).toContain("const isCspReport = path === '/api/csp-report'")
    expect(mw).toMatch(/const isPublicRoute = [^\n]*isCspReport/)
    const route = read('src/app/api/csp-report/route.ts')
    expect(route).toContain('MAX_BYTES')
    expect(route).toContain('status: 204')
    expect(route).not.toMatch(/console\.\w+\([^)]*\b(text|req|cookies)\b/)
  })
})
