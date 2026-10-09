'use client'

/**
 * Phase 58 (58-12) -- the editor's column: the worker document edited in place.
 * Steps stay grouped under their sections in source order (not walk order), each
 * a StepCard; sections can be added, renamed, moved and deleted; a blank SOP says
 * so. Published and superseded versions render read-only with "Start editing",
 * which forks the next draft FROM THE CLICK (D-11) -- never on mount.
 *
 * Mounted by the lazy editor seam (58-13); nothing in the worker path imports it.
 */
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createSection, listSectionKinds, reorderSections, updateSectionTitle } from '@/actions/sections'
import { addFocusStep, deleteFocusSection } from '@/actions/focus-steps'
import { forkDraft, type LineageVersion } from '@/actions/versions'
import { InlineText } from '@/components/focus/admin/InlineText'
import { menuItemClass, OverflowMenu, StepCard } from '@/components/focus/admin/StepCard'
import { StandardsButton } from '@/components/focus/admin/StandardsButton'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { useFocusAutosave, useFocusSaveStatus } from '@/hooks/useFocusAutosave'
import { useRegisterOverlay } from '@/hooks/useFocusBack'
import { useFocusLineage, useFocusSop } from '@/hooks/useFocusSop'
import { focusHref } from '@/lib/sop/focus-path'
import type { FocusSop } from '@/lib/sop/focus-read'

/** Adds an empty section at the end. Shared with the rail's "Add section" row. */
export async function addDefaultSection(sopId: string): Promise<{ id: string } | { error: string }> {
  try {
    const kinds = await listSectionKinds()
    const kind = kinds.find((k) => k.slug === 'steps') ?? kinds[0]
    if (!kind) return { error: "Couldn't add a section." }
    const created = await createSection({ sopId, sectionKindId: kind.id, title: 'New section' })
    return { id: created.id }
  } catch {
    return { error: "Couldn't add a section." }
  }
}

export interface EditDocumentProps {
  sopId: string
  initial: FocusSop
  /** The `?from=` place token, carried into the draft's address. */
  from: string | null
  /** Admins and safety managers can tick; other editors see the state. */
  canTick: boolean
  /** Open AI findings (58-13's banner owns them); a step with one gets the violet marker. */
  findings?: Array<{ id: string; stepId: string; text: string }>
  /** Above the sections: 58-13 puts the AI check banner here. */
  bannerSlot?: ReactNode
  /** True for the moment after a publish lands, to show the ledger line. */
  publishedNote?: boolean
}

/** The one line that says which version this is, shared with the rail's version row. */
export function versionLine(sop: FocusSop['sop'], lineage: LineageVersion[], publishedNote = false): string {
  const live = lineage.find((v) => v.state === 'live')
  if (sop.status === 'published') {
    if (publishedNote) return `Published v${sop.version} · logged in the decision ledger`
    return lineage.find((v) => v.id === sop.id)?.state === 'superseded'
      ? `v${sop.version} — superseded`
      : `v${sop.version} is live`
  }
  return live && live.version < sop.version ? `Editing v${sop.version} — v${live.version} is live` : 'Draft — not published yet'
}

const pad = (n: number) => String(n).padStart(2, '0')

const dashedRow =
  'flex min-h-tap w-full items-center justify-center rounded border border-dashed border-ink-300 text-ui text-ink-500 hover:border-accent-step hover:text-accent-step'

