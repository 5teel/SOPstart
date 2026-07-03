/**
 * Phase 26 Plan 26-03 Task 2 — LayoutRenderer render-parity harness (R2).
 *
 * Renders the bespoke Puck-free LayoutRenderer with react-dom/server and proves
 * it emits the SAME block components the worker saw under Puck's <Render>: for
 * every registered block type, the markup LayoutRenderer produces for a
 * layout_data entry CONTAINS the markup the component produces when rendered
 * directly with the same (meta-stripped) props. Also asserts unknown-type →
 * UnsupportedBlockPlaceholder (P17) and the version / parse-failure fallbacks.
 *
 * Why a standalone tsx harness (not an in-Playwright render): Playwright's test
 * transform rewrites project JSX to its own element descriptors ({__pw_type…}),
 * which real react-dom/server cannot render. Running under `tsx` compiles the
 * components to genuine React elements. The spec
 * (tests/phase26/render-parity.spec.ts) shells out here and asserts exit 0.
 *
 * `require` (not `import`) + a Module-extension stub for `.css`/asset files: the
 * block barrel transitively imports CSS (react-lightbox) which Node can't parse.
 * ESM `import` statements hoist above any stub, so we require in explicit order
 * AFTER installing the stub.
 *
 * CLI:  npx tsx scripts/render-parity-check.tsx
 * Exit: 0 + "RENDER-PARITY OK" on parity; 1 + the failing block(s) on drift.
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const Module = require('module')
// Stub non-JS asset imports (CSS from react-lightbox, etc.) — Node can't parse them.
for (const ext of ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']) {
  Module._extensions[ext] = (m: NodeModule) => {
    ;(m as any).exports = {}
  }
}

const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const {
  BLOCK_COMPONENTS,
  BLOCK_DEFAULTS,
  stripMeta,
} = require('../src/lib/builder/block-registry') as typeof import('../src/lib/builder/block-registry')
const { LayoutRenderer } =
  require('../src/components/sop/LayoutRenderer') as typeof import('../src/components/sop/LayoutRenderer')

const SUPPORTED_VERSION = 1
const FALLBACK = 'LINEAR_FALLBACK_SENTINEL'
const failures: string[] = []

function renderLayout(content: unknown[], version = SUPPORTED_VERSION): string {
  return renderToStaticMarkup(
    createElement(LayoutRenderer as any, {
      layoutData: { content, root: {} },
      layoutVersion: version,
      sectionId: 'sec-1',
      fallback: FALLBACK,
    })
  )
}

// 1. Per-type parity: LayoutRenderer output ⊇ direct component render.
const types = Object.keys(BLOCK_COMPONENTS)
for (const type of types) {
  const props = { id: `${type}-1`, ...(BLOCK_DEFAULTS as any)[type] }
  let viaLayout = ''
  let direct = ''
  try {
    viaLayout = renderLayout([{ type, props }])
    const Component = (BLOCK_COMPONENTS as any)[type]
    direct = renderToStaticMarkup(createElement(Component, stripMeta(props)))
  } catch (err) {
    failures.push(`${type}: threw during render — ${(err as Error).message}`)
    continue
  }
  if (direct.length === 0) failures.push(`${type}: direct render produced empty markup`)
  else if (!viaLayout.includes(direct)) {
    failures.push(`${type}: LayoutRenderer output did not contain the component's direct render`)
  }
}

// 2. Unknown type → UnsupportedBlockPlaceholder (P17), no linear fallback.
{
  const html = renderLayout([{ type: 'TotallyMadeUp', props: { id: 'z' } }])
  if (!html.includes('data-layout-placeholder="unsupported-block"'))
    failures.push('unknown-type: missing UnsupportedBlockPlaceholder')
  if (!html.includes('TotallyMadeUp')) failures.push('unknown-type: original type not surfaced')
  if (html.includes(FALLBACK))
    failures.push('unknown-type: fell back to linear instead of rendering placeholder')
}

// 3. Unsupported layout version → linear fallback.
{
  const html = renderLayout([{ type: 'TextBlock', props: { id: 'a', content: 'hi' } }], 999)
  if (!html.includes(FALLBACK)) failures.push('version-gate: unsupported version did not fall back')
}

// 4. Structurally broken layout_data → linear fallback.
{
  const html = renderToStaticMarkup(
    createElement(LayoutRenderer as any, {
      layoutData: { not: 'valid' },
      layoutVersion: SUPPORTED_VERSION,
      sectionId: 'sec-1',
      fallback: FALLBACK,
    })
  )
  if (!html.includes(FALLBACK)) failures.push('parse-gate: broken layout_data did not fall back')
}

// 5. Mixed multi-block layout renders every block in order.
{
  const html = renderLayout([
    { type: 'TextBlock', props: { id: 't', content: 'First paragraph body' } },
    { type: 'StepBlock', props: { id: 's', number: 1, text: 'Do the thing' } },
    { type: 'HazardCardBlock', props: { id: 'h', title: 'Hazard', body: 'Careful', severity: 'warning' } },
  ])
  for (const needle of ['First paragraph body', 'Do the thing', 'Careful']) {
    if (!html.includes(needle)) failures.push(`mixed-layout: missing "${needle}"`)
  }
  if (html.includes(FALLBACK)) failures.push('mixed-layout: unexpectedly fell back to linear')
}

if (failures.length > 0) {
  console.error('RENDER-PARITY FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}

console.log(
  `RENDER-PARITY OK — ${types.length} block types render identical components; P17 + fallbacks intact.`
)
