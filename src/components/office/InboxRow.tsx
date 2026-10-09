'use client'

/**
 * Phase 59 (OFF-01..04, D-04, D-06, D-07) -- one inbox row, one button.
 *
 * The row only SHOWS a button; the server action behind it decides whether the
 * caller may act (T-59-35). Governance rows keep the Phase 54 precedence
 * (APR-03/04, Phase 29/41), carried over from the old queue row: approve-me
 * before unowned before stale-role before confirm-current. Do not re-implement
 * it elsewhere; add display props here instead.
 *
 * Sign off and Approve expand the row in place into the finished 59-08 panels
 * (the pane keeps one open at a time). Admin-chunk code: the Office pane is the
 * only importer. No router, no navigation from an effect.
 */
import { HOME, homeFrom } from '@/lib/shell/home-state'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { confirmSopCurrent } from '@/actions/governance'
import { requeueParse } from '@/hooks/useParseJob'
import { OwnerPicker } from '@/components/admin/governance/OwnerPicker'
import { OwnerReviewMeta } from '@/components/admin/governance/OwnerReviewMeta'
import type { InboxItem } from '@/lib/governance/inbox'
import { focusHref } from '@/lib/sop/focus-path'
import { ApprovePanel } from './ApprovePanel'
import { SignOffPanel } from './SignOffPanel'

/** `link` and `hold` are for a receipt that points somewhere: it stays until the next action (60-11). */
export type RowDone = { receipt: string; logged: boolean | null; link?: { href: string; label: string }; hold?: boolean; after?: string }

const FAILED_COPY = "That didn't work. Nothing was changed — try again."

const SEVERITY_DOT: Record<InboxItem['severity'], string> = {
  bad: 'bg-accent-escalate',
  warn: 'bg-accent-decision',
  info: 'bg-accent-measure',
  grey: 'bg-ink-300',
}

// Amber is never small text: the warn chip carries colour in fill and border, the words stay dark.
const CHIP_STYLE: Record<InboxItem['severity'], string> = {
  bad: 'bg-accent-escalate/10 text-accent-escalate',
  warn: 'bg-accent-decision/10 border border-accent-decision/40 text-ink-900',
  info: 'bg-accent-measure/10 text-accent-measure',
  grey: 'bg-paper-2 text-ink-700',
}

const ROW_BUTTON =
  'inline-flex min-h-tap shrink-0 items-center justify-center gap-1.5 self-center rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900 hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-accent-step disabled:opacity-60'

type Branch = 'approve' | 'owner' | 'fix' | 'confirm' | 'review' | 'signoff' | 'stuck' | 'machine'

function branchOf(item: InboxItem): Branch {
  const g = item.gov
  if (g) {
    // The action decides; the UI only shows a button (APR-03/04).
    if (g.flags.includes('awaiting_approval') && g.isCallerNextApprover) return 'approve'
    if (g.flags.includes('unowned')) return 'owner'
    if (g.flags.includes('stale_role')) return 'fix'
    return 'confirm'
  }
  if (item.kind === 'signoff') return 'signoff'
  if (item.kind === 'review') return 'review'
  if (item.kind === 'stuck') return 'stuck'
  return 'machine'
}

const CHIP_WORD: Record<Branch, string> = {
  approve: 'Approve',
  owner: 'No owner',
  fix: 'Owner role gone',
  confirm: 'Overdue',
  review: 'Due soon',
  signoff: 'Sign-off',
  stuck: 'Stuck',
  machine: 'No SOP',
}

function detailOf(item: InboxItem, branch: Branch): string {
  const g = item.gov
  switch (branch) {
    case 'owner':
      return 'Nobody looks after this SOP.'
    case 'fix':
      return 'The role that owned this was removed.'
    case 'approve':
      return 'Your approval is next.'
    case 'confirm':
      return `Owned by ${g?.ownerLabel ?? 'someone'}.`
    case 'review':
      return 'You own this SOP.'
    case 'signoff':
      return item.meta
    case 'stuck':
      return 'Stopped while reading the document.'
    case 'machine':
      return 'Nothing for workers to follow yet.'
  }
}

