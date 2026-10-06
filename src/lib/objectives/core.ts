import 'server-only'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentName } from '@/lib/decisions/shape'
import { userLabels } from '@/lib/members/labels'
import { lineageRoot } from '@/lib/sop/lineage-current'
import { normaliseObjectiveText, setByWords, type ObjectiveSubject, type ObjectiveView } from '@/lib/objectives/model'

/**
 * Phase 60 (D-10, D-11, D-12, A-01, A-09) -- the objectives core. Plain module,
 * no directive: no client can call it.
 *
 * Why service role: objectives has no authenticated write policy by design
 * (00074). The person actions and the agent descriptors (60-10) both call it, so
 * it reads the organisation, the person and the role from the SESSION itself:
 * no function here takes an organisation, and the role gate is shared by both
 * paths (the agent runs under the calling admin's session). Every query carries
 * the session organisation (CLAUDE.md 2026-06-15 and 2026-07-28: never an
 * organisation read off a fetched row). Nothing here writes the decision ledger;
 * the caller does, once.
 */

// ponytail: only objectives is typed; departments and site_machines are not, so all go through one loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = () => createAdminClient() as any

const EDIT_ROLES = ['admin', 'safety_manager']

export type ObjectiveSetter = 'person' | { agent: AgentName }
export interface SubjectIn {
  type: ObjectiveSubject
  id: string | null
}

export interface PreviousObjective {
  text: string
  dueOn: string | null
  setAt: string
  /** Set when the replaced objective was agent-set (unconfirmed or confirmed). */
  setByAgent: string | null
}

export interface ObjectiveWritten {
  id: string
  /** The subject as stored: a SOP is its lineage root (A-01). */
  subject: SubjectIn
  text: string
  dueOn: string | null
  previous: PreviousObjective | null
}

interface Caller {
  userId: string
  organisationId: string
  role: string
}

async function editor(): Promise<Caller | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (!role || !EDIT_ROLES.includes(role)) return { error: 'Admin access required' }
  return { userId, organisationId, role }
}

/** The subject as it is stored, or null when it is not in the organisation. A SOP resolves to its lineage root. */
async function resolveSubject(organisationId: string, s: SubjectIn): Promise<SubjectIn | null> {
  if (s.type === 'site') return s.id === null ? s : null
  if (!s.id) return null
  const admin = loose()
  if (s.type === 'sop') {
    const { data } = await admin
      .from('sops')
      .select('id, parent_sop_id')
      .eq('id', s.id)
      .eq('organisation_id', organisationId)
      .maybeSingle()
    return data ? { type: 'sop', id: lineageRoot(data) } : null
  }
  const table = { department: 'departments', machine: 'site_machines', person: 'organisation_members' }[s.type]
  const column = s.type === 'person' ? 'user_id' : 'id'
  const { data } = await admin.from(table).select(column).eq(column, s.id).eq('organisation_id', organisationId).maybeSingle()
  return data ? s : null
}

