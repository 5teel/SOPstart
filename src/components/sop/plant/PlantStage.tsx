'use client'

/**
 * Read-only worker scene (D-02): a raw `<img>` at natural size inside one
 * transformed `world` div with an SVG polygon overlay -- the admin-only
 * canvas engine used by the site editor is deliberately absent here (see
 * the Phase 26/51 worker-isolation deny test under tests/phase26/).
 *
 * Camera maths (fit / zoom-to-cursor / fly-to / department-chip fit) all
 * come from src/lib/site/scene.ts -- no hand-rolled copies here (D-07).
 *
 * The stage mounts with a neutral (null) view and fits in an effect after
 * mount; no window/navigator/clientWidth read happens during first render
 * (D-09, 2026-06-08 hydration class).
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Point } from '@/lib/validators/site'
import {
  CAMERA_MS,
  ZOOM_MIN,
  ZOOM_MAX,
  centroid,
  fitBoxView,
  fitView,
  flyToView,
  zoomAt,
  type View,
} from '@/lib/site/scene'

export interface PlantStageMachine {
  id: string
  name: string
  polygon: Point[]
  pin: number
  highlighted: boolean
  selected: boolean
  zoned: boolean
  zoneColour: string
  /** Admin repaint only (Phase 54, D-04) -- caller-classified (admin-health.ts);
   *  the stage only paints it, it never reads governance data itself. */
  health?: 'bad' | 'due' | 'ok'
}

