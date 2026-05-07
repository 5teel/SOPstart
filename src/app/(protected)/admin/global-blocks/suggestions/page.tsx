import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSummitAdmin } from '@/lib/auth/summit-admin-guard'
import { listBlockSuggestions } from '@/actions/blocks'
import { SuggestionReviewRow } from '@/components/admin/blocks/SuggestionReviewRow'

export const metadata: Metadata = {
  title: 'Pending Suggestions — Summit super-admin',
}

/**
 * Phase 13 plan 13-05: Suggestions queue page for the Summit super-admin.
 *
 * Lists all `block_suggestions` rows with status='pending'. Each row exposes
 * a Promote / Reject decision form via SuggestionReviewRow.
 *
 * Promote → inserts a global block (organisation_id = null) via
 * promoteSuggestion (built in 13-01); the trigger from 13-04
 * (`trg_propagate_block_update`) fires on the new block_versions row and
 * flips `update_available` on any follow-latest junctions referencing the
 * source org block.
 *
 * Reject → marks the suggestion rejected with optional decision note.
 */
export default async function SuggestionsQueuePage() {
  await requireSummitAdmin()
  const pending = await listBlockSuggestions({ status: 'pending' })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-steel-900 min-h-screen">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-steel-100">
          Pending Suggestions for Global Library
        </h1>
        <p className="text-sm text-steel-400 mt-1 max-w-2xl">
          Review, promote, or reject blocks submitted by orgs for the shared
          NZ-industry library. Promoted blocks become read-only globals visible
          to every org.
        </p>
      </header>

      <nav className="flex gap-4 border-b border-steel-700 mt-6 mb-6 text-sm">
        <Link
          href="/admin/global-blocks"
          className="pb-3 px-1 font-medium text-steel-400 hover:text-steel-100"
        >
          Global Blocks
        </Link>
        <Link
          href="/admin/global-blocks/suggestions"
          className="pb-3 px-1 font-medium border-b-2 border-brand-yellow text-brand-yellow"
        >
          Suggestions Queue
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-brand-yellow text-steel-900 font-bold">
              {pending.length}
            </span>
          )}
        </Link>
      </nav>

      {pending.length === 0 ? (
        <div className="bg-steel-800 border border-steel-700 rounded-lg p-8 text-center">
          <p className="text-base font-semibold text-steel-100 mb-1">
            No pending suggestions
          </p>
          <p className="text-sm text-steel-400">
            Org admins can submit blocks via &ldquo;Suggest for global&rdquo; in
            the Save to library modal (built in 13-01). Promoted suggestions
            land in the Global Blocks tab.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((s) => (
            <li key={s.id}>
              <SuggestionReviewRow suggestion={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
