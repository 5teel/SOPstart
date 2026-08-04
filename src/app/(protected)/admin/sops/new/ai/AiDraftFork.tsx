'use client'

/**
 * Unified AI drafting surface — one page, two ways in:
 *   - Type a brief (the original prompt form)
 *   - Talk it through (conversational voice interviewer)
 * Both feed the same /api/sops/ai-prompt pipeline and builder hand-off.
 *
 * This replaced AiDraftTabs, which let you switch between the two at any time.
 * Switching unmounted one client and mounted the other, silently discarding
 * everything drafted so far — a typed brief, or a whole voice conversation.
 * The choice is therefore made ONCE, up front, in a modal you must answer, and
 * there is no switcher afterwards. To change your mind, go back to the method
 * picker and start again — which makes the loss explicit instead of surprising.
 *
 * ?mode=type / ?mode=voice still skip the modal so nav buttons and deep links
 * keep working. The chosen mode is written back to the URL with replaceState
 * (not router.push — a search-param push triggers an RSC fetch through the
 * service worker, CLAUDE.md [2026-05-13]) so a refresh does not re-ask.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Keyboard, Mic } from 'lucide-react'
import { PromptClient } from './PromptClient'
import { VoiceDraftClient } from './VoiceDraftClient'
import type { Department } from '@/types/sop'

type Mode = 'type' | 'voice'

const PICKER_ROUTE = '/admin/sops/new'

function readInitialMode(param: string | null): Mode | null {
  if (param === 'voice') return 'voice'
  if (param === 'type') return 'type'
  return null
}

const OPTIONS: {
  mode: Mode
  icon: typeof Keyboard
  title: string
  description: string
}[] = [
  {
    mode: 'type',
    icon: Keyboard,
    title: 'Type a brief',
    description:
      'Describe the procedure in a sentence or two. Best when you already know the steps and want a fast first draft.',
  },
  {
    mode: 'voice',
    icon: Mic,
    title: 'Talk it through',
    description:
      'Say it out loud and answer follow-up questions. Best when you are on the floor, or working it out as you go.',
  },
]

export function AiDraftFork({ departments }: { departments: Department[] }) {
  const search = useSearchParams()
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(() => readInitialMode(search.get('mode')))
  const firstOptionRef = useRef<HTMLButtonElement>(null)

  const choose = useCallback((next: Mode) => {
    setMode(next)
    // Keep the URL honest so a refresh resumes the same surface instead of
    // re-opening the fork. replaceState, not push — no RSC round-trip.
    const url = new URL(window.location.href)
    url.searchParams.set('mode', next)
    window.history.replaceState(null, '', url.toString())
  }, [])

  // The modal must be answered, but it must not trap a keyboard user with no
  // way out: Escape leaves the way the visible link does — back to the picker.
  useEffect(() => {
    if (mode !== null) return
    firstOptionRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push(PICKER_ROUTE)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, router])

  if (mode === null) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-fork-heading"
        data-testid="ai-draft-fork"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div className="w-full max-w-2xl rounded-md border border-[var(--ink-300)] bg-[var(--paper-1,#fff)] p-6 shadow-lg">
          <h2
            id="ai-fork-heading"
            className="mono text-lg font-semibold text-[var(--ink-900)]"
          >
            How do you want to draft it?
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-500)]">
            Pick one to start. You can&rsquo;t switch part-way through — that would
            discard the draft — so choose the one that suits how you work.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {OPTIONS.map((o, i) => {
              const Icon = o.icon
              return (
                <button
                  key={o.mode}
                  ref={i === 0 ? firstOptionRef : undefined}
                  type="button"
                  onClick={() => choose(o.mode)}
                  data-testid={`ai-draft-fork-${o.mode}`}
                  className="blueprint-frame block cursor-pointer text-left transition-shadow hover:shadow-[0_0_0_1px_var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
                >
                  <Icon size={18} className="mb-2 text-[var(--ink-900)]" aria-hidden="true" />
                  <h3 className="mb-1 text-base font-semibold text-[var(--ink-900)]">{o.title}</h3>
                  <p className="text-sm text-[var(--ink-500)]">{o.description}</p>
                </button>
              )
            })}
          </div>

          <a
            href={PICKER_ROUTE}
            className="mt-5 inline-block text-sm text-[var(--ink-500)] underline hover:text-[var(--ink-900)]"
          >
            ← Back to all the ways to create a SOP
          </a>
        </div>
      </div>
    )
  }

  return mode === 'type' ? (
    // The "describe the procedure…" line lives on the prompt field itself in
    // PromptClient, not up here — it describes that one input, and the setup
    // fields now sit above it.
    <div className="blueprint-frame">
      <PromptClient departments={departments} />
    </div>
  ) : (
    <div className="blueprint-frame">
      <p className="text-sm text-[var(--ink-500)]">
        Describe the procedure out loud. The assistant asks follow-up questions, builds a brief
        as you go, and drafts the SOP when you&apos;re ready.
      </p>
      <VoiceDraftClient departments={departments} />
    </div>
  )
}
