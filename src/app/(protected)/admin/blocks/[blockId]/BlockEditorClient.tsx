'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, History as HistoryIcon } from 'lucide-react'
import { updateBlock, archiveBlock } from '@/actions/blocks'
import type { Block, BlockVersion, BlockCategory, BlockContent } from '@/types/sop'

interface Props {
  block: Block
  currentVersion: BlockVersion
  allVersions: BlockVersion[]
  categories: BlockCategory[]
}

export function BlockEditorClient({ block, currentVersion, allVersions, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(block.name)
  const [categoryTags, setCategoryTags] = useState<string[]>(block.category_tags ?? [])
  const [freeTextTags, setFreeTextTags] = useState<string[]>(block.free_text_tags ?? [])
  const [contentJson, setContentJson] = useState(JSON.stringify(currentVersion.content, null, 2))
  const [changeNote, setChangeNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Filter to hazard / area categories for the picker (D-Save-02 picker filter)
  const pickableCategories = categories.filter(
    (c) => c.category_group === 'hazard' || c.category_group === 'area'
  )

  function toggleCategory(slug: string) {
    setCategoryTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function handleSave() {
    setError(null)
    setSavedMsg(null)

    let parsedContent: unknown
    try {
      parsedContent = JSON.parse(contentJson)
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`)
      return
    }

    startTransition(async () => {
      const res = await updateBlock({
        blockId: block.id,
        name,
        categoryTags,
        freeTextTags,
        content: parsedContent,
        changeNote: changeNote || undefined,
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      setSavedMsg(res.version ? `Saved as version ${res.version.version_number}` : 'Saved')
      setChangeNote('')
      router.refresh()
    })
  }

  function handleArchive() {
    if (!confirm('Archive this block? Existing SOPs keep their snapshot.')) return
    startTransition(async () => {
      const res = await archiveBlock(block.id)
      if ('error' in res) {
        setError(res.error)
        return
      }
      router.push('/admin/blocks')
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: edit form */}
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-steel-800 border border-steel-700 rounded-md px-3 py-2 text-steel-100 focus:border-brand-yellow focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-steel-400 mb-2">
            Categories
          </label>
          <div className="flex flex-wrap gap-1.5">
            {pickableCategories.map((c) => {
              const active = categoryTags.includes(c.slug)
              return (
                <button
                  type="button"
                  key={c.slug}
                  onClick={() => toggleCategory(c.slug)}
                  className={[
                    'text-xs px-2 py-1 rounded border transition-colors',
                    active
                      ? 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/40'
                      : 'bg-steel-800 text-steel-300 border-steel-700 hover:text-steel-100',
                  ].join(' ')}
                >
                  {c.display_name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="freetags" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Free-text tags (comma-separated)
          </label>
          <input
            id="freetags"
            type="text"
            value={freeTextTags.join(', ')}
            onChange={(e) =>
              setFreeTextTags(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
              )
            }
            className="w-full bg-steel-800 border border-steel-700 rounded-md px-3 py-2 text-steel-100 focus:border-brand-yellow focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Content (JSON; matches BlockContentSchema)
          </label>
          <textarea
            id="content"
            rows={12}
            value={contentJson}
            onChange={(e) => setContentJson(e.target.value)}
            className="w-full bg-steel-950 border border-steel-700 rounded-md px-3 py-2 font-mono text-xs text-steel-100 focus:border-brand-yellow focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="changeNote" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Change note (optional)
          </label>
          <input
            id="changeNote"
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-full bg-steel-800 border border-steel-700 rounded-md px-3 py-2 text-steel-100 focus:border-brand-yellow focus:outline-none"
            placeholder="Why are you saving this version?"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-700/40 rounded-md p-3">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="text-sm text-green-400 bg-green-950/30 border border-green-700/40 rounded-md p-3">
            {savedMsg}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[44px] rounded-lg hover:bg-amber-400 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save changes
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={isPending}
            className="bg-steel-800 border border-steel-700 text-steel-300 hover:text-red-300 hover:bg-red-950/30 font-semibold px-4 h-[44px] rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            Archive block
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-steel-400 hover:text-steel-100"
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            {showHistory ? 'Hide' : 'Show'} version history ({allVersions.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-2">
              {allVersions.map((v) => (
                <li
                  key={v.id}
                  className="text-xs bg-steel-800 border border-steel-700 rounded-md p-2 text-steel-300"
                >
                  <span className="font-semibold text-steel-100">v{v.version_number}</span>
                  {v.change_note && <span className="ml-2">— {v.change_note}</span>}
                  <span className="ml-2 text-steel-500">
                    {new Date(v.created_at).toLocaleString('en-NZ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT: live preview */}
      <div>
        <div className="text-xs uppercase tracking-wider text-steel-400 mb-2">Preview</div>
        <div className="bg-steel-800 border border-steel-700 rounded-lg p-4">
          <BlockPreview content={tryParse(contentJson)} />
        </div>
      </div>
    </div>
  )
}

function tryParse(json: string): BlockContent | null {
  try {
    return JSON.parse(json) as BlockContent
  } catch {
    return null
  }
}

function BlockPreview({ content }: { content: BlockContent | null }) {
  if (!content) {
    return <div className="text-sm text-steel-500">Invalid JSON — preview unavailable.</div>
  }
  // Render a minimal preview keyed off discriminator. The full builder uses the
  // BLOCK_REGISTRY components but those expect Puck-shaped props; for the editor
  // preview a content-shape-only preview is sufficient.
  switch (content.kind) {
    case 'hazard':
      return (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-red-300 mb-1">{content.severity}</div>
          <div className="text-steel-100">{content.text}</div>
        </div>
      )
    case 'ppe':
      return (
        <ul className="list-disc list-inside text-steel-100 space-y-1">
          {content.items.map((it: string, i: number) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )
    case 'step':
      return (
        <div>
          <div className="text-steel-100">{content.text}</div>
          {content.warning && (
            <div className="mt-2 text-xs text-red-300 italic">Warning: {content.warning}</div>
          )}
          {content.tip && (
            <div className="mt-1 text-xs text-blue-300 italic">Tip: {content.tip}</div>
          )}
        </div>
      )
    case 'emergency':
      return (
        <div>
          <div className="text-steel-100">{content.text}</div>
          {content.contacts && content.contacts.length > 0 && (
            <ul className="mt-2 text-xs text-steel-300">
              {content.contacts.map((c: string, i: number) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )
    default:
      return (
        <pre className="text-xs text-steel-300 overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      )
  }
}
