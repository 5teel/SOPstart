/**
 * Route-level skeleton for the SOP detail surface. Byte-matches the client
 * component's own isLoading skeleton (page.tsx) so the handoff from
 * RSC-navigation fallback → query-loading state is visually seamless.
 */
export default function SopDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)]" aria-busy="true">
      <div className="sticky top-0 z-10 bg-[var(--paper)]/95 border-b border-[var(--ink-100)] px-4 flex items-center gap-3 h-[56px]">
        <div className="w-16 h-4 rounded bg-[var(--ink-100)] animate-pulse" />
        <div className="flex-1 h-4 rounded bg-[var(--ink-100)] animate-pulse max-w-[200px]" />
      </div>
      <div className="h-[48px] bg-[var(--paper)] border-b border-[var(--ink-100)] flex items-center px-4 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-16 h-3 rounded bg-[var(--ink-100)] animate-pulse" />
        ))}
      </div>
      <div className="p-8 flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--ink-50)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
