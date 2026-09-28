'use client'

/**
 * Phase 54 (D-02/D-03): renders the inbox the server page hands it — no
 * data fetching, no client-side navigation, no query hook of its own.
 * Governance-sourced items render through the untouched GovernanceQueueRow
 * (its own action gate owns Approve/Assign owner/Confirm current, D-03);
 * stuck/machines items render a single Retry/Add link. The empty state is
 * the goal state, not an apology (CONTEXT.md D-02 / Specific Ideas — copy
 * kept verbatim from the sketch and from AdminAttentionLens's prior CLEAR
 * copy).
 */
import { useState } from 'react'
import Link from 'next/link'
import { GovernanceQueueRow } from './GovernanceQueueRow'
import { INBOX_CHIPS, inboxCounts, chipMatches, type InboxChip, type InboxItem } from '@/lib/governance/inbox'

const SEVERITY_DOT: Record<'bad' | 'warn' | 'info' | 'grey', string> = {
  bad: 'bg-accent-escalate',
  warn: 'bg-accent-decision',
  info: 'bg-accent-measure',
  grey: 'bg-[var(--ink-300)]',
}

export function GovernanceInbox({ items }: { items: InboxItem[] }) {
  const [chip, setChip] = useState<'all' | InboxChip>('all')
  const counts = inboxCounts(items)
  const visibleChips = INBOX_CHIPS.filter((c) => c.key === 'all' || counts[c.key] > 0 || c.key === chip)
  const filtered = items.filter((item) => chipMatches(item, chip))

  return (
    <section data-testid="gov-inbox" className="rounded-lg border border-[var(--ink-300)] bg-[var(--paper-1)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 flex-wrap border-b border-[var(--ink-100)] px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[var(--ink-900)]">Inbox</h2>
          <span className="mono text-meta text-[var(--ink-500)]">{items.length} open</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleChips.map((c) => (
            <button
              key={c.key}
              type="button"
              data-testid="gov-chip"
              data-chip={c.key}
              aria-pressed={chip === c.key}
              onClick={() => setChip(c.key)}
              className={`rounded-full border px-2.5 py-1 text-xs inline-flex items-center gap-1.5 ${
                chip === c.key
                  ? 'bg-[var(--ink-900)] text-[var(--paper-1)] border-[var(--ink-900)]'
                  : 'border-[var(--ink-300)] text-[var(--ink-700)]'
              }`}
            >
              {c.label}
              <span className="mono">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      </header>

      {items.length === 0 ? (
        <div data-testid="gov-clear" className="py-16 text-center px-4">
          <p className="mono mb-2 text-meta uppercase tracking-wider text-accent-ok">CLEAR</p>
          <p className="mb-1 text-xl font-semibold text-[var(--ink-900)]">Nothing needs attention</p>
          <p className="text-sm text-[var(--ink-500)]">Every SOP is owned, current, and correctly assigned.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center px-4">
          <p className="text-sm text-[var(--ink-500)] mb-3">Nothing under this filter.</p>
          <button type="button" onClick={() => setChip('all')} className="evidence-btn !min-h-9 text-sm">
            Show all
          </button>
        </div>
      ) : (
        <ul>
          {filtered.map((item) =>
            item.gov ? (
              <GovernanceQueueRow
                key={item.key}
                row={item.gov}
                title={item.title}
                meta={item.meta}
                age={item.age}
                severity={item.severity}
              />
            ) : (
              <li
                key={item.key}
                data-testid="gov-row"
                data-kind={item.kind}
                data-severity={item.severity}
                className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2.5 border-b border-[var(--ink-100)] px-3.5 py-2.5"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--ink-900)] truncate">{item.title}</p>
                  <span className="text-meta text-[var(--ink-500)]">{item.meta}</span>
                </div>
                <span className="mono text-meta text-[var(--ink-500)]">{item.age}</span>
                {item.action && (
                  <Link data-testid="gov-action" href={item.action.href} className="evidence-btn !min-h-9 text-sm">
                    {item.action.label}
                  </Link>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </section>
  )
}
