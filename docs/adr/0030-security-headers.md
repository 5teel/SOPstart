# ADR-0030: Security headers: nonce CSP in the proxy, static headers in next.config

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Simon (Phase 68 plan, 2026-10-24); the calls marked "Claude's call" are overturnable at review
- **Enforced by:** `src/instrumentation-client.ts`, `tests/lint/security-headers.spec.ts` · `tests/evals/security-headers.eval.ts`

## Context
sopstart.com sent no security headers. A Content-Security-Policy stops injected scripts and framing; HSTS stops downgrade
to plain HTTP. Next's App Router writes inline bootstrap scripts, so a CSP without `'unsafe-inline'` needs a nonce per
request. The browser reaches only the app itself and Supabase (REST, Auth including passkeys and MFA, Realtime, Storage
signed URLs). AI calls run on the server. Fonts are self-hosted (ADR-0026; `next/font/google` downloads Saira at build).

## Decision
1. **The CSP is built per request in `src/proxy.ts`** (`buildCsp()` in `src/lib/security/csp.ts`) with a fresh nonce,
   set on the request (Next reads the nonce from it and tags its own scripts) and on the response:
   - `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src 'self' 'unsafe-inline'`;
   - `img-src 'self' data: blob: https://<supabase>`; `connect-src 'self' https://<supabase> wss://<supabase>`;
   - `font-src 'self'`; `media-src 'self' blob: https://<supabase>`; `worker-src 'self' blob:`;
   - `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`;
   - `report-uri /api/csp-report`.

   The Supabase host comes from `NEXT_PUBLIC_SUPABASE_URL`, never a literal. Never `'unsafe-eval'`, never a bare `*`.
2. **Every page renders per request.** The root layout awaits `connection()`, so no page is prerendered with no nonce or a
   stale one. The app was almost all dynamic already (auth); only `/welcome`, `/privacy` and `/terms` changed.
3. **The proxy matcher skips static files** (`_next/static`, `_next/image`, images, fonts, `sw.js`, the manifest).
4. **Static headers in `next.config.ts` `headers()` on every path:** `Strict-Transport-Security: max-age=63072000;
   includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(),
   interest-cohort=()`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`.
5. **`/api/csp-report` is public** (browsers post reports without cookies). It caps the body at 8 KB, logs only the
   blocked directive and the blocked URL without its query string, never the body or cookies, and answers 204.
6. **Report-Only first, then enforced,** with the deployed eval suite run against each.

## Consequences
- `style-src 'unsafe-inline'` stays: Tailwind and next/font inject inline styles. Style injection can restyle a page but
  cannot run code. Accepted residual.
- *Claude's call:* `microphone=(self)`, not `()` as the plan had it: the video SOP recorder on the admin upload page records
  sound with the picture.
- *Claude's call:* no CSP under `next dev`: its webpack runtime evaluates code, which production never allows.
- *Claude's call:* the plan had the root layout read an `x-nonce` header. Nothing in the app renders its own script, so the
  layout only needs to be dynamic; Next takes the nonce from the CSP request header.
- Zod 4 probes for eval (`new Function('')`) whenever an object schema is defined, which the Report-Only run reported on
  every page. `src/instrumentation-client.ts` sets Zod's jitless mode before the app's code, so the probe never runs. It
  imports Zod's `core.js` file directly: the `zod/v4/core` entry put all of Zod (+86 KB) into every page's first chunk.
- HSTS `includeSubDomains` is safe because every `*.sopstart.com` host serves HTTPS (2026-10-24: only `www`, which
  Cloudflare redirects to the apex). A new subdomain must serve HTTPS from day one.
- HSTS preload submission (hstspreload.org) is Simon's step after a clean week; it is close to permanent.
  *Update 2026-10-24:* Simon submitted it the same day (no production users yet, so any breakage marks the cause);
  status "pending". Removal takes months to reach browsers, so `max-age`, `includeSubDomains` and `preload` stay.
- A new browser-side host (an analytics script, a CDN, another API) needs this ADR superseded and `buildCsp()` widened.
- Anyone can add lines to the Fly log through the report route. Lines are short and carry no secrets.
