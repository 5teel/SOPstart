'use client'
/**
 * Phase 63 (HOME-01, HOME-05, MAP-04) -- the SOP-first home, one tree for every role.
 *
 * Desktop: section menu, the SOP list, and a reader pane (Read for the open SOP, the site map
 * otherwise); the other sections take the width beside the menu. Phone: no menu, a bottom tab
 * bar, and My SOPs has a List | Site map toggle. Which of these shows is decided by CSS
 * (lg:), never by reading the window in render, so the first paint matches the server.
 *
 * All in-page state (section, SOP, area, tab, pin, view) changes through select(), which sets
 * state and writes the address with the History API. No router and no server action: a
 * navigation from here would race the mount-time actions of the lazy bodies (CLAUDE.md
 * 2026-09-29). Legacy ?place= addresses are redirected on the server in app/page.tsx.
 * Every section body and the map are lazy modules; none rides in the home download.
 */
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Wordmark } from '@/components/brand/Wordmark'
import { ReadView } from '@/components/home/ReadView'
import { SectionMenu } from '@/components/home/SectionMenu'
import { SopList } from '@/components/home/SopList'
import { TabBar } from '@/components/home/TabBar'
import { AccountControl } from '@/components/shell/AccountControl'
import { useLibrary } from '@/hooks/useLibrary'
import { useRecentSops } from '@/hooks/useRecentSops'
import { requestOverviewSection } from '@/lib/shell/overview-focus'
import { formatHome, HOME, homeFrom, resolveHome, type HomeState } from '@/lib/shell/home-state'

const OPENING = () => <p className="p-4 text-ui text-ink-500">Opening…</p>
const SiteMap = dynamic(() => import('@/components/home/map/SiteMap').then((m) => m.SiteMap), { ssr: false, loading: OPENING })
const MyRecordSection = dynamic(() => import('@/components/home/sections/MyRecordSection').then((m) => m.MyRecordSection), { ssr: false, loading: OPENING })
const TrainingSection = dynamic(() => import('@/components/home/sections/TrainingSection').then((m) => m.TrainingSection), { ssr: false, loading: OPENING })
const SignOffsSection = dynamic(() => import('@/components/home/sections/SignOffsSection').then((m) => m.SignOffsSection), { ssr: false, loading: OPENING })
const PeopleSection = dynamic(() => import('@/components/home/sections/PeopleSection').then((m) => m.PeopleSection), { ssr: false, loading: OPENING })
const ManageSection = dynamic(() => import('@/components/home/sections/ManageSection').then((m) => m.ManageSection), { ssr: false, loading: OPENING })
const NotificationBell = dynamic(() => import('@/components/shell/NotificationBell').then((m) => m.NotificationBell), {
  ssr: false,
  loading: () => null,
})
const WorkerObjective = dynamic(() => import('@/components/shell/WorkerObjective').then((m) => m.WorkerObjective), {
  ssr: false,
  loading: () => null,
})

