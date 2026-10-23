/**
 * Phase 67 / ADR-0029 -- in-person sign-in codes.
 * The code module and the D-01 rule tested directly, plus source contracts on the actions, the proxy
 * hold and migration 00088. The live behaviour of signin_code_try is asserted by
 * scripts/apply-phase67-migration.mjs and tests/evals/signin-code.eval.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  SIGNIN_CODE_MAX_ATTEMPTS,
  SIGNIN_CODE_MINUTES,
  SIGNIN_CODE_REFUSAL,
  hashSigninCode,
  newSigninCode,
  normaliseSigninCode,
  signinCodeExpiry,
} from '../../src/lib/members/signin-code'
import { hashCode } from '../../src/lib/auth/recovery-codes'
import { mayIssueSigninCode, resetsSecondSteps } from '../../src/lib/members/authority'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const PEPPER = 'p'.repeat(40)

test.describe('the code', () => {
  test('8 letters without look-alikes, shown in capitals as XXXX-XXXX, all different', () => {
    const codes = Array.from({ length: 200 }, newSigninCode)
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
    expect(new Set(codes).size).toBe(200)
  })

  test('what a person types normalises to one form; junk is null', () => {
    const c = newSigninCode()
    const n = normaliseSigninCode(c)!
    expect(normaliseSigninCode(c.toLowerCase())).toBe(n)
    expect(normaliseSigninCode(` ${c.replace('-', ' ')} `)).toBe(n)
    expect(normaliseSigninCode('ABCD-EFG')).toBeNull()
    expect(normaliseSigninCode('ABCD-EFG0')).toBeNull() // 0 is a look-alike, never issued
  })

  test('the hash is an HMAC with the pepper, separated from recovery codes', () => {
    const n = normaliseSigninCode('ABCD-EFGH')!
    expect(hashSigninCode(n, PEPPER)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSigninCode(n, PEPPER)).toBe(hashSigninCode(n, PEPPER))
    expect(hashSigninCode(n, PEPPER)).not.toBe(hashSigninCode(n, 'q'.repeat(40)))
    expect(hashSigninCode(n, PEPPER)).not.toBe(hashCode(n, PEPPER))
  })

  test('30 minutes, 5 tries, one refusal sentence', () => {
    const now = new Date('2026-10-24T10:12:00Z')
    expect(signinCodeExpiry(now).toISOString()).toBe('2026-10-24T10:42:00.000Z')
    expect(SIGNIN_CODE_MINUTES).toBe(30)
    expect(SIGNIN_CODE_MAX_ATTEMPTS).toBe(5)
    expect(SIGNIN_CODE_REFUSAL).toBe("That code didn't work. Ask your supervisor for a new one.")
  })
})

test.describe('D-01 who may give a code', () => {
  const base = { callerId: 'me', subjectId: 'them', subjectStatus: 'active', supervises: false } as const
  test('a supervisor: only active workers they supervise', () => {
    expect(mayIssueSigninCode({ ...base, callerRole: 'supervisor', subjectRole: 'worker', supervises: true })).toBe(true)
    expect(mayIssueSigninCode({ ...base, callerRole: 'supervisor', subjectRole: 'worker' })).toBe(false)
    expect(mayIssueSigninCode({ ...base, callerRole: 'supervisor', subjectRole: 'supervisor', supervises: true })).toBe(false)
  })
  test('a safety manager: workers and supervisors, never an elevated person', () => {
    expect(mayIssueSigninCode({ ...base, callerRole: 'safety_manager', subjectRole: 'worker' })).toBe(true)
    expect(mayIssueSigninCode({ ...base, callerRole: 'safety_manager', subjectRole: 'supervisor' })).toBe(true)
    expect(mayIssueSigninCode({ ...base, callerRole: 'safety_manager', subjectRole: 'safety_manager' })).toBe(false)
    expect(mayIssueSigninCode({ ...base, callerRole: 'safety_manager', subjectRole: 'admin' })).toBe(false)
  })
  test('an admin: anyone active; an elevated subject has their second steps reset', () => {
    for (const r of ['worker', 'supervisor', 'safety_manager', 'admin'] as const) {
      expect(mayIssueSigninCode({ ...base, callerRole: 'admin', subjectRole: r })).toBe(true)
    }
    expect(resetsSecondSteps('admin')).toBe(true)
    expect(resetsSecondSteps('safety_manager')).toBe(true)
    expect(resetsSecondSteps('worker')).toBe(false)
  })
  test('never yourself, never suspended or departed, never a worker or an unconfirmed elevated caller', () => {
    expect(mayIssueSigninCode({ ...base, callerRole: 'admin', subjectRole: 'worker', subjectId: 'me' })).toBe(false)
    expect(mayIssueSigninCode({ ...base, callerRole: 'admin', subjectRole: 'worker', subjectStatus: 'suspended' })).toBe(false)
    expect(mayIssueSigninCode({ ...base, callerRole: 'admin', subjectRole: 'worker', subjectStatus: 'left' })).toBe(false)
    // getSessionContext reports an elevated person without aal2 as 'worker' (ADR-0028).
    expect(mayIssueSigninCode({ ...base, callerRole: 'worker', subjectRole: 'worker' })).toBe(false)
    expect(mayIssueSigninCode({ ...base, callerRole: null, subjectRole: 'worker' })).toBe(false)
  })
})

test.describe('the actions', () => {
  const members = read('src/actions/members.ts')
  const issue = members.slice(members.indexOf('export async function issueSigninCode'), members.indexOf('export async function listSigninCodeWorkers'))
  const auth = read('src/actions/auth.ts')
  const use = auth.slice(auth.indexOf('export async function signInWithCode'), auth.indexOf('export async function setNewPassword'))
  const setPw = auth.slice(auth.indexOf('export async function setNewPassword'), auth.indexOf('export async function joinWithInviteCode'))

  test('issueSigninCode: session org, active subject, the one rule, factor reset for elevated, hash only, logged', () => {
    expect(issue).toMatch(/await getSessionContext\(\)/)
    expect(issue).toMatch(/\.eq\('organisation_id', organisationId\)[\s\S]*\.eq\('status', 'active'\)/)
    expect(issue).toMatch(/mayIssueSigninCode\(/)
    expect(issue).toMatch(/if \(resetsSecondSteps\(target\.role as AppRole\)\) \{\s*const reset = await resetMemberFactors\(subjectUserId\)/)
    expect(issue).toMatch(/code_hash: hashSigninCode\(/)
    expect(issue.indexOf('.update({ expires_at:')).toBeGreaterThan(-1)
    expect(issue.indexOf('.update({ expires_at:')).toBeLessThan(issue.indexOf('.insert({'))
    expect(issue.lastIndexOf('await recordDecision(')).toBeGreaterThan(issue.indexOf('.insert({'))
  })

  test('signInWithCode: one refusal, the database check, revoke, flag, mint, log, server redirect', () => {
    expect(use).toMatch(/signinCodeSchema\.safeParse\(input\)/)
    const returns = [...use.matchAll(/return \{ error: ([^}]+) \}/g)].map((m) => m[1].trim())
    expect(returns.length).toBeGreaterThan(3)
    for (const r of returns) expect(r).toBe('SIGNIN_CODE_REFUSAL')
    const order = [
      "rpc('signin_code_try'",
      "rpc('revoke_user_sessions'",
      'must_set_password: true',
      "generateLink({ type: 'magiclink'",
      'verifyOtp(',
      'await recordDecision(',
      "redirect('/profile?set-password=1')",
    ]
    const at = order.map((t) => use.indexOf(t))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  test('setNewPassword: confirm, set, clear the flag, refresh, server redirect (to /verify when elevated)', () => {
    expect(auth).toMatch(/d\.password === d\.confirm/)
    const order = ['auth.updateUser({ password', 'must_set_password: null', 'refreshSession()', 'redirect(']
    const at = order.map((t) => setPw.indexOf(t))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(setPw).toMatch(/needsSecondStep\(/)
  })

  test('the forms never navigate on the client', () => {
    for (const f of ['src/components/auth/SigninCodeForm.tsx', 'src/components/profile/SetPasswordSection.tsx', 'src/components/office/SigninCode.tsx']) {
      expect(read(f), f).not.toMatch(/useRouter|router\.(push|replace)|location\.(assign|href)/)
    }
  })
})

test.describe('the hold on Profile', () => {
  test('the proxy sends every page but Profile and API routes to /profile?set-password=1', () => {
    const m = read('src/lib/supabase/middleware.ts')
    expect(m).toMatch(/app_metadata\?\.\['must_set_password'\] === true/)
    expect(m).toMatch(/if \(mustSetPassword && path !== '\/profile' && !path\.startsWith\('\/api\/'\)/)
    expect(m).toMatch(/new URL\('\/profile\?set-password=1', request\.url\)/)
    // the hold comes before the /admin and signed-in /login redirects
    expect(m.indexOf('if (mustSetPassword')).toBeLessThan(m.indexOf('if (secondStep && path.startsWith'))
  })
  test('Profile shows Set a new password from the session flag', () => {
    expect(read('src/lib/auth/session-context.ts')).toMatch(/mustSetPassword: \(claims as/)
    expect(read('src/app/(protected)/profile/page.tsx')).toMatch(/\{mustSetPassword && <SetPasswordSection \/>\}/)
  })
})

test.describe('migration 00088', () => {
  const sql = read('supabase/migrations/00088_signin_codes.sql')
  test('signin_codes is service-role only: RLS on, no policies, grants revoked', () => {
    expect(sql).toContain('alter table public.signin_codes enable row level security;')
    expect(sql).toContain('revoke all on public.signin_codes from anon, authenticated;')
    expect(sql).not.toMatch(/create policy/i)
  })
  test('signin_code_try locks the row, caps at 5, reads expiry, requires an active member; service_role only', () => {
    expect(sql).toMatch(/for update of sc/)
    expect(sql).toMatch(/sc\.attempts < 5 and sc\.expires_at > now\(\)/)
    expect(sql).toMatch(/m\.status = 'active'/)
    expect(sql).toMatch(/set attempts = attempts \+ 1/)
    expect(sql).toMatch(/revoke all on function public\.signin_code_try\(text, text\) from public, anon, authenticated;/)
    expect(sql).toMatch(/grant execute on function public\.signin_code_try\(text, text\) to service_role;/)
  })
  test('the two ledger kinds', () => {
    expect(sql).toContain("'signin_code_issued', 'signin_code_used'")
  })
})
