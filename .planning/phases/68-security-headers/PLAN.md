# Phase 68 — Security Headers

**Goal:** sopstart.com sends response headers that stop the common browser-side attacks:
- a Content-Security-Policy that allows only what the app really loads;
- HSTS with preload;
- `frame-ancestors 'none'`;
- `nosniff`, a strict Referrer-Policy and a locked-down Permissions-Policy.

It is promoted from backlog 999.3, whose allowlist was stale (Railway and client OCR are gone).

**Depends on:** Phase 67. It is technically independent, but it goes last so the CSP covers the passkey and MFA screens. **Plan written:** 2026-10-24, without GSD.

## Facts this plan rests on
- No security headers are set today. `next.config.ts` has redirects only, and `src/proxy.ts` is the request proxy (Next 16).
- Fonts are served by the app itself: Inter is self-hosted (ADR-0026), and `next/font/google` downloads Saira at build time. So the CSP needs no font host.
- The browser talks to Supabase directly: REST, Auth (including the passkey and MFA calls from Phases 65 and 66), Realtime over `wss:`, and Storage signed URLs for photos and uploads. Photo previews use `blob:` and `data:`.
- AI calls (OpenAI, Anthropic, Deepgram, Gemini) run on the server. The grep of `src` for browser-side calls is step 1 and decides it.
- Next's inline bootstrap scripts need a nonce, or `'unsafe-inline'`, for `script-src`.

## Decisions
- **D-01:** A **nonce-based CSP** set in `src/proxy.ts`: a nonce per request, passed in the `x-nonce` header and read by the root layout so Next tags its scripts.
  - `script-src 'self' 'nonce-…' 'strict-dynamic'`
  - `style-src 'self' 'unsafe-inline'` (Tailwind and next/font inline styles; style injection is low risk and documented)
  - `img-src 'self' data: blob: https://<project>.supabase.co`
  - `connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co`
  - `font-src 'self'`, `media-src 'self' blob: https://<project>.supabase.co`, `worker-src 'self' blob:`
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`
  - `upgrade-insecure-requests`

  The Supabase host comes from `NEXT_PUBLIC_SUPABASE_URL`, never hard-coded.
- **D-02:** Ship it **Report-Only first**:
  1. One deploy with `Content-Security-Policy-Report-Only` and a `report-uri` that goes to a tiny route `/api/csp-report`. The route logs the blocked directive and URL to the Fly log, without the body or any secrets.
  2. Run the full deployed eval suite once against it.
  3. Read the reports, fix the allowlist, then switch to enforcing in a second deploy.
- **D-03:** The static headers go in `next.config.ts` `headers()` for every path:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), interest-cohort=()`. The camera stays allowed for photo capture.
  - `X-Frame-Options: DENY` for old browsers.
  - `Cross-Origin-Opener-Policy: same-origin`.

  HSTS preload submission (hstspreload.org) is Simon's step after a week clean, because it is hard to undo.
- **D-04:** `includeSubDomains` covers every `*.sopstart.com`. Step 1 confirms each subdomain in Cloudflare DNS serves HTTPS before HSTS ships.

## Steps
1. **Audit.**
   - Grep `src` for browser-side `fetch(`, `new WebSocket`, `<iframe`, `<script`, `eval` / `new Function` and `wasm`, and for external hosts in client components.
   - List the Cloudflare DNS records for sopstart.com through the API, read only.
   - Record what the browser actually reaches.
2. **Static headers** (D-03) in `next.config.ts`. Then run `npm run build` and the bundle gate.
3. **Nonce CSP in the proxy, Report-Only** (D-01, D-02):
   - add `/api/csp-report` with a middleware exemption, since it is header-less;
   - root layout reads the nonce;
   - check the proxy matcher covers pages but not static assets.
4. **Deploy and run the full deployed eval once.**
   - Read the CSP reports (`fly logs`) and screenshots.
   - Fix the allowlist, or the code that broke policy.
5. **Switch to enforcing**, keeping `report-uri`. Deploy and run the full eval again. Read every screenshot, especially login, passkey, MFA, photo capture and the site map.
6. **Same-commit duties:**
   - Write ADR-0030 "Security headers: nonce CSP in the proxy, static headers in next.config".
   - Add a lint `tests/lint/security-headers.spec.ts` to pin each header and the absence of `'unsafe-eval'` and of a bare `*`.
   - Add the `/api/csp-report` route to `journeys.ts` if it is listed (API routes are not), and add a `CAPABILITY-MATRIX.md` note for the public report route.
7. **Check it from outside:** `curl -sI https://sopstart.com` shows every header. Run securityheaders.com through WebFetch and record the grade in the plan's outcome.
8. Mark backlog 999.3 as done-by-68 in `ROADMAP.md` and update the handoff.

## Risks
- **A missed host breaks a screen in production.** Mitigated by Report-Only first, the full eval run, and reading the reports before enforcing.
- **Nonces and caching:** pages with a nonce become dynamic. Most of the app is already dynamic (auth). Check that the welcome page still renders and that no static page is cached with a stale nonce.
- **HSTS preload is close to permanent.** It is not submitted in this phase.
