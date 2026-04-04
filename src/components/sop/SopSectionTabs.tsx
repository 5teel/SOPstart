'use client'
import { AlertTriangle, ShieldCheck, ListChecks, Siren, Play } from 'lucide-react'
import type { SopSection } from '@/types/sop'

interface SopSectionTabsProps {
  sections: SopSection[]
  activeType: string
  onTabChange: (type: string) => void
  hasVideo?: boolean
  videoOutdated?: boolean
}

const SECTION_DISPLAY_NAMES: Record<string, string> = {
  hazards: 'Hazards',
  ppe: 'PPE',
  steps: 'Steps',
  emergency: 'Emergency',
  overview: 'Overview',
  notes: 'Notes',
}

function toTitleCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getTabLabel(sectionType: string): string {
  return SECTION_DISPLAY_NAMES[sectionType] ?? toTitleCase(sectionType)
}

type TabColorConfig = {
  active: string
  border: string
  icon: React.ElementType | null
}

const SECTION_COLORS: Record<string, TabColorConfig> = {
  hazards: { active: 'text-red-400', border: 'border-red-400', icon: AlertTriangle },
  ppe: { active: 'text-blue-400', border: 'border-blue-400', icon: ShieldCheck },
  steps: { active: 'text-brand-yellow', border: 'border-brand-yellow', icon: ListChecks },
  emergency: { active: 'text-red-400', border: 'border-red-400', icon: Siren },
}

function getTabColors(sectionType: string): TabColorConfig {
  return SECTION_COLORS[sectionType] ?? { active: 'text-steel-100', border: 'border-steel-100', icon: null }
}

export function SopSectionTabs({ sections, activeType, onTabChange, hasVideo, videoOutdated }: SopSectionTabsProps) {
  // Sort by sort_order
  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex overflow-x-auto scrollbar-hide bg-steel-900 border-b border-steel-700 px-4 gap-0">
      {sorted.map((section) => {
        const isActive = section.section_type === activeType
        const { active, border, icon: Icon } = getTabColors(section.section_type)

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onTabChange(section.section_type)}
            className={[
              'flex-shrink-0 flex flex-col items-center justify-end px-4 h-[52px] gap-1 relative whitespace-nowrap',
              'text-[13px] font-semibold transition-colors',
              isActive ? `${active} border-b-2 ${border}` : 'text-steel-400 hover:text-steel-100',
            ].join(' ')}
          >
            <span className="flex items-center gap-1">
              {Icon && <Icon size={16} />}
              {getTabLabel(section.section_type)}
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
            activeType === 'video'
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
