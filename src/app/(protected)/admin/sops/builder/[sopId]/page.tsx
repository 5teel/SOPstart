import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signLayoutDataImages } from '@/lib/builder/sign-layout-data-images'
import { BuilderStageShell } from './BuilderStageShell'
import type { SopWithSections, ParseJob } from '@/types/sop'

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

  await signLayoutDataImages(supabase, sop as unknown as { sop_sections?: Array<{ layout_data?: unknown }> })

  // Phase 21 Plan 21-02 — fetch latest parse_job to surface transcript
  // segments to the source viewer (video SOPs) and feed the AI-review
  // results panel (Wave 3). Pre-Phase-20 SOPs may have no parse_job —
  // the viewer + Wave 3 panel both degrade gracefully on null.
  const { data: parseJob } = await supabase
    .from('parse_jobs')
    .select('*')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <Suspense fallback={null}>
      <BuilderStageShell
        sopId={sopId}
        initialSop={sop as unknown as SopWithSections}
        parseJob={(parseJob ?? null) as ParseJob | null}
      />
    </Suspense>
  )
}
