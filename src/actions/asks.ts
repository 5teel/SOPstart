'use server'

/**
 * Phase 60 (D-02, A-03, A-05): ask someone to do a SOP, decline an ask, stop asking,
 * and list who can be asked.
 *
 * Thin actions. Organisation, user and role come from the session only and no
 * schema carries an organisation, user or agent field. Service-role work lives in
 * src/lib/requests/ask-core.ts, so this file never imports the service-role
 * client. Async exports only. Each action records exactly one ledger row, after
 * its core returns; an ask is accepted on the asker's authority, so the one row
 * is written at raise time.
 */
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'
import { memberLabel, nameForWorker, userLabels } from '@/lib/members/labels'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import {
  askToDoSopCore,
  declineAskCore,
  listAskTargetsCore,
  stopAskingCore,
  type AskTargets,
} from '@/lib/requests/ask-core'
import { aboutTitles } from '@/lib/requests/core'
import { MAX_NOTE, ROLE_PLURAL, canAsk, declineNoteRule } from '@/lib/requests/model'

const ROLES = ['worker', 'supervisor', 'admin', 'safety_manager'] as const

const askSchema = z
  .object({
    sopId: z.string().uuid(),
    target: z.union([z.object({ role: z.enum(ROLES) }).strict(), z.object({ userId: z.string().uuid() }).strict()]),
    note: z.string().max(MAX_NOTE).optional(),
  })
  .strict()

const answerSchema = z.object({ requestId: z.string().uuid(), note: z.string().max(MAX_NOTE) }).strict()

const targetsSchema = z.object({ sopId: z.string().uuid().optional() }).strict()

export async function askToDoSop(
  input: unknown,
): Promise<{ logged: boolean; told: number; targetLabel: string } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (!canAsk(role)) return { error: 'Office access required' }

  const parsed = askSchema.safeParse(input)
  if (!parsed.success) return { error: 'That ask is not valid.' }
  const { sopId, target } = parsed.data
  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  const done = await askToDoSopCore({ organisationId, userId }, { sopId, target, note })
  if ('error' in done) return done

  const targetLabel =
    'role' in target ? ROLE_PLURAL[target.role] : memberLabel((await userLabels([target.userId])).get(target.userId))

  const result = await recordDecision({
    kind: 'request_accepted',
    subject: { kind: 'request', id: done.requestId },
    sopId,
    summary: 'Asked someone to do a SOP',
    details: {
      request_kind: 'do_sop',
      about_title: done.sopTitle,
      auto: true,
      asker_user_id: userId,
      ...('role' in target ? { target_role: target.role } : { target_user_id: target.userId }),
      note,
    },
  })

  const told = await notify(
    organisationId,
    done.recipients.map((recipient) => ({
      userId: recipient,
      kind: 'asked' as const,
      title: notificationTitle({ kind: 'asked', sop: done.sopTitle }),
      place: notificationPlace('asked', { sopId }),
      subjectType: 'request',
      subjectId: done.requestId,
      dedupeKey: dedupeKey({ kind: 'asked', requestId: done.requestId }),
      decisionId: result.ok ? result.id : null,
    })),
  )

  return { logged: result.ok, told, targetLabel }
}

export async function declineAsk(input: unknown): Promise<{ logged: boolean } | { error: string }> {
  const { userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const parsed = answerSchema.safeParse(input)
  if (!parsed.success) return { error: 'That answer is not valid.' }
  const note = parsed.data.note.trim()
  const problem = declineNoteRule(note)
  if (problem) return { error: problem }

  const claimed = await declineAskCore({ organisationId, userId }, { requestId: parsed.data.requestId, note })
  if (!claimed) return { error: 'This ask is no longer open.' }

  const aboutTitle = (await aboutTitles(organisationId, [{ type: 'sop', id: claimed.subject_id }])).get(`sop:${claimed.subject_id}`) ?? 'a SOP'
  const result = await recordDecision({
    kind: 'request_declined',
    subject: { kind: 'request', id: claimed.id },
    sopId: claimed.subject_id,
    summary: 'Declined a SOP they were asked to do',
    details: {
      request_kind: 'do_sop',
      about_title: aboutTitle,
      asker_user_id: claimed.raised_by_user,
      target_user_id: userId,
      note: claimed.note,
      answer_note: note,
    },
  })

  if (claimed.raised_by_user) {
    const labels = await userLabels([userId])
    await notify(organisationId, [
      {
        userId: claimed.raised_by_user,
        kind: 'request_answered',
        title: notificationTitle({ kind: 'request_answered', outcome: 'ask_declined', sop: aboutTitle, name: nameForWorker(labels.get(userId)) }),
        place: notificationPlace('request_answered'),
        subjectType: 'request',
        subjectId: claimed.id,
        dedupeKey: dedupeKey({ kind: 'request_answered', requestId: claimed.id }),
        decisionId: result.ok ? result.id : null,
      },
    ])
  }

  return { logged: result.ok }
}

export async function stopAsking(input: unknown): Promise<{ logged: boolean } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (!canAsk(role)) return { error: 'Office access required' }

  const parsed = answerSchema.safeParse(input)
  if (!parsed.success) return { error: 'That answer is not valid.' }
  const note = parsed.data.note.trim()
  const problem = declineNoteRule(note)
  if (problem) return { error: problem }

  const claimed = await stopAskingCore(
    { organisationId, userId },
    { requestId: parsed.data.requestId, note, canStopAny: role === 'admin' || role === 'safety_manager' },
  )
  if (!claimed) return { error: 'This ask is no longer open.' }

  const aboutTitle = (await aboutTitles(organisationId, [{ type: 'sop', id: claimed.subject_id }])).get(`sop:${claimed.subject_id}`) ?? 'a SOP'
  const result = await recordDecision({
    kind: 'request_declined',
    subject: { kind: 'request', id: claimed.id },
    sopId: claimed.subject_id,
    summary: 'Stopped asking someone to do a SOP',
    details: {
      request_kind: 'do_sop',
      about_title: aboutTitle,
      stopped: true,
      asker_user_id: claimed.raised_by_user,
      ...(claimed.target_role ? { target_role: claimed.target_role } : { target_user_id: claimed.target_user_id }),
      note: claimed.note,
      answer_note: note,
    },
  })
  return { logged: result.ok }
}

export async function listAskTargets(input?: unknown): Promise<AskTargets | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (!canAsk(role)) return { error: 'Office access required' }

  const parsed = targetsSchema.safeParse(input ?? {})
  if (!parsed.success) return { error: 'That is not valid.' }
  const targets = await listAskTargetsCore(organisationId, parsed.data.sopId ?? null)
  return targets ?? { error: 'Could not load people to ask.' }
}
