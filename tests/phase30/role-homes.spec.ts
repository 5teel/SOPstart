/**
 * UX-01 — One home per role (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + orchestrator decision #5):
 *   - `roleHome(role)` lives in src/lib/auth/role-home.ts (NEVER exported from
 *     src/actions/* — 'use server' sync-export trap, CLAUDE.md 2026-06-27):
 *       worker → /sops · supervisor → /activity · safety_manager → /activity ·
 *       admin → /admin/sops · absent/unknown claim → safe default /sops (A1).
 *   - middleware.ts + actions/auth.ts redirect through roleHome (JWT claim
 *     `user_role` via shared parseJwtPayload — never raw atob, 2026-06-26).
 *   - /dashboard survives ONLY as a redirect shim (role → home); the
 *     AdminDashboard/PendingDashboard UI is deleted; PendingDashboard JSX
 *     relocates (/pending or inline on /sops).
 *   - TopHeader, BottomTabBar, journeys.ts point directly at real role homes
 *     (zero '/dashboard' hrefs in nav components).
 *
 * Source-contract idiom mirrors tests/phase28/governance-queue.spec.ts.
 * This file starts as test.fixme — the UX-01 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ROLE_HOME = path.join(ROOT, 'src', 'lib', 'auth', 'role-home.ts')
const MIDDLEWARE = path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts')
const AUTH_ACTIONS = path.join(ROOT, 'src', 'actions', 'auth.ts')
const TOP_HEADER = path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-01 — one home per role', () => {
  test.fixme('roleHome maps worker→/sops, supervisor/safety_manager→/activity, admin→/admin/sops, unknown→/sops', () => {
    const src = read(ROLE_HOME)
    expect(src).toContain("'/sops'")
    expect(src).toContain("'/activity'")
    expect(src).toContain("'/admin/sops'")
  })

  test.fixme('middleware routes authed users via roleHome (JWT claim, no DB call)', () => {
    const src = read(MIDDLEWARE)
    expect(src).toContain('roleHome')
    expect(src).toContain('parseJwtPayload')
  })

  test.fixme('auth actions redirect through roleHome, not hardcoded /dashboard', () => {
    const src = read(AUTH_ACTIONS)
    expect(src).toContain('roleHome')
    expect(src).not.toContain("redirect('/dashboard')")
  })

  test.fixme('TopHeader has zero /dashboard hrefs (brand + BASE_LINKS repointed)', () => {
    const src = read(TOP_HEADER)
    expect(src).not.toContain("'/dashboard'")
    expect(src).not.toContain('"/dashboard"')
  })

  test.fixme('/dashboard page is a redirect-only shim (no AdminDashboard/PendingDashboard UI)', () => {
    const src = read(
      path.join(ROOT, 'src', 'app', '(protected)', 'dashboard', 'page.tsx'),
    )
    expect(src).toContain('redirect(')
    expect(src).not.toContain('DashTile')
  })
})
