import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

export const metadata: Metadata = {
  title: 'How SOPs are improved — SOPstart',
  description: 'The plain-words method SOPstart follows when it turns an uploaded SOP into a clear version.',
}

// ADR-0015 in plain words. The rules themselves live in src/lib/parsers/enhance-rules.ts; when they
// change, change this page in the same commit.

const STAGES: Array<[string, string]> = [
  ['Copy it exactly', 'SOPstart first makes a faithful copy of your document: every line, in the same order, with the same wording strength. This "As written" version is the record. Workers tick steps, take photos and get signed off against it.'],
  ['Rewrite it for the worker', 'A second pass rewrites that copy so a worker at the machine, on a phone, possibly in gloves and possibly reading in a second language, can follow it quickly and safely. This is the "Clear version".'],
  ['Check it with a different AI', 'An AI from a different maker compares the clear version against the faithful copy, line by line, looking for anything lost, changed, softened, reordered or made up.'],
  ['A person approves it', 'Workers only see the clear version after an admin has read it and approved it. If the SOP is converted again, the approval is cleared and it has to be read again.'],
]

const PRIORITIES: Array<[string, string]> = [
  ['Nothing safety-related is lost', 'Every hazard, piece of PPE, number, unit, direction, wait, condition and "do not" in your document must still be there. Things can be moved; nothing can be dropped.'],
  ['Nothing is made up', 'The rewrite never adds a value, tool, method or step your document does not contain. Where something is missing, it is listed for the document owner instead of guessed.'],
  ['Safe order is kept', 'Steps that must happen in order (stop, lock, check, then reach in) keep that order. A step is only moved when your document itself says it should come first, and every move is recorded.'],
  ['Warnings arrive at the moment of danger', 'A hazard is shown on the step where the worker is exposed to it, not pages earlier in a table.'],
  ['Easy to follow', 'Only after all of the above: short steps, plain words and a clear layout.'],
]

const CHANGES: Array<[string, string, string]> = [
  ['One action per step', 'Long steps that bundle several actions are split, in the same order, so nothing gets skipped when ticking off.', '"Press P-Stop. After the red light comes on, pull P-Stop and select Manual" becomes four steps, including "Wait until the red Stop light is ON".'],
  ['Hazards on the step they apply to', 'Each hazard appears as a yellow warning on the step where the danger is, and again at later steps with the same danger. A short list of the job’s hazards sits at the top.', 'A pinch-point warning moves from a table on page 1 to the step that cycles the arm.'],
  ['PPE named in full', '"All PPE" or "standard PPE" is replaced by the actual items your document names anywhere, listed before the work starts.', '"Use all PPE" becomes long heat-resistant gloves, positive-seal safety glasses, hearing protection, safety shoes.'],
  ['A check before hands go in', 'Before any reach-in step, a check lists the safe conditions your document states (lights, barrier down, lock in) so the worker confirms them first.', '"Now it is safe" becomes a tick list of the conditions that make it safe.'],
  ['Every lock has its removal', 'For every lock, barrier or air-off, the rewrite looks for the matching step that undoes it. If your document has none, that is flagged for the owner.', 'A procedure that fits a T-bar lock but never removes it gets an open item.'],
  ['No "see section 3.2"', 'Pointers to other sections are replaced with the actual steps, because a worker in gloves cannot scroll back fifteen pages.', '"Repeat steps 9 to 15" becomes those steps, written out.'],
  ['Alternatives shown as a choice', 'Where your document gives options that rule each other out (blank type, machine type), the worker picks their one from a short table.', 'Two swabbing methods become "Identify your blank type, then use one row".'],
  ['Plain English, same strength', 'Short sentences that start with the action. "Must", "never" and "do not" stay as commands; "should" and "recommended" stay as advice.', '"Lose the screw" becomes "Loosen the screw".'],
  ['Numbers kept exactly, in metric', 'Values, tolerances and directions are never rounded or recalculated. The number comes first, then the action.', '"*c" becomes "°C"; "ACW" becomes "anticlockwise".'],
  ['Non-actions moved out of the steps', 'Background, machine facts and programme statements move to a notes or details section so the numbered steps are only things to do.', '"The bath switches on by timer for about 6 hours a day" moves to "About this machine".'],
  ['Paperwork removed', 'Approval tables, revision history, risk-matrix legends, empty columns and template instructions are dropped. Document code, revision and dates go into one details line.', 'Three pages of sign-off tables disappear; the document code stays.'],
  ['Photos on their step', 'Each photo is placed on the step it shows. Safety text that only appears on a photo label is copied into the step.', 'A label reading "DOES NOT ISOLATE CONTROLS INSIDE" becomes a warning on the isolation step.'],
  ['Grouped by stage', 'Steps are grouped the way the job runs: before you start, make safe, remove, fit, restore and restart, close out.', 'A lockout section buried at the end is linked from the step that needs it.'],
]

