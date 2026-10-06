'use client'

/**
 * The signed-out promo reel at /welcome: one site picture (the bottling
 * template, ADR-0003) with a camera that glides between places while each
 * scene's caption and panel animate in. Illustrative content only -- no org
 * data, nothing fetched.
 *
 * Playback is driven by the active progress bar's CSS animation: its
 * animationend advances the scene, so pause is just animation-play-state and
 * reduced motion (animations off) means no autoplay, with the dots to step.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Camera, Check, FileText, Pause, Play, Sparkles, TriangleAlert } from 'lucide-react'
import { SITE_PRESETS, PRESET_ROOMS, presetImagePath } from '@/lib/site/presets'

type Frac = ReadonlyArray<readonly [number, number]>

const IW = 1280
const IH = 720
const IMAGE = presetImagePath('bottling')
const SITE = SITE_PRESETS.find((p) => p.id === 'bottling')!
const machine = (name: string) => SITE.machines.find((m) => m.name === name)!.frac
const FILLER = machine('Line 1 filler-capper')
const LABELLER = machine('Line 2 labeller')
const OFFICE = PRESET_ROOMS.bottling.find((r) => r.id === 'office')!.frac

function centre(frac: Frac): [number, number] {
  return [frac.reduce((a, p) => a + p[0], 0) / frac.length, frac.reduce((a, p) => a + p[1], 0) / frac.length]
}

interface Cam {
  fx: number
  fy: number
  zoom: number
}

interface Scene {
  id: 'intro' | 'machines' | 'structure' | 'visual' | 'ai' | 'outro'
  eyebrow: string
  title: string
  body: string
  cam: Cam
  ms: number
}

const [FX, FY] = centre(FILLER)
const [LX, LY] = centre(LABELLER)
const [OX, OY] = centre(OFFICE)

const SCENES: Scene[] = [
  {
    id: 'intro',
    eyebrow: 'SOPstart',
    title: 'Every procedure, where the work happens.',
    body: 'A live map of your site. Every machine knows its standard operating procedures.',
    cam: { fx: 0.5, fy: 0.42, zoom: 1.05 },
    ms: 6500,
  },
  {
    id: 'machines',
    eyebrow: 'Machines and SOPs',
    title: 'Tap a machine. Get its procedures.',
    body: 'SOPs are linked to the machines they run on, so the right one is always one tap away.',
    cam: { fx: FX, fy: FY, zoom: 2.1 },
    ms: 7000,
  },
  {
    id: 'structure',
    eyebrow: 'Consistent structure',
    title: 'Every SOP reads the same way.',
    body: 'Hazards and PPE first, then steps, checks and sign-off. Same shape on every machine, every site.',
    cam: { fx: FX + 0.05, fy: FY + 0.04, zoom: 1.8 },
    ms: 7000,
  },
  {
    id: 'visual',
    eyebrow: 'Visual focus',
    title: "Show it, don't describe it.",
    body: 'Photos, markup and one step at a time. Built for phones and gloved hands.',
    cam: { fx: LX, fy: LY, zoom: 2.6 },
    ms: 7500,
  },
  {
    id: 'ai',
    eyebrow: 'AI-supported building',
    title: 'Upload the old SOP. Get a structured one.',
    body: 'AI reads Word and PDF, drafts the steps and flags what is missing. A person always approves.',
    cam: { fx: OX, fy: OY, zoom: 2.1 },
    ms: 8500,
  },
  {
    id: 'outro',
    eyebrow: '',
    title: 'Safe work, one step at a time.',
    body: 'Standard operating procedures your people actually follow.',
    cam: { fx: 0.5, fy: 0.42, zoom: 1.05 },
    ms: 20000,
  },
]

/** Fade-and-rise in, after `delay` seconds. */
const enter = (delay: number): CSSProperties => ({ animation: `reel-in 0.6s ease-out ${delay}s both` })

