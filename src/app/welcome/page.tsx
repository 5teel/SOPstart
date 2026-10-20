import type { Metadata } from 'next'
import { PromoReel } from '@/components/welcome/PromoReel'
import { Homepage } from '@/components/welcome/Homepage'

export const metadata: Metadata = {
  title: 'SOPstart: every procedure, where the work happens',
  description: 'SOPstart converts your SOPs into clear, step-by-step procedures on a map of your site, with hazards first, photos, sign-off and a record of every run.',
}

/** The signed-out front door: the promo reel as the hero, then the homepage. Public in the session proxy. */
export default function Welcome() {
  return (
    <main>
      <PromoReel />
      <Homepage />
    </main>
  )
}
