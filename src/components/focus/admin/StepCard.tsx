'use client'

/**
 * Phase 58 (58-12) -- one editable step: the worker's step card with its fields
 * made clickable. Text, kind, tip and the photo flag go through the autosave
 * queue; photos, moves, delete and the tick are their own guarded actions.
 *
 * The tick is one step at a time (WRK-04): there is no control that ticks more
 * than one. An edit that matters clears the tick on the server (a trigger), and
 * the card says so at once without waiting for the re-read.
 */
import { useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Camera, Check, MoreHorizontal, X } from 'lucide-react'
import {
  attachStepImage,
  deleteFocusStep,
  getStepAnnotation,
  getStepImageUploadUrl,
  moveFocusStep,
  removeStepImage,
  tickFocusStep,
  untickFocusStep,
} from '@/actions/focus-steps'
import { InlineText } from '@/components/focus/admin/InlineText'
import { StandardsButton } from '@/components/focus/admin/StandardsButton'
import { KIND_CHIP, KIND_EDGE } from '@/components/focus/KindChip'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { useRegisterOverlay } from '@/hooks/useFocusBack'
import type { FocusStepPatch } from '@/hooks/useFocusAutosave'
import { kindLabel, type FocusKind } from '@/lib/sop/focus'
import type { FocusStandard, FocusStepRow } from '@/lib/sop/focus-read'
import { compressPhoto } from '@/lib/photo/compress'

// Konva loads only when the tool opens: a nested lazy import, referenced nowhere else (58-17, CLAUDE.md 2026-09-13).
const AnnotationEditor = dynamic(() => import('./annotate/AnnotationEditor'), { ssr: false })

const KINDS: FocusKind[] = ['hazard', 'ppe', 'step', 'check']

export const menuItemClass =
  'flex min-h-tap w-full items-center px-3 text-left text-ui text-ink-900 hover:bg-paper-2 disabled:text-ink-400'

/**
 * A `...` button and its menu. The items stay mounted while the menu is shut so a
 * modal one of them opens (the standards popover) outlives the menu closing.
 */
export function OverflowMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  useRegisterOverlay(open, () => setOpen(false))
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-tap min-w-tap items-center justify-center rounded text-ink-500 hover:bg-paper-2"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        role="menu"
        className={`${open ? 'flex' : 'hidden'} absolute right-0 top-full z-20 w-52 flex-col rounded-lg border border-ink-200 bg-paper-1 py-1`}
      >
        {children(() => setOpen(false))}
      </div>
    </div>
  )
}

export interface StepCardProps {
  step: FocusStepRow
  sopId: string
  standards: FocusStandard[]
  /** Open AI findings that point at this step. */
  findings?: Array<{ id: string; text: string }>
  /** Admins and safety managers only: the checkbox. Everyone else sees the state. */
  canTick: boolean
  /** A published or superseded version: shown, never changed. */
  readOnly?: boolean
  isFirst: boolean
  isLast: boolean
  /** Put the cursor in the text on mount (a step that was just added). */
  autoFocusText?: boolean
  queue: (stepId: string, patch: FocusStepPatch) => void
  /** Re-read the SOP and the publish counts. */
  onChanged: () => void
}

