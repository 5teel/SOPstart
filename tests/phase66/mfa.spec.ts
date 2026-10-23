/**
 * Phase 66 / ADR-0028 -- the second step for elevated roles and our recovery codes.
 * Pure checks (classifier, codes) plus source contracts on the actions, pages and migration 00086.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { isElevatedRole, needsSecondStep, verifyHref } from '../../src/lib/auth/elevated'
import { CODE_ALPHABET, CODE_FORMAT, hashCode, newCodes, normaliseCode } from '../../src/lib/auth/recovery-codes'
import { safeNextPath } from '../../src/lib/auth/next-redirect'
import { DECISION_KINDS } from '../../src/lib/decisions/shape'
import { KIND_GROUPS, KIND_WORDS } from '../../src/lib/decisions/read'
import { NOTIFICATION_KINDS, notificationTitle } from '../../src/lib/notifications/kinds'
import { isSafePlace, notificationPlace } from '../../src/lib/notifications/places'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const MFA_KINDS = ['mfa_enrolled', 'mfa_removed', 'mfa_reset', 'recovery_codes_issued', 'recovery_code_used'] as const

test.describe('the classifier', () => {
  test('only admin and safety_manager are elevated; they need aal2', () => {
    for (const r of ['admin', 'safety_manager']) {
      expect(isElevatedRole(r)).toBe(true)
      expect(needsSecondStep(r, 'aal1')).toBe(true)
      expect(needsSecondStep(r, undefined)).toBe(true)
      expect(needsSecondStep(r, 'aal2')).toBe(false)
    }
    for (const r of ['worker', 'supervisor', null, undefined, 'pending']) {
      expect(isElevatedRole(r)).toBe(false)
      expect(needsSecondStep(r, 'aal1')).toBe(false)
    }
  })

  test('verifyHref carries next, and /verify is never a next', () => {
    expect(verifyHref('/admin/settings?x=1')).toBe('/verify?next=%2Fadmin%2Fsettings%3Fx%3D1')
    expect(verifyHref(null)).toBe('/verify')
    expect(safeNextPath('/verify')).toBeNull()
    expect(safeNextPath('/verify?next=/')).toBeNull()
    expect(safeNextPath('/admin/settings')).toBe('/admin/settings')
  })
})

test.describe('recovery codes', () => {
  test('ten unique codes in xxxx-xxxx with no look-alike letters', () => {
    const codes = newCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(CODE_FORMAT)
    for (const bad of ['0', 'o', '1', 'i', 'l']) expect(CODE_ALPHABET).not.toContain(bad)
  })

  test('typing is forgiving about case, spaces and dashes; anything else is refused', () => {
    expect(normaliseCode('ABCD-EFGH')).toBe('abcd-efgh')
    expect(normaliseCode(' abcd efgh ')).toBe('abcd-efgh')
    expect(normaliseCode('abcdefgh')).toBe('abcd-efgh')
    for (const bad of ['abcd-efg', 'abcd-efghj', 'abc0-efgh', 'abcl-efgh', '', 'abcd_efgh']) expect(normaliseCode(bad), bad).toBeNull()
  })

  test('the stored hash is an HMAC with the pepper: stable, pepper-bound, never the code', () => {
    const p = 'x'.repeat(44)
    const h = hashCode('abcd-efgh', p)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashCode('abcd-efgh', p)).toBe(h)
    expect(hashCode('abcd-efgh', 'y'.repeat(44))).not.toBe(h)
    expect(hashCode('abcd-efgj', p)).not.toBe(h)
    expect(h).not.toContain('abcd')
  })

  test('redeemRecoveryCode: capped first, single use by a conditional update, then factors removed and logged', () => {
    const s = read('src/actions/mfa.ts')
    const fn = s.slice(s.indexOf('export async function redeemRecoveryCode'), s.indexOf('export async function resetMemberFactors'))
    const at = (t: string) => fn.indexOf(t)
    expect(at("rpc('mfa_recovery_attempt'")).toBeGreaterThan(-1)
    expect(at("rpc('mfa_recovery_attempt'")).toBeLessThan(at('hashCode('))
    expect(fn).toMatch(/\.update\(\{ used_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*?\.is\('used_at', null\)[\s\S]*?\.select\('id'\)/)
    expect(at('if (!used?.length)')).toBeLessThan(at('deleteFactor'))
    expect(at('deleteFactor')).toBeLessThan(at("kind: 'recovery_code_used'"))
  })

  test('issueRecoveryCodes needs aal2 and replaces the old set; the pepper comes from RECOVERY_PEPPER', () => {
    const s = read('src/actions/mfa.ts')
    const fn = s.slice(s.indexOf('export async function issueRecoveryCodes'), s.indexOf('export async function recoveryCodesLeft'))
    expect(fn).toMatch(/if \(aal !== 'aal2'\)/)
    expect(fn.indexOf(".delete().eq('user_id', userId)")).toBeLessThan(fn.indexOf('.insert('))
    expect(s).toMatch(/process\.env\.RECOVERY_PEPPER/)
  })

  test('resetMemberFactors: admin at aal2, never yourself, same organisation, logged and admins told', () => {
    const s = read('src/actions/mfa.ts')
    const fn = s.slice(s.indexOf('export async function resetMemberFactors'))
    expect(fn).toMatch(/requireAdminContext\(\)/)
    expect(fn).toMatch(/ctx\.role !== 'admin'/)
    expect(fn).toMatch(/memberUserId === ctx\.user\.id/)
    expect(fn).toMatch(/\.eq\('organisation_id', ctx\.organisationId\)\s*\n\s*\.eq\('user_id', memberUserId\)/)
    expect(fn).toMatch(/kind: 'mfa_reset'/)
    expect(fn).toMatch(/kind: 'signin_reset' as const/)
  })

  test('recordFactorChange keeps the last factor of an elevated person (D-06)', () => {
    const s = read('src/actions/mfa.ts')
    expect(s).toMatch(/isElevatedRole\(memberRole\) && factors\.length <= 1/)
  })
})

test.describe('migration 00086', () => {
  const sql = read('supabase/migrations/00086_mfa_recovery_codes.sql')

  test('is_elevated() is role AND aal2', () => {
    expect(sql).toMatch(/create or replace function public\.is_elevated\(\)/)
    expect(sql).toMatch(/current_user_role\(\) in \('admin'::public\.app_role, 'safety_manager'::public\.app_role\)/)
    expect(sql).toMatch(/auth\.jwt\(\) ->> 'aal', ''\) = 'aal2'/)
  })

  test('recovery tables are service-role only: RLS on, no policies, grants revoked', () => {
    for (const t of ['mfa_recovery_codes', 'mfa_recovery_attempts']) {
      expect(sql).toContain(`alter table public.${t} enable row level security;`)
      expect(sql).toContain(`revoke all on public.${t} from anon, authenticated;`)
    }
    expect(sql).not.toMatch(/create policy/i)
  })

  test('the attempt counter: 5 per 15 minutes, counted on the try, service_role only', () => {
    expect(sql).toMatch(/interval '15 minutes'/)
    expect(sql).toMatch(/returning attempts <= 5/)
    expect(sql).toMatch(/revoke all on function public\.mfa_recovery_attempt\(uuid\) from public, anon, authenticated;/)
    expect(sql).toMatch(/grant execute on function public\.mfa_recovery_attempt\(uuid\) to service_role;/)
  })

  test('the five ledger kinds and the signin_reset notification', () => {
    for (const k of MFA_KINDS) {
      expect(sql).toContain(`'${k}'`)
      expect(DECISION_KINDS).toContain(k)
      expect(KIND_WORDS[k]).toBeTruthy()
      expect(KIND_GROUPS.setup).toContain(k)
    }
    expect(sql).toContain("'signin_reset'")
    expect(NOTIFICATION_KINDS).toContain('signin_reset')
    expect(isSafePlace(notificationPlace('signin_reset'))).toBe(true)
    expect(notificationTitle({ kind: 'signin_reset', name: 'Joe Bloggs' })).toBe("Joe's second sign-in step was reset. They set it up again next time they sign in.")
  })
})

test.describe('the second step in pages', () => {
  test('/verify decides on the server and redirects an aal2 session to a validated next', () => {
    const s = read('src/app/verify/page.tsx')
    expect(s).toMatch(/safeNextPath\(/)
    expect(s).toMatch(/if \(aal === 'aal2'\) redirect\(next\)/)
    expect(read('src/components/auth/VerifyForm.tsx')).not.toMatch(/useRouter|router\.(push|replace)/)
  })

  test('sign-in sends an elevated person to /verify; the editor does too', () => {
    expect(read('src/actions/auth.ts')).toMatch(/needsSecondStep\(claims\['user_role'\] as string \| undefined, claims\['aal'\]\) \? verifyHref\(dest\) : dest/)
    expect(read('src/lib/supabase/middleware.ts')).toMatch(/secondStep \? verifyHref\(next\) : next/)
    expect(read('src/app/(protected)/sops/[sopId]/page.tsx')).toMatch(/if \(needsSecondStep && rawMode === 'edit'\)/)
  })
})
