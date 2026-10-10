'use client'

/**
 * Phase 59 (OFF-01, D-01, D-03) -- the Office detail-pane body.
 *
 * Reached only through next/dynamic (the Sign-offs and People sections, and the old shells
 * until they are deleted); never imported statically, so the home route stays inside its
 * bundle gate. Phase 63: the pane knows no places -- the caller hands it the tab, the tab
 * list and an onTab callback. This file never touches the address bar, never calls the
 * router and never navigates from an effect.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { OFFICE_TABS, type OfficeTab } from '@/lib/shell/office-tabs'
import { AdminAccessLens } from '@/components/sop/lenses/AdminAccessLens'
import { DecisionsTab } from './DecisionsTab'
import { RequestsTab } from './RequestsTab'
import { InboxChips, InboxTab, inboxItemsOf, useOfficeInbox, type ChipKey } from './InboxTab'
import type { RowDone } from './InboxRow'
import { PeopleTab } from './PeopleTab'

const TAB_LABEL: Record<OfficeTab, string> = {
  inbox: 'Inbox',
  requests: 'Requests',
  decisions: 'Decisions',
  people: 'People & authority',
  access: 'SOP access',
}

const RECEIPT_MS = 10_000

type Receipt = RowDone & { tab: OfficeTab }

/** The words under the header. "logged" is said only when the ledger write succeeded. */
function receiptWords(r: RowDone): { text: string; failed: boolean } {
  if (r.logged === true) {
    return { text: `${r.receipt} · logged in the decision ledger${r.after ? `. ${r.after}` : ''}`, failed: false }
  }
  if (r.logged === false) {
    return { text: `${r.receipt}, but it didn't reach the decision ledger. Tell an admin.`, failed: true }
  }
  return { text: r.receipt, failed: false }
}

export function OfficePane({
  tab: requested,
  tabs,
  onTab,
  initialSop = null,
}: {
  tab: OfficeTab | null
  tabs: ReadonlyArray<OfficeTab>
  onTab(t: OfficeTab): void
  /** Pins the Access tab to one SOP; the page has already UUID-gated it. */
  initialSop?: string | null
}) {
  // A tab the caller did not offer resolves to the first one at render time, never by redirect.
  const tab: OfficeTab = requested && tabs.includes(requested) ? requested : (tabs[0] ?? 'inbox')

  const inbox = useOfficeInbox()
  const inboxCount = inboxItemsOf(inbox.data)?.length ?? 0
  const requestCount = inbox.data && !('error' in inbox.data) ? inbox.data.requests.length : 0
  const [chip, setChip] = useState<ChipKey>('all')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const shownReceipt = receipt && receipt.tab === tab ? { ...receiptWords(receipt), link: receipt.link } : null

  // A receipt holds for 10 s, or until the next action; a tab change hides it (it is tagged with its tab).
  // One carrying a link (`hold`) stays until the next receipt or a tab change.
  useEffect(() => {
    if (!receipt || receipt.hold) return
    const t = setTimeout(() => setReceipt(null), RECEIPT_MS)
    return () => clearTimeout(t)
  }, [receipt])

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [rove, setRove] = useState(Math.max(0, tabs.indexOf(tab)))

  // Manual activation: arrows move focus only; Enter or Space (a button click) selects.
  function onTabKey(e: React.KeyboardEvent) {
    const n = tabs.length
    let next: number
    if (e.key === 'ArrowRight') next = (rove + 1) % n
    else if (e.key === 'ArrowLeft') next = (rove - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    e.preventDefault()
    setRove(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div data-testid="room-body" data-room-id="office">
      <div data-testid="office-pane" data-tab={tab}>
        <header className="sticky top-0 z-10 border-b border-ink-200 bg-paper pl-4 pr-16 pt-4">
          {tabs.length > 1 && (
            <div
              role="tablist"
              aria-label="Tabs"
              onKeyDown={onTabKey}
              className="seg mb-3"
            >
              {OFFICE_TABS.filter((t) => tabs.includes(t)).map((t, i) => {
                const active = t === tab
                return (
                  <button
                    key={t}
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    type="button"
                    role="tab"
                    id={`office-tab-${t}`}
                    data-testid={`office-tab-${t}`}
                    aria-selected={active}
                    aria-controls="office-tabpanel"
                    tabIndex={i === rove ? 0 : -1}
                    onFocus={() => setRove(i)}
                    onClick={() => onTab(t)}
                    className="focus-visible:outline-2 focus-visible:outline-accent-step"
                  >
                    {TAB_LABEL[t]}
                    {(t === 'inbox' ? inboxCount : t === 'requests' ? requestCount : 0) > 0 && (
                      <span className={`mono text-meta ${active ? 'text-paper' : 'text-ink-600'}`}>
                        {t === 'inbox' ? inboxCount : requestCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {tab === 'inbox' && <InboxChips data={inbox.data} chip={chip} onChip={setChip} />}
          <div
            data-testid="office-receipt"
            role="status"
            aria-live="polite"
            className={`flex min-h-9 items-center gap-2 pb-2 text-ui ${
              shownReceipt?.failed ? 'text-accent-escalate' : 'text-ink-700'
            }`}
          >
            {shownReceipt && (
              <>
                {!shownReceipt.failed && <Check className="size-4 shrink-0 text-accent-ok" aria-hidden />}
                <span>{shownReceipt.text}</span>
                {shownReceipt.link && (
                  <Link
                    data-testid="office-receipt-link"
                    href={shownReceipt.link.href}
                    className="font-semibold text-ink-900 underline focus-visible:outline-2 focus-visible:outline-accent-step"
                  >
                    {shownReceipt.link.label}
                  </Link>
                )}
              </>
            )}
          </div>
        </header>

        <div id="office-tabpanel" role={tabs.length > 1 ? 'tabpanel' : undefined} className="px-4 pb-8">
          {tab === 'decisions' && <DecisionsTab />}
          {tab === 'people' && <PeopleTab onReceipt={(r) => setReceipt({ ...r, tab })} />}
          {tab === 'requests' && <RequestsTab onReceipt={(r) => setReceipt({ ...r, tab })} />}
          {tab === 'inbox' && (
            <InboxTab chip={chip} onChip={setChip} onReceipt={(r) => setReceipt({ ...r, tab })} />
          )}
          {tab === 'access' && (
            <div className="overflow-x-auto px-2 pb-8">
              <AdminAccessLens pinnedSopId={initialSop ?? undefined} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
