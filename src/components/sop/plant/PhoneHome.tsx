'use client'

/**
 * The phone home (D-01, D-02) -- loaded only via next/dynamic({ ssr:false })
 * from src/app/(protected)/sops/page.tsx, below 1024px, for a worker (or an
 * admin on a phone -- an admin on a phone is a worker) whose org has a
 * drawn site. Composition only, same discipline as PlantHome: every count
 * and ordering comes from worker-signal.ts. The floor picture is a door to
 * a plain list of machines, never a map to move around -- there is no pan,
 * no zoom and no camera here (D-03); tapping it opens MachineListSheet.
 */
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ScanLine } from 'lucide-react'
import { NowCard } from '@/components/sop/plant/NowCard'
import { PlantAskBar } from '@/components/sop/plant/PlantAskBar'
import { MachineListSheet } from '@/components/sop/plant/MachineListSheet'
import { derivePlantPins, pickNowQueue, type WorkerSop } from '@/lib/sop/worker-signal'
import { zoneColour } from '@/lib/site/scene'
import type { WorkerSiteData } from '@/lib/validators/site'

// The scanner and its decoder never enter this page's base bundle (D-09) --
// this is the only place ScanSheet is referenced, and it is loaded lazily.
const ScanSheet = dynamic(() => import('@/components/sop/plant/ScanSheet').then((m) => m.ScanSheet), {
  ssr: false,
})

export function PhoneHome({
  site,
  sops,
  loading,
  query,
  onQueryChange,
}: {
  site: WorkerSiteData
  sops: WorkerSop[]
  loading: boolean
  query: string
  onQueryChange(q: string): void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const { pins, nowItems, colourByDept } = useMemo(() => {
    const sopsById = new Map(sops.map((s) => [s.id, s]))
    return {
      pins: derivePlantPins(site.machines, site.links, sopsById),
      nowItems: pickNowQueue(sops, site.links, site.machines, site.departments, 3),
      colourByDept: new Map(site.departments.map((d, i) => [d.id, zoneColour(d, i)])),
    }
  }, [site, sops])

  if (!site.layout) return null
  const layout = site.layout

  return (
    <section data-testid="phone-home" aria-label="Your site" className="mb-4 flex flex-col gap-3">
      <PlantAskBar value={query} onChange={onQueryChange} voiceSopId={nowItems[0]?.sop.id ?? null} />

      {!loading && <NowCard items={nowItems} inline />}

      <button
        type="button"
        data-testid="phone-thumb"
        aria-label="Show the machines on your site"
        onClick={() => setSheetOpen(true)}
        className="relative block h-37.5 w-full overflow-hidden rounded-lg border border-[var(--ink-200)] bg-[var(--paper-2)]"
      >
        <img src={layout.sceneUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <span className="mono absolute left-2 top-2 rounded bg-white px-1.5 py-0.5 text-micro">
          Your site · tap to open
        </span>
      </button>

      <button
        type="button"
        data-testid="phone-scan"
        onClick={() => setScanOpen(true)}
        className="flex min-h-tap-glove w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink-900)] text-base font-semibold text-white"
      >
        <ScanLine className="h-5 w-5" aria-hidden="true" />
        Scan a machine plate
      </button>

      <h2 className="mono mt-1 text-meta uppercase tracking-widest text-[var(--ink-500)]">Everything else</h2>

      <MachineListSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        machines={site.machines}
        departments={site.departments}
        colourByDept={colourByDept}
        pins={pins}
      />

      {scanOpen && <ScanSheet onClose={() => setScanOpen(false)} />}
    </section>
  )
}