export interface HomeShellProps {
  siteName: string
  userEmail: string | null
  userId: string
  role: string | null
  initial: HomeState
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

export function HomeShell({ siteName, userEmail, userId, role, initial }: HomeShellProps) {
  const [state, setState] = useState<HomeState>(() => resolveHome(initial, role))
  const [phoneMap, setPhoneMap] = useState(false)
  const lib = useLibrary(userId)
  const { recent, mostUsed, remember } = useRecentSops(userId, lib.rows)
  const canWrite = role === 'admin' || role === 'safety_manager'

  // The one writer of the home state: state plus the address bar, from user events only.
  function select(next: HomeState) {
    const r = resolveHome(next, role)
    setState(r)
    window.history.replaceState(null, '', formatHome(r))
  }

  // Esc: close Read, then leave the area (not while typing, not under a dialog).
  const selectRef = useRef(select)
  const stateRef = useRef(state)
  useEffect(() => {
    selectRef.current = select
    stateRef.current = state
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget(e.target)) return
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      const s = stateRef.current
      if (s.s !== 'sops') return
      if (s.sop) selectRef.current({ ...s, sop: null })
      else if (s.area) selectRef.current({ ...s, area: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openSop = (id: string) => {
    const row = lib.byId.get(id)
    if (row) remember(row.rootId)
    select({ ...state, sop: id })
  }
  const openArea = (id: string | null) => {
    select({ ...state, area: id, sop: null })
    if (id) setPhoneMap(true)
  }
  const openSection = (s: HomeState['s']) => select({ ...HOME, s })

  const sopOpen = state.s === 'sops' && !!state.sop
  const openRow = state.sop ? lib.byId.get(state.sop) : undefined
  const bell = (
    <NotificationBell
      onOpen={() => {
        select({ ...HOME, s: 'record' })
        requestOverviewSection('notifications')
      }}
    />
  )

  const loadError = (
    <div role="alert" data-testid="sops-load-error" className="flex flex-col items-start gap-3 p-4">
      <p className="text-reading text-accent-escalate">Could not load your SOPs. Check your connection and try again.</p>
      <button
        type="button"
        onClick={() => void lib.refetch()}
        className="min-h-tap rounded-lg border border-ink-200 px-4 text-ui font-medium text-ink-900"
      >
        Try again
      </button>
    </div>
  )

  const back = () => select({ ...state, sop: null })
  const reader = openRow ? (
    <ReadView
      key={openRow.id}
      row={openRow}
      role={role}
      from={homeFrom({ ...HOME, sop: openRow.id, area: state.area })}
      backLabel={phoneMap ? 'Site map' : 'My SOPs'}
      onBack={back}
    />
  ) : state.sop ? (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
      <button type="button" data-testid="read-back" onClick={back} className="mb-4 block min-h-tap text-ui text-ink-600">
        ‹ Back
      </button>
      <p data-testid="read-missing" className="text-reading text-ink-700">
        {lib.loading ? 'Loading…' : "This SOP isn't in your library."}
      </p>
    </div>
  ) : lib.error ? (
    loadError
  ) : lib.loading && lib.rows.length === 0 ? (
    <p className="p-4 text-ui text-ink-500">Loading…</p>
  ) : (
    <SiteMap
      areas={lib.areas}
      rows={lib.rows}
      area={state.area}
      onArea={openArea}
      onOpenSop={openSop}
      orgName={siteName}
      renderObjective={(a) => <WorkerObjective type={a ? 'department' : 'site'} id={a && a !== 'site-wide' ? a : null} />}
    />
  )

  const body = (() => {
    switch (state.s) {
      case 'record':
        return <MyRecordSection role={role} onHome={select} />
      case 'training':
        return <TrainingSection />
      case 'signoffs':
        return <SignOffsSection role={role} tab={state.tab} onTab={(t) => select({ ...state, tab: t })} />
      case 'people':
        return <PeopleSection role={role} tab={state.tab} pin={state.pin} onTab={(t) => select({ ...state, tab: t })} />
      case 'manage':
        return <ManageSection view={state.view} onView={(v) => select({ ...state, view: v })} />
      default:
        return null
    }
  })()

  return (
    <div data-testid="home" className="flex h-dvh flex-col bg-paper lg:flex-row">
      <SectionMenu role={role} section={state.s} userEmail={userEmail} orgName={siteName} onSelect={openSection} />

      {state.s === 'sops' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          {!sopOpen && (
            <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3 lg:hidden">
              <Wordmark size="phone" />
              <span className="inline-flex overflow-hidden rounded-lg border border-ink-300" role="group" aria-label="View">
                {([false, true] as const).map((m) => (
                  <button
                    key={String(m)}
                    type="button"
                    data-testid={m ? 'phone-view-map' : 'phone-view-list'}
                    aria-pressed={phoneMap === m}
                    onClick={() => setPhoneMap(m)}
                    className={`min-h-tap px-4 text-ui ${phoneMap === m ? 'bg-ink-900 text-white' : 'bg-paper-1 text-ink-900'}`}
                  >
                    {m ? 'Site map' : 'List'}
                  </button>
                ))}
              </span>
            </div>
          )}
          <div
            data-testid="home-list"
            className={`min-h-0 flex-1 overflow-y-auto border-ink-200 px-3.5 pb-6 pt-3 lg:w-100 lg:flex-none lg:border-r lg:pt-4 ${
              sopOpen || phoneMap ? 'max-lg:hidden' : ''
            }`}
          >
            {lib.error ? (
              loadError
            ) : lib.loading && lib.rows.length === 0 ? (
              <p aria-busy="true" className="p-2 text-ui text-ink-500">
                Loading your SOPs…
              </p>
            ) : (
              <SopList
                rows={lib.rows}
                areas={lib.areas}
                recent={recent}
                mostUsed={mostUsed}
                area={state.area}
                selectedId={state.sop}
                canWrite={canWrite}
                onOpen={openSop}
                onArea={openArea}
                trailing={bell}
              />
            )}
            <div className="mt-6 lg:hidden">
              <AccountControl email={userEmail} isAdmin={canWrite} />
            </div>
          </div>
          <div
            data-testid="home-reader"
            className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-paper-1 ${!sopOpen && !phoneMap ? 'max-lg:hidden' : ''}`}
          >
            {reader}
          </div>
        </div>
      ) : (
        <div data-testid="home-section" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {body}
        </div>
      )}

      <TabBar role={role} section={state.s} onSelect={openSection} />
    </div>
  )
}
