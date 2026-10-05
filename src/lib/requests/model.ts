/**
 * Phase 60 -- the requests model: kinds, states, words and the pure rules every
 * server and client surface shares (D-01, D-02, D-03, A-03).
 *
 * Plain module: no directive, nothing that only runs on the server. The My-requests grouping
 * takes ISO strings and a `now`; it never reads the clock.
 */

export const REQUEST_KINDS = ['change_sop', 'new_sop', 'observe_me', 'do_sop'] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

/** The kinds a person can raise by hand; do_sop is only ever made by an ask. */
export const RAISABLE_KINDS = ['change_sop', 'new_sop', 'observe_me'] as const satisfies ReadonlyArray<RequestKind>

export const REQUEST_STATES = ['open', 'accepted', 'declined', 'withdrawn'] as const
export type RequestState = (typeof REQUEST_STATES)[number]

export const REQUEST_KIND_WORDS: Record<RequestKind, string> = {
  change_sop: 'Change a SOP',
  new_sop: 'New SOP',
  observe_me: 'Observe me',
  do_sop: 'Asked to do a SOP',
}

export const REQUEST_STATE_WORDS: Record<RequestState, string> = {
  open: 'Open',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

export const ROLE_PLURAL = {
  worker: 'Workers',
  supervisor: 'Supervisors',
  admin: 'SOP Admins',
  safety_manager: 'Safety Managers',
} as const

export const MIN_NOTE = 10
export const MAX_NOTE = 500

export type RequestSubjectType = 'sop' | 'machine' | 'site'

export interface RequestSubject {
  type: RequestSubjectType
  id: string | null
  title: string
}

/** One open request as the Office Requests tab shows it. */
export interface OfficeRequest {
  id: string
  kind: RequestKind
  subject: RequestSubject
  askerLabel: string
  agent: string | null
  note: string
  createdAt: string
}

/** One request as My requests shows it (raised by me, or asked of me). */
export interface MyRequest {
  id: string
  kind: RequestKind
  state: RequestState
  subject: RequestSubject
  note: string
  answerNote: string | null
  answeredByLabel: string | null
  targetLabel: string | null
  targetRole: string | null
  targetUserId: string | null
  raisedByMe: boolean
  agent: string | null
  createdAt: string
  decidedAt: string | null
}

/** Admin, safety manager and supervisor answer requests and ask people to do a SOP (A-04). */
export function canAnswerRequests(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'safety_manager' || role === 'supervisor'
}
export const canAsk = canAnswerRequests

/** A new SOP is about a machine or the whole site; every other kind is about a SOP. */
export function subjectTypesFor(kind: RequestKind): ReadonlyArray<RequestSubjectType> {
  return kind === 'new_sop' ? ['machine', 'site'] : ['sop']
}

const solid = (s: string) => s.replace(/\s/g, '').length

/** null = fine, otherwise the plain-words reason. */
export function noteRule(kind: RequestKind, note: string): string | null {
  if (note.length > MAX_NOTE) return `Keep it to ${MAX_NOTE} characters or fewer.`
  if ((kind === 'change_sop' || kind === 'new_sop') && solid(note) < MIN_NOTE) return `Say a little more: ${MIN_NOTE} characters or more.`
  return null
}

/** A decline always needs a reason (D-03). */
export function declineNoteRule(note: string): string | null {
  if (note.length > MAX_NOTE) return `Keep it to ${MAX_NOTE} characters or fewer.`
  return solid(note) < MIN_NOTE ? `Say why: ${MIN_NOTE} characters or more.` : null
}

/** The Office pin: Inbox rows plus open requests the viewer can answer. One helper so pin, tab and cache agree. */
export function officePinCount(items: ReadonlyArray<unknown>, requests: ReadonlyArray<unknown>): number {
  return items.length + requests.length
}

const DAY_MS = 86_400_000
const ASK_WINDOW_DAYS = 14
const ts = (iso: string) => new Date(iso).getTime()
const newestFirst = (a: MyRequest, b: MyRequest) => ts(b.createdAt) - ts(a.createdAt)
const decidedFirst = (a: MyRequest, b: MyRequest) => ts(b.decidedAt ?? b.createdAt) - ts(a.decidedAt ?? a.createdAt)

export interface MyRequestGroups {
  askedOfYou: MyRequest[]
  youAsked: MyRequest[]
  youAskedTotal: number
  answered: MyRequest[]
}

/**
 * The three My-requests groups (UI-SPEC). A role-targeted ask never appears
 * under "asked of you": it has no per-person decline (A-03).
 */
export function groupMyRequests(rows: ReadonlyArray<MyRequest>, me: string, now: Date, youAskedLimit = 5): MyRequestGroups {
  const since = now.getTime() - ASK_WINDOW_DAYS * DAY_MS
  const askedOfYou = rows
    .filter((r) => r.kind === 'do_sop' && r.state === 'accepted' && r.targetUserId === me && ts(r.createdAt) >= since)
    .sort(newestFirst)
    .slice(0, 3)
  const asked = rows
    .filter((r) => r.raisedByMe && (r.state === 'open' || (r.kind === 'do_sop' && r.state === 'accepted')))
    .sort(newestFirst)
  const answered = rows
    .filter(
      (r) =>
        r.raisedByMe &&
        (r.state === 'declined' || r.state === 'withdrawn' || (r.state === 'accepted' && r.kind !== 'do_sop')),
    )
    .sort(decidedFirst)
    .slice(0, 3)
  return { askedOfYou, youAsked: asked.slice(0, youAskedLimit), youAskedTotal: asked.length, answered }
}
