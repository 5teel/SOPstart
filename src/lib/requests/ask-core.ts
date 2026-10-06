import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { memberLabel, userLabels } from '@/lib/members/labels'
import { membersWithRole } from '@/lib/notifications/write'
import { lineageRoot } from '@/lib/sop/lineage-current'
import type { AppRole } from '@/types/auth'

/**
 * Phase 60 (D-02, A-03, A-05) -- the ask-to-do-a-SOP core. Plain module, no
 * directive: no client can call it.
 *
 * Why service role: sop_assignments writes are admin-only under RLS, and a
 * supervisor's ask must work. The calling action has passed its role guard and
 * supplies the SESSION organisation; every query here carries it (CLAUDE.md
 * 2026-06-15 and 2026-07-28: never an organisation read off a fetched row).
 * Nothing here writes the decision ledger; the action that calls it does, once.
 */

export interface AskCtx {
  organisationId: string
  userId: string
}

export type AskTarget = { role: AppRole } | { userId: string }

export interface AskDone {
  requestId: string
  recipients: string[]
  sopTitle: string
}

export interface ClaimedAsk {
  id: string
  subject_id: string | null
  raised_by_user: string | null
  target_role: AppRole | null
  target_user_id: string | null
  note: string | null
  created_at: string
}

/** Every version of the SOP's lineage, inside the organisation (a lineage is flat, F-20). */
async function lineageSopIds(organisationId: string, sopId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: own } = await admin
    .from('sops')
    .select('id, parent_sop_id')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!own) return []
  const root = lineageRoot(own)
  const { data } = await admin
    .from('sops')
    .select('id')
    .eq('organisation_id', organisationId)
    .or(`id.eq.${root},parent_sop_id.eq.${root}`)
  return (data ?? []).map((r) => r.id)
}

/**
 * The assignment row FIRST, the request SECOND. PostgREST has no multi-statement
 * transaction, so a failed request insert undoes the assignment change: a row it
 * inserted is deleted, a row it re-attributed gets its previous owner back.
 */
