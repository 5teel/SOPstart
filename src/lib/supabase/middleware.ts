import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { roleHome } from '@/lib/auth/role-home'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )
  // getClaims() verifies the JWT locally — the project uses asymmetric ES256
  // signing keys (JWKS live-verified 2026-07-13), so unlike the old getUser()
  // there is NO Supabase network round-trip on every request. Expired tokens
  // are still refreshed first (that path alone hits the network), and the
  // refreshed cookies are written to the response exactly as before.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims ?? null

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/sign-up') || path.startsWith('/join') || path.startsWith('/invite')
  // /api/schema returns SOP data-model metadata (block types, enums,
  // JSON-Schema for layout_data) for AI agents and external integrations.
  // No tenant data, no RLS concerns - deliberately public.
  const isSchemaIntrospection = path === '/api/schema'
  // Cron-invoked route: no session cookies by design. The handler enforces its
  // own CRON_SECRET bearer auth (timing-safe, fails closed 401).
  const isCronRoute = path === '/api/agent-layer/synthesis-sweep'
  // Shotstack completion webhook: no session cookies by design. The handler
  // enforces its own SHOTSTACK_CALLBACK_SECRET query-param auth (fails 401).
  const isShotstackCallback = path === '/api/sops/generate-video/callback'
  const isPublicRoute = path === '/' || isAuthRoute || isSchemaIntrospection || isCronRoute || isShotstackCallback

  if (!isPublicRoute && !claims) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && claims) {
    // UX-01: land each role directly on its home. Role comes from the JWT
    // claim (no DB call in middleware); absent claim → /pending safe default.
    const role = (claims as Record<string, unknown>)['user_role'] as string | undefined
    return NextResponse.redirect(new URL(roleHome(role), request.url))
  }

  return response
}