// -- Panels ------------------------------------------------------------------

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-ink-200 bg-paper p-4 shadow-lg ${className}`}>{children}</div>
}

function MachinePanel() {
  const sops = [
    { title: 'Filler changeover, 600 ml to 1.5 L', meta: '9 steps · v4', status: 'Published' },
    { title: 'Clean in place: filler bowl', meta: '12 steps · v2', status: 'Published' },
    { title: 'Capper torque check', meta: '5 steps · v3', status: 'Review due' },
  ]
  return (
    <Card>
      <p className="mono text-meta text-ink-500" style={enter(1.4)}>
        MACHINE · K7M2QX
      </p>
      <h3 className="mt-1 text-lg font-semibold text-ink-900" style={enter(1.5)}>
        Line 1 filler-capper
      </h3>
      <p className="mt-1 flex items-center gap-2 text-meta text-ink-500" style={enter(1.6)}>
        <span className="h-2 w-2 rounded-full bg-accent-step" /> Line 1
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {sops.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 rounded-lg border border-ink-200 bg-paper-1 p-3" style={enter(2 + i * 0.35)}>
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

const PARTS = [
  { label: 'Hazards', tone: 'bg-accent-escalate', a: '2 hazards', b: '1 hazard' },
  { label: 'PPE', tone: 'bg-accent-decision', a: 'Gloves, glasses', b: 'Gloves, ear muffs' },
  { label: 'Steps', tone: 'bg-accent-step', a: '9 steps', b: '6 steps' },
  { label: 'Checks', tone: 'bg-accent-inspect', a: '2 checks', b: '3 checks' },
  { label: 'Sign-off', tone: 'bg-accent-signoff', a: 'Supervisor', b: 'Supervisor' },
]

function StructurePanel() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['a', 'b'] as const).map((k, c) => (
        <Card key={k} className="p-3">
          <p className="text-ui font-semibold text-ink-900" style={enter(0.8 + c * 0.2)}>
            {k === 'a' ? 'Filler changeover' : 'Labeller jam clearance'}
          </p>
          <p className="text-meta text-ink-500" style={enter(0.9 + c * 0.2)}>
            {k === 'a' ? 'Line 1 filler-capper' : 'Line 2 labeller'}
          </p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {PARTS.map((p, i) => (
              <li
                key={p.label}
                className="flex items-center gap-2 rounded-lg border border-ink-200 p-2"
                style={{ animation: `reel-light 0.5s ease-out ${1.6 + i * 0.55}s both` }}
              >
                <span className={`h-6 w-1 shrink-0 rounded-full ${p.tone}`} />
                <span className="min-w-0">
                  <span className="block text-meta font-semibold text-ink-900">{p.label}</span>
                  <span className="block truncate text-micro text-ink-500">{p[k]}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  )
}

// The photo is a crop of the site picture around the Line 2 labeller.
const CROP = { x0: 0.47, y0: 0.23, x1: 0.58, y1: 0.37 }
const cropW = CROP.x1 - CROP.x0
const cropH = CROP.y1 - CROP.y0
const cropStyle: CSSProperties = {
  backgroundImage: `url(${IMAGE})`,
  backgroundSize: `${100 / cropW}% auto`,
  backgroundPosition: `${(CROP.x0 / (1 - cropW)) * 100}% ${(CROP.y0 / (1 - cropH)) * 100}%`,
  aspectRatio: `${cropW * IW} / ${cropH * IH}`,
}

function VisualPanel() {
  return (
    <div className="mx-auto w-full max-w-72 rounded-2xl border-4 border-ink-900 bg-paper p-3 shadow-lg" style={enter(1.2)}>
      <p className="text-meta text-ink-500">Labeller jam clearance</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-ui font-semibold text-ink-900">Step 3 of 7</p>
        <span className="flex gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`h-1.5 w-3 rounded-full ${i < 3 ? 'bg-accent-step' : 'bg-ink-200'}`} />
          ))}
        </span>
      </div>
      <div className="relative mt-2 w-full overflow-hidden rounded-lg border border-ink-200" style={cropStyle}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <ellipse
            cx="50"
            cy="52"
            rx="17"
            ry="21"
            pathLength={1}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-accent-escalate"
            style={{ strokeWidth: 3, strokeDasharray: 1, animation: 'reel-draw 1s ease-in-out 2.2s both' }}
          />
        </svg>
        <span
          className="absolute left-2 top-2 rounded bg-accent-escalate px-2 py-0.5 text-micro font-semibold text-white"
          style={enter(3)}
        >
          Jam point
        </span>
      </div>
      <p className="mt-2 text-ui text-ink-900" style={enter(1.8)}>
        Open the guard and clear the label web at the peel plate. Never reach past the yellow line.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" style={enter(2.6)}>
        <span className="flex items-center gap-1 rounded bg-accent-escalate/10 px-2 py-0.5 text-micro font-semibold text-accent-escalate">
          <TriangleAlert size={12} /> Pinch point
        </span>
        <span className="flex items-center gap-1 rounded bg-accent-step/10 px-2 py-0.5 text-micro font-semibold text-accent-step">
          <Camera size={12} /> Photo required
        </span>
      </div>
      <div
        className="mt-3 flex min-h-tap items-center justify-center gap-2 rounded-lg bg-ink-900 text-ui font-semibold text-white"
        style={enter(3.6)}
      >
        <Check size={16} /> Done, next step
      </div>
    </div>
  )
}

const DRAFT = [
  ['Hazards', 'Pinch point at the peel plate', 'bg-accent-escalate'],
  ['PPE', 'Cut-resistant gloves, safety glasses', 'bg-accent-decision'],
  ['Step 1', 'Isolate and lock out the labeller', 'bg-accent-step'],
  ['Step 2', 'Open the guard and clear the web', 'bg-accent-step'],
  ['Check', 'Guard closed, labels feeding square', 'bg-accent-inspect'],
] as const

function AiPanel() {
  return (
    <div className="flex flex-col gap-3">
      <Card className="hidden items-center gap-3 p-3 sm:flex">
        <FileText size={28} className="shrink-0 text-ink-500" style={{ animation: 'reel-doc 1.2s ease-in-out 1.4s both' }} />
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-medium text-ink-900">Labeller SOP (2019).docx</span>
          <span className="mt-1 flex flex-col gap-1">
            {[100, 90, 95, 70].map((w, i) => (
              <span key={i} className="h-1.5 rounded-full bg-ink-200" style={{ width: `${w}%` }} />
            ))}
          </span>
        </span>
        <Sparkles size={18} className="shrink-0 text-ai" style={enter(1.6)} />
      </Card>
      <Card className="p-3">
        <ul className="flex flex-col gap-1.5">
          {DRAFT.map(([label, text, tone], i) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-lg p-2"
              style={{ animation: `reel-in 0.5s ease-out ${2.4 + i * 0.4}s both, reel-shimmer 1.2s ease-out ${2.4 + i * 0.4}s both` }}
            >
              <span className={`h-5 w-1 shrink-0 rounded-full ${tone}`} />
              <span className="w-14 shrink-0 text-meta font-semibold text-ink-900">{label}</span>
              <span className="min-w-0 truncate text-meta text-ink-600">{text}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="rounded-2xl border border-[var(--tint-ai-border)] bg-[var(--tint-ai-bg)] p-3 shadow-lg" style={enter(5)}>
        <p className="flex items-center gap-1.5 text-meta font-semibold text-ai">
          <Sparkles size={14} /> AI reviewer
        </p>
        <p className="mt-1 text-ui text-ink-900">
          The old SOP cleared jams without isolating first. Isolation is now step 1. Approve or change it.
        </p>
        <div className="mt-2 flex gap-2">
          <span className="rounded-lg bg-ink-900 px-3 py-1.5 text-meta font-semibold text-white">Approve</span>
          <span className="rounded-lg border border-ink-300 px-3 py-1.5 text-meta font-semibold text-ink-900">Change</span>
        </div>
      </div>
    </div>
  )
}

const PANELS: Partial<Record<Scene['id'], () => ReactNode>> = {
  machines: MachinePanel,
  structure: StructurePanel,
  visual: VisualPanel,
  ai: AiPanel,
}

// -- Site overlay (image space) ---------------------------------------------

const points = (frac: Frac) => frac.map(([x, y]) => `${x},${y}`).join(' ')

function SiteMarks({ scene }: { scene: Scene['id'] }) {
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
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" key={scene}>
      {scene === 'intro' &&
        all.map((f, i) =>
          outline(f, i, 'stroke-accent-step', { strokeDasharray: 1, animation: `reel-draw 0.8s ease-out ${0.8 + i * 0.12}s both` })
        )}
      {(scene === 'machines' || scene === 'structure') && (
        <>
          {all.map((f, i) => outline(f, i, 'stroke-ink-400', { opacity: 0.35 }))}
          {outline(FILLER, 99, 'stroke-accent-step', { strokeWidth: 4, animation: 'reel-pulse 1.6s ease-in-out 1s infinite' })}
        </>
      )}
      {scene === 'visual' &&
        outline(LABELLER, 0, 'stroke-accent-escalate', { strokeWidth: 4, animation: 'reel-pulse 1.6s ease-in-out 1s infinite' })}
      {scene === 'ai' && outline(OFFICE, 0, 'stroke-ai', { strokeWidth: 4, animation: 'reel-pulse 1.6s ease-in-out 1s infinite' })}
    </svg>
  )
}

// -- The reel ----------------------------------------------------------------

const STYLES = `
@keyframes reel-in { from { opacity: 0; transform: translateY(0.5rem) } to { opacity: 1; transform: none } }
@keyframes reel-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes reel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
@keyframes reel-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes reel-drift { from { transform: scale(1) } to { transform: scale(1.04) } }
@keyframes reel-light {
  from { border-color: var(--ink-200); background: transparent }
  40% { border-color: var(--accent-step); background: var(--tint-step-bg) }
  to { border-color: var(--ink-200); background: var(--paper-1) }
}
@keyframes reel-doc { 0% { transform: none } 50% { transform: scale(1.15) rotate(-6deg) } 100% { transform: none } }
@keyframes reel-shimmer {
  from { background: linear-gradient(90deg, var(--tint-ai-bg), var(--paper) 60%) }
  to { background: var(--paper-1) }
}
.reel-cam { transition: transform 1.8s cubic-bezier(0.65, 0, 0.35, 1) }
@media (prefers-reduced-motion: reduce) {
  .reel *, .reel-cam { animation: none !important; transition: none !important }
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
  // column (desktop) or in the top third (phone, where the panel sits below).
  const lg = size.w >= 1024
  const column = scene.id !== 'outro'
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
        style={{ width: IW, height: IH, transform: `translate(${x}px, ${y}px) scale(${s})`, opacity: size.w ? 1 : 0 }}
      >
        <div key={run} className="relative h-full w-full" style={{ animation: `reel-drift ${scene.ms}ms linear both` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static site picture from public/ */}
          <img src={IMAGE} alt="An isometric soft drinks bottling factory with four production lines" width={IW} height={IH} className="h-full w-full" />
          <SiteMarks scene={scene.id} />
        </div>
      </div>

      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <span className="rounded-lg bg-paper/90 px-3 py-2 text-lg font-bold text-ink-900 shadow-lg backdrop-blur">SOPstart</span>
        <Link
          href="/login"
          className="flex min-h-tap items-center rounded-lg bg-ink-900 px-5 text-ui font-semibold text-white shadow-lg hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      {/* Caption + panel */}
      {column ? (
        <section
          key={run}
          className="absolute inset-x-3 bottom-20 flex max-h-[60dvh] flex-col gap-3 overflow-hidden lg:inset-x-auto lg:bottom-20 lg:right-6 lg:top-20 lg:max-h-none lg:w-112 lg:justify-center"
        >
          <div className="rounded-2xl bg-paper/90 p-4 shadow-lg backdrop-blur" style={enter(0.3)}>
            <p className="mono text-meta font-semibold uppercase text-accent-step">{scene.eyebrow}</p>
            <h1 className="mt-1 text-xl font-semibold text-ink-900 lg:text-2xl">{scene.title}</h1>
            <p className="mt-1 hidden text-reading text-ink-600 sm:block">{scene.body}</p>
          </div>
          {Panel && <Panel />}
        </section>
      ) : (
        <section key={run} className="absolute inset-0 flex items-center justify-center bg-paper/70 p-6 backdrop-blur-sm">
          <div className="flex max-w-xl flex-col items-center text-center">
            <p className="text-2xl font-bold text-ink-900" style={enter(0.6)}>
              SOPstart
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900 lg:text-4xl" style={enter(0.9)}>
              {scene.title}
            </h1>
            <p className="mt-3 text-reading text-ink-600" style={enter(1.2)}>
              {scene.body}
            </p>
            <Link
              href="/login"
              className="mt-6 flex min-h-tap-row items-center rounded-lg bg-ink-900 px-8 text-reading font-semibold text-white hover:opacity-90"
              style={enter(1.6)}
            >
              Sign in
            </Link>
          </div>
        </section>
      )}

      {/* Controls */}
      <nav aria-label="Reel scenes" className="absolute inset-x-3 bottom-4 flex items-center gap-3 lg:inset-x-6 lg:w-96">
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
              aria-label={sc.eyebrow || 'Sign in'}
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
