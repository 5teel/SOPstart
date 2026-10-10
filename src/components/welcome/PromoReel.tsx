'use client'

/**
 * The signed-out promo reel at /welcome: one site picture (the bottling
 * template, ADR-0003) with a camera that glides between places while each
 * scene's caption and panel animate in. Storyboard and the rules it follows:
 * brag-output/brag-plan.md (hook -> reveal -> highlights -> 20 s Sign in).
 * The walk and step kinds reuse the app's own copy and colours (KindChip,
 * primaryLabel, the Sent for sign-off panel). Nothing is fetched.
 *
 * Playback is driven by the active progress bar's CSS animation: its
 * animationend advances the scene, so pause is just animation-play-state and
 * reduced motion (animations off) means no autoplay, with the bars to step.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'
import { Camera, CheckCircle, FileText, Pause, Play, Sparkles } from 'lucide-react'
import { SITE_PRESETS, presetImagePath } from '@/lib/site/presets'
import { KindChip } from '@/components/focus/KindChip'
import { primaryLabel, type FocusKind } from '@/lib/sop/focus'

type Frac = ReadonlyArray<readonly [number, number]>

const IW = 1280
const IH = 720
const IMAGE = presetImagePath('bottling')
const SITE = SITE_PRESETS.find((p) => p.id === 'bottling')!
const machine = (name: string) => SITE.machines.find((m) => m.name === name)!.frac
const FILLER = machine('Line 1 filler-capper')
const LABELLER = machine('Line 2 labeller')
// The reel is a recording of the earlier app until its deferred re-record: this is the
// site-cabin rectangle that app drew on the bottling picture, as fractions of the picture.
const OFFICE: Frac = [[0.1, 0.7], [0.27, 0.7], [0.27, 0.91], [0.1, 0.91]]

function centre(frac: Frac): [number, number] {
  return [frac.reduce((a, p) => a + p[0], 0) / frac.length, frac.reduce((a, p) => a + p[1], 0) / frac.length]
}

interface Cam {
  fx: number
  fy: number
  zoom: number
}

type SceneId = 'hook' | 'reveal' | 'machines' | 'structure' | 'walk' | 'ai' | 'outro'

interface Scene {
  id: SceneId
  label: string
  eyebrow: string
  title: string
  cam: Cam
  ms: number
}

const [FX, FY] = centre(FILLER)
const [LX, LY] = centre(LABELLER)
const [OX, OY] = centre(OFFICE)
const WIDE: Cam = { fx: 0.5, fy: 0.42, zoom: 1.05 }

// One headline per scene, each settled for at least 0.3 s a word.
const SCENES: Scene[] = [
  { id: 'hook', label: 'The old way', eyebrow: '', title: 'Your SOPs live in a Word doc.', cam: WIDE, ms: 3000 },
  { id: 'reveal', label: 'SOPstart', eyebrow: 'SOPstart', title: 'We put them on the floor.', cam: WIDE, ms: 3500 },
  { id: 'machines', label: 'Machines and SOPs', eyebrow: 'Machines and SOPs', title: 'Tap a machine. Get its SOPs.', cam: { fx: FX, fy: FY, zoom: 2.1 }, ms: 4500 },
  { id: 'structure', label: 'Consistent structure', eyebrow: 'Consistent structure', title: 'Every SOP reads the same way.', cam: { fx: FX + 0.05, fy: FY + 0.04, zoom: 1.8 }, ms: 4000 },
  { id: 'walk', label: 'Visual focus', eyebrow: 'Visual focus', title: "Show it, don't describe it.", cam: { fx: LX, fy: LY, zoom: 2.6 }, ms: 4500 },
  { id: 'ai', label: 'AI-supported building', eyebrow: 'AI-supported building', title: 'Upload the old SOP. Get a structured one.', cam: { fx: OX, fy: OY, zoom: 2.1 }, ms: 5000 },
  { id: 'outro', label: 'Sign in', eyebrow: '', title: 'Safe work, one step at a time.', cam: WIDE, ms: 20000 },
]

/** Fade-and-rise in, after `delay` seconds. */
const enter = (delay: number): CSSProperties => ({ animation: `reel-in 0.5s ease-out ${delay}s both` })
/** Fade-and-lift out, after `delay` seconds. */
const leave = (delay: number): CSSProperties => ({ animation: `reel-out 0.3s ease-in ${delay}s both` })

/** A simulated tap: a ring that lands and spreads at `at` seconds. */
function Tap({ at, style }: { at: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900 bg-ink-900/15"
      style={{ animation: `reel-tap 0.8s ease-out ${at}s both`, ...style }}
    />
  )
}