const COLUMNS = 'id, text, due_on, set_at, set_by_user, set_by_agent, confirmed_by'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forSubject = (q: any, organisationId: string, s: SubjectIn) => {
  const base = q.eq('organisation_id', organisationId).eq('subject_type', s.type)
  return s.id === null ? base.is('subject_id', null) : base.eq('subject_id', s.id)
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/

/**
 * Select, then update or insert; a lost race (23505) retries once as an update.
 * The previous text, date and setter come back for the ledger row (D-10).
 */
export async function setObjectiveCore(
  input: { subject: SubjectIn; text: string; dueOn: string | null },
  setter: ObjectiveSetter,
): Promise<ObjectiveWritten | { error: string }> {
  const who = await editor()
  if ('error' in who) return who
  const { organisationId, userId } = who

  const text = normaliseObjectiveText(input.text)
  if (!text.ok) return { error: text.message }
  if (input.dueOn !== null && (!isoDay.test(input.dueOn) || Number.isNaN(Date.parse(input.dueOn)))) {
    return { error: 'That date is not valid.' }
  }
  const subject = await resolveSubject(organisationId, input.subject)
  if (!subject) return { error: 'We could not find that.' }

  const admin = loose()
  const patch = {
    text: text.text,
    due_on: input.dueOn,
    set_by_user: setter === 'person' ? userId : null,
    set_by_agent: setter === 'person' ? null : setter.agent,
    set_at: new Date().toISOString(),
    confirmed_by: null,
    confirmed_at: null,
  }

  const find = async () => {
    const { data } = await forSubject(admin.from('objectives').select(COLUMNS), organisationId, subject).maybeSingle()
    return data as { id: string; text: string; due_on: string | null; set_at: string; set_by_agent: string | null } | null
  }
  const replace = async (id: string) => {
    const { data, error } = await admin
      .from('objectives')
      .update(patch)
      .eq('id', id)
      .eq('organisation_id', organisationId)
      .select('id')
    if (error) console.error('[setObjectiveCore] update error', error)
    return !error && !!data?.length // a zero-row write reports failure
  }

  let previous = await find()
  let id: string | null = null
  if (previous) {
    if (await replace(previous.id)) id = previous.id
  } else {
    const ins = await admin
      .from('objectives')
      .insert({ ...patch, organisation_id: organisationId, subject_type: subject.type, subject_id: subject.id })
      .select('id')
      .single()
    if (!ins.error && ins.data) id = ins.data.id
    else if (ins.error?.code === '23505') {
      previous = await find()
      if (previous && (await replace(previous.id))) id = previous.id
    } else console.error('[setObjectiveCore] insert error', ins.error)
  }
  if (!id) return { error: 'Could not save the objective. Try again.' }

  return {
    id,
    subject,
    text: text.text,
    dueOn: input.dueOn,
    previous: previous
      ? { text: previous.text, dueOn: previous.due_on, setAt: previous.set_at, setByAgent: previous.set_by_agent }
      : null,
  }
}

/** Remove the one live objective on the subject. Its previous text comes back for the ledger. */
export async function clearObjectiveCore(input: {
  subject: SubjectIn
}): Promise<{ id: string; subject: SubjectIn; previous: PreviousObjective } | { error: string }> {
  const who = await editor()
  if ('error' in who) return who
  const { organisationId } = who
  const subject = await resolveSubject(organisationId, input.subject)
  if (!subject) return { error: 'We could not find that.' }

  const { data, error } = await forSubject(loose().from('objectives').delete(), organisationId, subject).select(COLUMNS)
  if (error) {
    console.error('[clearObjectiveCore] delete error', error)
    return { error: 'Could not remove the objective. Try again.' }
  }
  const row = data?.[0] as { id: string; text: string; due_on: string | null; set_at: string; set_by_agent: string | null } | undefined
  if (!row) return { error: 'There is no objective to remove.' }
  return { id: row.id, subject, previous: { text: row.text, dueOn: row.due_on, setAt: row.set_at, setByAgent: row.set_by_agent } }
}

/** Confirm an agent-set objective. Matches only a claim: agent-set and not yet confirmed. */
export async function confirmObjectiveCore(input: {
  objectiveId: string
}): Promise<{ id: string; subject: SubjectIn; text: string; setByAgent: string } | { error: string }> {
  const who = await editor()
  if ('error' in who) return who
  const { organisationId, userId } = who

  const { data, error } = await loose()
    .from('objectives')
    .update({ confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq('id', input.objectiveId)
    .eq('organisation_id', organisationId)
    .not('set_by_agent', 'is', null)
    .is('confirmed_by', null)
    .select('id, subject_type, subject_id, text, set_by_agent')
  if (error) {
    console.error('[confirmObjectiveCore] update error', error)
    return { error: 'Could not confirm the objective. Try again.' }
  }
  const row = data?.[0] as { id: string; subject_type: ObjectiveSubject; subject_id: string | null; text: string; set_by_agent: string } | undefined
  if (!row) return { error: 'This objective is not waiting to be confirmed.' }
  return { id: row.id, subject: { type: row.subject_type, id: row.subject_id }, text: row.text, setByAgent: row.set_by_agent }
}

/** Every objective of the session organisation, for any member. The email shows only to an admin or safety manager. */
export async function listObjectivesCore(): Promise<{ viewerCanEdit: boolean; rows: ObjectiveView[] } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const { data, error } = await loose()
    .from('objectives')
    .select('id, subject_type, subject_id, text, due_on, set_by_user, set_by_agent, set_at, confirmed_by')
    .eq('organisation_id', organisationId)
    .order('set_at', { ascending: false })
  if (error) {
    console.error('[listObjectivesCore] read error', error)
    return { error: 'Could not load objectives.' }
  }
  type Row = {
    id: string
    subject_type: ObjectiveSubject
    subject_id: string | null
    text: string
    due_on: string | null
    set_by_user: string | null
    set_by_agent: string | null
    set_at: string
    confirmed_by: string | null
  }
  const rows = (data ?? []) as Row[]
  const labels = await userLabels([...new Set(rows.map((r) => r.set_by_user).filter((x): x is string => !!x))])
  return {
    viewerCanEdit: !!role && EDIT_ROLES.includes(role),
    rows: rows.map((r) => ({
      id: r.id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      text: r.text,
      dueOn: r.due_on,
      setByLabel: r.set_by_user ? setByWords(labels.get(r.set_by_user), role) : null,
      setByAgent: r.set_by_agent,
      confirmed: r.confirmed_by !== null || r.set_by_user !== null, // a person-set objective needs no confirming
      setAt: r.set_at,
    })),
  }
}

/** The one objective on a subject (a SOP resolves to its lineage root), or null. Any member may read. */
export async function readObjectiveCore(subject: SubjectIn): Promise<ObjectiveView | null | { error: string }> {
  const list = await listObjectivesCore()
  if ('error' in list) return list
  const { organisationId } = await getSessionContext()
  const resolved = organisationId ? await resolveSubject(organisationId, subject) : null
  if (!resolved) return { error: 'We could not find that.' }
  return list.rows.find((r) => r.subjectType === resolved.type && r.subjectId === resolved.id) ?? null
}
