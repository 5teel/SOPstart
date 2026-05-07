'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SectionKind, BlockCategory } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'
import { listSectionKinds } from '@/actions/sections'
import { createSopFromWizard } from '@/actions/sops'
import { addBlockToSection } from '@/actions/sop-section-blocks'
import { updateSectionLayout } from '@/actions/sections'
import { BlockPicker } from '@/components/admin/blocks/BlockPicker'
import { blockContentToPuckProps, blockKindToPuckType } from '@/lib/builder/puck-to-block-content'

// Per SPEC SB-AUTH-01, the wizard exposes only the canonical section kinds.
// 'custom' and 'content' are not offered at wizard time — admin adds them
// inside the builder via AddSectionButton if needed.
const CANONICAL_WIZARD_SLUGS = ['hazards', 'ppe', 'steps', 'emergency', 'signoff'] as const

// Phase 13: section kinds that surface a "Pick from library" affordance at
// wizard step 2. Must match BlockContentSchema discriminator kinds.
const LIBRARY_SUPPORTED_SLUG_TO_KIND: Record<string, BlockContent['kind'] | null> = {
  hazards: 'hazard',
  ppe: 'ppe',
  steps: 'step',
  emergency: 'emergency',
  signoff: null, // signoff blocks live inline; no library picker yet
}

const TitleStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  sopNumber: z.string().max(60).optional(),
})
type TitleStepValues = z.infer<typeof TitleStepSchema>

type PickedBlock = {
  blockId: string
  pinMode: 'pinned' | 'follow_latest'
  preview: { name: string; content: BlockContent }
}

interface WizardClientProps {
  /** Phase 13 D-Tax-03: controlled vocab for SOP-level category select + library picker. */
  categories: BlockCategory[]
}

