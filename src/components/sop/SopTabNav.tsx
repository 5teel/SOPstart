'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabNav, type TabNavItem } from '@/components/ui/TabNav'

export const SOP_TABS = ['overview', 'tools', 'hazards', 'flow', 'model', 'walkthrough'] as const
export type SopTabId = typeof SOP_TABS[number]

const TAB_DEFS: TabNavItem[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'tools',       label: 'Tools' },
  { id: 'hazards',     label: 'Hazards' },
  { id: 'flow',        label: 'Flow' },
  { id: 'model',       label: 'Model' },
  { id: 'walkthrough', label: 'Walkthrough' },
]

export function isSopTabId(v: string | null | undefined): v is SopTabId {
  return typeof v === 'string' && (SOP_TABS as readonly string[]).includes(v)
}

export function useActiveTab(): SopTabId {
  const search = useSearchParams()
  const raw = search.get('tab')
  return isSopTabId(raw) ? raw : 'overview'
}

export function SopTabNav({ className = '' }: { className?: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const active = isSopTabId(search.get('tab')) ? (search.get('tab') as SopTabId) : 'overview'

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
