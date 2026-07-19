'use client'

/**
 * Phase 33-09 (SC-5) — the absorbed "Who can see this?" / "What can they
 * see?" answer panel, rendered BELOW the bay (not a taller SelectionStrip).
 * Sketch 003 concept B, adopted into concept A per
 * sketches/access-hierarchy/README.md § Decisions.
 *
 * Purely presentational — every field on `AccessAnswerPanelData` is derived
 * by the caller (WiringPatchBay) from its EXISTING accessByUnit/grants/
 * peopleIndex memos. No fetch, no resolver call, no state here.
 */

export type AccessAnswerPanelData =
  | { kind: 'empty' }
  | {
      kind: 'sop'
      title: string
      collectionName?: string
      overridden: boolean
      peopleCount: number
      names: string[]
      collectionPeopleCount: number
      collectionNames: string[]
    }
  | {
      kind: 'collection'
      title: string
      peopleCount: number
      names: string[]
      narrowerSops: Array<{ title: string; peopleCount: number }>
    }
  | {
      kind: 'unit'
      title: string
      collections: Array<{ title: string; hasNarrowerSops: boolean }>
      sops: Array<{ title: string }>
    }

function joinNames(names: string[]): string {
  if (names.length === 0) return 'nobody yet'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function AccessAnswerPanel({ data }: { data: AccessAnswerPanelData }) {
  const heading = data.kind === 'unit' ? 'What can they see?' : 'Who can see this?'

  return (
    <div className="mt-3 rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-4 py-3">
      <div className="mono text-[11px] font-medium uppercase tracking-wide text-[var(--ink-500)]">{heading}</div>

      {data.kind === 'empty' && (
        <p className="m-0 mt-2 text-sm leading-normal text-[var(--ink-500)]">
          Select a collection or SOP to see — and change — who can see it. Or select a team, role or person to see everything
          they can see. Nothing changes until you choose someone.
        </p>
      )}

      {data.kind === 'sop' && (
        <>
          <h3 className="m-0 mt-2 text-[15px] font-bold text-[var(--ink-900)]">{data.title}</h3>
          {data.collectionName && (
            <p className="m-0 text-xs text-[var(--ink-500)]">In the {data.collectionName} collection</p>
          )}
          {data.overridden ? (
            <>
              <p className="m-0 mt-2 text-sm text-[var(--ink-900)]">
                Only <b>{data.peopleCount}</b> {data.peopleCount === 1 ? 'person' : 'people'} can see this SOP —{' '}
                {joinNames(data.names)}, chosen by name.
              </p>
              <p className="m-0 mt-1 text-xs leading-normal text-[var(--ink-500)]">
                Remove all named people and this SOP follows its collection again. The rest of{' '}
                {data.collectionName ?? 'the collection'} is seen by {joinNames(data.collectionNames)} (
                {data.collectionPeopleCount} {data.collectionPeopleCount === 1 ? 'person' : 'people'}).
              </p>
            </>
          ) : (
            <>
              <p className="m-0 mt-2 text-sm text-[var(--ink-900)]">
                <b>{data.peopleCount}</b> {data.peopleCount === 1 ? 'person' : 'people'} can see this SOP — everyone who can
                see its collection.
              </p>
              <p className="m-0 mt-1 text-xs leading-normal text-[var(--ink-500)]">
                Right now this SOP follows its collection. Choose people, roles or teams on the left to narrow who sees it —
                without changing the rest of the collection.
              </p>
            </>
          )}
        </>
      )}

      {data.kind === 'collection' && (
        <>
          <h3 className="m-0 mt-2 text-[15px] font-bold text-[var(--ink-900)]">{data.title}</h3>
          <p className="m-0 text-xs text-[var(--ink-500)]">
            Changing this changes who sees every SOP inside — except SOPs with people chosen by name
          </p>
          <p className="m-0 mt-2 text-sm text-[var(--ink-900)]">
            <b>{data.peopleCount}</b> {data.peopleCount === 1 ? 'person' : 'people'} can see the {data.title} collection —{' '}
            {joinNames(data.names)}.
          </p>
          {data.narrowerSops.map((s) => (
            <p key={s.title} className="m-0 mt-1 text-xs leading-normal text-[var(--ink-500)]">
              One SOP inside is narrower: <b>{s.title}</b> — seen by only {s.peopleCount}{' '}
              {s.peopleCount === 1 ? 'person' : 'people'}, chosen by name.
            </p>
          ))}
        </>
      )}

      {data.kind === 'unit' && (
        <>
          <h3 className="m-0 mt-2 text-[15px] font-bold text-[var(--ink-900)]">{data.title}</h3>
          {data.collections.length === 0 && data.sops.length === 0 ? (
            <p className="m-0 mt-2 text-sm text-[var(--ink-500)]">
              Nothing yet — choose a collection or SOP, then select this person or team to let them see it.
            </p>
          ) : (
            <ul className="m-0 mt-2 list-disc pl-5 text-sm text-[var(--ink-900)]">
              {data.collections.map((c) => (
                <li key={c.title}>
                  <b>{c.title}</b>
                  {c.hasNarrowerSops ? (
                    <span className="text-[var(--ink-500)]"> (except SOPs chosen by name for someone else)</span>
                  ) : null}
                </li>
              ))}
              {data.sops.map((s) => (
                <li key={s.title}>
                  <b>{s.title}</b> <span className="text-[var(--ink-500)]">— chosen by name</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
