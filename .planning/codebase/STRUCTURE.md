# Codebase Structure

**Analysis Date:** 2026-06-01

## Directory Layout

```
src/
├── app/                          # Next.js 16 App Router
│   ├── layout.tsx               # Root layout (metadata, theme)
│   ├── (auth)/                  # Public auth routes (unprotected)
│   │   ├── layout.tsx           # Centered auth layout wrapper
│   │   ├── login/               # Email/password form
│   │   ├── sign-up/             # Static invitation-only notice
│   │   ├── join/                # Join org with code
│   │   └── invite/accept/       # Magic-link accept
│   │
│   ├── (protected)/             # Authenticated routes (gated by middleware)
│   │   ├── layout.tsx           # Protected layout: header, nav, main, bottom bar
│   │   ├── dashboard/           # Role-based home (admin tiles, role redirects)
│   │   ├── sops/                # Worker SOP library view
│   │   │   ├── page.tsx         # SOP list/search
│   │   │   └── [sopId]/         # SOP detail, walkthrough switcher
│   │   │       └── page.tsx     # Tab nav (overview, tools, hazards, walkthrough)
│   │   │
│   │   ├── activity/            # Supervisor completion review
│   │   │   ├── page.tsx         # Completion list
│   │   │   └── [completionId]/  # Detail view (step data, photos, sign-off form)
│   │   │
│   │   ├── admin/               # SOP Admin routes
│   │   │   ├── sops/            # SOP library management
│   │   │   │   ├── page.tsx     # Published SOPs (search, filter, versions)
│   │   │   │   ├── upload/      # File upload entry point
│   │   │   │   ├── new/         # SOP creation routes
│   │   │   │   │   ├── ai/      # Create from prompt (Claude)
│   │   │   │   │   └── blank/   # Create blank SOP
│   │   │   │   ├── builder/[sopId]/ # Puck visual editor
│   │   │   │   ├── [sopId]/     # SOP detail menu
│   │   │   │   │   ├── assign/  # Assign to roles/trades
│   │   │   │   │   ├── versions/ # Version history
│   │   │   │   └── pipeline/[pipelineId]/ # Parsing job detail
│   │   │   │
│   │   │   └── team/            # Org member management
│   │   │
│   │   └── profile/             # User profile / settings
│   │
│   ├── api/                     # API routes
│   │   ├── schema/              # Public schema introspection (no RLS)
│   │   └── sops/                # SOP-related endpoints
│   │       ├── parse/           # Async document parsing (300s timeout)
│   │       ├── pipeline/        # Parse job management
│   │       ├── transcribe/      # Audio transcription
│   │       ├── restructure/     # Restructure SOPs via AI
│   │       ├── ai-prompt/       # AI prompt suggestions
│   │       │
│   │       └── [sopId]/         # SOP-specific endpoints
│   │           ├── sections/    # Section CRUD
│   │           ├── publish/     # Publish workflow
│   │           ├── assignments/ # Get assigned users
│   │           ├── parse-job/   # Query parse job status
│   │           ├── download-url/ # Presigned download URL
│   │           └── ai-reviewer/ # AI review suggestions
│
├── actions/                     # Server Actions (mutations)
│   ├── sops.ts                  # SOP CRUD, upload, versioning
│   ├── completions.ts           # Submit, sign-off, photo uploads
│   ├── blocks.ts                # Block library CRUD
│   ├── assignments.ts           # SOP assignment operations
│   ├── sections.ts              # Section reordering, creation
│   ├── sop-section-blocks.ts   # Block-level operations in builder
│   ├── auth.ts                  # Auth mutations (join, invite)
│   ├── sub-trades.ts            # Trade/role assignments
│   ├── versioning.ts            # SOP version management
│   ├── escalation.ts            # Escalation workflows
│   ├── walkthrough-progress.ts  # Walkthrough state sync
│   └── introspection.ts         # Schema introspection
│
├── components/                  # React UI components
│   ├── layout/                  # App shell components
│   │   ├── TopHeader.tsx        # Top nav, breadcrumbs
│   │   ├── BottomTabBar.tsx     # Mobile bottom nav
│   │   └── RouteTransition.tsx  # Page transition animation
│   │
│   ├── auth/                    # Auth forms
│   │   ├── LoginForm.tsx
│   │   └── JoinForm.tsx
│   │
│   ├── sop/                     # SOP display & walkthrough
│   │   ├── blocks/              # Block renderers
│   │   │   ├── TextBlock.tsx
│   │   │   ├── PhotoBlock.tsx
│   │   │   ├── CalloutBlock.tsx
│   │   │   ├── MeasurementBlock.tsx
│   │   │   ├── DecisionBlock.tsx
│   │   │   ├── EscalateBlock.tsx
│   │   │   ├── SignOffBlock.tsx
│   │   │   ├── VoiceNoteBlock.tsx   # Inert placeholder (voice capture removed in Phase 55)
│   │   │   ├── StepWithPhotosBlock.tsx
│   │   │   ├── PhotoGridBlock.tsx
│   │   │   └── index.ts         # Barrel export
│   │   │
│   │   ├── walkthrough/         # Walkthrough-specific UI
│   │   │   ├── WalkthroughSwitcher.tsx # Viewport router (mobile/desktop)
│   │   │   ├── MobileWalkthrough.tsx # Phone-optimized view
│   │   │   ├── DesktopWalkthrough.tsx # Full-width layout
│   │   │   ├── ImmersiveStepCard.tsx # Step card with photos
│   │   │   └── ViewModeToggle.tsx # Read vs walkthrough mode
│   │   │
│   │   ├── tabs/                # SOP tab panels
│   │   │   ├── OverviewTab.tsx  # Metadata, description
│   │   │   ├── ToolsTab.tsx     # Tools list
│   │   │   ├── HazardsTab.tsx   # Hazards, PPE, cautions
│   │   │   ├── ModelTab.tsx     # 3D model viewer
│   │   │   └── index.ts
│   │   │
│   │   ├── SopTabNav.tsx        # Tab navigation (overview, tools, hazards...)
│   │   ├── WorkerPreviewToggle.tsx # Read/walkthrough mode switch
│   │   ├── SopSearchInput.tsx  # Search bar
│   │   ├── SopLibraryCard.tsx  # Card component for SOP list
│   │   ├── StepItem.tsx        # Individual step renderer
│   │   ├── SectionContent.tsx  # Section layout
│   │   ├── LayoutRenderer.tsx  # Puck layout renderer
│   │   ├── SafetyAcknowledgement.tsx # Safety check modal
│   │   └── CategoryBottomSheet.tsx # Category filter UI
│   │
│   ├── admin/                   # Admin-specific components
│   │   ├── sops/                # SOP management
│   │   │   ├── SopLibraryView.tsx # Published list
│   │   │   ├── SopBuilderHost.tsx # Puck editor wrapper
│   │   │   ├── AssignmentPanel.tsx
│   │   │   └── VersionHistory.tsx
│   │   │
│   │   ├── verify-checklist/    # Pre-publish verification
│   │   │   └── PublishGate.tsx
│   │   │
│   │   ├── source-viewer/       # Parse provenance UI
│   │   │   └── SourceMap.tsx
│   │   │
│   │   └── ai-reviewer/         # AI suggestions
│   │       └── ReviewSuggestions.tsx
│   │
│   ├── activity/                # Completion tracking
│   │   ├── CompletionList.tsx   # Table of completions
│   │   ├── CompletionDetail.tsx # Sign-off form
│   │   └── PhotoGallery.tsx     # Step photos
│   │
│   ├── providers/               # React context providers
│   │   └── QueryProvider.tsx    # TanStack React Query setup
│   │
│   ├── ui/                      # Generic UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── ... (shadcn-like components)
│   │
│   └── profile/                 # User profile components
│
├── hooks/                       # Custom React hooks
│   ├── useSopDetail.ts          # Fetch single SOP (Supabase)
│   ├── useCompletions.ts        # Fetch supervisor completions
│   ├── useNotifications.ts      # Fetch user notifications
│   ├── useViewport.ts           # Mobile vs desktop viewport detection
│   ├── useBuilderAutosave.ts    # Builder draft autosave
│
├── stores/                      # Zustand client stores (ephemeral state)
│   ├── walkthrough.ts           # Step completion, ack trace, locked steps
│   ├── completionStore.ts       # Photo queue, submission state
│   ├── preview.ts               # Worker preview mode toggle
│   └── walkthroughMode.ts       # Tab state (read vs walkthrough)
│
├── lib/                         # Shared utilities
│   ├── supabase/                # Supabase client instantiation
│   │   ├── client.ts            # Anon client (client component)
│   │   ├── server.ts            # Session client (server action)
│   │   ├── admin.ts             # Service-role client (server action only)
│   │   └── middleware.ts        # Session update middleware
│   │
│   ├── validators/              # Zod input schemas
│   │   ├── sop.ts               # SOP upload, parsing, schemas
│   │   ├── blocks.ts            # BlockContent union schema
│   │   ├── completions.ts       # Completion submission schema
│   │   ├── auth.ts              # Auth input schemas
│   │   ├── sub-trades.ts        # Trade assignment schemas
│   │
│   ├── parsers/                 # Document parsing pipeline
│   │   ├── extract-docx.ts      # Word extraction (legacy)
│   │   ├── extract-docx-structural.ts # Word extraction (structural)
│   │   ├── extract-pdf.ts       # PDF text extraction
│   │   ├── extract-image.ts     # Image to text (OCR prep)
│   │   ├── extract-xlsx.ts      # Excel extraction
│   │   ├── extract-pptx.ts      # PowerPoint extraction
│   │   ├── extract-txt.ts       # Plain text
│   │   ├── extract-video-audio.ts # Video → audio
│   │   ├── gpt-parser.ts        # GPT structured output (sections/steps)
│   │   ├── ocr-fallback.ts      # Tesseract OCR
│   │   ├── parsed-sop-to-layout-data.ts # ParsedSop → Puck blocks
│   │   ├── image-uploader.ts    # Bulk image upload to Storage
│   │   ├── parse-pipeline.ts    # Job orchestration
│   │   ├── transcribe-audio.ts  # Deepgram/Whisper transcription
│   │   ├── structural-doc.ts    # Document structure models
│   │   ├── structured-doc-to-prompt.ts # Doc → GPT prompt
│   │   ├── verify-sop.ts        # Post-parse verification
│   │   │
│   │   ├── source-viewer/       # Parse provenance tracking
│   │   │   ├── extract-docx-anchors.ts
│   │   │   └── extract-pdf-bbox.ts
│   │   │
│   │   ├── ai-reviewer/         # AI review suggestions
│   │   │   ├── jobs/            # Job management
│   │   │   ├── orchestrator.ts  # Review workflow
│   │   │   └── batch.ts         # Batch suggestion generation
│   │   │
│   │   └── __tests__/           # Parser unit tests
│   │
│   ├── builder/                 # Puck builder integration
│   │   ├── diff-block-content.ts # Block change detection
│   │   ├── match-blocks.ts      # Block matching logic
│   │   └── ... (builder utilities)
│   │
│   ├── sections/                # Section utilities
│   │   ├── reorder.ts
│   │   └── bulk-edit.ts
│   │
│   ├── sop/                     # SOP utilities
│   │   └── versioning.ts        # Version comparison
│   │
│   ├── auth/                    # Auth utilities
│   │   ├── jwt-parser.ts        # JWT claims extraction
│   │   └── roles.ts             # Role checking helpers
│   │
│   ├── photo/                   # Photo utilities
│   │   └── compress.ts          # Browser-side photo compression
│   │
│   └── constants.ts             # App constants (PRODUCT_NAME, etc.)
│
└── types/                       # TypeScript type definitions
    ├── sop.ts                   # Sop, SopSection, SopStep, SopImage, ParseJob
    ├── auth.ts                  # User, Organisation, Role types
    ├── database.types.ts        # Auto-generated Supabase types (don't edit)
    └── ... (feature-specific types)
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router file-based routing
- Contains: Route groups `(auth)`, `(protected)`, API routes under `api/`, layout wrappers, page components
- Key files: `layout.tsx` (root), `(protected)/layout.tsx` (shell with nav), route pages

**`src/actions/`:**
- Purpose: Server-side mutation handlers (encapsulate auth, RLS checks, validation)
- Contains: One file per feature domain (sops, completions, blocks, auth, etc.)
- Key files: `sops.ts` (upload/create), `completions.ts` (submit/sign-off), `blocks.ts` (library CRUD)
- Pattern: Each function is `'use server'` exported; accepts user input, returns success/error object

**`src/components/`:**
- Purpose: React component tree
- Contains: Page layouts, feature-specific UI trees, reusable primitives
- Key subdirs: `sop/` (walkthrough, blocks, tabs), `admin/` (builders, menus), `activity/` (completion UI), `layout/` (shell)
- Pattern: One component per file; index.ts as barrel exports in feature folders

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching and lifecycle management
- Contains: Hooks that wrap React Query queries, Zustand store access, API calls
- Key files: `useSopDetail`, `useCompletions`
- Pattern: Hooks follow React Query conventions; return `{ data, isLoading, isError }`

**`src/stores/`:**
- Purpose: Ephemeral client-side state (Zustand)
- Contains: One Zustand store per feature (walkthrough progress, completion form)
- Key files: `walkthrough.ts`, `completionStore.ts`
- Pattern: Export single `use<Feature>Store` hook; call from components with `const state = useStore()`

**`src/lib/supabase/`:**
- Purpose: Supabase client instantiation (different variants for different contexts)
- Contains: `client.ts` (anon, client components), `server.ts` (session, server actions), `admin.ts` (service-role), `middleware.ts` (session gate)
- Pattern: Each file exports a factory function; clients are created fresh per request (server) or once per component (client)

**`src/lib/validators/`:**
- Purpose: Zod input schemas for validation
- Contains: One schema per feature (sop, blocks, completions, auth, etc.)
- Key files: `sop.ts` (ParsedSop, upload schemas), `blocks.ts` (BlockContent union)
- Pattern: Schemas used in server actions with `.safeParse()`, in API routes, and for form validation

**`src/lib/parsers/`:**
- Purpose: Document extraction and SOP parsing pipeline
- Contains: Extractors (DOCX, PDF, images, video), GPT parser, image uploader, OCR fallback
- Key files: `gpt-parser.ts` (main structured parsing), `parsed-sop-to-layout-data.ts` (schema transformation), `extract-docx-structural.ts` (structural extraction)
- Pattern: Each extractor is a pure async function; pipeline orchestrated in `/api/sops/parse/route.ts`

**`src/types/`:**
- Purpose: TypeScript type definitions
- Contains: Domain types (Sop, SopSection, SopStep, User, Organisation), type inference exports
- Key files: `sop.ts` (SOP domain), `database.types.ts` (auto-generated Supabase types)
- Pattern: Types imported from here in components, hooks, actions

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout (metadata, theme, body wrapper)
- `src/app/(protected)/layout.tsx`: Protected layout (header, nav, main, bottom bar)
- `src/app/(auth)/login/page.tsx`: Login entry point
- `src/lib/supabase/middleware.ts`: Session gate (every request)

**Configuration:**
- `package.json`: Dependencies, scripts, Node version
- `tsconfig.json`: TypeScript config (path aliases: `@/*` → `src/`)
- `tailwind.config.ts`: Tailwind theme (dark mode default, design tokens)
- `playwright.config.ts`: Test configuration (integration, E2E projects)

**Core Logic:**
- `src/actions/sops.ts`: SOP creation, upload, versioning
- `src/actions/completions.ts`: Submission, sign-off, photo handling
- `src/app/api/sops/parse/route.ts`: Document parsing pipeline
- `src/hooks/useSopDetail.ts`: SOP fetching (Supabase)
- `src/stores/walkthrough.ts`: Walkthrough state (Zustand)

**Testing:**
- `tests/playwright.config.ts`: Test projects (integration, E2E, lint)
- `tests/integration/`: Integration tests (real DB)
- `tests/e2e/`: End-to-end tests (full flow)
- `tests/lint/`: Linter tests (code constraint enforcement)
- `src/**/__tests__/`: Unit tests (colocated with source)

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `WalkthroughSwitcher.tsx`)
- Utilities/hooks: camelCase (e.g., `useSopDetail.ts`)
- Stores: camelCase + "Store" suffix (e.g., `walkthrough.ts` exports `useWalkthroughStore`)
- Validators: Feature name (e.g., `sop.ts`, `blocks.ts`)
- API routes: Descriptive path (e.g., `/api/sops/parse`, `/api/sops/[sopId]/publish`)

**Directories:**
- Feature folders: lowercase plural (e.g., `sops/`, `completions/`)
- Component folders: Feature name, plural if collection (e.g., `blocks/`, `tabs/`)
- Lib modules: Feature or pattern name (e.g., `supabase/`, `parsers/`)

**Functions & Variables:**
- Functions: camelCase, verb-first for mutations (e.g., `createUploadSession`)
- Hooks: `use` prefix + feature (e.g., `useSopDetail`, `useCompletions`)
- Stores: Feature name exports `use<Feature>Store` (e.g., `walkthrough.ts` → `useWalkthroughStore`)
- Server actions: camelCase, exported as named exports (e.g., `export async function submitCompletion(...)`)
- Types: PascalCase (e.g., `Sop`, `SopWithSections`, `ParsedSop`)

## Where to Add New Code

**New Feature (e.g., SOP categories):**
- Primary code: `src/components/sop/CategoryBottomSheet.tsx` (UI), `src/actions/sops.ts` (mutation), `src/hooks/` (if data fetch needed)
- Tests: `tests/integration/categories.spec.ts` (Playwright integration test)
- Server action: Add function to `src/actions/sops.ts` or new file `src/actions/categories.ts`
- Validator: Add schema to `src/lib/validators/sop.ts`

**New Component/Module:**
- Implementation: `src/components/<feature>/<ComponentName>.tsx`
- Hook (if data fetch): `src/hooks/use<Feature>.ts`
- Store (if ephemeral state): `src/stores/<feature>.ts`
- Type definitions: Add to `src/types/sop.ts` or new file `src/types/<feature>.ts`

**Utilities/Helpers:**
- Shared helpers: `src/lib/<domain>/<utility>.ts` (e.g., `src/lib/auth/roles.ts`)
- Feature-specific: Co-locate in component folder or `src/lib/<feature>/`
- Validators: `src/lib/validators/<feature>.ts`

**API Routes (complex operations):**
- Location: `src/app/api/sops/<operation>/route.ts`
- Pattern: `POST` for mutations, `GET` for reads; use admin client for elevated operations
- Example: Parsing at `src/app/api/sops/parse/route.ts`

**Database/Schema Changes:**
- Migrations: `supabase/migrations/NNNNNN-<description>.sql` (numbered sequentially)
- Pattern: Use `CREATE TABLE IF NOT EXISTS`, add RLS policies, document constraints
- Sync with local: `supabase db pull` after creating migration in console

## Special Directories

**`supabase/`:**
- Purpose: Database migrations and auth config
- Generated: No (migrations are hand-written)
- Committed: Yes (all migrations)
- Content: `migrations/` folder with numbered SQL files, `config.toml` (local dev config)

**`.planning/`:**
- Purpose: Planning and analysis documents
- Generated: By GSD commands and executor agents
- Committed: Yes (documents), No (intermediate scratch files)
- Content: `codebase/` (ARCHITECTURE.md, STRUCTURE.md, etc.), `phases/`, `spikes/`, `research/`

**`tests/`:**
- Purpose: End-to-end and integration tests
- Generated: No
- Committed: Yes
- Content: `integration/`, `e2e/`, `lint/` folders with `.spec.ts` files

**`.next/`, `node_modules/`, `dist/`:**
- Purpose: Build artifacts
- Generated: Yes (by build process)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-06-01*
