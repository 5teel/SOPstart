import type { Metadata, Viewport } from 'next'
import { Saira_Semi_Condensed } from 'next/font/google'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'
import './globals.css'

const saira = Saira_Semi_Condensed({ weight: ['600', '800'], subsets: ['latin'], display: 'swap', variable: '--font-saira' })

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={saira.variable}>
      <body data-theme="paper">
        {children}
        <div id="fuse-layer" aria-hidden="true" className="pointer-events-none fixed inset-0 z-50" />
      </body>
    </html>
  )
}
