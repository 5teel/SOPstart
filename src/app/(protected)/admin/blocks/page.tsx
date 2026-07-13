import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSessionContext } from '@/lib/auth/session-context'
import { listBlocks } from '@/actions/blocks'
import { listDepartments } from '@/actions/departments'
import { BlockListTable } from '@/components/admin/blocks/BlockListTable'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = {
  title: 'Library',
}

const KIND_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Hazard', value: 'hazard' },
  { label: 'PPE', value: 'ppe' },
  { label: 'Step', value: 'step' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Custom', value: 'custom' },
]

export default async function BlocksLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; dept?: string }>
}) {
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const kind = params.kind && params.kind !== 'all' ? params.kind : undefined
  const dept = params.dept ?? undefined

  // Phase 25: department-organised library. listDepartments for filter bar + BlockListTable.
  const [blocks, departments] = await Promise.all([
    listBlocks({
      includeArchived: false,
      kindSlug: kind,
      departmentId: dept,
    }),
    listDepartments(),
  ])

  // Fetch block→department junction rows so we can show per-block department chips.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: junctionRows } = await (supabase as any)
    .from('block_departments')
    .select('block_id, department_id')

  // Build a map of blockId → departmentId[]
  const blockDeptMap = new Map<string, string[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (junctionRows ?? []) as any[]) {
    const existing = blockDeptMap.get(row.block_id) ?? []
    existing.push(row.department_id)
    blockDeptMap.set(row.block_id, existing)
  }

  // Augment blocks with departmentIds + allDepartments for display.
  const augmentedBlocks = blocks.map((b) => ({
    ...b,
    departmentIds: blockDeptMap.get(b.id) ?? [],
    allDepartments: b.all_departments ?? false,
  }))

  const activeDept = departments.find((d) => d.id === dept)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-[var(--paper)] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Library</h1>
        <Link
          href="/admin/blocks/new"
          className="bg-[var(--ink-900)] text-white font-semibold px-4 h-[44px] rounded-lg hover:bg-[var(--ink-700)] transition-colors text-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New block
        </Link>
      </div>
      <p className="text-sm text-[var(--ink-500)] mb-6">
        Reusable hazards, PPE, steps and emergency blocks. Each block can belong to any number of departments — tag a burn hazard to both Forming and Maintenance, or mark a block All departments to make it org-wide.
      </p>

      <AdminNav active="blocks" />

      {/* Department filter bar (.deptrow) */}
      {departments.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="mr-1"
              style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'var(--ink-500)',
              }}
            >
              DEPARTMENT
            </span>
            {/* All button */}
            <Link
              href={kind ? `/admin/blocks?kind=${kind}` : '/admin/blocks'}
              className="inline-flex items-center gap-2 rounded-[6px] transition-colors"
              style={{
                padding: '8px 13px',
                fontSize: '12px',
                fontWeight: 500,
                minHeight: '44px',
                border: !dept
                  ? '1.5px solid var(--ink-900)'
                  : '1.5px solid var(--ink-300)',
                background: !dept ? 'var(--ink-900)' : 'var(--paper)',
                color: !dept ? '#fff' : 'var(--ink-500)',
              }}
            >
              All
              <span
                className="rounded-[10px] tabular-nums"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 7px',
                  background: !dept ? 'var(--steel-700, #374151)' : 'var(--paper-2)',
                  color: !dept ? '#fff' : 'var(--ink-700)',
                }}
              >
                {augmentedBlocks.length}
              </span>
            </Link>
            {/* Per-department buttons */}
            {departments.map((d) => {
              const isActive = dept === d.id
              return (
                <Link
                  key={d.id}
                  href={`/admin/blocks?dept=${d.id}${kind ? `&kind=${kind}` : ''}`}
                  className="inline-flex items-center gap-2 rounded-[6px] transition-colors"
                  style={{
                    padding: '8px 13px',
                    fontSize: '12px',
                    fontWeight: 500,
                    minHeight: '44px',
                    border: isActive
                      ? '1.5px solid var(--ink-900)'
                      : '1.5px solid var(--ink-300)',
                    background: isActive ? 'var(--ink-900)' : 'var(--paper)',
                    color: isActive ? '#fff' : 'var(--ink-500)',
                  }}
                >
                  {/* Colour swatch */}
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      background: d.colour,
                      flexShrink: 0,
                    }}
                  />
                  {d.name}
                  <span
                    className="rounded-[10px] tabular-nums"
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 7px',
                      background: isActive ? 'var(--steel-700, #374151)' : 'var(--paper-2)',
                      color: isActive ? '#fff' : 'var(--ink-700)',
                    }}
                  >
                    {d.block_count}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Context line (.ctxline) */}
      <p
        className="mb-4"
        style={{
          fontSize: '11px',
          color: 'var(--ink-500)',
          lineHeight: 1.5,
        }}
      >
        {activeDept
          ? `${activeDept.name} blocks, plus org-wide blocks. A block tagged to several departments shows up under each.`
          : 'Every block in the organisation. Org-wide blocks appear under all departments.'}
      </p>

      {/* Kind filter */}
      <div className="mb-6 flex items-center gap-3">
        <label htmlFor="kind-filter" className="text-xs uppercase tracking-wider text-[var(--ink-500)]">
          Kind
        </label>
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((k) => {
            const isActive = (kind ?? 'all') === k.value
            const baseHref = dept ? `/admin/blocks?dept=${dept}` : '/admin/blocks'
            const href = k.value === 'all' ? baseHref : `${baseHref}${dept ? '&' : '?'}kind=${k.value}`
            return (
              <Link
                key={k.value}
                href={href}
                className={[
                  'px-2.5 h-7 text-xs rounded-md inline-flex items-center transition-colors',
                  isActive
                    ? 'bg-[var(--ink-900)]/20 text-[var(--ink-900)] border border-[var(--ink-900)]/40'
                    : 'bg-white text-[var(--ink-500)] border border-[var(--ink-100)] hover:text-[var(--ink-900)]',
                ].join(' ')}
              >
                {k.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* List table */}
      <BlockListTable blocks={augmentedBlocks} departments={departments} />
    </div>
  )
}
