/**
 * Phase 59: the Office's one date formatter. Every output is pinned to
 * Pacific/Auckland and en-NZ -- never the browser zone, so server and client
 * render the same text (no React #418). `now` is a parameter, so callers
 * decide when "now" is. Plain module, no directive.
 */
const TZ = 'Pacific/Auckland'
const DAY_MS = 86_400_000

function nzYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), day: get('day') }
}

/** Whole NZ calendar days from `a` to `b`. */
function nzDayDiff(a: Date, b: Date): number {
  const x = nzYmd(a)
  const y = nzYmd(b)
  return Math.round((Date.UTC(y.y, y.m - 1, y.day) - Date.UTC(x.y, x.m - 1, x.day)) / DAY_MS)
}

/** The instant NZ midnight began for the NZ calendar day `now` falls in, as an ISO string. */
export function nzStartOfDayIso(now: Date = new Date()): string {
  const { y, m, day } = nzYmd(now)
  const utcMidnight = Date.UTC(y, m - 1, day)
  // NZ is UTC+12 or +13; midnight is never inside a DST gap, so exactly one candidate reads 00:00 on that day.
  for (const hours of [13, 12]) {
    const c = new Date(utcMidnight - hours * 3_600_000)
    const wall = new Intl.DateTimeFormat('en-NZ', { timeZone: TZ, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' }).format(c)
    const w = nzYmd(c)
    if (wall === '00:00' && w.y === y && w.m === m && w.day === day) return c.toISOString()
  }
  return new Date(utcMidnight - 12 * 3_600_000).toISOString()
}

/** "12 Nov"; the year is added only when it is not the current NZ year. */
export function nzDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const withYear = nzYmd(d).y !== nzYmd(now).y
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d)
}

/** "Tue 5 Oct, 2:14 pm" */
export function nzDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`
}

/** "just now" · "12 min ago" · "3 hours ago" · "yesterday" · "4 days ago" · "12 Nov" */
export function relativeWhen(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const ms = now.getTime() - then.getTime()
  if (Number.isNaN(ms) || ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min ago`
  const days = nzDayDiff(then, now)
  if (days <= 0) {
    const hours = Math.floor(mins / 60)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return nzDay(iso, now)
}

export type ReviewSegment =
  | { state: 'none'; text: string }
  | { state: 'due'; text: string }
  | { state: 'overdue'; lead: string; date: string }

/** The review half of the owner/review line. Overdue uses the same `due < now` rule as classify.ts. */
export function reviewSegment(reviewDueAt: string | null, now: Date = new Date()): ReviewSegment {
  if (!reviewDueAt) return { state: 'none', text: 'no review date' }
  const due = new Date(reviewDueAt)
  if (due < now) return { state: 'overdue', lead: 'review was due ', date: nzDay(reviewDueAt, now) }
  if (nzDayDiff(now, due) === 0) return { state: 'due', text: 'review due today' }
  return { state: 'due', text: `review due ${nzDay(reviewDueAt, now)}` }
}
