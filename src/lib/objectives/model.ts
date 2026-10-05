/**
 * Phase 60 -- the objectives model (D-10, D-11, A-01).
 *
 * Plain module, no directive. Dates go through nzDay (Pacific/Auckland) so the
 * server and the client print the same words (no React #418). The "set by"
 * label is decided on the SERVER with setByWords, so an admin's email is never
 * shipped to a worker (T-60-12).
 */
import { nzDay } from '@/lib/office/format'
import type { UserLabel } from '@/lib/members/labels'

export const OBJECTIVE_SUBJECTS = ['site', 'department', 'machine', 'sop', 'person'] as const
export type ObjectiveSubject = (typeof OBJECTIVE_SUBJECTS)[number]
export const OBJECTIVE_MAX = 200

export interface ObjectiveView {
  id: string
  subjectType: ObjectiveSubject
  subjectId: string | null
  text: string
  /** YYYY-MM-DD */
  dueOn: string | null
  /** The finished "set by" words for a person-set objective; null when an agent set it. */
  setByLabel: string | null
  setByAgent: string | null
  confirmed: boolean
  setAt: string
}

/** Full name; else the email for an admin or safety manager viewer; else "an admin". */
export function setByWords(label: UserLabel | null | undefined, viewerRole: string | null | undefined): string {
  if (label?.fullName) return label.fullName
  if (label?.email && (viewerRole === 'admin' || viewerRole === 'safety_manager')) return label.email
  return 'an admin'
}

export type NormalisedObjective = { ok: true; text: string } | { ok: false; message: string }

export function normaliseObjectiveText(raw: string): NormalisedObjective {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return { ok: false, message: 'Write the objective first.' }
  if (text.length > OBJECTIVE_MAX) return { ok: false, message: `Keep it to ${OBJECTIVE_MAX} characters or fewer.` }
  return { ok: true, text }
}

export interface ObjectiveLineParts {
  prefix: string
  text: string
  /** "by 12 Nov" or "was due 3 Oct"; null when there is no date. */
  when: string | null
  overdue: boolean
  /** "set by Jane" */
  setBy: string
  agent: string | null
  unconfirmed: boolean
}

const nzToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(now) // YYYY-MM-DD

export function objectiveLine(o: ObjectiveView, now: Date, prefix = 'Objective'): ObjectiveLineParts {
  const overdue = !!o.dueOn && o.dueOn < nzToday(now) // due today is not overdue
  const day = o.dueOn ? nzDay(`${o.dueOn}T00:00:00Z`, now) : null
  return {
    prefix,
    text: o.text,
    when: day ? (overdue ? `was due ${day}` : `by ${day}`) : null,
    overdue,
    setBy: `set by ${o.setByAgent ?? o.setByLabel ?? 'an admin'}`,
    agent: o.setByAgent,
    unconfirmed: !!o.setByAgent && !o.confirmed,
  }
}
