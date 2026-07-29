'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createVideoSopPipelineSession } from '@/actions/sops'
import { ACCEPT_ATTR, INTAKE_HINT, validateIntakeFile } from '@/lib/upload/file-intake'
import type { PipelineVideoFormat } from '@/types/sop'

interface Props {
  open: boolean
  onClose: () => void
}

const FORMATS: { id: PipelineVideoFormat; name: string; description: string }[] = [
  {
    id: 'narrated_slideshow',
    name: 'Narrated slideshow',
    description: 'One slide per SOP section with AI voiceover. Hazards and PPE appear first.',
  },
  {
    id: 'screen_recording',
    name: 'Screen-recording style',
    description: 'Scrolling SOP text synced to AI narration, like a screen recording.',
  },
]

export function VideoFormatSelectionModal({ open, onClose }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<PipelineVideoFormat | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const picked = e.target.files?.[0]
    if (!picked) {
      setFile(null)
      return
    }
    const result = await validateIntakeFile(picked)
    if (!result.ok) {
      setError(result.message)
      setFile(null)
      return
    }
    setFile(result.file)
  }

  function reset() {
    setFile(null)
    setFormat(null)
    setError(null)
    setSubmitting(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDismiss() {
    reset()
    onClose()
  }

  async function handleConfirm() {
    if (!file || !format) return
    setSubmitting(true)
    setError(null)

    const session = await createVideoSopPipelineSession({
      file: { name: file.name, size: file.size, type: file.type },
      format,
    })

    if ('error' in session) {
      setError(session.error)
      setSubmitting(false)
      return
    }

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('sop-documents')
      .uploadToSignedUrl(session.path, session.token, file, {
        contentType: file.type,
      })

    if (uploadError) {
      setError('Upload failed — please try again.')
      setSubmitting(false)
      return
    }

    // Fire-and-forget parse trigger (Next.js 16 client-side pattern)
    fetch('/api/sops/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sopId: session.sopId }),
    }).catch(console.error)

    router.push(`/admin/sops/pipeline/${session.pipelineId}`)
  }

  const canSubmit = !!file && !!format && !submitting

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-format-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="bg-[var(--paper)] rounded-2xl p-6 max-w-lg w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <h2
            id="video-format-modal-title"
            className="text-base font-semibold text-[var(--ink-900)]"
          >
            Choose video format
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="text-[var(--ink-500)] hover:text-[var(--ink-900)] p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File picker */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full min-h-[72px] border-2 border-dashed border-[var(--ink-100)] rounded-xl p-4 flex items-center gap-3 text-left hover:bg-white transition-colors mb-4"
        >
          <Upload className="w-5 h-5 text-[var(--ink-500)] shrink-0" />
          <div className="min-w-0 flex-1">
            {file ? (
              <>
                <p className="text-sm font-medium text-[var(--ink-900)] truncate">
                  {file.name}
                </p>
                <p className="text-xs text-[var(--ink-500)]">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-500)]">
                {INTAKE_HINT}
              </p>
            )}
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPT_ATTR}
          onChange={handleFileChange}
        />

        {/* Format radio cards */}
        <fieldset className="flex flex-col gap-3 mb-4">
          <legend className="sr-only">Video format</legend>
          {FORMATS.map((f) => {
            const selected = format === f.id
            return (
              <label
                key={f.id}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer ${
                  selected ? 'border-[var(--ink-900)]' : 'border-[var(--ink-100)]'
                }`}
              >
                <input
                  type="radio"
                  name="videoFormat"
                  value={f.id}
                  checked={selected}
                  onChange={() => setFormat(f.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected ? 'border-[var(--ink-900)]' : 'border-[var(--ink-500)]'
                  }`}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-[var(--ink-900)]" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-[var(--ink-900)]">
                    {f.name}
                  </span>
                  <span className="block text-xs text-[var(--ink-500)] mt-1">
                    {f.description}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {error && (
          <p role="alert" className="text-xs text-red-400 mb-3">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canSubmit}
          className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-xl rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-700)] transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting…
            </>
          ) : (
            'Start pipeline'
          )}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={submitting}
          className="w-full min-h-[44px] mt-3 bg-[var(--paper-2)] text-[var(--ink-900)] rounded-lg hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
