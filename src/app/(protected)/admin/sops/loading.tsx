/**
 * Route-level skeleton for the admin SOP library — header, tab strip, and the
 * one-line rows (UX-06) so the layout doesn't jump when real content lands.
 */
export default function AdminSopsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10" aria-busy="true">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="w-40 h-6 rounded bg-[var(--ink-100)] animate-pulse mb-2" />
          <div className="w-64 h-4 rounded bg-[var(--ink-50)] animate-pulse" />
        </div>
        <div className="w-28 h-10 rounded bg-[var(--paper-2)] animate-pulse" />
      </div>
      <div className="flex gap-1 border-b border-[var(--ink-100)] mb-6 pb-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-20 h-6 rounded bg-[var(--ink-50)] animate-pulse" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--paper-2)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
