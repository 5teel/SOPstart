import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UploadDropzone } from '@/components/admin/UploadDropzone'

export const metadata: Metadata = {
  title: 'Upload SOPs',
}

export default async function UploadSopsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check user is admin or safety_manager
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-steel-100">Upload SOPs</h1>
        <Link
          href="/admin/sops"
          className="text-sm text-steel-400 hover:text-brand-yellow transition-colors"
        >
          Back to library
        </Link>
      </div>
      <p className="text-sm text-steel-400 mb-8">
        Upload your SOP documents and we&apos;ll parse them into mobile-friendly procedures. Supported formats: Word (.docx), PDF, and photos.
      </p>
      <UploadDropzone />
    </div>
  )
}
