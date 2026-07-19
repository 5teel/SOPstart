'use client';

/**
 * OrientationStrip
 *
 * Renders below the top bar as a full-width white strip when the builder is in
 * Review stage. Displays a stage badge, the exact Review prose from the
 * Copywriting Contract, and a verified/total progress counter with progress bar.
 *
 * This is a fully controlled presentational component — it fetches no data.
 * The BuilderStageShell (Plan 05) controls whether it mounts at all; this
 * component does not need stage-gating logic.
 *
 * Requirements: R2 (Review Station orientation / pane-purpose microcopy).
 */

export interface OrientationStripProps {
  /** e.g. "Step 2 of 3" */
  stageBadge: string;
  verifiedCount: number;
  totalCount: number;
}

export function OrientationStrip({
  stageBadge,
  verifiedCount,
  totalCount,
}: OrientationStripProps) {
  // Progress bar fill percentage — clamp to [0, 1] to avoid overflow.
  const progress =
    totalCount > 0 ? Math.min(1, Math.max(0, verifiedCount / totalCount)) : 0;
  const fillPercent = `${Math.round(progress * 100)}%`;

  // 33-04: the "unlocks Send to workers" reason now lives on the Wayfinder
  // bar's forward chip ("Locked — N steps below still need checking") — this
  // sentence only needs to say what this list IS, not restate the lock
  // condition a second time (RESEARCH Pattern 6: dedupe).
  const remaining = Math.max(0, totalCount - verifiedCount);
  const orientationSentence =
    remaining > 0
      ? `Check each block below against the source document — ${remaining} of ${totalCount} left.`
      : `All ${totalCount} blocks checked against the source document.`;

  return (
    <div
      data-testid="orientation-strip"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: '#ffffff',
        borderBottom: '1px solid #d4d4d8', // --ink-300
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Left: Stage badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3b82f6', // --accent-step
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.3,
          borderRadius: 2,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}
      >
        {stageBadge}
      </span>

      {/* Centre: orientation sentence — what this list is and what it unlocks */}
      <p
        data-testid="orientation-sentence"
        style={{
          flex: 1,
          margin: 0,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.3,
          color: '#3f3f46', // --ink-700 (UI-SPEC value)
          minWidth: 0,
        }}
      >
        {orientationSentence}
      </p>

      {/* Right: progress counter + progress bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.3,
            color: '#71717a', // --ink-500
            whiteSpace: 'nowrap',
          }}
        >
          {verifiedCount} / {totalCount} verified
        </span>

        {/* Horizontal progress bar: 120×4px */}
        <div
          style={{
            width: 120,
            height: 4,
            background: '#e5e5e5', // --ink-200
            borderRadius: 3,
            overflow: 'hidden',
            flexShrink: 0,
          }}
          role="progressbar"
          aria-valuenow={verifiedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${verifiedCount} of ${totalCount} steps verified`}
        >
          <div
            style={{
              width: fillPercent,
              height: '100%',
              background: '#3b82f6', // --accent-step
              borderRadius: 3,
              transition: 'width 200ms ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}
