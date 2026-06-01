# Technology Stack

**Analysis Date:** 2026-06-01

## Languages

**Primary:**
- TypeScript 5 - All source code, type-safe throughout
- JavaScript (React JSX/TSX) - React 19 components

**Secondary:**
- SQL - Supabase migrations and RLS policies
- HTML/CSS - Next.js templates, Tailwind CSS 4

## Runtime

**Environment:**
- Node.js 20+ (pinned in `package.json` engines and `railway.json` nixpacksPlan)
- Browser runtime - Web APIs, Service Workers via Serwist

**Package Manager:**
- npm (v10+) - Lockfile: `package-lock.json` present
- Dev only: `supabase` CLI for local PostgreSQL/Auth/Storage emulation

## Frameworks

**Core:**
- Next.js 16.2.1 (App Router) - Server components, RSC, middleware, API routes
- React 19.2.4 - UI component library with concurrent rendering
- TypeScript 5 - Static type checking, strict mode enabled

**State & Data:**
- TanStack React Query 5.95.2 - Server state management, caching, synchronization
- Zustand 5.0.12 - Client state stores (completion, walkthrough, network, preview)
- @tanstack/query-persist-client-core 5.95.2 - Persistent cache hydration

**Styling:**
- Tailwind CSS 4 (PostCSS plugin) - Utility-first CSS, dark theme default
- lightningcss 1.32.0 - CSS processing backend
- Prettier 3.5.3 + prettier-plugin-tailwindcss - Format and sort Tailwind classes

**Forms & Validation:**
- React Hook Form 7.72.0 - Performant form state, minimal re-renders
- Zod 4.3.6 - Schema validation (auth, sops, blocks, completions, voice queries)
  - Validators in `src/lib/validators/` for all API input
  - Real-time and server-side validation gates

**Build & Dev:**
- @serwist/next 9.5.7 + serwist 9.5.7 - Service Worker (PWA, offline support, precaching)
- @serwist/next/worker - Custom SW (`src/app/sw.ts`) with Serwist runtime caching
- Serwist navigation preload disabled (custom offline fallback at `/~offline`)

**Testing:**
- @playwright/test 1.58.2 - Integration & E2E tests
  - 16 project configurations covering phases 2–21
  - Tests in `tests/` with phase-specific testMatch patterns
  - Config: `playwright.config.ts` — baseURL http://localhost:3000, 30s timeout

**Linting:**
- ESLint 9 - JavaScript/TypeScript linting
- eslint-config-next 16.2.1 - Next.js best practices
- Config: `eslint.config.mjs` (flat config)

**Dev Tools:**
- tsx 4.19.2 - TypeScript script runner (used for `scripts/contract-check.ts`, `scripts/check-bundle-size.ts`)
- Supabase CLI 2.22.6 - Local DB emulation, migrations, auth testing

## Key Dependencies

**Critical (AI & Parsing):**
- openai 6.32.0 - GPT parsing & transcription (document→SOP conversion)
  - API key: `OPENAI_API_KEY`
  - Used in `src/lib/parsers/gpt-parser.ts`
- @anthropic-ai/sdk 0.82.0 - Claude for adversarial SOP verification (ai-reviewer)
  - API key: `ANTHROPIC_API_KEY`
  - Used in `src/lib/parsers/ai-reviewer/`

**File Processing:**
- mammoth 1.12.0 - DOCX → HTML conversion with image extraction
  - Primary DOCX parser: `src/lib/parsers/extract-docx.ts`
- unpdf 1.4.0 - PDF text extraction via pdfjs
  - Parser: `src/lib/parsers/extract-pdf.ts`
  - NOTE: requires fresh Uint8Array per call (DataCloneError workaround)
- tesseract.js 7.0.0 - Optical character recognition (OCR fallback for image-heavy docs)
  - Fallback parser: `src/lib/parsers/ocr-fallback.ts`
- officeparser 6.0.7 - Server-only DOCX/XLSX parsing (server external package)
- @xmldom/xmldom 0.8.11 - XML parsing for DOCX/Office structures

**Media & Video:**
- @ffmpeg/ffmpeg 0.12.15 - Client-side audio/video encoding (browser WASM)
- @ffmpeg/core 0.12.10 - FFmpeg runtime core
- @ffmpeg/util 0.12.2 - FFmpeg utility helpers
- ffmpeg-static 5.3.0 - Server-only FFmpeg binary (for transcription fallback)
- sharp 0.34.5 - Server-only image resizing & optimization
- heic2any 0.0.4 - HEIC/HEIF image conversion (iOS compatibility)
- yet-another-react-lightbox 3.29.2 - Image gallery component

**Archive & Data:**
- jszip 3.10.1 - ZIP file creation/extraction (used for document multi-file archives)
- tus-js-client 4.3.1 - Resumable file uploads (for large SOP documents & videos)

**Database & Auth:**
- @supabase/supabase-js 2.99.3 - Supabase client (Postgres, Auth, Storage, RLS)
- @supabase/ssr 0.6.1 - Server-side session management for Next.js SSR
  - Creates SSR-aware clients: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
  - Session propagation via middleware cookie sync

