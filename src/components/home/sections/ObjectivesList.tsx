'use client'

/**
 * Phase 63 (R7) -- every objective subject an admin sets from Manage > Site & departments:
 * the site, each department and each machine. The editors lived on the overview and the
 * department meta line, which retire with the rooms. Writes keep their own admin guards.
 */
import { useQuery } from '@tanstack/react-query'
import { listSiteForOrg } from '@/actions/site'
import { useObjectives } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'

export function ObjectivesList() {
  const { data: site } = useQuery({ queryKey: ['site-org'], queryFn: () => listSiteForOrg() })
  const objectives = useObjectives()
  const loaded = site && !('error' in site) ? site : null

  return (
    <div data-testid="objectives-list" className="flex flex-col gap-2 p-4">
      <h3 className="text-lg font-semibold text-ink-900">Objectives</h3>
      <ObjectiveSlot
        subject={{ type: 'site', id: null }}
        current={objectives.find('site', null)}
        prefix="Site"
        emptyLabel="Set an objective"
        emptyStyle="dashed"
      />
      {loaded?.departments.map((d) => (
        <ObjectiveSlot
          key={d.id}
          subject={{ type: 'department', id: d.id }}
          current={objectives.find('department', d.id)}
          prefix={d.name}
          emptyLabel="Set an objective"
          emptyStyle="dashed"
        />
      ))}
      {loaded?.machines.map((m) => (
        <ObjectiveSlot
          key={m.id}
          subject={{ type: 'machine', id: m.id }}
          current={objectives.find('machine', m.id)}
          prefix={m.name}
          emptyLabel="Set an objective"
          emptyStyle="dashed"
        />
      ))}
    </div>
  )
}
