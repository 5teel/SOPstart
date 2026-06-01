# Coding Conventions

**Analysis Date:** 2026-06-01

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `WalkthroughStep.tsx`, `NotificationBadge.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAssignedSops.ts`, `usePhotoQueue.ts`)
- Utilities/actions: camelCase (e.g., `auth.ts`, `assignments.ts`, `completions.ts`)
- Stores: camelCase with `Store` suffix (e.g., `walkthrough.ts`, `preview.ts`)
- Validators: camelCase with semantic naming (e.g., `auth.ts`, `blocks.ts`, `completions.ts`)
- Pages: `page.tsx` (Next.js App Router convention)

**Functions:**
- Event handlers: camelCase prefixed with `handle` (e.g., `handleSubmit()`, `handleApprove()`)
- Lifecycle methods: camelCase (e.g., `markStepComplete()`, `markStepAcknowledged()`)
- Utility functions: camelCase (e.g., `matchesSearch()`, `getHighestAckIndex()`)
- Server actions: camelCase with semantic verbs (e.g., `signUpOrganisation()`, `loginWithEmail()`)

**Variables:**
- Local state: camelCase (e.g., `completedSteps`, `acknowledgedSops`, `isAcknowledged`)
- Constants: UPPER_SNAKE_CASE for module-level exports (e.g., `BANNED_PHRASES`, `ALLOWLIST`)
- Store records/maps: lowercase with underscores as separators in keys (e.g., `record<string, string[]>`)
- Booleans: `is*`, `has*`, `can*`, `should*` prefixes (e.g., `isAcknowledged`, `hasLength`)

**Types:**
- Interfaces/types: PascalCase with semantic naming (e.g., `UseAssignedSopsOptions`, `AckTraceEntry`)
- Discriminated union types: lowercase literal values (e.g., `kind: z.literal('hazard')`)
- Zod schemas: PascalCase with `Schema` suffix (e.g., `HazardBlockContentSchema`, `SignOffBlockContentSchema`)
- Database types: Generated from `database.types.ts` using Supabase convention (e.g., `TablesInsert<'table_name'>`)

## Code Style

**Formatting:**
- Tool: Prettier 3.5.3 (configured in `prettier` field of package.json)
- Line width: Standard (typically 80-100 characters)
- Quote style: Single quotes for strings in TypeScript/JavaScript
- Tailwind CSS: prettier-plugin-tailwindcss auto-sorts className attributes alphabetically

**Linting:**
- Tool: ESLint 9 with flat config (`eslint.config.mjs`)
- Config: Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Target: Next.js 16 core web vitals + TypeScript rules
- Strict TypeScript: `strict: true` in tsconfig.json enforces type safety

## Import Organization

**Order:**
1. Next.js/React imports (`import type { Metadata }` for type-only, `import { useEffect }` for runtime)
2. External packages (`@tanstack/react-query`, `zustand`, `zod`, etc.)
3. Internal lib imports (`@/lib/*`)
4. Internal action imports (`@/actions/*`)
5. Internal component imports (`@/components/*`)
6. Internal type imports (`@/types/*`)
7. Internal store imports (`@/stores/*`)
8. Internal hook imports (`@/hooks/*`)
9. Style imports (`.css` files last)

**Path Aliases:**
- `@/*` maps to `./src/*` per `tsconfig.json`
- Always use absolute imports via `@/` alias; never use relative imports like `../../../`
- Supabase clients are imported from `@/lib/supabase/server`, `@/lib/supabase/client`, or `@/lib/supabase/admin`

## Error Handling

**Patterns:**
- Console logging: `console.error(contextString, error)` format (e.g., `console.error('org creation error:', orgError)`)
  - Use descriptive context prefix that identifies the operation and location
  - Include the actual error object for debugging
- Server actions: Return `{ error: string }` or success object, never throw
- Zod validation: Use `.safeParse()` and check `result.success` before accessing `.data`
- Database errors: Check for null/error objects separately (Supabase pattern: `{ data, error }`)
- Rollback pattern: After insert failure, explicitly delete related records with `.delete().eq()` (see `signUpOrganisation` for example)

## Logging

**Framework:** Console (native browser/Node.js `console` object)

