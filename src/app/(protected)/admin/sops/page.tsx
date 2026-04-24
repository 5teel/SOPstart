import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, History, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { DeleteSopButton } from '@/components/admin/DeleteSopButton'
import { VideoJobIndicator } from '@/components/admin/VideoJobIndicator'
import type { SopStatus } from '@/types/sop'

export const metadata: Metadata = {
  title: 'SOP Library',
}

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drafts', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Needs attention', value: 'failed' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function SopsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
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

  const params = await searchParams
  const activeStatus = params.status ?? 'all'

  // Build query — cast .select() to any because supabase-generated types have
  // not been regenerated since migration 00020 added sops.source_type. Same
  // pattern as src/actions/sections.ts reorderSections/updateSectionLayout.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('sops')
    .select('id, title, sop_number, category, status, source_file_name, source_type, created_at, updated_at, published_at')
    .order('created_at', { ascending: false })

  // Filter by status tab (except "all")
  if (activeStatus !== 'all' && activeStatus !== 'failed') {
    query = query.eq('status', activeStatus as SopStatus)
  } else if (activeStatus === 'failed') {
    // "Needs attention" = parsing status without progress, or uploading old records
    query = query.in('status', ['uploading', 'parsing'])
  }

  const { data: sops } = await query

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-steel-100">SOP Library</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/sops/new/blank"
            className="bg-steel-800 border border-steel-700 text-steel-100 font-semibold px-4 h-[44px] rounded-lg hover:bg-steel-700 hover:border-steel-600 transition-colors text-sm inline-flex items-center"
          >
            New SOP (blank)
          </Link>
          <Link
            href="/admin/sops/upload"
            className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[44px] rounded-lg hover:bg-amber-400 transition-colors text-sm inline-flex items-center"
          >
            Upload SOP
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-steel-700 mb-6 overflow-x-auto">
        {STATUS_TABS.map(tab => {
          const isActive = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={tab.value === 'all' ? '/admin/sops' : `/admin/sops?status=${tab.value}`}
              className={[
                'pb-3 px-1 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-b-2 border-brand-yellow text-brand-yellow'
                  : 'text-steel-400 hover:text-steel-100',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* SOP list */}
      {!sops || sops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-semibold text-steel-100 mb-2">No SOPs yet</p>
          <p className="text-sm text-steel-400 mb-6">
            Upload your first SOP document to get started.
          </p>
          <Link
            href="/admin/sops/upload"
            className="bg-brand-yellow text-steel-900 font-semibold px-6 h-[72px] rounded-lg hover:bg-amber-400 transition-colors inline-flex items-center"
          >
            Upload your first SOP
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {sops.map((sop: any) => (
            <li key={sop.id} className="flex items-stretch gap-2">
              <Link
                href={`/admin/sops/${sop.id}/review`}
                className="flex items-center gap-4 px-4 py-3 bg-steel-800 rounded-lg hover:bg-steel-700 transition-colors cursor-pointer min-h-[72px] border border-transparent hover:border-steel-600 flex-1 min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-steel-100 truncate">
                    {sop.title ?? sop.source_file_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {sop.sop_number && (
                      <span className="text-xs text-steel-400">{sop.sop_number}</span>
                    )}
                    {sop.category && (
                      <span className="text-xs text-steel-400">{sop.category}</span>
                    )}
                    <span className="text-xs text-steel-400">
                      {formatDate(sop.updated_at ?? sop.created_at)}
                    </span>
                    {sop.source_type && sop.source_type !== 'uploaded' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-steel-400 border border-steel-600 rounded px-1.5 py-0.5">
                        AUTHORED IN BUILDER
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={sop.status as SopStatus} />
              </Link>
              {sop.status === 'published' && (
                <VideoJobIndicator sopId={sop.id} />
              )}
              {sop.status === 'published' ? (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Link
                    href={`/admin/sops/${sop.id}/assign`}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 border border-steel-700 hover:bg-steel-700 hover:border-steel-600 transition-colors text-steel-400 hover:text-steel-100"
                    title="Assign to team"
                    aria-label="Assign to team"
                  >
                    <Users className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/admin/sops/${sop.id}/versions`}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 border border-steel-700 hover:bg-steel-700 hover:border-steel-600 transition-colors text-steel-400 hover:text-steel-100"
                    title="Version history"
                    aria-label="Version history"
                  >
                    <History className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/admin/sops/${sop.id}/video`}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-steel-800 border border-steel-700 hover:bg-steel-700 hover:border-steel-600 transition-colors text-steel-400 hover:text-steel-100"
                    title="Generate video"
                    aria-label="Generate video"
                  >
                    <Video className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <DeleteSopButton sopId={sop.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
