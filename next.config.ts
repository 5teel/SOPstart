import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 'canvas' (Phase 26 / Plan 26-05, D-03): Konva's node fallback. Externalizing
  // keeps `next build --webpack` from trying to bundle the native `canvas` module
  // (Pitfall 5: "Module not found: Can't resolve 'canvas'"). react-konva is only
  // reached via dynamic({ ssr:false }) from admin builder-v2 — never the worker tier.
  serverExternalPackages: ['officeparser', 'file-type', 'sharp', '@anthropic-ai/sdk', 'ffmpeg-static', 'canvas'],
  /**
   * One shared chunk for Next's next/dynamic runtime (fix(53), SB-LINE-06).
   * Left to the default heuristics it rode along in whichever vendors chunk
   * happened to share its route set; once a new route changed that set, the
   * runtime fell under minSize as a shared group and was
   * copied into a per-route vendors chunk on every next/dynamic route
   * (/sops, /sops/[sopId], builder, activity, api/schema). Pinning it here
   * keeps one copy no matter which routes are added later.
   */
  webpack(config, { isServer }) {
    const split = config.optimization?.splitChunks
    if (!isServer && split && split.cacheGroups) {
      split.cacheGroups.nextDynamic = {
        test: /[\\/]node_modules[\\/]next[\\/]dist[\\/](?:esm[\\/])?(?:shared[\\/]lib[\\/](?:app-dynamic|lazy-dynamic[\\/])|api[\\/]app-dynamic)/,
        name: 'next-dynamic',
        chunks: 'all',
        priority: 20,
        enforce: true,
      }
    }
    return config
  },
  /**
   * Phase 21 D-21-12 — Legacy `/admin/sops/[sopId]/review` route is retired
   * and replaced by the full Phase 12 builder + Phase 21 source viewer at
   * `/admin/sops/builder/[sopId]`. Server-side 308 keeps bookmarks alive
   * AND preserves any `?from=pipeline&pipelineId=...` search params (Next
   * 308 redirects forward the query string by default).
   *
   * Phase 43 (D-01) — the two page-level legacy shims (`/admin/governance`,
   * `/admin/sops`) are deleted; these two entries take over bookmark
   * compatibility. Next forwards the query string on a redirect, so old
   * status / owner / filter / departments / collection / sop bookmarks
   * arrive at the target intact, and the legacy attention view is carried
   * the rest of the way to the governance inbox by the middleware (it
   * matches `/sops?view=attention` after this hop). Each destination runs
   * its own guard, so no access control is lost by removing the shims'
   * page-level checks. Not permanent, so browsers never cache a legacy
   * mapping. Destinations are fixed strings, never built from request
   * input (T-43-02).
   */
  async redirects() {
    return [
      {
        source: '/admin/sops/:sopId/review',
        destination: '/admin/sops/builder/:sopId',
        permanent: true,
      },
      {
        source: '/admin/governance',
        destination: '/governance',
        permanent: false,
      },
      {
        source: '/admin/sops',
        destination: '/sops',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
