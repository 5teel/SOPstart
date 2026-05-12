'use client'
import { Mic } from 'lucide-react'

/**
 * Phase 15 — floating mic-pill button (D-14).
 *
 * Fixed bottom-right on both Mobile and Desktop walkthrough variants
 * (mounted at WalkthroughSwitcher level so a single instance serves
 * both). `env(safe-area-inset-bottom)` keeps the pill above the iPhone
 * notch / Android system gesture bar.
 *
 * a11y: button text + `aria-label` are explicit ("Ask a question…");
 * focus ring uses the brand decision accent so it's visible on the
 * dark fill.
 */
interface Props {
  onOpen: () => void
}

export function WalkthroughVoiceButton({ onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ask a question about this SOP"
      data-testid="voice-mic"
      className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[var(--ink-900)] text-[var(--paper)] px-5 py-3 shadow-lg hover:bg-[var(--ink-700)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-decision)]"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <Mic className="h-5 w-5" />
      <span className="text-sm font-medium">Ask</span>
    </button>
  )
}
