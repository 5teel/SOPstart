import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdminContext } from '@/lib/auth/guards'
import { listSiteForOrg } from '@/actions/site'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { SiteWorkspace } from '@/components/admin/site/SiteWorkspace'
import { SiteEmptyState } from '@/components/admin/site/SiteEmptyState'

export const metadata: Metadata = {
  title: 'Site map — SOPstart',
  description: 'Your site as a drawing — each machine you draw becomes a place SOPs belong to.',
}

/**
 * Phase 51 / Plan 51-05 (D-08, T-51-02) — admin-gated /admin/site route.
 *
 * requireAdminContext() runs BEFORE any data call: a worker or supervisor who
 * types this URL is redirected before listSiteForOrg() ever runs. Only
 * serialisable data (from listSiteForOrg's discriminated union) crosses into
 * the client workspace — no admin client import here.
 */
export default async function AdminSitePage() {
  const ctx = await requireAdminContext()
  if ('error' in ctx) {
    redirect(ctx.error === 'Not authenticated' ? '/login' : '/sops')
  }

  const site = await listSiteForOrg()

  return (
    <AdminPageShell
      title="Site map"
      badge="SITE"
      description="Your site as a drawing — each machine you draw becomes a place SOPs belong to."
      contentClassName="w-full px-4 py-6 lg:px-8"
    >
      {'error' in site ? (
        <p className="text-meta text-accent-hazard">{site.error}</p>
      ) : site.layout ? (
        <SiteWorkspace
          layout={site.layout}
          machines={site.machines}
          links={site.links}
          departments={site.departments}
          sops={site.sops}
        />
      ) : (
        <SiteEmptyState canGenerate={site.canGenerate} />
      )}
    </AdminPageShell>
  )
}
