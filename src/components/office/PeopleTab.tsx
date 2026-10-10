'use client'

/**
 * Phase 59 (OFF-05, D-11, A-10) -- the People tab; redesigned 2026-10-11 as two views of the
 * same people:
 *   - Departments: each department with its people grouped by role, and a mark for each kind of
 *     authority (signs off, asks people to do SOPs, approves SOPs).
 *   - Who can do what: one row per person, one column per authority.
 * Clicking a person opens the person sheet, the one place their role, departments, objective and
 * removal are edited. The marks come from `authorityOf()` (lib/members/authority), which mirrors
 * the server gates for display only; the server still decides. Admin-chunk code: the Office pane
 * is the only importer. No router, no navigation.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, Send, Stamp, Trash2, X } from 'lucide-react'
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
import { getPeopleAuthorityData } from '@/actions/people'
import { DChip } from '@/components/admin/departments/DChip'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { useRole } from '@/components/providers/RoleProvider'
import { useObjectives } from '@/components/shell/ObjectiveLine'
import { ObjectiveSlot } from '@/components/shell/ObjectiveSlot'
import { authorityLines, authorityOf, ROLE_ORDER, ROLE_PLURAL, ROLE_WORDS, type Authority } from '@/lib/members/authority'
import type { Department } from '@/types/sop'
import type { AppRole } from '@/types/auth'
import type { RowDone } from './InboxRow'

const PEOPLE_KEY = ['office-people']
const AUTHORITY_KEY = ['office-people-authority']

const ROLES = ROLE_ORDER.slice().reverse()

const SELECT =
  'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900 disabled:opacity-60'
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FAILED_COPY = "That didn't work. Nothing was changed — try again."

type View = 'departments' | 'authority'

const nameOf = (m: TeamMember) => m.email ?? `${ROLE_WORDS[m.role]} (${m.user_id.slice(0, 8)})`

/** The three marks a person can carry on the board. Ink tags: authority is not a safety signal. */
function Marks({ a }: { a: Authority }) {
  return (
    <span className="flex flex-wrap gap-1">
      {a.signOff && (
        <span
          className={`tag gap-1 ${a.signOff === 'supervised' && a.supervises === 0 ? 'tag-warn' : ''}`}
          title={a.signOff === 'any' ? "Signs off anyone's completed SOPs" : `Signs off ${a.supervises} supervised worker(s)`}
        >
          <ClipboardCheck size={12} aria-hidden="true" />
          Signs off{a.signOff === 'supervised' ? ` ${a.supervises}` : ''}
        </span>
      )}
      {a.assigns && (
        <span className="tag gap-1" title="Asks people to do SOPs">
          <Send size={12} aria-hidden="true" />
          Assigns
        </span>
      )}
      {a.approves.length > 0 && (
        <span className="tag gap-1" title={`Approves SOPs in ${a.approves.join(', ')}`}>
          <Stamp size={12} aria-hidden="true" />
          Approves
        </span>
      )}
    </span>
  )
}

