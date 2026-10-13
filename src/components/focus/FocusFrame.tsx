'use client'

/**
 * The SOP focus screen's frame (FOC-01, FOC-03): a slim top bar, a 300 px rail
 * and one centred reading column. It imports nothing from the site shell, the
 * map, the list, the inbox or notifications -- nothing from the site can appear
 * inside it. Browse renders `BrowseDocument` through `children` (ADR-0012: a live SOP is
 * read and run on the home, so this frame shows drafts, superseded versions and the editor).
 *
 * Edit and parsing (58-13) mount the admin editor through ONE next/dynamic
 * ({ ssr: false }) seam below -- the only reference to `focus/admin` from any
 * worker file -- so a worker never downloads a byte of it (CLAUDE.md 2026-09-13).
 */
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { FocusBackContext, FocusEditorBridgeContext, FocusOverlayContext, useFocusBack } from '@/hooks/useFocusBack'
import type { ParseJobSnapshot } from '@/hooks/useParseJob'
import type { EditorOwner, FocusSop } from '@/lib/sop/focus-read'
import { EditorSkeleton } from '@/components/focus/EditorSkeleton'
import { FocusRail, type FocusRailProps } from '@/components/focus/FocusRail'
import { FocusTopBar, ModeSwitch } from '@/components/focus/FocusTopBar'

const FocusEditor = dynamic(() => import('@/components/focus/admin/FocusEditor').then((m) => m.FocusEditor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

export type FocusMode = 'browse' | 'edit' | 'parsing'
export type VersionState = 'live' | 'draft' | 'superseded'

export interface FocusFrameProps {
  title: string
  mode: FocusMode
  versionState: VersionState
  from: string | null
  order: FocusRailProps['order']
  /** Top-bar chip, e.g. "v2 — superseded" or "Draft". */
  versionChip?: string | null
  /** What the lazy editor needs, passed straight through. Used in edit and parsing mode. */
  editor?: { sop: FocusSop; job: ParseJobSnapshot | null; canPublish: boolean; owner?: EditorOwner | null } | null
  /** The admin Read / Edit switch; omitted for workers, on superseded versions and while parsing. */
  modeSwitch?: { value: 'read' | 'edit'; onChange(next: 'read' | 'edit'): void } | null
  /** The editor reports its latest read of the SOP, so flipping to Read shows the steps as edited. */
  onEditorFocus?: (focus: FocusSop) => void
  children: ReactNode
}

export function FocusFrame({
  title,
  mode,
  versionState,
  from,
  order,
  versionChip,
  editor,
  modeSwitch,
  onEditorFocus,
  children,
}: FocusFrameProps) {
  const [railOpen, setRailOpen] = useState(false)
  const [saveSlot, setSaveSlot] = useState<HTMLElement | null>(null)

  // The editor registers its own flush and Back waits for it (the lazy chunk cannot be imported here).
  const editorBack = useRef<(() => Promise<unknown>) | null>(null)
  const setEditorBeforeBack = useCallback((fn: (() => Promise<unknown>) | null) => {
    editorBack.current = fn
  }, [])
  const mergedBeforeBack = useCallback(async () => {
    await editorBack.current?.()
  }, [])
  const focusRef = useRef(onEditorFocus)
  focusRef.current = onEditorFocus
  const reportFocus = useCallback((f: FocusSop) => focusRef.current?.(f), [])

  const { goBack, registerOverlay } = useFocusBack({ from, beforeBack: mergedBeforeBack })

  const editing = (mode === 'edit' || mode === 'parsing') && !!editor
  const stepsLabel = editing
    ? mode === 'edit'
      ? 'Steps'
      : null
    : order.length === 0
      ? null
      : `Steps · ${order.length}`

  const switchValue = modeSwitch?.value
  const switchChange = modeSwitch?.onChange
  const bridge = useMemo(
    () => ({
      railOpen,
      closeRail: () => setRailOpen(false),
      saveSlot,
      sheetTop:
        switchValue && switchChange ? <ModeSwitch testId="focus-mode-switch-sheet" value={switchValue} onChange={switchChange} /> : null,
      setBeforeBack: setEditorBeforeBack,
      onFocus: reportFocus,
    }),
    [railOpen, saveSlot, switchValue, switchChange, setEditorBeforeBack, reportFocus],
  )

  return (
    <FocusOverlayContext.Provider value={registerOverlay}>
      <FocusBackContext.Provider value={() => void goBack()}>
      <div data-testid="focus-screen" data-mode={mode} data-version-state={versionState} className="flex h-dvh flex-col bg-paper">
        <FocusTopBar
          title={title}
          chip={versionChip}
          stepsLabel={stepsLabel}
          onBack={() => void goBack()}
          onOpenRail={() => setRailOpen(true)}
        >
          {editing && <span ref={setSaveSlot} data-testid="focus-save-slot" className="contents" />}
          {modeSwitch && (
            <div className="max-sm:hidden">
              <ModeSwitch testId="focus-mode-switch" value={modeSwitch.value} onChange={modeSwitch.onChange} />
            </div>
          )}
        </FocusTopBar>
        <div className="flex min-h-0 flex-1">
          {editing && editor ? (
            <FocusEditorBridgeContext.Provider value={bridge}>
              <FocusEditor sop={editor.sop} job={editor.job} from={from} canPublish={editor.canPublish} owner={editor.owner ?? null} parsing={mode === 'parsing'} />
            </FocusEditorBridgeContext.Provider>
          ) : (
            <>
              <FocusRail
                order={order}
                open={railOpen}
                onClose={() => setRailOpen(false)}
                sheetTop={bridge.sheetTop}
              />
              <main data-testid="focus-column" className="min-w-0 flex-1 overflow-y-auto">
                {children}
              </main>
            </>
          )}
        </div>
      </div>
      </FocusBackContext.Provider>
    </FocusOverlayContext.Provider>
  )
}
