import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { buildCsp, CSP_HEADER } from '@/lib/security/csp'

export async function proxy(request: NextRequest) {
  // ponytail: no CSP under `next dev` -- its webpack runtime needs eval, which production never allows.
  if (process.env.NODE_ENV !== 'production') return await updateSession(request)
  const csp = buildCsp(Buffer.from(crypto.randomUUID()).toString('base64'), process.env.NEXT_PUBLIC_SUPABASE_URL!)
  const headers = new Headers(request.headers)
  headers.set(CSP_HEADER, csp) // Next tags its inline and chunk scripts with this nonce
  const response = await updateSession(request, headers)
  response.headers.set(CSP_HEADER, csp)
  return response
}

export const config = {
  // Pages and API routes only: static chunks, images, fonts, the kill-switch sw.js and the manifest skip the proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\.js|.*\.(?:png|jpg|webp|ico|svg|webmanifest|woff2?)).*)'],
}
