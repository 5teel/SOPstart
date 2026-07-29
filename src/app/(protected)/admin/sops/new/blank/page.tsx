import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { listBlockCategories } from '@/actions/blocks'
import { listDepartments } from '@/actions/departments'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
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
    <AdminPageShell
      active="sops"
      title="New SOP"
      description="Start a SOP from scratch — pick the sections you want, then build them in the editor."
    >
      <WizardClient categories={categories} departments={departments} />
    </AdminPageShell>
  )
}
