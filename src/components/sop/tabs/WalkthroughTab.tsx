'use client'
import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SopWithSections } from '@/types/sop'
import { ImmersiveStepCard } from '@/components/sop/walkthrough/ImmersiveStepCard'
import { ViewModeToggle } from '@/components/sop/walkthrough/ViewModeToggle'
import { useWalkthroughModeStore } from '@/stores/walkthroughMode'
import { upsertWalkthroughProgress } from '@/actions/walkthrough-progress'

export function WalkthroughTab({ sop }: { sop: SopWithSections }) {
  const router = useRouter()
  const search = useSearchParams()
  const mode = useWalkthroughModeStore((s) => s.mode)

  const handleStepChange = useCallback(
    async (stepId: string) => {
      const params = new URLSearchParams(search.toString())
      params.set('step', stepId)
      router.push(`?${params.toString()}`, { scroll: false })
      // Fire-and-forget upsert (offline fallback in sync-engine)
      void upsertWalkthroughProgress({ sopId: sop.id, stepId })
    },
    [router, search, sop.id]
  )

  return (
    <div className="responsive-walkthrough-root">
      {/* Desktop-only toggle bar — hidden below 430px via CSS */}
      <div className="flex items-center justify-end px-4 py-2 hide-below-430">
        <ViewModeToggle />
      </div>

      {/* Above 430px: respect stored mode preference */}
      {mode === 'immersive' ? (
        <div className="walkthrough-list-only-above-430">
          <ImmersiveStepCard sop={sop} onStepChange={handleStepChange} />
        </div>
      ) : (
        <div className="walkthrough-list-only-above-430">
          {/* List mode placeholder — WalkthroughList requires stepsSection shape from old API;
              render a simple ordered list until the list view is adapted for SopWithSections */}
          <ol className="walkthrough-list">
            {sop.sop_sections
              .flatMap((section) => section.sop_steps ?? [])
              .map((step, idx) => (
                <li key={step.id} className="blueprint-frame">
                  <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
                    Step {idx + 1}
                  </span>
                  <p className="text-sm mt-1">{step.text}</p>
                  <button
                    type="button"
                    className="evidence-btn mt-2 text-xs"
                    onClick={() => handleStepChange(step.id)}
                  >
                    Go to step
                  </button>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* Below 430px: always render immersive, regardless of stored mode */}
      <div className="immersive-only-below-430">
        <ImmersiveStepCard sop={sop} onStepChange={handleStepChange} />
      </div>
    </div>
  )
}
