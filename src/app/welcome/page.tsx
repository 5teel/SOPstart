import type { Metadata } from 'next'
import { PromoReel } from '@/components/welcome/PromoReel'

export const metadata: Metadata = {
  title: 'SOPstart: every procedure, where the work happens',
  description: 'Standard operating procedures linked to your machines, in one consistent shape, with photos and AI-supported building.',
}

/** The signed-out front door: a promo reel over a template site. Public in the session proxy. */
export default function Welcome() {
  return <PromoReel />
}
