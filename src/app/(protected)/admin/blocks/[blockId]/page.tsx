import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getBlock, listBlockCategories } from '@/actions/blocks'
import { BlockEditorClient } from './BlockEditorClient'

export const metadata: Metadata = {
  title: 'Edit Block',
}

export default async function BlockEditorPage({
  params,
}: {
  params: Promise<{ blockId: string }>
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

  const { blockId } = await params
  const result = await getBlock(blockId)
  if (!result) notFound()

  const categories = await listBlockCategories()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10 bg-steel-900 min-h-screen">
      <div className="mb-4">
        <Link
          href="/admin/blocks"
          className="inline-flex items-center gap-1 text-sm text-steel-400 hover:text-steel-100"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to library
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-steel-100">{result.block.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-steel-800 border border-steel-700 text-steel-300">
              {result.block.kind_slug}
            </span>
            <span className="text-xs text-steel-400">
              v{result.currentVersion.version_number}
            </span>
          </div>
        </div>
      </div>

      <BlockEditorClient
        block={result.block}
        currentVersion={result.currentVersion}
        allVersions={result.allVersions}
        categories={categories}
      />
    </div>
  )
}
