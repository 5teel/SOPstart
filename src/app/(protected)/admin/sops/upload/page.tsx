import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { UploadDropzone } from '@/components/admin/UploadDropzone'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { INTAKE_HINT } from '@/lib/upload/file-intake'

export const metadata: Metadata = {
  title: 'Upload SOPs',
}

export default async function UploadSopsPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  // Check user is admin or safety_manager
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <AdminPageShell
      active="sops"
      title="Upload SOPs"
      description={`Upload your SOP documents and we'll parse them into mobile-friendly procedures. Supported formats: ${INTAKE_HINT}.`}
    >
      <UploadDropzone />
    </AdminPageShell>
  )
}