export function StepCard({
  step,
  sopId,
  standards,
  findings = [],
  canTick,
  readOnly = false,
  isFirst,
  isLast,
  autoFocusText = false,
  queue,
  onChanged,
}: StepCardProps) {
  const [kind, setKind] = useState<FocusKind>(step.kind)
  const [photoRequired, setPhotoRequired] = useState(step.photo_required)
  const [tipOpen, setTipOpen] = useState(!!step.tip)
  const [edited, setEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [annotating, setAnnotating] = useState<{ originalPath: string; originalUrl: string; scene?: unknown } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useRegisterOverlay(confirmDelete, () => setConfirmDelete(false))
  useRegisterOverlay(confirmRemove !== null, () => setConfirmRemove(null))

  const wasTicked = !!step.verified_by_admin_id
  const ticked = wasTicked && !edited
  const recheck = step.needs_recheck || (edited && wasTicked)

  function edit(patch: FocusStepPatch) {
    setEdited(true)
    queue(step.id, patch)
  }

  async function run(job: () => Promise<{ error: string } | { ok: true } | unknown>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await job()
      if (res && typeof res === 'object' && 'error' in res) setError(failure)
      else onChanged()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  // The tick: one step, one call, one ledger row (server side).
  function toggleTick() {
    if (ticked) return void run(() => untickFocusStep({ stepId: step.id }), "Couldn't take that check back.")
    setEdited(false)
    void run(() => tickFocusStep({ stepId: step.id }), "Couldn't save that check.")
  }

  async function addPhoto(file: File) {
    await run(async () => {
      const blob = await compressPhoto(file)
      const slot = await getStepImageUploadUrl({ stepId: step.id, contentType: 'image/jpeg' })
      if ('error' in slot) return slot
      const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
      if (!put.ok) return { error: 'upload' }
      return attachStepImage({ stepId: step.id, storagePath: slot.storagePath })
    }, "That photo didn't upload. Try again.")
    setEdited(wasTicked)
  }

  function removePhoto(path: string) {
    return run(() => removeStepImage({ stepId: step.id, storagePath: path }), "Couldn't remove that photo.").then(() => setEdited(wasTicked))
  }

  // A photo with marks asks first; a plain one goes at once.
  async function askRemove(path: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await getStepAnnotation({ stepId: step.id, storagePath: path })
      if ('error' in res) return setError("Couldn't remove that photo.")
      if (res.annotation) return setConfirmRemove(path)
    } catch {
      return setError("Couldn't remove that photo.")
    } finally {
      setBusy(false)
    }
    await removePhoto(path)
  }

  // Open the tool on the untouched original, with its marks when there are some.
  async function openAnnotate(img: { path: string; url: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await getStepAnnotation({ stepId: step.id, storagePath: img.path })
      if ('error' in res) return setError("Couldn't open that photo.")
      setAnnotating(
        res.annotation
          ? { originalPath: res.annotation.originalPath, originalUrl: res.annotation.originalUrl, scene: res.annotation.scene }
          : { originalPath: img.path, originalUrl: img.url }
      )
    } catch {
      setError("Couldn't open that photo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      id={`step-${step.id}`}
      tabIndex={-1}
      data-testid="edit-step"
      data-kind={kind}
      className={`flex flex-col gap-4 rounded-lg border border-l-4 border-ink-200 bg-paper-1 p-4 outline-none ${
        findings.length > 0 ? 'border-l-ai' : KIND_EDGE[kind]
      }`}
    >
      <div className="flex items-start gap-3">
        {readOnly ? (
          <span className={`mono rounded px-2 py-1 text-meta uppercase ${KIND_CHIP[kind]}`}>{kindLabel(kind)}</span>
        ) : (
          <select
            aria-label="Kind"
            data-testid="edit-step-kind"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as FocusKind
              setKind(next)
              edit({ kind: next })
            }}
            className={`mono min-h-tap rounded px-2 text-meta uppercase ${KIND_CHIP[kind]}`}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-2">
          <StandardLabels names={standards.map((s) => s.name)} />
        </div>
        {!readOnly && (
          <OverflowMenu label="Step options">
            {(close) => (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isFirst}
                  className={menuItemClass}
                  onClick={() => {
                    close()
                    void run(() => moveFocusStep({ stepId: step.id, direction: 'up' }), "Couldn't move that step.")
                  }}
                >
                  Move up
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isLast}
                  className={menuItemClass}
                  onClick={() => {
                    close()
                    void run(() => moveFocusStep({ stepId: step.id, direction: 'down' }), "Couldn't move that step.")
                  }}
                >
                  Move down
                </button>
                <StandardsButton
                  sopId={sopId}
                  target={{ kind: 'step', id: step.id }}
                  onChanged={onChanged}
                  trigger={(open) => (
                    <button
                      type="button"
                      role="menuitem"
                      className={menuItemClass}
                      onClick={() => {
                        close()
                        open()
                      }}
                    >
                      Standards…
                    </button>
                  )}
                />
                <button
                  type="button"
                  role="menuitem"
                  className={`${menuItemClass} text-accent-escalate`}
                  onClick={() => {
                    close()
                    setConfirmDelete(true)
                  }}
                >
                  Delete step
                </button>
              </>
            )}
          </OverflowMenu>
        )}
      </div>

      {confirmDelete && (
        <div role="alertdialog" aria-label="Delete this step?" className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-2 p-4">
          <p className="text-reading font-semibold text-ink-900">Delete this step?</p>
          <p className="text-ui text-ink-700">It will be removed from this draft.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => deleteFocusStep({ stepId: step.id }), "Couldn't delete that step.")}
              className="min-h-tap rounded-lg bg-accent-escalate px-4 text-ui font-semibold text-white"
            >
              Delete step
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900"
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {readOnly ? (
        <p className="text-reading text-ink-900">{step.text}</p>
      ) : (
        <InlineText
          initialValue={step.text}
          ariaLabel="Step text"
          autoFocus={autoFocusText}
          className="text-reading rounded text-ink-900 outline-none focus:outline-2 focus:outline-accent-step empty:before:text-ink-400 empty:before:content-['Write_the_step']"
          onCommit={(value) => {
            // A step needs some words; an empty commit is left alone (the server refuses it too).
            if (value.trim() !== '' && value !== step.text) edit({ text: value })
          }}
        />
      )}

      {readOnly ? (
        step.tip && <p className="text-ui text-ink-700">Tip: {step.tip}</p>
      ) : tipOpen ? (
        <label className="flex flex-col gap-1">
          <span className="mono text-meta uppercase text-ink-600">Tip</span>
          <textarea
            defaultValue={step.tip ?? ''}
            rows={2}
            onChange={(e) => edit({ tip: e.target.value })}
            className="text-reading rounded-lg border border-ink-200 bg-paper-2 p-2 text-ink-900 outline-none focus:outline-2 focus:outline-accent-step"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setTipOpen(true)}
          className="min-h-tap self-start rounded px-1 text-ui text-ink-500 hover:text-accent-step"
        >
          Add a tip
        </button>
      )}

      {!readOnly && (
        <label className="flex min-h-tap items-center gap-2 text-ui text-ink-900">
          <input
            type="checkbox"
            role="switch"
            checked={photoRequired}
            onChange={(e) => {
              setPhotoRequired(e.target.checked)
              edit({ photoRequired: e.target.checked })
            }}
          />
          Needs a photo
        </label>
      )}

      {(step.image_urls.length > 0 || !readOnly) && (
        <div className="flex flex-wrap items-center gap-2">
          {step.image_urls.map((img) => (
            <span key={img.path} className="flex flex-col items-start">
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" loading="lazy" decoding="async" className="size-18 rounded-lg border border-ink-200 object-cover" />
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Remove photo"
                    disabled={busy}
                    onClick={() => void askRemove(img.path)}
                    className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-ink-300 bg-paper-1 text-ink-700"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                )}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  data-testid="annotate-photo"
                  disabled={busy}
                  onClick={() => void openAnnotate(img)}
                  className="min-h-tap rounded px-1 text-meta text-ink-500 hover:text-accent-step"
                >
                  Annotate
                </button>
              )}
            </span>
          ))}
          {!readOnly && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void addPhoto(file)
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-tap items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 text-ui text-ink-500 hover:border-accent-step hover:text-accent-step"
              >
                <Camera className="size-4" aria-hidden="true" />
                Add a photo
              </button>
            </>
          )}
        </div>
      )}

      {confirmRemove && (
        <div role="alertdialog" aria-label="Remove this photo?" className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-2 p-4">
          <p className="text-reading font-semibold text-ink-900">Remove this photo?</p>
          <p className="text-ui text-ink-700">Its marks are lost too.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const path = confirmRemove
                setConfirmRemove(null)
                void removePhoto(path)
              }}
              className="min-h-tap rounded-lg bg-accent-escalate px-4 text-ui font-semibold text-white"
            >
              Remove photo
            </button>
            <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900">
              Keep it
            </button>
          </div>
        </div>
      )}

      {annotating && (
        <AnnotationEditor
          stepId={step.id}
          originalPath={annotating.originalPath}
          originalUrl={annotating.originalUrl}
          initialScene={annotating.scene}
          onClose={() => setAnnotating(null)}
          onSaved={() => {
            setAnnotating(null)
            setEdited(wasTicked)
            onChanged()
          }}
        />
      )}

      {findings.map((f) => (
        <p
          key={f.id}
          data-testid="edit-step-finding"
          className="rounded-lg border p-3 text-ui text-ink-900"
          style={{ background: 'var(--tint-ai-bg)', borderColor: 'var(--tint-ai-border)' }}
        >
          {f.text}
        </p>
      ))}

      {error && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
        {canTick && !readOnly ? (
          <label className="flex min-h-tap items-center gap-2 text-ui text-ink-900">
            <input type="checkbox" checked={ticked} disabled={busy} onChange={toggleTick} />
            {ticked ? (
              <span className="flex items-center gap-1 font-semibold text-accent-ok">
                <Check className="size-4" aria-hidden="true" />
                Checked
              </span>
            ) : (
              <span>I have checked this</span>
            )}
          </label>
        ) : (
          <span className={`flex min-h-tap items-center gap-1 text-ui ${wasTicked ? 'font-semibold text-accent-ok' : 'text-ink-500'}`}>
            {wasTicked && <Check className="size-4" aria-hidden="true" />}
            {wasTicked ? 'Checked' : 'Not checked yet'}
          </span>
        )}
        {recheck && <span className="mono text-meta text-ink-600">Edited — check it again</span>}
      </div>
    </article>
  )
}
