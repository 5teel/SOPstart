'use server'

/**
 * Phase 60 (D-01, D-03, D-04): raise, withdraw, answer and list requests.
 *
 * Thin actions. Organisation, user and role come from the session only and no
 * schema carries an organisation, user or agent field. Service-role work lives
 * in the plain modules under src/lib, so this file never imports the service-role
 * client. Async exports only. Raising and withdrawing are not decisions; an
 * answer is, and it writes exactly one ledger row, after the claim.
 */
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'
import { nameForWorker, userLabels } from '@/lib/members/labels'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle, type TitleInput } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import {
  aboutTitles,
  claimOpenRequest,
  insertRequest,
  listMyRequestRows,
  subjectInOrg,
  withdrawOwnRequest,
} from '@/lib/requests/core'
import {
  MAX_NOTE,
  RAISABLE_KINDS,
  ROLE_PLURAL,
  canAnswerRequests,
  declineNoteRule,
  noteRule,
  subjectTypesFor,
  type MyRequest,
  type RequestKind,
  type RequestSubjectType,
} from '@/lib/requests/model'

const raiseSchema = z
  .object({
    kind: z.enum(RAISABLE_KINDS),
    subject: z.object({ type: z.enum(['sop', 'machine', 'site']), id: z.string().uuid().nullable().optional() }).strict(),
    note: z.string().max(MAX_NOTE),
  })
  .strict()

const withdrawSchema = z.object({ requestId: z.string().uuid() }).strict()

const answerSchema = z
  .object({
    requestId: z.string().uuid(),
    answer: z.enum(['accept', 'decline']),
    note: z.string().max(MAX_NOTE).optional(),
  })
  .strict()

const key = (type: RequestSubjectType, id: string | null) => `${type}:${id ?? ''}`

export async function raiseRequest(input: unknown): Promise<{ id: string } | { error: string }> {
  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const parsed = raiseSchema.safeParse(input)
  if (!parsed.success) return { error: 'That request is not valid.' }
  const { kind, note } = parsed.data
  const subject = { type: parsed.data.subject.type, id: parsed.data.subject.id ?? null }
  if (!subjectTypesFor(kind).includes(subject.type)) return { error: 'That request is not valid.' }
  const noteProblem = noteRule(kind, note)
  if (noteProblem) return { error: noteProblem }
  if (!(await subjectInOrg(organisationId, subject))) return { error: 'We could not find that.' }

  const id = await insertRequest(organisationId, { kind, subject, note, raisedByUser: userId })
  if (!id) return { error: 'Could not send your request. Try again.' }
  return { id }
}

export async function withdrawRequest(input: unknown): Promise<{ ok: true } | { error: string }> {
  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const parsed = withdrawSchema.safeParse(input)
  if (!parsed.success) return { error: 'This request is no longer open.' }
  const row = await withdrawOwnRequest(organisationId, userId, parsed.data.requestId)
  if (!row) return { error: 'This request is no longer open.' }
  return { ok: true }
}

export async function answerRequest(
  input: unknown,
): Promise<{ logged: boolean; kind: RequestKind; subject: { type: RequestSubjectType; id: string | null } } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (!canAnswerRequests(role)) return { error: "You don't have access to this." }

  const parsed = answerSchema.safeParse(input)
  if (!parsed.success) return { error: 'That answer is not valid.' }
  const { requestId, answer } = parsed.data
  const answerNote = parsed.data.note?.trim() ? parsed.data.note.trim() : null
  if (answer === 'decline') {
    const problem = declineNoteRule(answerNote ?? '')
    if (problem) return { error: problem }
  }

  const state = answer === 'accept' ? 'accepted' : 'declined'
  const claimed = await claimOpenRequest(organisationId, requestId, { state, answered_by: userId, answer_note: answerNote })
  if (!claimed) return { error: 'Someone already answered this.' }

  const subject = { type: claimed.subject_type, id: claimed.subject_id }
  const aboutTitle = (await aboutTitles(organisationId, [subject])).get(key(subject.type, subject.id)) ?? 'a SOP'

  const result = await recordDecision({
    kind: answer === 'accept' ? 'request_accepted' : 'request_declined',
    subject: { kind: 'request', id: claimed.id },
    sopId: claimed.subject_type === 'sop' ? claimed.subject_id : null,
    summary: answer === 'accept' ? 'Accepted a request' : 'Declined a request',
    details: {
      request_kind: claimed.kind,
      about_title: aboutTitle,
      ...(claimed.raised_by_user ? { asker_user_id: claimed.raised_by_user } : { asker_agent: claimed.raised_by_agent }),
      note: claimed.note,
      answer_note: answerNote,
    },
  })

  if (claimed.raised_by_user) {
    let title: TitleInput = { kind: 'request_answered', outcome: state, about: aboutTitle }
    if (claimed.kind === 'observe_me' && answer === 'accept') {
      const labels = await userLabels([userId])
      title = { kind: 'request_answered', outcome: 'observe_accepted', sop: aboutTitle, name: nameForWorker(labels.get(userId)) }
    }
    await notify(organisationId, [
      {
        userId: claimed.raised_by_user,
        kind: 'request_answered',
        title: notificationTitle(title),
        place: notificationPlace('request_answered'),
        subjectType: 'request',
        subjectId: claimed.id,
        dedupeKey: dedupeKey({ kind: 'request_answered', requestId: claimed.id }),
        decisionId: result.ok ? result.id : null,
      },
    ])
  }

  return { logged: result.ok, kind: claimed.kind, subject }
}

export async function listMyRequests(): Promise<{ me: string; rows: MyRequest[] } | { error: string }> {
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const rows = await listMyRequestRows(supabase, userId)
  if (!rows) return { error: 'Could not load your requests.' }

  const titles = await aboutTitles(
    organisationId,
    rows.map((r) => ({ type: r.subject_type, id: r.subject_id })),
  )
  const people = [...new Set(rows.flatMap((r) => [r.answered_by, r.target_user_id]).filter((x): x is string => !!x))]
  const labels = await userLabels(people)

  const out: MyRequest[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    state: r.state,
    subject: {
      type: r.subject_type,
      id: r.subject_id,
      title: titles.get(key(r.subject_type, r.subject_id)) ?? 'Something that has been removed',
    },
    note: r.note ?? '',
    answerNote: r.answer_note,
    // the raiser may be a worker: a name or a role word, never an email (WR-02)
    answeredByLabel: r.answered_by ? (nameForWorker(labels.get(r.answered_by)) ?? 'an admin') : null,
    targetLabel: r.target_user_id
      ? (nameForWorker(labels.get(r.target_user_id)) ?? 'a team member')
      : r.target_role
        ? ROLE_PLURAL[r.target_role]
        : null,
    targetRole: r.target_role,
    targetUserId: r.target_user_id,
    raisedByMe: r.raised_by_user === userId,
    agent: r.raised_by_agent,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }))
  return { me: userId, rows: out }
}
