'use client'

/**
 * The SOP's own page: the editor (58-13), and a read-only document for draft and superseded
 * versions. ADR-0012: a live SOP is read and run on the home (the page redirects there), so
 * nothing here starts a run; the admin's Read switch on a live SOP goes to the home view.
 */
import { useMemo, useState } from 'react'
import { walkOrder } from '@/lib/sop/focus'
import type { EditorOwner, FocusSop } from '@/lib/sop/focus-read'
import type { ParseJobSnapshot } from '@/hooks/useParseJob'
import { formatHome, homeFromToken } from '@/lib/shell/home-state'
import { FocusFrame, type VersionState } from '@/components/focus/FocusFrame'
import { BrowseDocument } from '@/components/focus/BrowseDocument'

export interface FocusWalkerProps {
  data: FocusSop
  from: string | null
  versionState: VersionState
  /** The live version a superseded one was replaced by (D-14). */
  supersededBy: { id: string; version: number } | null
  /** 'browse' unless the page opened the editor: ?mode=edit, or a SOP still being read. */
  initialMode: 'browse' | 'edit' | 'parsing'
  /** The latest parse job (edit and parsing only). */
  job: ParseJobSnapshot | null
  /** Admin or safety manager with edit access: the Read / Edit switch, tick, run the AI check, publish (D-06). */
  canEdit: boolean
  /** The owner row of the editor's This SOP block; null when the viewer cannot edit. */
  owner?: EditorOwner | null
}

export function FocusWalker({ data: served, from, versionState: servedState, supersededBy, initialMode, job, canEdit, owner = null }: FocusWalkerProps) {
  // Read / Edit flips in place (D-06): local state plus the address, never a navigation.
  const [editing, setEditing] = useState(initialMode !== 'browse')
  // The editor reports its latest read of the SOP, so the document after an edit shows the steps as edited.
  const [edited, setEdited] = useState<FocusSop | null>(null)
  const data = edited ?? served
  // A draft published from the editor is live from that moment (no reload).
  const versionState: VersionState = servedState === 'draft' && data.sop.status === 'published' ? 'live' : servedState
  const order = useMemo(() => walkOrder(data.sections, data.steps), [data.sections, data.steps])

  function switchTo(next: 'read' | 'edit') {
    // A live SOP is read and run on the home (ADR-0012).
    if (next === 'read' && versionState === 'live') {
      window.location.assign(formatHome({ ...homeFromToken(from), s: 'sops', sop: data.sop.id }))
      return
    }
    const url = new URL(window.location.href)
    if (next === 'edit') url.searchParams.set('mode', 'edit')
    else url.searchParams.delete('mode')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    setEditing(next === 'edit')
  }
  const reading = initialMode === 'parsing' && !(edited && edited.steps.length > 0)
  const chip = versionState === 'superseded' ? `v${data.sop.version} — superseded` : versionState === 'draft' ? 'Draft' : null

  return (
    <FocusFrame
      title={data.sop.title ?? 'Untitled SOP'}
      mode={editing ? (reading ? 'parsing' : 'edit') : 'browse'}
      versionState={versionState}
      from={from}
      order={order}
      versionChip={chip}
      editor={editing ? { sop: served, job, canPublish: canEdit, owner } : null}
      modeSwitch={canEdit && versionState !== 'superseded' && initialMode !== 'parsing' ? { value: editing ? 'edit' : 'read', onChange: switchTo } : null}
      onEditorFocus={setEdited}
    >
      <BrowseDocument data={data} order={order} from={from} supersededBy={supersededBy} />
    </FocusFrame>
  )
}
