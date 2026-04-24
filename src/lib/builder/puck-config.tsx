import type { Config, Overrides } from '@puckeditor/core'
import type { ReactElement, ReactNode } from 'react'
import {
  TextBlock,
  TextBlockPropsSchema,
  type TextBlockProps,
  HeadingBlock,
  HeadingBlockPropsSchema,
  type HeadingBlockProps,
  PhotoBlock,
  PhotoBlockPropsSchema,
  type PhotoBlockProps,
  CalloutBlock,
  CalloutBlockPropsSchema,
  type CalloutBlockProps,
  StepBlock,
  StepBlockPropsSchema,
  type StepBlockProps,
  HazardCardBlock,
  HazardCardBlockPropsSchema,
  type HazardCardBlockProps,
  PPECardBlock,
  PPECardBlockPropsSchema,
  type PPECardBlockProps,
} from '@/components/sop/blocks'

// Module-level warn-once flags (D-13/D-14: "once per page load")
let warnedPropFail = false
let warnedUnsupportedBlock = false

function warnPropFailOnce(block: string, issues: unknown): void {
  if (!warnedPropFail) {
    console.warn(
      `[layout] invalid props on ${block} - rendering empty state`,
      issues
    )
    warnedPropFail = true
  }
}

function warnUnsupportedBlockOnce(type: string): void {
  if (!warnedUnsupportedBlock) {
    console.warn('[layout] unsupported block type', type)
    warnedUnsupportedBlock = true
  }
}

// D-13: visible placeholder when a layout_data entry references an unknown block
// type. Registered in puckConfig below so sanitizeLayoutContent can rewrite
// unknown-type entries to it BEFORE Puck iterates children.
export function UnsupportedBlockPlaceholder({ type }: { type?: string }): ReactElement {
  return (
    <div
      data-layout-placeholder="unsupported-block"
      className="bg-steel-800 border border-dashed border-steel-500 rounded-xl p-4 text-steel-400 text-sm mb-4"
    >
      This block isn&apos;t supported in your app version - update required
      {type ? ` (${type})` : ''}.
    </div>
  )
}

// Forward-declared registry mirror populated after puckConfig is declared.
// sanitizeLayoutContent consults this to detect unknown block types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puckConfigComponentsRegistry: Record<string, any> = {}

/**
 * D-13 render-time guard. Given the raw `layout_data.content[]` children,
 * replace any entry whose `type` is not a registered component with an
 * `UnsupportedBlockPlaceholder` entry and warn-once. Callable from BOTH the
 * admin (BuilderClient) and worker (LayoutRenderer) code paths before
 * passing data to `<Puck>`/`<Render>`.
 */
export function sanitizeLayoutContent(content: unknown[]): unknown[] {
  return content.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const type = (entry as { type?: string }).type
    if (!type || !(type in puckConfigComponentsRegistry)) {
      if (type) warnUnsupportedBlockOnce(type)
      const existingId = (entry as { props?: { id?: string } }).props?.id
      const id =
        existingId ?? `unsup-${Math.random().toString(36).slice(2, 8)}`
      return {
        type: 'UnsupportedBlockPlaceholder',
        props: { type: type ?? 'unknown', id },
      }
    }
    return entry
  })
}

// D-16: extract the first missing/invalid field name from a Zod error for
// the admin-side red-outline hint. Returns null if no field name can be derived.
function firstMissingField(err: unknown): string | null {
  type ZodIssueLike = {
    path?: Array<string | number>
    code?: string
    message?: string
  }
  const issues = (err as { issues?: ZodIssueLike[] })?.issues
  if (!Array.isArray(issues) || issues.length === 0) return null
  for (const issue of issues) {
    if (issue.code === 'invalid_type' || issue.code === 'too_small') {
      const field = issue.path?.[issue.path.length - 1]
      if (typeof field === 'string' && field.length > 0) return field
    }
  }
  const fallback = issues[0]?.path?.[issues[0]?.path.length - 1]
  return typeof fallback === 'string' ? fallback : null
}

