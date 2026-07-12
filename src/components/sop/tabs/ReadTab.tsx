'use client'
import { useMemo } from 'react'
import { AlertTriangle, Siren, Zap, Wrench, ShieldCheck } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import type { SopWithSections } from '@/types/sop'

// Phase 30 UX-05: merged Overview + Tools + Hazards into one scrollable brief.
// PPE and equipment each render ONCE (the old ToolsTab + HazardsTab both
// rendered PPE; Overview + Tools both rendered equipment).
//
// Phase 28 D28-07: worker-facing date formatting only — NO badge, NO warning,
// NO governance gate anywhere in this file. Plain informational text.

const HAZARD_KEYWORDS = ['hazard', 'danger', 'warning', 'emergency', 'risk', 'safety']
const PPE_KEYWORDS = ['ppe', 'protective', 'protection', 'safety equipment']

type Section = SopWithSections['sop_sections'][number]

function isPpeSection(s: Section) {
  const rf = s.section_kind?.render_family
  if (rf === 'ppe') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return PPE_KEYWORDS.some((kw) => text.includes(kw))
}

function isHazardSection(s: Section) {
  const rf = s.section_kind?.render_family
  if (rf === 'hazard' || rf === 'emergency') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return HAZARD_KEYWORDS.some((kw) => text.includes(kw))
}

function formatNzDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-4 py-2 border-b border-[var(--ink-100)] last:border-b-0">
      <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)] w-[120px] flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[var(--ink-900)] flex-1">{value}</span>
    </div>
  )
}

interface StepAlert {
  stepNumber: number
  text: string
  message: string
  kind: 'warning' | 'caution'
}

