'use client'

import { useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

interface Props {
  before: { image: string; caption?: string }
  after: { image: string; caption?: string }
}

/**
 * Drag-to-compare before/after viewer. Left of the divider shows the OLD
 * version, right shows the NEW one — drag the handle (or click) to wipe
 * between them. before/after images must be the same dimensions.
 */
export function BeforeAfter({ before, after }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const [drag, setDrag] = useState(false)

  function moveTo(clientX: number) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => moveTo(e.clientX)
    const onUp = () => setDrag(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag])

  return (
    <div>
      <div
        ref={ref}
        onPointerDown={(e) => {
          moveTo(e.clientX)
          setDrag(true)
        }}
        className="relative select-none overflow-hidden rounded-lg border border-[var(--ink-100)] bg-white cursor-ew-resize touch-none"
      >
        {/* base layer = AFTER */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after.image} alt={after.caption ?? 'After'} draggable={false} className="block w-full" />

        {/* overlay = BEFORE, clipped to the left of the divider */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before.image} alt={before.caption ?? 'Before'} draggable={false} className="block w-full" />
        </div>

        {/* corner labels */}
        <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[var(--ink-900)]/85 rounded px-1.5 py-0.5">
          Before
        </span>
        <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[var(--accent-step,#2563eb)] rounded px-1.5 py-0.5">
          After
        </span>

        {/* divider + handle */}
        <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border border-[var(--ink-200,#d4d4d8)] shadow-md flex items-center justify-center text-[var(--ink-700)]">
            <MoveHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>
      <p className="text-xs text-center text-[var(--ink-500)] mt-2">Drag to compare — old version on the left, new on the right</p>
    </div>
  )
}
