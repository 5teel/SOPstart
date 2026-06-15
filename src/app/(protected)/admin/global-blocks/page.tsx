import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Global Library — deprecated',
}

/**
 * Phase 25: Global block curation surface retired.
 * Global blocks were converted to org-owned (all_departments=true) in migration 00036.
 * This route now redirects to the org block library.
 * The full route deletion happens in Wave 4 plan 25-05.
 */
export default async function GlobalBlocksPage() {
  redirect('/admin/blocks')
}
