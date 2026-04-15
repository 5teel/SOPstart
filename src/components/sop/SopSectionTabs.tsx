'use client'
import {
  AlertTriangle,
  ShieldCheck,
  ListChecks,
  Siren,
  Play,
  CheckCircle2,
  FileText,
  Sparkles,
} from 'lucide-react'
import type { SopSection } from '@/types/sop'
import { resolveTabStyling } from '@/lib/sections/resolveRenderFamily'

interface SopSectionTabsProps {
  sections: SopSection[]
  activeId: string
  onTabChange: (id: string) => void
  hasVideo?: boolean
  videoOutdated?: boolean
  isVideoActive?: boolean
}

function toTitleCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Icon-name → lucide component lookup. Populated from section_kinds.icon seeds.
const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle,
  ShieldCheck,
  ListChecks,
  Siren,
  CheckCircle2,
  FileText,
  Sparkles,
}

// Tailwind color classes keyed by section_kinds.color_family. Static strings
// so Tailwind's JIT picks them up at build time.
const COLOR_CLASSES: Record<string, { active: string; border: string }> = {
  'red-400':      { active: 'text-red-400',      border: 'border-red-400' },
  'blue-400':     { active: 'text-blue-400',     border: 'border-blue-400' },
  'brand-yellow': { active: 'text-brand-yellow', border: 'border-brand-yellow' },
  'green-400':    { active: 'text-green-400',    border: 'border-green-400' },
  'steel-100':    { active: 'text-steel-100',    border: 'border-steel-100' },
}

function getTabLabel(section: SopSection, displayName: string | null): string {
  // 1. Prefer the section_kind display_name when joined
  if (displayName) return displayName
  // 2. Fall back to section.title when it differs from the free-text type name
  if (section.title && section.title.toLowerCase() !== section.section_type.toLowerCase()) {
    return section.title
  }
  // 3. Last resort: title-case the raw section_type
  return toTitleCase(section.section_type)
}

export function SopSectionTabs({ sections, activeId, onTabChange, hasVideo, videoOutdated, isVideoActive }: SopSectionTabsProps) {
  // Sort by section_kind.render_priority (100 fallback for legacy NULL kinds)
  // then by sort_order. Pure sort_order behaviour is preserved when no section
  // has a joined kind because every row gets the same 100 priority and the
  // comparator falls through to sort_order.
  const sorted = [...sections].sort((a, b) => {
    const pa = a.section_kind?.render_priority ?? 100
    const pb = b.section_kind?.render_priority ?? 100
    if (pa !== pb) return pa - pb
    return a.sort_order - b.sort_order
  })

  return (
    <div className="flex overflow-x-auto scrollbar-hide bg-steel-900 border-b border-steel-700 px-4 gap-0">
      {sorted.map((section) => {
        const isActive = section.id === activeId
        const styling = resolveTabStyling(section)
        const Icon = styling.icon ? ICON_MAP[styling.icon] ?? null : null
        const colors = (styling.colorFamily && COLOR_CLASSES[styling.colorFamily]) || COLOR_CLASSES['steel-100']

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onTabChange(section.id)}
            className={[
              'flex-shrink-0 flex flex-col items-center justify-end px-4 h-[52px] gap-1 relative whitespace-nowrap',
              'text-[13px] font-semibold transition-colors',
              isActive ? `${colors.active} border-b-2 ${colors.border}` : 'text-steel-400 hover:text-steel-100',
            ].join(' ')}
          >
            <span className="flex items-center gap-1">
              {Icon && <Icon size={16} />}
              {getTabLabel(section, styling.displayName)}
            </span>
          </button>
        )
      })}
      {hasVideo && (
        <button
          type="button"
          onClick={() => onTabChange('video')}
          className={[
            'flex-shrink-0 flex flex-col items-center justify-end px-4 h-[52px] gap-1 relative whitespace-nowrap',
            'text-[13px] font-semibold transition-colors',
            isVideoActive
              ? 'text-brand-yellow border-b-2 border-brand-yellow'
              : 'text-steel-400 hover:text-steel-100',
          ].join(' ')}
        >
          <span className="flex items-center gap-1">
            <Play size={16} />
            Video
            {videoOutdated && (
              <span
                className="w-2 h-2 rounded-full bg-brand-orange"
                aria-label="Video is outdated"
              />
            )}
          </span>
        </button>
      )}
    </div>
  )
}
