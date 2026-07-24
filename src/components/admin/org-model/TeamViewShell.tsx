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
import { TrainingMatrixView } from '@/components/admin/competency/TrainingMatrixView'
import type { OrgTree, OrgTreeDepartment } from '@/types/org-model'
import type { Department } from '@/types/sop'

const VIEW_OPTIONS = [
  { value: 'chart', label: '⊞ Chart' },
  { value: 'columns', label: '▤ Columns' },
  { value: 'matrix', label: '▦ Matrix' },
]

function allDepartments(tree: OrgTree): OrgTreeDepartment[] {
  return [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]
}

function personLabelFromTree(tree: OrgTree, personId: string): { name: string; roleLabel?: string } | null {
  for (const dept of allDepartments(tree)) {
    for (const role of dept.roles) {
      for (const person of role.people) {
        if (!person.isVacancy && person.id === personId) {
          return { name: person.name, roleLabel: role.name }
        }
      }
    }
  }
  return null
}

interface TeamViewShellProps {
  tree: OrgTree
  orgName: string
  orgId: string
  inviteCode: string
  departments: Department[]
}

export function TeamViewShell({ tree, orgName, orgId, inviteCode, departments }: TeamViewShellProps) {
  const [view, setView] = useState<'chart' | 'columns' | 'matrix'>('chart')
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [focusSopId, setFocusSopId] = useState<string | null>(null)
  const router = useRouter()
  const refetch = () => router.refresh()

  const handleSelectCell = (personId: string, sopId: string) => {
    const person = personLabelFromTree(tree, personId)
    setSelectedPerson({ id: personId, name: person?.name ?? 'Unknown', roleLabel: person?.roleLabel })
    setFocusSopId(sopId)
  }

  const handleClosePanel = () => {
    setSelectedPerson(null)
    setFocusSopId(null)
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <ViewToggle
          options={VIEW_OPTIONS}
          value={view}
          onChange={(v) => setView(v as 'chart' | 'columns' | 'matrix')}
        />
      </div>
      {view === 'chart' ? (
        <OrgChartCanvas tree={tree} orgName={orgName} onChange={refetch} onSelectPerson={setSelectedPerson} />
      ) : view === 'columns' ? (
        <OrgColumnsBoard
          tree={tree}
          orgId={orgId}
          inviteCode={inviteCode}
          departments={departments}
          onChange={refetch}
          onSelectPerson={setSelectedPerson}
        />
      ) : (
        <TrainingMatrixView departments={departments} onSelectCell={handleSelectCell} />
      )}
      <PersonPanel person={selectedPerson} focusSopId={focusSopId} onClose={handleClosePanel} />
    </div>
  )
}
