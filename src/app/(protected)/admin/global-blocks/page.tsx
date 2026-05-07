import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin-guard'
import { listBlocks, listBlockCategories } from '@/actions/blocks'
import { BlockListTable } from '@/components/admin/blocks/BlockListTable'

export const metadata: Metadata = {
  title: 'Global Block Library — Platform admin',
}

/**
 * Phase 13 plan 13-05: Platform super-admin landing page for global block curation.
 *
 * Consumes the FINAL listBlocks option surface from 13-01 (`globalOnly: true`).
 * Reuses BlockListTable from 13-01 — no UI duplication.
 *
 * Existing /admin/blocks/[blockId] editor + RLS policy
 * `blocks_platform_admin_global_update` permit super-admin updates to
 * `organisation_id = null` rows, so row links work transparently.
 */
export default async function GlobalBlocksPage() {
  await requirePlatformAdmin()

  // Consume the pre-declared `globalOnly` option from 13-01's listBlocks signature.
  // Include archived globals so super-admin can un-archive / inspect history.
  const [globals, categories] = await Promise.all([
    listBlocks({ globalOnly: true, includeArchived: true }),
    listBlockCategories(),
  ])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-steel-900 min-h-screen">
      <header className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-steel-100">
            Global Block Library — Platform admin
          </h1>
          <p className="text-sm text-steel-400 mt-1 max-w-2xl">
            Curated NZ-industry blocks visible read-only to every org.
            Edits propagate via follow-latest tracking (admins of follow-latest
            SOPs see an update-available badge in the builder).
          </p>
        </div>
        <Link
          href="/admin/blocks/new?scope=global"
          className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[44px] rounded-lg hover:bg-amber-400 transition-colors text-sm inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create new global block
        </Link>
      </header>

      {/* Platform super-admin sub-nav */}
      <nav className="flex gap-4 border-b border-steel-700 mt-6 mb-6 text-sm">
        <Link
          href="/admin/global-blocks"
          className="pb-3 px-1 font-medium border-b-2 border-brand-yellow text-brand-yellow"
        >
          Global Blocks
        </Link>
        <Link
          href="/admin/global-blocks/suggestions"
          className="pb-3 px-1 font-medium text-steel-400 hover:text-steel-100"
        >
          Suggestions Queue
        </Link>
      </nav>

      <BlockListTable blocks={globals} categories={categories} />
    </div>
  )
}
