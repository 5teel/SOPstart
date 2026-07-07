'use client'

/**
 * Unified AI drafting surface — one page, two ways in:
 *   - Type a brief (the original prompt form)
 *   - Talk it through (conversational voice interviewer)
 * Both feed the same /api/sops/ai-prompt pipeline and builder hand-off.
 * Initial mode comes from ?mode=voice so deep links / nav buttons can target it.
 */
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Keyboard, Mic } from 'lucide-react'
import { PromptClient } from './PromptClient'
import { VoiceDraftClient } from './VoiceDraftClient'
import type { Department } from '@/types/sop'

type Mode = 'type' | 'voice'

export function AiDraftTabs({
  categories,
  departments,
}: {
  categories: string[]
  departments: Department[]
}) {
  const search = useSearchParams()
  const [mode, setMode] = useState<Mode>(search.get('mode') === 'voice' ? 'voice' : 'type')

  return (
    <div>
      <div role="tablist" aria-label="Drafting mode" className="flex gap-1 border-b border-[var(--ink-100)] mb-6">
        <button
          role="tab"
          aria-selected={mode === 'type'}
          onClick={() => setMode('type')}
          className="tab flex items-center gap-2"
          data-active={mode === 'type' ? 'true' : undefined}
        >
          <Keyboard size={14} /> Type a brief
        </button>
        <button
          role="tab"
          aria-selected={mode === 'voice'}
          onClick={() => setMode('voice')}
          className="tab flex items-center gap-2"
          data-active={mode === 'voice' ? 'true' : undefined}
        >
          <Mic size={14} /> Talk it through
        </button>
      </div>

      {mode === 'type' ? (
        <div className="blueprint-frame">
          <p className="text-sm text-[var(--ink-500)] mb-5">
            Describe the procedure in a sentence or two — AI drafts structured sections, steps,
            hazards and PPE for you to review in the builder.
          </p>
          <PromptClient categories={categories} departments={departments} />
        </div>
      ) : (
        <div className="blueprint-frame">
          <p className="text-sm text-[var(--ink-500)]">
            Describe the procedure out loud. The assistant asks follow-up questions, builds a brief
            as you go, and drafts the SOP when you&apos;re ready.
          </p>
          <VoiceDraftClient departments={departments} />
        </div>
      )}
    </div>
  )
}
