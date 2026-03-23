# Stack Research

**Domain:** Multi-tenant SaaS PWA — industrial SOP management with AI document parsing
**Researched:** 2026-03-23
**Confidence:** HIGH (core stack verified via npm, official docs, and multiple 2025 sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.1 | Full-stack React framework + PWA host | App Router + React Server Components reduce client payload for slow industrial WiFi. Turbopack (now stable default in v16) gives 2-5x faster builds. Server Actions simplify file upload handling without a separate API layer. Vercel deployment is zero-config. |
| TypeScript | 5.x (bundled) | Type safety across front and back | Required, not optional. Supabase RLS policies and AI parsing schemas are complex enough that runtime type errors will cause production data bugs. |
| Tailwind CSS | 4.2.2 | Mobile-first utility CSS | Industrial workers use phones with gloves — Tailwind makes it trivial to enforce large touch targets (min-h-16, p-4) project-wide. No switching contexts to a stylesheet. v4 uses CSS-native cascade layers, faster build. |
| Supabase | 2.99.3 (JS client) | Postgres DB + Auth + Storage + Realtime | Single BaaS that covers auth, multi-tenant RLS, file storage (for photos and parsed SOP images), and realtime sync. Eliminates the need for a separate auth service, ORM, file server, and websocket server. RLS + custom JWT claims is the standard pattern for multi-tenant RBAC without application-layer filtering. |
| OpenAI SDK | 6.32.0 | AI document parsing via GPT-4o | GPT-4o with Structured Outputs (JSON Schema response format) achieves 100% schema reliability — critical for turning Word/PDF into structured SOP steps without human cleanup per document. Cheaper and faster than training a custom model for low-volume document ingestion. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Dexie.js | 4.3.0 | IndexedDB abstraction for offline data | Primary offline store for cached SOPs on worker devices. Superior to raw IndexedDB for versioned schema migrations, bulk reads, and reactive queries. Used in the service worker and React components. Every SOP assigned to a worker gets synced here on first load. |
| @serwist/next | 9.5.7 | Service worker / PWA for Next.js App Router | The maintained successor to `next-pwa` (which is abandoned). Serwist is a Workbox fork with active development. Handles precaching of the app shell, runtime caching of SOP assets, and the offline fallback page. Required for installability (home screen PWA) and offline access. |
| mammoth | 1.12.0 | .docx Word document to HTML extraction | Best-in-class .docx parser for Node.js. Converts Word documents (including embedded images and tables) to clean HTML, which then feeds the AI parsing pipeline. TypeScript types included. Works server-side in Next.js Route Handlers. |
| unpdf | 1.4.0 | PDF text extraction (Edge Runtime compatible) | Modern replacement for the unmaintained `pdf-parse`. Works in Vercel Edge Functions and Node.js. Extracts text content from PDF files to feed into the AI parsing pipeline. |
| TanStack Query | 5.95.0 | Server state caching, offline-first fetch | `networkMode: 'offlineFirst'` keeps the last fetched SOPs in memory across navigations. Persisted to IndexedDB via the `createSyncStoragePersister` adapter so cache survives page reloads. Separates server state (SOP data from Supabase) from UI state cleanly. |
| Zustand | 5.0.12 | UI/local state management | Lightweight global state for things TanStack Query doesn't own: current walkthrough step, pending photo queue, offline sync status indicator. Zero boilerplate vs Redux Toolkit — appropriate complexity for this app's UI state. |
| React Hook Form | 7.72.0 | Form state + uncontrolled inputs | Minimal re-renders. Combined with Zod resolver for type-safe schema validation. Used on admin upload forms, sign-off forms, and search inputs. |
| Zod | 4.3.6 | Schema validation and TypeScript inference | Validates AI parser output against the SOP schema before writing to Supabase. Also validates form inputs. Central source of truth for data shape — define once, use in API handlers, client forms, and OpenAI response_format schema simultaneously. |
| @hookform/resolvers | 5.2.2 | Connects Zod schemas to React Hook Form | Glue package — required for the RHF + Zod pattern. |
| sharp | 0.34.5 | Server-side image resizing | Resize and compress photos before storing in Supabase Storage. Workers on factory floors take full-resolution photos — unprocessed these can be 5-10 MB each, which will kill offline sync quotas. Resize to max 1200px and compress to <300 KB on upload. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local development DB, migrations, type generation | Run `supabase gen types typescript` after every schema migration to regenerate DB types. Essential for type-safe Supabase queries. |
| ESLint + `eslint-config-next` | Lint rules aligned with Next.js App Router | Catches common server/client component boundary mistakes (e.g., passing non-serializable props across the boundary). |
| Prettier | Code formatting | Configure with Tailwind plugin to auto-sort class names. Reduces merge conflicts in JSX-heavy component files. |
| Playwright | End-to-end testing | Test offline scenarios with `page.context().setOffline(true)`. Critical to verify the service worker cache is serving the right SOPs when offline. |

---

## Installation

```bash
# Scaffold
npx create-next-app@16 sop-assistant --typescript --tailwind --app --src-dir

# BaaS & data
npm install @supabase/supabase-js@2 @supabase/ssr

# Offline / PWA
npm install @serwist/next serwist dexie

# Server state
npm install @tanstack/react-query

# UI state
npm install zustand

# Forms
npm install react-hook-form zod @hookform/resolvers

# AI + document parsing
npm install openai mammoth unpdf

# Image processing (server-side only)
npm install sharp

# Dev dependencies
npm install -D supabase @types/node eslint-config-next prettier prettier-plugin-tailwindcss @playwright/test
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase (full BaaS) | Firebase / Firestore | If the team already has a Firebase dependency or needs Firestore's document model. Firebase has no RLS equivalent — multi-tenant isolation requires application-layer filtering, which is less safe for SaaS. |
| Supabase (full BaaS) | PlanetScale + Clerk + S3 | Valid stack but 3 vendors instead of 1. Increases billing complexity and operational overhead. Only warranted if you hit Supabase's connection limits (use Supabase's pgBouncer or Supabase pooler before migrating). |
| Next.js 16 App Router | Remix | Remix has excellent form handling and offline/streaming story. Choose Remix if the team has strong Remix expertise. Next.js wins here on ecosystem size, Vercel deployment simplicity, and better Supabase SSR integration patterns. |
| Next.js 16 App Router | Vite + React (SPA) | Only if you want a pure client-side SPA. Loses server-side rendering, Server Actions, and built-in API route support — you'd need a separate API server. Not worth it for this app. |
| Dexie.js | RxDB | RxDB is more powerful (full reactive ORM with sync adapters). Use if SOP conflicts between multiple devices become a real requirement. Dexie is simpler and sufficient for this app's one-writer-per-device model. |
| @serwist/next | Custom Workbox config | Use a custom Workbox setup only if you need caching strategies not covered by Serwist's presets. Serwist is the right level of abstraction for Next.js App Router. Avoid the unmaintained `shadowwalker/next-pwa`. |
| OpenAI GPT-4o | Docling (self-hosted) | Docling (IBM open-source) is excellent for layout-aware PDF parsing at scale. Use it if you process thousands of documents per day and cost is a concern. For v1 at 50-500 SOPs per tenant, GPT-4o's per-request cost is negligible and its semantic understanding is superior for extracting hazard/PPE/step structure. |
| unpdf | pdf-parse | `pdf-parse` is unmaintained and Node.js only. `unpdf` works across Edge and Node.js runtimes and is actively developed. |
| TanStack Query | SWR | SWR is simpler but lacks `networkMode: 'offlineFirst'` and mutation persistence — both are required for this app's offline story. |
| Zustand | Jotai | Jotai is atomic and elegant. Either works. Zustand is slightly more readable for colocated stores (walkthrough state, sync queue state). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `shadowwalker/next-pwa` | Abandoned. Last release in 2022. Multiple open issues with App Router compatibility. Will break. | `@serwist/next` |
| `pdf-parse` | Unmaintained (last published 2019 despite npm activity). Wraps an old internal copy of pdf.js. Will fail on modern Vercel Edge runtime. | `unpdf` |
| `pdfjs-dist` directly | Huge bundle (~3 MB), complex API. You only need text extraction, not PDF rendering. | `unpdf` (which wraps pdfjs-dist but bundles only the extraction subset) |
| Prisma | Prisma does not work with Supabase's connection pooler in serverless deployments without extra configuration. Supabase JS client + Supabase-generated types gives full type safety without an ORM. | Supabase JS client + `supabase gen types` |
| Redux Toolkit | 40+ KB gzipped, boilerplate-heavy. Appropriate for 10+ developer teams on large apps. This app's global UI state is simple enough that Zustand covers it in 3 stores. | Zustand |
| `next-auth` (Auth.js) | Adds session complexity that conflicts with Supabase's own JWT/session system. Double-session management leads to subtle bugs. | Supabase Auth (built-in, handles JWTs, refresh tokens, custom claims via Access Token Hook) |
| Web Periodic Background Sync API | Not supported in Safari/Firefox. Workers on iOS (common in industrial settings) would get no sync trigger. | On-connect sync: listen for `online` event + TanStack Query's `refetchOnReconnect`, plus Supabase Realtime re-subscription on reconnect. |
| Service worker file upload (background fetch) | Background Fetch API has <50% browser support. Uploading photos from the service worker is unreliable on iOS. | Queue photo uploads in Dexie, flush the queue in the React component when `navigator.onLine` is true. |
| Separate Redis layer (for sessions/caching) | Supabase handles sessions; TanStack Query + Dexie handle client caching. A Redis layer adds infra cost and complexity with no benefit at this scale. | Supabase + Dexie + TanStack Query |

---

## Stack Patterns by Variant

**If parsing throughput becomes a bottleneck (>100 documents/day):**
- Move the AI parsing pipeline to a Supabase Edge Function triggered by Storage object creation
- Queue documents in a `parse_jobs` table, process asynchronously
- Because this removes the 10-second Vercel serverless timeout constraint on large PDFs

**If the app needs to run fully on-premise (some industrial clients may require this):**
- Replace Supabase with a self-hosted Supabase instance (Docker Compose)
- Replace OpenAI with a self-hosted model via Ollama (e.g., Llama 3.3 70B) or Azure OpenAI with VNet peering
- Next.js can be self-hosted on any Node.js-capable server

**If photo storage costs become a concern at scale:**
- Move Supabase Storage (which uses S3 under the hood) to Cloudflare R2 (zero egress fees)
- Supabase supports custom S3-compatible storage endpoints
- Keep the same `sharp` preprocessing pipeline on upload

**If RLS performance degrades on large tenants (>100K rows):**
- Add `organization_id` as the leading column on all composite indexes
- Consider per-tenant Postgres schemas (separate schema per org) using Supabase's schema support
- Benchmark with `EXPLAIN ANALYZE` before migrating — properly indexed RLS policies typically add <5 ms overhead

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@serwist/next@9.5.7` | `next@16.x` | Serwist v9 targets Next.js 15+. Do not use with Next.js 14 or earlier. |
| `@supabase/supabase-js@2.x` | `@supabase/ssr@0.x` | Always use `@supabase/ssr` for cookie-based sessions in Next.js App Router. Do not use the legacy `@supabase/auth-helpers-nextjs`. |
| `dexie@4.x` | Modern browsers + iOS 14+ | Dexie v4 requires IndexedDB v2 — available on all browsers released after 2018. iOS 14.5+ is required for reliable IndexedDB transactions inside service workers. |
| `openai@6.x` | Node.js 18+ | Node 18 minimum for the fetch-based HTTP client. Next.js 16 ships with Node 20 in Vercel's runtime. |
| `react-hook-form@7.x` + `zod@4.x` | `@hookform/resolvers@5.x` | Resolvers v5 added Zod v4 support. Do not use resolvers v4 with Zod v4. |
| `unpdf@1.x` | Vercel Edge + Node.js 18+ | Uses ES modules exclusively. Ensure `"type": "module"` in any sub-packages, or use dynamic `import()` within Next.js route handlers. |
| `tailwindcss@4.x` | `next@16.x` | Tailwind v4 replaces `tailwind.config.js` with CSS-based configuration. Follow the Next.js + Tailwind v4 migration guide — the Tailwind PostCSS plugin config has changed. |

---

## Key Architecture Decisions Implied by This Stack

**Multi-tenancy:** `organization_id` column on every tenant-scoped table, enforced by Supabase RLS policies. Roles stored in `app_metadata` (not `user_metadata`) in Supabase Auth. Custom Access Token Hook injects `organization_id` and `role` into the JWT for use in RLS policies without extra DB round-trips.

**Offline model:** SOPs are synced to Dexie on first load and on every successful network response. Workers read exclusively from Dexie. Writes (step completions, photo captures) go to Dexie immediately and are flushed to Supabase when `navigator.onLine` is true. No conflict resolution needed — each worker's completion record is their own.

**AI parsing pipeline:** File uploads (docx/pdf) go to Supabase Storage via a Next.js Server Action. A Route Handler reads the file, extracts text with mammoth (docx) or unpdf (pdf), sends it to OpenAI with a Zod-derived JSON Schema as `response_format`, validates the structured output with Zod, then writes the SOP to Postgres. Confidence scores below 0.7 on any section flag it for admin review.

**Photo capture:** Browser's `<input type="file" accept="image/*" capture="environment">` — no camera library needed for PWA. Photos are resized server-side with sharp before being stored in Supabase Storage. Offline queue sits in Dexie; uploads flush on reconnect.

---

## Sources

- npm registry (live) — `@supabase/supabase-js@2.99.3`, `dexie@4.3.0`, `serwist@9.5.7`, `mammoth@1.12.0`, `unpdf@1.4.0`, `next@16.2.1`, `tailwindcss@4.2.2`, `zustand@5.0.12`, `@tanstack/react-query@5.95.0`, `zod@4.3.6`, `react-hook-form@7.72.0`, `openai@6.32.0` — HIGH confidence, verified 2026-03-23
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Turbopack stable, caching changes, App Router — HIGH confidence
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy patterns — HIGH confidence
- [Supabase Custom Claims RBAC docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — JWT claims for roles — HIGH confidence
- [Serwist Next.js docs](https://serwist.pages.dev/docs/next/getting-started) — Service worker integration — HIGH confidence
- [OpenAI Structured Outputs docs](https://platform.openai.com/docs/guides/structured-outputs) — JSON Schema response format reliability — HIGH confidence
- [unpdf vs pdf-parse vs pdfjs-dist comparison (PkgPulse 2026)](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — PDF library recommendation — MEDIUM confidence (community source, consistent with npm download data)
- [MDN Background Sync API](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — Browser support limitations (Safari no support) — HIGH confidence
- [TanStack Query network mode docs](https://tanstack.com/query/v4/docs/react/guides/network-mode) — `offlineFirst` mode — HIGH confidence
- [Supabase multi-tenancy discussion](https://github.com/orgs/supabase/discussions/1615) — RLS performance patterns — MEDIUM confidence (community)
- [AntStack multi-tenant RLS guide](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — organization_id + JWT claims pattern — MEDIUM confidence

---

*Stack research for: SOP Assistant — multi-tenant SaaS PWA*
*Researched: 2026-03-23*
