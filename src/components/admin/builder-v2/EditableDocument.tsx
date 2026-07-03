'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { sanitizeLayoutContent } from '@/lib/builder/sanitize-layout'
import { useBuilderAutosave } from '@/hooks/useBuilderAutosave'
import {
  updateBlockProps,
  deleteBlock,
  duplicateBlock,
  type LayoutItem,
} from '@/lib/builder/content-ops'
import { BlockEditShell } from './BlockEditShell'

/**
 * The bespoke edit canvas (D-01, R2) — replaces `<Puck onChange>`.
 *
 * Holds the active section's `content[]` in local state, renders each entry as
 * a `<BlockEditShell>` wrapping the SAME worker component, and on every content
 * change feeds `{ content, root }` into the UNCHANGED `useBuilderAutosave`
 * (P11 RE-WIRE — no new persistence path). The hook debounces to Dexie
 * `draftLayouts`; `useDraftLayoutSync` flushes to Supabase, exactly as before.
 *
 * Selection state stays LOCAL (`useState`) — no search-param/route writes on
 * the hot edit path (CLAUDE.md 2026-05-13). Hydration-clean: no navigator/
 * window at module load or in render (#418).
 */

interface SectionLike {
  id: string
  title?: string | null
  layout_data?: unknown
}

interface EditableDocumentProps {
  section: SectionLike
  sopId: string
}

function seedContent(layoutData: unknown): LayoutItem[] {
  const parsed = LayoutDataSchema.safeParse(layoutData)
  if (!parsed.success) return []
  return sanitizeLayoutContent((parsed.data.content ?? []) as unknown[]) as LayoutItem[]
}

function seedRoot(layoutData: unknown): Record<string, unknown> {
  const parsed = LayoutDataSchema.safeParse(layoutData)
  return (parsed.success && parsed.data.root ? parsed.data.root : { props: {} }) as Record<
    string,
    unknown
  >
}

export function EditableDocument({ section, sopId }: EditableDocumentProps) {
  const [content, setContent] = useState<LayoutItem[]>(() => seedContent(section.layout_data))
  const root = useMemo(() => seedRoot(section.layout_data), [section.layout_data])

  // P11: the SAME hook <Puck onChange> fed. Reads only { content, root }.
  const handleChange = useBuilderAutosave(section.id, sopId)

  // Re-seed on section switch (Puck used key={section.id} to remount). Suppress
  // the autosave that the re-seed would otherwise trigger.
  const sectionIdRef = useRef(section.id)
  const skipAutosave = useRef(true)
  useEffect(() => {
    if (sectionIdRef.current !== section.id) {
      sectionIdRef.current = section.id
      skipAutosave.current = true
      setContent(seedContent(section.layout_data))
    }
  }, [section.id, section.layout_data])

  // Emit { content, root } once per real change — the exact shape Puck emitted.
  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    handleChange({ content, root } as unknown as Parameters<typeof handleChange>[0])
  }, [content, root, handleChange])

  return (
    <div
      data-editable-document
      className="mx-auto max-w-[680px] space-y-2 px-6 py-8"
      style={{ backgroundSize: '20px 20px' }}
    >
      {content.length === 0 ? (
        <div className="p-8 text-center text-[var(--ink-500,#71717a)]">Nothing here yet</div>
      ) : (
        content.map((item) => (
          <BlockEditShell
            key={item.props.id}
            item={item}
            onCommitText={(field, value) =>
              setContent((c) => updateBlockProps(c, item.props.id, { [field]: value }))
            }
            onDuplicate={() => setContent((c) => duplicateBlock(c, item.props.id))}
            onDelete={() => setContent((c) => deleteBlock(c, item.props.id))}
          />
        ))
      )}
    </div>
  )
}
