import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
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

  // Phase 25: departments for the wizard's department multi-select field.
  const departments = await listDepartments()

  return (
    <AdminPageShell
      title="New SOP"
      description="Start a SOP from scratch — pick the sections you want, then build them in the editor."
    >
      <WizardClient departments={departments} />
    </AdminPageShell>
  )
}
