'use server'

import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { requireAdminContext } from '@/lib/auth/guards'
import { isElevatedRole } from '@/lib/auth/elevated'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordDecision } from '@/lib/decisions/record'
import { notify } from '@/lib/notifications/write'
import { notificationPlace } from '@/lib/notifications/places'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { hashCode, newCodes, normaliseCode } from '@/lib/auth/recovery-codes'
import { memberLabel, userLabels } from '@/lib/members/labels'

// Phase 66 / ADR-0028. The TOTP ceremony (enrol, challenge, verify) runs in the browser through
// supabase-js; the server never takes its word: every factor claim is checked against Supabase's
// own list, read with the admin API (the Phase 65 pattern). Recovery codes are ours: hashed with
// RECOVERY_PEPPER, used once, tried at most 5 times in 15 minutes. Org and actor of every ledger
// row come from the session inside recordDecision.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any

async function verifiedFactors(userId: string) {
  const { data, error } = await createAdminClient().auth.admin.mfa.listFactors({ userId })
  if (error) return null
  return data.factors.filter((f) => f.status === 'verified')
}

function pepper(): string | null {
  const p = process.env.RECOVERY_PEPPER
  return p && p.length >= 32 ? p : null
}

/**
 * kind 'enrolled': called after the browser verified a new TOTP factor; it must now be listed as
 * verified. kind 'removed': the removal runs here through the admin API, only for one of the
 * caller's own factors, and never the last one while the caller holds an elevated role (D-06).
 */
