'use client'

/**
 * The signed-out homepage at /welcome, one screen with no page scroll: the brandmark
 * on the left (a strip across the top on a phone) and, on the right, slides that
 * change on their own until the visitor takes over (a dot, an arrow, a key or a
 * swipe stops the autoplay; Play resumes it). Each slide's example animates in
 * when it is shown. The wordmark arrives the way the app's start merge draws it
 * (the --dur-fuse-* / --ease-fuse tokens): the pieces gather, then the tape sweeps
 * in once. Static, nothing fetched. Reduced motion: no autoplay, no animation.
 */
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Lock, Pause, Play, ShieldCheck, Users, Wrench } from 'lucide-react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip } from '@/components/focus/KindChip'
import type { FocusKind } from '@/lib/sop/focus'

const SLIDE_MS = 9000

const STYLES = `
@keyframes hp-in { from { opacity: 0; transform: translateY(0.75rem) } to { opacity: 1; transform: none } }
@keyframes hp-pop { 0% { opacity: 0; transform: scale(0.4) } 70% { opacity: 1; transform: scale(1.15) } 100% { opacity: 1; transform: none } }
@keyframes hp-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes hp-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes hp-gather-l { from { opacity: 0; transform: translateX(-0.35em) } to { opacity: 1; transform: none } }
@keyframes hp-gather-r { from { opacity: 0; transform: translateX(0.35em) } to { opacity: 1; transform: none } }
@keyframes hp-sweep { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
.hp-mark .wm-sop { animation: hp-gather-l var(--dur-fuse-gather) var(--ease-fuse) 0.2s both }
.hp-mark .wm-start { animation: hp-gather-r var(--dur-fuse-gather) var(--ease-fuse) 0.2s both }
.hp-mark .wm::after { animation: hp-sweep var(--dur-fuse-tape) var(--ease-fuse) calc(var(--dur-fuse-gather) + 0.2s) both }
.hp-mark .wm { font-size: var(--wm-size-header) }
@media (min-width: 64rem) { .hp-mark .wm { font-size: calc(var(--wm-size-hero) * 1.5) } }
.hp-lead { animation: hp-in 0.6s ease-out var(--d, 0s) both }
.hp-slide .hp-a { opacity: 0 }
.hp-slide[data-in] .hp-a { animation: hp-in 0.5s ease-out var(--d, 0s) both }
.hp-slide[data-in] .hp-p { animation-name: hp-pop }
.hp-slide .hp-g { transform: scaleX(0); transform-origin: left }
.hp-slide[data-in] .hp-g { animation: hp-grow 1.4s ease-in-out var(--d, 0s) both }
@media (max-height: 820px) { .hp-tall { display: none } }
@media (prefers-reduced-motion: reduce) {
  .hp-mark *, .hp-mark .wm::after, .hp-lead { animation: none !important }
  .hp-slide .hp-a { opacity: 1; animation: none !important }
  .hp-slide .hp-g { transform: none; animation: none !important }
}
`

const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties

