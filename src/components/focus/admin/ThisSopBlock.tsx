'use client'

/**
 * Phase 58 (58-12) -- "This SOP", pinned under the editor rail (D-08, D-14, D-20,
 * D-24): version and earlier versions, machine, objective, standards, the
 * jump-ahead switch, then Ask someone to do this, Delete draft, Category and the original document.
 *
 * Every row writes through its own guarded action; nothing here decides access.
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { setAllowForwardJump } from '@/actions/focus-steps'
import { confirmSopCurrent } from '@/actions/governance'
import { DeleteSopButton } from '@/components/admin/DeleteSopButton'
import { OwnerPicker } from '@/components/admin/governance/OwnerPicker'
import { CategoryButton } from '@/components/focus/admin/CategoryButton'
import { versionLine } from '@/components/focus/admin/EditDocument'
import { MachinesButton } from '@/components/focus/admin/MachinesButton'
import { StandardsButton } from '@/components/focus/admin/StandardsButton'
import { ObjectiveLine } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { useFocusLineage, useFocusSop } from '@/hooks/useFocusSop'
import { reviewSegment } from '@/lib/office/format'
import { focusHref } from '@/lib/sop/focus-path'
import type { EditorOwner, FocusSop } from '@/lib/sop/focus-read'

export interface ThisSopBlockProps {
  sopId: string
  initial: FocusSop
  from: string | null
  /** Admins and safety managers: the jump-ahead switch, Ask someone to do this, Delete draft and Category. */
  isAdmin: boolean
  /** Who owns the SOP and whether this viewer can mark it reviewed; null hides both rows. */
  owner: EditorOwner | null
}

// Ask someone to do this: a lazy module (60 A-07), published SOPs only (D-06).
const AskTrigger = dynamic(() => import('@/components/requests/AskPicker').then((m) => m.AskTrigger), {
  ssr: false,
  loading: () => null,
})

const label = 'mono text-meta uppercase text-ink-500'
const rowButton =
  'flex min-h-tap w-full items-center rounded px-2 text-left text-ui text-ink-900 hover:bg-paper-1'