export async function recordFactorChange(input: { kind: 'enrolled' | 'removed'; factorId: string }): Promise<{ error?: string }> {
  const parsed = z.object({ kind: z.enum(['enrolled', 'removed']), factorId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { error: 'Unknown sign-in step.' }
  const { kind, factorId } = parsed.data
  const { userId, aal, memberRole } = await getSessionContext()
  if (!userId) return { error: 'Sign in again.' }
  if (aal !== 'aal2') return { error: "Confirm it's you first." }

  const factors = await verifiedFactors(userId)
  if (!factors) return { error: "Couldn't check your sign-in steps. Try again." }
  const found = factors.find((f) => f.id === factorId)
  if (!found) return { error: 'That sign-in step is not on your account.' }

  if (kind === 'removed') {
    if (isElevatedRole(memberRole) && factors.length <= 1) {
      return { error: 'Admins and safety managers keep at least one second step.' }
    }
    const { error } = await createAdminClient().auth.admin.mfa.deleteFactor({ userId, id: factorId })
    if (error) return { error: "That sign-in step wasn't removed. Try again." }
  }

  await recordDecision({
    kind: kind === 'enrolled' ? 'mfa_enrolled' : 'mfa_removed',
    subject: { kind: 'mfa_factor', id: factorId },
    summary: kind === 'enrolled' ? 'Set up an authenticator app' : 'Removed an authenticator app',
    details: { factor_type: found.factor_type, name: found.friendly_name ?? null },
  })
  return {}
}

/** Ten fresh codes for the session user (aal2), replacing any earlier set. Shown once. */
export async function issueRecoveryCodes(): Promise<{ codes: string[] } | { error: string }> {
  const { userId, aal } = await getSessionContext()
  if (!userId) return { error: 'Sign in again.' }
  if (aal !== 'aal2') return { error: "Confirm it's you first." }
  const p = pepper()
  if (!p) return { error: "Recovery codes aren't available right now." }
  const codes = newCodes()
  const del = await db().from('mfa_recovery_codes').delete().eq('user_id', userId)
  if (del.error) return { error: "Couldn't make new codes. Try again." }
  const ins = await db().from('mfa_recovery_codes').insert(codes.map((c) => ({ user_id: userId, code_hash: hashCode(c, p) })))
  if (ins.error) return { error: "Couldn't make new codes. Try again." }
  await recordDecision({
    kind: 'recovery_codes_issued',
    subject: { kind: 'person', id: userId },
    summary: 'Made new recovery codes',
    details: { count: codes.length },
  })
  return { codes }
}

/** How many unused codes the session user has (Profile shows the count, never the codes). */
export async function recoveryCodesLeft(): Promise<number | null> {
  const { userId } = await getSessionContext()
  if (!userId) return null
  const { count, error } = await db()
    .from('mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null)
  return error ? null : (count ?? 0)
}

/**
 * On /verify, signed in but before the second step: a good code is marked used, the person's
 * second steps are removed (admin API) and the use is logged. The page then asks them to set up
 * a new one, which issues fresh codes and so retires the rest of this set.
 */
export async function redeemRecoveryCode(input: string): Promise<{ ok: true } | { error: string }> {
  const { userId } = await getSessionContext()
  if (!userId) return { error: 'Sign in again.' }
  const p = pepper()
  if (!p) return { error: "Recovery codes aren't available right now." }
  const { data: allowed, error: capError } = await db().rpc('mfa_recovery_attempt', { p_user: userId })
  if (capError) return { error: "Couldn't check that code. Try again." }
  if (allowed !== true) return { error: 'Too many tries. Wait 15 minutes, then try again.' }

  const code = typeof input === 'string' ? normaliseCode(input) : null
  if (!code) return { error: "That code didn't work." }
  const { data: used, error } = await db()
    .from('mfa_recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('code_hash', hashCode(code, p))
    .is('used_at', null)
    .select('id')
  if (error) return { error: "Couldn't check that code. Try again." }
  if (!used?.length) return { error: "That code didn't work." }

  const factors = (await verifiedFactors(userId)) ?? []
  for (const f of factors) await createAdminClient().auth.admin.mfa.deleteFactor({ userId, id: f.id })
  await recordDecision({
    kind: 'recovery_code_used',
    subject: { kind: 'person', id: userId },
    summary: 'Used a recovery code',
    details: { factors_removed: factors.length },
  })
  return { ok: true }
}

/**
 * D-06: an admin (aal2) clears another member's second steps and recovery codes. Never your
 * own, only someone in your organisation; logged, and every other active admin is told.
 */
export async function resetMemberFactors(memberUserId: string): Promise<{ ok: true; logged: boolean } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.role !== 'admin') return { error: 'Only an admin can reset sign-in steps.' }
  if (!ctx.organisationId) return { error: 'No organisation' }
  if (!z.string().uuid().safeParse(memberUserId).success) return { error: 'Person not found' }
  if (memberUserId === ctx.user.id) return { error: 'You can change your own sign-in steps on Profile.' }

  const { data: target } = await db()
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', ctx.organisationId)
    .eq('user_id', memberUserId)
    .maybeSingle()
  if (!target) return { error: 'Person not found' }

  const { data: listed, error } = await createAdminClient().auth.admin.mfa.listFactors({ userId: memberUserId })
  if (error) return { error: "Couldn't reset. Try again." }
  for (const f of listed.factors) {
    const del = await createAdminClient().auth.admin.mfa.deleteFactor({ userId: memberUserId, id: f.id })
    if (del.error) return { error: "Couldn't reset. Try again." }
  }
  await db().from('mfa_recovery_codes').delete().eq('user_id', memberUserId)

  const logged = await recordDecision({
    kind: 'mfa_reset',
    subject: { kind: 'person', id: memberUserId },
    summary: 'Reset a person’s sign-in steps',
    details: { factors_removed: listed.factors.length },
  })

  const { data: admins } = await db()
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', ctx.organisationId)
    .eq('role', 'admin')
    .eq('status', 'active')
  const name = memberLabel((await userLabels([memberUserId])).get(memberUserId))
  const decisionId = logged.ok ? logged.id : `${Date.now()}`
  await notify(
    ctx.organisationId,
    ((admins ?? []) as { user_id: string }[])
      .filter((a) => a.user_id !== ctx.user.id)
      .map((a) => ({
        userId: a.user_id,
        kind: 'signin_reset' as const,
        title: notificationTitle({ kind: 'signin_reset', name }),
        place: notificationPlace('signin_reset'),
        subjectType: 'person',
        subjectId: memberUserId,
        dedupeKey: dedupeKey({ kind: 'signin_reset', userId: memberUserId, decisionId }),
        decisionId: logged.ok ? logged.id : null,
      })),
  )
  return { ok: true, logged: logged.ok }
}
