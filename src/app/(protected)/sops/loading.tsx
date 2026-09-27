/**
 * Route-level skeleton for the SOP library — mirrors the toolbar (title +
 * search box) and the row list the page renders, so the RSC-fetch gap and
 * the query-loading gap look identical.
 */
export default function SopsLoading() {
  return (
    <div className="flex flex-col flex-1 bg-[var(--paper)]" aria-busy="true">
      <div className="border-b border-[var(--ink-100)]">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="h-5 w-12 rounded bg-[var(--ink-100)] animate-pulse" />
          <div className="order-last h-11 w-full rounded-lg bg-[var(--paper-2)] animate-pulse sm:order-none sm:ml-auto sm:h-9 sm:w-72" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto w-full px-4 py-4">
        <div className="flex flex-col gap-2 lg:rounded-lg lg:border lg:border-[var(--ink-300)] lg:p-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--paper-2)] animate-pulse lg:h-11 lg:rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
