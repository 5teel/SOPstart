'use client'

/**
 * The phone home's floor-thumbnail sheet (D-03) -- a plain department-grouped
 * list of the site's machines, each row a link to /m/<code>. Chrome copied
 * from DepartmentBottomSheet's mobile branch (src/components/sop/
 * CategoryBottomSheet.tsx). This file renders what it is handed -- pins and
 * department colours are derived by worker-signal.ts / zoneColour and passed
 * in, never recomputed here.
 */
import Link from 'next/link'
import type { SiteDepartment, WorkerSiteMachine } from '@/lib/validators/site'

export function MachineListSheet({
  open,
  onClose,
  machines,
  departments,
  colourByDept,
  pins,
}: {
  open: boolean
  onClose(): void
  machines: WorkerSiteMachine[]
  departments: SiteDepartment[]
  colourByDept: ReadonlyMap<string, string>
  pins: ReadonlyMap<string, number>
}) {
  if (!open) return null

  const groups = departments
    .map((d) => ({ id: d.id, name: d.name, machines: machines.filter((m) => m.department_id === d.id) }))
    .filter((g) => g.machines.length > 0)

  const groupedIds = new Set(groups.flatMap((g) => g.machines.map((m) => m.id)))
  const noDept = machines.filter((m) => !groupedIds.has(m.id))

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Machines on your site"
        data-testid="machine-sheet"
        className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
      >
        <div className="mx-auto mt-3 mb-0 h-1 w-10 flex-shrink-0 rounded-full bg-[var(--ink-300)]" />

        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--ink-100)] px-4 py-4">
          <h2 className="text-base font-semibold text-[var(--ink-900)]">Machines on your site</h2>
          <button
            type="button"
            data-testid="machine-sheet-close"
            onClick={onClose}
            className="text-sm font-semibold text-[var(--ink-900)] hover:text-[var(--ink-700)]"
          >
            Done
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {groups.map((g) => (
            <MachineGroup key={g.id} name={g.name} dotColour={colourByDept.get(g.id)} machines={g.machines} pins={pins} />
          ))}
          {noDept.length > 0 && (
            <MachineGroup name="No department" dotColour="var(--ink-500)" machines={noDept} pins={pins} />
          )}
        </div>
      </div>
    </>
  )
}

function MachineGroup({
  name,
  dotColour,
  machines,
  pins,
}: {
  name: string
  dotColour: string | undefined
  machines: WorkerSiteMachine[]
  pins: ReadonlyMap<string, number>
}) {
  return (
    <div className="mb-3.5">
      <div
        data-testid="machine-sheet-group"
        data-department-name={name}
        className="mono mb-1.5 flex items-center gap-1.5 text-meta uppercase tracking-widest text-[var(--ink-500)]"
      >
        <span className="h-2 w-2 rounded-full" style={{ background: dotColour ?? 'var(--ink-500)' }} aria-hidden="true" />
        {name}
      </div>
      <div className="flex flex-col gap-1.5">
        {machines.map((m) => {
          const pin = pins.get(m.id) ?? 0
          return (
            <Link
              key={m.id}
              href={`/m/${m.code}`}
              data-testid="machine-sheet-row"
              data-machine-name={m.name}
              data-pin={pin}
              className="flex min-h-tap-glove items-center justify-between gap-3 rounded-lg border border-[var(--ink-200)] bg-[var(--paper-1)] px-4 text-reading font-semibold text-[var(--ink-900)]"
            >
              {m.name}
              {pin > 0 && (
                <span
                  data-testid="machine-sheet-pin"
                  aria-label={`${pin} to do`}
                  className="grid h-6.5 min-w-6.5 place-items-center rounded-full bg-accent-decision px-1.5 text-xs font-extrabold text-white"
                >
                  {pin}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
