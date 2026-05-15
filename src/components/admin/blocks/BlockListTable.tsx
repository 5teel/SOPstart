'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Archive } from 'lucide-react'
import { archiveBlock } from '@/actions/blocks'
import type { Block, BlockCategory } from '@/types/sop'

interface Props {
  blocks: Array<Block & { currentContent?: unknown }>
  categories: BlockCategory[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function BlockListTable({ blocks, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const categoryMap = new Map(categories.map((c) => [c.slug, c]))

  function handleArchive(blockId: string) {
    if (!confirm('Archive this item? It will no longer appear in the picker, but existing SOPs keep their snapshot.')) {
      return
    }
    startTransition(async () => {
      const res = await archiveBlock(blockId)
      if ('error' in res) {
        alert(`Failed to archive: ${res.error}`)
        return
      }
      router.refresh()
    })
  }

  if (blocks.length === 0) {
    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-lg p-8 text-center">
        <p className="text-base font-semibold text-[var(--ink-900)] mb-1">Nothing in your library yet</p>
        <p className="text-sm text-[var(--ink-500)]">
          Save your first item from the builder via the three-dot menu on any hazard, PPE, or step.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--ink-100)]">
      <table className="w-full text-sm bg-white text-[var(--ink-900)]">
        <thead className="bg-[var(--paper)] text-xs uppercase tracking-wider text-[var(--ink-500)]">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Kind</th>
            <th className="px-4 py-3 text-left">Categories</th>
            <th className="px-4 py-3 text-left">Updated</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const isGlobal = b.organisation_id === null
            const isArchived = b.archived_at !== null
            return (
              <tr key={b.id} className="border-t border-[var(--ink-100)] hover:bg-[var(--paper-2)]/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/blocks/${b.id}`}
                    className="font-medium text-[var(--ink-900)] hover:text-[var(--ink-700)]"
                  >
                    {b.name}
                  </Link>
                  {isGlobal && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-500)] border border-[var(--ink-300)] rounded px-1.5 py-0.5">
                      GLOBAL
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-500)]">
                    {b.kind_slug}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(b.category_tags ?? []).map((slug) => {
                      const cat = categoryMap.get(slug)
                      return (
                        <span
                          key={slug}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--paper-2)] text-[var(--ink-700)] border border-[var(--ink-300)]"
                        >
                          {cat?.display_name ?? slug}
                        </span>
                      )
                    })}
                    {(b.category_tags ?? []).length === 0 && (
                      <span className="text-xs text-[var(--ink-500)]">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(b.updated_at)}</td>
                <td className="px-4 py-3">
                  {isArchived ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-950/40 border border-red-700/40 text-red-300">
                      Archived
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-950/40 border border-green-700/40 text-green-300">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!isArchived && !isGlobal && (
                    <button
                      type="button"
                      onClick={() => handleArchive(b.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ink-500)] hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      aria-label={`Archive ${b.name}`}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
