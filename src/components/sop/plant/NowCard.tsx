'use client'

/**
 * The bottom-left Now card (D-10) -- the single next procedure, Walk it,
 * Show me, and up to two "Then:" lines. Ordering (due -> never -> updated)
 * is entirely worker-signal's job (pickNowQueue) -- this component renders
 * the NowItem[] it is handed, in order, and never sorts or classifies.
 */
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PLANT_REL_LABEL, type NowItem } from '@/lib/sop/worker-signal'
import { RelBadge } from '@/components/sop/plant/RelBadge'

function formatDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

async function sopMinutes(sopId: string): Promise<number> {
  const { data } = (await createClient()
    .from('sop_sections')
    .select('sop_steps(time_estimate_minutes)')
    .eq('sop_id', sopId)) as {
    data: Array<{ sop_steps: Array<{ time_estimate_minutes: number | null }> | null }> | null
  }
  const total = (data ?? []).reduce(
    (sum, sec) => sum + (sec.sop_steps ?? []).reduce((s, st) => s + (st.time_estimate_minutes ?? 0), 0),
    0,
  )
  return Math.round(total)
}

export function NowCard({
  items,
  onShowMe,
  inline,
}: {
  items: NowItem[]
  onShowMe?: (machineId: string) => void
  inline?: boolean
}) {
  const now = items[0] ?? null
  const nowId = now?.sop.id

  const { data: minutes } = useQuery({
    queryKey: ['sop-minutes', nowId],
    queryFn: () => sopMinutes(nowId as string),
    enabled: !!nowId,
    staleTime: 1000 * 60 * 5,
  })

  const lastDoneDay = now ? formatDay(now.sop.lastCompletedAt) : null
  const lastDone = lastDoneDay ? `last done ${lastDoneDay}` : 'never done'

  return (
    <section
      data-testid="plant-now-card"
      aria-label="Next for you"
      data-empty={now ? undefined : 'true'}
      className={
        inline
          ? 'w-full rounded-lg border border-[var(--ink-900)] bg-white p-3.5'
          : 'absolute bottom-4 left-4 z-10 w-82.5 rounded-lg border border-[var(--ink-900)] bg-white/97 p-3.5 shadow-xl'
      }
    >
      {!now ? (
        <p className="text-ui text-[var(--ink-700)]">Nothing due — browse your machines.</p>
      ) : (
        <>
          <div className="mono flex items-center justify-between text-meta uppercase tracking-widest text-[var(--ink-500)]">
            <span>Next for you</span>
            <RelBadge rel={now.rel} />
          </div>
          <h3 className="mt-1.5 mb-0.5 text-base font-semibold leading-snug text-[var(--ink-900)]">
            {now.sop.title}
          </h3>
          <div className="mono mb-2.5 text-meta text-[var(--ink-500)]">
            {[now.machine?.name, now.departmentName, minutes ? `~${minutes} min` : null, lastDone]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="flex gap-1.5">
            <Link
              href={`/sops/${now.sop.id}?tab=walk`}
              data-testid="plant-now-walk"
              className="flex min-h-tap flex-1 items-center justify-center rounded-lg bg-[var(--ink-900)] px-4 text-sm font-semibold text-white"
            >
              Walk it
            </Link>
            {onShowMe ? (
              now.machine && (
                <button
                  type="button"
                  data-testid="plant-now-show"
                  onClick={() => onShowMe(now.machine!.id)}
                  className="flex min-h-tap items-center justify-center rounded-lg border border-[var(--ink-300)] bg-white px-4 text-sm font-semibold text-[var(--ink-900)]"
                >
                  Show me
                </button>
              )
            ) : (
              <Link
                href={`/sops/${now.sop.id}`}
                data-testid="plant-now-read"
                className="flex min-h-tap items-center justify-center rounded-lg border border-[var(--ink-300)] bg-white px-4 text-sm font-semibold text-[var(--ink-900)]"
              >
                Read
              </Link>
            )}
          </div>
          {items.length > 1 && (
            <div className="mt-2.5 border-t border-[var(--ink-100)] pt-2 text-xs text-[var(--ink-600)]">
              {items.slice(1, 3).map((item) => (
                <div key={item.sop.id} data-testid="plant-now-then">
                  Then: {item.sop.title} · <b>{PLANT_REL_LABEL[item.rel].toLowerCase()}</b> ·{' '}
                  {item.machine?.name ?? 'no machine'}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
