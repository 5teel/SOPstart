/**
 * The supervisor / admin card that leads the list (D-06, D-16): one number and
 * a way into the Office. The number is handed in -- the same value the Office
 * pin shows -- so this card never counts anything itself.
 */
export function OfficeCard({ count, label, onOpen }: { count: number; label: string; onOpen(): void }) {
  return (
    <section
      data-testid="shell-office-card"
      aria-label="Waiting for you"
      className="m-3 rounded-lg border border-ink-900 bg-white p-3.5"
    >
      <div className="flex items-baseline gap-2">
        <span data-testid="shell-office-count" className="text-2xl font-semibold text-ink-900">
          {count}
        </span>
        <span className="text-ui text-ink-900">{label}</span>
      </div>
      <button
        type="button"
        data-testid="shell-office-open"
        onClick={onOpen}
        className="mt-2.5 flex min-h-tap w-full items-center justify-center rounded-lg bg-ink-900 px-4 text-ui font-semibold text-white"
      >
        Open the Office
      </button>
    </section>
  )
}
