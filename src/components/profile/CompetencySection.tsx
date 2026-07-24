import { getMyCompetencyStates } from '@/actions/competency'
import { StatePill } from '@/components/admin/competency/StatePill'

// CMP-01/D-04 — worker-facing "My competency" section, additive below
// ObservationsSection on /profile. Self-scoped (getMyCompetencyStates),
// read-only, informational: no lock icon, no disabled control, no
// "you can't do this yet" copy anywhere here (CMP-04 locked north star,
// guarded mechanically by tests/phase35/no-competency-gate.spec.ts).
export async function CompetencySection() {
  const states = await getMyCompetencyStates()

  return (
    <div className="blueprint-frame p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ink-100)]">
        <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider">
          Your training
        </h2>
        <span className="pill text-[var(--ink-500)]">
          {states.length} {states.length === 1 ? 'SOP' : 'SOPS'}
        </span>
      </div>

      <div
        className="px-5 py-3 border-b border-[var(--ink-100)] text-sm text-[var(--ink-700)] leading-relaxed"
        style={{ background: 'color-mix(in srgb, var(--accent-decision) 6%, white)' }}
      >
        These show where you&apos;re up to on the SOPs you&apos;re trained on — they&apos;re yours
        to see, and they never lock anything.
      </div>

      {states.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--ink-500)]">No required SOPs yet.</p>
      ) : (
        <div>
          {states.map((s) => (
            <div
              key={s.sopId}
              className="flex items-center justify-between px-5 py-3 border-b border-[var(--ink-100)] last:border-b-0"
            >
              <span className="text-sm text-[var(--ink-900)]">{s.sopTitle}</span>
              <StatePill result={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
