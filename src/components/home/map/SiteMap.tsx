'use client'
/**
 * Phase 63 -- the library drawn as an isometric site (sketch 009 A). Every area is a raised plate
 * with a name sign and its SOP count, joined to the others by walkways; every object (in its own
 * bay) on a plate is exactly one SOP of that area, so the map always matches the list.
 *
 * ADR-0010: areas nest. A parent area is a plate holding its sub-areas' plates (and its own SOPs).
 * Clicking an area zooms one level in: its sub-areas get signs and become buttons; a leaf's objects
 * show their titles and status and open Read. The list filters to the open area and everything in it.
 * Plates and objects are keyboard buttons. Geometry comes from src/lib/library/iso-layout.ts; text is
 * always a React node.
 *
 * Built lazily (no stylesheet import here): the hover / dim / focus rules live in blueprint-theme.css.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { byDepth, layoutSite, viewFor, type LayoutArea, type Packing, type Placed, type Plate as PlateBox } from '@/lib/library/iso-layout'
import { HEIGHT, TILE, project } from '@/lib/library/iso'
import { machineArt, objectBox } from '@/lib/library/site-art'
import { inArea, type LibraryArea } from '@/lib/library/areas'
import type { ObjectKind } from '@/lib/library/object-kind'
import type { RowStatus } from '@/lib/library/status'
import { MapKey } from './MapKey'
import { Bay, MapObject, PLATE_H, Plate } from './MapShapes'

export interface MapRow {
  id: string
  title: string
  areaId: string
  kind: ObjectKind
  /** The first linked machine's name, for its picture; null is a noticeboard. */
  machine?: string | null
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
  /** How sibling areas are packed (the org's setting, ADR-0010). Default balanced. */
  packing?: Packing
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

// A floor's top face as an affine map of plan coordinates, so painted lines and walkways lie on it.
const TOP_FACE = (z: number) => `matrix(${TILE * 0.866} ${TILE * 0.5} ${-TILE * 0.866} ${TILE * 0.5} 0 ${-z * TILE})`

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const plural = (n: number) => `${n} ${n === 1 ? 'SOP' : 'SOPs'}`
const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}
const top = (p: PlateBox) => (p.depth + 1) * PLATE_H

interface Label { row: MapRow; lx: number; ly: number; fs: number; w: number; h: number; shown: boolean }

/**
 * Where each object's title goes, and which ones fit. Labels are kept greedily in list order; one that
 * would overlap an already kept label is hidden (it still appears while its object is hovered or focused),
 * so a crowded area stays legible instead of printing 15 titles on top of each other.
 * ponytail: box widths are estimated from character counts; measure text if that ever clips.
 */
