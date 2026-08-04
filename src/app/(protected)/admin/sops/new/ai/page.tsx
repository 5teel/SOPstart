import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { listDepartments } from '@/actions/departments'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { AiDraftFork } from './AiDraftFork'

export const metadata: Metadata = {
  title: 'Draft a SOP with AI — SOPstart',
  description: 'Type a short brief and Claude drafts a structured SOP for review.',
}

export default async function NewAiSopPage() {
  // Auth guard — shared per-request session context (JWT verified locally).
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  // Phase 40 DAT-01: category options now come from the fixed SOP_CATEGORIES
  // vocabulary inside SopMetadataFields — the live DISTINCT sops.category
  // query (an anti-pattern retired by DAT-01) is gone.
  const departments = await listDepartments()

  return (
    <AdminPageShell
      badge="AI DRAFT"
      mono
      title="Draft a SOP with AI"
      description="Type a brief or talk it through — either way you review the draft in the builder before publish."
    >
      <AiDraftFork departments={departments} />
    </AdminPageShell>
  )
}