export function WizardClient({ categories }: WizardClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [titleValues, setTitleValues] = useState<TitleStepValues | null>(null)
  // Phase 13 D-Tax-03 — SOP-level primary category, drives picker pre-filter.
  const [categoryTag, setCategoryTag] = useState<string | null>(null)
  const [kinds, setKinds] = useState<SectionKind[]>([])
  const [kindsLoading, setKindsLoading] = useState(true)
  const [selectedKindIds, setSelectedKindIds] = useState<string[]>([])
  // Phase 13: blocks picked from the library, grouped by kind_slug.
  const [pickedBlocksByKind, setPickedBlocksByKind] = useState<
    Record<string, PickedBlock[]>
  >({})
  // Currently-open picker target — null when picker is closed.
  const [pickerTarget, setPickerTarget] = useState<{
    sectionKindSlug: string
    libraryKindSlug: BlockContent['kind']
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleForm = useForm<TitleStepValues>({
    resolver: zodResolver(TitleStepSchema),
    defaultValues: titleValues ?? { title: '', sopNumber: '' },
  })

  // SOP-level categories — pulled from the same controlled vocab as block_categories.
  // Filter to hazard / area / procedure groups (PPE is a sub-tag, not a SOP-level category).
  const sopCategoryOptions = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.category_group === 'hazard' ||
          c.category_group === 'area' ||
          c.category_group === 'procedure'
      ),
    [categories]
  )

  // Fetch section_kinds lazily when the admin reaches step 2. listSectionKinds
  // already RLS-scopes the result to globals + own-org — no extra filtering
  // needed for data visibility.
  useEffect(() => {
    if (step !== 2) return
    let mounted = true
    setKindsLoading(true)
    listSectionKinds()
      .then((data) => {
        if (!mounted) return
        const canonical = data.filter((k) =>
          (CANONICAL_WIZARD_SLUGS as readonly string[]).includes(k.slug)
        )
        setKinds(canonical)
        setKindsLoading(false)
      })
      .catch((e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Failed to load section kinds')
        setKindsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [step])

  function totalPickedCount(): number {
    return Object.values(pickedBlocksByKind).reduce((sum, arr) => sum + arr.length, 0)
  }

  async function handleSubmitFinal() {
    if (!titleValues || selectedKindIds.length === 0) return
    setSubmitting(true)
    setError(null)
    setStep(4)
    const result = await createSopFromWizard({
      title: titleValues.title,
      sopNumber: titleValues.sopNumber || null,
      kindIds: selectedKindIds,
      categoryTag,
    })
    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      setStep(3)
      return
    }

    // Phase 13: post-create, attach picked library blocks via addBlockToSection.
    // Best-effort — failures here are non-blocking (admin can manually add in builder).
    if (totalPickedCount() > 0) {
      try {
        await attachPickedBlocks(result.sopId)
      } catch (e: unknown) {
        // Non-blocking — surface a console warning but proceed to builder.
        console.warn('[wizard] attachPickedBlocks partial failure', e)
      }
    }

    router.push(`/admin/sops/builder/${result.sopId}`)
  }

  /**
   * Post-creation, fetch the new SOP's sections (created by createSopFromWizard
   * with empty layout_data), and for each kind with picked blocks:
   *   1. addBlockToSection per pick — captures snapshot_content
   *   2. build a Puck item for each pick with props.junctionId stamped
   *   3. updateSectionLayout to commit the new layout_data
   */
  async function attachPickedBlocks(sopId: string): Promise<void> {
    // Fetch sections via RLS-scoped client (use server action call indirectly via fetch).
    // To keep this client-side, we re-use the server action pattern: ask the server for
    // the section ids by fetching the SOP detail page — but cleaner: use a direct
    // Supabase call. Since this is a client component, we'll fetch via a small server
    // action; reuse the existing pattern by calling a lightweight endpoint.
    //
    // Minimal solution: pull from /api/sops/[sopId]/sections if it exists. As a
    // compatibility-safe fallback, use supabase from client SDK to read sop_sections
    // (RLS allows the caller's org).
    const supabaseModule = await import('@/lib/supabase/client')
    const supabase = supabaseModule.createClient()
    const { data: sectionsRaw, error: secErr } = await supabase
      .from('sop_sections')
      .select('id, section_type, layout_data, layout_version')
      .eq('sop_id', sopId)
    if (secErr || !sectionsRaw) {
      console.warn('[wizard] could not load sections for picked-block attachment', secErr)
      return
    }

    type SectionRow = {
      id: string
      section_type: string
      layout_data: unknown
      layout_version: number | null
    }
    const sections = sectionsRaw as unknown as SectionRow[]

    for (const [sectionKindSlug, picks] of Object.entries(pickedBlocksByKind)) {
      if (picks.length === 0) continue
      const section = sections.find(
        (s) => s.section_type === sectionKindSlug
      )
      if (!section) continue

      // Build Puck items as we add junctions, stamping junctionId onto each item.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layoutData: any = section.layout_data ?? { content: [], root: { props: {} } }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newContent: any[] = Array.isArray(layoutData.content)
        ? [...layoutData.content]
        : []

      for (const pick of picks) {
        const result = await addBlockToSection({
          sopSectionId: section.id,
          blockId: pick.blockId,
          pinMode: pick.pinMode,
        })
        if ('error' in result) {
          console.warn('[wizard] addBlockToSection failed', pick.blockId, result.error)
          continue
        }
        const junctionId = result.junction.id
        const puckType = blockKindToPuckType(pick.preview.content.kind)
        if (!puckType) continue
        const props = blockContentToPuckProps(pick.preview.content)
        const itemId = `${puckType.toLowerCase()}-${junctionId.slice(0, 8)}`
        newContent.push({
          type: puckType,
          props: {
            id: itemId,
            junctionId,
            ...props,
          },
        })
      }

      // Persist updated layout_data.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newLayout: any = {
        ...layoutData,
        content: newContent,
      }
      const upd = await updateSectionLayout({
        sectionId: section.id,
        layoutData: newLayout,
        layoutVersion: ((section.layout_version as number | null) ?? 0) + 1,
        clientUpdatedAt: Date.now(),
      })
      if ('error' in upd) {
        console.warn('[wizard] updateSectionLayout failed', section.id, upd.error)
      }
    }
  }

  function handlePickerAdd(input: {
    blockId: string
    pinMode: 'pinned' | 'follow_latest'
    preview: { name: string; content: BlockContent }
  }) {
    if (!pickerTarget) return
    const slug = pickerTarget.sectionKindSlug
    setPickedBlocksByKind((prev) => ({
      ...prev,
      [slug]: [...(prev[slug] ?? []), input],
    }))
    setPickerTarget(null)
  }

  function handleRemovePicked(sectionKindSlug: string, blockId: string) {
    setPickedBlocksByKind((prev) => ({
      ...prev,
      [sectionKindSlug]: (prev[sectionKindSlug] ?? []).filter(
        (p) => p.blockId !== blockId
      ),
    }))
  }

  return (
    <div className="rounded-xl border border-steel-700 bg-steel-800 p-6" data-testid="wizard-client">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-steel-400">
        <span className={step === 1 ? 'text-brand-yellow' : ''}>1 Title</span>
        <span>→</span>
        <span className={step === 2 ? 'text-brand-yellow' : ''}>2 Sections</span>
        <span>→</span>
        <span className={step === 3 ? 'text-brand-yellow' : ''}>3 Review</span>
        <span>→</span>
        <span className={step === 4 ? 'text-brand-yellow' : ''}>4 Create</span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <form
          onSubmit={titleForm.handleSubmit((values) => {
            setTitleValues(values)
            setStep(2)
          })}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel-300">Title *</span>
            <input
              {...titleForm.register('title')}
              className="rounded border border-steel-600 bg-steel-900 px-3 py-2 text-steel-100"
              placeholder="e.g. Forklift pre-start checklist"
              data-testid="wizard-title-input"
            />
            {titleForm.formState.errors.title && (
              <span className="text-xs text-red-400">
                {titleForm.formState.errors.title.message}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel-300">SOP number (optional)</span>
            <input
              {...titleForm.register('sopNumber')}
              className="rounded border border-steel-600 bg-steel-900 px-3 py-2 text-steel-100"
              placeholder="e.g. SOP-042"
              data-testid="wizard-sop-number-input"
            />
          </label>

          {/* Phase 13 D-Tax-03 — SOP category select */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel-300">SOP category (optional)</span>
            <select
              value={categoryTag ?? ''}
              onChange={(e) => setCategoryTag(e.target.value || null)}
              className="rounded border border-steel-600 bg-steel-900 px-3 py-2 text-steel-100"
              data-testid="wizard-category-tag"
            >
              <option value="">— None —</option>
              {sopCategoryOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.display_name}
                </option>
              ))}
            </select>
            <span className="text-xs text-steel-500">
              Used to surface the most relevant blocks when you pick from the library.
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900"
              data-testid="wizard-next-1"
            >
              Next
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-steel-300">
            Pick the sections you want to include. You can add more later. For
            hazards, PPE, and step sections you can also pick reusable blocks
            from the library.
          </p>
          {kindsLoading ? (
            <div className="text-steel-400 text-sm">Loading sections…</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {kinds.map((k) => {
                const checked = selectedKindIds.includes(k.id)
                const libraryKind = LIBRARY_SUPPORTED_SLUG_TO_KIND[k.slug] ?? null
                const picks = pickedBlocksByKind[k.slug] ?? []
                return (
                  <li key={k.id}>
                    <div
                      className="flex flex-col gap-2 rounded border border-steel-700 p-3 hover:bg-steel-900"
                      data-kind-slug={k.slug}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedKindIds((prev) =>
                              e.target.checked
                                ? [...prev, k.id]
                                : prev.filter((id) => id !== k.id)
                            )
                            // If unchecking, clear any picks for this kind.
                            if (!e.target.checked && picks.length > 0) {
                              setPickedBlocksByKind((prev) => {
                                const next = { ...prev }
                                delete next[k.slug]
                                return next
                              })
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-steel-100">
                            {k.display_name}
                          </div>
                        </div>
                        {checked && libraryKind && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              setPickerTarget({
                                sectionKindSlug: k.slug,
                                libraryKindSlug: libraryKind,
                              })
                            }}
                            className="text-xs px-2 py-1 rounded bg-steel-900 border border-steel-700 text-steel-300 hover:text-brand-yellow"
                            data-testid={`wizard-pick-from-library-${k.slug}`}
                          >
                            + Pick from library
                          </button>
                        )}
                      </label>
                      {checked && picks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-7">
                          {picks.map((p) => (
                            <span
                              key={p.blockId}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            >
                              <span className="uppercase tracking-wider">
                                {p.pinMode === 'pinned' ? 'Pinned' : 'Follow'}
                              </span>
                              <span className="text-steel-200">{p.preview.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemovePicked(k.slug, p.blockId)}
                                className="text-steel-400 hover:text-red-400 ml-1"
                                aria-label={`Remove ${p.preview.name}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded border border-steel-600 px-4 py-2 text-sm text-steel-300"
              data-testid="wizard-back-2"
            >
              Back
            </button>
            <button
              type="button"
              disabled={selectedKindIds.length === 0}
              onClick={() => setStep(3)}
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900 disabled:opacity-40"
              data-testid="wizard-next-2"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && titleValues && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-steel-100">Review</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-steel-400">Title</dt>
              <dd className="text-steel-100">{titleValues.title}</dd>
            </div>
            {titleValues.sopNumber && (
              <div>
                <dt className="text-steel-400">SOP number</dt>
                <dd className="text-steel-100">{titleValues.sopNumber}</dd>
              </div>
            )}
            {categoryTag && (
              <div>
                <dt className="text-steel-400">Category</dt>
                <dd className="text-steel-100">
                  {sopCategoryOptions.find((c) => c.slug === categoryTag)?.display_name ?? categoryTag}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-steel-400">Sections</dt>
              <dd className="text-steel-100">
                <ul className="list-disc pl-5">
                  {selectedKindIds.map((id) => {
                    const k = kinds.find((x) => x.id === id)
                    if (!k) return null
                    const picks = pickedBlocksByKind[k.slug] ?? []
                    return (
                      <li key={id}>
                        {k.display_name}
                        {picks.length > 0 && (
                          <span className="text-xs text-steel-400 ml-1">
                            ({picks.length} from library)
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
          </dl>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded border border-steel-600 px-4 py-2 text-sm text-steel-300"
              data-testid="wizard-back-3"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitFinal}
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900 disabled:opacity-40"
              data-testid="wizard-create-draft"
            >
              Create draft
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-steel-300 text-sm" data-testid="wizard-submitting">
          Creating your SOP…
        </div>
      )}

      {/* Phase 13: BlockPicker overlay — driven by pickerTarget state */}
      {pickerTarget && (
        <BlockPicker
          open={true}
          onClose={() => setPickerTarget(null)}
          kindSlug={pickerTarget.libraryKindSlug}
          sopCategory={categoryTag}
          onAdd={handlePickerAdd}
        />
      )}
    </div>
  )
}
