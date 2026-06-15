import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, History, Video, Pencil } from 'lucide-react'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('sops')
    .select('id, title, sop_number, category, status, source_file_name, source_type, created_at, updated_at, published_at')
    .order('created_at', { ascending: false })

  if (activeStatus !== 'all' && activeStatus !== 'failed') {
    query = query.eq('status', activeStatus as SopStatus)
  } else if (activeStatus === 'failed') {
    query = query.in('status', ['uploading', 'parsing'])
  }

  const { data: sops } = await query

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="pill">LIBRARY</span>
            </div>
            <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">SOPs</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/sops/upload"
              className="evidence-btn !min-h-[40px] text-sm"
            >
              Upload
            </Link>
            <Link
              href="/admin/sops/new/blank"
              className="evidence-btn !min-h-[40px] text-sm"
            >
              Blank
            </Link>
            <Link
              href="/admin/sops/new/ai"
              className="evidence-btn !min-h-[40px] text-sm !bg-[var(--ink-900)] !text-white !border-[var(--ink-900)] hover:!bg-[var(--ink-700)]"
            >
              AI Draft
            </Link>
          </div>
        </div>

        {/* Admin sub-nav */}
        <nav
          aria-label="Admin sections"
          className="flex gap-1 border-b border-[var(--ink-100)] mb-6"
        >
          <Link href="/admin/sops" className="tab" data-active="true">
            SOPs
          </Link>
          <Link href="/admin/blocks" className="tab">
            Library
          </Link>
          <Link href="/admin/team" className="tab">
            Team
          </Link>
          <Link href="/admin/departments" className="tab">
            Departments
          </Link>
        </nav>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-[var(--ink-100)] mb-6 overflow-x-auto">
          {STATUS_TABS.map(tab => {
            const isActive = activeStatus === tab.value
            return (
              <Link
                key={tab.value}
                href={tab.value === 'all' ? '/admin/sops' : `/admin/sops?status=${tab.value}`}
                className="tab"
                data-active={isActive ? 'true' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* SOP list */}
        {!sops || sops.length === 0 ? (
          <div className="blueprint-frame text-center py-12">
            <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-2">
              EMPTY
            </p>
            <p className="text-lg font-semibold text-[var(--ink-900)] mb-1">No SOPs yet</p>
            <p className="text-sm text-[var(--ink-500)] mb-6">
              Pick a starting point above — upload a doc, start blank, or draft with AI.
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link href="/admin/sops/upload" className="evidence-btn text-sm">Upload</Link>
              <Link href="/admin/sops/new/blank" className="evidence-btn text-sm">Blank</Link>
              <Link
                href="/admin/sops/new/ai"
                className="evidence-btn text-sm !bg-[var(--ink-900)] !text-white !border-[var(--ink-900)]"
              >
                AI Draft
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sops.map((sop: any) => {
              const canEditInBuilder = sop.source_type && sop.source_type !== 'uploaded'
              return (
                <li key={sop.id} className="flex items-stretch gap-2">
                  <Link
                    href={`/admin/sops/builder/${sop.id}`}
                    className="blueprint-frame flex-1 min-w-0 flex items-center gap-4 hover:shadow-[0_0_0_1px_var(--ink-900)] transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-[var(--ink-900)] truncate">
                        {sop.title ?? sop.source_file_name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {sop.sop_number && (
                          <span className="mono text-[11px] text-[var(--ink-500)]">{sop.sop_number}</span>
                        )}
                        {sop.category && (
                          <span className="text-xs text-[var(--ink-500)]">{sop.category}</span>
                        )}
                        <span className="mono text-[11px] text-[var(--ink-500)]">
                          {formatDate(sop.updated_at ?? sop.created_at)}
                        </span>
                        {sop.source_type === 'blank' && (
                          <span className="pill">AUTHORED IN BUILDER</span>
                        )}
                        {sop.source_type === 'ai' && (
                          <span className="pill">AI DRAFT</span>
                        )}
                        {sop.source_type === 'template' && (
                          <span className="pill">NZ TEMPLATE</span>
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
                      {canEditInBuilder && (
                        <Link
                          href={`/admin/sops/builder/${sop.id}`}
                          className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                          title="Edit in builder"
                          aria-label="Edit in builder"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      <Link
                        href={`/admin/sops/${sop.id}/assign`}
                        className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                        title="Assign to team"
                        aria-label="Assign to team"
                      >
                        <Users className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/sops/${sop.id}/versions`}
                        className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                        title="Version history"
                        aria-label="Version history"
                      >
                        <History className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/sops/${sop.id}/video`}
                        className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                        title="Generate video"
                        aria-label="Generate video"
                      >
                        <Video className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {canEditInBuilder && (
                        <Link
                          href={`/admin/sops/builder/${sop.id}`}
                          className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                          title="Edit in builder"
                          aria-label="Edit in builder"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      <DeleteSopButton sopId={sop.id} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
      )}
    </div>
  )
}
