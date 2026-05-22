import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PromptClient } from './PromptClient'

export const metadata: Metadata = {
  title: 'Draft a SOP from a prompt — SOPstart',
  description: 'Type a short brief and Claude drafts a structured SOP for review.',
}

export default async function NewAiSopPage() {
  // Auth guard — mirrors /admin/sops/new/blank/page.tsx (organisation_members.role lookup).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Distinct existing SOP categories — populates the optional category dropdown.
  // Same query pattern used elsewhere in the admin surface; service-role isolation
  // not needed here (RLS-scoped reader).
  const { data: categoryRows } = await supabase
    .from('sops')
    .select('category')
    .not('category', 'is', null)
    .limit(500)

  const categories = Array.from(
    new Set((categoryRows ?? []).map((r) => r.category).filter((c): c is string => Boolean(c)))
  ).sort()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Draft a SOP from a prompt</h1>
        <Link
          href="/admin/sops"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
        >
          Back to library
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-500)] mb-8">
        Describe the procedure, site, or worker role in plain English. Claude drafts a structured
        SOP with hazards, PPE, steps and emergency procedures. You&apos;ll review and refine before publish.
      </p>
      <PromptClient categories={categories} />
    </div>
  )
}
