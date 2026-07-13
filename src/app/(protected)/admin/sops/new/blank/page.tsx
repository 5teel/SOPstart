import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'
import { listBlockCategories } from '@/actions/blocks'
import { listDepartments } from '@/actions/departments'
import { WizardClient } from './WizardClient'

export const metadata: Metadata = {
  title: 'New SOP',
}

export default async function NewBlankSopPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  // Admin / safety_manager guard — matches Phase 2 precedent
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  // Phase 13 D-Tax-03: SOP-level category vocab + block library categories
  // for the wizard's "Pick from library" picker (passed as a prop to keep
  // env-vars / service-role keys out of the client bundle).
  const [categories, departments] = await Promise.all([
    listBlockCategories(),
    listDepartments(),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">New SOP</h1>
        <Link
          href="/admin/sops"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
        >
          Back to library
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-500)] mb-8">
        Start a SOP from scratch — pick the sections you want, then build them in the editor.
      </p>
      <WizardClient categories={categories} departments={departments} />
    </div>
  )
}
