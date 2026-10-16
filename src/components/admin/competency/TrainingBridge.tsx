'use client'

/**
 * Phase 59 (A-05) -- the training lanes and a person's training record. ADR-0019 replaced the
 * Phase 35 matrix with TrainingLanes; Full record opens the PersonPanel on that person (and
 * SOP, when one is in focus).
 */

import { useState } from 'react'
import { PersonPanel } from '@/components/admin/org-model/PersonPanel'
import { TrainingLanes } from '@/components/admin/competency/TrainingLanes'
import type { OrgTree } from '@/types/org-model'
import type { Department } from '@/types/sop'
import type { LibraryRow } from '@/hooks/useLibrary'
import type { LibraryArea } from '@/lib/library/areas'

function personLabelFromTree(tree: OrgTree, personId: string): { name: string; roleLabel?: string } | null {
  const departments = [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]
  for (const dept of departments) {
    for (const role of dept.roles) {
      for (const person of role.people) {
        if (!person.isVacancy && person.id === personId) return { name: person.name, roleLabel: role.name }
      }
    }
  }
  return null
}

/** The lanes open on the department with the most people, so they do not read empty on an org where the first one has none. */
function mostPeopleFirst(tree: OrgTree, departments: Department[]): Department[] {
  const count = new Map<string, number>()
  for (const d of [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]) {
    count.set(d.id, d.roles.reduce((n, r) => n + r.people.filter((p) => !p.isVacancy).length, 0))
  }
  return [...departments].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
}

export function TrainingBridge({
  tree,
  departments: all,
  rows,
  areas,
}: {
  tree: OrgTree
  departments: Department[]
  rows: readonly LibraryRow[]
  areas: readonly LibraryArea[]
}) {
  const departments = mostPeopleFirst(tree, all)
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [focusSopId, setFocusSopId] = useState<string | null>(null)

  const openRecord = (personId: string, sopId: string | null) => {
    const person = personLabelFromTree(tree, personId)
    setSelectedPerson({ id: personId, name: person?.name ?? 'Unknown', roleLabel: person?.roleLabel })
    setFocusSopId(sopId)
  }

  return (
    <div>
      <TrainingLanes departments={departments} rows={rows} areas={areas} onOpenRecord={openRecord} />
      <PersonPanel
        person={selectedPerson}
        focusSopId={focusSopId}
        onClose={() => {
          setSelectedPerson(null)
          setFocusSopId(null)
        }}
      />
    </div>
  )
}
