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

## Outcome (2026-10-24)

**Shipped and enforced.** sopstart.com sends:
- a per-request nonce Content-Security-Policy (enforced, with `report-uri /api/csp-report`);
- HSTS `max-age=63072000; includeSubDomains; preload`;
- `nosniff`, `strict-origin-when-cross-origin`, a locked-down Permissions-Policy, `X-Frame-Options: DENY` and COOP `same-origin`.

securityheaders.com grades both `https://sopstart.com` (following its redirect) and `/login` **A+**, with no warnings.

**Commits** (master, pushed):

| Commit | What |
|---|---|
| `5c414ed6` | Report-Only deploy. Nonce CSP in `src/proxy.ts` (`src/lib/security/csp.ts`) and `/api/csp-report` with its middleware exemption. Root layout awaits `connection()`. Static headers in `next.config.ts`; the matcher also skips `sw.js` and fonts. ADR-0030, CAPABILITY-MATRIX row, lint guard, deployed eval |
| `40d7d8c3` | Enforced. `src/instrumentation-client.ts` sets Zod jitless. `68-EVAL-report-only.md` |
| this commit | Outcome, ROADMAP tick, 999.3 done, learning |

**Step 1 audit.**
- **Browser-side hosts:** only the app and Supabase.
  - The browser makes no AI calls. The single external URL in client code is a Chrome help link (an `<a>`).
  - There are no `<iframe>`, `<script>`, `dangerouslySetInnerHTML`, `eval` or `new Function` in `src`.
  - `blob:` comes from photo previews, the video preview, CSV and recovery-code downloads, and ffmpeg.
  - The `/verify` TOTP QR is an SVG `data:` URL from Supabase, covered by `img-src data:`.
  - Client wasm: ffmpeg (video SOP upload) runs in a worker served from `_next/static`. That response carries no CSP, so `'wasm-unsafe-eval'` was not added (see follow-ups).
- **Cloudflare DNS** (read only, nothing changed). The records are:
  - apex A/AAAA to Fly;
  - `www` CNAME (proxied) to the old Railway host;
  - `_acme-challenge`, `_fly-ownership` and DKIM TXT, plus MX.

  The only browsable subdomain is `www`. It serves HTTPS: Cloudflare answers with a 301 to `https://sopstart.com/`, and plain HTTP gets a 301 to HTTPS. So `includeSubDomains` shipped.

**Gates.**
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0 on both deploys. Only `/manifest.webmanifest` stays static; every page is ƒ.
- Bundle gate green, baseline not touched:

  | Build | `/sops/[sopId]` | `/` |
  |---|---|---|
  | Report-Only (`5c414ed6`) | 838 KB (baseline 837) | 867 KB (baseline 869) |
  | Enforced (`40d7d8c3`) | 839 KB, Δ +2, within tolerance | 868 KB |

  The +1 KB on the enforced build is Zod's `core.js` riding in the entry chunk through `instrumentation-client.ts`. The first try imported `zod/v4/core` and moved +86 KB (gate red, 923 KB). That try was never committed.
- **Targeted local specs:** `tests/lint` (89, including the new `security-headers.spec.ts`, registered in the `phase15-stubs` regex and checked with `--list`), plus every spec that reads the proxy, middleware, layout or next.config: 580 passed, 6 skipped. The full local suite was **not** run.
- **Local `next start` smoke:**
  - every header is present;
  - 17 script tags carry the response's nonce;
  - `/api/csp-report` answers 204;
  - after the Zod fix, `/welcome` and `/login` load with zero `securitypolicyviolation` events and the email field takes input.

**Deployed evals, full suite, exactly twice.**

| Run | Commit | Result | Report |
|---|---|---|---|
| 1, Report-Only | `5c414ed` | 142 passed, 1 failed. The failure was `SEC-02`: the new eval caught `script-src eval` on `/login` | `68-EVAL-report-only.md` |
| 2, enforced | `40d7d8c` | **143 passed, 0 failed, 0 skipped**. Run after "Deploy to Fly" completed for HEAD | `68-EVAL.md` |