export function InboxRow({
  item,
  expanded,
  leaving,
  onToggle,
  onDone,
}: {
  item: InboxItem
  expanded: boolean
  /** The row has just cleared: 'ready' is its full height, 'go' collapses it over 200 ms (the tab removes it afterwards). */
  leaving?: 'ready' | 'go'
  onToggle(): void
  onDone(r: RowDone): void
}) {
  const branch = branchOf(item)
  const g = item.gov
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expandable = branch === 'approve' || branch === 'signoff'
  const open = expandable && expanded

  // Focus the panel as it opens.
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  // Esc collapses an expanded row, but only when no modal layer is up. Registered on the
  // document in the capture phase: the lightbox's window listener runs first and swallows
  // its own Esc, and the shell's listener (window, bubble) sees the key already handled.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      onToggle()
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onToggle])

  async function run(word: string, act: () => Promise<RowDone | string>) {
    if (pending) return
    setPending(word)
    setError(null)
    try {
      const result = await act()
      if (typeof result === 'string') setError(result)
      else onDone(result)
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  // The governance Mark reviewed and the owner's own review row both end up in confirmSopCurrent(id).
  const markReviewed = (sopId: string) =>
    run('Marking…', async () => {
      const result = await confirmSopCurrent(sopId)
      return 'error' in result ? result.error : { receipt: 'Marked reviewed', logged: result.logged }
    })

  const tryAgain = (retry: { sopId: string; isVideo: boolean }) =>
    run('Starting…', async () => {
      const line = await requeueParse(retry.sopId, retry.isVideo)
      return line ?? { receipt: 'Reading it again.', logged: null }
    })

  const sopId = g?.id ?? item.signOff?.sopId ?? item.review?.sopId ?? null
  const titleHref = sopId ? focusHref(sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) }) : branch === 'stuck' ? (item.action?.href ?? null) : null

  const busyLabel = (label: string) =>
    pending ? (
      <>
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        {pending}
      </>
    ) : (
      label
    )

  let button: React.ReactNode
  if (expandable) {
    button = (
      <button
        ref={buttonRef}
        type="button"
        data-testid="office-row-action"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={ROW_BUTTON}
      >
        {expanded ? 'Close' : branch === 'approve' ? 'Approve' : 'Sign off'}
      </button>
    )
  } else if (branch === 'owner' && g) {
    button = (
      <OwnerPicker
        sopId={g.id}
        ownerUserId={g.ownerUserId}
        ownerLabel={g.ownerLabel}
        triggerTestId="office-row-action"
        triggerClassName={`${ROW_BUTTON} gap-1.5`}
        onDone={(r) => onDone({ receipt: 'Owner set', logged: r.logged })}
      />
    )
  } else if (branch === 'fix' && g) {
    button = (
      <Link data-testid="office-row-action" href={focusHref(g.id, { mode: 'edit', from: homeFrom({ ...HOME, s: 'signoffs' }) })} className={ROW_BUTTON}>
        Open SOP
      </Link>
    )
  } else if ((branch === 'confirm' && g) || (branch === 'review' && item.review)) {
    const id = g?.id ?? item.review!.sopId
    button = (
      <button
        type="button"
        data-testid="office-row-action"
        disabled={pending !== null}
        onClick={() => void markReviewed(id)}
        className={ROW_BUTTON}
      >
        {busyLabel('Mark reviewed')}
      </button>
    )
  } else if (branch === 'stuck' && item.action?.retry) {
    const retry = item.action.retry
    button = (
      <button
        type="button"
        data-testid="office-row-action"
        disabled={pending !== null}
        onClick={() => void tryAgain(retry)}
        className={ROW_BUTTON}
      >
        {busyLabel('Try again')}
      </button>
    )
  } else if (item.action) {
    button = (
      <Link data-testid="office-row-action" href={item.action.href} className={ROW_BUTTON}>
        {item.action.label}
      </Link>
    )
  } else {
    button = null
  }

  return (
    <li
      data-testid="office-row"
      data-key={item.key}
      data-kind={item.kind}
      data-severity={item.severity}
      aria-hidden={leaving ? true : undefined}
      className={`min-h-tap-row border-b border-ink-100 px-4 py-3 transition-all duration-200 motion-reduce:transition-none ${
        leaving === 'go' ? 'max-h-0 overflow-hidden border-0 py-0 opacity-0' : leaving === 'ready' ? 'max-h-60 overflow-hidden' : ''
      } ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3">
        <span className={`mt-1 size-3 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {titleHref ? (
            <Link href={titleHref} className="truncate text-reading font-semibold text-ink-900 hover:underline">
              {item.title}
            </Link>
          ) : (
            <span className="truncate text-reading font-semibold text-ink-900">{item.title}</span>
          )}
          <div className="flex items-center gap-2">
            <span className={`mono rounded px-2 py-1 text-meta font-semibold uppercase ${CHIP_STYLE[item.severity]}`}>
              {CHIP_WORD[branch]}
            </span>
            {item.age && <span className="mono text-meta text-ink-600">{item.age}</span>}
          </div>
          <p className="text-ui text-ink-500">{detailOf(item, branch)}</p>
          {g && (
            <OwnerReviewMeta
              ownerLabel={g.ownerUserId ? g.ownerLabel : null}
              reviewDueAt={g.reviewDueAt}
              omit={branch === 'owner' ? 'owner' : branch === 'confirm' ? 'review' : undefined}
            />
          )}
          {item.review && <OwnerReviewMeta ownerLabel={null} reviewDueAt={item.review.reviewDueAt} omit="owner" />}
          {error && (
            <p role="alert" className="text-ui text-accent-escalate">
              {error}
            </p>
          )}
        </div>
        {button}
      </div>

      {open && (
        <div id={panelId} ref={panelRef} tabIndex={-1} className="mt-3 outline-none">
          {branch === 'signoff' && item.signOff && (
            <SignOffPanel completionId={item.signOff.completionId} onDone={onDone} />
          )}
          {branch === 'approve' && g && <ApprovePanel sopId={g.id} title={item.title} onDone={onDone} />}
        </div>
      )}
    </li>
  )
}
