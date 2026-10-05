'use client'

/**
 * Phase 59 (A-05) -- the training matrix and a person's training record, kept
 * reachable for admins on /admin/training until Phase 61 re-homes them. Lifted
 * from the retired team view: the matrix cell picks a person and a SOP, the
 * PersonPanel opens on that pair. The layout's Back bar is the way out.
 */

import { useState } from 'react'
import { PersonPanel } from '@/components/admin/org-model/PersonPanel'
import { TrainingMatrixView } from '@/components/admin/competency/TrainingMatrixView'
import type { OrgTree } from '@/types/org-model'
import type { Department } from '@/types/sop'

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

export function TrainingBridge({ tree, departments }: { tree: OrgTree; departments: Department[] }) {
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [focusSopId, setFocusSopId] = useState<string | null>(null)

  const handleSelectCell = (personId: string, sopId: string) => {
    const person = personLabelFromTree(tree, personId)
    setSelectedPerson({ id: personId, name: person?.name ?? 'Unknown', roleLabel: person?.roleLabel })
    setFocusSopId(sopId)
  }

  return (
    <div>
      <TrainingMatrixView departments={departments} onSelectCell={handleSelectCell} />
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
