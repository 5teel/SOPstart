import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  // 'canvas' (Phase 26 / Plan 26-05, D-03): Konva's node fallback. Externalizing
  // keeps `next build --webpack` from trying to bundle the native `canvas` module
  // (Pitfall 5: "Module not found: Can't resolve 'canvas'"). react-konva is only
  // reached via dynamic({ ssr:false }) from admin builder-v2 — never the worker tier.
  serverExternalPackages: ['officeparser', 'file-type', 'sharp', '@anthropic-ai/sdk', 'ffmpeg-static', 'canvas'],
  /**
   * Phase 21 D-21-12 — Legacy `/admin/sops/[sopId]/review` route is retired
   * and replaced by the full Phase 12 builder + Phase 21 source viewer at
   * `/admin/sops/builder/[sopId]`. Server-side 308 keeps bookmarks alive
   * AND preserves any `?from=pipeline&pipelineId=...` search params (Next
   * 308 redirects forward the query string by default).
   */
  async redirects() {
    return [
      {
        source: '/admin/sops/:sopId/review',
        destination: '/admin/sops/builder/:sopId',
        permanent: true,
      },
    ]
  },
}

export default withSerwist(nextConfig)
