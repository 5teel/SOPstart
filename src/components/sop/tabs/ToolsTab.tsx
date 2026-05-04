'use client'
import { useMemo } from 'react'
import { Wrench, ShieldCheck } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import type { SopWithSections } from '@/types/sop'

const PPE_KEYWORDS = ['ppe', 'protective', 'protection', 'safety equipment']

function isPpeSection(s: SopWithSections['sop_sections'][number]) {
  const rf = s.section_kind?.render_family
  if (rf === 'ppe') return true
  const text = (s.section_type + ' ' + s.title).toLowerCase()
  return PPE_KEYWORDS.some((kw) => text.includes(kw))
}

export function ToolsTab({ sop }: { sop: SopWithSections }) {
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

  const equipment = sop.applicable_equipment ?? []
  const hasTools = equipment.length > 0 || toolStepMap.size > 0
  const isEmpty = !hasTools && ppeSections.length === 0

  return (
    <BlueprintCanvas>
      <div className="max-w-2xl mx-auto space-y-6 p-6">

        {isEmpty && (
          <div className="blueprint-frame p-8 text-center">
            <Wrench size={32} className="text-[var(--ink-300)] mx-auto mb-3" />
            <p className="text-sm text-[var(--ink-500)]">No tools or equipment specified for this SOP.</p>
          </div>
        )}

        {/* Applicable equipment from SOP record */}
        {equipment.length > 0 && (
          <div className="blueprint-frame p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
              <Wrench size={13} className="text-[var(--ink-500)]" />
              <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Applicable Equipment</span>
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

        {/* PPE sections */}
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

      </div>
    </BlueprintCanvas>
  )
}
