import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.describe('Layout editor (SB-LAYOUT)', () => {
  test('SB-LAYOUT-01 admin palette exposes exactly 7 block components (no DiagramHotspotBlock)', async () => {
    // Plan 02 delivers 7 shared block components registered in puckConfig.
    // DiagramHotspotBlock is deferred to Phase 16.
    //
    // This stub asserts the structural pieces so CI can gate on palette
    // composition without requiring a running dev server / DB fixture.
    // Full drag-and-drop assertions land with Plan 04 (draft persistence)
    // once autosave + Dexie + a fixture harness exist.
    const fs = await import('node:fs/promises')
    const puckConfig = await fs.readFile(
      'src/lib/builder/puck-config.tsx',
      'utf8'
    )
    for (const blockName of [
      'TextBlock',
      'HeadingBlock',
      'PhotoBlock',
      'CalloutBlock',
      'StepBlock',
      'HazardCardBlock',
      'PPECardBlock',
    ]) {
      expect(puckConfig).toContain(`${blockName}:`)
    }
    // Plan constraint: DiagramHotspotBlock must not appear.
    expect(puckConfig).not.toMatch(/DiagramHotspot[A-Z]/)

    // info #9: puckOverrides adds stable data-testid for Playwright selectors.
    expect(puckConfig).toContain('puck-palette-')
    expect(puckConfig).toContain('puckOverrides')

    // Each of the 7 blocks exists as its own file with named exports.
    const blockDir = await fs.readdir('src/components/sop/blocks')
    expect(blockDir).toContain('TextBlock.tsx')
    expect(blockDir).toContain('HeadingBlock.tsx')
    expect(blockDir).toContain('PhotoBlock.tsx')
    expect(blockDir).toContain('CalloutBlock.tsx')
    expect(blockDir).toContain('StepBlock.tsx')
    expect(blockDir).toContain('HazardCardBlock.tsx')
    expect(blockDir).toContain('PPECardBlock.tsx')
    expect(blockDir).toContain('index.ts')
    expect(blockDir).not.toContain('DiagramHotspotBlock.tsx')
  })

  test('SB-LAYOUT-02 each block component is shared between admin editor and worker walkthrough (single component tree)', async () => {
    // Plan 02 wires the real puckConfig into BOTH <Puck> (BuilderClient, admin)
    // and <Render> (LayoutRenderer, worker). This test asserts the single-tree
    // invariant structurally: both files import the same puckConfig from the
    // same module, and no placeholder config remains.
    const fs = await import('node:fs/promises')
    const builder = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    const layoutRenderer = await fs.readFile(
      'src/components/sop/LayoutRenderer.tsx',
      'utf8'
    )

    // Both reference the same puckConfig import source.
    expect(builder).toContain("from '@/lib/builder/puck-config'")
    expect(builder).toContain('puckConfig')
    expect(layoutRenderer).toContain("from '@/lib/builder/puck-config'")
    expect(layoutRenderer).toContain('puckConfig')

    // Placeholder configs from Plan 01 are gone.
    expect(builder).not.toContain('placeholderConfig')
    expect(layoutRenderer).not.toContain('placeholderConfig')

    // Blocks are imported via the shared barrel — not duplicated per consumer.
    const puckConfig = await fs.readFile(
      'src/lib/builder/puck-config.tsx',
      'utf8'
    )
    expect(puckConfig).toContain("from '@/components/sop/blocks'")

    // Blocks are environment-agnostic: they never import from @puckeditor/core.
    const blockFiles = [
      'TextBlock.tsx',
      'HeadingBlock.tsx',
      'PhotoBlock.tsx',
      'CalloutBlock.tsx',
      'StepBlock.tsx',
      'HazardCardBlock.tsx',
      'PPECardBlock.tsx',
    ]
    for (const file of blockFiles) {
      const content = await fs.readFile(
        `src/components/sop/blocks/${file}`,
        'utf8'
      )
      expect(content).not.toContain('@puckeditor/core')
      // D-12: no className prop accepted (guarantees HTML parity).
      expect(content).not.toMatch(/className\s*\?\s*:\s*string/)
    }
  })

  test('SB-LAYOUT-03 layouts reflow correctly on phone screens via Tailwind breakpoints (no JS-based viewport branching)', async () => {
    // Plan 02 constraint: zero JS-viewport-branching identifiers inside
    // src/components/sop/blocks/. All reflow must come from Tailwind responsive
    // utilities, not runtime JS detection.
    const fs = await import('node:fs/promises')

    // The grep assertion below is the literal SPEC invariant.
    const blockFiles = await fs.readdir('src/components/sop/blocks')
    for (const f of blockFiles) {
      if (!f.endsWith('.tsx')) continue
      const content = await fs.readFile(
        `src/components/sop/blocks/${f}`,
        'utf8'
      )
      expect(content).not.toMatch(/isMobile/)
      expect(content).not.toMatch(/useMediaQuery/)
      expect(content).not.toMatch(/navigator\.userAgent/)
    }

    // Cross-check via the shell grep the SPEC references, so CI fails loud
    // if a future change tries to sneak JS viewport branching in.
    let grepOutput = ''
    try {
      grepOutput = execSync(
        'grep -rE "isMobile|useMediaQuery|navigator\\.userAgent" src/components/sop/blocks/',
        { stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString()
    } catch {
      grepOutput = ''
    }
    expect(grepOutput.trim()).toBe('')
  })

  test('SB-LAYOUT-04 layout persists as JSONB on sop_sections.layout_data with layout_version pin', async () => {
    // Plan 04 delivers the autosave + flush pipeline that writes Puck's Data
    // payload into sop_sections.layout_data with layout_version === 1. Live
    // DOM autosave tests require a running dev server + DB fixture harness
    // (not present in this worktree). Following Plan 01/02 precedent, this
    // stub asserts the structural pieces:
    //   - Dexie v4 schema declares the draftLayouts table
    //   - DraftLayout interface exports the contract fields
    //   - useBuilderAutosave writes through to db.draftLayouts.put with the
    //     dirty sentinel + layout_version pinned to CURRENT_LAYOUT_VERSION
    //   - sync-engine.flushDraftLayouts + actions.updateSectionLayout close the loop
    //   - BuilderClient wires both hooks into <Puck onChange> + SAVED pill
    const fs = await import('node:fs/promises')

    // 1. Dexie v4 + draftLayouts shape.
    const db = await fs.readFile('src/lib/offline/db.ts', 'utf8')
    expect(db).toContain('db.version(4).stores')
    expect(db).toContain(
      "draftLayouts: 'section_id, sop_id, syncState, _cachedAt'"
    )
    expect(db).toContain('export interface DraftLayout')
    expect(db).toMatch(/layout_data:\s*unknown/)
    expect(db).toMatch(/layout_version:\s*number/)
    expect(db).toMatch(/syncState:\s*'dirty'\s*\|\s*'synced'/)

    // 2. useBuilderAutosave writes through to Dexie with the dirty sentinel
    //    and the current layout_version pin.
    const autosave = await fs.readFile(
      'src/hooks/useBuilderAutosave.ts',
      'utf8'
    )
    expect(autosave).toContain('db.draftLayouts.put')
    expect(autosave).toContain("syncState: 'dirty'")
    expect(autosave).toContain('CURRENT_LAYOUT_VERSION')
    expect(autosave).toContain('setTimeout')
    expect(autosave).toContain('DEBOUNCE_MS')
    expect(autosave).toMatch(/DEBOUNCE_MS\s*=\s*750/)

    // 3. useDraftLayoutSync debounces at 3s and drives flushDraftLayouts.
    const sync = await fs.readFile('src/hooks/useDraftLayoutSync.ts', 'utf8')
    expect(sync).toContain('flushDraftLayouts')
    expect(sync).toMatch(/SYNC_DEBOUNCE_MS\s*=\s*3_000/)
    expect(sync).toContain('visibilitychange')

    // 4. sync-engine batch-flush with LWW sentinel + per-row errors.
    const syncEngine = await fs.readFile(
      'src/lib/offline/sync-engine.ts',
      'utf8'
    )
    expect(syncEngine).toContain('export async function flushDraftLayouts')
    expect(syncEngine).toContain("equals('dirty')")
    expect(syncEngine).toContain('updateSectionLayout')
    expect(syncEngine).toContain("'server_newer'")
    expect(syncEngine).toContain('overwrittenByServer')

    // 5. updateSectionLayout server action enforces 128KB cap + LWW check +
    //    admin-role guard, and targets the Phase 12 columns.
    const actions = await fs.readFile('src/actions/sections.ts', 'utf8')
    expect(actions).toContain('export async function updateSectionLayout')
    expect(actions).toContain('MAX_LAYOUT_BYTES')
    expect(actions).toMatch(/128\s*\*\s*1024/)
    expect(actions).toContain('Buffer.byteLength')
    expect(actions).toContain("'server_newer'")
    expect(actions).toContain('layout_data')
    expect(actions).toContain('layout_version')
    expect(actions).toContain("['admin', 'safety_manager']")

    // 6. BuilderClient wires useBuilderAutosave into <Puck onChange> and
    //    useDraftLayoutSync at the top of the component.
    const builder = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    expect(builder).toContain('useBuilderAutosave')
    expect(builder).toContain('useDraftLayoutSync')
    expect(builder).toContain('onChange={handleChange}')
    // SAVED pill reads from sync state + online flag + lastSavedAt.
    expect(builder).toContain('OFFLINE · QUEUED')
    expect(builder).toContain('SAVING')
    expect(builder).toMatch(/SAVED.*s AGO/)
    // D-07 cross-admin overwrite toast is wired from lastSyncResult.
    expect(builder).toContain('overwrittenByServer')
    expect(builder).toContain('Updated by another admin')
  })

  test.fixme(
    'SB-LAYOUT-05 admin can add a DiagramHotspotBlock, drop a machine diagram image, and place numbered hotspot callouts at freeform x/y positions',
    async ({ page: _page }) => {
      void _page
    }
  )

  test('SB-LAYOUT-06 worker walkthrough falls back to linear step-list renderer for SOPs with no layout_data or unsupported layout_version', async () => {
    // Plan 01 establishes the LayoutRenderer fallback branch in SectionContent.tsx.
    // Full DOM-diff / fixture assertions land with Plan 02 (block components wired)
    // and Plan 04 (draft persistence). This stub asserts the structural pieces:
    //   - SectionContent.tsx imports LayoutRenderer
    //   - SectionContent.tsx contains the layout_data/layout_version branch
    //   - The legacy switch is preserved as LegacyRenderer
    //   - SUPPORTED_LAYOUT_VERSIONS is exported and contains [1]
    const fs = await import('node:fs/promises')
    const sectionContent = await fs.readFile(
      'src/components/sop/SectionContent.tsx',
      'utf8'
    )
    expect(sectionContent).toContain('LayoutRenderer')
    expect(sectionContent).toContain('section.layout_data != null')
    expect(sectionContent).toContain('section.layout_version != null')
    expect(sectionContent).toMatch(/function LegacyRenderer/)

    const supportedVersions = await fs.readFile(
      'src/lib/builder/supported-versions.ts',
      'utf8'
    )
    expect(supportedVersions).toContain('SUPPORTED_LAYOUT_VERSIONS = [1]')

    const layoutRenderer = await fs.readFile(
      'src/components/sop/LayoutRenderer.tsx',
      'utf8'
    )
    expect(layoutRenderer).toContain('@puckeditor/core')
    expect(layoutRenderer).toContain('SUPPORTED_LAYOUT_VERSIONS')
    expect(layoutRenderer).toContain('[layout] unsupported version')
  })

  test('SB-LAYOUT-13-unknown unsupported block type renders UnsupportedBlockPlaceholder + warn-once (D-13)', async () => {
    // Plan 02 D-13: an unknown block type in layout_data must render a
    // grey UnsupportedBlockPlaceholder and log `[layout] unsupported block type`
    // exactly once per page load. sanitizeLayoutContent runs on BOTH admin
    // and worker paths BEFORE Puck iterates children.
    const fs = await import('node:fs/promises')
    const puckConfig = await fs.readFile(
      'src/lib/builder/puck-config.tsx',
      'utf8'
    )
    // Placeholder component exists and carries the identifying attribute.
    expect(puckConfig).toContain('UnsupportedBlockPlaceholder')
    expect(puckConfig).toContain(
      'data-layout-placeholder="unsupported-block"'
    )
    // Registered in puckConfig.components (so sanitizer rewrites resolve).
    expect(puckConfig).toMatch(/UnsupportedBlockPlaceholder:\s*\{/)
    // Warn-once identifier is present.
    expect(puckConfig).toContain('[layout] unsupported block type')
    expect(puckConfig).toContain('warnedUnsupportedBlock')

    // Both admin and worker entry points invoke sanitizeLayoutContent.
    const builder = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    const layoutRenderer = await fs.readFile(
      'src/components/sop/LayoutRenderer.tsx',
      'utf8'
    )
    expect(builder).toContain('sanitizeLayoutContent')
    expect(layoutRenderer).toContain('sanitizeLayoutContent')
  })

  test('SB-LAYOUT-16-red-outline admin red-outline on Zod failure + worker plain empty-state (D-16)', async () => {
    // Plan 02 D-16: a block whose props fail Zod parsing is wrapped in a
    // red-outline container with a prop-level hint in the ADMIN render path;
    // the WORKER render path renders only the visible empty-state.
    const fs = await import('node:fs/promises')
    const puckConfig = await fs.readFile(
      'src/lib/builder/puck-config.tsx',
      'utf8'
    )

    // Red-outline container + data attributes for targeting in future DOM tests.
    expect(puckConfig).toContain('data-layout-error="true"')
    expect(puckConfig).toContain('data-block={blockName}')
    expect(puckConfig).toContain('border-2 border-red-500/70')

    // Admin-vs-worker branch: isEditing flag from Puck context is consulted.
    expect(puckConfig).toContain('puck?.isEditing === true')

    // Missing-field hint plumbing (Missing: <field>) comes from firstMissingField.
    expect(puckConfig).toContain('firstMissingField')
    expect(puckConfig).toContain('Missing:')

    // BuilderClient surfaces a section-level toast when layout_data is structurally broken.
    const builder = await fs.readFile(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
      'utf8'
    )
    expect(builder).toContain('layoutErrorToast')
    expect(builder).toContain('LayoutDataSchema.safeParse')
    expect(builder).toContain('has broken layout data')
  })
})
