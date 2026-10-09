'use client'
/**
 * Phase 63 -- the library drawn as an isometric site (sketch 009 A). Every area is a raised plate
 * with a name sign and its SOP count; every object on a plate is exactly one SOP of that area, so
 * the map always matches the list. Click a plate to zoom in (the list filters); zoomed in, each
 * object shows its title and status and opens Read. Plates and objects are keyboard buttons.
 * Geometry comes from src/lib/library/iso-layout.ts; text is always a React node.
 *
 * Built lazily (no stylesheet import here): the hover / dim / focus rules live in blueprint-theme.css.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { byDepth, layoutSite, viewFor } from '@/lib/library/iso-layout'
import { HEIGHT, project } from '@/lib/library/iso'
import type { LibraryArea } from '@/lib/library/areas'
import type { ObjectKind } from '@/lib/library/object-kind'
import type { RowStatus } from '@/lib/library/status'
import { MapKey } from './MapKey'
import { MapObject, PLATE_H, Plate } from './MapShapes'

export interface MapRow {
  id: string
  title: string
  areaId: string
  kind: ObjectKind
  status: RowStatus | null
}

export interface SiteMapProps {
  areas: LibraryArea[]
  rows: MapRow[]
  /** The open area, or null for the whole site. */
  area: string | null
  onArea(id: string | null): void
  onOpenSop(id: string): void
  orgName: string
  /** Rendered under the header (the area's / site's objective); a slot so this module reads no data. */
  renderObjective?(areaId: string | null): ReactNode
  /** Drawing size in CSS px before it is measured (first paint / static renders). Default 660 x 700. */
  initialSize?: { w: number; h: number }
}

const STATUS_FILL: Record<RowStatus['kind'], string> = {
  signed: 'var(--accent-signoff)',
  waiting: 'var(--accent-decision)',
  updated: 'var(--accent-step)',
  stopped: 'var(--ink-900)',
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const plural = (n: number) => `${n} ${n === 1 ? 'SOP' : 'SOPs'}`
const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

interface Label { row: MapRow; lx: number; ly: number; fs: number; w: number; h: number; shown: boolean }

/**
 * Where each object's title goes, and which ones fit. Labels are kept greedily in list order; one that
 * would overlap an already kept label is hidden (it still appears while its object is hovered or focused),
 * so a crowded area stays legible instead of printing 15 titles on top of each other.
 * ponytail: box widths are estimated from character counts; measure text if that ever clips.
 */
function placeLabels(objects: ReturnType<typeof layoutSite>['objects'], list: MapRow[], u: number): Label[] {
  const fs = 12 * u
  const kept: Array<[number, number, number, number]> = []
  return objects.flatMap((o) => {
    const row = list[o.i]
    if (!row) return []
    const [lx, ly] = project(o.cx, o.cy, HEIGHT[o.kind] + 0.9)
    const text = clip(row.title, 28)
    const seg = row.status ? clip(`● ${row.status.text.split(' · ')[0]}`, 30) : ''
    const w = Math.max(text.length * 0.6 * fs, seg.length * 0.5 * 0.82 * fs) + 4 * u
    const h = fs * (seg ? 2.8 : 1.5)
    const box: [number, number, number, number] = [lx - w / 2, ly - fs * 1.1, lx + w / 2, ly - fs * 1.1 + h]
    const hit = kept.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1])
    if (!hit) kept.push(box)
    return [{ row, lx, ly, fs, w, h, shown: !hit }]
  })
}

function zoomMs(svg: SVGSVGElement): number {
  const v = getComputedStyle(svg).getPropertyValue('--dur-map-zoom').trim()
  const n = parseFloat(v)
  if (Number.isNaN(n)) return 520
  return v.endsWith('ms') ? n : n * 1000
}

