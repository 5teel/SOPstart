'use client'
import { useMemo } from 'react'
import { AlertTriangle, Siren, Zap } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import type { SopWithSections } from '@/types/sop'

const HAZARD_KEYWORDS = ['hazard', 'danger', 'warning', 'emergency', 'risk', 'safety']
const PPE_KEYWORDS = ['ppe', 'protective', 'protection']

function isHazardSection(s: SopWithSections['sop_sections'][number]) {
  const rf = s.section_kind?.render_family
  if (rf === 'hazard' || rf === 'emergency') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return HAZARD_KEYWORDS.some((kw) => text.includes(kw))
}

function isPpeSection(s: SopWithSections['sop_sections'][number]) {
  const rf = s.section_kind?.render_family
  if (rf === 'ppe') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return PPE_KEYWORDS.some((kw) => text.includes(kw))
}

interface StepAlert {
  stepNumber: number
  text: string
  message: string
  kind: 'warning' | 'caution'
}

export function HazardsTab({ sop }: { sop: SopWithSections }) {
  const hazardSections = useMemo(
    () => sop.sop_sections.filter(isHazardSection),
    [sop.sop_sections]
  )
  const ppeSections = useMemo(
    () => sop.sop_sections.filter(isPpeSection),
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

  const isEmpty = hazardSections.length === 0 && ppeSections.length === 0 && stepAlerts.length === 0

  return (
    <BlueprintCanvas>
      <div className="max-w-2xl mx-auto space-y-6 p-6">

        {isEmpty && (
          <div className="blueprint-frame p-8 text-center">
            <AlertTriangle size={32} className="text-[var(--ink-300)] mx-auto mb-3" />
            <p className="text-sm text-[var(--ink-500)]">No hazards or PPE sections found in this SOP.</p>
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

        {/* PPE sections */}
        {ppeSections.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="mono text-xs uppercase tracking-wider text-[var(--accent-measure)]">PPE Required</span>
            </div>
            {ppeSections.map((section) => (
              <div
                key={section.id}
                className="border border-[var(--accent-measure)]/30 rounded-xl overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--accent-measure) 6%, white)' }}
              >
                <div className="px-4 py-3 border-b border-[var(--accent-measure)]/20">
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

      </div>
    </BlueprintCanvas>
  )
}