const NEVER = [
  'Invent a number, tolerance, tool, lubricant or step.',
  'Turn "should" into "must", or "must" into "should".',
  'Pick the looser of two rules that contradict each other. The stricter one leads, and the conflict goes to the owner.',
  'Reorder steps without a reason your document states, and never without recording it.',
  'Merge two devices into one name unless your document makes clear they are the same thing.',
  'Drop a photo, or caption a photo with more than it shows.',
]

const CHECK = [
  ['Missing', 'a safety fact, number or condition that did not make it across'],
  ['Changed', 'a value, direction or meaning that is different'],
  ['Softened or hardened', 'a command turned into advice, or advice into a command'],
  ['Reordered', 'safe order broken, or a protection moved after the danger it guards'],
  ['Made up', 'anything that is not in the faithful copy'],
]

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-reading font-semibold text-ink-900">{children}</h2>
}

export default async function MethodologyPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!role || !['admin', 'safety_manager'].includes(role)) redirect('/')

  return (
    <div data-testid="methodology" className="mx-auto max-w-3xl px-4 py-8 text-ui text-ink-700">
      <h1 className="text-2xl font-semibold text-ink-900">How SOPstart improves a SOP</h1>
      <p className="mt-2">
        When you upload a SOP, SOPstart keeps two versions side by side: an exact copy of your document, and a clear version
        rewritten for the people who use it. This page explains how the clear version is made and what comes first.
      </p>

      <H2>The four stages</H2>
      <ol className="flex flex-col gap-3">
        {STAGES.map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-lg border border-ink-200 bg-paper-1 p-4">
            <span className="mono text-reading font-semibold text-ink-900">{i + 1}</span>
            <span>
              <b className="block text-ink-900">{t}</b>
              {d}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-meta text-ink-600">
        Starting a SOP always runs the &quot;As written&quot; version. The clear version is for reading.
      </p>

      <H2>What comes first, in order</H2>
      <ol className="flex flex-col gap-2">
        {PRIORITIES.map(([t, d], i) => (
          <li key={t}>
            <b className="text-ink-900">
              {i + 1}. {t}.
            </b>{' '}
            {d}
          </li>
        ))}
      </ol>

      <H2>What the rewrite changes</H2>
      <div className="flex flex-col gap-4">
        {CHANGES.map(([t, d, e]) => (
          <div key={t}>
            <b className="block text-ink-900">{t}</b>
            <p>{d}</p>
            <p className="mt-1 text-meta text-ink-600">For example: {e}</p>
          </div>
        ))}
      </div>

      <H2>What the rewrite never does</H2>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {NEVER.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <H2>Gaps go to the document owner</H2>
      <p>
        Real SOPs often have gaps: a lock that is never removed, PPE that is not named, a restart with no check, two pages that
        disagree. The rewrite does not fill these in. Each one goes on an <b className="text-ink-900">open items</b> list for
        the document owner, naming the step it affects, so a person who knows the site decides.
      </p>

      <H2>The second check</H2>
      <p>A different AI compares the clear version with the exact copy and reports anything:</p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {CHECK.map(([t, d]) => (
          <li key={t}>
            <b className="text-ink-900">{t}</b>: {d}
          </li>
        ))}
      </ul>
      <p className="mt-3">
        Each problem is rated by how much it matters, from &quot;someone could be hurt&quot; down to wording that changes
        nothing about the job. The admin sees the result alongside the clear version before deciding whether to approve it.
      </p>
    </div>
  )
}
