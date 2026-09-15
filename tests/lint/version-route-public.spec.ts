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
