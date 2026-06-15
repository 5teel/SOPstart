import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Suggestions — deprecated',
}

/**
 * Phase 25: Block suggestion curation surface retired (global model removed, A5/A6).
 * block_suggestions table dropped in migration 00037.
 * Full route deletion in Wave 4 plan 25-05.
 */
export default async function SuggestionsQueuePage() {
  redirect('/admin/blocks')
}
