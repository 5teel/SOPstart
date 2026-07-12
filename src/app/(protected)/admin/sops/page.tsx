import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, History, Video, Pencil, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { DeleteSopButton } from '@/components/admin/DeleteSopButton'
import { VideoJobIndicator } from '@/components/admin/VideoJobIndicator'
import { SopDepartmentEditor } from '@/components/admin/sop/SopDepartmentEditor'
import { LibraryReviewCell } from '@/components/admin/sops/LibraryReviewCell'
import { GovernanceWidget } from '@/components/admin/governance/GovernanceWidget'
import { AdminNav } from '@/components/admin/AdminNav'
import { listDepartments } from '@/actions/departments'
import { getTeamMembersWithEmails } from '@/actions/auth'
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
  searchParams: Promise<{ status?: string; owner?: string }>
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
  const ownerOnly = params.owner === 'me'

  const SOP_SELECT = 'id, title, sop_number, category, status, source_file_name, source_type, created_at, updated_at, published_at, all_departments, overall_confidence, parse_notes, owner_user_id, review_due_at'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('sops')
    .select(SOP_SELECT)
    .order('created_at', { ascending: false })

  if (activeStatus === 'draft') {
    // Triage ordering: worst parses first (lowest confidence, unparsed on top).
    query = supabase
      .from('sops')
      .select(SOP_SELECT)
      .eq('status', 'draft')
      .order('overall_confidence', { ascending: true, nullsFirst: true })
  } else if (activeStatus !== 'all' && activeStatus !== 'failed') {
    query = query.eq('status', activeStatus as SopStatus)
  } else if (activeStatus === 'failed') {
    query = query.in('status', ['uploading', 'parsing'])
  }

  // OWN-04/D28-08: "Owned by me" filter — a chip on the existing library, not a new page.
  if (ownerOnly) {
    query = query.eq('owner_user_id', user.id)
  }

  const { data: sops } = await query

  // Owner display labels (email/role), reusing the existing team fetcher — no new member query.
  const teamResult = await getTeamMembersWithEmails()
  const ownerLabelById: Record<string, string> = {}
  if (!('error' in teamResult)) {
    for (const m of teamResult.members) {
      ownerLabelById[m.user_id] = m.email ?? `${m.role} (${m.user_id.slice(0, 8)})`
    }
  }

  // Phase 25: department tagging for existing SOPs. Fetch the org's departments
  // and each listed SOP's current sop_departments so each row can be re-tagged inline.
  const departments = await listDepartments()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sopIds = (sops ?? []).map((s: any) => s.id)
  const deptIdsForSop: Record<string, string[]> = {}
  if (sopIds.length > 0) {
    // sop_departments is not in the generated database.types.ts (like block_suggestions);
    // cast to any, mirroring src/actions/departments.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sopDeptRows } = await (supabase as any)
      .from('sop_departments')
      .select('sop_id, department_id')
      .in('sop_id', sopIds)
    for (const r of (sopDeptRows ?? []) as Array<{ sop_id: string; department_id: string }>) {
      ;(deptIdsForSop[r.sop_id] ??= []).push(r.department_id)
    }
  }

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
          <GovernanceWidget />
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
            <Link
              href="/admin/sops/new/ai?mode=voice"
              className="evidence-btn !min-h-[40px] text-sm"
            >
              🎤 Voice Draft
            </Link>
          </div>
        </div>

        <AdminNav active="sops" />

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
          <Link
            href="/admin/sops?owner=me"
            className="tab"
            data-active={ownerOnly ? 'true' : undefined}
          >
            Owned by me
          </Link>
        </div>

        {/* Draft triage strip — surfaced on the All tab so review work is never invisible */}
        {activeStatus === 'all' && (sops ?? []).some((s: { status: string }) => s.status === 'draft') && (
          <Link
            href="/admin/sops?status=draft"
            className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <span className="text-sm font-medium text-amber-800">
              {(sops ?? []).filter((s: { status: string }) => s.status === 'draft').length} draft
              {(sops ?? []).filter((s: { status: string }) => s.status === 'draft').length === 1 ? '' : 's'} waiting for review
            </span>
            <span className="mono text-[11px] uppercase tracking-wider text-amber-700">Review worst-first →</span>
          </Link>
        )}

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
              <Link href="/admin/sops/new/ai?mode=voice" className="evidence-btn text-sm">🎤 Voice Draft</Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sops.map((sop: any) => {
              const canEditInBuilder = sop.source_type && sop.source_type !== 'uploaded'
              return (
                <li key={sop.id} className="flex items-stretch gap-2">
                  <div className="blueprint-frame flex-1 min-w-0 hover:shadow-[0_0_0_1px_var(--ink-900)] transition-shadow">
                  <Link
                    href={`/admin/sops/builder/${sop.id}`}
                    className="flex items-center gap-4"
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
                        {sop.status === 'draft' && typeof sop.overall_confidence === 'number' && (
                          <span
                            className={`mono text-[11px] px-1.5 py-0.5 rounded ${
                              sop.overall_confidence < 0.7
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-700'
                            }`}
                            title="AI parse confidence"
                          >
                            {Math.round(sop.overall_confidence * 100)}%
                          </span>
                        )}
                        {sop.status === 'draft' && typeof sop.parse_notes === 'string' && sop.parse_notes.includes('NEEDS REVIEW') && (
                          <span className="mono text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700" title="The parser flagged unclear or missing source content">
                            ⚠ NEEDS REVIEW
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={sop.status as SopStatus} />
                  </Link>
                  <div className="mt-2 pt-2 border-t border-[var(--ink-100)]">
                    <SopDepartmentEditor
                      sopId={sop.id}
                      departments={departments}
                      selectedIds={deptIdsForSop[sop.id] ?? []}
                      allDepartments={sop.all_departments ?? false}
                    />
                  </div>
                  <LibraryReviewCell
                    sopId={sop.id}
                    ownerLabel={sop.owner_user_id ? (ownerLabelById[sop.owner_user_id] ?? 'No owner') : null}
                    reviewDueAt={sop.review_due_at}
                  />
                  </div>
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
                      <Link
                        href={`/admin/sops/${sop.id}/qr`}
                        className="evidence-btn !min-w-[40px] !min-h-[40px] !p-0"
                        title="Print QR code for this machine"
                        aria-label="Print QR code"
                      >
                        <QrCode className="h-4 w-4" />
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
