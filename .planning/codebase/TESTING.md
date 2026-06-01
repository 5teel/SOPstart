# Testing Patterns

**Analysis Date:** 2026-06-01

## Test Framework

**Runner:**
- Playwright 1.58.2 (installed as dev dependency)
- Config: `playwright.config.ts` in project root
- Test format: `.spec.ts` and `.test.ts` files

**Assertion Library:**
- Playwright's built-in `expect()` API
- Pattern: `expect(value).toBe()`, `expect(array).toHaveLength()`, etc.

**Run Commands:**
```bash
npm run test              # Run all tests across all projects
npm run test:integration # Integration tests only (rls-isolation, auth-flows)
npm run test:e2e         # E2E tests only (offline-indicator)
```

## Test File Organization

**Location:**
- Integration/E2E specs: `tests/` directory at project root (e.g., `tests/integration/`, `tests/e2e/`, `tests/lint/`)
- Unit tests: Co-located with source (e.g., `src/lib/voice/__tests__/`, `src/lib/parsers/__tests__/`)
- Per-phase stubs: Registered in `playwright.config.ts` projects by phase (Phase 2, Phase 3, Phase 6, etc.)

**Naming:**
- Integration/E2E: `{feature}.spec.ts` (e.g., `walkthrough-store-ack.spec.ts`, `voice-qa-happy-path.spec.ts`)
- Unit tests: `{module}.test.ts` (e.g., `sop-pack.test.ts`, `extract-docx-structural.test.ts`)
- Lint/guard tests: `no-{constraint}.spec.ts` (e.g., `no-bulk-verify-ui.spec.ts`, `no-static-desktop-import.spec.ts`)

**Structure:**
```
tests/
├── integration/         # RLS isolation, auth flows
├── e2e/                # Offline indicator, full user flows
└── lint/               # Code guard checks (repo-wide file walking)

src/lib/voice/__tests__/        # Unit tests for voice QA
src/lib/parsers/__tests__/      # Unit tests for document parsing
src/lib/parsers/ai-reviewer/__tests__/  # AI reviewer tests
```

## Test Structure

