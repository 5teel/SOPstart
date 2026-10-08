/**
 * Phase 63 -- scroll one panel's section into view when the bell or an answered-request row asks
 * (Phase 60 A-06). Scrolls and focuses the heading only -- never navigates. Plain hook, no stylesheet.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { OVERVIEW_SECTION_EVENT, takeOverviewSection, type OverviewSection } from '@/lib/shell/overview-focus'

/** `settled` = the panel has finished loading; a section that never rendered then drops the request. */
export function useSectionScroll(section: OverviewSection, ref: RefObject<HTMLElement | null>, settled: boolean) {
  const wanted = useRef(false)
  const settledRef = useRef(settled)
  settledRef.current = settled

  function tryScroll() {
    if (!wanted.current) return
    const el = ref.current
    if (el) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
      el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    } else if (!settledRef.current) return
    wanted.current = false
  }

  useEffect(() => {
    const take = () => {
      if (takeOverviewSection(section)) wanted.current = true
      tryScroll()
    }
    take()
    window.addEventListener(OVERVIEW_SECTION_EVENT, take)
    return () => window.removeEventListener(OVERVIEW_SECTION_EVENT, take)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    tryScroll()
  })
}
