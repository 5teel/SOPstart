import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  // officeparser depends on file-type (ESM-only) which cannot be bundled by webpack.
  // Mark it as a server-external package so Next.js requires() it at runtime instead.
  serverExternalPackages: ['officeparser', 'file-type', 'sharp'],
}

export default withSerwist(nextConfig)
