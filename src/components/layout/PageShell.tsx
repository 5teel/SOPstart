'use client'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Universal page-level structural shell.
 *
 * Every screen wraps its primary content in <PageShell>. The shell owns:
 *   - Horizontal centering + max-width (configurable per route)
 *   - Consistent gutter padding
 *   - Consistent vertical rhythm
 *   - A mount-enter animation so route transitions feel intentional, not jumpy
 *
 * Width presets map to the existing tailwind max-w scale. Pick per-route:
 *   sm   = max-w-2xl   (narrow forms, focused reading)
 *   md   = max-w-3xl   (default reading width, tab content)
 *   lg   = max-w-4xl   (walkthrough big-text variant)
 *   xl   = max-w-5xl   (SOP detail page header, library)
 *   2xl  = max-w-6xl   (dashboards, admin tables)
 *   full = no clamp    (immersive SVG flows, photo capture)
 */

export type PageShellWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

const WIDTH_CLASS: Record<PageShellWidth, string> = {
  sm:   'max-w-2xl',
  md:   'max-w-3xl',
  lg:   'max-w-4xl',
  xl:   'max-w-5xl',
  '2xl':'max-w-6xl',
  full: '',
}

export interface PageShellProps {
  children: ReactNode
  /** Max-width preset. Default 'xl' (matches SOP detail / library). */
  width?: PageShellWidth
  /** Horizontal padding utility. Default 'px-4' on mobile, 'sm:px-6' larger. */
  paddingX?: string
  /** Vertical padding utility. Default 'py-6'. Pass empty string for none. */
  paddingY?: string
  /**
   * Animation key. When this value changes, the mount-enter animation re-runs.
   * Default: undefined (animation runs once on mount). Pass a route-stable
   * identifier (e.g. pathname + key tab name) if you want the animation to
   * re-trigger on internal sub-route changes.
   */
  animateKey?: string
  className?: string
  /** Override the root element. Default <div>. Use <main> for top-level pages. */
  as?: 'div' | 'main' | 'section'
}

export function PageShell({
  children,
  width = 'xl',
  paddingX = 'px-4 sm:px-6',
  paddingY = 'py-6',
  animateKey,
  className = '',
  as: Tag = 'div',
}: PageShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Re-trigger the mount-enter animation when animateKey changes by toggling
  // the class. This is the simple, no-JS-animation-library approach.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.classList.remove('page-shell-enter')
    // Force reflow so the animation restarts (vs being deduped)
    void el.offsetWidth
    el.classList.add('page-shell-enter')
  }, [animateKey])

  const widthCls = WIDTH_CLASS[width]
  const innerCls = [widthCls, 'mx-auto', paddingX, paddingY, className]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag className="page-shell-root">
      <div ref={rootRef} className={`page-shell-enter ${innerCls}`}>
        {children}
      </div>
    </Tag>
  )
}
