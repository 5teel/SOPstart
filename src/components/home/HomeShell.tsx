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
import { ChevronLeft } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { ReadView } from '@/components/home/ReadView'
import { SectionMenu } from '@/components/home/SectionMenu'
import { SopList } from '@/components/home/SopList'
import { TabBar } from '@/components/home/TabBar'
import { AccountControl, type Site } from '@/components/shell/AccountControl'
import { InstallPrompt } from '@/components/shell/InstallPrompt'
import { useLibrary } from '@/hooks/useLibrary'
import { useRecentSops } from '@/hooks/useRecentSops'
import { requestOverviewSection } from '@/lib/shell/overview-focus'
import { formatHome, HOME, homeFrom, resolveHome, type HomeState } from '@/lib/shell/home-state'
import type { Packing } from '@/lib/library/iso-layout'

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
  siteId: string | null
  sites: Site[]
  userEmail: string | null
  userId: string
  role: string | null
  initial: HomeState
  /** The org's site map packing (ADR-0010). */
  packing?: Packing
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

export function HomeShell({ siteName, siteId, sites, userEmail, userId, role, initial, packing }: HomeShellProps) {
  const [state, setState] = useState<HomeState>(() => resolveHome(initial, role))
  const [phoneMap, setPhoneMap] = useState(false)
  // Desktop, while a SOP is open: the menu and the list fold away and the reader can open either (ADR-0011).
  const [menuOpen, setMenuOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const lib = useLibrary(userId)
  const { recent, mostUsed, remember } = useRecentSops(userId, lib.rows)
  const canWrite = role === 'admin' || role === 'safety_manager'

  // The one writer of the home state: state plus the address bar, from user events only.
  function select(next: HomeState) {
    const r = resolveHome(next, role)
    setState(r)
    window.history.replaceState(null, '', formatHome(r))
  }

  // Esc: close Read, then go up one area (not while typing, not under a dialog).
  const selectRef = useRef(select)
  const stateRef = useRef(state)
  const areasRef = useRef(lib.areas)
  useEffect(() => {
    selectRef.current = select
    stateRef.current = state
    areasRef.current = lib.areas
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget(e.target)) return
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      const s = stateRef.current
      if (s.s !== 'sops') return
      if (s.sop) selectRef.current({ ...s, sop: null })
      else if (s.area) selectRef.current({ ...s, area: areasRef.current.find((a) => a.id === s.area)?.parentId ?? null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openSop = (id: string) => {
    const row = lib.byId.get(id)
    if (row) remember(row.rootId)
    if (!state.sop) {
      setMenuOpen(false)
      setListOpen(false)
    }
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
    />
  ) : state.sop ? (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
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
      packing={packing}
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
      <SectionMenu role={role} section={state.s} userEmail={userEmail} orgName={siteName} orgId={siteId} sites={sites} onSelect={openSection} collapsed={sopOpen && !menuOpen} />

      {state.s === 'sops' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          {!sopOpen && (
            // Phone header: the brand on its own line, then the view tabs (the screen's top tier).
            <div className="shrink-0 lg:hidden">
              <div className="px-4 pb-2 pt-4">
                <Wordmark size="menu" />
              </div>
              <div className="view-tabs px-4" role="group" aria-label="View">
                {([false, true] as const).map((m) => (
                  <button
                    key={String(m)}
                    type="button"
                    data-testid={m ? 'phone-view-map' : 'phone-view-list'}
                    aria-pressed={phoneMap === m}
                    onClick={() => setPhoneMap(m)}
                  >
                    {m ? 'Site map' : 'List'}
                  </button>
                ))}
              </div>
              <InstallPrompt />
            </div>
          )}
          <div
            data-testid="home-list"
            data-folded={sopOpen && !listOpen}
            inert={sopOpen && !listOpen}
            className={`fold min-h-0 flex-1 border-ink-200 lg:order-last lg:w-100 lg:flex-none lg:border-l ${sopOpen || phoneMap ? 'max-lg:hidden' : ''}`}
          >
            <div className="h-full overflow-y-auto px-3.5 pb-6 pt-3 lg:w-100 lg:pt-0">
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
                <AccountControl email={userEmail} isAdmin={canWrite} org={siteName} orgId={siteId} sites={sites} />
              </div>
            </div>
          </div>
          <div className={`flex min-h-0 min-w-0 flex-1 flex-col bg-paper-1 ${!sopOpen && !phoneMap ? 'max-lg:hidden' : ''}`}>
            {state.sop && (
              // The reader's header band: back up, and on desktop the two folded panels.
              <div data-testid="read-bar" className="flex min-h-16 shrink-0 items-center gap-2 border-b border-ink-200 px-4">
                <button type="button" data-testid="panel-menu" aria-pressed={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="icon-key max-lg:hidden">
                  Menu
                </button>
                <button type="button" data-testid="read-back" onClick={back} className="back">
                  <ChevronLeft size={18} aria-hidden="true" />
                  <span className="lg:hidden">{phoneMap ? 'Site map' : 'My SOPs'}</span>
                  <span className="max-lg:hidden">Site map</span>
                </button>
                <button type="button" data-testid="panel-list" aria-pressed={listOpen} onClick={() => setListOpen((o) => !o)} className="icon-key ml-auto max-lg:hidden">
                  SOP list
                </button>
              </div>
            )}
            <div data-testid="home-reader" className="min-h-0 flex-1 overflow-y-auto">
              {reader}
            </div>
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
