/**
 * The signed-out homepage below the promo reel: the Visy pilot deck (October 2026)
 * retold for any site. Static, nothing fetched; the screenshots are the demo
 * bottling site (public/welcome/).
 */
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ENQUIRIES_EMAIL } from '@/lib/contact'
import { Wordmark } from '@/components/brand/Wordmark'
import { KindChip } from '@/components/focus/KindChip'
import type { FocusKind } from '@/lib/sop/focus'

function Eyebrow({ children, onInk = false }: { children: ReactNode; onInk?: boolean }) {
  return <p className={`font-label text-meta font-semibold uppercase ${onInk ? 'text-ink-300' : 'text-ink-500'}`}>{children}</p>
}

function H2({ children, onInk = false }: { children: ReactNode; onInk?: boolean }) {
  return <h2 className={`mt-2 max-w-3xl text-3xl font-semibold lg:text-5xl ${onInk ? 'text-paper' : 'text-ink-900'}`}>{children}</h2>
}

const Section = ({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) => (
  <section id={id} className={`px-4 py-20 lg:px-8 lg:py-28 ${className}`}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
)

const PROBLEMS = [
  ['Poor records', 'Who did what, and when, is hard to prove.'],
  ['Broken paper trails', 'Sign-offs get lost between paper, email and shared drives.'],
  ['Outdated SOPs', 'The copy on the floor is not the latest one.'],
  ['Experts off the floor', 'Writing a new SOP takes skilled people away from the line.'],
  ['Know-how in heads', 'When an expert leaves, the process leaves with them.'],
  ['Written to tick a box', 'Built to pass an audit, not to help the person doing the job.'],
] as const

/** Page 3 of 14: the one line that matters, buried in the text. */
function BuriedLine() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-ink-200 bg-paper-1 p-6 shadow-lg">
      <p className="font-label text-meta text-ink-500">Page 3 of 14</p>
      <div className="mt-4 flex flex-col gap-2">
        {[100, 94, 98, 88, 96, 72, 100, 91, 97, 64].map((w, i) => (
          <span key={i} className={`h-2 rounded-full ${i === 6 ? 'bg-sign-warning' : 'bg-ink-200'}`} style={{ width: `${w}%` }} />
        ))}
      </div>
      <p className="mt-4 text-meta text-ink-600">
        <span className="font-semibold text-ink-900">Line 7:</span> isolate the infeed before opening the guard.
      </p>
    </div>
  )
}

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
        <p className="font-label text-meta text-ink-500">What workers get</p>
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

const STEPS: { title: string; body: ReactNode; visual: ReactNode }[] = [
  {
    title: 'Your SOPs go in as they are',
    body: (
      <>
        <p>Word, PDF, scans. Any format, any age. We convert every one: hazards and PPE pulled to the top, steps kept in order and checked against the original, so nothing is dropped.</p>
        <p className="mt-3">Every SOP keeps its original wording. Next to it sits a clear version in plain words, and nothing reaches the floor until your people approve it.</p>
      </>
    ),
    visual: <Converted />,
  },
  {
    title: 'Every SOP sits where the work happens',
    body: <p>Workers find SOPs on a map of their own site: by area, by machine, or by search. Tap a machine and see what applies to it.</p>,
    visual: <Screen src="/welcome/site-map.webp" alt="The SOPstart site map: a bottling site drawn in 3D with its areas and machines, and the list of SOPs by area" width={1600} height={1000} />,
  },
  {
    title: 'Hazards first. Then the steps, with pictures.',
    body: (
      <>
        <p>Hazards and PPE come before anything else, in the safety sign colours workers already know. Then big text, one step at a time, with a photo where it helps.</p>
        <p className="mt-3 flex gap-2">
          <KindChip kind="hazard" />
          <KindChip kind="ppe" />
        </p>
      </>
    ),
    visual: <Phone src="/welcome/read.webp" alt="A SOP on a phone: two hazards and the PPE under Before you start, then the first step" />,
  },
  {
    title: 'Tick each step. Send it for sign-off.',
    body: <p>Start turns the SOP into a checklist. The send button only works once every step is ticked, and photos can be added where proof is needed. No paper, nothing to file later.</p>,
    visual: <Phone src="/welcome/run.webp" alt="A SOP checklist on a phone: every step ticked, each with a photo of the machine, and Send for sign-off" />,
  },
  {
    title: 'The supervisor signs it off',
    body: <p>They see every step, every hazard acknowledged, the time and the SOP version. Sign it off, or send it back with a reason. Nothing chased by email.</p>,
    visual: <Screen src="/welcome/sign-off.webp" alt="A supervisor's sign-off view: the worker, the SOP and version, and each hazard, PPE item and step marked done" width={1400} height={689} />,
  },
]

const BENEFITS = [
  ['Records that keep themselves', 'Every run, sign-off and change is logged as it happens. No paperwork to chase or file.'],
  ['A more efficient site', 'One step at a time, with pictures. People understand the SOP first time, so jobs are done right and faster.'],
  ['Safety records you can stand behind', 'Hazards, PPE and sign-offs on a log that can only be added to. Ready for any audit or incident review.'],
  ['A training plan for every person', 'What each person is signed off on and what they need next, by role, across the site.'],
] as const

