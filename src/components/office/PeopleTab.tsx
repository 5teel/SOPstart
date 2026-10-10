'use client'

/**
 * Phase 59 (OFF-05, D-11, A-10) -- the People & roles tab.
 *
 * Lifted from the old team table: the same department picker and chips, now on the hardened
 * actions. The server decides who may do what; the controls here only mirror it. Admin-chunk
 * code: the Office pane is the only importer. No router, no navigation.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import {
  getTeamMembersWithEmails,
  inviteWorker,
  regenerateInviteCode,
  removeMember,
  updateMemberRoleSafe,
  type InvitedPerson,
  type TeamMember,
} from '@/actions/auth'
import { listDepartments } from '@/actions/departments'
import { DChip } from '@/components/admin/departments/DChip'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { useRole } from '@/components/providers/RoleProvider'
import { useObjectives } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'
import type { AppRole } from '@/types/auth'
import type { RowDone } from './InboxRow'

const PEOPLE_KEY = ['office-people']

const ROLE_WORDS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'SOP Admin',
  safety_manager: 'Safety Manager',
}
const ROLES = Object.keys(ROLE_WORDS) as AppRole[]

const SELECT =
  'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900 disabled:opacity-60'
const CHIP = 'rounded mono text-meta font-semibold px-2 py-1'
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FAILED_COPY = "That didn't work. Nothing was changed — try again."

function StatusChip({ invited }: { invited: boolean }) {
  // Active is the normal state, so it carries no tag; only the exception does.
  return invited ? <span className="tag tag-warn">Invited</span> : null
}

function RemoveDialog({
  email,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  email: string
  pending: boolean
  error: string | null
  onConfirm(): void
  onCancel(): void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    return () => {
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        if (!pending) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-remove-title"
        data-testid="people-remove-dialog"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-paper-1 p-6"
      >
        <h2 id="people-remove-title" className="text-lg font-semibold text-ink-900">
          Remove {email}?
        </h2>
        <p className="text-ui text-ink-700">They lose access to the site. Their past sign-offs stay on record.</p>
        {error && (
          <p role="alert" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            data-testid="people-remove-confirm"
            disabled={pending}
            onClick={onConfirm}
            className="min-h-tap flex-1 rounded-lg bg-accent-escalate text-ui font-semibold text-white disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            ref={cancelRef}
            data-testid="people-remove-cancel"
            disabled={pending}
            onClick={onCancel}
            className="min-h-tap flex-1 rounded-lg text-ui text-ink-700 hover:bg-paper-2"
          >
            Keep them
          </button>
        </div>
      </div>
    </div>
  )
}

export function PeopleTab({ onReceipt }: { onReceipt(r: RowDone): void }) {
  const role = useRole()
  const isAdmin = role === 'admin'
  const qc = useQueryClient()
  const objectives = useObjectives()

  const team = useQuery({ queryKey: PEOPLE_KEY, queryFn: () => getTeamMembersWithEmails() })
  const depts = useQuery({ queryKey: ['office-people-departments'], queryFn: () => listDepartments() })
  const departments = depts.data ?? []
  const deptMap = new Map(departments.map((d) => [d.id, d]))

  const data = team.data && 'members' in team.data ? team.data : null
  const members: TeamMember[] = data?.members ?? []
  const invited: InvitedPerson[] = data?.invited ?? []
  const refetch = () => qc.invalidateQueries({ queryKey: PEOPLE_KEY })

  // Invite form
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('worker')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Row state
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null)
  const [pendingRole, setPendingRole] = useState<string | null>(null)
  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [removePending, setRemovePending] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // Join code
  const [code, setCode] = useState<string | null>(null)
  const shownCode = code ?? data?.inviteCode ?? null
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Every action call is wrapped (59 review WR-03): a thrown action (network drop,
  // orphaned action, 5xx) must re-enable the control and say so, like InboxRow.run.
  async function sendInvite() {
    setInviting(true)
    setInviteError(null)
    try {
      const res = await inviteWorker({ email: email.trim(), role: inviteRole })
      if ('error' in res && res.error) {
        setInviteError(res.error)
        return
      }
      const added = 'success' in res && res.success === 'Added to the site'
      setInviteOpen(false)
      setEmail('')
      setInviteRole('worker')
      onReceipt({
        receipt: `${added ? 'Added to the site' : 'Invite sent'}`,
        logged: 'logged' in res ? (res.logged ?? null) : null,
      })
      await refetch()
    } catch {
      setInviteError(FAILED_COPY)
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(m: TeamMember, next: AppRole) {
    if (next === m.role) return
    setRowError(null)
    setPendingRole(m.id)
    try {
      const res = await updateMemberRoleSafe({ memberId: m.id, role: next })
      if ('error' in res && res.error) {
        // The select is controlled by the server's row, so a refusal leaves it on the old role.
        setRowError({ id: m.id, text: res.error })
        return
      }
      onReceipt({ receipt: `Role changed to ${ROLE_WORDS[next]}`, logged: 'logged' in res ? (res.logged ?? null) : null })
      await refetch()
    } catch {
      setRowError({ id: m.id, text: FAILED_COPY })
    } finally {
      setPendingRole(null)
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setRemovePending(true)
    setRemoveError(null)
    try {
      const res = await removeMember(removing.id)
      if ('error' in res && res.error) {
        setRemoveError(res.error)
        return
      }
      setRemoving(null)
      onReceipt({ receipt: 'Removed', logged: 'logged' in res ? (res.logged ?? null) : null })
      await refetch()
    } catch {
      setRemoveError(FAILED_COPY)
    } finally {
      setRemovePending(false)
    }
  }

  async function newCode() {
    setCodeBusy(true)
    setCodeError(null)
    try {
      const res = await regenerateInviteCode()
      if ('code' in res && res.code) setCode(res.code)
      else setCodeError(FAILED_COPY)
    } catch {
      setCodeError(FAILED_COPY)
    } finally {
      setCodeBusy(false)
    }
  }

  if (team.isLoading) {
    return (
      <p className="pt-6 text-ui text-ink-500" data-testid="people-loading">
        Loading people…
      </p>
    )
  }
  if (!data) {
    return (
      <p role="alert" className="pt-6 text-ui text-accent-escalate">
        {team.data && 'error' in team.data ? team.data.error : "That didn't load."}{' '}
        <button type="button" className="underline" onClick={() => team.refetch()}>
          Try again
        </button>
      </p>
    )
  }

  const total = members.length + invited.length
  const emailValid = EMAIL_OK.test(email.trim())

  return (
    <div data-testid="people-tab" className="flex flex-col gap-3 pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ui text-ink-500">{total === 1 ? '1 person' : `${total} people`}</span>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            data-testid="people-invite"
            disabled={!isAdmin}
            onClick={() => setInviteOpen((o) => !o)}
            className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:opacity-50"
          >
            Invite someone
          </button>
          {!isAdmin && <span className="text-meta text-ink-500">Only an admin can invite people.</span>}
        </div>
      </div>

      {inviteOpen && isAdmin && (
        <form
          data-testid="people-invite-form"
          className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-paper-1 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (emailValid && !inviting) void sendInvite()
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            setInviteOpen(false)
          }}
        >
          <label className="flex flex-col gap-1 text-ui font-semibold text-ink-900">
            Email
            <input
              type="email"
              autoFocus
              data-testid="people-invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-ink-300 bg-paper-1 p-3 text-reading font-normal text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-ui font-semibold text-ink-900">
            Role
            <select
              data-testid="people-invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AppRole)}
              className={`${SELECT} font-normal`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_WORDS[r]}
                </option>
              ))}
            </select>
            {inviteRole === 'admin' && (
              <span className="text-meta font-normal text-ink-500">
                Admins can change roles, invite people and publish SOPs.
              </span>
            )}
          </label>
          {inviteError && (
            <p role="alert" className="text-ui text-accent-escalate">
              {inviteError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="people-invite-send"
              disabled={!emailValid || inviting}
              className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:opacity-50"
            >
              Send invite
            </button>
            <button
              type="button"
              data-testid="people-invite-cancel"
              onClick={() => setInviteOpen(false)}
              className="min-h-tap rounded-lg px-4 text-ui text-ink-700 hover:bg-paper-2"
            >
              Don&apos;t invite
            </button>
          </div>
        </form>
      )}

      {total === 0 ? (
        <div className="py-8 text-center">
          <p className="text-lg font-semibold text-ink-900">Just you so far.</p>
          <p className="text-ui text-ink-500">Invite someone to give them access to the site.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="mono hidden grid-cols-12 gap-2 border-b border-ink-200 pb-2 text-meta uppercase tracking-wide text-ink-600 xl:grid">
            <span className="col-span-3">Email</span>
            <span className="col-span-3">Role</span>
            <span className="col-span-3">Departments</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1" />
          </div>

          {invited.map((p) => (
            <div
              key={p.user_id}
              data-testid="people-row"
              data-status="invited"
              className="flex flex-col gap-1 border-b border-ink-100 py-3 xl:grid xl:min-h-tap-row xl:grid-cols-12 xl:items-center xl:gap-2"
            >
              <div className="min-w-0 xl:col-span-3">
                <p className="truncate text-ui font-semibold text-ink-900" title={p.email ?? undefined}>
                  {p.email ?? 'Invited person'}
                </p>
                <p className="mono text-meta text-ink-600">Waiting to accept</p>
              </div>
              <span className="text-ui text-ink-700 xl:col-span-3">{ROLE_WORDS[p.role] ?? ROLE_WORDS.worker}</span>
              <span className="text-ui text-ink-500 xl:col-span-3">—</span>
              <span className="xl:col-span-2">
                <StatusChip invited />
              </span>
              <span className="xl:col-span-1" />
            </div>
          ))}

          {members.map((m) => {
            const mine = m.user_id === data.currentUserId
            const label = m.email ?? `${ROLE_WORDS[m.role]} (${m.user_id.slice(0, 8)})`
            const chips = m.department_ids.map((id) => deptMap.get(id)).filter((d) => !!d)
            return (
              <div key={m.id} data-testid="people-row" data-status="active" data-member-id={m.id} className="border-b border-ink-100 py-3">
                <div className="flex flex-col gap-2 xl:grid xl:min-h-tap-row xl:grid-cols-12 xl:items-center xl:gap-2">
                  <div className="flex min-w-0 items-center gap-2 xl:col-span-3">
                    <p className="truncate text-ui font-semibold text-ink-900" title={label}>
                      {label}
                    </p>
                    {mine && <span className={`${CHIP} shrink-0 bg-paper-2 text-ink-700`}>You</span>}
                    <span className="ml-auto xl:hidden">
                      <StatusChip invited={false} />
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 xl:col-span-3">
                    <select
                      data-testid="people-role-select"
                      aria-label={`Role for ${label}`}
                      value={m.role}
                      disabled={!isAdmin || pendingRole === m.id}
                      onChange={(e) => void changeRole(m, e.target.value as AppRole)}
                      className={SELECT}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_WORDS[r]}
                        </option>
                      ))}
                    </select>
                    {!isAdmin && <span className="text-meta text-ink-500">Only an admin can change roles.</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 xl:col-span-3" data-testid={`dept-col-${m.id}`}>
                    {chips.length === 0 && openPicker !== m.id && <span className="text-meta text-ink-500">No department</span>}
                    {chips.slice(0, 2).map((d) => (
                      <DChip key={d.id} variant="department" department={d} />
                    ))}
                    {chips.length > 2 && <span className="text-meta text-ink-500">+{chips.length - 2}</span>}
                    {departments.length > 0 && (
                      <DChip variant="add" onClick={() => setOpenPicker(openPicker === m.id ? null : m.id)} />
                    )}
                  </div>
                  <div className="hidden xl:col-span-2 xl:block">
                    <StatusChip invited={false} />
                  </div>
                  <div className="flex justify-end xl:col-span-1">
                    {!mine && (
                      <button
                        type="button"
                        data-testid="people-remove"
                        aria-label={`Remove ${label}`}
                        onClick={() => {
                          setRemoveError(null)
                          setRemoving(m)
                        }}
                        className="grid h-tap w-tap place-items-center text-ink-500 hover:text-accent-escalate"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <div data-testid="people-objective" className="pt-1">
                  <ObjectiveSlot
                    subject={{ type: 'person', id: m.user_id }}
                    current={objectives.find('person', m.user_id)}
                    emptyLabel="+ Objective"
                    emptyStyle="text"
                  />
                </div>
                {openPicker === m.id && (
                  <div className="mt-2">
                    <DepartmentPicker
                      mode="member"
                      memberId={m.user_id}
                      departments={departments}
                      selectedIds={m.department_ids}
                      onChange={() => {
                        onReceipt({ receipt: 'Departments updated', logged: null })
                        void refetch()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setOpenPicker(null)}
                      className="mt-2 min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper"
                    >
                      Done
                    </button>
                  </div>
                )}
                {rowError?.id === m.id && (
                  <p role="alert" data-testid="people-row-error" className="pt-1 text-ui text-accent-escalate">
                    {rowError.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-ui text-ink-500">
        <Link href="/admin/settings" className="underline-offset-2 hover:underline">
          Settings →
        </Link>
        {isAdmin && shownCode && (
          <span data-testid="people-join-code" className="flex items-center gap-2">
            Join code <span className="mono text-ink-900">{shownCode}</span>
            <button
              type="button"
              disabled={codeBusy}
              onClick={() => void newCode()}
              className="min-h-tap px-2 underline-offset-2 hover:underline disabled:opacity-50"
            >
              New code
            </button>
            {codeError && (
              <span role="alert" className="text-accent-escalate">
                {codeError}
              </span>
            )}
          </span>
        )}
      </div>

      {removing && (
        <RemoveDialog
          email={removing.email ?? 'this person'}
          pending={removePending}
          error={removeError}
          onConfirm={() => void confirmRemove()}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
