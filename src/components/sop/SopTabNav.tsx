'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabNav, type TabNavItem } from '@/components/ui/TabNav'

export const SOP_TABS = ['read', 'walk', 'flow'] as const
export type SopTabId = typeof SOP_TABS[number]

const TAB_DEFS: TabNavItem[] = [
  { id: 'read', label: 'Read' },
  { id: 'walk', label: 'Walk it' },
  { id: 'flow', label: 'Flow' },
]

// UX-05: legacy ?tab= params from the pre-Phase-30 6-tab surface map onto the
// 3 new tabs so old bookmarks / shared deep-links land forever.
// overview | tools | hazards | model → read; walkthrough → walk.
const LEGACY_TAB_MAP: Record<string, SopTabId> = {
  overview: 'read',
  tools: 'read',
  hazards: 'read',
  model: 'read',
  walkthrough: 'walk',
}

export function isSopTabId(v: string | null | undefined): v is SopTabId {
  return typeof v === 'string' && (SOP_TABS as readonly string[]).includes(v)
}

/** Applies the legacy map BEFORE the isSopTabId guard; defaults to 'read'. */
function resolveTab(raw: string | null): SopTabId {
  const mapped = raw !== null && raw in LEGACY_TAB_MAP ? LEGACY_TAB_MAP[raw] : raw
  return isSopTabId(mapped) ? mapped : 'read'
}

export function useActiveTab(): SopTabId {
  const search = useSearchParams()
  return resolveTab(search.get('tab'))
}

export function SopTabNav({ className = '' }: { className?: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const active = resolveTab(search.get('tab'))

  const handleChange = (id: string) => {
    if (!isSopTabId(id)) return
    const params = new URLSearchParams(search.toString())
    params.set('tab', id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <TabNav
      ariaLabel="SOP sections"
      tabs={TAB_DEFS}
      activeId={active}
      onChange={handleChange}
      className={className}
    />
  )
}
