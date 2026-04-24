import '@puckeditor/core/puck.css'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BuilderClient } from './BuilderClient'
import type { SopWithSections } from '@/types/sop'

export const metadata: Metadata = {
  title: 'Builder',
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ sopId: string }>
}) {
  const { sopId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check user is admin or safety_manager (mirrors review/page.tsx)
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Fetch SOP with nested sections, steps, images — includes layout_data/layout_version via *
  const { data: sop, error: sopError } = await supabase
    .from('sops')
    .select(
      `
      *,
      sop_sections (
        *,
        sop_steps ( * ),
        sop_images ( * )
      )
    `
    )
    .eq('id', sopId)
    .order('sort_order', { referencedTable: 'sop_sections', ascending: true })
    .single()

  if (sopError || !sop) {
    redirect('/admin/sops')
  }

  return (
    <Suspense fallback={null}>
      <BuilderClient sopId={sopId} initialSop={sop as unknown as SopWithSections} />
    </Suspense>
  )
}
