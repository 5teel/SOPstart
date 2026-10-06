'use client'

/**
 * Phase 60 (RQS-03, D-02, D-06, A-04) -- "Ask someone to do this": a popover in the OwnerPicker
 * shape, opened from `Ask ›` on a machine row or from the This SOP rail. Choosing a target is a
 * selection, never a send (a role ask tells everyone in that role): the Ask button sends. A lazy
 * module (next/dynamic only) with no stylesheet import. The payload carries the SOP id and the
 * target only; the server takes organisation, user and role from the session.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { askToDoSop, listAskTargets } from '@/actions/asks'
import { ROLE_PLURAL } from '@/lib/requests/model'

type Role = keyof typeof ROLE_PLURAL
type Targets = {
  roles: Array<{ role: Role; count: number }>
  people: Array<{ id: string; label: string; role: Role; hasIt: boolean }>
}
type Picked = { role: Role } | { userId: string; label: string } | null

const LOAD_FAILED = "Couldn't load people. Try again."
const ASK_FAILED = "That didn't work. Nothing was sent — try again."

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

export function AskTrigger({
  sopId,
  sopTitle,
  variant,
  align,
}: {
  sopId: string
  sopTitle: string
  variant: 'row' | 'rail'
  align: 'start' | 'end'
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'role' | 'person'>('role')
  const [picked, setPicked] = useState<Picked>(null)
  const [search, setSearch] = useState('')
  const [targets, setTargets] = useState<Targets | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ text: string; bad: boolean } | null>(null)

  // Esc closes the popover only: capture phase and preventDefault, the OwnerPicker idiom.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  useEffect(() => {
    if (!receipt) return
    const t = setTimeout(() => setReceipt(null), 10_000)
    return () => clearTimeout(t)
  }, [receipt])

  async function handleOpen() {
    if (open) return setOpen(false)
    // Every open starts clean: nothing chosen, nothing typed.
    setOpen(true)
    setMode('role')
    setPicked(null)
    setSearch('')
    setError(null)
    setLoading(true)
    try {
      const res = await listAskTargets({ sopId })
      if ('error' in res) {
        setError(res.error || LOAD_FAILED)
        return
      }
      setTargets(res as Targets)
    } catch {
      setError(LOAD_FAILED)
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    if (!picked || pending) return
    setPending(true)
    setError(null)
    try {
      const res = await askToDoSop({ sopId, target: 'role' in picked ? { role: picked.role } : { userId: picked.userId } })
      if ('error' in res) {
        setError(res.error)
        return
      }
      setOpen(false)
      setReceipt(
        res.logged
          ? { text: `Asked ${res.targetLabel} · logged in the decision ledger`, bad: false }
          : { text: "Asked, but it didn't reach the decision ledger. Tell an admin.", bad: true },
      )
      void queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
    } catch {
      setError(ASK_FAILED)
    } finally {
      setPending(false)
    }
  }

  const rail = variant === 'rail'
  const shown = (targets?.people ?? []).filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()))
  const told = picked && 'role' in picked ? targets?.roles.find((r) => r.role === picked.role)?.count ?? 0 : 1
  const pickedLabel = picked ? ('role' in picked ? ROLE_PLURAL[picked.role] : picked.label) : null

  return (
    <div className={rail ? 'relative w-full' : 'relative'}>
      <button
        type="button"
        data-testid="ask-trigger"
        aria-expanded={open}
        aria-label={rail ? undefined : `Ask someone to do ${sopTitle}`}
        onClick={() => void handleOpen()}
        className={
          rail
            ? 'flex min-h-tap w-full items-center rounded px-2 text-left text-ui text-ink-900 hover:bg-paper-1'
            : 'mono text-meta text-ink-500 hover:text-ink-900'
        }
      >
        {rail ? 'Ask someone to do this' : 'Ask ›'}
      </button>

      {receipt && (
        <p
          role="status"
          data-testid="ask-receipt"
          className={
            rail
              ? `px-2 pb-1 text-ui ${receipt.bad ? 'text-accent-escalate' : 'text-ink-700'}`
              : `absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded border border-ink-200 bg-paper-1 px-2 py-1 text-ui shadow-lg ${
                  receipt.bad ? 'text-accent-escalate' : 'text-ink-700'
                }`
          }
        >
          {!receipt.bad && <Check size={14} className="mr-1 inline text-accent-ok" aria-hidden="true" />}
          {receipt.text}
        </p>
      )}

      {open && (
        <div
          data-testid="ask-picker"
          className={`absolute z-10 mt-1 w-72 rounded-lg border border-ink-200 bg-paper-1 p-2 shadow-lg ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="mono text-meta uppercase text-ink-500">Ask someone to do this</p>
          <p className="mb-2 truncate text-ui text-ink-700">{sopTitle}</p>

          <div role="radiogroup" aria-label="Who to ask" className="mb-2 flex gap-1">
            {(['role', 'person'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                data-testid={`ask-mode-${m}`}
                onClick={() => {
                  setMode(m)
                  setPicked(null)
                }}
                className={`min-h-tap rounded px-3 text-ui font-semibold ${mode === m ? 'bg-ink-900 text-paper' : 'text-ink-700'}`}
              >
                {m === 'role' ? 'A role' : 'A person'}
              </button>
            ))}
          </div>

          {loading && <p className="text-ui text-ink-500">Loading people…</p>}
          {error && (
            <p role="alert" className="mb-2 text-ui text-accent-escalate">
              {error}
            </p>
          )}

          {targets && mode === 'role' && (
            <ul className="space-y-0.5">
              {targets.roles.map((r) => {
                const on = !!picked && 'role' in picked && picked.role === r.role
                return (
                  <li key={r.role}>
                    <button
                      type="button"
                      data-testid="ask-role-option"
                      aria-pressed={on}
                      disabled={pending}
                      onClick={() => setPicked({ role: r.role })}
                      className={`flex min-h-tap w-full items-center gap-2 rounded px-2 text-left text-ui text-ink-900 hover:bg-paper-2 ${on ? 'bg-paper-2 font-semibold' : ''}`}
                    >
                      {on ? <Check size={16} className="text-accent-ok" aria-hidden="true" /> : <span className="w-4" />}
                      <span className="flex-1">{ROLE_PLURAL[r.role]}</span>
                      <span className="mono text-meta text-ink-500">{people(r.count)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {targets && mode === 'person' && (
            <>
              <input
                type="search"
                data-testid="ask-person-search"
                aria-label="Find a person"
                placeholder="Find a person…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-1 min-h-tap w-full rounded-lg border border-ink-300 px-3 text-ui text-ink-900"
              />
              <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                {shown.map((p) => {
                  const on = !!picked && 'userId' in picked && picked.userId === p.id
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        data-testid="ask-person-option"
                        aria-pressed={on}
                        disabled={pending}
                        onClick={() => setPicked({ userId: p.id, label: p.label })}
                        className={`flex min-h-tap w-full items-center gap-2 rounded px-2 text-left text-ui text-ink-900 hover:bg-paper-2 ${on ? 'bg-paper-2 font-semibold' : ''}`}
                      >
                        {on ? <Check size={16} className="text-accent-ok" aria-hidden="true" /> : <span className="w-4" />}
                        <span className="min-w-0 flex-1 truncate">
                          {p.label}
                          {p.hasIt && <span className="ml-2 font-normal text-ink-500">Already has this</span>}
                        </span>
                        <span className="mono text-meta text-ink-500">{ROLE_PLURAL[p.role].replace(/s$/, '')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid="ask-confirm"
              disabled={!picked || pending}
              onClick={() => void send()}
              className="flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg bg-ink-900 text-ui font-semibold text-paper disabled:opacity-50"
            >
              {pending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {pending ? 'Asking…' : `Ask ${pickedLabel ?? ''}`.trim()}
            </button>
            <button
              type="button"
              data-testid="ask-cancel"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="min-h-tap rounded-lg px-3 text-ui text-ink-700 hover:bg-paper-2"
            >
              Don&apos;t ask
            </button>
          </div>
          {picked && (
            <p data-testid="ask-told" className="mt-1 text-ui text-ink-500">
              {'role' in picked ? `${people(told)} will be told.` : "They'll be told."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
