/**
 * The detail pane with nothing selected (D-04): site name, what is on it and one
 * hint line. One small component so Phase 60 swaps exactly this file.
 */
export function SiteSummary({
  siteName,
  machines,
  published,
  drafts,
  roleLine,
}: {
  siteName: string
  machines: number
  published: number
  drafts?: number
  roleLine: string
}) {
  return (
    <div data-testid="shell-summary" className="flex flex-col gap-3 p-4 pr-16">
      <h2 className="text-lg font-semibold text-ink-900">{siteName}</h2>
      <dl className="grid grid-cols-2 gap-2 text-ui text-ink-900">
        <div className="rounded-lg border border-ink-200 p-3">
          <dt className="mono text-micro uppercase tracking-wide text-ink-500">Machines</dt>
          <dd className="text-lg font-semibold">{machines}</dd>
        </div>
        <div className="rounded-lg border border-ink-200 p-3">
          <dt className="mono text-micro uppercase tracking-wide text-ink-500">Published SOPs</dt>
          <dd className="text-lg font-semibold">{published}</dd>
        </div>
        {drafts !== undefined && (
          <div className="rounded-lg border border-ink-200 p-3">
            <dt className="mono text-micro uppercase tracking-wide text-ink-500">Drafts</dt>
            <dd className="text-lg font-semibold">{drafts}</dd>
          </div>
        )}
      </dl>
      <p className="text-ui text-ink-900">{roleLine}</p>
      <p className="text-ui text-ink-500">Select a place on the site or in the list</p>
    </div>
  )
}
