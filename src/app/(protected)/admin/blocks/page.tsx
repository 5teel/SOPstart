import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listBlocks, listBlockCategories } from '@/actions/blocks'
import { BlockListTable } from '@/components/admin/blocks/BlockListTable'

export const metadata: Metadata = {
  title: 'Block Library',
}

const KIND_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Hazard', value: 'hazard' },
  { label: 'PPE', value: 'ppe' },
  { label: 'Step', value: 'step' },
  { label: 'Emergency', value: 'emergency' },
  { label: 'Custom', value: 'custom' },
]

const SCOPE_TABS: { label: string; value: 'org' | 'global' }[] = [
  { label: 'Org blocks', value: 'org' },
  { label: 'Global blocks', value: 'global' },
]

export default async function BlocksLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: 'org' | 'global'; kind?: string }>
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
  const scope: 'org' | 'global' = params.scope === 'global' ? 'global' : 'org'
  const kind = params.kind && params.kind !== 'all' ? params.kind : undefined

  const [blocks, categories] = await Promise.all([
    listBlocks({
      includeGlobal: scope === 'global' ? true : false,
      globalOnly: scope === 'global',
      includeArchived: false,
      kindSlug: kind,
    }),
    listBlockCategories(),
  ])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-steel-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-steel-100">Block Library</h1>
        <Link
          href="/admin/blocks/new"
          className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[44px] rounded-lg hover:bg-amber-400 transition-colors text-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New block
        </Link>
      </div>
      <p className="text-sm text-steel-400 mb-6">
        Reusable hazards, PPE, and step blocks across your SOPs.
      </p>

      {/* Admin sub-nav */}
      <nav className="flex gap-4 border-b border-steel-700 mb-6 text-sm">
        <Link
          href="/admin/sops"
          className="pb-3 px-1 font-medium text-steel-400 hover:text-steel-100"
        >
          SOPs
        </Link>
        <Link
          href="/admin/blocks"
          className="pb-3 px-1 font-medium border-b-2 border-brand-yellow text-brand-yellow"
        >
          Blocks
        </Link>
      </nav>

      {/* Scope tabs */}
      <div className="flex gap-2 mb-4">
        {SCOPE_TABS.map((tab) => {
          const isActive = scope === tab.value
          const href = `/admin/blocks?scope=${tab.value}${kind ? `&kind=${kind}` : ''}`
          return (
            <Link
              key={tab.value}
              href={href}
              className={[
                'px-3 h-9 rounded-md text-sm font-medium inline-flex items-center transition-colors',
                isActive
                  ? 'bg-steel-700 text-steel-100 border border-steel-600'
                  : 'bg-steel-800 text-steel-400 border border-steel-700 hover:text-steel-100',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Kind filter */}
      <div className="mb-6 flex items-center gap-3">
        <label htmlFor="kind-filter" className="text-xs uppercase tracking-wider text-steel-400">
          Kind
        </label>
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((k) => {
            const isActive = (kind ?? 'all') === k.value
            const href = `/admin/blocks?scope=${scope}${k.value === 'all' ? '' : `&kind=${k.value}`}`
            return (
              <Link
                key={k.value}
                href={href}
                className={[
                  'px-2.5 h-7 text-xs rounded-md inline-flex items-center transition-colors',
                  isActive
                    ? 'bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/40'
                    : 'bg-steel-800 text-steel-400 border border-steel-700 hover:text-steel-100',
                ].join(' ')}
              >
                {k.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* List table */}
      <BlockListTable blocks={blocks} categories={categories} />
    </div>
  )
}