export function ReadTab({ sop }: { sop: SopWithSections }) {
  const totalSteps = sop.sop_sections.reduce((n, s) => n + (s.sop_steps?.length ?? 0), 0)
  const totalSections = sop.sop_sections.length

  // Deduplicated tools from steps, keyed by tool name → step numbers
  const toolStepMap = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const section of sop.sop_sections) {
      for (const step of section.sop_steps ?? []) {
        for (const tool of step.required_tools ?? []) {
          const existing = map.get(tool) ?? []
          existing.push(step.step_number)
          map.set(tool, existing)
        }
      }
    }
    return map
  }, [sop.sop_sections])

  const ppeSections = useMemo(
    () => sop.sop_sections.filter(isPpeSection),
    [sop.sop_sections]
  )
  const hazardSections = useMemo(
    () => sop.sop_sections.filter(isHazardSection),
    [sop.sop_sections]
  )
  const stepAlerts = useMemo<StepAlert[]>(() => {
    const alerts: StepAlert[] = []
    for (const section of sop.sop_sections) {
      for (const step of section.sop_steps ?? []) {
        if (step.warning) alerts.push({ stepNumber: step.step_number, text: step.text, message: step.warning, kind: 'warning' })
        if (step.caution) alerts.push({ stepNumber: step.step_number, text: step.text, message: step.caution, kind: 'caution' })
      }
    }
    return alerts
  }, [sop.sop_sections])

  const equipment = sop.applicable_equipment ?? []

  return (
    <BlueprintCanvas>
      <div className="max-w-2xl mx-auto space-y-6 p-6">

        {/* Title + status */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink-900)] leading-tight">
            {sop.title ?? 'Untitled SOP'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {sop.sop_number && (
              <span className="pill">{sop.sop_number}</span>
            )}
            <span className="pill">v{sop.version}</span>
            <span className="pill">{sop.status}</span>
          </div>
        </div>

        {/* Metadata table */}
        <div className="blueprint-frame p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
            <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">SOP Details</span>
          </div>
          <div className="px-4 divide-y divide-[var(--ink-100)]">
            <MetaRow label="Category" value={sop.category} />
            <MetaRow label="Department" value={sop.department} />
            <MetaRow label="Author" value={sop.author} />
            <MetaRow label="Revised" value={sop.revision_date} />
            <MetaRow label="Current as of" value={formatNzDate(sop.last_reviewed_at ?? sop.published_at)} />
            <MetaRow label="Sections" value={`${totalSections} section${totalSections !== 1 ? 's' : ''}`} />
            <MetaRow label="Steps" value={`${totalSteps} step${totalSteps !== 1 ? 's' : ''}`} />
          </div>
        </div>

        {/* Equipment — rendered ONCE (was in Overview AND Tools) */}
        {equipment.length > 0 && (
          <div className="blueprint-frame p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
              <Wrench size={13} className="text-[var(--ink-500)]" />
              <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Equipment Required</span>
            </div>
            <ul className="divide-y divide-[var(--ink-100)]">
              {equipment.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-measure)] flex-shrink-0" />
                  <span className="text-sm text-[var(--ink-900)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tools required per step */}
        {toolStepMap.size > 0 && (
          <div className="blueprint-frame p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
              <Wrench size={13} className="text-[var(--ink-500)]" />
              <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Tools by Step</span>
            </div>
            <ul className="divide-y divide-[var(--ink-100)]">
              {[...toolStepMap.entries()].map(([tool, steps]) => (
                <li key={tool} className="flex items-center gap-4 px-4 py-3">
                  <span className="text-sm text-[var(--ink-900)] flex-1">{tool}</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {steps.map((n) => (
                      <span key={n} className="pill text-[10px] px-1.5 py-0.5">Step {n}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Certifications */}
        {sop.required_certifications && sop.required_certifications.length > 0 && (
          <div className="blueprint-frame p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
              <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Required Certifications</span>
            </div>
            <ul className="px-4 py-3 space-y-1">
              {sop.required_certifications.map((cert, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--ink-900)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-signoff)] flex-shrink-0" />
                  {cert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PPE sections — rendered ONCE (was in Tools AND Hazards) */}
        {ppeSections.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[var(--accent-measure)]" />
              <span className="mono text-xs uppercase tracking-wider text-[var(--accent-measure)]">PPE Required</span>
            </div>
            {ppeSections.map((section) => (
              <div
                key={section.id}
                className="border border-[var(--accent-measure)]/30 rounded-xl overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--accent-measure) 6%, white)' }}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--accent-measure)]/20">
                  <ShieldCheck size={14} className="text-[var(--accent-measure)] flex-shrink-0" />
                  <span className="mono text-xs font-bold uppercase tracking-wider text-[var(--accent-measure)]">
                    {section.title}
                  </span>
                </div>
                {section.content && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-[var(--ink-900)] leading-relaxed whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hazard sections */}
        {hazardSections.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Siren size={16} className="text-[var(--accent-escalate)]" />
              <span className="mono text-xs uppercase tracking-wider text-[var(--accent-escalate)]">Hazards</span>
            </div>
            {hazardSections.map((section) => (
              <div
                key={section.id}
                className="border border-[var(--accent-escalate)]/30 rounded-xl overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--accent-escalate) 6%, white)' }}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--accent-escalate)]/20">
                  <AlertTriangle size={15} className="text-[var(--accent-escalate)] flex-shrink-0" />
                  <span className="mono text-xs font-bold uppercase tracking-wider text-[var(--accent-escalate)]">
                    {section.title}
                  </span>
                </div>
                {section.content && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-[var(--ink-900)] leading-relaxed whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step-level warnings and cautions */}
        {stepAlerts.length > 0 && (
          <div className="space-y-3">
            <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Step-level alerts</span>
            {stepAlerts.map((alert, i) => {
              const isWarning = alert.kind === 'warning'
              const color = isWarning ? 'var(--accent-escalate)' : 'var(--accent-decision)'
              const Icon = isWarning ? AlertTriangle : Zap
              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                    background: `color-mix(in srgb, ${color} 6%, white)`,
                  }}
                >
                  <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}>
                    <Icon size={13} style={{ color }} className="flex-shrink-0" />
                    <span className="mono text-xs uppercase tracking-wider" style={{ color }}>
                      {isWarning ? 'Warning' : 'Caution'} · Step {alert.stepNumber}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-[var(--ink-500)] mb-1 line-clamp-1">{alert.text}</p>
                    <p className="text-sm text-[var(--ink-900)]">{alert.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Section map */}
        <div className="blueprint-frame p-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
            <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Sections</span>
          </div>
          <div className="divide-y divide-[var(--ink-100)]">
            {sop.sop_sections.map((section, idx) => (
              <div key={section.id} className="flex items-center gap-4 px-4 py-3">
                <span className="mono text-xs text-[var(--ink-500)] w-6 flex-shrink-0 tabular-nums">{idx + 1}</span>
                <span className="text-sm text-[var(--ink-900)] flex-1">{section.title}</span>
                <span className="mono text-xs text-[var(--ink-500)] flex-shrink-0">
                  {section.sop_steps?.length ?? 0} step{(section.sop_steps?.length ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </BlueprintCanvas>
  )
}