export interface PlantStageHandle {
  fit(): void
  flyTo(machineId: string): void
  fitMachines(machineIds: string[]): void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Selected > hovered/highlighted > zoned > pinned > transparent. */
function polygonPaint(m: PlantStageMachine, hovered: boolean): React.CSSProperties {
  if (m.selected) {
    return {
      fill: 'color-mix(in srgb, var(--ink-900) 10%, transparent)',
      stroke: 'var(--ink-900)',
      strokeWidth: 3,
    }
  }
  if (hovered || m.highlighted) {
    return {
      fill: 'color-mix(in srgb, var(--accent-step) 14%, transparent)',
      stroke: 'var(--accent-step)',
      strokeWidth: 2,
    }
  }
  if (m.zoned) {
    return {
      fill: `color-mix(in srgb, ${m.zoneColour} 12%, transparent)`,
      stroke: 'transparent',
    }
  }
  if (m.health === 'bad') {
    return {
      fill: 'color-mix(in srgb, var(--accent-escalate) 10%, transparent)',
      stroke: 'color-mix(in srgb, var(--accent-escalate) 55%, transparent)',
      strokeWidth: 2,
      strokeDasharray: '6 4',
    }
  }
  if (m.health === 'due') {
    return {
      fill: 'color-mix(in srgb, var(--accent-decision) 10%, transparent)',
      stroke: 'color-mix(in srgb, var(--accent-decision) 55%, transparent)',
      strokeWidth: 2,
      strokeDasharray: '6 4',
    }
  }
  if (m.pin > 0) {
    return {
      fill: 'color-mix(in srgb, var(--accent-decision) 10%, transparent)',
      stroke: 'color-mix(in srgb, var(--accent-decision) 55%, transparent)',
      strokeWidth: 2,
      strokeDasharray: '6 4',
    }
  }
  return { fill: 'transparent', stroke: 'transparent' }
}

export function PlantStage({
  ref,
  sceneUrl,
  sceneWidth,
  sceneHeight,
  machines,
  onMachineClick,
}: {
  ref?: React.Ref<PlantStageHandle>
  sceneUrl: string
  sceneWidth: number
  sceneHeight: number
  machines: PlantStageMachine[]
  onMachineClick(id: string): void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View | null>(null)
  const viewRef = useRef<View | null>(null)
  const [flying, setFlying] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [worldHover, setWorldHover] = useState(false)
  const followFitRef = useRef(true)
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const animateTo = useCallback((next: View) => {
    if (prefersReducedMotion()) {
      setView(next)
      return
    }
    setFlying(true)
    setView(next)
    if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current)
    flyTimeoutRef.current = setTimeout(() => setFlying(false), CAMERA_MS + 30)
  }, [])

  useEffect(() => {
    return () => {
      if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current)
    }
  }, [])

  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    // Re-measure on every call -- a stage built while hidden measures 0x0.
    const next = fitView(el.clientWidth, el.clientHeight, sceneWidth, sceneHeight)
    if (!next) return
    followFitRef.current = true
    animateTo(next)
  }, [sceneWidth, sceneHeight, animateTo])

  const flyTo = useCallback((machineId: string) => {
    const el = containerRef.current
    const machine = machines.find((m) => m.id === machineId)
    if (!el || !machine) return
    const next = flyToView(el.clientWidth, el.clientHeight, centroid(machine.polygon))
    if (!next) return
    followFitRef.current = false
    animateTo(next)
  }, [machines, animateTo])

  const fitMachines = useCallback((machineIds: string[]) => {
    const el = containerRef.current
    if (!el) return
    followFitRef.current = false
    const polygons = machines.filter((m) => machineIds.includes(m.id)).map((m) => m.polygon)
    const next = fitBoxView(el.clientWidth, el.clientHeight, polygons)
    if (!next) {
      fit()
      return
    }
    animateTo(next)
  }, [machines, animateTo, fit])

  useImperativeHandle(ref, () => ({ fit, flyTo, fitMachines }), [fit, flyTo, fitMachines])

  // Mount neutral, fit after mount (D-09) -- and again whenever the scene changes.
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneUrl, sceneWidth, sceneHeight])

  // A stage built while hidden measures 0x0 -- retry via ResizeObserver.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (viewRef.current === null || followFitRef.current) fit()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  // Wheel zoom-to-cursor -- React's onWheel is passive and cannot preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      followFitRef.current = false
      setView((v) => (v ? zoomAt(v, pointer, e.deltaY, ZOOM_MIN, ZOOM_MAX) : v))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Clicks on machines must not start a pan (D-07).
    if ((e.target as Element).tagName === 'polygon') return
    if (!view) return
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    followFitRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    const nx = d.vx + (e.clientX - d.x)
    const ny = d.vy + (e.clientY - d.y)
    setView((v) => (v ? { ...v, x: nx, y: ny } : v))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  return (
    <div
      ref={containerRef}
      data-testid="plant-stage"
      className="absolute inset-0 overflow-hidden bg-[var(--paper-2)] touch-none"
      onPointerEnter={() => setWorldHover(true)}
      onPointerLeave={() => setWorldHover(false)}
    >
      <div
        data-testid="plant-world"
        data-scale={view?.s ?? ''}
        data-x={view?.x ?? ''}
        data-y={view?.y ?? ''}
        className={`absolute left-0 top-0 origin-top-left cursor-grab transition-transform ease-out motion-reduce:transition-none ${view ? '' : 'invisible'}`}
        style={{
          width: sceneWidth,
          height: sceneHeight,
          transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.s})` : undefined,
          transitionDuration: flying ? `${CAMERA_MS}ms` : '0ms',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={sceneUrl}
          alt="Site map"
          width={sceneWidth}
          height={sceneHeight}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        <svg
          viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          {machines.map((m) => (
            <polygon
              key={m.id}
              data-testid="plant-machine"
              data-machine-id={m.id}
              data-machine-name={m.name}
              data-pin={m.pin}
              data-health={m.health ?? ''}
              data-highlighted={m.highlighted}
              data-selected={m.selected}
              points={m.polygon.map((p) => p.join(',')).join(' ')}
              role="button"
              tabIndex={0}
              aria-label={
                m.health === 'bad'
                  ? `${m.name}, a procedure here has nobody responsible`
                  : m.health === 'due'
                    ? `${m.name}, a review is due here`
                    : m.pin > 0
                      ? `${m.name}, ${m.pin} to do`
                      : m.name
              }
              className="pointer-events-auto cursor-pointer"
              style={polygonPaint(m, hoverId === m.id)}
              onClick={() => onMachineClick(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onMachineClick(m.id)
                }
              }}
              onPointerEnter={() => setHoverId(m.id)}
              onPointerLeave={() => setHoverId((id) => (id === m.id ? null : id))}
            />
          ))}
        </svg>
        {machines.map((m) => {
          const [cx] = centroid(m.polygon)
          const top = Math.min(...m.polygon.map((p) => p[1]))
          const hovered = hoverId === m.id
          const labelVisible =
            hovered ||
            m.highlighted ||
            m.selected ||
            (m.pin > 0 && worldHover) ||
            ((m.health === 'bad' || m.health === 'due') && worldHover)
          const invScale = view ? 1 / view.s : 1
          return (
            <div
              key={m.id}
              className="pointer-events-none absolute flex flex-col items-center gap-0.5"
              style={{
                left: cx,
                top: top - 6,
                transform: `translate(-50%, -100%) scale(${invScale})`,
                transformOrigin: 'bottom center',
              }}
            >
              <span
                data-testid="plant-label"
                className={`mono whitespace-nowrap rounded border border-[var(--ink-300)] bg-white/92 px-2 py-0.5 text-xs font-bold text-[var(--ink-900)] transition-opacity duration-150 ${labelVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                {m.name}
              </span>
              {m.health ? (
                <span
                  data-testid="plant-health-pin"
                  data-health={m.health}
                  className={
                    m.health === 'bad'
                      ? 'mono grid h-6.5 w-6.5 place-items-center rounded-full border-2 border-white bg-accent-escalate text-xs font-extrabold text-white shadow'
                      : m.health === 'due'
                        ? 'mono grid h-6.5 w-6.5 place-items-center rounded-full border-2 border-white bg-accent-decision text-xs font-extrabold text-white shadow'
                        : 'h-2.5 w-2.5 rounded-full border border-white bg-accent-ok shadow'
                  }
                >
                  {m.health === 'bad' ? '!' : m.health === 'due' ? '↻' : ''}
                </span>
              ) : (
                m.pin > 0 && (
                  <span
                    data-testid="plant-pin"
                    className="plant-pin-bob mono grid h-6.5 w-6.5 place-items-center rounded-full border-2 border-white bg-accent-decision text-xs font-extrabold text-white shadow"
                  >
                    {m.pin}
                  </span>
                )
              )}
              <span className="h-3.5 w-0.5 bg-[var(--ink-900)] opacity-60" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
