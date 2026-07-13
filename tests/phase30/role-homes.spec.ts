/**
 * UX-01 — One home per role (flipped live in 30-02).
 *
 * Contract (30-02-PLAN must_haves + orchestrator decision #5):
 *   - `roleHome(role)` lives in src/lib/auth/role-home.ts (NEVER exported from
 *     src/actions/* — 'use server' sync-export trap, CLAUDE.md 2026-06-27):
 *       worker → /sops · supervisor → /activity · safety_manager → /activity ·
 *       admin → /admin/sops · absent/unknown role → /pending (safe default A1).
 *   - middleware.ts + actions/auth.ts redirect through roleHome (JWT claim
 *     `user_role` via shared parseJwtPayload — never raw atob, 2026-06-26).
 *   - /dashboard survives ONLY as a redirect shim (role → home); the
 *     AdminDashboard/PendingDashboard UI is deleted; pending UI lives at /pending.
 *   - TopHeader/BottomTabBar nav repoints are 30-04 scope (that test stays fixme).
 *
 * Source-contract idiom mirrors tests/phase28/governance-queue.spec.ts.
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
  test('roleHome maps worker→/sops, supervisor/safety_manager→/activity, admin→/admin/sops, unknown→/pending', () => {
    const src = read(ROLE_HOME)
    // all 5 cases of the mapping present in the ONE decision function
    expect(src).toContain("case 'worker'")
    expect(src).toContain("case 'supervisor'")
    expect(src).toContain("case 'safety_manager'")
    expect(src).toContain("case 'admin'")
    expect(src).toContain("'/sops'")
    expect(src).toContain("'/activity'")
    expect(src).toContain("'/admin/sops'")
    expect(src).toContain("'/pending'")
    // NOT a 'use server' file (sync export would break next build)
    expect(src).not.toContain("'use server'")
  })

  test('middleware routes authed users via roleHome (JWT claim, no DB call)', () => {
    const src = read(MIDDLEWARE)
    expect(src).toContain('roleHome')
    // 2026-07-13: getClaims() replaces getUser() + parseJwtPayload — verifies
    // the JWT locally (asymmetric ES256 keys) and hands back parsed claims,
    // so no per-request Supabase Auth round-trip and no manual decoding.
    expect(src).toContain('getClaims')
    expect(src).toContain("'user_role'")
    // no raw atob claim read (Base64URL trap, 2026-06-26)
    expect(src).not.toContain('atob(')
  })

  test('auth actions redirect through roleHome, not hardcoded /dashboard', () => {
    const src = read(AUTH_ACTIONS)
    expect(src).toContain('roleHome')
    expect(src).not.toContain("redirect('/dashboard')")
  })

  // Flipped live in 30-04 (TopHeader/BottomTabBar nav repoint).
  test('TopHeader has zero /dashboard hrefs (brand + BASE_LINKS repointed)', () => {
    const src = read(TOP_HEADER)
    expect(src).not.toContain("'/dashboard'")
    expect(src).not.toContain('"/dashboard"')
  })

  test('/dashboard page is a redirect-only shim (no AdminDashboard/PendingDashboard UI)', () => {
    const src = read(
      path.join(ROOT, 'src', 'app', '(protected)', 'dashboard', 'page.tsx'),
    )
    expect(src).toContain('roleHome(')
    expect(src).toContain('redirect(')
    expect(src).not.toContain('DashTile')
    expect(src).not.toContain('AdminDashboard')
  })

  test('/pending page + app-level not-found.tsx exist; journeys/roles land no role on /dashboard', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', '(protected)', 'pending', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', 'not-found.tsx'))).toBe(true)
    const journeys = read(path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts'))
    const roles = read(path.join(ROOT, 'src', 'lib', 'journeys', 'roles.ts'))
    // roles.ts (landsOn) never points anyone at the shim.
    expect(roles).not.toContain("'/dashboard'")
    // journeys.ts maps /dashboard EXACTLY ONCE — as the legacy redirect shim
    // (30-08: the route survives in the tree per decision #5, so /pathways
    // needs it covered for 0 not-mapped; no journey LANDS anyone there).
    expect(journeys.split("'/dashboard'").length - 1).toBe(1)
    expect(journeys).toContain('Redirect-only shim')
  })
})
