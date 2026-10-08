import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { listDepartments } from '@/actions/departments'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { WizardClient } from './WizardClient'

export const metadata: Metadata = {
  title: 'New SOP',
}

// Phase 57 D-19: ?machine=<id> from a machine's "New SOP for this machine".
// Only a well-formed id gets through; setSopMachines re-checks it against the session org.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewBlankSopPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string | string[]; title?: string | string[] }>
}) {
  const { machine, title } = await searchParams
  const machineId = typeof machine === 'string' && UUID.test(machine) ? machine : null
  // Phase 63: ?title= from the home's "Write it" -- a form default only, trimmed and capped; creation validates as before.
  const initialTitle = typeof title === 'string' ? title.trim().slice(0, 200) : ''
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  // Admin / safety_manager guard — matches Phase 2 precedent
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/')
  }

  // Phase 25: departments for the wizard's department multi-select field.
  const departments = await listDepartments()

  return (
    <AdminPageShell
      title="New SOP"
      description="Start a SOP from scratch — pick the sections you want, then build them in the editor."
    >
      <WizardClient departments={departments} machineId={machineId} initialTitle={initialTitle} />
    </AdminPageShell>
  )
}
