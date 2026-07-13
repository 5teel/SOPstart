import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'
import { UploadDropzone } from '@/components/admin/UploadDropzone'

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
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Upload SOPs</h1>
        <Link
          href="/admin/sops"
          className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
        >
          Back to library
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-500)] mb-8">
        Upload your SOP documents and we&apos;ll parse them into mobile-friendly procedures. Supported formats: Word (.docx), PDF, and photos.
      </p>
      <UploadDropzone />
    </div>
  )
}
