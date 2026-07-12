'use client';

/**
 * BuilderStageStepper
 *
 * Renders the Build → Review & verify → Publish chip row inside the dark top
 * bar. When `hasSourceDoc` is true, all three chips are shown; when false the
 * Review chip is omitted (Build → Publish only).
 *
 * This is a fully controlled presentational component — it fetches no data.
 * All state comes from props supplied by the BuilderStageShell (Plan 05).
 *
 * Requirements: R1 (3-stage sequence), R6 (inline publish reason), R8 (adaptive
 * 2-vs-3 stage), R9 (tablet number-only chips).
 */

export type BuilderStage = 'build' | 'review' | 'publish';

export interface BuilderStageStepperProps {
  activeStage: BuilderStage;
  hasSourceDoc: boolean;
  isReady: boolean;
  verifiedCount: number;
  totalCount: number;
  onStageSelect: (stage: BuilderStage) => void;
}

type ChipState = 'done' | 'active' | 'todo';

interface StageChip {
  stage: BuilderStage;
  label: string;
  ordinal: number;
}

/**
 * Derive whether a chip is done / active / todo based on active stage and
 * position in the ordered stage list.
 */
function chipState(
  chipOrdinal: number,
  activeOrdinal: number,
): ChipState {
  if (chipOrdinal < activeOrdinal) return 'done';
  if (chipOrdinal === activeOrdinal) return 'active';
  return 'todo';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NumberDotProps {
  state: ChipState;
  ordinal: number;
}

function NumberDot({ state, ordinal }: NumberDotProps) {
  if (state === 'done') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#10b981', // --accent-ok
          flexShrink: 0,
          fontSize: 10,
          color: '#ffffff',
          fontWeight: 700,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        ✓
      </span>
    );
  }

  if (state === 'active') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#3b82f6', // --accent-step
          flexShrink: 0,
          fontSize: 10,
          color: '#ffffff',
          fontWeight: 700,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {ordinal}
      </span>
    );
  }

  // todo
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '1px solid #52525b',
        background: 'transparent',
        flexShrink: 0,
        fontSize: 10,
        color: '#71717a', // --ink-500
        fontWeight: 700,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {ordinal}
    </span>
  );
}

interface ChipProps {
  chip: StageChip;
  state: ChipState;
  disabled: boolean;
  onSelect: (stage: BuilderStage) => void;
}

function StageChipButton({ chip, state, disabled, onSelect }: ChipProps) {
  const chipBg =
    state === 'active' ? '#ffffff' : 'transparent';
  const chipColor =
    state === 'done'
      ? '#10b981' // --accent-ok
      : state === 'active'
        ? '#09090b' // --ink-900
        : '#71717a'; // --ink-500 (todo)

  const handleClick = () => {
    if (!disabled) onSelect(chip.stage);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={`Go to ${chip.label} stage`}
      aria-current={state === 'active' ? 'step' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderRadius: 2,
        border: 'none',
        background: chipBg,
        color: chipColor,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'background 120ms',
      }}
    >
      <NumberDot state={state} ordinal={chip.ordinal} />
      {/* Full label — hidden on tablet via CSS */}
      <span className="stepper-chip-label" title={chip.label}>
        {chip.label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BuilderStageStepper({
  activeStage,
  hasSourceDoc,
  isReady,
  verifiedCount,
  totalCount,
  onStageSelect,
}: BuilderStageStepperProps) {
  // Build the ordered chip list based on whether source doc is present.
  // Phase 30 (30-07, UX-07): DISPLAY labels are plain-language — Edit / Check /
  // Send to workers. The BuilderStage union + stage keys stay 'build' |
  // 'review' | 'publish' (routes/state names unchanged; labels only).
  const chips: StageChip[] = hasSourceDoc
    ? [
        { stage: 'build', label: 'Edit', ordinal: 1 },
        { stage: 'review', label: 'Check', ordinal: 2 },
        { stage: 'publish', label: 'Send to workers', ordinal: 3 },
      ]
    : [
        { stage: 'build', label: 'Edit', ordinal: 1 },
        { stage: 'publish', label: 'Send to workers', ordinal: 2 },
      ];

  // Map stage → ordinal for state derivation.
  const stageToOrdinal: Record<BuilderStage, number> = {
    build: 1,
    review: hasSourceDoc ? 2 : -1, // -1 = not present
    publish: hasSourceDoc ? 3 : 2,
  };

  const activeOrdinal = stageToOrdinal[activeStage];

  const remaining = totalCount - verifiedCount;

  return (
    <>
      {/* Responsive styles for tablet breakpoint (768–1023px) */}
      <style>{`
        @media (min-width: 768px) and (max-width: 1023px) {
          .stepper-chip-label { display: none; }
        }
        @media (min-width: 1024px) {
          .stepper-chip-label { display: inline; }
        }
      `}</style>

      <div
        data-testid="builder-stage-stepper"
        data-active-stage={activeStage}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Chip row */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {chips.map((chip, idx) => {
            const state = chipState(chip.ordinal, activeOrdinal);

            // Determine disabled state per chip.
            // - Publish: disabled when !isReady
            // - Review: disabled when !hasSourceDoc (won't appear in 2-stage but guard for safety)
            // - Build: always enabled
            const isDisabled =
              (chip.stage === 'publish' && !isReady) ||
              (chip.stage === 'review' && !hasSourceDoc);

            return (
              <span
                key={chip.stage}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <StageChipButton
                  chip={chip}
                  state={state}
                  disabled={isDisabled}
                  onSelect={onStageSelect}
                />
                {/* Arrow glyph between chips */}
                {idx < chips.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      color: '#3f3f46',
                      fontSize: 10,
                      lineHeight: 1,
                      padding: '0 2px',
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    →
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* Inline publish-gate reason — present ONLY when !isReady */}
        {!isReady && (
          <span
            data-testid="stepper-publish-reason"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              color: '#a1a1aa',
              lineHeight: 1.3,
              display: 'block',
              textAlign: 'center',
            }}
          >
            🔒 {remaining} of {totalCount} steps left to verify
          </span>
        )}
      </div>
    </>
  );
}
