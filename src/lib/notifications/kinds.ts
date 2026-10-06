/**
 * Phase 60 -- notification kinds, titles and dedupe keys (D-07, D-08, F-12).
 *
 * Plain module, no directive. A title is a fixed sentence built from literals
 * plus a SOP title or a first name -- never an id and never a request note
 * (T-60-12). `now` is a parameter so server and client render the same text.
 */
import { nzDay } from '@/lib/office/format'

export const NOTIFICATION_KINDS = ['approve_next', 'review_due', 'signoff', 'request_answered', 'new_version', 'asked'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const NOTIFICATION_KIND_WORDS: Record<NotificationKind, string> = {
  approve_next: 'Approve',
  review_due: 'Review',
  signoff: 'Sign-off',
  request_answered: 'Answered',
  new_version: 'New version',
  asked: 'Asked',
}

const MAX_TITLE = 200

export type TitleInput =
  | { kind: 'approve_next'; sop: string }
  | { kind: 'review_due'; sop: string; dueAt: string }
  | { kind: 'signoff'; sop: string; name: string | null }
  | { kind: 'request_answered'; outcome: 'accepted' | 'declined'; about: string }
  | { kind: 'request_answered'; outcome: 'observe_accepted' | 'ask_declined'; sop: string; name: string | null }
  | { kind: 'new_version'; sop: string; version: number }
  | { kind: 'asked'; sop: string }

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()
const first = (name: string | null | undefined) => tidy(name ?? '').split(' ')[0] || 'Someone'

export function notificationTitle(input: TitleInput, now: Date = new Date()): string {
  let t: string
  switch (input.kind) {
    case 'approve_next':
      t = `Your approval is next on ${tidy(input.sop)}.`
      break
    case 'review_due':
      t =
        new Date(input.dueAt) < now
          ? `${tidy(input.sop)} was due for review on ${nzDay(input.dueAt, now)}.`
          : `${tidy(input.sop)} is due for you to review by ${nzDay(input.dueAt, now)}.`
      break
    case 'signoff':
      t = `${first(input.name)} finished ${tidy(input.sop)} and is waiting for you to sign off.`
      break
    case 'request_answered':
      if ('about' in input) t = `Your request about ${tidy(input.about)} was ${input.outcome}.`
      else if (input.outcome === 'observe_accepted') t = `${first(input.name)} accepted — they'll observe you on ${tidy(input.sop)}.`
      else t = `${first(input.name)} can't do ${tidy(input.sop)}.`
      break
    case 'new_version':
      t = `${tidy(input.sop)} has a new version (v${input.version}).`
      break
    case 'asked':
      t = `You've been asked to do ${tidy(input.sop)}.`
      break
  }
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1)}…` : t
}

export type DedupeInput =
  | { kind: 'review_due'; sopId: string; dueAt: string }
  | { kind: 'approve_next'; sopId: string; version: number; cycle: number; step: number }
  | { kind: 'signoff'; completionId: string }
  | { kind: 'request_answered' | 'asked'; requestId: string }
  | { kind: 'new_version'; sopId: string }

/** One notification per event: a re-run writes nothing new (unique on user + key). */
export function dedupeKey(input: DedupeInput): string {
  switch (input.kind) {
    case 'review_due':
      return `review_due:${input.sopId}:${input.dueAt.slice(0, 10)}`
    case 'approve_next':
      // cycle = send-backs so far on this version, so a re-request after changes tells the step again
      return `approve_next:${input.sopId}:${input.version}:${input.cycle}:${input.step}`
    case 'signoff':
      return `signoff:${input.completionId}`
    case 'request_answered':
    case 'asked':
      return `${input.kind}:${input.requestId}`
    case 'new_version':
      return `new_version:${input.sopId}`
  }
}
