'use client'

/**
 * AI drafting surface — the typed brief only (voice drafting was cut in
 * Phase 55). Kept as a thin wrapper so page.tsx and its `departments` prop
 * are unchanged. The brief feeds the /api/sops/ai-prompt pipeline and the
 * builder hand-off.
 */
import { PromptClient } from './PromptClient'
import type { Department } from '@/types/sop'

export function AiDraftFork({ departments }: { departments: Department[] }) {
  return (
    // The "describe the procedure…" line lives on the prompt field itself in
    // PromptClient — it describes that one input.
    <div className="blueprint-frame">
      <PromptClient departments={departments} />
    </div>
  )
}
