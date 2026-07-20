import { listObservationsForWorker, getObservationLabels } from '@/actions/observations'
import { ObservationRow } from '@/components/observations/ObservationRow'

// OBS-02 — worker-facing "Observations about you" section, additive below
// the Account section + OrgSwitcher on /profile (see ProfilePage). Fully
// read-only: no edit/delete/hide control exists (append-only, D-08).
export async function ObservationsSection() {
  const [observations, labels] = await Promise.all([
    listObservationsForWorker(),
    getObservationLabels(),
  ])

  return (
    <div className="blueprint-frame p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ink-100)]">
        <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider">
          Observations about you
        </h2>
        <span className="pill text-[var(--ink-500)]">
          {observations.length} {observations.length === 1 ? 'RECORD' : 'RECORDS'}
        </span>
      </div>

      <div
        className="px-5 py-3 border-b border-[var(--ink-100)] text-sm text-[var(--ink-700)] leading-relaxed"
        style={{ background: 'color-mix(in srgb, var(--accent-decision) 6%, white)' }}
      >
        These are records your supervisors made after watching you work — they&apos;re part of your
        training evidence, and they&apos;re yours to see. Nothing here is hidden from you.
      </div>

      {observations.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--ink-500)]">No observations yet.</p>
      ) : (
        <div>
          {observations.map((o) => (
            <ObservationRow
              key={o.id}
              sopTitle={o.sopTitle}
              sopVersion={o.sopVersion}
              verdict={o.verdict}
              note={o.note}
              observerName={o.observerName}
              createdAt={o.createdAt}
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  )
}
