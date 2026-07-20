'use client'

/**
 * Phase 32-07 — thin client shell mounting the ⊞ Chart / ▤ Columns ViewToggle
 * over ONE listOrgTree() fetch done server-side in page.tsx (D-08).
 *
 * Not in the plan's `files_modified` list: `page.tsx` is an async Server
 * Component and cannot hold the toggle's client state itself, nor pass a
 * client onChange callback to `ViewToggle` across the server/client
 * boundary — this wrapper is the minimum extra file required to mount a
 * stateful client toggle from a server page (Rule 3 — blocking issue,
 * mirrors 32-06's CSS-token auto-add).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ViewToggle } from '@/components/admin/org-model/ViewToggle'
import { OrgChartCanvas } from '@/components/admin/org-model/OrgChartCanvas'
import { OrgColumnsBoard } from '@/components/admin/org-model/OrgColumnsBoard'
import { PersonPanel } from '@/components/admin/org-model/PersonPanel'
import type { OrgTree } from '@/types/org-model'
import type { Department } from '@/types/sop'

const VIEW_OPTIONS = [
  { value: 'chart', label: '⊞ Chart' },
  { value: 'columns', label: '▤ Columns' },
]

interface TeamViewShellProps {
  tree: OrgTree
  orgName: string
  orgId: string
  inviteCode: string
  departments: Department[]
}

export function TeamViewShell({ tree, orgName, orgId, inviteCode, departments }: TeamViewShellProps) {
  const [view, setView] = useState<'chart' | 'columns'>('chart')
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const router = useRouter()
  const refetch = () => router.refresh()

  return (
    <div>
      <div className="flex justify-end mb-3">
        <ViewToggle
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => setView(v as 'chart' | 'columns')}
        />
      </div>
      {view === 'chart' ? (
        <OrgChartCanvas tree={tree} orgName={orgName} onChange={refetch} onSelectPerson={setSelectedPerson} />
      ) : (
        <OrgColumnsBoard
          tree={tree}
          orgId={orgId}
          inviteCode={inviteCode}
          departments={departments}
          onChange={refetch}
          onSelectPerson={setSelectedPerson}
        />
      )}
      <PersonPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
    </div>
  )
}
