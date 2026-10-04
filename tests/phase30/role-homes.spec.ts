/**
 * UX-01 — One home per role (flipped live in 30-02).
 *
 * Contract (30-02-PLAN must_haves + orchestrator decision #5):
 *   - `roleHome(role)` lives in src/lib/auth/role-home.ts (NEVER exported from
 *     src/actions/* — 'use server' sync-export trap, CLAUDE.md 2026-06-27):
 *       every role → / (Phase 57 D-10, the one screen) · absent/unknown
 *       role → /pending (safe default A1).
 *   - middleware.ts + actions/auth.ts redirect through roleHome (JWT claim
 *     `user_role` via shared parseJwtPayload — never raw atob, 2026-06-26).
 *   - The dashboard route is retired in Phase 57 (a next.config redirect now);
 *     pending UI lives at /pending.
 *   - Phase 57: the header is gone, so its nav repoint test went with it.
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-01 — one home per role', () => {
  test('roleHome sends every role to / and an unknown role to /pending (Phase 57 D-10)', () => {
    const src = read(ROLE_HOME)
    // one decision function, all four roles share the one screen
    for (const role of ['worker', 'supervisor', 'safety_manager', 'admin']) {
      expect(src).toContain(`case '${role}'`)
    }
    expect(src).toContain("return '/'")
    expect(src).not.toContain("'/sops'")
    expect(src).not.toContain("'/activity'")
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

  test('auth actions redirect through roleHome', () => {
    expect(read(AUTH_ACTIONS)).toContain('roleHome')
  })

  test('/pending page + app-level not-found.tsx exist; no journey maps the retired dashboard', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', '(protected)', 'pending', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(ROOT, 'src', 'app', 'not-found.tsx'))).toBe(true)
    // Phase 57 D-10: the redirect shim is gone; its negative assertions live in
    // tests/phase57/retirement-sweep.spec.ts.
  })
})
