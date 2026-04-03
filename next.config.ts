import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  serverExternalPackages: ['officeparser', 'file-type', 'sharp', '@anthropic-ai/sdk'],
}

export default withSerwist(nextConfig)
