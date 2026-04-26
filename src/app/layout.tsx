import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider'
import './globals.css'
import '../styles/blueprint-theme.css'

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SiteThemeProvider>
            {children}
          </SiteThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
