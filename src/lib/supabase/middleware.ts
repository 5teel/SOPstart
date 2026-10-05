import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { roleHome } from '@/lib/auth/role-home'
import { safeNextPath } from '@/lib/auth/next-redirect'
import { legacyRedirectFor } from '@/lib/sop/focus-path'

const SOP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  // Build identity for the deployed-site eval runner (scripts/run-evals.mjs):
  // returns only the git SHA Railway injected at build time. No tenant data.
  const isVersionRoute = path === '/api/version'
  // The kill-switch worker must reach signed-out browsers: a redirected
  // service-worker script fails the update check and the old worker stays.
  const isServiceWorkerScript = path === '/sw.js'
  const isPublicRoute = path === '/' || isAuthRoute || isSchemaIntrospection || isCronRoute || isVersionRoute || isServiceWorkerScript

  if (!isPublicRoute && !claims) {
    // Phase 53 PHN-02: preserve the requested path (e.g. a scanned /m/<code>
    // plate) through the login round trip, so a logged-out worker lands back
    // on it after signing in. An API caller has no use for a login page
    // return, so /api/* paths never get a ?next=.
    const loginUrl = new URL('/login', request.url)
    if (!path.startsWith('/api/')) {
      const next = safeNextPath(path + request.nextUrl.search)
      if (next) loginUrl.searchParams.set('next', next)
    }
    return NextResponse.redirect(loginUrl)
  }

  // The worker list page is gone (Phase 57): the one screen at / is the only
  // list of places. Every legacy list address redirects to a fixed
  // destination (the attention view to /governance, the access view to the
  // Access page, anything else to the one screen). Server-side on purpose: a
  // client router.replace fired on mount raced the page's own mount-time
  // server actions, and Next 16.2.1's action queue orphans a server action
  // dispatched while a navigation has discarded another — the router then
  // waits on it forever (fixed upstream in 16.3). CLAUDE.md 2026-09-29.
  // The sop value is appended only when it is a UUID; nothing else from the
  // query reaches the destination, so the redirect cannot be steered offsite.
  if (path === '/sops' || (path === '/governance' && request.nextUrl.searchParams.get('view') === 'library')) {
    const view = request.nextUrl.searchParams.get('view')
    const sop = request.nextUrl.searchParams.get('sop')
    let destination = '/'
    if (path === '/sops' && view === 'attention') destination = '/governance'
    else if (path === '/sops' && view === 'access') {
      destination = sop && SOP_ID.test(sop) ? `/admin/access?sop=${sop}` : '/admin/access'
    }
    const redirect = NextResponse.redirect(new URL(destination, request.url))
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  // Old tabbed SOP addresses (/sops/<uuid>?tab=read|walk) land on the bare focus
  // address; the old builder and versions addresses land on the edit address.
  // Server-side on purpose, same reason as the block above (CLAUDE.md
  // 2026-09-29). legacyRedirectFor is UUID-gated and builds fixed templates, so
  // the destination cannot be steered offsite; the refreshed session cookies
  // ride along.
  if (path.startsWith('/sops/') || path.startsWith('/admin/sops/')) {
    const legacy = legacyRedirectFor(path, request.nextUrl.search)
    if (legacy) {
      const redirect = NextResponse.redirect(new URL(legacy, request.url), 307)
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
      return redirect
    }
  }

  if (isAuthRoute && claims) {
    // UX-01: land each role directly on its home. Role comes from the JWT
    // claim (no DB call in middleware); absent claim → /pending safe default.
    // Phase 53 PHN-02: an already-signed-in visit to /login?next=<safe path>
    // (e.g. from a scanned plate) goes straight there instead of the role home.
    const role = (claims as Record<string, unknown>)['user_role'] as string | undefined
    const next = safeNextPath(request.nextUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(next ?? roleHome(role), request.url))
  }

  return response
}