export function EditDocument({ sopId, initial, from, canTick, findings = [], bannerSlot, publishedNote = false }: EditDocumentProps) {
  const router = useRouter()
  const { focus, invalidate } = useFocusSop(sopId, initial)
  const { queue } = useFocusAutosave(sopId)
  const lineage = useFocusLineage(sopId)
  const saveFailed = useFocusSaveStatus((s) => s.gaveUp)

  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newStepId, setNewStepId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; title: string; count: number } | null>(null)
  const [forking, setForking] = useState(false)
  useRegisterOverlay(deleting !== null, () => setDeleting(null))

  const { sop, sections, steps } = focus
  const readOnly = sop.status !== 'draft'
  const stepsBySection = new Map<string, typeof steps>()
  for (const s of steps) stepsBySection.set(s.section_id, [...(stepsBySection.get(s.section_id) ?? []), s])

  // ---- version slot -------------------------------------------------------
  const own = lineage.find((v) => v.id === sop.id)
  const draftInLineage = lineage.find((v) => v.state === 'draft')
  const nextVersion = draftInLineage?.version ?? Math.max(sop.version, ...lineage.map((v) => v.version)) + 1
  const slot = versionLine(sop, lineage, publishedNote)
  const canStartEditing = sop.status === 'published' && own?.state !== 'superseded'

  // ---- actions (every one is a click handler; none runs on mount) ---------
  async function startEditing() {
    setForking(true)
    setError(null)
    const res = await forkDraft({ sopId })
    if ('error' in res) {
      setForking(false)
      setError(res.error)
      return
    }
    router.push(focusHref(res.draftId, { mode: 'edit', from }))
  }

  async function after(job: Promise<{ error: string } | unknown>, failure: string) {
    setError(null)
    try {
      const res = await job
      if (res && typeof res === 'object' && 'error' in res) setError(failure)
      else await invalidate()
    } catch {
      setError(failure)
    }
  }

  async function addSection() {
    const res = await addDefaultSection(sopId)
    if ('error' in res) return setError(res.error)
    setRenamingId(res.id)
    await invalidate()
  }

  async function addStep(sectionId: string, afterStepId?: string) {
    setError(null)
    const res = await addFocusStep({ sectionId, afterStepId })
    if ('error' in res) return setError("Couldn't add a step.")
    setNewStepId(res.stepId)
    await invalidate()
  }

  async function renameSection(sectionId: string, title: string, current: string) {
    setRenamingId(null)
    const next = title.trim()
    if (next === '' || next === current) return
    await after(updateSectionTitle(sectionId, next), "Couldn't rename that section.")
  }

  function moveSection(index: number, by: -1 | 1) {
    const ids = sections.map((s) => s.id)
    const j = index + by
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    void after(reorderSections({ sopId, orderedSectionIds: ids }), "Couldn't move that section.")
  }

  async function confirmDeleteSection() {
    if (!deleting) return
    const id = deleting.id
    setDeleting(null)
    await after(deleteFocusSection({ sectionId: id }), "Couldn't delete that section.")
  }

  return (
    <div data-testid="edit-document" className="mx-auto flex w-full max-w-205 flex-col gap-6 px-4 py-8 lg:px-8">
      <div
        data-testid="edit-version-slot"
        className="flex min-h-tap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-paper-2 px-4 text-ui text-ink-700"
      >
        <span>{slot}</span>
        {canStartEditing && (
          <button
            type="button"
            data-testid="edit-start-editing"
            disabled={forking}
            onClick={() => void startEditing()}
            className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:bg-ink-300 disabled:text-ink-500"
          >
            {forking ? 'Opening…' : `Start editing v${nextVersion}`}
          </button>
        )}
      </div>

      {saveFailed && (
        <p role="alert" className="rounded-lg border border-ink-200 bg-paper-2 p-3 text-ui text-accent-escalate">
          Your last change didn&apos;t save. Keep this page open and we&apos;ll keep trying.
        </p>
      )}
      {error && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}

      {bannerSlot}

      {sections.length === 0 ? (
        <div data-testid="edit-empty" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-reading font-semibold text-ink-900">Nothing here yet</p>
          <p className="text-reading text-ink-700">Add your first section, then write the steps a worker follows.</p>
          {!readOnly && (
            <button type="button" onClick={() => void addSection()} className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900">
              Add a section
            </button>
          )}
        </div>
      ) : (
        <>
          {sections.map((section, si) => {
            const list = stepsBySection.get(section.id) ?? []
            return (
              <section key={section.id} data-testid="edit-section" aria-label={section.title} className="flex flex-col gap-4">
                <header className="flex items-center gap-3">
                  <span className="mono text-meta text-ink-600">{pad(si + 1)}</span>
                  {renamingId === section.id && !readOnly ? (
                    <InlineText
                      initialValue={section.title}
                      ariaLabel="Section title"
                      className="text-reading rounded font-semibold text-ink-900 outline-none focus:outline-2 focus:outline-accent-step"
                      onCommit={(v) => void renameSection(section.id, v, section.title)}
                    />
                  ) : (
                    <h2 className="text-reading font-semibold text-ink-900">
                      {readOnly ? (
                        section.title
                      ) : (
                        <button type="button" className="min-h-tap text-left" onClick={() => setRenamingId(section.id)}>
                          {section.title}
                        </button>
                      )}
                    </h2>
                  )}
                  <StandardLabels names={(focus.standards.sections[section.id] ?? []).map((s) => s.name)} />
                  <span className="h-px flex-1 bg-ink-100" aria-hidden="true" />
                  {!readOnly && (
                    <OverflowMenu label="Section options">
                      {(close) => (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            className={menuItemClass}
                            onClick={() => {
                              close()
                              setRenamingId(section.id)
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={si === 0}
                            className={menuItemClass}
                            onClick={() => {
                              close()
                              moveSection(si, -1)
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={si === sections.length - 1}
                            className={menuItemClass}
                            onClick={() => {
                              close()
                              moveSection(si, 1)
                            }}
                          >
                            Move down
                          </button>
                          <StandardsButton
                            sopId={sopId}
                            target={{ kind: 'section', id: section.id }}
                            onChanged={() => void invalidate()}
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
                              setDeleting({ id: section.id, title: section.title, count: list.length })
                            }}
                          >
                            Delete section
                          </button>
                        </>
                      )}
                    </OverflowMenu>
                  )}
                </header>

                {list.map((step, i) => (
                  <div key={step.id} className="flex flex-col gap-4">
                    <StepCard
                      step={step}
                      sopId={sopId}
                      standards={focus.standards.steps[step.id] ?? []}
                      findings={findings.filter((f) => f.stepId === step.id)}
                      canTick={canTick}
                      readOnly={readOnly}
                      isFirst={i === 0}
                      isLast={i === list.length - 1}
                      autoFocusText={step.id === newStepId}
                      queue={queue}
                      onChanged={() => void invalidate()}
                    />
                    {!readOnly && i < list.length - 1 && (
                      <div className="group relative flex h-6 items-center">
                        <span className="h-px flex-1 bg-ink-100" aria-hidden="true" />
                        <button
                          type="button"
                          aria-label="Add a step here"
                          onClick={() => void addStep(section.id, step.id)}
                          className="mx-2 flex size-6 items-center justify-center rounded-full border border-ink-300 bg-paper-1 text-ui text-ink-500 hover:border-accent-step hover:text-accent-step max-lg:opacity-100 lg:opacity-0 lg:focus:opacity-100 lg:group-hover:opacity-100"
                        >
                          ＋
                        </button>
                        <span className="h-px flex-1 bg-ink-100" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                ))}

                {!readOnly && (
                  <button type="button" data-testid="edit-add-step" onClick={() => void addStep(section.id)} className={dashedRow}>
                    Add a step
                  </button>
                )}
              </section>
            )
          })}
          {!readOnly && (
            <button type="button" data-testid="edit-add-section" onClick={() => void addSection()} className={`${dashedRow} mt-6`}>
              Add a section
            </button>
          )}
        </>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={() => setDeleting(null)}>
          <div
            role="alertdialog"
            aria-label={`Delete “${deleting.title}”?`}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-paper-1 p-6"
          >
            <p className="text-reading font-semibold text-ink-900">Delete “{deleting.title}”?</p>
            <p className="text-reading text-ink-700">Its {deleting.count} steps go too.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmDeleteSection()}
                className="min-h-tap rounded-lg bg-accent-escalate px-4 text-ui font-semibold text-white"
              >
                Delete section
              </button>
              <button type="button" onClick={() => setDeleting(null)} className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900">
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