function Legend() {
  return (
    <div data-testid="people-legend" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-600">
      <span className="flex items-center gap-1.5">
        <span className="tag gap-1">
          <ClipboardCheck size={12} aria-hidden="true" />
          Signs off
        </span>
        completed SOPs (a number = the workers they supervise)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="tag gap-1">
          <Send size={12} aria-hidden="true" />
          Assigns
        </span>
        asks people to do SOPs
      </span>
      <span className="flex items-center gap-1.5">
        <span className="tag gap-1">
          <Stamp size={12} aria-hidden="true" />
          Approves
        </span>
        SOPs before they publish
      </span>
    </div>
  )
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

/** A person on the department board: name, and the marks. Opens the sheet. */
function PersonCard({ m, a, onOpen }: { m: TeamMember; a: Authority; onOpen(): void }) {
  return (
    <button
      type="button"
      data-testid="people-card"
      data-member-id={m.id}
      onClick={onOpen}
      className="flex w-full flex-col items-start gap-1 rounded-lg px-2 py-2 text-left hover:bg-paper-2"
    >
      <span className="w-full truncate text-ui font-semibold text-ink-900" title={nameOf(m)}>
        {nameOf(m)}
      </span>
      <Marks a={a} />
    </button>
  )
}

function DepartmentBoard({
  departments,
  members,
  invited,
  auth,
  onOpen,
}: {
  departments: Department[]
  members: TeamMember[]
  invited: InvitedPerson[]
  auth(m: TeamMember): Authority
  onOpen(m: TeamMember): void
}) {
  const all = departments.map((d) => ({
    key: d.id,
    name: d.name,
    colour: d.colour as string | null,
    people: members.filter((m) => m.department_ids.includes(d.id)),
  }))
  // People nobody has placed come first (they are the admin's to-do); departments with people next;
  // empty departments fold into one quiet line at the end so they never push people off the screen.
  const loose = members.filter((m) => !m.department_ids.some((id) => departments.some((d) => d.id === id)))
  const groups = [
    ...(loose.length > 0 ? [{ key: 'none', name: 'No department', colour: null as string | null, people: loose }] : []),
    ...all.filter((g) => g.people.length > 0),
  ]
  const empty = all.filter((g) => g.people.length === 0)

  return (
    <div data-testid="people-board" className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.key}
          data-testid="people-department"
          data-department={g.key}
          className={`flex flex-col gap-3 rounded-lg border bg-paper-1 p-4 ${g.key === 'none' ? 'border-dashed border-ink-300' : 'border-ink-200'}`}
        >
          <header className="flex items-center gap-2">
            {g.colour && <i aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: g.colour }} />}
            <h3 className="section-heading min-w-0 flex-1 truncate">{g.name}</h3>
            <span className="mono text-meta text-ink-600">{g.people.length === 1 ? '1 person' : `${g.people.length} people`}</span>
          </header>
          {g.key === 'none' && <p className="text-meta text-ink-600">Open a person to give them a department.</p>}
          {ROLE_ORDER.map((r) => {
              const own = g.people.filter((m) => m.role === r)
              if (own.length === 0) return null
              return (
                <div key={r} className="flex flex-col gap-0.5">
                  <p className="text-meta font-semibold text-ink-600">{ROLE_PLURAL[r]}</p>
                  {own.map((m) => (
                    <PersonCard key={m.id} m={m} a={auth(m)} onOpen={() => onOpen(m)} />
                  ))}
                </div>
              )
            })}
        </section>
      ))}
      {invited.length > 0 && (
        <section data-testid="people-department" data-department="invited" className="flex flex-col gap-2 rounded-lg border border-dashed border-ink-300 p-4">
          <header className="flex items-center gap-2">
            <h3 className="section-heading flex-1">Invited, not joined yet</h3>
            <span className="mono text-meta text-ink-600">{invited.length}</span>
          </header>
          {invited.map((p) => (
            <p key={p.user_id} className="flex items-center gap-2 px-2 text-ui text-ink-700">
              <span className="min-w-0 flex-1 truncate">{p.email ?? 'Invited person'}</span>
              <span className="text-meta text-ink-600">{ROLE_WORDS[p.role] ?? ROLE_WORDS.worker}</span>
            </p>
          ))}
        </section>
      )}
      {empty.length > 0 && (
        <section data-testid="people-empty-departments" className="flex flex-col gap-2 lg:col-span-2 2xl:col-span-3">
          <h3 className="text-ui font-semibold text-ink-700">
            {empty.length === 1 ? '1 department has nobody in it yet' : `${empty.length} departments have nobody in them yet`}
          </h3>
          <p className="flex flex-wrap gap-1">
            {empty.map((g) => (
              <span key={g.key} className="tag gap-1.5 font-medium">
                {g.colour && <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: g.colour }} />}
                {g.name}
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  )
}

const YES = (
  <span className="inline-flex items-center gap-1 text-ink-900">
    <Check size={14} aria-hidden="true" />
    <span className="sr-only">Yes</span>
  </span>
)
const NO = <span className="text-ink-300">—</span>

function AuthorityGrid({
  members,
  invited,
  deptMap,
  auth,
  currentUserId,
  onOpen,
}: {
  members: TeamMember[]
  invited: InvitedPerson[]
  deptMap: Map<string, Department>
  auth(m: TeamMember): Authority
  currentUserId: string
  onOpen(m: TeamMember): void
}) {
  const sorted = ROLE_ORDER.flatMap((r) => members.filter((m) => m.role === r))
  const TH = 'border-b border-ink-200 px-3 pb-2 text-left text-meta font-semibold text-ink-600'
  const TD = 'border-b border-ink-100 px-3 py-3 align-top text-ui'
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table data-testid="people-grid" className="w-full min-w-200 border-collapse">
          <thead>
            <tr>
              <th className={TH}>Person</th>
              <th className={TH}>Role</th>
              <th className={TH}>Departments</th>
              <th className={TH}>Signs off work</th>
              <th className={TH}>Assigns SOPs</th>
              <th className={TH}>Approves SOPs</th>
              <th className={TH}>Publishes</th>
              <th className={TH}>Manages people</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const a = auth(m)
              const depts = m.department_ids.map((id) => deptMap.get(id)).filter((d): d is Department => !!d)
              return (
                <tr
                  key={m.id}
                  data-testid="people-row"
                  data-status="active"
                  data-member-id={m.id}
                  tabIndex={0}
                  onClick={() => onOpen(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(m)
                    }
                  }}
                  className="cursor-pointer hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-accent-step"
                >
                  <td className={`${TD} max-w-60`}>
                    <span className="block truncate font-semibold text-ink-900" title={nameOf(m)}>
                      {nameOf(m)}
                    </span>
                    {m.user_id === currentUserId && <span className="text-meta text-ink-600">You</span>}
                  </td>
                  <td className={`${TD} text-ink-700`}>{ROLE_WORDS[m.role]}</td>
                  <td className={TD}>
                    {depts.length === 0 ? (
                      <span className="text-meta text-ink-500">No department</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {depts.map((d) => (
                          <DChip key={d.id} variant="department" department={d} />
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    {a.signOff === 'any' ? (
                      <span className="text-ink-900">Anyone</span>
                    ) : a.signOff === 'supervised' ? (
                      a.supervises === 0 ? (
                        <span className="tag tag-warn">No workers linked</span>
                      ) : (
                        <span className="text-ink-900">{a.supervises === 1 ? '1 worker' : `${a.supervises} workers`}</span>
                      )
                    ) : (
                      NO
                    )}
                  </td>
                  <td className={TD}>{a.assigns ? YES : NO}</td>
                  <td className={TD}>{a.approves.length > 0 ? <span className="text-ink-900">{a.approves.join(', ')}</span> : NO}</td>
                  <td className={TD}>{a.publishes ? YES : NO}</td>
                  <td className={TD}>{a.managesPeople ? YES : NO}</td>
                </tr>
              )
            })}
            {invited.map((p) => (
              <tr key={p.user_id} data-testid="people-row" data-status="invited">
                <td className={`${TD} max-w-60`}>
                  <span className="block truncate font-semibold text-ink-900" title={p.email ?? undefined}>
                    {p.email ?? 'Invited person'}
                  </span>
                  <span className="mono text-meta text-ink-600">Waiting to accept</span>
                </td>
                <td className={`${TD} text-ink-700`}>{ROLE_WORDS[p.role] ?? ROLE_WORDS.worker}</td>
                <td className={TD} colSpan={6}>
                  <span className="tag tag-warn">Invited</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-meta text-ink-600">
        Supervisors sign off only the workers linked to them, and only on SOPs they are signed off on themselves. Admins and
        safety managers sign off anyone, giving a reason when they are not signed off on the SOP. Approvers are set per SOP
        category in{' '}
        <Link href="/admin/settings" className="underline">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}

export function PeopleTab({ onReceipt }: { onReceipt(r: RowDone): void }) {
  const role = useRole()
  const isAdmin = role === 'admin'
  const qc = useQueryClient()

  const team = useQuery({ queryKey: PEOPLE_KEY, queryFn: () => getTeamMembersWithEmails() })
  const depts = useQuery({ queryKey: ['office-people-departments'], queryFn: () => listDepartments() })
  const authority = useQuery({ queryKey: AUTHORITY_KEY, queryFn: () => getPeopleAuthorityData() })
  const departments = depts.data ?? []
  const deptMap = new Map<string, Department>(departments.map((d) => [d.id, d]))
  const authData = authority.data && !('error' in authority.data) ? authority.data : { chains: [], supervision: [] }
  const auth = (m: TeamMember) => authorityOf(m, authData.chains, authData.supervision)

  const data = team.data && 'members' in team.data ? team.data : null
  const members: TeamMember[] = data?.members ?? []
  const invited: InvitedPerson[] = data?.invited ?? []
  const refetch = () => qc.invalidateQueries({ queryKey: PEOPLE_KEY })

  const [view, setView] = useState<View>('departments')
  const [openId, setOpenId] = useState<string | null>(null)
  const open = members.find((m) => m.id === openId) ?? null

  // Invite form
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('worker')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Sheet state
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null)
  const [pendingRole, setPendingRole] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [removePending, setRemovePending] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // Join code
  const [code, setCode] = useState<string | null>(null)
  const shownCode = code ?? data?.inviteCode ?? null
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  function openPerson(m: TeamMember) {
    setRowError(null)
    setPickerOpen(false)
    setOpenId(m.id)
  }

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
      setOpenId(null)
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
  const unplaced = members.filter((m) => m.department_ids.length === 0).length

  return (
    <div data-testid="people-tab" className="flex flex-col gap-4 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="mono text-meta text-ink-600">
          {total === 1 ? '1 person' : `${total} people`} · {departments.length === 1 ? '1 department' : `${departments.length} departments`}
          {unplaced > 0 ? ` · ${unplaced} without a department` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="seg">
            <button type="button" data-testid="people-view-departments" aria-pressed={view === 'departments'} onClick={() => setView('departments')}>
              Departments
            </button>
            <button type="button" data-testid="people-view-authority" aria-pressed={view === 'authority'} onClick={() => setView('authority')}>
              Who can do what
            </button>
          </span>
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
        <div className="py-8">
          <p className="section-heading">Just you so far.</p>
          <p className="text-ui text-ink-500">Invite someone to give them access to the site.</p>
        </div>
      ) : view === 'departments' ? (
        <>
          <Legend />
          <DepartmentBoard departments={departments} members={members} invited={invited} auth={auth} onOpen={openPerson} />
        </>
      ) : (
        <AuthorityGrid
          members={members}
          invited={invited}
          deptMap={deptMap}
          auth={auth}
          currentUserId={data.currentUserId ?? ''}
          onOpen={openPerson}
        />
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

      {open && (
        <PersonSheet
          m={open}
          a={auth(open)}
          mine={open.user_id === data.currentUserId}
          isAdmin={isAdmin}
          departments={departments}
          deptMap={deptMap}
          members={members}
          supervision={authData.supervision}
          pendingRole={pendingRole === open.id}
          rowError={rowError?.id === open.id ? rowError.text : null}
          pickerOpen={pickerOpen}
          onPicker={setPickerOpen}
          onRole={(r) => void changeRole(open, r)}
          onDepartments={() => {
            onReceipt({ receipt: 'Departments updated', logged: null })
            void refetch()
          }}
          onRemove={() => {
            setRemoveError(null)
            setRemoving(open)
          }}
          onClose={() => setOpenId(null)}
        />
      )}

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

/** The one place a person is edited: role, departments, objective, removal; and what they may do. */
function PersonSheet({
  m,
  a,
  mine,
  isAdmin,
  departments,
  deptMap,
  members,
  supervision,
  pendingRole,
  rowError,
  pickerOpen,
  onPicker,
  onRole,
  onDepartments,
  onRemove,
  onClose,
}: {
  m: TeamMember
  a: Authority
  mine: boolean
  isAdmin: boolean
  departments: Department[]
  deptMap: Map<string, Department>
  members: TeamMember[]
  supervision: ReadonlyArray<{ supervisor_id: string; worker_id: string }>
  pendingRole: boolean
  rowError: string | null
  pickerOpen: boolean
  onPicker(open: boolean): void
  onRole(r: AppRole): void
  onDepartments(): void
  onRemove(): void
  onClose(): void
}) {
  const objectives = useObjectives()
  const label = nameOf(m)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [m.id])
  const chips = m.department_ids.map((id) => deptMap.get(id)).filter((d): d is Department => !!d)
  const byUser = new Map(members.map((x) => [x.user_id, x]))
  const supervises = supervision.filter((s) => s.supervisor_id === m.user_id).map((s) => byUser.get(s.worker_id)).filter((x): x is TeamMember => !!x)
  const supervisedBy = supervision.filter((s) => s.worker_id === m.user_id).map((s) => byUser.get(s.supervisor_id)).filter((x): x is TeamMember => !!x)
  const H = 'text-ui font-semibold text-ink-700'

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink-900/20"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-sheet-title"
        data-testid="person-sheet"
        data-member-id={m.id}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-ink-200 bg-paper-1 p-5"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="person-sheet-title" className="truncate text-lg font-semibold text-ink-900" title={label}>
              {label}
            </h2>
            <p className="text-ui text-ink-600">
              {ROLE_WORDS[m.role]}
              {mine ? ' · You' : ''}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            data-testid="person-sheet-close"
            aria-label="Close"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-lg text-ink-700 hover:bg-paper-2"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <section className="flex flex-col gap-2">
          <h3 className={H}>What they can do</h3>
          <ul data-testid="person-authority" className="flex flex-col gap-1.5">
            {authorityLines(a).map((l) => (
              <li key={l} className="flex items-start gap-2 text-ui text-ink-900">
                <Check size={14} className="mt-0.5 shrink-0 text-ink-600" aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
          <Marks a={a} />
        </section>

        <section className="flex flex-col gap-1">
          <label htmlFor="person-role" className={H}>
            Role
          </label>
          <select
            id="person-role"
            data-testid="people-role-select"
            aria-label={`Role for ${label}`}
            value={m.role}
            disabled={!isAdmin || pendingRole}
            onChange={(e) => onRole(e.target.value as AppRole)}
            className={SELECT}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_WORDS[r]}
              </option>
            ))}
          </select>
          {!isAdmin && <span className="text-meta text-ink-500">Only an admin can change roles.</span>}
          {rowError && (
            <p role="alert" data-testid="people-row-error" className="text-ui text-accent-escalate">
              {rowError}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2" data-testid={`dept-col-${m.id}`}>
          <h3 className={H}>Departments</h3>
          <div className="flex flex-wrap items-center gap-1">
            {chips.length === 0 && !pickerOpen && <span className="text-meta text-ink-500">No department</span>}
            {chips.map((d) => (
              <DChip key={d.id} variant="department" department={d} />
            ))}
            {departments.length > 0 && !pickerOpen && <DChip variant="add" onClick={() => onPicker(true)} />}
          </div>
          {pickerOpen && (
            <div>
              <DepartmentPicker mode="member" memberId={m.user_id} departments={departments} selectedIds={m.department_ids} onChange={onDepartments} />
              <button
                type="button"
                onClick={() => onPicker(false)}
                className="mt-2 min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper"
              >
                Done
              </button>
            </div>
          )}
        </section>

        {(supervises.length > 0 || supervisedBy.length > 0) && (
          <section className="flex flex-col gap-1">
            <h3 className={H}>{supervises.length > 0 ? 'Supervises' : 'Supervised by'}</h3>
            {(supervises.length > 0 ? supervises : supervisedBy).map((x) => (
              <p key={x.id} className="truncate text-ui text-ink-900">
                {nameOf(x)}
              </p>
            ))}
          </section>
        )}

        <section data-testid="people-objective" className="flex flex-col gap-1">
          <h3 className={H}>Objective</h3>
          <ObjectiveSlot
            subject={{ type: 'person', id: m.user_id }}
            current={objectives.find('person', m.user_id)}
            emptyLabel="+ Objective"
            emptyStyle="text"
          />
        </section>

        {!mine && (
          <div className="mt-auto border-t border-ink-200 pt-4">
            <button
              type="button"
              data-testid="people-remove"
              aria-label={`Remove ${label}`}
              onClick={onRemove}
              className="inline-flex min-h-tap items-center gap-2 rounded-lg px-3 text-ui text-ink-700 hover:text-accent-escalate"
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove from the site
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