export async function askToDoSopCore(
  ctx: AskCtx,
  input: { sopId: string; target: AskTarget; note: string | null },
): Promise<AskDone | { error: string }> {
  const { organisationId, userId } = ctx
  const { sopId, target } = input
  const admin = createAdminClient()

  const { data: sop } = await admin
    .from('sops')
    .select('id, title')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .eq('status', 'published')
    .maybeSingle()
  if (!sop) return { error: 'We could not find that SOP.' }

  if ('userId' in target) {
    const { data: member } = await admin
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', organisationId)
      .eq('user_id', target.userId)
      .maybeSingle()
    if (!member) return { error: 'We could not find that person.' }
  }

  const type = 'role' in target ? 'role' : 'individual'
  let undo: () => Promise<void>

  const ins = await admin
    .from('sop_assignments')
    .insert({
      organisation_id: organisationId,
      sop_id: sopId,
      assignment_type: type,
      ...('role' in target ? { role: target.role } : { user_id: target.userId }),
      assigned_by: userId,
    })
    .select('id')
    .single()

  if (!ins.error && ins.data) {
    const insertedId = ins.data.id
    undo = async () => {
      const { error } = await admin.from('sop_assignments').delete().eq('id', insertedId).eq('organisation_id', organisationId)
      if (error) console.error('[askToDoSopCore] undo delete failed', error)
    }
  } else if (ins.error?.code === '23505') {
    // Already assigned: the ask takes the row over (F-21).
    const existing = admin
      .from('sop_assignments')
      .select('id, assigned_by')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
      .eq('assignment_type', type)
    const { data: row } = await ('role' in target ? existing.eq('role', target.role) : existing.eq('user_id', target.userId)).maybeSingle()
    if (!row) return { error: 'Could not ask. Try again.' }
    const upd = await admin
      .from('sop_assignments')
      .update({ assigned_by: userId })
      .eq('id', row.id)
      .eq('organisation_id', organisationId)
      .select('id')
    if (upd.error || !upd.data?.length) {
      console.error('[askToDoSopCore] re-attribute failed', upd.error)
      return { error: 'Could not ask. Try again.' }
    }
    const previous = row.assigned_by
    undo = async () => {
      const { error } = await admin
        .from('sop_assignments')
        .update({ assigned_by: previous })
        .eq('id', row.id)
        .eq('organisation_id', organisationId)
      if (error) console.error('[askToDoSopCore] undo restore failed', error)
    }
  } else {
    console.error('[askToDoSopCore] assignment insert failed', ins.error)
    return { error: 'Could not ask. Try again.' }
  }

  const req = await admin
    .from('requests')
    .insert({
      organisation_id: organisationId,
      kind: 'do_sop',
      state: 'accepted',
      raised_by_user: userId,
      subject_type: 'sop',
      subject_id: sopId,
      ...('role' in target ? { target_role: target.role } : { target_user_id: target.userId }),
      note: input.note?.trim() ? input.note.trim() : null,
      answered_by: userId,
      decided_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (req.error || !req.data) {
    console.error('[askToDoSopCore] request insert failed', req.error)
    await undo()
    return { error: 'Could not ask. Try again.' }
  }

  const recipients = 'role' in target ? await membersWithRole(organisationId, target.role) : [target.userId]
  return { requestId: req.data.id, recipients: recipients.filter((id) => id !== userId), sopTitle: sop.title ?? 'a SOP' }
}

/** Remove the assignment rows an ask made, across the lineage, only those still held by the asker. */
async function dropAskedAssignments(organisationId: string, row: ClaimedAsk): Promise<boolean> {
  if (!row.subject_id || !row.raised_by_user) return true
  const ids = await lineageSopIds(organisationId, row.subject_id)
  if (ids.length === 0) return true
  const del = createAdminClient()
    .from('sop_assignments')
    .delete()
    .eq('organisation_id', organisationId)
    .in('sop_id', ids)
    .eq('assigned_by', row.raised_by_user)
  const { error } = await (row.target_user_id
    ? del.eq('assignment_type', 'individual').eq('user_id', row.target_user_id)
    : del.eq('assignment_type', 'role').eq('role', row.target_role as AppRole))
  if (error) console.error('[ask-core] assignment delete failed', error)
  return !error
}

const CLAIM_COLUMNS = 'id, subject_id, raised_by_user, target_role, target_user_id, note, created_at'

/**
 * Put a claimed ask back as it was: accepted on the asker's authority at the
 * time it was raised (A-05), not by whoever just tried to close it.
 */
async function restoreAccepted(organisationId: string, claimed: ClaimedAsk): Promise<void> {
  await createAdminClient()
    .from('requests')
    .update({ state: 'accepted', answered_by: claimed.raised_by_user, answer_note: null, decided_at: claimed.created_at })
    .eq('id', claimed.id)
    .eq('organisation_id', organisationId)
}

/**
 * A person declines an ask that names them. The claim only matches an accepted
 * do_sop row whose target person is the caller, so a role ask can never be
 * declined by one person (A-03). Null when nothing matched.
 */
export async function declineAskCore(ctx: AskCtx, input: { requestId: string; note: string }): Promise<ClaimedAsk | null> {
  const { organisationId, userId } = ctx
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('requests')
    .update({ state: 'declined', answered_by: userId, answer_note: input.note, decided_at: new Date().toISOString() })
    .eq('id', input.requestId)
    .eq('organisation_id', organisationId)
    .eq('kind', 'do_sop')
    .eq('state', 'accepted')
    .eq('target_user_id', userId)
    .select(CLAIM_COLUMNS)
  if (error) {
    console.error('[declineAskCore] claim error', error)
    return null
  }
  const claimed = (data?.[0] as ClaimedAsk | undefined) ?? null
  if (!claimed) return null
  if (!(await dropAskedAssignments(organisationId, claimed))) {
    // The SOP is still due, so the ask stays in force.
    await restoreAccepted(organisationId, claimed)
    return null
  }
  return claimed
}

/** The asker stops their own ask; an admin or safety manager (`canStopAny`) any ask. Null when nothing matched. */
export async function stopAskingCore(
  ctx: AskCtx,
  input: { requestId: string; note: string; canStopAny: boolean },
): Promise<ClaimedAsk | null> {
  const { organisationId, userId } = ctx
  const admin = createAdminClient()
  const claim = admin
    .from('requests')
    .update({ state: 'withdrawn', answered_by: userId, answer_note: input.note, decided_at: new Date().toISOString() })
    .eq('id', input.requestId)
    .eq('organisation_id', organisationId)
    .eq('kind', 'do_sop')
    .eq('state', 'accepted')
  const { data, error } = await (input.canStopAny ? claim : claim.eq('raised_by_user', userId)).select(CLAIM_COLUMNS)
  if (error) {
    console.error('[stopAskingCore] claim error', error)
    return null
  }
  const claimed = (data?.[0] as ClaimedAsk | undefined) ?? null
  if (!claimed) return null
  if (!(await dropAskedAssignments(organisationId, claimed))) {
    await restoreAccepted(organisationId, claimed)
    return null
  }
  return claimed
}

export interface AskTargets {
  roles: Array<{ role: AppRole; count: number }>
  people: Array<{ id: string; label: string; role: AppRole; hasIt: boolean }>
}

/** Roles with head counts and people of the organisation; `hasIt` = already assigned to them on this SOP's lineage. */
export async function listAskTargetsCore(organisationId: string, sopId: string | null): Promise<AskTargets | null> {
  const admin = createAdminClient()
  const { data: members, error } = await admin
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', organisationId)
  if (error) {
    console.error('[listAskTargetsCore] members read error', error)
    return null
  }
  const had = new Set<string>()
  if (sopId) {
    const ids = await lineageSopIds(organisationId, sopId)
    if (ids.length > 0) {
      const { data } = await admin
        .from('sop_assignments')
        .select('user_id')
        .eq('organisation_id', organisationId)
        .eq('assignment_type', 'individual')
        .in('sop_id', ids)
      for (const r of data ?? []) if (r.user_id) had.add(r.user_id)
    }
  }
  const labels = await userLabels((members ?? []).map((m) => m.user_id))
  const counts = new Map<AppRole, number>()
  for (const m of members ?? []) counts.set(m.role as AppRole, (counts.get(m.role as AppRole) ?? 0) + 1)
  return {
    roles: [...counts].map(([role, count]) => ({ role, count })),
    people: (members ?? []).map((m) => ({
      id: m.user_id,
      label: memberLabel(labels.get(m.user_id)),
      role: m.role as AppRole,
      hasIt: had.has(m.user_id),
    })),
  }
}
