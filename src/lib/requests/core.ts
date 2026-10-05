import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'
import { RAISABLE_KINDS, type RequestKind, type RequestSubjectType } from '@/lib/requests/model'

/**
 * Phase 60 -- the request core. Plain module, no directive: no client can call it.
 *
 * Why service role: requests has no authenticated INSERT or UPDATE policy by
 * design (00074). The calling action has passed its role guard and supplies the
 * SESSION organisation; every query here carries it (CLAUDE.md 2026-06-15 and
 * 2026-07-28: never an organisation read off a fetched row). Nothing here
 * writes the decision ledger; the action that calls it does, once.
 */

// ponytail: the new tables are typed; site_machines is not, so it goes through a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = () => createAdminClient() as any

export interface SubjectRef {
  type: RequestSubjectType
  id: string | null
}

/** A SOP must be a published row of the organisation, a machine a machine of it; the site needs no id. */
export async function subjectInOrg(organisationId: string, subject: SubjectRef): Promise<boolean> {
  if (subject.type === 'site') return subject.id === null
  if (!subject.id) return false
  if (subject.type === 'sop') {
    const { data } = await createAdminClient()
      .from('sops')
      .select('id')
      .eq('id', subject.id)
      .eq('organisation_id', organisationId)
      .eq('status', 'published')
      .maybeSingle()
    return !!data
  }
  const { data } = await loose()
    .from('site_machines')
    .select('id')
    .eq('id', subject.id)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return !!data
}

/** `type:id` -> a SOP title, a machine name, or "Whole site". Missing ones fall back to a plain word. */
export async function aboutTitles(
  organisationId: string,
  refs: ReadonlyArray<SubjectRef>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = (t: RequestSubjectType) => [...new Set(refs.filter((r) => r.type === t && r.id).map((r) => r.id as string))]
  if (refs.some((r) => r.type === 'site')) out.set('site:', 'Whole site')
  const sopIds = ids('sop')
  const machineIds = ids('machine')
  if (sopIds.length > 0) {
    const { data } = await createAdminClient()
      .from('sops')
      .select('id, title')
      .eq('organisation_id', organisationId)
      .in('id', sopIds)
    for (const s of data ?? []) out.set(`sop:${s.id}`, s.title ?? 'A SOP')
  }
  if (machineIds.length > 0) {
    const { data } = await loose()
      .from('site_machines')
      .select('id, name')
      .eq('organisation_id', organisationId)
      .in('id', machineIds)
    for (const m of (data ?? []) as Array<{ id: string; name: string | null }>) out.set(`machine:${m.id}`, m.name ?? 'A machine')
  }
  return out
}

export interface NewRequest {
  kind: RequestKind
  subject: SubjectRef
  note: string
  raisedByUser: string
}

/** Raise a request. Returns the new id, or null when the write failed. */
export async function insertRequest(organisationId: string, row: NewRequest): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from('requests')
    .insert({
      organisation_id: organisationId,
      kind: row.kind,
      state: 'open',
      raised_by_user: row.raisedByUser,
      subject_type: row.subject.type,
      subject_id: row.subject.id,
      note: row.note.trim(),
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[insertRequest] insert error', error)
    return null
  }
  return data.id
}

export interface ClaimedRequest {
  id: string
  kind: RequestKind
  subject_type: RequestSubjectType
  subject_id: string | null
  raised_by_user: string | null
  raised_by_agent: string | null
  note: string | null
}

/**
 * The answer's claim: the update only matches a row that is still open, so a second
 * click or a second answerer matches nothing and gets null (no ledger row, no notice).
 */
export async function claimOpenRequest(
  organisationId: string,
  id: string,
  patch: { state: 'accepted' | 'declined'; answered_by: string; answer_note: string | null },
): Promise<ClaimedRequest | null> {
  const { data, error } = await createAdminClient()
    .from('requests')
    .update({ ...patch, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .eq('state', 'open')
    .in('kind', [...RAISABLE_KINDS])
    .select('id, kind, subject_type, subject_id, raised_by_user, raised_by_agent, note')
  if (error) {
    console.error('[claimOpenRequest] update error', error)
    return null
  }
  return (data?.[0] as ClaimedRequest | undefined) ?? null
}

/** Open -> withdrawn, only for the person who raised it. Null when nothing matched. */
export async function withdrawOwnRequest(
  organisationId: string,
  userId: string,
  id: string,
): Promise<{ id: string } | null> {
  const { data, error } = await createAdminClient()
    .from('requests')
    .update({ state: 'withdrawn', decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .eq('raised_by_user', userId)
    .eq('state', 'open')
    .select('id')
  if (error) {
    console.error('[withdrawOwnRequest] update error', error)
    return null
  }
  return data?.[0] ?? null
}

/** A SESSION-client read under RLS: requests raised by or asked of the user, newest 50. */
export async function listMyRequestRows(sessionClient: SupabaseClient<Database>, userId: string) {
  const { data, error } = await sessionClient
    .from('requests')
    .select('id, kind, state, subject_type, subject_id, note, answer_note, answered_by, target_role, target_user_id, raised_by_user, raised_by_agent, created_at, decided_at')
    .or(`raised_by_user.eq.${userId},target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[listMyRequestRows] read error', error)
    return null
  }
  return data ?? []
}
