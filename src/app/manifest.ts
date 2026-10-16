import type { MetadataRoute } from 'next'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf7',
    theme_color: '#18181b',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-192-any-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