**Patterns:**
- Error logging: `console.error('operation context:', error)` — always include context describing what operation failed
- Debug logging: Sparse; used primarily in async parsing operations
- No production log levels (debug, info, warn); all output goes to `console.error` or console output
- Sensitive data: Never log user IDs, email addresses, or API keys; log operation descriptions instead

## Comments

**When to Comment:**
- JSDoc blocks for exported functions, especially server actions
- Comments above complex logic explaining the intent (e.g., Phase references, spec compliance)
- Comments above tests explaining what invariants they enforce
- Block-level comments for architecture decisions (e.g., `// ─────────────────────────────────────` dividers)

**JSDoc/TSDoc:**
- Server actions: Include phase/spec reference (e.g., `// AUTH-01, D-01, D-02, D-03`)
- Public APIs: Document parameters and return types when not obvious from TypeScript
- Example: `export async function signUpOrganisation(formData: {...})` — types make intent clear; no JSDoc required if self-explanatory

## Function Design

**Size:** 
- Aim for functions under 50 lines
- Server actions may be longer due to multi-step database operations with rollback
- Client components split out helper functions (`BrandMark()`, `MenuIcon()`) even within same file

**Parameters:**
- Prefer object parameters over multiple positional params (e.g., `options?: UseAssignedSopsOptions`)
- TypeScript interfaces for function options (e.g., `interface UseAssignedSopsOptions { category?: string; search?: string }`)
- Type annotations always present; never use implicit `any`

**Return Values:**
- Server actions: Return `{ error?: string } & SuccessData` (early return error pattern)
- Hooks: Return typed result object (e.g., `useQuery()` returns `{ data, isLoading, error }`)
- Utilities: Explicit return type annotations (e.g., `function getHighestAckIndex(...): number`)

## Module Design

**Exports:**
- Server actions: Named exports, no default exports (e.g., `export async function signUpOrganisation()`)
- Components: Default export for the main component, named exports for subcomponents
- Hooks: Named exports (e.g., `export function useAssignedSops()`)
- Stores: Named export of store instance (e.g., `export const useWalkthroughStore = create<WalkthroughState>(...)`)
- Validators: Named exports of Zod schemas and inferred types (e.g., `export const HazardBlockContentSchema = ...`)

**Barrel Files:**
- Used sparingly in `src/components/` for component groups (e.g., `src/components/sop/index.ts`)
- Not used for actions, hooks, or stores to avoid circular dependencies
- Document exports clearly in index files

**Server vs Client Boundaries:**
- `'use server'` at top of file for server actions (e.g., `src/actions/*.ts`)
- `'use client'` at top of file for client components, hooks, and stores
- Never mix server and client code in the same file
- Server actions imported into client components work automatically (Next.js handles the boundary)

## Dark Theme Default

**Style Variables:**
- Base: `bg-steel-900` for backgrounds, `text-brand-yellow` for accent text
- Theme declared as `data-theme="paper"` in root `<body>` tag (see `src/app/layout.tsx`)
- Custom theme CSS in `src/styles/blueprint-theme.css` defines semantic color palette
- Tailwind config extends with custom theme tokens (e.g., `--ink-900`, `--ink-500`)
- All UI text and backgrounds must contrast against dark backgrounds

**Accessibility:**
- Large tap targets (≥44px for mobile) — PWA-first design
- Custom color palette respects WCAG contrast ratios for dark theme
- Theme switching via next-themes (dark theme is default, not user preference)

## Supabase RLS & Clients

**Pattern:**
- All data access uses Supabase RLS policies — no client-side authorization filtering
- Client code uses `createClient()` from `@/lib/supabase/client` (anon key)
- Server actions use `createClient()` from `@/lib/supabase/server` (session auth)
- Elevated operations (org setup, user creation) use `createAdminClient()` from `@/lib/supabase/admin` (service role key)
- RLS policies enforce data isolation; queries that should return empty do so silently

## Block Content Validation

**Pattern:**
- All block content validated via Zod discriminated-union schemas in `src/lib/validators/blocks.ts`
- Server actions call `BlockContentSchema.parse(content)` before any database insert
- Type-safe discriminated unions: `kind` field determines the content shape at compile time
- Example block types: `hazard`, `ppe`, `step`, `emergency`, `custom`, `measurement`, `decision`, `escalate`, `signoff`, `zone`, `inspect`, `voicenote`, `text`, `heading`, `photo`, `callout`, `model`

---

*Convention analysis: 2026-06-01*