// -- Panels ------------------------------------------------------------------

function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-2xl border border-ink-200 bg-paper p-4 shadow-lg ${className}`} style={style}>
      {children}
    </div>
  )
}

function DocCard({ big = false, style }: { big?: boolean; style?: CSSProperties }) {
  return (
    <Card className={`flex items-center gap-3 ${big ? 'w-80 p-5' : 'p-3'}`} style={style}>
      <FileText size={big ? 40 : 28} className="shrink-0 text-ink-500" style={{ animation: 'reel-doc 1s ease-in-out 0.5s both' }} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-ui font-medium text-ink-900">Labeller SOP (2019).docx</span>
        <span className="mt-2 flex flex-col gap-1">
          {[100, 90, 95, 70, ...(big ? [85, 60] : [])].map((w, i) => (
            <span key={i} className="h-1.5 rounded-full bg-ink-200" style={{ width: `${w}%` }} />
          ))}
        </span>
      </span>
    </Card>
  )
}

function MachinePanel() {
  const sops = [
    { title: 'Filler changeover, 600 ml to 1.5 L', meta: '9 steps · v4', status: 'Published' },
    { title: 'Clean in place: filler bowl', meta: '12 steps · v2', status: 'Published' },
    { title: 'Capper torque check', meta: '5 steps · v3', status: 'Review due' },
  ]
  return (
    <Card style={enter(1.6)}>
      <p className="mono text-meta text-ink-600">MACHINE · K7M2QX</p>
      <h3 className="mt-1 text-lg font-semibold text-ink-900">Line 1 filler-capper</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {sops.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 rounded-lg border border-ink-200 bg-paper-1 p-3" style={enter(1.9 + i * 0.25)}>
            <FileText size={18} className="shrink-0 text-ink-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium text-ink-900">{s.title}</span>
              <span className="block text-meta text-ink-500">{s.meta}</span>
            </span>
            <span
              className={`rounded px-2 py-0.5 text-micro font-semibold ${
                s.status === 'Published' ? 'bg-accent-signoff/10 text-accent-signoff' : 'bg-accent-decision/10 text-accent-decision'
              }`}
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const KINDS: FocusKind[] = ['hazard', 'ppe', 'step', 'check']
const STRUCTURE = [
  {
    title: 'Filler changeover',
    where: 'Line 1 filler-capper',
    text: { hazard: 'Rotating filler turret', ppe: 'Gloves, safety glasses', step: 'Swap the change parts', check: 'Fill height on 10 bottles' },
  },
  {
    title: 'Labeller jam clearance',
    where: 'Line 2 labeller',
    text: { hazard: 'Pinch point at the peel plate', ppe: 'Cut-resistant gloves', step: 'Clear the web at the peel plate', check: 'Labels feeding square' },
  },
] as const

function StructurePanel() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {STRUCTURE.map((sop, c) => (
        <Card key={sop.title} className="p-3" style={enter(0.4 + c * 0.15)}>
          <p className="truncate text-ui font-semibold text-ink-900">{sop.title}</p>
          <p className="truncate text-meta text-ink-500">{sop.where}</p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {KINDS.map((k, i) => (
              <li
                key={k}
                className="flex flex-col items-start gap-1 rounded-lg border border-ink-200 p-2"
                style={{ animation: `reel-light 0.6s ease-out ${0.9 + i * 0.45}s both` }}
              >
                <KindChip kind={k} />
                <span className="w-full truncate text-meta text-ink-900">{sop.text[k]}</span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  )
}

// The step photo is a crop of the site picture around the Line 2 labeller.
const CROP = { x0: 0.47, y0: 0.23, x1: 0.58, y1: 0.37 }
const cropW = CROP.x1 - CROP.x0
const cropH = CROP.y1 - CROP.y0
const cropStyle: CSSProperties = {
  backgroundImage: `url(${IMAGE})`,
  backgroundSize: `${100 / cropW}% auto`,
  backgroundPosition: `${(CROP.x0 / (1 - cropW)) * 100}% ${(CROP.y0 / (1 - cropH)) * 100}%`,
  aspectRatio: `${cropW * IW} / ${cropH * IH}`,
}

// Mirrors WalkStep: progress, "Step N of M", group label, kind chip, step
// text, photo, primary button; then the real SentPanel copy.
function WalkPanel() {
  return (
    <div className="mx-auto w-full max-w-72 rounded-2xl border-4 border-ink-900 bg-paper p-3 shadow-lg" style={enter(1.3)}>
      <div className="flex flex-col gap-2">
          <div className="h-1 rounded-full bg-ink-100">
            <div className="h-1 w-full rounded-full bg-accent-step" />
          </div>
          <p className="mono text-meta text-ink-600">Step 7 of 7</p>
          <p className="mono flex items-center gap-2 text-meta uppercase text-ink-600">
            Clear a jam <KindChip kind="step" />
          </p>
          <p className="text-reading font-semibold text-ink-900">Clear the label web at the peel plate.</p>
          <div className="relative w-full overflow-hidden rounded-lg border border-ink-200" style={cropStyle}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <ellipse
                cx="50"
                cy="52"
                rx="17"
                ry="21"
                pathLength={1}
                fill="none"
                vectorEffect="non-scaling-stroke"
                className="stroke-accent-hazard"
                style={{ strokeWidth: 3, strokeDasharray: 1, animation: 'reel-draw 0.9s ease-in-out 1.8s both' }}
              />
            </svg>
            <span className="absolute left-2 top-2 rounded bg-accent-hazard px-2 py-0.5 text-micro font-semibold text-white" style={enter(2.4)}>
              Jam point
            </span>
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-paper/90 px-2 py-0.5 text-micro font-semibold text-ink-900" style={enter(2.6)}>
              <Camera size={12} /> Photo added
            </span>
          </div>
          <div className="grid">
            <span
              className="reel-gone relative col-start-1 row-start-1 flex min-h-tap-glove w-full items-center justify-center rounded-lg bg-ink-900 text-reading font-semibold text-paper"
              style={leave(3.3)}
            >
              {primaryLabel('step', true)}
              <Tap at={2.9} style={{ left: '50%', top: '50%' }} />
            </span>
            <span className="col-start-1 row-start-1 flex min-h-tap-glove items-center gap-2 rounded-lg bg-accent-ok/10 px-3" style={enter(3.4)}>
              <CheckCircle className="size-6 shrink-0 text-accent-ok" aria-hidden="true" />
              <span className="text-left">
                <span className="block text-ui font-semibold text-ink-900">Sent for sign-off</span>
                <span className="block text-meta text-ink-700">Your supervisor will check it.</span>
              </span>
            </span>
          </div>
      </div>
    </div>
  )
}

const DRAFT: ReadonlyArray<[FocusKind, string]> = [
  ['hazard', 'Pinch point at the peel plate'],
  ['ppe', 'Cut-resistant gloves, safety glasses'],
  ['step', 'Isolate and lock out the labeller'],
  ['step', 'Open the guard and clear the web'],
  ['check', 'Guard closed, labels feeding square'],
]

function AiPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:block">
        <DocCard style={enter(0.2)} />
      </div>
      <Card className="p-3" style={enter(0.9)}>
        <p className="flex items-center gap-1.5 text-meta font-semibold text-ai">
          <Sparkles size={14} /> Drafted from your document
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {DRAFT.map(([kind, text], i) => (
            <li
              key={text}
              className="flex items-center gap-2 rounded-lg p-1.5"
              style={{ animation: `reel-in 0.4s ease-out ${1.2 + i * 0.3}s both, reel-shimmer 1s ease-out ${1.2 + i * 0.3}s both` }}
            >
              <KindChip kind={kind} />
              <span className="min-w-0 truncate text-meta text-ink-900">{text}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="rounded-2xl border border-[var(--tint-ai-border)] bg-[var(--tint-ai-bg)] p-3 shadow-lg" style={enter(2.9)}>
        <p className="flex items-center gap-1.5 text-meta font-semibold text-ai">
          <Sparkles size={14} /> AI reviewer
        </p>
        <p className="mt-1 text-ui text-ink-900">The old SOP cleared jams without isolating first. Isolation is now step 1.</p>
        <div className="mt-2 flex gap-2">
          <span
            className="relative grid rounded-lg bg-ink-900 px-3 py-1.5 text-meta font-semibold text-white"
            style={{ animation: 'reel-approve 0.3s ease-out 3.9s both' }}
          >
            <span className="reel-gone col-start-1 row-start-1" style={leave(3.9)}>
              Approve
            </span>
            <span className="col-start-1 row-start-1 flex items-center gap-1" style={enter(4)}>
              <CheckCircle size={12} /> Approved
            </span>
            <Tap at={3.6} style={{ left: '50%', top: '50%' }} />
          </span>
          <span className="rounded-lg border border-ink-300 px-3 py-1.5 text-meta font-semibold text-ink-900">Change</span>
        </div>
      </div>
    </div>
  )
}

const PANELS: Partial<Record<SceneId, () => ReactNode>> = {
  machines: MachinePanel,
  structure: StructurePanel,
  walk: WalkPanel,
  ai: AiPanel,
}

// -- Site overlay (image space) ---------------------------------------------

const points = (frac: Frac) => frac.map(([x, y]) => `${x},${y}`).join(' ')

function SiteMarks({ scene }: { scene: SceneId }) {
  const all = SITE.machines.map((m) => m.frac)
  const outline = (frac: Frac, i: number, className: string, style?: CSSProperties) => (
    <polygon
      key={i}
      points={points(frac)}
      pathLength={1}
      vectorEffect="non-scaling-stroke"
      fill="none"
      className={className}
      style={{ strokeWidth: 2, ...style }}
    />
  )
  const pulse = 'reel-pulse 1.6s ease-in-out 1s infinite'
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" key={scene}>
      {scene === 'reveal' &&
        all.map((f, i) => outline(f, i, 'stroke-accent-step', { strokeDasharray: 1, animation: `reel-draw 0.6s ease-out ${0.5 + i * 0.05}s both` }))}
      {(scene === 'machines' || scene === 'structure') && (
        <>
          {all.map((f, i) => outline(f, i, 'stroke-ink-400', { opacity: 0.35 }))}
          {outline(FILLER, 99, 'stroke-accent-step', { strokeWidth: 4, animation: pulse })}
        </>
      )}
      {scene === 'walk' && outline(LABELLER, 0, 'stroke-accent-hazard', { strokeWidth: 4, animation: pulse })}
      {scene === 'ai' && outline(OFFICE, 0, 'stroke-ai', { strokeWidth: 4, animation: pulse })}
    </svg>
  )
}

// -- The reel ----------------------------------------------------------------

const STYLES = `
@keyframes reel-in { from { opacity: 0; transform: translateY(0.5rem) } to { opacity: 1; transform: none } }
@keyframes reel-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(-0.25rem) } }
@keyframes reel-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes reel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
@keyframes reel-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes reel-drift { from { transform: scale(1) } to { transform: scale(1.04) } }
@keyframes reel-tap {
  0% { opacity: 0; transform: scale(0.4) }
  30% { opacity: 1; transform: scale(0.8) }
  100% { opacity: 0; transform: scale(1.7) }
}
@keyframes reel-light {
  from { background: transparent }
  40% { background: var(--tint-step-bg) }
  to { background: var(--paper-1) }
}
@keyframes reel-doc { 0%, 100% { transform: none } 50% { transform: scale(1.12) rotate(-6deg) } }
@keyframes reel-shimmer {
  from { background: linear-gradient(90deg, var(--tint-ai-bg), var(--paper) 70%) }
  to { background: transparent }
}
@keyframes reel-approve { from { background: var(--ink-900) } to { background: var(--accent-ok) } }
.reel-cam { transition: transform 1.2s cubic-bezier(0.65, 0, 0.35, 1), filter 0.9s ease }
@media (prefers-reduced-motion: reduce) {
  .reel *, .reel-cam { animation: none !important; transition: none !important }
  .reel-gone { visibility: hidden }
}
`

const MOTION = '(prefers-reduced-motion: reduce)'
const prefersStill = () => window.matchMedia(MOTION).matches
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function PromoReel() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [idx, setIdx] = useState(0)
  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(true)
  const still = useSyncExternalStore(subscribeMotion, prefersStill, () => false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Turn the camera glide on only after the first measured paint, so the
  // picture does not fly in from the unmeasured origin.
  useEffect(() => {
    if (!size.w || ready) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [size.w, ready])

  const scene = SCENES[idx]
  const go = (i: number) => {
    setIdx((i + SCENES.length) % SCENES.length)
    setRun((r) => r + 1)
  }

  // Camera: the focus point lands centred in the space left of the panel
  // column (desktop) or in the top quarter (phone, where the panel sits below).
  const lg = size.w >= 1024
  const column = scene.id !== 'hook' && scene.id !== 'outro'
  const cover = Math.max(size.w / IW, size.h / IH) || 1
  const s = cover * scene.cam.zoom
  const tx = lg && column ? (size.w - 480) / 2 : size.w / 2
  const ty = !column ? size.h / 2 : lg ? size.h * 0.46 : size.h * 0.24
  // Clamped so the picture always covers the screen (no bare edges).
  const x = Math.min(0, Math.max(size.w - IW * s, tx - scene.cam.fx * IW * s))
  const y = Math.min(0, Math.max(size.h - IH * s, ty - scene.cam.fy * IH * s))
  const Panel = PANELS[scene.id]

  return (
    <main ref={stageRef} data-testid="promo-reel" data-scene={scene.id} className="reel fixed inset-0 overflow-hidden bg-paper">
      <style>{STYLES}</style>

      {/* Camera */}
      <div
        className={`${ready ? 'reel-cam' : ''} absolute left-0 top-0 origin-top-left`}
        style={{
          width: IW,
          height: IH,
          transform: `translate(${x}px, ${y}px) scale(${s})`,
          filter: scene.id === 'hook' ? 'blur(6px) saturate(0.5)' : 'none',
          opacity: size.w ? 1 : 0,
        }}
      >
        <div key={run} className="relative h-full w-full" style={{ animation: `reel-drift ${scene.ms}ms linear both` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static site picture from public/ */}
          <img src={IMAGE} alt="An isometric soft drinks bottling factory with four production lines" width={IW} height={IH} className="h-full w-full" />
          <SiteMarks scene={scene.id} />
        </div>
      </div>

      {/* The machine tap lands on the filler once the camera has arrived. */}
      {scene.id === 'machines' && size.w > 0 && <Tap key={run} at={1.3} style={{ left: x + FX * IW * s, top: y + FY * IH * s }} />}

      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <span className="rounded-lg bg-paper/90 px-3 py-2 shadow-lg backdrop-blur"><Wordmark size="header" /></span>
        <Link
          href="/login"
          className="flex min-h-tap items-center rounded-lg bg-ink-900 px-5 text-ui font-semibold text-white shadow-lg hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      {scene.id === 'hook' && (
        <section key={run} className="absolute inset-0 flex items-center justify-center bg-paper/40 p-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="text-2xl font-semibold text-ink-900 lg:text-4xl" style={enter(0.1)}>
              {scene.title}
            </h1>
            <DocCard big style={enter(0.4)} />
          </div>
        </section>
      )}

      {column && (
        <section
          key={run}
          className="absolute inset-x-3 bottom-20 flex max-h-[62dvh] flex-col gap-3 overflow-hidden lg:inset-x-auto lg:bottom-20 lg:right-6 lg:top-20 lg:max-h-none lg:w-112 lg:justify-center"
        >
          <div className="rounded-2xl bg-paper/90 p-4 shadow-lg backdrop-blur" style={enter(0.2)}>
            <p className="mono text-meta font-semibold uppercase text-accent-step">{scene.eyebrow}</p>
            <h1 className="mt-1 text-xl font-semibold text-ink-900 lg:text-2xl">{scene.title}</h1>
          </div>
          {Panel && <Panel />}
        </section>
      )}

      {scene.id === 'outro' && (
        <section key={run} className="absolute inset-0 flex items-center justify-center bg-paper/70 p-6 backdrop-blur-sm">
          <div className="flex max-w-xl flex-col items-center text-center">
            <p style={enter(0.4)}>
              <Wordmark size="hero" />
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900 lg:text-4xl" style={enter(0.7)}>
              {scene.title}
            </h1>
            <p className="mt-3 text-reading text-ink-600" style={enter(1)}>
              Find a SOP, start it, send it for sign-off.
            </p>
            <Link
              href="/login"
              className="mt-6 flex min-h-tap-row items-center rounded-lg bg-ink-900 px-8 text-reading font-semibold text-white hover:opacity-90"
              style={enter(1.4)}
            >
              Sign in
            </Link>
          </div>
        </section>
      )}

      {/* Controls */}
      <nav aria-label="Reel scenes" className="absolute inset-x-3 bottom-4 z-10 flex items-center gap-3 lg:inset-x-6 lg:w-96">
        {!still && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/90 text-ink-900 shadow-lg backdrop-blur"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <div className="flex flex-1 gap-1.5">
          {SCENES.map((sc, i) => (
            <button
              key={sc.id}
              type="button"
              data-testid="reel-dot"
              onClick={() => go(i)}
              aria-label={sc.label}
              aria-current={i === idx}
              className="flex h-10 flex-1 items-center"
            >
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/15">
                {(i < idx || (i === idx && still)) && <span className="block h-full w-full bg-ink-900" />}
                {i === idx && !still && (
                  <span
                    key={run}
                    className="block h-full w-full origin-left bg-ink-900"
                    style={{ animation: `reel-fill ${sc.ms}ms linear both`, animationPlayState: playing ? 'running' : 'paused' }}
                    onAnimationEnd={() => go(idx + 1)}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}
