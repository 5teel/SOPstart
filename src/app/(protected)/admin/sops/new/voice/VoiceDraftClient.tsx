'use client'

/**
 * Conversationally collaborative voice SOP drafting.
 *
 * Adapts the /admin/sops/new/ai prompt workflow: instead of one typed brief,
 * the admin talks through the procedure with an AI interviewer (mic → Deepgram
 * streaming STT → /api/sops/voice-draft turn → spoken TTS reply). The
 * interviewer accumulates a brief; "Generate draft" hands that brief to the
 * SAME /api/sops/ai-prompt pipeline and the SAME ParseJobStatus → builder
 * hand-off as the typed workflow.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDeepgramWebSocket } from '@/hooks/useDeepgramWebSocket'
import { useTtsPlayback } from '@/components/sop/voice/useTtsPlayback'
import { isVoiceCaptureSupported } from '@/lib/voice/media-recorder'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import type { Department } from '@/types/sop'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { DChip } from '@/components/admin/departments/DChip'

interface Msg {
  role: 'user' | 'assistant'
  text: string
}

const OPENER =
  "Tell me about the procedure — what's the task, what equipment is involved, and where does it happen?"

export function VoiceDraftClient({ departments }: { departments: Department[] }) {
  const router = useRouter()
  const { start, stop } = useDeepgramWebSocket()
  const { speak } = useTtsPlayback()

  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', text: OPENER }])
  const [brief, setBrief] = useState('')
  const [ready, setReady] = useState(false)
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [thinking, setThinking] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sopId, setSopId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [muted, setMuted] = useState(false)

  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [allDepartments, setAllDepartments] = useState(false)

  const busyRef = useRef(false)
  const voiceSupported = typeof window === 'undefined' ? true : isVoiceCaptureSupported()

  async function sendTurn(userText: string, currentMessages: Msg[]) {
    if (busyRef.current) return
    busyRef.current = true
    setThinking(true)
    setError(null)
    const next: Msg[] = [...currentMessages, { role: 'user', text: userText }]
    setMessages(next)
    try {
      const res = await fetch('/api/sops/voice-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'The assistant is unavailable right now — try again.')
        return
      }
      setMessages([...next, { role: 'assistant', text: json.reply }])
      setBrief(json.brief ?? '')
      setReady(json.ready === true)
      if (!muted && json.reply) void speak(json.reply)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      busyRef.current = false
      setThinking(false)
    }
  }

  async function toggleMic() {
    setError(null)
    if (listening) {
      setListening(false)
      const result = await stop().catch(() => null)
      setPartial('')
      const transcript = result?.transcript?.trim()
      if (transcript) await sendTurn(transcript, messages)
      return
    }
    try {
      const handle = await start({ language: 'en-NZ' })
      handle.onPartial((text) => setPartial(text))
      handle.onError(() => {
        setListening(false)
        setPartial('')
        setError('Microphone stream dropped — tap the mic to try again.')
      })
      setListening(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the microphone')
    }
  }

  async function sendTyped() {
    const text = typed.trim()
    if (!text || busyRef.current) return
    setTyped('')
    await sendTurn(text, messages)
  }

  async function generateDraft() {
    if (brief.trim().length < 20) {
      setError('Keep talking — the brief needs a little more detail before drafting.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/sops/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: brief.slice(0, 2000),
          categoryTag: null,
          detailLevel: 3,
          departmentIds,
          allDepartments,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.sopId) {
        setError(json.error ?? 'Draft generation failed — try again')
        setGenerating(false)
        return
      }
      setSopId(json.sopId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      setGenerating(false)
    }
  }

  // Same hand-off as PromptClient: live stepper → builder on completion.
  if (sopId) {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-[var(--ink-900)] mb-4">Drafting your SOP</h2>
        <ParseJobStatus
          sopId={sopId}
          initialIsVideo={false}
          onCompleted={() => router.push(`/admin/sops/builder/${sopId}`)}
        />
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-5">
      {/* Conversation */}
      <div
        className="bg-white border border-[var(--ink-100)] rounded-xl p-4 space-y-3 max-h-[45vh] overflow-y-auto"
        data-testid="voice-draft-conversation"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={
                m.role === 'user'
                  ? 'inline-block bg-[var(--ink-900)] text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%] text-left'
                  : 'inline-block bg-[var(--ink-050,#f5f5f4)] border border-[var(--ink-100)] text-[var(--ink-900)] rounded-2xl rounded-bl-sm px-4 py-2 text-sm max-w-[85%]'
              }
            >
              {m.text}
            </span>
          </div>
        ))}
        {partial && (
          <div className="text-right">
            <span className="inline-block bg-[var(--ink-100)] text-[var(--ink-700)] rounded-2xl px-4 py-2 text-sm italic max-w-[85%] text-left">
              {partial}…
            </span>
          </div>
        )}
        {thinking && <p className="text-xs text-[var(--ink-400)]">Assistant is thinking…</p>}
      </div>

      {/* Mic + typed fallback */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMic}
          disabled={thinking || generating || !voiceSupported}
          aria-label={listening ? 'Stop and send' : 'Start talking'}
          className={
            'shrink-0 h-16 w-16 rounded-full font-semibold text-white transition-colors disabled:opacity-50 ' +
            (listening
              ? 'bg-red-600 hover:bg-red-500 animate-pulse'
              : 'bg-[var(--ink-900)] hover:bg-[var(--ink-700)]')
          }
        >
          {listening ? '■' : '🎤'}
        </button>
        <div className="flex-1">
          <div className="flex gap-2">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void sendTyped()
              }}
              placeholder={listening ? 'Listening… tap ■ to send' : 'Or type a reply'}
              disabled={listening || thinking || generating}
              className="flex-1 h-[44px] bg-white border border-[var(--ink-100)] rounded-xl text-sm px-3 text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-300)] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void sendTyped()}
              disabled={!typed.trim() || listening || thinking || generating}
              className="h-[44px] px-4 rounded-xl border border-[var(--ink-100)] text-sm text-[var(--ink-700)] hover:bg-[var(--ink-050,#f5f5f4)] disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <label className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ink-500)]">
            <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
            Mute spoken replies
          </label>
        </div>
      </div>

      {!voiceSupported && (
        <p className="text-xs text-amber-600">
          Voice capture isn&apos;t supported in this browser — you can still type your answers.
        </p>
      )}

      {/* Brief-so-far */}
      {brief && (
        <div className="bg-[var(--ink-050,#f5f5f4)] border border-[var(--ink-100)] rounded-xl p-4" data-testid="voice-draft-brief">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Brief so far
            </h3>
            {ready && <span className="text-xs font-medium text-green-600">ready to draft</span>}
          </div>
          <p className="mt-2 text-sm text-[var(--ink-700)] whitespace-pre-wrap">{brief}</p>
        </div>
      )}

      {/* Departments (same field as the typed workflow) */}
      {departments.length > 0 && brief && (
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-700)]">
            Department <span className="font-normal text-[var(--ink-500)]">(optional)</span>
          </label>
          {(departmentIds.length > 0 || allDepartments) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {allDepartments ? (
                <DChip variant="all-departments" />
              ) : (
                departmentIds.map((id) => {
                  const dept = departments.find((d) => d.id === id)
                  return dept ? <DChip key={id} variant="department" department={dept} /> : null
                })
              )}
            </div>
          )}
          <DepartmentPicker
            mode="sop"
            sopId="__new__"
            localOnly
            departments={departments}
            selectedIds={departmentIds}
            allDepartments={allDepartments}
            onChange={(ids, all) => {
              setDepartmentIds(ids)
              setAllDepartments(all)
            }}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-200">{error}</div>
      )}

      <button
        type="button"
        onClick={() => void generateDraft()}
        disabled={generating || thinking || listening || brief.trim().length < 20}
        className="w-full bg-[var(--ink-900)] text-white font-semibold rounded-lg py-3 hover:bg-[var(--ink-700)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? 'Generating…' : ready ? 'Generate draft' : 'Generate draft (add more detail first)'}
      </button>
    </div>
  )
}
