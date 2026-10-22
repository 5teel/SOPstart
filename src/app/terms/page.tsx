import type { Metadata } from 'next'
import { LegalPage } from '@/components/welcome/LegalPage'

export const metadata: Metadata = { title: 'Terms · SOPstart' }

/** Public, linked from the welcome page. Draft wording: to be checked before a site signs up. */
export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="22 October 2026"
      sections={[
        ['These terms', <p key="p">SOPstart is run by Potenco Pty Ltd. By using SOPstart you agree to these terms. If your organisation has a separate agreement with us, that agreement comes first.</p>],
        ['Accounts', <p key="p">New accounts are approved before they can see anything. Keep your sign-in details to yourself. Your organisation&apos;s admins decide who joins and what role they have.</p>],
        ['Your content', <p key="p">Your SOPs, documents, photos and records belong to your organisation. You let us store and process them only to run SOPstart for you.</p>],
        ['AI-made SOPs', <p key="p">SOPstart uses AI to turn documents into steps. A converted SOP is a draft until your people check and approve it. Your organisation stays responsible for its procedures being correct and for safe work on site. SOPstart does not replace your health and safety duties.</p>],
        ['Fair use', <p key="p">Do not use SOPstart to break the law, to get at another organisation&apos;s data, or to disrupt the service.</p>],
        ['Availability', <p key="p">We work to keep SOPstart available and your data safe, but we cannot promise it will never be interrupted. Keep a way to work safely if it is.</p>],
        ['Liability', <p key="p">To the extent the law allows, we are not liable for indirect or consequential loss, and our total liability is limited to the fees you paid us in the 12 months before the claim.</p>],
        ['Ending', <p key="p">Your organisation can stop using SOPstart at any time and ask for a copy of its data. We can end an account that breaks these terms.</p>],
      ]}
    />
  )
}
