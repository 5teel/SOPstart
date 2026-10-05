'use client'

/**
 * The SOP focus screen's frame (FOC-01, FOC-03): a slim top bar, a 300 px rail
 * and one centred reading column. It imports nothing from the site shell, the
 * map, the list, the inbox or notifications -- nothing from the site can appear
 * inside it. Walk (58-11) and edit (58-13) render through `children`; browse is
 * `BrowseDocument`.
 */
import { useState, type ReactNode } from 'react'
import { FocusBackContext, FocusOverlayContext, useFocusBack } from '@/hooks/useFocusBack'
import { FocusRail, type FocusRailProps } from '@/components/focus/FocusRail'
import { FocusTopBar } from '@/components/focus/FocusTopBar'

export type FocusMode = 'browse' | 'walk' | 'review' | 'sent' | 'edit' | 'parsing'
export type VersionState = 'live' | 'draft' | 'superseded'

export interface FocusFrameProps {
  title: string
  mode: FocusMode
  versionState: VersionState
  from: string | null
  order: FocusRailProps['order']
  /** 1-based walk position for the phone "Steps · n of N" button; omit in browse. */
  position?: number
  /** Top-bar chip, e.g. "v2 — superseded" or "Draft". */
  versionChip?: string | null
  rowState?: FocusRailProps['rowState']
  hollowDot?: FocusRailProps['hollowDot']
  onPickStep?: FocusRailProps['onPick']
  /** Awaited (up to 3 s) before Back leaves, so a pending save can flush. */
  beforeBack?: () => Promise<unknown>
  /** Right-hand top-bar slot (58-13: Walk / Edit switch and save pill). */
  topBarSlot?: ReactNode
  children: ReactNode
}

export function FocusFrame({
  title,
  mode,
  versionState,
  from,
  order,
  position,
  versionChip,
  rowState,
  hollowDot,
  onPickStep,
  beforeBack,
  topBarSlot,
  children,
}: FocusFrameProps) {
  const [railOpen, setRailOpen] = useState(false)
  const { goBack, registerOverlay } = useFocusBack({ from, beforeBack })
  const stepsLabel = order.length === 0 ? null : position ? `Steps · ${position} of ${order.length}` : `Steps · ${order.length}`

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
          {topBarSlot}
        </FocusTopBar>
        <div className="flex min-h-0 flex-1">
          <FocusRail
            order={order}
            open={railOpen}
            onClose={() => setRailOpen(false)}
            rowState={rowState}
            hollowDot={hollowDot}
            onPick={onPickStep}
          />
          <main data-testid="focus-column" className="min-w-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      </FocusBackContext.Provider>
    </FocusOverlayContext.Provider>
  )
}
