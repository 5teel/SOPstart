'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import type { SopWithSections } from '@/types/sop'

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-4 py-2 border-b border-[var(--ink-100)] last:border-b-0">
      <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)] w-[120px] flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[var(--ink-900)] flex-1">{value}</span>
    </div>
  )
}

export function OverviewTab({ sop }: { sop: SopWithSections }) {
  const totalSteps = sop.sop_sections.reduce((n, s) => n + (s.sop_steps?.length ?? 0), 0)
  const totalSections = sop.sop_sections.length

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
            <MetaRow label="Sections" value={`${totalSections} section${totalSections !== 1 ? 's' : ''}`} />
            <MetaRow label="Steps" value={`${totalSteps} step${totalSteps !== 1 ? 's' : ''}`} />
          </div>
        </div>

        {/* Equipment */}
        {sop.applicable_equipment && sop.applicable_equipment.length > 0 && (
          <div className="blueprint-frame p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-[var(--ink-100)] bg-[var(--paper-2)]">
              <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">Equipment Required</span>
            </div>
            <ul className="px-4 py-3 space-y-1">
              {sop.applicable_equipment.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--ink-900)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-measure)] flex-shrink-0" />
                  {item}
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
