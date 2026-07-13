/**
 * Generic route-level loading skeleton for every protected screen that has no
 * tailored loading.tsx of its own. Rendering this instantly on navigation is
 * what makes taps feel acknowledged while the RSC payload + server data load.
 */
export default function ProtectedLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10" aria-busy="true">
      <div className="w-48 h-6 rounded bg-[var(--ink-100)] animate-pulse mb-2" />
      <div className="w-72 h-4 rounded bg-[var(--ink-50)] animate-pulse mb-8" />
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-[var(--paper-2)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