interface PuckContextLike {
  isEditing?: boolean
}

/**
 * Shared safe-render. Zod-parses props, falls back to an empty-state on
 * failure (D-14). In the ADMIN context (Puck's `isEditing === true`), wraps
 * the empty-state in a red-outline container with a prop-level hint (D-16).
 * In the WORKER context, renders the plain empty-state only.
 */
function SafeRender<P>(
  schema: {
    safeParse: (
      p: unknown
    ) => { success: true; data: P } | { success: false; error: unknown }
  },
  Block: (p: P) => ReactNode,
  props: unknown,
  blockName: string,
  emptyState: string,
  puck: PuckContextLike | undefined
): ReactNode {
  const parsed = schema.safeParse(props)
  if (!parsed.success) {
    warnPropFailOnce(blockName, parsed.error)
    const missing = firstMissingField(parsed.error)
    const hint = missing ? `Missing: ${missing}` : emptyState
    const isAdmin = puck?.isEditing === true
    if (isAdmin) {
      return (
        <div
          data-layout-error="true"
          data-block={blockName}
          className="border-2 border-red-500/70 rounded-xl mb-4"
        >
          <div className="bg-red-500/15 text-red-300 text-xs font-mono uppercase tracking-wider px-3 py-1 rounded-t-xl">
            {blockName} - {hint}
          </div>
          <div className="bg-steel-800 border-t-0 rounded-b-xl p-4 text-amber-400 text-sm">
            {emptyState}
          </div>
        </div>
      )
    }
    return (
      <div className="bg-steel-800 border border-dashed border-amber-500/40 rounded-xl p-4 text-amber-400 text-sm mb-4">
        {emptyState}
      </div>
    )
  }
  return Block(parsed.data)
}

// Puck's component render signature is `(props: WithId<WithPuckProps<Props>>) => JSX.Element`
// — `puck` arrives INSIDE props, not as a second argument. Extract it per render.
type RawRenderProps = Record<string, unknown> & {
  puck?: PuckContextLike
}

