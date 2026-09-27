'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, Camera, Check, Lightbulb, Play, ShieldCheck, Siren, Wrench, Zap } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { categoryLabel } from '@/lib/sop-categories'
import {
  isEmergencySection,
  isHazardSection,
  isPpeSection,
  isScopeSection,
  jobTools,
  procedureSections,
  type Section,
} from '@/lib/sop/sections'
import { useWalkthroughStore } from '@/stores/walkthrough'
import type { SopWithSections } from '@/types/sop'

/**
 * The SOP as one document, in the order a worker needs it:
 *
 *   Orient   — what this is, which job inside it you are doing
 *   Prepare  — safety (acknowledged here, inline), tools and parts for THAT job
 *   Do       — the job's steps, all visible; "Walk it" steps through them one at a time
 *
 * Replaces the Phase 30 brief, which was a metadata table plus a
 * tools-by-step list and never showed a single step — the worker was asked to
 * read a page that did not contain the procedure (2026-09-27).
 *
 * Phase 28 D28-07: worker-facing date formatting only — NO badge, NO warning,
 * NO governance gate anywhere in this file. Plain informational text.
 */

function formatNzDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Heading({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <h2 className="mono text-[11px] uppercase tracking-[0.1em]" style={{ color: tone ?? 'var(--ink-500)' }}>
      {children}
    </h2>
  )
}

