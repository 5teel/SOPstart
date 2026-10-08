'use client'

/**
 * Phase 63 (HOME-04, R7) -- Manage SOPs: New SOP, the drafts, and Site & departments with the
 * objectives that have no other editor. Quiet and last in the menu; change requests stay in
 * Sign-offs. Admin / safety manager only (sectionsForRole mounts it). Reached through
 * next/dynamic from the home shell.
 */
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { listManageDrafts } from '@/actions/manage'
import { OwnerReviewMeta } from '@/components/admin/governance/OwnerReviewMeta'
import { SiteEditSurface } from '@/components/admin/site/SiteEditSurface'
import { ObjectivesList } from '@/components/home/sections/ObjectivesList'
import { focusHref } from '@/lib/sop/focus-path'
import { HOME, homeFrom } from '@/lib/shell/home-state'

const BUTTON =
  'flex min-h-tap items-center justify-center rounded-lg border border-ink-300 bg-white px-4 text-ui font-semibold text-ink-900'

export function ManageSection({ view, onView }: { view: 'site' | null; onView(v: 'site' | null): void }) {
  const { data } = useQuery({ queryKey: ['manage-drafts'], queryFn: () => listManageDrafts() })

  if (view === 'site') {
    return (
      <section data-testid="section-manage" className="flex flex-col">
        <SiteEditSurface onDone={() => onView(null)} />
        <ObjectivesList />
      </section>
    )
  }

  return (
    <section data-testid="section-manage" className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Manage SOPs</h2>
        <p className="text-ui text-ink-500">Write, convert and fix SOPs. Every way in ends in the same editor.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/admin/sops/new"
          data-testid="manage-new"
          className="flex min-h-tap items-center justify-center rounded-lg bg-ink-900 px-4 text-ui font-semibold text-white"
        >
          New SOP
        </Link>
        <button type="button" data-testid="manage-site" onClick={() => onView('site')} className={BUTTON}>
          Site &amp; departments
        </button>
      </div>
      <h3 className="text-lg font-semibold text-ink-900">Your drafts</h3>
      {!data ? (
        <p className="text-ui text-ink-500">Loading…</p>
      ) : 'error' in data ? (
        <p role="alert" className="text-ui text-accent-escalate">
          {data.error}
        </p>
      ) : data.drafts.length === 0 ? (
        <p className="text-ui text-ink-500">No drafts.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.drafts.map((d) => (
            <li
              key={d.id}
              data-testid="manage-draft"
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-ui text-ink-900"
            >
              <div className="flex min-h-tap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
                <span className="mono text-meta text-ink-500">{d.stuck ? 'stuck' : d.status}</span>
                <Link
                  href={focusHref(d.id, { mode: 'edit', from: homeFrom({ ...HOME, s: 'manage' }) })}
                  data-testid="manage-draft-carry-on"
                  className="mono flex min-h-tap shrink-0 items-center px-1 text-meta text-ink-500 underline"
                >
                  Carry on
                </Link>
              </div>
              <OwnerReviewMeta ownerLabel={d.ownerLabel} reviewDueAt={d.reviewDueAt} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
