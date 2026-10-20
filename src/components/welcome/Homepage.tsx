/**
 * The signed-out homepage at /welcome, one page: the brandmark animates in on the
 * left (sticky on desktop, the top of the page on a phone) and the right side tells
 * the story -- four themes with animated examples, then the five modules.
 * Static, nothing fetched. Examples animate once when scrolled into view (Reveal);
 * with reduced motion or no script they simply show.
 */
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Check, ClipboardCheck, FileText, Lock, ShieldCheck, Users, Wrench } from 'lucide-react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip } from '@/components/focus/KindChip'
import type { FocusKind } from '@/lib/sop/focus'
import { Reveal } from './Reveal'

const STYLES = `
@keyframes hp-in { from { opacity: 0; transform: translateY(0.75rem) } to { opacity: 1; transform: none } }
@keyframes hp-pop { 0% { opacity: 0; transform: scale(0.4) } 70% { opacity: 1; transform: scale(1.15) } 100% { opacity: 1; transform: none } }
@keyframes hp-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes hp-drop { 0% { opacity: 0; transform: translateY(-0.6em) rotate(-8deg) scale(1.3) } 60% { opacity: 1; transform: translateY(0.05em) rotate(2deg) } 100% { opacity: 1; transform: none } }
@keyframes hp-type { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
@keyframes hp-tape { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes hp-tape-run { from { background-position: 0 0 } to { background-position: 2em 0 } }
.hp-mark .wm { font-size: var(--wm-size-hero) }
@media (min-width: 64rem) { .hp-mark .wm { font-size: calc(var(--wm-size-hero) * 1.7) } }
.hp-mark .wm-sop { animation: hp-drop 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.2s both }
.hp-mark .wm-start { animation: hp-type 0.6s steps(5, end) 0.9s both }
.hp-mark .wm::after { transform-origin: left; animation: hp-tape 0.7s ease-out 1.5s both, hp-tape-run 1.2s linear 2.2s infinite }
.hp-lead { animation: hp-in 0.6s ease-out var(--d, 0s) both }
[data-reveal] .hp-a { opacity: 0 }
[data-reveal][data-in] .hp-a { animation: hp-in 0.5s ease-out var(--d, 0s) both }
[data-reveal][data-in] .hp-p { animation-name: hp-pop }
[data-reveal] .hp-g { transform: scaleX(0); transform-origin: left }
[data-reveal][data-in] .hp-g { animation: hp-grow 1.4s ease-in-out var(--d, 0s) both }
@media (prefers-reduced-motion: reduce) {
  .hp-mark *, .hp-mark .wm::after, .hp-lead { animation: none !important }
  [data-reveal] .hp-a { opacity: 1; animation: none !important }
  [data-reveal] .hp-g { transform: none; animation: none !important }
}
`
const NOSCRIPT = '[data-reveal] .hp-a { opacity: 1 } [data-reveal] .hp-g { transform: none }'

const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties

const THEMES = [
  ['accessible', 'Accessible'],
  ['accountable', 'Accountable'],
  ['tracked', 'Fully tracked'],
  ['secure', 'Secure'],
] as const

const MODULE_NAV = [
  ['SOPs', FileText],
  ['PMs', Wrench],
  ['Lockout / tagout', Lock],
  ['Safety meetings', Users],
  ['Permits to work', ClipboardCheck],
] as const

// -- Layout pieces -------------------------------------------------------------

