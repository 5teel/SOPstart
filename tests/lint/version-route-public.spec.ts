import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// CLAUDE.md 2026-07-05: a cookie-less API route must be exempted in the session
// middleware or it 307s to /login before its handler runs. /api/version is what
// scripts/run-evals.mjs polls to know Railway is serving the commit under test.
test('/api/version is exempted from the session middleware', () => {
  const mw = fs.readFileSync(path.join(process.cwd(), 'src/lib/supabase/middleware.ts'), 'utf8').replace(/\r\n/g, '\n')
  expect(mw).toContain("const isVersionRoute = path === '/api/version'")
  expect(mw).toMatch(/const isPublicRoute = [^\n]*isVersionRoute/)
  expect(fs.existsSync(path.join(process.cwd(), 'src/app/api/version/route.ts'))).toBe(true)
})

// Railway's healthcheck needs a 2xx with no session. `/` redirects a signed-out
// request to /welcome (307), which failed every deploy's healthcheck
// (2026-10-06), so the check targets the always-200 version route.
test('the Railway healthcheck targets /api/version, never a redirecting page', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'railway.json'), 'utf8'))
  expect(cfg.deploy.healthcheckPath).toBe('/api/version')
})