export function SiteMap({ areas, rows, area, onArea, onOpenSop, orgName, renderObjective, initialSize }: SiteMapProps) {
  const byArea = useMemo(() => {
    const m = new Map<string, MapRow[]>()
    for (const r of rows) m.set(r.areaId, [...(m.get(r.areaId) ?? []), r])
    return m
  }, [rows])

  const layout = useMemo(
    () =>
      layoutSite(
        areas.map((a) => {
          const list = byArea.get(a.id) ?? []
          return { id: a.id, count: list.length, kinds: list.map((r) => r.kind) }
        }),
      ),
    [areas, byArea],
  )

  const target = useMemo(() => viewFor(layout, area), [layout, area])

  // The viewBox is driven on the element (a ref, no state per frame). React only ever sees the first value.
  const [initialBox] = useState(() => target.join(' '))
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<number[]>(target)
  const rafRef = useRef(0)
  const drawnRef = useRef(false)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      drawnRef.current = false
      return
    }
    const set = (b: number[]) => {
      boxRef.current = b
      svg.setAttribute('viewBox', b.join(' '))
    }
    const from = boxRef.current
    cancelAnimationFrame(rafRef.current)
    if (!drawnRef.current || from.join() === target.join() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawnRef.current = true
      set(target)
      return
    }
    const ms = zoomMs(svg)
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      set(from.map((f, i) => f + (target[i] - f) * e))
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  // Text is sized in CSS pixels: u = user units per CSS pixel at the current zoom (the drawing letterboxes, so the smaller axis rules).
  const empty = rows.length === 0
  const [size, setSize] = useState(initialSize ?? { w: 660, h: 700 })
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width / 10) * 10
      const h = Math.round(e.contentRect.height / 10) * 10
      if (w > 0 && h > 0) setSize((p) => (p.w === w && p.h === h ? p : { w, h }))
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, [empty])
  const u = 1 / Math.min(size.w / target[2], size.h / target[3])
  const k = u * 0.92 // sign scale (sketch numbers are authored at ~12.5 px type)
  const markerR = target[2] * 0.04

  const [hot, setHot] = useState<string | null>(null)
  const openArea = area === null ? undefined : areas.find((a) => a.id === area)
  const labels = useMemo(
    () => (openArea ? placeLabels(byDepth(layout.objects.filter((o) => o.areaId === openArea.id)), byArea.get(openArea.id) ?? [], u) : []),
    [layout, openArea, byArea, u],
  )

  const keyItems = useMemo(
    () => areas.map((a) => ({ id: a.id, name: a.name, index: a.index, colourVar: a.colourVar, count: byArea.get(a.id)?.length ?? 0 })),
    [areas, byArea],
  )

  if (empty) {
    return (
      <div data-testid="map-empty" className="flex h-full items-center justify-center p-10 text-center text-ui text-ink-500">
        No SOPs in your library yet.
      </div>
    )
  }

  const [gx0, gy0, gx1, gy1] = layout.ground
  const groundPts = [project(gx0, gy0), project(gx1, gy0), project(gx1, gy1), project(gx0, gy1)].map((p) => `${p[0]},${p[1]}`).join(' ')
  const areaById = new Map(areas.map((a) => [a.id, a]))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div data-testid="map-header" className="flex min-h-14 shrink-0 items-center gap-2.5 border-b border-ink-200 px-5 py-3">
        {openArea ? (
          <span className="flex items-center gap-2 text-reading font-bold text-ink-900">
            <button type="button" data-testid="map-crumb" onClick={() => onArea(null)} className="min-h-tap font-medium text-ink-500 hover:text-ink-900">
              {orgName}
            </button>
            <span aria-hidden="true" className="text-ink-500">›</span>
            <span aria-hidden="true" style={{ color: openArea.colourVar }}>■</span>
            {openArea.name}
          </span>
        ) : (
          <span className="text-reading font-bold text-ink-900">{orgName} · site map</span>
        )}
        <span className="ml-auto font-label text-meta text-ink-600 max-lg:hidden">
          {openArea ? 'click a SOP to read it · Esc for the whole site' : 'click an area to open it'}
        </span>
      </div>
      <div className="px-5 pt-2 empty:hidden">{renderObjective?.(area)}</div>

      <svg
        ref={svgRef}
        data-testid="site-map"
        className="map-svg block min-h-0 w-full flex-1"
        viewBox={initialBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Site map"
      >
        <polygon points={groundPts} style={{ fill: 'var(--ink-200)', stroke: 'var(--ink-300)' }} />

        {byDepth(layout.plates).map((plate) => {
          const a = areaById.get(plate.id)
          if (!a) return null
          const list = byArea.get(plate.id) ?? []
          const open = area === plate.id
          const state = area === null ? '' : open ? 'cur' : 'dim'
          const objects = byDepth(layout.objects.filter((o) => o.areaId === plate.id))
          const name = `${a.name}, ${plural(list.length)}`
          const go = () => onArea(plate.id)
          return (
            <g
              key={plate.id}
              data-testid="map-area"
              data-area-id={plate.id}
              data-state={state}
              className="map-plate"
              {...(open
                ? { role: 'group', 'aria-label': name }
                : { role: 'button', tabIndex: 0, 'aria-label': name, onClick: go, onKeyDown: activate(go) })}
            >
              <Plate x={plate.x} y={plate.y} w={plate.w} d={plate.d} colourVar={a.colourVar} />
              {objects.map((o) => {
                const row = list[o.i]
                const shapes = <MapObject kind={o.kind} x={o.x} y={o.y} colourVar={a.colourVar} />
                if (!row) return <g key={o.i}>{shapes}</g>
                if (!open) return <g key={row.id}>{shapes}</g>
                const read = () => onOpenSop(row.id)
                return (
                  <g
                    key={row.id}
                    data-testid="map-object"
                    data-sop-id={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={row.title}
                    className="map-object"
                    onClick={read}
                    onKeyDown={activate(read)}
                    onPointerEnter={() => setHot(row.id)}
                    onPointerLeave={() => setHot(null)}
                    onFocus={() => setHot(row.id)}
                    onBlur={() => setHot(null)}
                  >
                    {shapes}
                    <title>{row.title}</title>
                  </g>
                )
              })}
              <title>{open ? a.name : `${a.name} · ${plural(list.length)} — click to open`}</title>
            </g>
          )
        })}

        {area === null &&
          layout.plates.map((plate) => {
            const a = areaById.get(plate.id)
            if (!a) return null
            const n = byArea.get(plate.id)?.length ?? 0
            const [cx, cy] = [plate.x + plate.w / 2, plate.y + plate.d / 2]
            const [sx, sy] = project(cx, cy, 3)
            const [, floorY] = project(cx, cy, PLATE_H)
            const label = clip(a.name, 22)
            const w = (label.length * 7.4 + 54) * k
            const h = 26 * k
            const [mx, my] = project(cx, cy, 1.2)
            return (
              <g key={plate.id} className="map-sign" aria-hidden="true">
                <g className="max-lg:hidden">
                  <line x1={sx} y1={sy} x2={sx} y2={floorY} strokeDasharray={`${2 * k} ${3 * k}`} style={{ stroke: a.colourVar, strokeWidth: 1.2 * k }} />
                  <rect x={sx - w / 2} y={sy - h} width={w} height={h} rx={5 * k} style={{ fill: 'var(--ink-900)' }} />
                  <rect x={sx - w / 2} y={sy - h} width={6 * k} height={h} rx={2 * k} style={{ fill: a.colourVar }} />
                  <text x={sx - w / 2 + 14 * k} y={sy - 9 * k} fontSize={12.5 * k} fontWeight={700} style={{ fill: 'var(--paper-1)' }}>
                    {label}
                  </text>
                  <text x={sx + w / 2 - 10 * k} y={sy - 9 * k} fontSize={10.5 * k} textAnchor="end" className="font-label" style={{ fill: 'var(--ink-400)' }}>
                    {n}
                  </text>
                </g>
                <g className="lg:hidden">
                  <circle cx={mx} cy={my} r={markerR} strokeWidth={markerR / 6} style={{ fill: a.colourVar, stroke: 'var(--paper-1)' }} />
                  <text x={mx} y={my + markerR * 0.38} textAnchor="middle" fontSize={markerR * 1.1} fontWeight={800} style={{ fill: 'var(--paper-1)' }}>
                    {a.index}
                  </text>
                </g>
              </g>
            )
          })}

        {labels
          .filter((l) => l.shown || l.row.id === hot)
          .sort((a, b) => Number(a.row.id === hot) - Number(b.row.id === hot)) // the hovered one paints last
          .map((l) => (
            <g key={l.row.id} className="map-label" aria-hidden="true">
              {l.row.id === hot && !l.shown && (
                <rect
                  x={l.lx - l.w / 2}
                  y={l.ly - l.fs * 1.1}
                  width={l.w}
                  height={l.h}
                  rx={3 * u}
                  style={{ fill: 'var(--paper-1)', stroke: 'var(--ink-300)', strokeWidth: u }}
                />
              )}
              <text x={l.lx} y={l.ly} textAnchor="middle" fontSize={l.fs} fontWeight={700} style={{ fill: 'var(--ink-900)' }}>
                {clip(l.row.title, 28)}
              </text>
              {l.row.status && (
                <text x={l.lx} y={l.ly + l.fs * 1.15} textAnchor="middle" fontSize={l.fs * 0.82} style={{ fill: STATUS_FILL[l.row.status.kind] }}>
                  ● {clip(l.row.status.text.split(' · ')[0], 30)}
                </text>
              )}
            </g>
          ))}
      </svg>

      <MapKey items={keyItems} area={area} onArea={onArea} />
    </div>
  )
}
