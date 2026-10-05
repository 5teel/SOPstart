/**
 * Route-level skeleton for the SOP focus screen: the frame's own shape (top bar,
 * 300 px rail, reading column) so the handoff to the real screen does not shift.
 * Static under reduced motion.
 */
export default function SopFocusLoading() {
  return (
    <div className="flex h-dvh flex-col bg-paper" aria-busy="true">
      <div className="flex min-h-tap items-center gap-2 border-b border-ink-200 px-4">
        <div className="h-4 w-16 rounded bg-ink-100 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-48 rounded bg-ink-100 animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-75 shrink-0 flex-col gap-2 border-r border-ink-200 bg-paper-2 p-4 lg:flex">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-ink-100 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-205 flex-col gap-4 px-4 py-8 lg:px-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-ink-100 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  )
}
