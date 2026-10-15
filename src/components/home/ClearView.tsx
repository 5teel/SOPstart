'use client'
/**
 * ADR-0015 -- the clear version of a SOP, read-only, beside the direct translation in Read.
 *
 * Workers reach it only once an admin has approved it. Before that, admins see it with the
 * cross-check and the open items for the document owner, and approve it here.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Lightbulb } from 'lucide-react'
import { setClearVersionApproval } from '@/actions/sops'
import { KindChip } from '@/components/focus/KindChip'
import type { ClearVersion } from '@/lib/parsers/enhance-sop'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })

export function ClearView({ sopId, clear, approvedAt, canApprove, signed }: { sopId: string; clear: ClearVersion; approvedAt: string | null; canApprove: boolean; signed: Map<string, string> }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const issues = clear.check?.issues ?? []
  const serious = issues.filter((i) => i.severity !== 'minor')

  const decide = async (approve: boolean) => {
    setBusy(true)
    setError(null)
    const r = await setClearVersionApproval({ sopId, approve, createdAt: clear.createdAt })
    setBusy(false)
    if ('error' in r) setError(r.error)
    else await qc.invalidateQueries({ queryKey: ['read-sop', sopId] })
  }

  let n = 0
  return (
    <div data-testid="clear-view" className="flex flex-col gap-2">
      {canApprove && (
        <div data-testid="clear-review" className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-1 p-4">
          {approvedAt ? (
            <p className="text-reading text-ink-900">Workers can read this clear version (approved {day(approvedAt)}).</p>
          ) : (
            <>
              <p className="text-reading font-semibold text-ink-900">Workers can&apos;t see this yet.</p>
              <p className="text-ui text-ink-700">
                It was rewritten from the document for easier reading on {day(clear.createdAt)}. Read it beside the version as written, check the
                points below, then approve it for workers.
              </p>
            </>
          )}
          {clear.check && (
            <details data-testid="clear-check" open={!approvedAt && serious.length > 0}>
              <summary className="cursor-pointer text-ui font-semibold text-ink-900">
                {issues.length === 0 ? 'Independent check: nothing changed in meaning' : `Independent check: ${issues.length} point${issues.length === 1 ? '' : 's'} to look at`}
              </summary>
              <ul className="mt-2 flex flex-col gap-2 text-ui text-ink-700">
                {issues.map((i, k) => (
                  <li key={k}>
                    <span className={`font-semibold ${i.severity === 'critical' ? 'text-accent-escalate' : 'text-ink-900'}`}>
                      {i.severity === 'critical' ? 'Could cause harm' : i.severity === 'major' ? 'Meaning changed' : 'Wording'}:
                    </span>{' '}
                    {i.note}
                    {i.clear && <span className="block text-ink-600">Clear version: “{i.clear}”</span>}
                    {i.direct && <span className="block text-ink-600">As written: “{i.direct}”</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {clear.openItems.length > 0 && (
            <details data-testid="clear-open-items">
              <summary className="cursor-pointer text-ui font-semibold text-ink-900">
                {clear.openItems.length} gap{clear.openItems.length === 1 ? '' : 's'} for the document owner
              </summary>
              <ul className="mt-2 list-disc pl-5 text-ui text-ink-700">
                {clear.openItems.map((o, k) => (
                  <li key={k}>{o}</li>
                ))}
              </ul>
            </details>
          )}
          {error && (
            <p role="alert" className="text-ui text-accent-escalate">
              {error}
            </p>
          )}
          <button
            type="button"
            data-testid={approvedAt ? 'clear-withdraw' : 'clear-approve'}
            disabled={busy}
            onClick={() => void decide(!approvedAt)}
            className={`min-h-tap-glove rounded-lg text-reading font-semibold disabled:opacity-60 lg:w-fit lg:px-8 ${approvedAt ? 'border border-ink-300 text-ink-900' : 'bg-ink-900 text-paper'}`}
          >
            {approvedAt ? 'Take it back from workers' : 'Approve for workers'}
          </button>
        </div>
      )}

      {clear.sections.map((s, si) => (
        <section key={si} data-testid="clear-section">
          <p className="section-heading flex items-center gap-2 pb-1 pt-5">
            {s.title}
            {s.type === 'hazards' && <KindChip kind="hazard" />}
            {s.type === 'ppe' && <KindChip kind="ppe" />}
          </p>
          {s.content && <p className="whitespace-pre-line py-2 text-reading text-ink-900">{s.content}</p>}
          <ol className="m-0 list-none p-0">
            {s.steps.map((t, ti) => (
              <li key={ti} data-testid="clear-step" className="flex gap-3 border-b border-ink-200 py-3">
                <span className="w-6 shrink-0 pt-1 font-label text-meta text-ink-600">{++n}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {t.warning && (
                    <p className="flex flex-wrap items-center gap-2 text-reading text-ink-900">
                      <KindChip kind="hazard" />
                      {t.warning}
                    </p>
                  )}
                  <p className="text-reading text-ink-900">{t.text}</p>
                  {t.caution && (
                    <p className="text-ui text-ink-900">
                      <span className="mr-1 font-semibold">Caution</span>
                      {t.caution}
                    </p>
                  )}
                  {t.tip && (
                    <p className="flex items-start gap-1.5 text-ui text-ink-700">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
                      <span>
                        <span className="mr-1 font-semibold">Tip</span>
                        {t.tip}
                      </span>
                    </p>
                  )}
                  {t.image_paths.flatMap((p) => (signed.has(p) ? [signed.get(p)!] : [])).map((url) => (
                    <img key={url} src={url} alt="" loading="lazy" decoding="async" className="max-h-64 w-fit max-w-full rounded-lg object-contain" />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