const STAGES = [
  ['Stage 1', 'One department', 'You share its SOPs and roles as they are. We convert every SOP and set up the department, then your people review in rounds. Then you decide. No obligation.'],
  ['Stage 2', 'The whole site', 'Department by department, with the first as the template. Every SOP in one catalogue with its area, machine, owner and review date.'],
  ['Stage 3', 'Your own SOP builder', 'An operator talks through the job while they do it and gets clear steps, diagrams and photos of your machines, for an expert to check.'],
] as const

const button = 'flex min-h-tap-row items-center justify-center rounded-lg px-8 text-reading font-semibold'

export function Homepage() {
  return (
    <div className="bg-paper text-ink-900">
      {/* The gap */}
      <Section id="about">
        <Eyebrow>The gap</Eyebrow>
        <H2>Sites run on SOPs. Most SOPs fall into a gap.</H2>
        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg border border-ink-200 bg-paper-1 p-6">
            <h3 className="text-xl font-semibold">Managed data</h3>
            <p className="mt-2 text-reading text-ink-600">Regulations, records, training, version control, sign-offs, audits. What the business needs to prove.</p>
          </div>
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-ink-300 px-6 py-4 font-label text-meta font-semibold uppercase text-ink-700">
            SOPs fall in here
          </div>
          <div className="rounded-lg border border-ink-200 bg-paper-1 p-6">
            <h3 className="text-xl font-semibold">Human processes</h3>
            <p className="mt-2 text-reading text-ink-600">How people actually learn the job and do it, on the floor, under time pressure.</p>
          </div>
        </div>
        <p className="mt-8 max-w-2xl text-reading text-ink-600">Managing data is rarely a core skill on the shop floor. SOPstart joins the two halves.</p>
      </Section>

      {/* The problem */}
      <Section className="bg-paper-2">
        <Eyebrow>The problem</Eyebrow>
        <H2>The same problems show up on every site</H2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(([title, body]) => (
            <li key={title} className="rounded-lg border border-ink-200 bg-paper-1 p-6">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-reading text-ink-600">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold lg:text-3xl">SOPs are hard to write and hard to read</h3>
            <p className="mt-4 text-reading text-ink-600">Before a task, a worker gets pages of small text, or scribbles on a piece of paper. Attention runs out. The one line that matters gets missed.</p>
            <p className="mt-4 text-reading font-semibold">One missed line can mean downtime on the line, or an injury.</p>
          </div>
          <BuriedLine />
        </div>
      </Section>

      {/* The promise */}
      <Section className="bg-ink-900">
        <H2 onInk>We take care of the SOPs. You run the site.</H2>
        <ul className="mt-12 grid gap-8 lg:grid-cols-3">
          {[
            ['Your experts', 'spend their time running the site, not typing long documents.'],
            ['Your workers', 'get the right step, at the right time, in plain words.'],
            ['Your managers', 'get a full record of who did what, when, on which version.'],
          ].map(([who, what]) => (
            <li key={who} className="border-t border-ink-700 pt-4">
              <h3 className="text-lg font-semibold text-paper">{who}</h3>
              <p className="mt-1 text-reading text-ink-300">{what}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* How it works */}
      <Section id="how-it-works">
        <Eyebrow>How it works</Eyebrow>
        <H2>From the document on the shelf to a signed-off record</H2>
        <ol className="mt-16 flex flex-col gap-20 lg:gap-28">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? 'lg:order-2' : ''}>
                <p className="font-label text-meta font-semibold text-ink-500">{i + 1} of {STEPS.length}</p>
                <h3 className="mt-1 text-2xl font-semibold lg:text-3xl">{s.title}</h3>
                <div className="mt-4 text-reading text-ink-600">{s.body}</div>
              </div>
              <div>{s.visual}</div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Benefits */}
      <Section className="bg-paper-2">
        <Eyebrow>What changes</Eyebrow>
        <H2>Why manage your SOPs in SOPstart</H2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map(([title, body]) => (
            <li key={title} className="rounded-lg border border-ink-200 bg-paper-1 p-6">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-reading text-ink-600">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* How we start */}
      <Section>
        <Eyebrow>How we start</Eyebrow>
        <H2>Start with one department</H2>
        <p className="mt-4 max-w-2xl text-reading text-ink-600">We work to whatever process your site prefers. Left to us, we suggest three stages, with a checkpoint after each where you decide whether to go on.</p>
        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {STAGES.map(([n, title, body]) => (
            <li key={n} className="rounded-lg border border-ink-200 bg-paper-1 p-6">
              <p className="font-label text-meta font-semibold uppercase text-ink-500">{n}</p>
              <h3 className="mt-1 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-reading text-ink-600">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Who */}
      <Section className="bg-paper-2">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Eyebrow>Who we are</Eyebrow>
            <H2>Built for a gap we kept seeing on worksites</H2>
          </div>
          <div className="text-reading text-ink-600">
            <p>SOPstart is a startup building for industrial and manufacturing sites in New Zealand and Australia. Sites run on SOPs, but the records sit in one place and the way people actually work sits in another.</p>
            <p className="mt-4">Founded by Simon Scott, after 20 years in the commercial FMCG sector across Australia and New Zealand, in commercial finance, key account management and AI engineering.</p>
          </div>
        </div>
      </Section>

      {/* Call to action */}
      <Section className="bg-ink-900">
        <div className="flex flex-col items-center text-center">
          <Wordmark size="hero" onInk />
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
