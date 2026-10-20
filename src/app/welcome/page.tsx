import type { Metadata } from 'next'
import { Homepage } from '@/components/welcome/Homepage'

export const metadata: Metadata = {
  title: 'SOPstart: every procedure, where the work happens',
  description: 'SOPs, PMs, lockout / tagout, safety meetings and permits to work for industrial sites: accessible to everyone, accountable, fully tracked and securely managed.',
}

/** The signed-out front door: one page, brandmark left, story right. Public in the session proxy. */
export default function Welcome() {
  return <Homepage />
}