function placeLabels(objects: Placed[], list: MapRow[], u: number): Label[] {
  const fs = 12 * u
  const kept: Array<[number, number, number, number]> = []
  return objects.flatMap((o) => {
    const row = list[o.i]
    if (!row) return []
    const [lx, ly] = project(o.cx, o.cy, o.z + HEIGHT[o.kind] + 0.6)
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

export function SiteMap({ areas, rows, area, onArea, onOpenSop, orgName, packing = 'balanced', renderObjective, initialSize }: SiteMapProps) {
  const byArea = useMemo(() => {
    const m = new Map<string, MapRow[]>()
    for (const r of rows) m.set(r.areaId, [...(m.get(r.areaId) ?? []), r])
    return m
  }, [rows])

  const kids = useMemo(() => {
    const m = new Map<string | null, LibraryArea[]>()
    for (const a of areas) m.set(a.parentId ?? null, [...(m.get(a.parentId ?? null) ?? []), a])
    return m
  }, [areas])

  const layout = useMemo(() => {
    const node = (a: LibraryArea): LayoutArea => {
      const list = byArea.get(a.id) ?? []
      return { id: a.id, count: list.length, kinds: list.map((r) => r.kind), children: (kids.get(a.id) ?? []).map(node) }
    }
    return layoutSite((kids.get(null) ?? []).map(node), packing)
  }, [byArea, kids, packing])

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
  const path = useMemo(() => {
    const byId = new Map(areas.map((a) => [a.id, a]))
    const open = area === null ? undefined : byId.get(area)
    return (open?.path ?? (open ? [open.id] : [])).map((id) => byId.get(id)).filter((a): a is LibraryArea => !!a)
  }, [areas, area])
  const onPath = new Set(path.map((a) => a.id))
  const openArea = path[path.length - 1]
  const parentArea = path[path.length - 2]
  const labels = useMemo(
    () => (openArea ? placeLabels(byDepth(layout.objects.filter((o) => o.areaId === openArea.id)), byArea.get(openArea.id) ?? [], u) : []),
    [layout, openArea, byArea, u],
  )

  // The areas one level in from where the reader stands: they carry the signs, the key and the clicks.
  const level = kids.get(openArea?.id ?? null) ?? []
  const keyItems = useMemo(
    () => level.map((a) => ({ id: a.id, name: a.name, index: a.index, colourVar: a.colourVar, count: a.total ?? byArea.get(a.id)?.length ?? 0 })),
    [level, byArea],
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
  const platesOn = new Map<string | null, PlateBox[]>()
  for (const p of layout.plates) platesOn.set(p.parentId, [...(platesOn.get(p.parentId) ?? []), p])
  const objectsOf = new Map<string, Placed[]>()
  for (const o of layout.objects) objectsOf.set(o.areaId, [...(objectsOf.get(o.areaId) ?? []), o])
  const totalOf = (a: LibraryArea) => a.total ?? byArea.get(a.id)?.length ?? 0

  const lanes = (on: string | null) =>
    layout.lanes
      .filter((l) => l.on === on)
      .map((l, i) => {
        const along = l.w >= l.d
        return (
          <g key={i} transform={TOP_FACE(l.z)} aria-hidden="true">
            <rect x={l.x + 0.12} y={l.y + 0.12} width={Math.max(0, l.w - 0.24)} height={Math.max(0, l.d - 0.24)} vectorEffect="non-scaling-stroke" style={{ fill: 'var(--paper-1)', stroke: 'var(--ink-300)', strokeWidth: 1 }} />
            <line
              x1={along ? l.x + 0.4 : l.x + l.w / 2}
              y1={along ? l.y + l.d / 2 : l.y + 0.4}
              x2={along ? l.x + l.w - 0.4 : l.x + l.w / 2}
              y2={along ? l.y + l.d / 2 : l.y + l.d - 0.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="5 5"
              style={{ stroke: 'var(--ink-400)', strokeWidth: 1 }}
            />
          </g>
        )
      })

  const object = (o: Placed, a: LibraryArea, open: boolean) => {
    const row = (byArea.get(a.id) ?? [])[o.i]
    const box = objectBox(o.kind, o.x, o.y, o.z)
    const sprite = row ? machineArt(row.machine ?? null) : null
    const [shx, shy] = project(o.cx, o.cy, o.z)
    const bay = <Bay cx={o.cx} cy={o.cy} cw={o.cw} cd={o.cd} z={o.z} colourVar={a.colourVar} />
    const shapes = sprite ? (
      <>
        {bay}
        <ellipse cx={shx} cy={shy} rx={box.w * 0.42} ry={box.w * 0.16} style={{ fill: 'var(--ink-900)', opacity: 0.14 }} />
        <image href={sprite} x={box.x - box.w * 0.1} y={box.y - box.h * 0.2} width={box.w * 1.2} height={box.h * 1.2} preserveAspectRatio="xMidYMax meet" />
      </>
    ) : (
      <>
        {bay}
        <MapObject kind={o.kind} x={o.x} y={o.y} z={o.z} colourVar={a.colourVar} />
      </>
    )
    if (!row) return <g key={`o${o.i}`}>{shapes}</g>
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
  }

  // One area's plate with everything on it. `dimmed`: an ancestor already carries the dimming.
  const plate = (p: PlateBox, dimmed: boolean): ReactNode => {
    const a = areaById.get(p.id)
    if (!a) return null
    const open = area === p.id
    const clickable = !onPath.has(p.id) && (p.parentId === null || onPath.has(p.parentId))
    const outside = area !== null && !onPath.has(p.id) && !inArea(areas, p.id, area)
    const dim = outside && !dimmed
    const state = area === null ? '' : open ? 'cur' : onPath.has(p.id) ? 'path' : dim ? 'dim' : ''
    const name = `${a.name}, ${plural(totalOf(a))}`
    const go = () => onArea(p.id)
    const inner = [
      ...(platesOn.get(p.id) ?? []).map((c) => ({ key: c.x + c.w / 2 + c.y + c.d / 2, node: plate(c, dimmed || dim) })),
      ...(objectsOf.get(p.id) ?? []).map((o) => ({ key: o.cx + o.cy, node: object(o, a, open) })),
    ].sort((x, y) => x.key - y.key)
    return (
      <g
        key={p.id}
        data-testid="map-area"
        data-area-id={p.id}
        data-state={state}
        className="map-plate"
        {...(clickable
          ? { role: 'button', tabIndex: 0, 'aria-label': name, onClick: go, onKeyDown: activate(go) }
          : { role: 'group', 'aria-label': name })}
      >
        <Plate x={p.x} y={p.y} z={p.depth * PLATE_H} w={p.w} d={p.d} colourVar={a.colourVar} />
        {/* A painted floor line just inside the edge: the zone reads as a marked area of the floor. */}
        <g transform={TOP_FACE(top(p))} aria-hidden="true">
          <rect x={p.x + 0.3} y={p.y + 0.3} width={p.w - 0.6} height={p.d - 0.6} vectorEffect="non-scaling-stroke" strokeDasharray="6 4" style={{ fill: 'none', stroke: a.colourVar, strokeWidth: 1.5 }} />
        </g>
        {lanes(p.id)}
        {inner.map((x) => x.node)}
        <title>{clickable ? `${a.name} · ${plural(totalOf(a))} — click to open` : a.name}</title>
      </g>
    )
  }

  const crumbs = path.slice(0, -1)
  const levelIds = new Set(level.map((a) => a.id))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div data-testid="map-header" className="flex min-h-16 shrink-0 items-center gap-2.5 border-b border-ink-200 px-5 py-2.5">
        {openArea && (
          <button
            type="button"
            data-testid="map-back"
            aria-label={`Back to ${parentArea?.name ?? orgName}`}
            title={`Back to ${parentArea?.name ?? orgName}`}
            onClick={() => onArea(parentArea?.id ?? null)}
            className="back shrink-0 px-2.5"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        )}
        {openArea ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-reading font-bold text-ink-900">
            <button type="button" data-testid="map-crumb" onClick={() => onArea(null)} className="min-h-tap font-medium text-ink-500 hover:text-ink-900">
              {orgName}
            </button>
            {crumbs.map((c) => (
              <span key={c.id} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-ink-500">›</span>
                <button type="button" data-testid="map-crumb-area" onClick={() => onArea(c.id)} className="min-h-tap font-medium text-ink-500 hover:text-ink-900">
                  {c.name}
                </button>
              </span>
            ))}
            <span aria-hidden="true" className="text-ink-500">›</span>
            <span aria-hidden="true" style={{ color: openArea.colourVar }}>■</span>
            {openArea.name}
          </span>
        ) : (
          <span className="text-reading font-bold text-ink-900">{orgName} · site map</span>
        )}
        <span className="ml-auto shrink-0 font-label text-meta text-ink-600 max-lg:hidden">
          {!openArea
            ? 'click an area to open it'
            : level.length > 0
              ? `click an area or a SOP · ${parentArea ? `Esc for ${parentArea.name}` : 'Esc for the whole site'}`
              : `click a SOP to read it · ${parentArea ? `Esc for ${parentArea.name}` : 'Esc for the whole site'}`}
        </span>
      </div>
      <div className="px-5 pt-2 empty:hidden">{renderObjective?.(area)}</div>

      <svg
        ref={svgRef}
        data-testid="site-map"
        data-packing={packing}
        className="map-svg block min-h-0 w-full flex-1"
        viewBox={initialBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Site map"
      >
        <polygon points={groundPts} style={{ fill: 'var(--ink-200)', stroke: 'var(--ink-300)' }} />
        {/* Walkways: pale lanes with a dashed centre line joining every area. */}
        {lanes(null)}

        {byDepth(platesOn.get(null) ?? []).map((p) => plate(p, false))}

        {layout.plates
          .filter((p) => levelIds.has(p.id))
          .map((p) => {
            const a = areaById.get(p.id)
            if (!a) return null
            const subs = kids.get(a.id)?.length ?? 0
            const [cx, cy] = [p.x + p.w / 2, p.y + p.d / 2]
            const [sx, sy] = project(cx, cy, top(p) + 2.7)
            const [, floorY] = project(cx, cy, top(p))
            const label = clip(a.name, 22)
            const count = subs > 0 ? `${subs} areas · ${plural(totalOf(a))}` : plural(totalOf(a))
            const w = (label.length * 7.4 + count.length * 7 + 36) * k
            const h = 26 * k
            const [mx, my] = project(cx, cy, top(p) + 0.9)
            return (
              <g key={p.id} className="map-sign" aria-hidden="true">
                <g className="max-lg:hidden">
                  <line x1={sx} y1={sy} x2={sx} y2={floorY} strokeDasharray={`${2 * k} ${3 * k}`} style={{ stroke: a.colourVar, strokeWidth: 1.2 * k }} />
                  <rect x={sx - w / 2} y={sy - h} width={w} height={h} rx={5 * k} style={{ fill: 'var(--ink-900)' }} />
                  <rect x={sx - w / 2} y={sy - h} width={6 * k} height={h} rx={2 * k} style={{ fill: a.colourVar }} />
                  <text x={sx - w / 2 + 14 * k} y={sy - 9 * k} fontSize={12.5 * k} fontWeight={700} style={{ fill: 'var(--paper-1)' }}>
                    {label}
                  </text>
                  <text x={sx + w / 2 - 10 * k} y={sy - 9 * k} fontSize={12 * k} fontWeight={600} textAnchor="end" className="font-label" style={{ fill: 'var(--ink-200)' }}>
                    {count}
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

      <MapKey items={keyItems} onArea={onArea} />
    </div>
  )
}