function Story({ id, eyebrow, title, intro, points, example }: { id: string; eyebrow: string; title: string; intro: string; points: string[]; example: ReactNode }) {
  return (
    <section id={id} data-reveal className="scroll-mt-8 border-t border-ink-200 px-4 py-16 lg:px-12 lg:py-24">
      <p className="font-label text-meta font-semibold uppercase text-ink-500">{eyebrow}</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-semibold text-ink-900 lg:text-4xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-reading text-ink-600">{intro}</p>
      <div className="mt-10 grid items-start gap-10 xl:grid-cols-2">
        <ul className="flex flex-col gap-3">
          {points.map((p, i) => (
            <li key={p} className="hp-a flex gap-3 text-reading text-ink-900" style={d(0.1 + i * 0.1)}>
              <Check className="mt-0.5 size-5 shrink-0 text-accent-ok" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <div aria-hidden="true">{example}</div>
      </div>
    </section>
  )
}

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

// -- Theme examples ------------------------------------------------------------

function AccessibleExample() {
  return (
    <Card>
      <Label>Before</Label>
      <p className="hp-a mt-1 text-meta text-ink-500 line-through" style={d(0.2)}>
        Prior to commencement, ensure all energy sources associated with the infeed assembly have been isolated in accordance with site procedure.
      </p>
      <p className="hp-a mt-4 font-label text-meta text-ink-500" style={d(0.8)}>In SOPstart</p>
      <div className="hp-a mt-2 flex flex-wrap gap-2" style={d(1)}>
        <KindChip kind="hazard" />
        <KindChip kind="ppe" />
      </div>
      <p className="hp-a mt-3 text-2xl font-semibold text-ink-900" style={d(1.2)}>Switch off and lock the infeed isolator.</p>
      <div className="hp-a mt-4 flex min-h-tap-glove items-center justify-center rounded-lg bg-ink-900 text-reading font-semibold text-paper" style={d(1.6)}>
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
      <ol className="mt-3 flex flex-col">
        {RUN.map(([kind, text], i) => (
          <li key={text} className="flex items-center gap-3 border-b border-ink-200 py-2">
            <Tick at={0.3 + i * 0.45} />
            <span className="min-w-0">
              {kind !== 'step' && <KindChip kind={kind} />}
              <span className="block text-ui text-ink-900">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="hp-a mt-3 flex min-h-tap items-center gap-2 rounded-lg bg-[var(--tint-signoff-bg)] px-3 text-ui font-semibold text-ink-900" style={d(2.3)}>
        <Check className="size-4 text-accent-ok" /> Sent for sign-off · 10:41
      </p>
      <p className="hp-a mt-2 flex min-h-tap items-center gap-2 rounded-lg border border-[var(--tint-signoff-border)] px-3 text-ui text-ink-900" style={d(3)}>
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
        <span className="hp-a shrink-0 rounded px-2 py-1 text-micro font-semibold text-accent-decision bg-[var(--tint-decision-bg)]" style={d(1.8)}>
          Review due 2 Oct
        </span>
      </div>
      <ol className="relative mt-4 flex flex-col gap-4 border-l-2 border-ink-200 pl-5">
        {HISTORY.map(([v, what, who], i) => (
          <li key={v} className="hp-a relative" style={d(0.3 + i * 0.4)}>
            <span className="absolute -left-7 top-0.5 grid size-4 place-items-center rounded-full bg-ink-900" />
            <p className="text-ui text-ink-900">
              <span className="mono mr-2 text-meta font-semibold">{v}</span>
              {what}
            </p>
            <p className="text-meta text-ink-500">{who}</p>
          </li>
        ))}
      </ol>
      <p className="hp-a mt-4 text-meta text-ink-600" style={d(1.6)}>
        Every reader sees v3. v1 and v2 are kept, with who changed what.
      </p>
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
        <span className="hp-a hp-p grid size-9 place-items-center rounded-full bg-ink-900 text-paper" style={d(0.2)}>
          <Lock className="size-4" />
        </span>
        <p className="text-ui font-semibold text-ink-900">Clearwater Beverages · who sees what</p>
      </div>
      <ul className="mt-4 flex flex-col">
        {ACCESS.map(([role, sees], i) => (
          <li key={role} className="hp-a flex justify-between gap-3 border-b border-ink-200 py-2 text-ui" style={d(0.5 + i * 0.25)}>
            <span className="font-semibold text-ink-900">{role}</span>
            <span className="text-right text-ink-600">{sees}</span>
          </li>
        ))}
      </ul>
      <p className="hp-a mt-3 text-meta text-ink-600" style={d(1.6)}>Other organisations: nothing, ever.</p>
    </Card>
  )
}

// -- Modules -------------------------------------------------------------------

function SopMini() {
  return (
    <ol className="flex flex-col gap-1.5">
      {(['hazard', 'ppe', 'step'] as FocusKind[]).map((k, i) => (
        <li key={k} className="hp-a flex items-center gap-2" style={d(0.2 + i * 0.2)}>
          <KindChip kind={k} />
          <span className="truncate text-meta text-ink-900">{k === 'hazard' ? 'Hot surface' : k === 'ppe' ? 'Heat gloves' : 'Open the mould guard'}</span>
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
        <li key={what} className="hp-a flex justify-between gap-2 text-meta" style={d(0.2 + i * 0.2)}>
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
          {p}
          <span className="hp-a hp-p flex items-center gap-1 font-semibold" style={d(0.3 + i * 0.3)}>
            <Lock className="size-3.5" /> Locked
          </span>
        </li>
      ))}
      <li className="hp-a text-meta font-semibold text-accent-ok" style={d(1.3)}>Try-out: zero energy confirmed</li>
    </ul>
  )
}

function MeetingMini() {
  return (
    <div>
      <p className="text-meta text-ink-900">Toolbox talk: forklift traffic</p>
      <div className="mt-2 flex gap-1.5">
        {['AW', 'MT', 'JP', 'SK', 'LR', 'HN'].map((n, i) => (
          <span key={n} className={`grid size-8 place-items-center rounded-full text-micro font-semibold ${i < 5 ? 'hp-a hp-p bg-ink-900 text-paper' : 'border border-ink-300 text-ink-500'}`} style={i < 5 ? d(0.2 + i * 0.15) : undefined}>
            {n}
          </span>
        ))}
      </div>
      <p className="hp-a mt-2 text-meta text-ink-600" style={d(1.1)}>5 of 6 attended and signed</p>
    </div>
  )
}

function PermitMini() {
  const stages = ['Requested', 'Approved', 'Active', 'Closed']
  return (
    <div>
      <p className="text-meta text-ink-900">Hot work · welding at the boiler house</p>
      <div className="relative mt-3 h-1.5 rounded-full bg-ink-200">
        <span className="hp-g absolute inset-0 rounded-full bg-ink-900" style={d(0.3)} />
      </div>
      <ol className="mt-2 grid grid-cols-4 gap-1 text-micro text-ink-600">
        {stages.map((s, i) => (
          <li key={s} className="hp-a" style={d(0.3 + i * 0.35)}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

const MODULES = [
  { name: 'SOPs', icon: FileText, line: 'Standard operating procedures, step by step, with hazards and PPE first.', mini: <SopMini /> },
  { name: 'PMs', icon: Wrench, line: 'Preventative maintenance on every machine: what is due, what is done, who did it.', mini: <PmMini /> },
  { name: 'Lockout / tagout', icon: Lock, line: 'Every isolation point, lock and tag, verified before anyone starts work.', mini: <LotoMini /> },
  { name: 'Safety meetings', icon: Users, line: 'Toolbox talks and pre-starts with attendance and sign-in on record.', mini: <MeetingMini /> },
  { name: 'Permits to work', icon: ClipboardCheck, line: 'Hot work, confined spaces, heights: requested, approved, active and closed.', mini: <PermitMini /> },
]

// -- The page ------------------------------------------------------------------

const button = 'flex min-h-tap-row items-center justify-center rounded-lg px-8 text-reading font-semibold'

export function Homepage() {
  return (
    <div data-testid="homepage" className="bg-paper text-ink-900 lg:flex">
      <style>{STYLES}</style>
      <noscript>
        <style>{NOSCRIPT}</style>
      </noscript>
      <Reveal />

      {/* Left: the brandmark */}
      <aside className="flex flex-col justify-between gap-12 bg-ink-900 px-6 py-10 text-paper lg:sticky lg:top-0 lg:h-dvh lg:w-5/12 lg:shrink-0 lg:px-12 lg:py-12">
        <nav aria-label="Account" className="flex justify-end gap-2">
          <a href={`mailto:${ENQUIRIES_EMAIL}`} data-testid="enquiries" className="flex min-h-tap items-center rounded-lg px-4 text-ui font-semibold text-paper hover:bg-ink-700">
            Enquiries
          </a>
          <Link href="/login" className="flex min-h-tap items-center rounded-lg bg-paper px-5 text-ui font-semibold text-ink-900 hover:bg-paper-2">
            Sign in
          </Link>
        </nav>

        <div>
          <h1 className="hp-mark">
            <Wordmark onInk />
          </h1>
          <p className="hp-lead mt-8 max-w-md text-3xl font-semibold lg:text-4xl" style={d(2)}>Safe work, one step at a time.</p>
          <p className="hp-lead mt-4 max-w-md text-reading text-ink-300" style={d(2.3)}>
            SOPs, PMs, lockout / tagout, safety meetings and permits to work, in one place everyone on site can use.
          </p>
          <ul className="hp-lead mt-8 flex flex-wrap gap-2" style={d(2.6)}>
            {MODULE_NAV.map(([name, Icon]) => (
              <li key={name}>
                <a href="#modules" className="flex min-h-tap items-center gap-2 rounded-full border border-ink-700 px-4 text-ui text-paper hover:border-paper">
                  <Icon className="size-4" aria-hidden="true" /> {name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="hp-lead text-meta text-ink-400" style={d(2.9)}>SOPstart trades under Potenco Pty Ltd.</p>
      </aside>

      {/* Right: the story */}
      <main className="min-w-0 lg:flex-1">
        <section className="px-4 py-16 lg:px-12 lg:py-24">
          <p className="hp-lead font-label text-meta font-semibold uppercase text-ink-500" style={d(0.4)}>Safety software for industrial sites</p>
          <h2 className="hp-lead mt-2 max-w-2xl text-4xl font-semibold lg:text-5xl" style={d(0.6)}>Every procedure, where the work happens.</h2>
          <p className="hp-lead mt-6 max-w-2xl text-reading text-ink-600" style={d(0.8)}>
            Send us the documents you already have. SOPstart turns them into clear steps your people follow on the floor, records every job as it is done, and keeps every version on file.
          </p>
          <ul className="hp-lead mt-8 flex flex-wrap gap-2" style={d(1)}>
            {THEMES.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="flex min-h-tap items-center rounded-full border border-ink-300 px-4 text-ui font-semibold text-ink-900 hover:border-ink-900">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="hp-lead mt-12 overflow-hidden rounded-lg border border-ink-200 shadow-lg" style={d(1.2)}>
            <Image
              src="/welcome/site-map.webp"
              alt="The SOPstart site map: a bottling site drawn in 3D with its areas and machines, and the list of SOPs by area"
              width={1600}
              height={1000}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>

        <Story
          id="accessible"
          eyebrow="Accessible"
          title="Clear to everyone on site, first time"
          intro="Long documents get skimmed and the one line that matters gets missed. SOPstart puts each step in plain words, one at a time, where people can act on it."
          points={[
            'Plain words, big text, one step at a time',
            'Hazards and PPE first, in the safety sign colours people already know',
            'Photos of your own machines on the steps that need them',
            'On any phone, tablet or screen on the line, with buttons big enough for gloves',
            'Found on a map of your site: by area, by machine, or by search',
          ]}
          example={<AccessibleExample />}
        />

        <Story
          id="accountable"
          eyebrow="Accountable"
          title="Every job done, ticked and signed off"
          intro="Start turns a SOP into a checklist. It can only be sent once every step is ticked, and the supervisor sees exactly what was done before signing it off."
          points={[
            'Hazards acknowledged and PPE confirmed before the first step',
            'Photos as proof where a step needs it',
            'Signed off, or sent back with a reason',
            'Who did which job, when, and on which version',
            'A training record for every person, by role',
          ]}
          example={<AccountableExample />}
        />

        <Story
          id="tracked"
          eyebrow="Full document tracking"
          title="Every version, every change, on file"
          intro="Bring your SOPs in as they are: Word, PDF or scans. The original wording is kept, and nothing reaches the floor until your people approve it. From then on every change is tracked."
          points={[
            'The copy on the floor is always the approved one',
            'Each document has an owner and a review date',
            'Earlier versions kept, with who changed what and why',
            'A change log that can only be added to, never edited',
            'Ready for any audit or incident review, and exportable at any time',
          ]}
          example={<TrackedExample />}
        />

        <Story
          id="secure"
          eyebrow="Secure"
          title="Your data, securely managed"
          intro="Your procedures and records are your business. Each organisation's data is kept apart in the database itself, and each person sees only what their role needs."
          points={[
            'Access by role: worker, supervisor, admin, safety manager',
            "Each organisation's data walled off at the database, not just the screen",
            'Hosted in Australia, encrypted in transit and at rest',
            'New accounts approved before they see anything',
            'Every action logged to a record that cannot be rewritten',
          ]}
          example={<SecureExample />}
        />

        <section id="modules" data-reveal className="scroll-mt-8 border-t border-ink-200 bg-paper-2 px-4 py-16 lg:px-12 lg:py-24">
          <p className="font-label text-meta font-semibold uppercase text-ink-500">Modules</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold lg:text-4xl">One platform for the work that keeps a site safe</h2>
          <p className="mt-4 max-w-2xl text-reading text-ink-600">Start with SOPs and add the rest as you need them. Every module shares the same people, places, records and sign-off.</p>
          <ul className="mt-10 grid gap-4 xl:grid-cols-2">
            {MODULES.map(({ name, icon: Icon, line, mini }, i) => (
              <li key={name} className="hp-a flex flex-col gap-4 rounded-2xl border border-ink-200 bg-paper-1 p-6" style={d(i * 0.12)}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-ink-900 text-paper">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-xl font-semibold">{name}</h3>
                </div>
                <p className="text-reading text-ink-600">{line}</p>
                <div aria-hidden="true" className="rounded-lg border border-ink-200 bg-paper p-4">{mini}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-ink-200 px-4 py-16 lg:px-12 lg:py-24">
          <h2 className="max-w-2xl text-3xl font-semibold lg:text-4xl">See it with your own documents</h2>
          <p className="mt-4 max-w-xl text-reading text-ink-600">Send us a few of your SOPs and we will show you them in SOPstart.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={`mailto:${ENQUIRIES_EMAIL}`} data-testid="enquiries-cta" className={`${button} bg-ink-900 text-paper hover:opacity-90`}>
              Get in touch
            </a>
            <Link href="/login" className={`${button} border border-ink-300 text-ink-900 hover:border-ink-900`}>
              Sign in
            </Link>
          </div>
          <p className="mt-12 text-meta text-ink-500">
            <a href={`mailto:${ENQUIRIES_EMAIL}`} className="hover:text-ink-900">{ENQUIRIES_EMAIL}</a>
          </p>
        </section>
      </main>
    </div>
  )
}