**Suite Organization:**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Phase 15 D-21 — walkthrough store ack-trace', () => {
  test.beforeEach(() => {
    // Reset shared state between tests
    useWalkthroughStore.setState({
      completedSteps: {},
      acknowledgedSops: {},
      // ...
    })
  })

  test('markStepAcknowledged appends one entry with stepId + timestamp', () => {
    const before = Date.now()
    useWalkthroughStore.getState().markStepAcknowledged('sop-a', 'step-1')
    const after = Date.now()
    const trace = useWalkthroughStore.getState().getAckTrace('sop-a')
    expect(trace).toHaveLength(1)
    expect(trace[0].stepId).toBe('step-1')
    expect(trace[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(trace[0].timestamp).toBeLessThanOrEqual(after)
  })

  test('idempotent behaviour — repeated calls do not duplicate', () => {
    const s = useWalkthroughStore.getState()
    s.markStepAcknowledged('sop-a', 'step-1')
    s.markStepAcknowledged('sop-a', 'step-1')
    expect(useWalkthroughStore.getState().getAckTrace('sop-a')).toHaveLength(1)
  })
})
```

**Patterns:**
- Setup: `test.beforeEach()` resets singleton state between tests
- Assertions: Inline assertions with descriptive message strings (e.g., `expect(..., 'procedural table count')`)
- Time-based tests: Capture `before` and `after` timestamps, assert value is within range
- Collection tests: Assert length first, then iterate or spot-check specific elements

## Mocking

**Framework:** Playwright's built-in mocking (via `page.route()` for HTTP, `page.on()` for events)

**Patterns:**

For Zustand stores (unit tests):
```typescript
// Direct state mutation for testing
useWalkthroughStore.setState({
  completedSteps: {},
  acknowledgedSops: {},
  lockedSteps: {},
  ackTrace: {},
})
```

For server-side utilities (no mocking needed — direct function calls):
```typescript
// Unit test filesystem-based operations
async function load(name: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(CORPUS_DIR, name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

test('extract-docx-structural — corpus snapshot', async () => {
  const buf = await load('EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx')
  const { doc } = await extractDocxStructural(buf)
  // Assert on real parsed output
})
```

**What to Mock:**
- HTTP requests (via `page.route()` for Playwright E2E)
- External service calls (OpenAI API) — use fixtures/stubs
- Time-dependent code (use `Date.now()` bounds checking, not `jest.useFakeTimers`)

**What NOT to Mock:**
- Zustand store methods (direct state access in unit tests)
- File I/O for corpus tests (load real DOCX files from disk)
- Database queries in RLS tests (use test database with real Supabase)
- Parsing logic (test real parsers against real documents)

## Fixtures and Factories

**Test Data:**

Factory function pattern (type-safe object builders):
```typescript
function makeSop(overrides: Partial<SopWithSections> = {}): SopWithSections {
  const base: SopWithSections = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    organisation_id: 'org-1',
    title: 'ENF4-03-031 Blank Side Hanger',
    // ... 30 more fields with sensible defaults
  }
  return { ...base, ...overrides }
}

test('packSopForPrompt — byte-identical output', () => {
  const sop = makeSop()
  const a = packSopForPrompt(sop)
  const b = packSopForPrompt(sop)
  expect(a).toBe(b)
})
```

**Location:**
- Inline in test files (no separate fixture directory)
- Factory functions at the top of the file, before `test.describe()`
- Real corpus files in `SOPstart - Raw SOPs/` (symlinked during setup, accessed via absolute path in tests)

## Coverage

**Requirements:** None enforced (no minimum threshold)

**View Coverage:**
```bash
# Coverage is not automatically generated — run tests individually
npm run test:integration  # Only integration tests
npm run test:e2e         # Only E2E tests
npm run test             # All tests
```

## Test Types

**Unit Tests:**
- Scope: Individual functions/methods in isolation
- Location: `src/lib/**/__tests__/*.test.ts`
- Examples: `sop-pack.test.ts` (voice QA), `extract-docx-structural.test.ts` (parsing)
- Approach: Load real fixtures (DOCX files), call function, assert output matches expected schema/invariants
- No browser: Tests run in Node.js environment, use Playwright as test runner only

**Integration Tests:**
- Scope: Multiple components/systems working together (RLS policies + auth + database)
- Location: `tests/integration/*.spec.ts`
- Examples: `walkthrough-store-ack.spec.ts`, `auth-flows.spec.ts`, `voice-qa-happy-path.spec.ts`
- Approach: Test Zustand stores directly (Node.js), or simulate user flows (browser)
- Database: Against real test Supabase instance (RLS policies enforced)

**E2E Tests:**
- Scope: Full user workflows through the UI (in browser)
- Location: `tests/e2e/*.spec.ts`
- Examples: `offline-indicator.spec.ts`, `sub-trade-assignment.spec.ts`
- Approach: Use Playwright browser automation, navigate pages, fill forms, assert UI states
- Base URL: `http://localhost:3000` (local dev server or Railway deployed instance)

**Lint/Guard Tests:**
- Scope: Codebase-wide enforcement (no repo-scanning tools; manual grep instead)
- Location: `tests/lint/*.spec.ts`
- Examples: `no-bulk-verify-ui.spec.ts`, `no-static-desktop-import.spec.ts`
- Approach: Walk all `.ts`/`.tsx` files under `src/`, regex-match banned patterns, allowlist exceptions
- Registration: MUST be added to `playwright.config.ts` `testMatch` regex or they never run

## Common Patterns

**Async Testing:**
```typescript
test('markStepAcknowledged appends one entry', () => {
  // No async/await needed for synchronous Zustand methods
  const before = Date.now()
  useWalkthroughStore.getState().markStepAcknowledged('sop-a', 'step-1')
  const after = Date.now()
  expect(before).toBeLessThanOrEqual(after)
})

test('extract-docx-structural loads and parses real DOCX', async () => {
  // Async for file I/O
  const buf = await readFile(join(CORPUS_DIR, 'file.docx'))
  const { doc } = await extractDocxStructural(buf)
  StructuredDocSchema.parse(doc) // Zod validation
})
```

**Error Testing:**
```typescript
test('Zod validates block content shape', () => {
  const result = HazardBlockContentSchema.safeParse({ kind: 'hazard', text: 'test' })
  expect(result.success).toBe(true)
  
  const invalid = HazardBlockContentSchema.safeParse({ kind: 'hazard' }) // missing text
  expect(invalid.success).toBe(false)
  expect(invalid.error.issues).toHaveLength(1)
})
```

**Corpus/Snapshot Testing:**
```typescript
// Hard truths derived from one-time survey — regress if parser changes
const CASES: Array<{ file: string; expect: { proceduralTablesAtLeast: number } }> = [
  { file: 'EN-FOR-03-042 ...docx', expect: { proceduralTablesAtLeast: 3 } },
]

for (const c of CASES) {
  test(c.file, async () => {
    const buf = await load(c.file)
    const { doc } = await extractDocxStructural(buf)
    expect(doc.stats.proceduralTableCount).toBeGreaterThanOrEqual(c.expect.proceduralTablesAtLeast)
  })
}
```

## Phase-Based Test Registration

**Pattern:** Tests are registered in `playwright.config.ts` projects by phase.

Each project specifies:
- `name`: Phase identifier (e.g., `'phase15-stubs'`)
- `testMatch`: Regex to match files belonging to that phase
- `testDir`: Directory to scan (default `./tests`)

Example from `playwright.config.ts`:
```typescript
{
  name: 'phase15-stubs',
  testMatch:
    /(desktop-walkthrough-layout|sequential-ack|voice-qa-happy-path|voice-grounding-scope|sub-trade-rls-backward-compat|sub-trade-assignment|no-static-desktop-import|no-bulk-verify-ui|use-viewport|walkthrough-store-ack)\.spec\.ts$/,
  use: { browserName: 'chromium' },
},
```

**Adding a new phase test:**
1. Create test file: `tests/lint/my-constraint.spec.ts` (or `tests/integration/my-feature.spec.ts`)
2. Add test name to appropriate project `testMatch` regex in `playwright.config.ts`
3. Verify registration: `npx playwright test --list --project=<projectName> | grep <filename>`

## Live Tests vs test.fixme

**Pattern:**
- Use `test()` for features that MUST PASS in the current phase
- Use `test.fixme()` for known failures (unimplemented features)
- Use `test.skip()` to temporarily disable a test
- Comments above test explain what phase/spec it guards (e.g., `// Phase 21-04 — D-21-07 LOCK`)

Example:
```typescript
/**
 * Phase 21 (Plan 21-04) — D-21-07 LOCK: no bulk-verify UI affordance anywhere.
 * Runs LIVE (no test.fixme). Walks every .ts/.tsx file under src/...
 */
test('D-21-07: no bulk-verify UI affordance anywhere in src/', () => {
  const hits = findUserFacingPhrases()
  expect(hits).toEqual([]) // Must pass, not a fixme
})
```

---

*Testing analysis: 2026-06-01*
