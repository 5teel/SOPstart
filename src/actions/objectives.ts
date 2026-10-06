'use server'

/**
 * Phase 60 (D-10, D-11, OBJ-01, OBJ-03): set, remove, confirm and list objectives.
 *
 * Thin actions. Organisation, user and role come from the session inside the
 * core, and no schema carries an organisation, user, setter or agent field: the
 * agent setter is reachable only from server code (60-10). Service-role work
 * lives in src/lib/objectives/core.ts, so this file never imports the
 * service-role client. Async exports only. Each change writes exactly one ledger
 * row, after the core returns.
 */
import { z } from 'zod'
import { recordDecision } from '@/lib/decisions/record'
import {
  clearObjectiveCore,
  confirmObjectiveCore,
  listObjectivesCore,
  setObjectiveCore,
  type PreviousObjective,
} from '@/lib/objectives/core'
import { OBJECTIVE_SUBJECTS, type ObjectiveView } from '@/lib/objectives/model'

const subjectSchema = z
  .object({ type: z.enum(OBJECTIVE_SUBJECTS), id: z.string().uuid().nullable().optional() })
  .strict()

const setSchema = z
  .object({
    subject: subjectSchema,
    text: z.string().max(1000),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .strict()

const clearSchema = z.object({ subject: subjectSchema }).strict()
const confirmSchema = z.object({ objectiveId: z.string().uuid() }).strict()

const previousDetails = (p: PreviousObjective | null) =>
  p
    ? {
        previous_text: p.text,
        previous_due_on: p.dueOn,
        previous_set_at: p.setAt,
        ...(p.setByAgent ? { previous_set_by_agent: p.setByAgent } : {}),
      }
    : {}

export async function setObjective(input: unknown): Promise<{ logged: boolean } | { error: string }> {
  const parsed = setSchema.safeParse(input)
  if (!parsed.success) return { error: 'That objective is not valid.' }
  const { subject, text, dueOn } = parsed.data

  const done = await setObjectiveCore({ subject: { type: subject.type, id: subject.id ?? null }, text, dueOn }, 'person')
  if ('error' in done) return done

  const result = await recordDecision({
    kind: 'objective_set',
    subject: { kind: 'objective', id: done.id },
    sopId: done.subject.type === 'sop' ? done.subject.id : null,
    summary: 'Set an objective',
    details: {
      subject_type: done.subject.type,
      subject_id: done.subject.id,
      text: done.text,
      due_on: done.dueOn,
      ...previousDetails(done.previous),
    },
  })
  return { logged: result.ok }
}

export async function clearObjective(input: unknown): Promise<{ logged: boolean } | { error: string }> {
  const parsed = clearSchema.safeParse(input)
  if (!parsed.success) return { error: 'That is not valid.' }
  const { subject } = parsed.data

  const done = await clearObjectiveCore({ subject: { type: subject.type, id: subject.id ?? null } })
  if ('error' in done) return done

  const result = await recordDecision({
    kind: 'objective_cleared',
    subject: { kind: 'objective', id: done.id },
    sopId: done.subject.type === 'sop' ? done.subject.id : null,
    summary: 'Removed an objective',
    details: { subject_type: done.subject.type, subject_id: done.subject.id, ...previousDetails(done.previous) },
  })
  return { logged: result.ok }
}

export async function confirmObjective(input: unknown): Promise<{ logged: boolean } | { error: string }> {
  const parsed = confirmSchema.safeParse(input)
  if (!parsed.success) return { error: 'That is not valid.' }

  const done = await confirmObjectiveCore({ objectiveId: parsed.data.objectiveId })
  if ('error' in done) return done

  const result = await recordDecision({
    kind: 'objective_confirmed',
    subject: { kind: 'objective', id: done.id },
    sopId: done.subject.type === 'sop' ? done.subject.id : null,
    summary: 'Confirmed an objective',
    details: { subject_type: done.subject.type, subject_id: done.subject.id, text: done.text, set_by_agent: done.setByAgent },
  })
  return { logged: result.ok }
}

export async function listObjectives(): Promise<{ viewerCanEdit: boolean; rows: ObjectiveView[] } | { error: string }> {
  return listObjectivesCore()
}
