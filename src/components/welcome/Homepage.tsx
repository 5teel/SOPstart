/**
 * The signed-out homepage below the promo reel: what SOPstart does and why a site
 * would want it. Static, nothing fetched; the screenshots are the demo bottling
 * site (public/welcome/).
 */
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip } from '@/components/focus/KindChip'
import type { FocusKind } from '@/lib/sop/focus'

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-label text-meta font-semibold uppercase text-ink-500">{children}</p>
}

function H2({ children, onInk = false }: { children: ReactNode; onInk?: boolean }) {
  return <h2 className={`mt-2 max-w-3xl text-3xl font-semibold lg:text-5xl ${onInk ? 'text-paper' : 'text-ink-900'}`}>{children}</h2>
}

const Section = ({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) => (
  <section id={id} className={`px-4 py-20 lg:px-8 lg:py-28 ${className}`}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
)

const PILLARS = [
  ['Safer work', 'Hazards and PPE come first, in the safety sign colours people already know, before a single step is done.'],
  ['Done right first time', 'One step at a time, in plain words, with photos of your own machines. Nothing important buried on page 3.'],
  ['Always audit-ready', 'Every run, sign-off and change is recorded as it happens. The answer is there before anyone asks.'],
] as const

const CONVERTED: ReadonlyArray<[FocusKind, string]> = [
  ['hazard', 'Moving star wheels'],
  ['hazard', 'Broken bottle edges'],
  ['ppe', 'Gloves, safety glasses'],
  ['step', 'Stop the line and press the e-stop.'],
  ['step', 'Open the guard only after the star wheel stops.'],
  ['step', 'Clear the jammed bottles.'],
]

function Converted() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-ink-200 bg-paper-1 p-5">
        <p className="font-label text-meta text-ink-500">What you have</p>
        <p className="mt-1 text-ui font-medium text-ink-900">Filler jam SOP (2019).docx</p>
        <div className="mt-4 flex flex-col gap-2">
          {[100, 90, 96, 70, 100, 84, 92, 60, 98, 76].map((w, i) => (
            <span key={i} className="h-1.5 rounded-full bg-ink-200" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-ink-200 bg-paper-1 p-5">
        <p className="font-label text-meta text-ink-500">What your people get</p>
        <ol className="mt-2 flex flex-col">
          {CONVERTED.map(([kind, text]) => (
            <li key={text} className="flex flex-col items-start gap-1 border-b border-ink-200 py-2 last:border-0">
              {kind !== 'step' && <KindChip kind={kind} />}
              <span className="text-ui text-ink-900">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-full max-w-72 overflow-hidden rounded-2xl border-4 border-ink-900 bg-paper-1 shadow-lg">
      <Image src={src} alt={alt} width={585} height={1266} className="h-auto w-full" />
    </div>
  )
}

function Screen({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-paper-1 shadow-lg">
      <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" />
    </div>
  )
}

const FEATURES: { label: string; title: string; body: ReactNode; visual: ReactNode }[] = [
  {
    label: 'Bring what you have',
    title: 'Your SOPs go in as they are',
    body: (
      <>
        <p>Word, PDF, scans. Any format, any age. Hazards and PPE are pulled to the top and every step is kept in order and checked against the original, so nothing is dropped.</p>
        <p className="mt-3">The original wording is always kept, and nothing reaches the floor until your people approve it.</p>
      </>
    ),
    visual: <Converted />,
  },
  {
    label: 'Find it fast',
    title: 'Every SOP sits where the work happens',
    body: <p>People find SOPs on a map of their own site: by area, by machine, or by search. Tap a machine and see what applies to it.</p>,
    visual: <Screen src="/welcome/site-map.webp" alt="The SOPstart site map: a bottling site drawn in 3D with its areas and machines, and the list of SOPs by area" width={1600} height={1000} />,
  },
  {
    label: 'Read it right',
    title: 'Hazards first. Then the steps, with pictures.',
    body: (
      <>
        <p>Big text, one step at a time, on a phone or a screen on the line. The hazards and PPE always come first.</p>
        <p className="mt-3 flex gap-2">
          <KindChip kind="hazard" />
          <KindChip kind="ppe" />
        </p>
      </>
    ),
    visual: <Phone src="/welcome/read.webp" alt="A SOP on a phone: two hazards and the PPE under Before you start, then the first step" />,
  },
  {
    label: 'Do it and prove it',
    title: 'Tick each step. Send it for sign-off.',
    body: <p>Start turns the SOP into a checklist. It can only be sent once every step is ticked, with photos where proof is needed. No paper, nothing to file later.</p>,
    visual: <Phone src="/welcome/run.webp" alt="A SOP checklist on a phone: every step ticked, each with a photo of the machine, and Send for sign-off" />,
  },
  {
    label: 'Sign it off',
    title: 'Supervisors see exactly what was done',
    body: <p>Every step, every hazard acknowledged, the time and the SOP version. Sign it off, or send it back with a reason. Nothing chased by email.</p>,
    visual: <Screen src="/welcome/sign-off.webp" alt="A supervisor's sign-off view: the worker, the SOP and version, and each hazard, PPE item and step marked done" width={1400} height={689} />,
  },
]

const BENEFITS = [
  ['Records that keep themselves', 'Who did which SOP, when, and on which version. No paperwork to chase or file.'],
  ['Always the latest version', 'The copy on the floor is the approved one. Every SOP has an owner and a review date.'],
  ['Experts stay on the floor', 'Your skilled people run the site instead of typing long documents.'],
  ['Know-how that stays', 'When someone leaves, the way they did the job stays in the SOP.'],
  ['Safety records you can stand behind', 'Hazards, PPE and sign-offs on a log that can only be added to. Ready for any audit or incident review.'],
  ['A training plan for every person', 'What each person is signed off on and what they need next, by role, across the site.'],
] as const

const button = 'flex min-h-tap-row items-center justify-center rounded-lg px-8 text-reading font-semibold'

export function Homepage() {
  return (
    <div className="bg-paper text-ink-900">
      <Section id="about">
        <Eyebrow>Why SOPstart</Eyebrow>
        <H2>SOPs your people actually follow</H2>
        <p className="mt-4 max-w-2xl text-reading text-ink-600">
          SOPstart turns the procedures you already have into clear, step-by-step instructions where the work happens, and keeps the record for you.
        </p>
        <ul className="mt-12 grid gap-8 lg:grid-cols-3">
          {PILLARS.map(([title, body]) => (
            <li key={title} className="border-t border-ink-300 pt-4">
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-reading text-ink-600">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="bg-ink-900">
        <H2 onInk>We take care of the SOPs. You run the site.</H2>
        <ul className="mt-12 grid gap-8 lg:grid-cols-3">
          {[
            ['Your workers', 'get the right step, at the right time, in plain words.'],
            ['Your supervisors', 'sign off real work, with every step and hazard in front of them.'],
            ['Your managers', 'get a full record of who did what, when, on which version.'],
          ].map(([who, what]) => (
            <li key={who} className="border-t border-ink-700 pt-4">
              <h3 className="text-lg font-semibold text-paper">{who}</h3>
              <p className="mt-1 text-reading text-ink-300">{what}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how-it-works">
        <Eyebrow>How it works</Eyebrow>
        <H2>From the document on the shelf to a signed-off record</H2>
        <ol className="mt-16 flex flex-col gap-20 lg:gap-28">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? 'lg:order-2' : ''}>
                <p className="font-label text-meta font-semibold uppercase text-ink-500">{f.label}</p>
                <h3 className="mt-1 text-2xl font-semibold lg:text-3xl">{f.title}</h3>
                <div className="mt-4 text-reading text-ink-600">{f.body}</div>
              </div>
              <div>{f.visual}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="bg-paper-2">
        <Eyebrow>What changes</Eyebrow>
        <H2>A safer, faster site with the paperwork done</H2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(([title, body]) => (
            <li key={title} className="rounded-lg border border-ink-200 bg-paper-1 p-6">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-reading text-ink-600">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="bg-ink-900">
        <div className="flex flex-col items-center text-center">
          <p className="mb-4"><Wordmark size="hero" onInk /></p>
          <H2 onInk>Safe work, one step at a time.</H2>
          <p className="mt-4 max-w-xl text-reading text-ink-300">Tell us about your site and we will show you SOPstart with your own SOPs.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={`mailto:${ENQUIRIES_EMAIL}`} data-testid="enquiries-cta" className={`${button} bg-paper text-ink-900 hover:bg-paper-2`}>
              Get in touch
            </a>
            <Link href="/login" className={`${button} border border-ink-500 text-paper hover:border-paper`}>
              Sign in
            </Link>
          </div>
        </div>
      </Section>

      <footer className="border-t border-ink-700 bg-ink-900 px-4 py-8 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-meta text-ink-400 sm:flex-row sm:justify-between">
          <p>SOPstart trades under Potenco Pty Ltd.</p>
          <a href={`mailto:${ENQUIRIES_EMAIL}`} className="hover:text-paper">{ENQUIRIES_EMAIL}</a>
        </div>
      </footer>
    </div>
  )
}