export const puckConfig: Config = {
  components: {
    TextBlock: {
      fields: {
        content: { type: 'textarea' },
      },
      defaultProps: { content: 'Text content…' } satisfies TextBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              TextBlockPropsSchema,
              TextBlock,
              props,
              'TextBlock',
              'Text block - fix required props',
              puck
            )}
          </>
        )
      },
    },
    HeadingBlock: {
      fields: {
        text: { type: 'text' },
        level: {
          type: 'select',
          options: [
            { label: 'H2', value: 'h2' },
            { label: 'H3', value: 'h3' },
          ],
        },
      },
      defaultProps: {
        text: 'Heading',
        level: 'h2',
      } satisfies HeadingBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              HeadingBlockPropsSchema,
              HeadingBlock,
              props,
              'HeadingBlock',
              'Heading - fix required props',
              puck
            )}
          </>
        )
      },
    },
    PhotoBlock: {
      fields: {
        src: { type: 'text' },
        alt: { type: 'text' },
        caption: { type: 'text' },
      },
      defaultProps: {
        src: null,
        alt: '',
        caption: '',
      } satisfies PhotoBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              PhotoBlockPropsSchema,
              PhotoBlock,
              props,
              'PhotoBlock',
              'Photo - fix required props',
              puck
            )}
          </>
        )
      },
    },
    CalloutBlock: {
      fields: {
        title: { type: 'text' },
        body: { type: 'textarea' },
      },
      defaultProps: {
        title: 'Note',
        body: 'Callout text…',
      } satisfies CalloutBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              CalloutBlockPropsSchema,
              CalloutBlock,
              props,
              'CalloutBlock',
              'Callout - fix required props',
              puck
            )}
          </>
        )
      },
    },
    StepBlock: {
      fields: {
        number: { type: 'number', min: 1 },
        text: { type: 'textarea' },
      },
      defaultProps: {
        number: 1,
        text: 'Describe this step…',
      } satisfies StepBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              StepBlockPropsSchema,
              StepBlock,
              props,
              'StepBlock',
              'Step - fix required props',
              puck
            )}
          </>
        )
      },
    },
    HazardCardBlock: {
      fields: {
        title: { type: 'text' },
        body: { type: 'textarea' },
        severity: {
          type: 'select',
          options: [
            { label: 'Critical', value: 'critical' },
            { label: 'Warning', value: 'warning' },
            { label: 'Notice', value: 'notice' },
          ],
        },
      },
      defaultProps: {
        title: 'Hazard',
        body: 'Describe the hazard…',
        severity: 'warning',
      } satisfies HazardCardBlockProps,
      render: (rawProps) => {
        const { puck, ...props } = rawProps as RawRenderProps
        return (
          <>
            {SafeRender(
              HazardCardBlockPropsSchema,
              HazardCardBlock,
              props,
              'HazardCardBlock',
              'Hazard card - fix required props',
              puck
            )}
          </>
        )
      },
    },
    PPECardBlock: {
      fields: {
        title: { type: 'text' },
        items: {
          type: 'array',
          arrayFields: {
            item: { type: 'text' },
          },
          getItemSummary: (item: unknown) =>
            (item as { item?: string }).item ?? 'PPE item',
        },
      },
      defaultProps: {
        title: 'PPE Required',
        items: ['Safety equipment'],
      } satisfies PPECardBlockProps,
      // PPECardBlock items are string[]; Puck array fields yield objects —
      // coerce { item: string }[] -> string[] before Zod-parse.
      render: (rawProps) => {
        const { puck, ...rest } = rawProps as RawRenderProps & {
          title?: string
          items?: Array<string | { item?: string }>
        }
        const raw = rest as {
          title?: string
          items?: Array<string | { item?: string }>
        }
        const coerced = {
          title: raw.title,
          items: (raw.items ?? [])
            .map((x) => (typeof x === 'string' ? x : (x?.item ?? '')))
            .filter(Boolean),
        }
        return (
          <>
            {SafeRender(
              PPECardBlockPropsSchema,
              PPECardBlock,
              coerced,
              'PPECardBlock',
              'PPE card - fix required props',
              puck
            )}
          </>
        )
      },
    },
    // D-13 fallback component - registered so sanitizeLayoutContent can
    // rewrite unknown-type entries to it BEFORE Puck iterates children.
    UnsupportedBlockPlaceholder: {
      fields: {
        type: { type: 'text' },
      },
      defaultProps: { type: 'unknown' },
      render: (rawProps) => {
        const { type } = rawProps as { type?: string }
        return <UnsupportedBlockPlaceholder type={type} />
      },
    },
  },
}

/**
 * Canonical runtime registry of all builder block types.
 *
 * AI agents and external tooling should introspect block types via the
 * `/api/schema` endpoint (src/actions/introspection.ts), which exposes
 * a block's props schema + description + example in JSON-Schema form.
 * This object is the internal mirror consumed by sanitizeLayoutContent()
 * to detect unknown block types before <Render> iterates children (D-13).
 *
 * Adding a block type requires three edits to keep the AI surface in
 * sync — the contract is: if it's not in all three, it cannot be written
 * by an AI agent.
 *   1. puckConfig.components above (palette + render)
 *   2. BLOCK_REGISTRY in src/actions/introspection.ts
 *   3. (if the block is stored in sop_section_blocks) BlockContentSchema
 *      in src/lib/validators/blocks.ts
 */
for (const key of Object.keys(puckConfig.components)) {
  puckConfigComponentsRegistry[key] =
    puckConfig.components[key as keyof typeof puckConfig.components]
}

// info #9 — palette data-testid overrides for stable Playwright selectors
// across Puck versions. BuilderClient passes this via <Puck overrides={...} />.
export const puckOverrides: Partial<Overrides> = {
  componentItem: ({
    children,
    name,
  }: {
    children: ReactNode
    name: string
  }): ReactElement => (
    <div data-testid={`puck-palette-${name}`}>{children}</div>
  ),
}
