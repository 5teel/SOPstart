'use client'

import { AlertTriangle } from 'lucide-react'
import type { VerificationFlag } from '@/types/sop'

interface MissingSectionWarningBannerProps {
  flags: VerificationFlag[]
  acknowledged: boolean
  onAcknowledgeChange: (checked: boolean) => void
}

export default function MissingSectionWarningBanner({
  flags,
  acknowledged,
  onAcknowledgeChange,
}: MissingSectionWarningBannerProps) {
  // Only show missing-section flags (from detectMissingSections)
  const missingFlags = flags.filter(
    (f) =>
      (f.section_title === 'Hazards' || f.section_title === 'PPE') &&
      f.original_text === '(not found in transcript)'
  )

  if (missingFlags.length === 0) return null

  // Build warning text
  const missingHazards = missingFlags.some((f) => f.section_title === 'Hazards')
  const missingPPE = missingFlags.some((f) => f.section_title === 'PPE')
  let warningText = 'Warning: No '
  if (missingHazards && missingPPE) {
    warningText += 'hazards or PPE section'
  } else if (missingHazards) {
    warningText += 'hazards section'
  } else {
    warningText += 'PPE section'
  }
  warningText += ' detected in this SOP.'

  return (
    <div className="bg-[var(--accent-voice)]/20 border border-[var(--accent-voice)]/50 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-[var(--accent-voice)] shrink-0" />
        <span className="text-sm font-semibold text-[var(--accent-voice)]">
          {warningText}
        </span>
      </div>

      <label
        htmlFor="missing-section-ack"
        className="flex items-center gap-2 mt-2 text-xs text-[var(--ink-500)] cursor-pointer"
      >
        <input
          id="missing-section-ack"
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgeChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--ink-900)]"
          aria-required="true"
        />
        I understand — publish anyway
      </label>
    </div>
  )
}
