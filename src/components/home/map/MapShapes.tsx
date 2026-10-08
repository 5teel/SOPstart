'use client'
/**
 * Phase 63 -- shape descriptors (src/lib/library/iso.ts) to SVG nodes. Every colour is a token:
 * fixed roles read the ink / paper ramp, the area-tinted roles mix the plate's area colour
 * (one of the eight area tokens) into paper. No hex, no string SVG -- React nodes only.
 */
import { memo, type CSSProperties } from 'react'
import { boxFaces, glyph, type Shape as Descriptor } from '@/lib/library/iso'
import type { ObjectKind } from '@/lib/library/object-kind'

export const PLATE_H = 0.3

const EDGE: CSSProperties = { stroke: 'var(--ink-900)', strokeOpacity: 0.28, strokeWidth: 0.7 }

/** Roles that do not depend on the area colour. */
export const ROLE_STYLE: Record<string, CSSProperties> = {
  'steel-top': { fill: 'var(--ink-200)' },
  'steel-side': { fill: 'var(--ink-300)' },
  'steel-dark': { fill: 'var(--ink-400)' },
  'iron-top': { fill: 'var(--ink-400)' },
  'iron-side': { fill: 'var(--ink-500)' },
  'iron-dark': { fill: 'var(--ink-600)' },
  'coal-top': { fill: 'var(--ink-700)' },
  'coal-side': { fill: 'var(--ink-700)' },
  'coal-dark': { fill: 'var(--ink-600)' },
  'paper-top': { fill: 'var(--paper-1)' },
  'paper-side': { fill: 'var(--ink-200)' },
  'paper-dark': { fill: 'var(--paper-1)' },
  'card-top': { fill: 'color-mix(in srgb, var(--accent-decision) 22%, var(--paper-1))' },
  'card-side': { fill: 'color-mix(in srgb, var(--accent-decision) 34%, var(--paper-1))' },
  'card-dark': { fill: 'color-mix(in srgb, var(--accent-decision) 46%, var(--paper-1))' },
  'hazard-top': { fill: 'color-mix(in srgb, var(--accent-decision) 55%, var(--paper-1))' },
  'hazard-side': { fill: 'color-mix(in srgb, var(--accent-decision) 85%, var(--paper-1))' },
  'hazard-dark': { fill: 'var(--accent-decision)' },
  'tank-side': { fill: 'var(--ink-300)' },
  'tank-top': { fill: 'var(--ink-200)' },
  // lines
  edge: { stroke: 'var(--ink-900)', strokeOpacity: 0.28, strokeWidth: 0.7 },
  'iron-line': { stroke: 'var(--ink-600)', strokeWidth: 0.8 },
  ruling: { stroke: 'var(--ink-400)', strokeWidth: 1 },
}

const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, var(--paper-1))`

/** Roles that take the plate's area colour. */
function tinted(role: string, c: string): CSSProperties | undefined {
  switch (role) {
    case 'accent-top': return { fill: mix(c, 50) }
    case 'accent-side': return { fill: mix(c, 80) }
    case 'accent-dark': return { fill: c }
    case 'accent-soft-top': return { fill: mix(c, 25) }
    case 'accent-soft-side': return { fill: mix(c, 45) }
    case 'plate-top': return { fill: mix(c, 14), stroke: c, strokeWidth: 2 }
    case 'plate-right': return { fill: mix(c, 45) }
    case 'plate-left': return { fill: mix(c, 70) }
    default: return undefined
  }
}

export function roleStyle(role: string, colourVar: string, k: Descriptor['k']): CSSProperties {
  const own = tinted(role, colourVar) ?? ROLE_STYLE[role] ?? {}
  // solid faces and ellipses get the hairline edge unless the role sets its own stroke; rects (cylinder sides, bands) stay unstroked
  return k === 'poly' || k === 'ellipse' ? { ...EDGE, ...own } : own
}

const pts = (list: readonly (readonly [number, number])[]) => list.map((p) => `${p[0]},${p[1]}`).join(' ')

export function Shape({ d, colourVar }: { d: Descriptor; colourVar: string }) {
  const style = roleStyle(d.role, colourVar, d.k)
  switch (d.k) {
    case 'poly':
      return <polygon points={pts(d.pts)} style={style} />
    case 'ellipse':
      return <ellipse cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry} style={style} />
    case 'rect':
      return <rect x={d.x} y={d.y} width={d.w} height={d.h} style={style} />
    case 'line':
      return <line x1={d.pts[0][0]} y1={d.pts[0][1]} x2={d.pts[1][0]} y2={d.pts[1][1]} style={style} />
  }
}

/** The raised floor of one area. */
export const Plate = memo(function Plate({ x, y, w, d, colourVar }: { x: number; y: number; w: number; d: number; colourVar: string }) {
  return (
    <>
      {boxFaces(x, y, 0, w, d, PLATE_H, { top: 'plate-top', right: 'plate-right', left: 'plate-left' }).map((s, i) => (
        <Shape key={i} d={s} colourVar={colourVar} />
      ))}
    </>
  )
})

/** One SOP's object (footprint origin x, y). */
export const MapObject = memo(function MapObject({ kind, x, y, colourVar }: { kind: ObjectKind; x: number; y: number; colourVar: string }) {
  return (
    <>
      {glyph(kind, x, y).map((s, i) => (
        <Shape key={i} d={s} colourVar={colourVar} />
      ))}
    </>
  )
})
