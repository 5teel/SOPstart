'use client'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import type { SopWithSections } from '@/types/sop'

interface CommandPaletteProps {
  sop: SopWithSections
  open: boolean
  onClose: () => void
}

export function CommandPalette({ sop, open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleAskAI = useCallback(async () => {
    if (!aiQuery.trim()) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setAiLoading(true)
    setAiResponse(null)
    setAiError(null)
    try {
      const res = await fetch(`/api/sops/${sop.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery, sopId: sop.id }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) { setAiError('Request failed'); setAiLoading(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAiResponse(text)
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') setAiError('Request failed')
    } finally {
      setAiLoading(false)
    }
  }, [aiQuery, sop.id])

  if (!open) return null

  const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps)

  const toolsHazardSections = sop.sop_sections.filter((s) =>
    ['hazard', 'ppe', 'tools', 'zone', 'emergency'].some((t) =>
      s.section_type?.toLowerCase().includes(t)
    ) || s.sop_steps.some((st) => st.warning ?? st.caution)
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl mx-4 bg-[var(--paper)] rounded-2xl shadow-2xl border border-[var(--ink-200,#e4e4e7)] overflow-hidden">
        <Command label="SOP Command Palette">
          <Command.Input
            placeholder="Search steps, ask a question, or find tools & hazards…"
            className="w-full px-4 py-3 text-base bg-transparent border-b border-[var(--ink-100,#e4e4e7)] outline-none text-[var(--ink-900)] placeholder:text-[var(--ink-400,#a1a1aa)]"
          />
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Group heading="JUMP TO STEP" className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-400,#a1a1aa)] px-2 pt-2 pb-1">
              {allSteps.slice(0, 20).map((step) => (
                <Command.Item
                  key={step.id}
                  value={`step-${step.id}-${step.text}`}
                  onSelect={() => {
                    router.push(`?tab=walkthrough&step=${step.id}`)
                    onClose()
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--ink-50,#f4f4f5)] aria-selected:bg-[var(--ink-100,#e4e4e7)] text-sm text-[var(--ink-900)]"
                >
                  <span className="font-mono text-[var(--ink-400,#a1a1aa)] text-xs w-6 flex-shrink-0">
                    {step.step_number}
                  </span>
                  <span className="truncate">{step.text.slice(0, 80)}</span>
                </Command.Item>
              ))}
              {allSteps.length === 0 && (
                <Command.Item value="no-steps" disabled className="px-3 py-2 text-sm text-[var(--ink-400,#a1a1aa)]">
                  No steps found
                </Command.Item>
              )}
            </Command.Group>

            <Command.Group heading="ASK AI" className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-400,#a1a1aa)] px-2 pt-2 pb-1">
              <Command.Item value="ask-ai" className="px-3 py-2">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void handleAskAI() }}
                      placeholder={`Ask about "${sop.title?.slice(0, 40) ?? 'this SOP'}"…`}
                      className="flex-1 px-3 py-1.5 text-sm border border-[var(--ink-200,#e4e4e7)] rounded-lg bg-white outline-none focus:border-[var(--ink-400,#a1a1aa)]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskAI()}
                      disabled={aiLoading || !aiQuery.trim()}
                      className="px-3 py-1.5 text-sm bg-[var(--ink-900)] text-white rounded-lg disabled:opacity-40"
                    >
                      {aiLoading ? 'Thinking…' : 'Ask'}
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-sm text-[var(--accent-escalate,#dc2626)]">{aiError}</p>
                  )}
                  {aiResponse && (
                    <p className="text-sm text-[var(--ink-700,#27272a)] bg-[var(--ink-50,#f4f4f5)] rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                      {aiResponse}
                    </p>
                  )}
                </div>
              </Command.Item>
            </Command.Group>

            {toolsHazardSections.length > 0 && (
              <Command.Group heading="TOOLS & HAZARDS" className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-400,#a1a1aa)] px-2 pt-2 pb-1">
                {toolsHazardSections.map((section) => {
                  const tab =
                    section.section_type?.toLowerCase().includes('hazard') ||
                    section.section_type?.toLowerCase().includes('ppe')
                      ? 'hazards'
                      : 'tools'
                  return (
                    <Command.Item
                      key={section.id}
                      value={`section-${section.id}-${section.title}`}
                      onSelect={() => {
                        router.push(`?tab=${tab}`)
                        onClose()
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--ink-50,#f4f4f5)] aria-selected:bg-[var(--ink-100,#e4e4e7)] text-sm text-[var(--ink-900)]"
                    >
                      <span className="font-mono text-[var(--ink-400,#a1a1aa)] text-xs uppercase">{tab}</span>
                      <span className="truncate">{section.title}</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
