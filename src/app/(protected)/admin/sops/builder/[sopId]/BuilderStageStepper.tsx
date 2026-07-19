'use client';

/**
 * BuilderStageStepper
 *
 * Phase 33 (33-04, SC-6) — the forward-zone renderer for the Wayfinder bar.
 * Renders a SINGLE next-stage chip (not the old 3-chip breadcrumb row) that
 * carries its own lock reason inline: "Locked — {N} steps below still need
 * checking". When Phase 29's approval chain is pending, the chip becomes an
 * amber "Waiting for approval" state — that blocks the whole SOP regardless
 * of which internal stage is active, so it takes priority over the next-stage
 * chip.
 *
 * This is a fully controlled presentational component — it fetches no data.
 * All state comes from props supplied by the BuilderStageShell.
 *
 * Requirements: R1 (3-stage sequence), R6 (inline publish reason), R8 (adaptive
 * 2-vs-3 stage), SC-6 (Wayfinder forward chip).
 *
 * KEPT verbatim (pinned by tests/phase30/plain-language.spec.ts +
 * tests/builder/builder-review-flow.spec.ts): the BuilderStage union, the
 * `chips` stage/label literals, and the display labels 'Edit' / 'Check' /
 * 'Send to workers'.
 */

export type BuilderStage = 'build' | 'review' | 'publish';

export interface BuilderStageStepperProps {
  activeStage: BuilderStage;
  hasSourceDoc: boolean;
  isReady: boolean;
  verifiedCount: number;
  totalCount: number;
  onStageSelect: (stage: BuilderStage) => void;
  /** Phase 29 — true when this SOP's approval chain is currently pending. */
  approvalPending?: boolean;
  /** Phase 29 — the next approver's label, when known. */
  approverLabel?: string;
}

interface StageChip {
  stage: BuilderStage;
  label: string;
  ordinal: number;
}

export function BuilderStageStepper({
  activeStage,
  hasSourceDoc,
  isReady,
  verifiedCount,
  totalCount,
  onStageSelect,
  approvalPending = false,
  approverLabel,
}: BuilderStageStepperProps) {
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

  const stageToOrdinal: Record<BuilderStage, number> = {
    build: 1,
    review: hasSourceDoc ? 2 : -1, // -1 = not present
    publish: hasSourceDoc ? 3 : 2,
  };

  const activeOrdinal = stageToOrdinal[activeStage];
  const remaining = Math.max(0, totalCount - verifiedCount);

  // The forward chip is whichever chip sits one ordinal ahead of the active
  // stage. On the final stage there is nothing ahead — the chip disappears
  // (unless an approval chain is blocking, handled first below).
  const forwardChip = chips.find((c) => c.ordinal === activeOrdinal + 1) ?? null;

  if (approvalPending) {
    return (
      <div
        data-testid="wayfinder-forward-chip"
        data-chip-state="pending-approval"
        className="flex flex-col items-start gap-0.5 rounded-sm border-[1.5px] px-3.5 py-1.5 text-left"
        style={{ borderColor: '#b45309', background: 'rgba(180,83,9,0.08)' }}
      >
        <span className="text-[11.5px] font-semibold" style={{ color: '#b45309' }}>
          Waiting for approval
        </span>
        <span className="text-[10px]" style={{ color: '#b45309' }}>
          {approverLabel ? `Next: ${approverLabel}` : 'An approver needs to review this'}
        </span>
      </div>
    );
  }

  if (!forwardChip) return null;

  const locked = forwardChip.stage === 'publish' && !isReady;
  const ready = forwardChip.stage === 'publish' && isReady;

  const handleClick = () => {
    if (!locked) onStageSelect(forwardChip.stage);
  };

  return (
    <button
      type="button"
      data-testid="wayfinder-forward-chip"
      data-chip-state={locked ? 'locked' : ready ? 'ready' : 'next'}
      onClick={handleClick}
      disabled={locked}
      aria-disabled={locked}
      aria-label={`Go to ${forwardChip.label} stage`}
      className={`flex flex-col items-start gap-0.5 rounded-sm border-[1.5px] px-3.5 py-1.5 text-left transition-colors ${
        ready ? 'border-[var(--accent-ok)]' : 'border-[var(--ink-300)] bg-[var(--paper-2)]'
      } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      style={ready ? { background: 'rgba(16,185,129,.08)' } : undefined}
    >
      <span
        className="flex items-center gap-1.5 text-[11.5px]"
        style={{ color: ready ? 'var(--accent-ok)' : locked ? 'var(--ink-700)' : 'var(--ink-900)' }}
      >
        <span className="text-[9px] uppercase tracking-wider text-[var(--ink-500)]">Next →</span>
        <span className={ready ? 'font-semibold' : ''}>{forwardChip.label}</span>
        {locked && <span aria-hidden="true">🔒</span>}
      </span>
      <span
        data-testid="wayfinder-lock-reason"
        className="text-[10px]"
        style={{ color: ready ? 'var(--accent-ok)' : 'var(--ink-500)' }}
      >
        {locked
          ? `Locked — ${remaining} steps below still need checking`
          : ready
            ? `All ${totalCount} steps checked — ready to go`
            : `Continue to ${forwardChip.label.toLowerCase()}`}
      </span>
    </button>
  );
}
