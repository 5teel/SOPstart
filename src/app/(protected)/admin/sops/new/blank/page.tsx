import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listBlockCategories } from '@/actions/blocks'
import { WizardClient } from './WizardClient'

export const metadata: Metadata = {
  title: 'New SOP',
}

export default async function NewBlankSopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin / safety_manager guard — matches Phase 2 precedent
  // (src/app/(protected)/admin/sops/upload/page.tsx lines 18-26).
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Phase 13 D-Tax-03: SOP-level category vocab + block library categories
  // for the wizard's "Pick from library" picker (passed as a prop to keep
  // env-vars / service-role keys out of the client bundle).
  const categories = await listBlockCategories()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-steel-100">New SOP</h1>
        <Link
          href="/admin/sops"
          className="text-sm text-steel-400 hover:text-brand-yellow transition-colors"
        >
          Back to library
        </Link>
      </div>
      <p className="text-sm text-steel-400 mb-8">
        Start a SOP from scratch — pick the sections you want, then build them in the editor.
      </p>
      <WizardClient categories={categories} />
    </div>
  )
}
