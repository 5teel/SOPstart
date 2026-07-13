import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'
import { listDepartments } from '@/actions/departments'
import { AiDraftTabs } from './AiDraftTabs'

export const metadata: Metadata = {
  title: 'Draft a SOP with AI — SOPstart',
  description: 'Type a short brief and Claude drafts a structured SOP for review.',
}

export default async function NewAiSopPage() {
  // Auth guard — shared per-request session context (JWT verified locally).
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  // Distinct existing SOP categories — populates the optional category dropdown.
  // Same query pattern used elsewhere in the admin surface; service-role isolation
  // not needed here (RLS-scoped reader). Categories + departments are
  // independent reads — fetch concurrently.
  const [{ data: categoryRows }, departments] = await Promise.all([
    supabase
      .from('sops')
      .select('category')
      .not('category', 'is', null)
      .limit(500),
    listDepartments(),
  ])

  const categories = Array.from(
    new Set((categoryRows ?? []).map((r) => r.category).filter((c): c is string => Boolean(c)))
  ).sort()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <span className="pill">AI DRAFT</span>
          <h1 className="mono text-2xl font-semibold text-[var(--ink-900)] mt-1">Draft a SOP with AI</h1>
          <p className="text-sm text-[var(--ink-500)] mt-1">
            Type a brief or talk it through — either way you review the draft in the builder before publish.
          </p>
        </div>
        <Link
          href="/admin/sops"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors flex-shrink-0"
        >
          Back to library
        </Link>
      </div>
      <AiDraftTabs categories={categories} departments={departments} />
    </div>
  )
}
