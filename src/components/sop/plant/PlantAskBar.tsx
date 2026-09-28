'use client'

/**
 * The on-scene ask bar (D-13) -- the page's one search query, relocated
 * onto the plant scene, plus a mic that opens the EXISTING voice Q&A. No
 * second search input, no new voice path: the mic loads
 * `WalkthroughVoiceModal` the same way `WalkthroughSwitcher.tsx` already
 * does (`next/dynamic({ ssr: false })`), and Next dedupes the chunk so it
 * still never reaches `/sops`'s base bundle.
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Mic, Search, X } from 'lucide-react'

const WalkthroughVoiceModal = dynamic(
  () =>
    import('@/components/sop/voice/WalkthroughVoiceModal').then((m) => ({
      default: m.WalkthroughVoiceModal,
    })),
  { ssr: false, loading: () => null }
)

// ponytail: voice "next"/"back" have no walkthrough to drive from the home
// screen -- questions still work, navigation intents are just no-ops here.
const NOOP = () => {}

export function PlantAskBar({
  value,
  onChange,
  voiceSopId,
}: {
  value: string
  onChange(v: string): void
  voiceSopId: string | null
}) {
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <>
      <div className="pointer-events-auto flex h-12 max-w-140 flex-1 items-center gap-2.5 rounded-lg border border-[var(--ink-300)] bg-white/96 px-3 shadow">
        <label className="flex flex-1 items-center gap-2.5">
          <Search size={16} className="pointer-events-none text-[var(--ink-500)]" aria-hidden="true" />
          <input
            data-testid="plant-ask"
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask or search… a machine or a procedure"
            aria-label="Ask or search SOPs"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-reading text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-500)] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="grid h-8 w-8 place-items-center rounded text-[var(--ink-500)] hover:text-[var(--ink-900)]"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          data-testid="plant-ask-mic"
          aria-label="Ask by voice"
          disabled={!voiceSopId}
          title={voiceSopId ? undefined : 'Nothing to ask about yet'}
          onClick={() => setVoiceOpen(true)}
          className="grid h-8.5 w-8.5 place-items-center rounded-full bg-[var(--ink-900)] text-white disabled:opacity-40"
        >
          <Mic size={15} />
        </button>
      </div>

      {voiceOpen && voiceSopId && (
        <WalkthroughVoiceModal
          sopId={voiceSopId}
          onClose={() => setVoiceOpen(false)}
          onVoiceNext={NOOP}
          onVoicePrev={NOOP}
          currentStepText=""
        />
      )}
    </>
  )
}