// -- Pieces --------------------------------------------------------------------

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-ink-200 bg-paper-1 p-5 shadow-lg ${className}`}>{children}</div>
)

const Label = ({ children }: { children: ReactNode }) => <p className="font-label text-meta text-ink-500">{children}</p>

function Tick({ at }: { at: number }) {
  return (
    <span className="relative grid size-7 shrink-0 place-items-center rounded-lg border-2 border-ink-900">
      <span className="hp-a hp-p absolute inset-0 grid place-items-center rounded bg-ink-900 text-paper" style={d(at)}>
        <Check className="size-4" />
      </span>
    </span>
  )
}

function Story({ eyebrow, title, intro, points, example }: { eyebrow: string; title: string; intro: string; points: string[]; example: ReactNode }) {
  return (
    <div className="grid w-full items-center gap-6 xl:grid-cols-2 xl:gap-10">
      <div>
        <p className="hp-a font-label text-meta font-semibold uppercase text-ink-500">{eyebrow}</p>
        <h2 className="hp-a mt-2 text-2xl font-semibold text-ink-900 lg:text-4xl" style={d(0.1)}>{title}</h2>
        <p className="hp-a mt-3 text-reading text-ink-600" style={d(0.2)}>{intro}</p>
        <ul className="hp-tall mt-6 hidden flex-col gap-2 lg:flex">
          {points.map((p, i) => (
            <li key={p} className="hp-a flex gap-3 text-reading text-ink-900" style={d(0.3 + i * 0.1)}>
              <Check className="mt-0.5 size-5 shrink-0 text-accent-ok" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden="true" className="mx-auto w-full max-w-md">{example}</div>
    </div>
  )
}

// -- Theme examples ------------------------------------------------------------

function AccessibleExample() {
  return (
    <Card>
      <Label>Before</Label>
      <p className="hp-a mt-1 text-meta text-ink-500 line-through" style={d(0.3)}>
        Prior to commencement, ensure all energy sources associated with the infeed assembly have been isolated in accordance with site procedure.
      </p>
      <p className="hp-a mt-4 font-label text-meta text-ink-500" style={d(0.9)}>In SOPstart</p>
      <div className="hp-a mt-2 flex flex-wrap gap-2" style={d(1.1)}>
        <KindChip kind="hazard" />
        <KindChip kind="ppe" />
      </div>
      <p className="hp-a mt-3 text-xl font-semibold text-ink-900 lg:text-2xl" style={d(1.3)}>Switch off and lock the infeed isolator.</p>
      <div className="hp-a mt-4 flex min-h-tap-glove items-center justify-center rounded-lg bg-ink-900 text-reading font-semibold text-paper" style={d(1.7)}>
        Done
      </div>
    </Card>
  )
}

const RUN: ReadonlyArray<[FocusKind, string]> = [
  ['hazard', 'Moving star wheels'],
  ['ppe', 'Gloves, safety glasses'],
  ['step', 'Stop the line and press the e-stop.'],
  ['step', 'Clear the jammed bottles.'],
]

function AccountableExample() {
  return (
    <Card>
      <p className="text-ui font-semibold text-ink-900">Clearing a jam at the filler infeed</p>
      <p className="text-meta text-ink-500">Line 1 · v3 · Aroha W.</p>
      <ol className="mt-2 flex flex-col">
        {RUN.map(([kind, text], i) => (
          <li key={text} className="flex items-center gap-3 border-b border-ink-200 py-1.5">
            <Tick at={0.4 + i * 0.45} />
            <span className="min-w-0">
              {kind !== 'step' && <KindChip kind={kind} />}
              <span className="block text-ui text-ink-900">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="hp-a mt-3 flex min-h-tap items-center gap-2 rounded-lg bg-[var(--tint-signoff-bg)] px-3 text-ui font-semibold text-ink-900" style={d(2.4)}>
        <Check className="size-4 text-accent-ok" /> Sent for sign-off · 10:41
      </p>
      <p className="hp-a mt-2 flex min-h-tap items-center gap-2 rounded-lg border border-[var(--tint-signoff-border)] px-3 text-ui text-ink-900" style={d(3.1)}>
        <ShieldCheck className="size-4 text-accent-ok" /> Signed off by M. Tane, supervisor · 10:52
      </p>
    </Card>
  )
}

const HISTORY = [
  ['v1', 'Imported from Word (2019)', 'Admin · 3 Feb'],
  ['v2', 'Clear version approved', 'Safety manager · 10 Feb'],
  ['v3', 'Photo added to step 4', 'Supervisor · 2 Apr'],
] as const

function TrackedExample() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <span>
          <p className="text-ui font-semibold text-ink-900">Changing the shrink film roll</p>
          <p className="text-meta text-ink-500">Owner: Packing supervisor</p>
        </span>
        <span className="hp-a shrink-0 rounded bg-[var(--tint-decision-bg)] px-2 py-1 text-micro font-semibold text-accent-decision" style={d(1.9)}>
          Review due 2 Oct
        </span>
      </div>
      <ol className="mt-4 flex flex-col gap-4 border-l-2 border-ink-200 pl-5">
        {HISTORY.map(([v, what, who], i) => (
          <li key={v} className="hp-a relative" style={d(0.4 + i * 0.4)}>
            <span className="absolute -left-7 top-0.5 size-4 rounded-full bg-ink-900" />
            <p className="text-ui text-ink-900">
              <span className="mono mr-2 text-meta font-semibold">{v}</span>
              {what}
            </p>
            <p className="text-meta text-ink-500">{who}</p>
          </li>
        ))}
      </ol>
      <p className="hp-a mt-4 text-meta text-ink-600" style={d(1.7)}>Every reader sees v3. v1 and v2 are kept, with who changed what.</p>
    </Card>
  )
}

const ACCESS = [
  ['Worker', 'Their SOPs and their own record'],
  ['Supervisor', 'Their team and its sign-offs'],
  ['Admin', 'The whole site and its SOPs'],
  ['Safety manager', 'Every record, read in full'],
] as const

function SecureExample() {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="hp-a hp-p grid size-9 place-items-center rounded-full bg-ink-900 text-paper" style={d(0.3)}>
          <Lock className="size-4" />
        </span>
        <p className="text-ui font-semibold text-ink-900">Clearwater Beverages · who sees what</p>
      </div>
      <ul className="mt-3 flex flex-col">
        {ACCESS.map(([role, sees], i) => (
          <li key={role} className="hp-a flex justify-between gap-3 border-b border-ink-200 py-2 text-ui" style={d(0.6 + i * 0.25)}>
            <span className="font-semibold text-ink-900">{role}</span>
            <span className="text-right text-ink-600">{sees}</span>
          </li>
        ))}
      </ul>
      <p className="hp-a mt-3 text-meta text-ink-600" style={d(1.7)}>Other organisations: nothing, ever.</p>
    </Card>
  )
}

// -- Modules -------------------------------------------------------------------

function SopMini() {
  return (
    <ol className="flex flex-col gap-1.5">
      {([['hazard', 'Hot surface'], ['ppe', 'Heat gloves'], ['step', 'Open the mould guard']] as [FocusKind, string][]).map(([k, t], i) => (
        <li key={k} className="hp-a flex items-center gap-2" style={d(0.5 + i * 0.2)}>
          <KindChip kind={k} />
          <span className="truncate text-meta text-ink-900">{t}</span>
        </li>
      ))}
    </ol>
  )
}

function PmMini() {
  const rows = [
    ['Filler-capper lubrication', 'Due today', 'text-accent-decision'],
    ['Conveyor belt tension', 'Done', 'text-accent-ok'],
    ['Compressor service', 'In 12 days', 'text-ink-500'],
  ] as const
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(([what, when, tone], i) => (
        <li key={what} className="hp-a flex justify-between gap-2 text-meta" style={d(0.6 + i * 0.2)}>
          <span className="truncate text-ink-900">{what}</span>
          <span className={`shrink-0 font-semibold ${tone}`}>{when}</span>
        </li>
      ))}
    </ul>
  )
}

function LotoMini() {
  return (
    <ul className="flex flex-col gap-1.5">
      {['E1 · Main isolator', 'P1 · Air supply', 'H1 · Hydraulic dump valve'].map((p, i) => (
        <li key={p} className="flex items-center justify-between gap-2 text-meta text-ink-900">
          <span className="truncate">{p}</span>
          <span className="hp-a hp-p flex shrink-0 items-center gap-1 font-semibold" style={d(0.7 + i * 0.3)}>
            <Lock className="size-3.5" /> Locked
          </span>
        </li>
      ))}
      <li className="hp-a text-meta font-semibold text-accent-ok" style={d(1.7)}>Try-out: zero energy confirmed</li>
    </ul>
  )
}

function MeetingMini() {
  return (
    <div>
      <p className="text-meta text-ink-900">Toolbox talk: forklift traffic</p>
      <div className="mt-2 flex gap-1.5">
        {['AW', 'MT', 'JP', 'SK', 'LR', 'HN'].map((n, i) => (
          <span
            key={n}
            className={`grid size-7 place-items-center rounded-full text-micro font-semibold ${i < 5 ? 'hp-a hp-p bg-ink-900 text-paper' : 'border border-ink-300 text-ink-500'}`}
            style={i < 5 ? d(0.8 + i * 0.15) : undefined}
          >
            {n}
          </span>
        ))}
      </div>
      <p className="hp-a mt-2 text-meta text-ink-600" style={d(1.7)}>5 of 6 attended and signed</p>
    </div>
  )
}

function PermitMini() {
  return (
    <div>
      <p className="truncate text-meta text-ink-900">Hot work · welding at the boiler house</p>
      <div className="relative mt-3 h-1.5 rounded-full bg-ink-200">
        <span className="hp-g absolute inset-0 rounded-full bg-ink-900" style={d(0.9)} />
      </div>
      <ol className="mt-2 flex flex-wrap justify-between gap-x-2 text-micro text-ink-600">
        {['Requested', 'Approved', 'Active', 'Closed'].map((s, i) => (
          <li key={s} className="hp-a" style={d(0.9 + i * 0.35)}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

const MODULES = [
  { name: 'SOPs', icon: FileText, line: 'Step by step, with hazards and PPE first.', mini: <SopMini /> },
  { name: 'PMs', icon: Wrench, line: 'Preventative maintenance: what is due, done, and by whom.', mini: <PmMini /> },
  { name: 'Lockout / tagout', icon: Lock, line: 'Every isolation point, locked and verified.', mini: <LotoMini /> },
  { name: 'Safety meetings', icon: Users, line: 'Toolbox talks with attendance on record.', mini: <MeetingMini /> },
  { name: 'Permits to work', icon: ClipboardCheck, line: 'Requested, approved, active and closed.', mini: <PermitMini /> },
]

function Modules() {
  return (
    <div className="w-full">
      <p className="hp-a font-label text-meta font-semibold uppercase text-ink-500">Modules</p>
      <h2 className="hp-a mt-2 text-2xl font-semibold text-ink-900 lg:text-4xl" style={d(0.1)}>One platform for the work that keeps a site safe</h2>
      <p className="hp-a mt-3 hidden text-reading text-ink-600 sm:block" style={d(0.2)}>Start with SOPs and add the rest as you need them. Every module shares the same people, places, records and sign-off.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(({ name, icon: Icon, line, mini }, i) => (
          <li key={name} className="hp-a flex flex-col gap-2 rounded-2xl border border-ink-200 bg-paper-1 p-3 lg:p-4" style={d(0.2 + i * 0.12)}>
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-paper">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <h3 className="text-reading font-semibold text-ink-900">{name}</h3>
                <p className="text-meta text-ink-600">{line}</p>
              </span>
            </div>
            <div aria-hidden="true" className="hp-tall hidden rounded-lg border border-ink-200 bg-paper p-3 lg:block">{mini}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Intro() {
  return (
    <div className="grid w-full items-center gap-6 xl:grid-cols-2 xl:gap-10">
      <div>
        <p className="hp-a font-label text-meta font-semibold uppercase text-ink-500">Safety software for industrial sites</p>
        <h2 className="hp-a mt-2 text-3xl font-semibold text-ink-900 lg:text-4xl" style={d(0.1)}>Every procedure, where the work happens.</h2>
        <p className="hp-a mt-4 text-reading text-ink-600" style={d(0.3)}>
          Send us the documents you already have. SOPstart turns them into clear steps your people follow on the floor, records every job as it is done, and keeps every version on file.
        </p>
      </div>
      <div className="hp-a overflow-hidden rounded-lg border border-ink-200 shadow-lg" style={d(0.5)}>
        <Image
          src="/welcome/site-map.webp"
          alt="The SOPstart site map: a bottling site drawn in 3D with its areas and machines, and the list of SOPs by area"
          width={1600}
          height={1000}
          priority
          className="h-auto w-full"
        />
      </div>
    </div>
  )
}

const SLIDES: { id: string; label: string; body: ReactNode }[] = [
  { id: 'intro', label: 'SOPstart', body: <Intro /> },
  {
    id: 'accessible',
    label: 'Accessible',
    body: (
      <Story
        eyebrow="Accessible"
        title="Clear to everyone on site, first time"
        intro="Long documents get skimmed and the one line that matters gets missed. Each step comes in plain words, one at a time, where people can act on it."
        points={[
          'Hazards and PPE first, in the safety sign colours people know',
          'Photos of your own machines on the steps that need them',
          'Any phone, tablet or screen, with buttons big enough for gloves',
          'Found on a map of your site, by area, machine or search',
        ]}
        example={<AccessibleExample />}
      />
    ),
  },
  {
    id: 'accountable',
    label: 'Accountable',
    body: (
      <Story
        eyebrow="Accountable"
        title="Every job done, ticked and signed off"
        intro="Start turns a SOP into a checklist. It can only be sent once every step is ticked, and the supervisor sees exactly what was done."
        points={[
          'Hazards acknowledged and PPE confirmed before the first step',
          'Photos as proof where a step needs it',
          'Signed off, or sent back with a reason',
          'A training record for every person, by role',
        ]}
        example={<AccountableExample />}
      />
    ),
  },
  {
    id: 'tracked',
    label: 'Fully tracked',
    body: (
      <Story
        eyebrow="Full document tracking"
        title="Every version, every change, on file"
        intro="Your SOPs come in as they are: Word, PDF or scans. Nothing reaches the floor until your people approve it, and every change after that is tracked."
        points={[
          'The copy on the floor is always the approved one',
          'Each document has an owner and a review date',
          'A change log that can only be added to, never edited',
          'Ready for any audit or incident review',
        ]}
        example={<TrackedExample />}
      />
    ),
  },
  {
    id: 'secure',
    label: 'Secure',
    body: (
      <Story
        eyebrow="Secure"
        title="Your data, securely managed"
        intro="Each organisation's data is kept apart in the database itself, and each person sees only what their role needs."
        points={[
          'Access by role: worker, supervisor, admin, safety manager',
          'Hosted in Australia, encrypted in transit and at rest',
          'New accounts approved before they see anything',
          'Every action logged to a record that cannot be rewritten',
        ]}
        example={<SecureExample />}
      />
    ),
  },
  { id: 'modules', label: 'Modules', body: <Modules /> },
]

const MOTION = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia(MOTION)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

const pill = 'flex min-h-tap items-center rounded-lg px-4 text-ui font-semibold'

export function Homepage() {
  const still = useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION).matches, () => false)
  const [idx, setIdx] = useState(0)
  const [auto, setAuto] = useState(true)
  const playing = auto && !still
  const touchX = useRef<number | null>(null)

  // Any manual move stops the autoplay; Play resumes it.
  const go = (i: number) => {
    setAuto(false)
    setIdx((i + SLIDES.length) % SLIDES.length)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(idx + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(idx - 1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  return (
    <div data-testid="homepage" className="flex h-dvh flex-col overflow-hidden bg-paper text-ink-900 lg:flex-row">
      <style>{STYLES}</style>

      {/* Left: the brandmark */}
      <aside className="flex shrink-0 items-center justify-between gap-4 bg-ink-900 px-4 py-3 text-paper lg:w-5/12 lg:flex-col lg:items-stretch lg:px-12 lg:py-12">
        <div className="lg:my-auto">
          <h1 className="hp-mark">
            <Wordmark onInk />
          </h1>
          <p className="hp-lead mt-8 hidden max-w-md text-4xl font-semibold lg:block" style={d(2.6)}>Safe work, one step at a time.</p>
          <p className="hp-lead mt-4 hidden max-w-md text-reading text-ink-300 lg:block" style={d(2.9)}>
            SOPs, PMs, lockout / tagout, safety meetings and permits to work, in one place everyone on site can use.
          </p>
          <a
            href={`mailto:${ENQUIRIES_EMAIL}`}
            data-testid="enquiries-cta"
            className="hp-lead mt-8 hidden min-h-tap-row w-fit items-center rounded-lg bg-paper px-8 text-reading font-semibold text-ink-900 hover:bg-paper-2 lg:flex"
            style={d(3.2)}
          >
            See it with your own SOPs
          </a>
        </div>
        <div className="flex items-center gap-2">
          <a href={`mailto:${ENQUIRIES_EMAIL}`} data-testid="enquiries" className={`${pill} text-paper hover:bg-ink-700`}>
            Enquiries
          </a>
          <Link href="/login" className={`${pill} bg-paper text-ink-900 hover:bg-paper-2`}>
            Sign in
          </Link>
        </div>
      </aside>

      {/* Right: the slides */}
      <main
        className="relative flex min-h-0 flex-1 flex-col"
        aria-roledescription="carousel"
        aria-label="What SOPstart does"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1))
          touchX.current = null
        }}
      >
        <div className="relative min-h-0 flex-1">
          {SLIDES.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              data-testid="slide"
              data-in={i === idx ? '' : undefined}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}: ${s.label}`}
              aria-hidden={i !== idx}
              inert={i !== idx}
              className={`hp-slide absolute inset-0 flex items-center overflow-hidden px-4 py-6 transition-opacity duration-500 lg:px-12 ${i === idx ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              {s.body}
            </section>
          ))}
        </div>

        {/* Controls */}
        <nav aria-label="Slides" className="flex shrink-0 items-center gap-2 border-t border-ink-200 px-4 py-2 lg:px-12">
          {!still && (
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink-900 hover:bg-paper-2"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          )}
          <div className="flex flex-1 gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                data-testid="slide-dot"
                onClick={() => go(i)}
                aria-label={s.label}
                aria-current={i === idx}
                className="flex h-10 flex-1 flex-col justify-center gap-1"
              >
                <span className="h-1 w-full overflow-hidden rounded-full bg-ink-200">
                  {(i < idx || (i === idx && !playing)) && <span className="block h-full w-full bg-ink-900" />}
                  {i === idx && playing && (
                    <span
                      key={idx}
                      className="block h-full w-full origin-left bg-ink-900"
                      style={{ animation: `hp-fill ${SLIDE_MS}ms linear both` }}
                      onAnimationEnd={() => setIdx((idx + 1) % SLIDES.length)}
                    />
                  )}
                </span>
                <span className={`hidden truncate text-left text-micro sm:block ${i === idx ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>{s.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(idx - 1)} aria-label="Previous slide" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-900 hover:bg-paper-2">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(idx + 1)} aria-label="Next slide" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-900 hover:bg-paper-2">
            <ChevronRight className="size-5" />
          </button>
        </nav>
      </main>
    </div>
  )
}
