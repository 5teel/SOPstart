import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionContext } from '@/lib/auth/session-context'

export const metadata: Metadata = {
  title: 'New SOP — SOPstart',
  description: 'Pick how to create your SOP: upload a document, draft it with AI, or start blank.',
}

/**
 * Phase 30 (UX-04) — the ONE create entry point.
 *
 * Method picker: 3 tiles, Upload FIRST (Visy interview — most orgs already
 * have SOP documents; create-from-scratch is not the headline). The 3 intake
 * routes below remain the real destinations; every other create button in the
 * app collapses into this screen.
 *
 * "Talk it through" and "Describe it" used to be two tiles pointing at the same
 * route (one with ?mode=voice). They are one tile now: the type-vs-talk fork is
 * a decision about HOW to drive the same AI drafting surface, so it belongs on
 * that surface, not here. /admin/sops/new/ai asks it once, up front, and does
 * not offer a switcher afterwards — switching remounted the other client and
 * discarded whatever had been drafted.
 */

const METHODS: { eyebrow: string; title: string; description: string; href: string }[] = [
  {
    eyebrow: '01 · Document',
    title: 'Upload a document',
    description: 'Drop in an existing Word, PDF, Excel, PowerPoint, photo or video — AI turns it into a structured SOP.',
    href: '/admin/sops/upload',
  },
  {
    eyebrow: '02 · AI draft',
    title: 'Draft it with AI',
    description: 'Type a short brief, or talk it through with an AI interviewer that asks follow-up questions. Either way you get a first version to review in the builder.',
    href: '/admin/sops/new/ai',
  },
  {
    eyebrow: '03 · Manual',
    title: 'Start blank',
    description: 'Build the procedure by hand with the guided wizard.',
    href: '/admin/sops/new/blank',
  },
]

export default async function NewSopMethodPickerPage() {
  // Auth guard — shared per-request session context (JWT verified locally).
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <span className="pill">NEW SOP</span>
        <h1 className="mono text-2xl font-semibold text-[var(--ink-900)] mt-1">How do you want to start?</h1>
        <p className="text-sm text-[var(--ink-500)] mt-1">
          Every path lands in the same builder for review before publish.
        </p>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="blueprint-frame block transition-shadow hover:shadow-[0_0_0_1px_var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
          >
            <p className="mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.08em] mb-2">{m.eyebrow}</p>
            <h3 className="text-base font-semibold text-[var(--ink-900)] mb-1">{m.title}</h3>
            <p className="text-sm text-[var(--ink-500)]">{m.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
