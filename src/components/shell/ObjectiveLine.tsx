'use client'

/**
 * Phase 60 (OBJ-02, D-11) -- an objective as one quiet metadata line. Text only: no card,
 * no border, no icon, no stylesheet import. The words come from objectiveLine() so the
 * "set by" label is the one the server decided (T-60-57). Also holds the one shared read,
 * so the worker and admin shells and the People row all use the same query key.
 */
import { useQuery } from '@tanstack/react-query'
import { listObjectives } from '@/actions/objectives'
import { objectiveLine, type ObjectiveSubject, type ObjectiveView } from '@/lib/objectives/model'
import { OBJECTIVES_KEY } from '@/lib/shell/query-keys'

const CHIP = 'rounded mono text-meta font-semibold uppercase px-2 py-1'

/** The one objectives read; `find` is the live objective of a place, or null. */
export function useObjectives() {
  const { data } = useQuery({
    queryKey: OBJECTIVES_KEY,
    queryFn: () => listObjectives(),
    staleTime: 5 * 60 * 1000,
  })
  const rows = data && !('error' in data) ? data.rows : []
  const byKey = new Map(rows.map((o) => [`${o.subjectType}:${o.subjectId ?? ''}`, o]))
  return {
    find: (type: ObjectiveSubject, id: string | null): ObjectiveView | null => byKey.get(`${type}:${id ?? ''}`) ?? null,
  }
}

export function ObjectiveLine({ view, prefix }: { view: ObjectiveView; prefix?: string }) {
  const p = objectiveLine(view, new Date(), prefix)
  return (
    <p
      data-testid="objective-line"
      data-agent={p.agent ? 'true' : 'false'}
      data-confirmed={p.unconfirmed ? 'false' : 'true'}
      className="mono min-w-0 break-words text-meta text-ink-600"
    >
      {p.prefix} · <span className="text-ink-700">{p.text}</span>
      {p.when && (
        <>
          {' · '}
          {p.overdue ? (
            <>
              was due <span className="font-semibold text-accent-escalate">{p.when.replace('was due ', '')}</span>
            </>
          ) : (
            p.when
          )}
        </>
      )}
      {' · '}
      {p.setBy}
      {p.agent && (
        <>
          {' '}
          <span className={`${CHIP} border border-ai/40 bg-ai/10 text-ai`}>agent</span>
        </>
      )}
      {p.unconfirmed && (
        <>
          {' '}
          <span className={`${CHIP} border border-accent-decision/40 bg-accent-decision/10 text-ink-900`}>Unconfirmed</span>
        </>
      )}
    </p>
  )
}
