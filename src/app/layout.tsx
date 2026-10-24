import type { Metadata, Viewport } from 'next'
import { Saira_Semi_Condensed } from 'next/font/google'
import localFont from 'next/font/local'
import { connection } from 'next/server'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'
import './globals.css'

// ADR-0026: self-hosted Inter 4.1 (Latin subset) keeps the cv05 / cv08 / zero safety glyphs Google strips.
const inter = localFont({ src: './fonts/InterVariable.woff2', weight: '100 900', display: 'swap', variable: '--font-inter' })
const saira = Saira_Semi_Condensed({ weight: ['500', '600', '700', '800'], subsets: ['latin'], display: 'swap', variable: '--font-saira' })

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
  // favicon.ico comes from src/app/favicon.ico (file convention)
  icons: {
    icon: [{ url: '/icons/icon-192-any-v2.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon-v2.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Phase 68 / ADR-0030: every page renders per request so its scripts carry that request's CSP nonce
  // (a prerendered page would ship without one, or with a stale one).
  await connection()
  return (
    <html lang="en" className={`${inter.variable} ${saira.variable}`}>
      <body data-theme="paper">
        {children}
        <div id="fuse-layer" aria-hidden="true" className="pointer-events-none fixed inset-0 z-50" />
      </body>
    </html>
  )
}
