import type { Metadata } from 'next'
import { LegalPage } from '@/components/welcome/LegalPage'

export const metadata: Metadata = { title: 'Privacy · SOPstart' }

/** Public, linked from the welcome page. Draft wording: to be checked before a site signs up. */
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="22 October 2026"
      sections={[
        ['Who we are', <p key="p">SOPstart is run by Potenco Pty Ltd. This page explains what we collect when your organisation uses SOPstart, why, and what you can ask of us. It follows the New Zealand Privacy Act 2020 and the Australian Privacy Act 1988.</p>],
        ['What we collect', (
          <ul key="l" className="list-disc pl-5">
            <li>Account details: your name, email address, role and organisation.</li>
            <li>The documents your organisation sends us, and the SOPs made from them.</li>
            <li>Work records: jobs started and finished, ticks, photos, sign-offs and training.</li>
            <li>A log of who did what and when, which cannot be rewritten.</li>
            <li>Cookies needed to keep you signed in, and server logs. No advertising or tracking cookies.</li>
          </ul>
        )],
        ['How we use it', <p key="p">Only to run SOPstart for your organisation and to support it. We do not sell personal information or use it for advertising.</p>],
        ['Who else handles it', (
          <>
            <p>The app and its database are hosted in Sydney, Australia, and data is encrypted in transit and at rest.</p>
            <p>To turn documents and voice notes into SOPs, their content is sent to AI service providers (such as OpenAI and Anthropic), which may process it outside Australia and New Zealand, including in the United States.</p>
          </>
        )],
        ['Who in your organisation sees it', <p key="p">Access follows your role. Workers see their SOPs and their own records, supervisors their team, and admins and safety managers the whole site. Other organisations see nothing.</p>],
        ['How long we keep it', <p key="p">For as long as your organisation uses SOPstart. When an organisation leaves, we delete its data on request, except where the law requires us to keep it.</p>],
        ['Your rights', <p key="p">You can ask to see or correct the personal information we hold about you by emailing us. If you are not happy with our answer, you can complain to the New Zealand Privacy Commissioner or the Australian Information Commissioner (OAIC).</p>],
        ['Changes', <p key="p">If this page changes, the date at the top changes with it.</p>],
      ]}
    />
  )
}