**Offline & Local Storage:**
- dexie 4.3.0 - IndexedDB wrapper (offline SOP cache, photo queue, layout drafts, voice notes)
  - Schema in `src/lib/offline/db.ts`
  - Tables: sops, sections, steps, images, syncMeta, completions, photoQueue, draftLayouts, voiceNotesQueue, walkthroughProgress
- idb-keyval 6.2.2 - Simple key-value IndexedDB layer (sync engine metadata)

**UI Components & Icons:**
- lucide-react 1.0.1 - Icon library
- cmdk 1.1.1 - Command/combobox UI (for CmdK palette, navigation)
- @puckeditor/core 0.21.2 - Visual layout editor (Phase 12 SOP builder blocks)

**Speech & Voice:**
- (Deepgram API integration via fetch) - Server-only WebSocket streaming transcription
  - API key: `DEEPGRAM_API_KEY` (not NEXT_PUBLIC)
  - Token generation: `src/app/api/voice/token/route.ts`
  - Used in `src/hooks/useDeepgramWebSocket.ts` for real-time transcription during voice capture

**Providers & Infrastructure:**
- React Context Providers:
  - SWRConfig (from `@tanstack/react-query`)
  - SerwistProvider (from `@serwist/next`)
  - ThemeProvider (from `next-themes`)
  - CmdKProvider (custom wrapper around cmdk)

## Configuration

**Environment Variables (see `.env.local.example`):**

Required for all deployments:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Anon key (variable named `PUBLISHABLE_KEY`, not ANON_KEY)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for server actions & admin operations

Required for AI/Parsing:
- `OPENAI_API_KEY` - GPT parsing, transcription
- `ANTHROPIC_API_KEY` - Claude for AI verification

Required for video generation:
- `SHOTSTACK_API_KEY` - Video creation service
- `SHOTSTACK_API_URL` - Sandbox (default) or production endpoint

Required for voice transcription:
- `DEEPGRAM_API_KEY` - Real-time speech-to-text (server-side only)

Optional:
- `NEXT_PUBLIC_MODEL_BLOCK_ENABLED` - 3D model viewer feature flag (default: false)

**Build Configuration:**

- `next.config.ts` - NextConfig with Serwist integration, external packages list, 308 redirect for legacy admin routes
  - `serverExternalPackages` includes: officeparser, file-type, sharp, @anthropic-ai/sdk, ffmpeg-static
  - Service worker disabled in dev mode
- `tsconfig.json` - Strict TypeScript (noEmit, strict: true), path alias `@/*` → `src/*`
- `postcss.config.mjs` - Tailwind CSS 4 PostCSS plugin only
- `eslint.config.mjs` - Flat config using eslint-config-next

**Deployment:**

- `railway.json` - Railway platform configuration
  - Builder: NIXPACKS with Node.js 20 pinned
  - Build: `npm run build --webpack`
  - Start: `next start -p $PORT` (dynamic port binding)
  - Auto-restart on failure (max 3 retries)
  - Health check path: `/`

**Build Scripts:**

- `npm run dev` - `next dev --webpack -p 4200` (local dev on port 4200, webpack for Windows compatibility)
- `npm run build` - Next.js build with webpack; pre-check contract, post-check bundle size
  - Pre: `tsx scripts/contract-check.ts` — validates parser output schemas
  - Post: `tsx scripts/check-bundle-size.ts` — ensures bundle doesn't exceed baseline
- `npm start` - Production start (same port, `-p 4200` for dev, `$PORT` for Railway)
- `npm run lint` - ESLint (flat config)
- `npm run test` - Playwright test suite (all projects)
- `npm run test:integration` - Auth flow + RLS isolation tests
- `npm run test:e2e` - E2E tests (chromium only)
- `npm run contract:check` - Standalone contract validation

**Platform-Specific Workarounds:**

- Windows optional dependencies in `optionalDependencies`:
  - `@tailwindcss/oxide-win32-x64-msvc` — Tailwind CSS 4 Windows WASM
  - `lightningcss-win32-x64-msvc` — LightningCSS Windows build
  - npm gracefully skips unmatched platforms in optionalDependencies; required for Railway Linux builds

## Platform Requirements

**Development:**
- Node.js 20+ (enforced via `engines` in package.json)
- Git (for Supabase migrations)
- npm lockfile sync (checked in)
- Port 4200 available (default dev port)
- Supabase local emulation (via CLI) — optional for offline testing

**Production:**
- Deployment: Railway (auto-deploys from `master` branch)
- Node.js 20+ (pinned in railway.json)
- Supabase Cloud project (Postgres, Auth, Storage, RLS)
- OpenAI API account (for SOP parsing)
- Anthropic API account (for verification)
- Shotstack account (for video generation)
- Deepgram account (for voice transcription)
- FFmpeg runtime (included in Railway via nixPkgs or bundled as static)
- Playwright chromium (for local test execution only; not deployed)

---

*Stack analysis: 2026-06-01*
