/**
 * Route-level skeleton for the worker SOP library — mirrors the card list the
 * page renders (same h-[88px] rounded-xl cards as its client-side loading
 * state) so the RSC-fetch gap and the query-loading gap look identical.
 */
export default function SopsLoading() {
  return (
    <div className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full" aria-busy="true">
      <div className="flex items-center justify-between mb-4">
        <div className="w-32 h-5 rounded bg-[var(--ink-100)] animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-[var(--paper-2)] animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-[88px] bg-[var(--paper-2)] rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
