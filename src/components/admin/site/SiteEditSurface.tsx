'use client'

/**
 * Phase 63 (R7) -- Site & departments: the departments strip over the site editor (or the
 * empty state), moved out of AdminShell into its own module. Departments are the library's
 * areas, so every change also refreshes the areas and the drafts list.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listSiteForOrg } from '@/actions/site'
import { DepartmentsStrip } from '@/components/admin/site/DepartmentsStrip'
import { SiteEmptyState } from '@/components/admin/site/SiteEmptyState'
import { SiteWorkspace } from '@/components/admin/site/SiteWorkspace'

const SITE_KEY = ['site-org']

export function SiteEditSurface({ onDone }: { onDone(): void }) {
  const qc = useQueryClient()
  const { data: site } = useQuery({ queryKey: SITE_KEY, queryFn: () => listSiteForOrg() })
  const refresh = () => {
    for (const queryKey of [SITE_KEY, ['library-areas'], ['manage-drafts']]) void qc.invalidateQueries({ queryKey })
  }

  return (
    <div className="flex flex-col">
      <div className="flex min-h-tap items-center justify-between border-b border-ink-200 px-4">
        <p className="text-ui font-semibold text-ink-900">Site &amp; departments</p>
        <button
          type="button"
          data-testid="site-edit-done"
          onClick={() => {
            refresh()
            onDone()
          }}
          className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-white"
        >
          Done
        </button>
      </div>
      {!site ? (
        <p className="p-4 text-ui text-ink-500">Loading the site editor…</p>
      ) : 'error' in site ? (
        <p role="alert" className="p-4 text-ui text-accent-escalate">
          {site.error}
        </p>
      ) : (
        <>
          <DepartmentsStrip departments={site.departments} onChanged={refresh} />
          {site.layout ? (
            <SiteWorkspace
              key={site.layout.id}
              layout={site.layout}
              machines={site.machines}
              links={site.links}
              departments={site.departments}
              sops={site.sops}
              onDepartmentsChanged={refresh}
            />
          ) : (
            <SiteEmptyState canGenerate={site.canGenerate} onDone={() => void qc.invalidateQueries({ queryKey: SITE_KEY })} />
          )}
        </>
      )}
    </div>
  )
}