/** A safety section: tinted card, its content as prose. */
function SafetyCard({ section, tone, icon: Icon }: { section: Section; tone: string; icon: typeof AlertTriangle }) {
  if (!section.content) return null
  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`, background: `color-mix(in srgb, ${tone} 6%, white)` }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: `color-mix(in srgb, ${tone} 20%, transparent)` }}>
        <Icon size={14} style={{ color: tone }} className="flex-shrink-0" />
        <span className="mono text-xs font-bold uppercase tracking-wider" style={{ color: tone }}>{section.title}</span>
      </div>
      <p className="px-4 py-3 text-sm leading-relaxed text-[var(--ink-900)] whitespace-pre-line">{section.content}</p>
    </div>
  )
}

export function ReadTab({
  sop,
  jobId,
  onJobChange,
}: {
  sop: SopWithSections
  /** The chosen procedure's section id (the page owns it; it rides in ?job=). */
  jobId?: string | null
  onJobChange?: (sectionId: string) => void
}) {
  const jobs = useMemo(() => procedureSections(sop), [sop])
  const job = jobs.find((s) => s.id === jobId) ?? jobs[0] ?? null
  const scope = sop.sop_sections.find(isScopeSection)
  const hazards = sop.sop_sections.filter(isHazardSection)
  const ppe = sop.sop_sections.filter(isPpeSection)
  const emergency = sop.sop_sections.filter(isEmergencySection)
  const hasSafety = [...hazards, ...ppe, ...emergency].some((s) => s.content)
  const references = sop.sop_sections.filter(
    (s) => (s.sop_steps?.length ?? 0) === 0 && s !== scope && !hazards.includes(s) && !ppe.includes(s) && !emergency.includes(s) && s.content,
  )
  const tools = job ? jobTools(job) : []
  const equipment = sop.applicable_equipment ?? []
  const certs = sop.required_certifications ?? []

  // The same flag the walkthrough gates on — acknowledging here means the
  // "Before you start" screen never has to interrupt Walk it.
  const acknowledged = useWalkthroughStore((s) => s.isAcknowledged(sop.id))
  const acknowledgeSafety = useWalkthroughStore((s) => s.acknowledgeSafety)

  const walkHref = `/sops/${sop.id}?tab=walk${job && jobs.length > 1 ? `&job=${job.id}` : ''}`
  const meta = [categoryLabel(sop.category_slug ?? null), sop.department].filter(Boolean).join(' · ')

  return (
    <BlueprintCanvas>
      <div className="max-w-2xl mx-auto space-y-8 p-6">

        {/* ── Orient ─────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold leading-tight text-[var(--ink-900)]">{sop.title ?? 'Untitled SOP'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {sop.sop_number && <span className="pill">{sop.sop_number}</span>}
            <span className="pill">v{sop.version}</span>
            {meta && <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">{meta}</span>}
          </div>
          {scope?.content && (
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink-700)] whitespace-pre-line">{scope.content}</p>
          )}
          <p className="mono mt-3 text-[11px] text-[var(--ink-500)]">
            Current as of {formatNzDate(sop.last_reviewed_at ?? sop.published_at) ?? '—'}
            {sop.author ? ` · Author ${sop.author}` : ''}
          </p>
        </div>

        {/* Which job? — only when the SOP holds more than one procedure */}
        {jobs.length > 1 && (
          <div>
            <Heading>Which job are you doing?</Heading>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Job">
              {jobs.map((s) => {
                const active = s.id === job?.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid="job-chip"
                    onClick={() => onJobChange?.(s.id)}
                    className={`min-h-[44px] rounded-md border px-3 text-left text-sm font-medium transition-colors ${
                      active
                        ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-white'
                        : 'border-[var(--ink-300)] bg-white text-[var(--ink-700)] hover:border-[var(--ink-900)]'
                    }`}
                  >
                    {s.title}
                    <span className={`mono ml-2 text-[11px] ${active ? 'text-white/70' : 'text-[var(--ink-500)]'}`}>
                      {s.sop_steps.length} steps
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Prepare ────────────────────────────────────────────── */}
        {(hasSafety || tools.length > 0 || equipment.length > 0 || certs.length > 0) && (
          <div className="space-y-4">
            <Heading>Before you start</Heading>

            {hazards.map((s) => <SafetyCard key={s.id} section={s} tone="var(--accent-escalate)" icon={AlertTriangle} />)}
            {ppe.map((s) => <SafetyCard key={s.id} section={s} tone="var(--accent-measure)" icon={ShieldCheck} />)}
            {emergency.map((s) => <SafetyCard key={s.id} section={s} tone="var(--accent-escalate)" icon={Siren} />)}

            {hasSafety && (
              acknowledged ? (
                <p className="flex items-center gap-2 text-sm text-[var(--accent-ok,#10b981)]" data-testid="safety-acknowledged">
                  <Check size={16} aria-hidden="true" /> Safety requirements read
                </p>
              ) : (
                <button
                  type="button"
                  data-testid="safety-acknowledge"
                  onClick={() => acknowledgeSafety(sop.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[var(--ink-900)] px-4 text-sm font-semibold text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                >
                  <ShieldCheck size={16} aria-hidden="true" /> I&apos;ve read the safety requirements
                </button>
              )
            )}

            {(tools.length > 0 || equipment.length > 0) && (
              <div className="blueprint-frame p-0 overflow-hidden" data-testid="job-tools">
                <div className="flex items-center gap-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)] px-4 py-2.5">
                  <Wrench size={13} className="text-[var(--ink-500)]" />
                  <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">
                    Tools and parts{job && jobs.length > 1 ? ` — ${job.title}` : ''}
                  </span>
                </div>
                <ul className="divide-y divide-[var(--ink-100)]">
                  {[...equipment, ...tools.filter((t) => !equipment.includes(t))].map((item) => (
                    <li key={item} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent-measure)]" />
                      <span className="text-sm text-[var(--ink-900)]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {certs.length > 0 && (
              <div className="blueprint-frame p-0 overflow-hidden">
                <div className="border-b border-[var(--ink-100)] bg-[var(--paper-2)] px-4 py-2">
                  <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Required certifications</span>
                </div>
                <ul className="space-y-1 px-4 py-3">
                  {certs.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-sm text-[var(--ink-900)]">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent-signoff)]" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Do ─────────────────────────────────────────────────── */}
        {job ? (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Heading>The steps</Heading>
                <p className="mt-1 text-lg font-semibold text-[var(--ink-900)]">
                  {job.title}
                  <span className="mono ml-2 text-[11px] font-normal text-[var(--ink-500)]">{job.sop_steps.length} steps</span>
                </p>
              </div>
              <Link
                href={walkHref}
                data-testid="walk-it"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[var(--ink-900)] px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                <Play size={14} aria-hidden="true" /> Walk it step by step
              </Link>
            </div>

            <ol className="mt-4 divide-y divide-[var(--ink-100)] rounded-lg border border-[var(--ink-300)] bg-white" data-testid="job-steps">
              {[...job.sop_steps].sort((a, b) => a.step_number - b.step_number).map((step, idx) => {
                const images = (job.sop_images ?? []).filter((img) => img.step_id === step.id)
                return (
                  <li key={step.id} className="flex gap-4 px-4 py-4">
                    <span className="mono w-7 flex-shrink-0 pt-0.5 text-right text-sm tabular-nums text-[var(--ink-500)]">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-relaxed text-[var(--ink-900)]">{step.text}</p>
                      {step.warning && (
                        <p className="mt-2 flex items-start gap-2 rounded-md border border-[var(--accent-escalate)]/30 bg-[var(--accent-escalate)]/10 px-3 py-2 text-sm text-[var(--accent-escalate)]">
                          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{step.warning}
                        </p>
                      )}
                      {step.caution && (
                        <p className="mt-2 flex items-start gap-2 rounded-md border border-[var(--accent-decision)]/30 bg-[var(--accent-decision)]/10 px-3 py-2 text-sm text-[var(--accent-decision)]">
                          <Zap size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{step.caution}
                        </p>
                      )}
                      {step.tip && (
                        <p className="mt-2 flex items-start gap-2 text-sm text-[var(--ink-500)]">
                          <Lightbulb size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{step.tip}
                        </p>
                      )}
                      {step.photo_required && (
                        <p className="mono mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--accent-decision)]">
                          <Camera size={12} aria-hidden="true" /> Photo required
                        </p>
                      )}
                      {images.map((img) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={img.id} src={img.storage_path} alt={img.alt_text ?? ''} className="mt-3 max-h-64 rounded-md border border-[var(--ink-100)]" />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-500)]">This SOP has no steps yet.</p>
        )}

        {/* Reference material — there if you need it, out of the way if not */}
        {references.length > 0 && (
          <details className="rounded-lg border border-[var(--ink-100)] bg-white">
            <summary className="mono cursor-pointer px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)]">
              Reference ({references.length})
            </summary>
            <div className="divide-y divide-[var(--ink-100)] border-t border-[var(--ink-100)]">
              {references.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--ink-900)]">{s.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--ink-700)]">{s.content}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </BlueprintCanvas>
  )
}