**CSP reports (from `fly logs -a sopstart`).**
- **Report-Only run:** 30 × `script-src eval` and nothing else. The source is Zod 4's `allowsEval` probe, which runs `new Function('')` in a try/catch whenever an object schema is defined. Zod already fell back safely, but every page would report and log a console error.
  - **Fix:** jitless mode set in `src/instrumentation-client.ts` before any app code.
  - **No allowlist change was needed.** Supabase, `data:`, `blob:` and the fonts were all covered.
- **Enforced run:** no violation reports. The only `[csp]` line is SEC-03's own probe, logged as `eval-probe https://example.com/x`, so the query string (`?token=secret`) was stripped as designed.
- **Caveat:** `fly logs` streams and replays only a recent buffer. The window covered 00:21–00:54Z and showed no violation in the enforced run. The last minutes of that run (00:54–00:58Z) were outside what the buffer returned.

**Screenshots read** (enforced run):
- **Login:** `68-login-desktop` (passkey button, form hydrated, typed email shown).
- **Passkey:** `65-passkey-added-desktop`.
- **`/verify`:**
  - `66-verify-enrol-desktop` and `66-verify-codes-desktop`. MFA-01 also asserts the `verify-qr` image is visible.
  - `66-verify-wrong-code-phone`.
- **Sign-in code:** `67-code-shown-desktop` and `67-set-password-phone`.
- **Photo capture:**
  - `58-run-photo-required`;
  - `cut-walk-phone` (sent with 1 photo);
  - `59-signoff-open`: the thumbnail loads from Supabase Storage and `expectThumbnailLoads` passes.
  - `59-signoff-lightbox` shows the tiny seeded fixture image as a dot on black. The eval asserts the lightbox opens; it does not assert the image size.
- **Site map:** `63-home-desktop-map` (admin) and `63-home-phone-map`.
- **Home:** `63-home-worker-desktop`.
- **Welcome:** `welcome-phone-1-intro`.
  - `68-welcome-phone` is the header bar only, because the story fades in after the wordmark. SEC-02 takes it right after load; it is not a CSP fault.
- Saira and Inter render everywhere.

**Outside check.** `curl -sI` on `https://sopstart.com/login` (200), `/profile` (protected, 307 to login) and `/` (307 to `/welcome`) shows HSTS, Permissions-Policy, Referrer-Policy, X-Frame-Options and the CSP on every response. The 200 response also carries `nosniff` and COOP. securityheaders.com: **A+**.

**Deviations from the plan.**

| Plan | What happened | Why |
|---|---|---|
| D-01: the root layout reads an `x-nonce` header | No `x-nonce`. The layout awaits `connection()`, and Next takes the nonce from the CSP request header | Nothing in the app renders its own script. The layout only needs to be dynamic so no page is prerendered without a nonce |
| D-03: `microphone=()` | `microphone=(self)` | The video SOP recorder on `/admin/sops/upload` records sound (`getUserMedia({ audio: true })`) |
| D-01 | `default-src 'self'` added | It covers frames and anything unlisted |
| Extra | No CSP under `next dev` | Its webpack runtime needs eval, which production never allows |
| Extra | `src/instrumentation-client.ts` (Zod jitless) | The only violation the Report-Only run found |
| Extra | `tests/evals/security-headers.eval.ts` (SEC-01..03, signed out, no OTP) | Headers and fresh nonce per response; no violations on welcome and login; report route 204, also when oversized |
| Step 6: journeys.ts | Not touched | API routes are not listed there |
| Step 8: update the handoff | Not done | Simon updates HANDOFF.md |

**Simon's steps.**
- After a clean week, submit sopstart.com at hstspreload.org. It is close to permanent. Any future `*.sopstart.com` host must serve HTTPS from day one.
- `www` still CNAMEs to the old Railway host. Cloudflare redirects it before the origin, so it works, but it could point at the apex.

**Follow-ups.**
- Video SOP upload with client ffmpeg is not covered by any eval under the enforced CSP. If the browser applies a CSP to its worker, it needs `'wasm-unsafe-eval'`, which has to be added with an ADR. Upload one video SOP on sopstart.com to confirm.
- `/api/csp-report` has no rate limit, so anyone can add short lines to the Fly log (ADR-0030 residual).
- `X-Powered-By: Next.js` is still sent (`poweredByHeader: false` would drop it). It doesn't affect the grade.
