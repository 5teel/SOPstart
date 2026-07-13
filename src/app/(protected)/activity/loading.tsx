/**
 * Route-level skeleton for the activity feed (worker + supervisor views share
 * the same list-of-completions silhouette).
 */
export default function ActivityLoading() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto" aria-busy="true">
      <div className="w-32 h-6 rounded bg-[var(--ink-100)] animate-pulse mb-6" />
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[72px] bg-[var(--paper-2)] rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