export function ThisSopBlock({ sopId, initial, from, isAdmin, owner }: ThisSopBlockProps) {
  const { focus, invalidate } = useFocusSop(sopId, initial)
  const lineage = useFocusLineage(sopId)
  const { sop, machines, standards, objective } = focus
  const isDraft = sop.status === 'draft'

  const [open, setOpen] = useState(true)
  const [showVersions, setShowVersions] = useState(false)
  const [jump, setJump] = useState(sop.allow_forward_jump)
  const [error, setError] = useState<string | null>(null)
  const [ownerLabel, setOwnerLabel] = useState(owner?.label ?? null)
  const [hasOwner, setHasOwner] = useState(!!sop.owner_user_id)
  const [reviewDueAt, setReviewDueAt] = useState(sop.review_due_at)
  const [ownerReceipt, setOwnerReceipt] = useState<string | null>(null)
  const [reviewReceipt, setReviewReceipt] = useState<{ text: string; bad: boolean } | null>(null)
  const [marking, setMarking] = useState(false)
  const review = reviewSegment(reviewDueAt)

  const earlier = lineage.filter((v) => v.version < sop.version)
  const machineName = machines.length > 0 ? machines.map((m) => m.name).join(', ') : 'Whole site'
  const summary = `v${sop.version} · ${machineName} · ${standards.sop.length} ${standards.sop.length === 1 ? 'standard' : 'standards'}`

  async function markReviewed() {
    setMarking(true)
    setError(null)
    try {
      const res = await confirmSopCurrent(sopId)
      if ('error' in res) return setError(res.error)
      setReviewDueAt(res.reviewDueAt)
      setReviewReceipt(
        res.logged
          ? { text: 'Marked reviewed · logged in the decision ledger', bad: false }
          : { text: "Marked reviewed, but it didn't reach the decision ledger. Tell an admin.", bad: true },
      )
    } catch {
      // 59 review WR-03: a thrown action must not leave the button disabled with no message.
      setError("That didn't work. Nothing was changed — try again.")
    } finally {
      setMarking(false)
    }
  }

  async function toggleJump(allow: boolean) {
    setJump(allow)
    setError(null)
    const res = await setAllowForwardJump({ sopId, allow })
    if ('error' in res) {
      setJump(!allow)
      setError(res.error)
    }
  }

  async function openOriginal() {
    // Open the tab inside the click, then point it at the signed address.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const res = await fetch(`/api/sops/${sopId}/download-url`)
      const body = (await res.json()) as { url?: string | null }
      if (!body.url) throw new Error('none')
      if (tab) tab.location.href = body.url
    } catch {
      tab?.close()
      setError("Couldn't open the original document.")
    }
  }

  return (
    <section data-testid="this-sop" aria-label="This SOP" className="flex flex-col px-2 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-tap items-center gap-2 px-2 text-left"
      >
        {open ? <ChevronDown className="size-4 text-ink-500" aria-hidden="true" /> : <ChevronRight className="size-4 text-ink-500" aria-hidden="true" />}
        <span className={label}>This SOP</span>
        {!open && <span className="min-w-0 flex-1 truncate text-ui text-ink-700">{summary}</span>}
      </button>

      {open && (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex flex-col gap-1 px-2">
            <span className={label}>Version</span>
            <p className="text-ui text-ink-900" data-testid="this-sop-version">
              {versionLine(sop, lineage)}
            </p>
            {earlier.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={showVersions}
                  onClick={() => setShowVersions((v) => !v)}
                  className="min-h-tap self-start text-left text-ui text-ink-500 hover:text-accent-step"
                >
                  {earlier.length} earlier {earlier.length === 1 ? 'version' : 'versions'}
                </button>
                {showVersions && (
                  <ul className="flex flex-col">
                    {earlier.map((v) => (
                      <li key={v.id}>
                        <Link
                          href={focusHref(v.id, { from })}
                          data-testid="this-sop-earlier"
                          className="flex min-h-tap items-center text-ui text-ink-700 hover:text-accent-step"
                        >
                          v{v.version}
                          {v.state === 'live' ? ' · live' : ''}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {owner && (
            <div className="flex flex-col gap-1 px-2" data-testid="this-sop-owner">
              <span className={label}>Owner</span>
              <div className="flex min-h-tap items-center gap-2">
                {hasOwner ? (
                  <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{ownerLabel ?? 'someone who has left'}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-accent-decision/10 px-2 py-1 text-ui font-semibold text-ink-900">
                    <AlertTriangle className="size-3 text-accent-decision" aria-hidden="true" />
                    No owner
                  </span>
                )}
                {isAdmin && (
                  <OwnerPicker
                    sopId={sopId}
                    ownerUserId={hasOwner ? (sop.owner_user_id ?? 'set') : null}
                    ownerLabel={hasOwner ? (ownerLabel ?? 'someone who has left') : 'No owner'}
                    onDone={(r) => {
                      setOwnerLabel(r.ownerLabel)
                      setHasOwner(r.ownerLabel !== null)
                      setOwnerReceipt(r.logged ? 'Owner set · logged in the decision ledger' : "Owner set, but it didn't reach the decision ledger. Tell an admin.")
                      void invalidate()
                    }}
                  />
                )}
              </div>
              {ownerReceipt && (
                <p data-testid="this-sop-owner-receipt" className="text-ui text-ink-500">
                  {ownerReceipt}
                </p>
              )}
            </div>
          )}

          {owner && (
            <div className="flex flex-col gap-1 px-2" data-testid="this-sop-review">
              <span className={label}>Review</span>
              <p className="text-ui text-ink-900">
                {review.state === 'overdue' ? (
                  <>
                    {review.lead}
                    <span className="font-semibold text-accent-escalate">{review.date}</span>
                  </>
                ) : (
                  review.text
                )}
              </p>
              {owner.canMarkReviewed && (
                <button
                  type="button"
                  disabled={marking}
                  onClick={() => void markReviewed()}
                  className="min-h-tap w-full rounded-lg border border-ink-300 bg-paper-1 text-ui font-semibold text-ink-900"
                >
                  {marking ? 'Marking…' : 'Mark reviewed'}
                </button>
              )}
              {reviewReceipt && (
                <p data-testid="this-sop-review-receipt" className={`text-ui ${reviewReceipt.bad ? 'text-accent-escalate' : 'text-ink-500'}`}>
                  {reviewReceipt.text}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 px-2">
            <span className={label}>Machine</span>
            <MachinesButton
              sopId={sopId}
              trigger={(openPicker) => (
                <button type="button" onClick={openPicker} className={rowButton}>
                  {machineName}
                </button>
              )}
            />
          </div>

          <div className="flex flex-col gap-1 px-2">
            <span className={label}>Objective</span>
            {isAdmin ? (
              <ObjectiveSlot
                subject={{ type: 'sop', id: sop.parent_sop_id ?? sop.id }}
                current={objective}
                emptyLabel="Set an objective"
                emptyStyle="dashed"
                onChanged={() => void invalidate()}
              />
            ) : (
              objective && <ObjectiveLine view={objective} />
            )}
          </div>

          <div className="flex flex-col gap-1 px-2">
            <span className={label}>Standards</span>
            <div className="flex flex-wrap items-center gap-2">
              <StandardLabels names={standards.sop.map((s) => s.name)} />
              <StandardsButton
                sopId={sopId}
                target={{ kind: 'sop', id: sopId }}
                onChanged={() => void invalidate()}
                trigger={(openPanel) => (
                  <button type="button" onClick={openPanel} className="min-h-tap rounded px-2 text-ui text-ink-500 hover:text-accent-step">
                    + Standard
                  </button>
                )}
              />
            </div>
          </div>

          {isAdmin && (
            <label className="flex flex-col gap-1 px-2">
              <span className="flex min-h-tap items-center gap-2 text-ui text-ink-900">
                <input
                  type="checkbox"
                  role="switch"
                  data-testid="this-sop-jump-ahead"
                  checked={jump}
                  disabled={!isDraft}
                  onChange={(e) => void toggleJump(e.target.checked)}
                />
                Let workers jump ahead
              </span>
              <span className="text-ui text-ink-500">
                Off: workers go back only, in order. On: they can open any step, but every hazard, PPE and photo is still needed before sending.
              </span>
            </label>
          )}

          <div className="flex flex-col border-t border-ink-200 pt-2">
            {isAdmin && sop.status === 'published' && (
              <AskTrigger sopId={sopId} sopTitle={sop.title ?? 'this SOP'} variant="rail" align="start" />
            )}
            {isAdmin && (
              <CategoryButton
                sopId={sopId}
                categorySlug={sop.category_slug}
                trigger={(openCategory) => (
                  <button type="button" onClick={openCategory} className={rowButton}>
                    Category
                  </button>
                )}
              />
            )}
            {sop.source_file_path && (
              <button type="button" onClick={() => void openOriginal()} className={rowButton}>
                Open original document
              </button>
            )}
            {isAdmin && isDraft && (
              <div className="px-2">
                <DeleteSopButton sopId={sopId} redirectTo="/?s=manage" showLabel label="Delete draft" />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="px-2 text-ui text-accent-escalate">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
