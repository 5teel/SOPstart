'use client'

/**
 * ADR-0020 (sketch 013 D) -- the People chart: the site, its departments (nested ones folded inside
 * their parent), each department's job roles with filled-of-planned seats, and the people in them.
 * One chart carries every People question through a quiet Show switch, in words and bars, never
 * new symbols (ADR-0019's rule):
 *  - People: who sits where; open a supervisor and the people they look after light up.
 *  - Who can: sign off, approve changes, publish, manage people; a department says when nobody can.
 *  - Training: a bar on everyone in an open department (getTrainingMatrix, one department a read).
 *  - SOP access: pick a SOP; who can see it, from the materialised access tables. Changing access
 *    goes to the SOP access tab pinned to that SOP, where the collection-override rules are shown.
 *
 * Built for large organisations: departments collapse to one summary row, Open all / Close all,
 * and Find a person opens the departments that hold a match. Large charts start closed.
 *
 * A face opens the existing person sheet (PeopleTab owns it). ADR-0021: job roles are edited here --
 * + Add a role, Edit (rename, seats, take people out, remove), and an empty seat that seats someone
 * from the department or opens the invite form. Every other write stays on the sheet, the invite
 * form and the SOP access tab.
 */

import { useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRole, listOrgTree, removeRole, setRoleSeat, updateRole } from '@/actions/org-model'
import { getTrainingMatrix } from '@/actions/competency'
import { libraryQueryFn } from '@/hooks/useLibrary'
import { createClient } from '@/lib/supabase/client'
import { ROLE_ORDER, ROLE_PLURAL, ROLE_WORDS, type Authority } from '@/lib/members/authority'
import type { TeamMember, InvitedPerson } from '@/actions/auth'
import type { Department } from '@/types/sop'

type Lens = 'people' | 'who' | 'training' | 'access'
type Power = 'signoff' | 'approves' | 'publishes' | 'people'

const POWER_WORDS: Record<Power, string> = { signoff: 'signs off', approves: 'approves changes', publishes: 'publishes', people: 'manages people' }
const POWER_PLURAL: Record<Power, string> = { signoff: 'sign off', approves: 'approve changes', publishes: 'publish', people: 'manage people' }
const has = (a: Authority, p: Power) =>
  p === 'signoff' ? a.signOff !== null : p === 'approves' ? a.approves.length > 0 : p === 'publishes' ? a.publishes : a.managesPeople

// ponytail: a chart this size reads better open; past it, departments start closed.
const OPEN_ALL_PEOPLE = 40
const OPEN_ALL_DEPARTMENTS = 8

const shortName = (s: string) => (s.includes('@') ? s.split('@')[0]! : s)
const initials = (s: string) =>
  shortName(s)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'
const label = (m: TeamMember) => m.email ?? ROLE_WORDS[m.role]

interface DeptNode {
  dept: Department
  children: DeptNode[]
}

export function OrgChart({
  siteName,
  members,
  invited,
  departments,
  auth,
  supervision,
  openUserId,
  onOpen,
  onInvite,
  onChangeAccess,
}: {
  siteName: string
  members: TeamMember[]
  invited: InvitedPerson[]
  departments: Department[]
  auth(m: TeamMember): Authority
  supervision: ReadonlyArray<{ supervisor_id: string; worker_id: string }>
  /** The person whose sheet is open; their people light up in the People view. */
  openUserId: string | null
  onOpen(m: TeamMember): void
  onInvite(): void
  onChangeAccess(sopId: string): void
}) {
  const [lens, setLens] = useState<Lens>('people')
  const [power, setPower] = useState<Power>('signoff')
  const [sopId, setSopId] = useState<string>('')
  const [find, setFind] = useState('')
  const [open, setOpen] = useState<Set<string> | null>(null)

  // Job roles (ADR-0021): one form open at a time.
  const qc = useQueryClient()
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', seats: '1' })
  const [edit, setEdit] = useState<{ roleId: string; name: string; seats: string; confirm: boolean } | null>(null)
  const [seatPick, setSeatPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState<{ place: string; text: string } | null>(null)
  const seatsOf = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN)

  // Every write is wrapped: a thrown action (network drop) must not leave the form stuck busy.
  async function run(place: string, call: () => Promise<object>, after: () => void) {
    setBusy(true)
    setFail(null)
    try {
      const r = await call()
      if ('error' in r) return setFail({ place, text: String((r as { error: string }).error) })
      after()
      await qc.invalidateQueries({ queryKey: ['office-org-tree'] })
      void qc.invalidateQueries({ queryKey: ['training-tree'] })
    } catch {
      setFail({ place, text: 'Could not save. Check the connection and try again.' })
    } finally {
      setBusy(false)
    }
  }
  const addRole = (departmentId: string) => {
    const seats = seatsOf(draft.seats)
    if (Number.isNaN(seats)) return setFail({ place: departmentId, text: 'Seats is a whole number.' })
    return run(departmentId, () => createRole({ departmentId, name: draft.name, budgetedCount: seats }), () => setAdding(null))
  }
  const saveRole = (roleId: string) => {
    const seats = seatsOf(edit?.seats ?? '')
    if (Number.isNaN(seats)) return setFail({ place: roleId, text: 'Seats is a whole number.' })
    return run(roleId, () => updateRole({ id: roleId, name: edit!.name, budgetedCount: seats }), () => setEdit(null))
  }
  const dropRole = (roleId: string) => run(roleId, () => removeRole(roleId), () => setEdit(null))
  const seat = (roleId: string, memberId: string, seated: boolean) =>
    run(roleId, () => setRoleSeat({ roleId, memberId, seated }), () => setSeatPick(null))

  const live = departments.filter((d) => !d.archived)
  const treeQ = useQuery({ queryKey: ['office-org-tree'], queryFn: () => listOrgTree() })
  const tree = treeQ.data && !('error' in treeQ.data) ? treeQ.data : null

  // Departments nest (ADR-0010): children sit inside their parent's card.
  const roots = useMemo<DeptNode[]>(() => {
    const parentOf = (d: Department) => (d as Department & { parent_id?: string | null }).parent_id ?? null
    const ids = new Set(live.map((d) => d.id))
    const nodes = new Map(live.map((d) => [d.id, { dept: d, children: [] as DeptNode[] }]))
    const top: DeptNode[] = []
    for (const d of live) {
      const p = parentOf(d)
      if (p && ids.has(p) && p !== d.id) nodes.get(p)!.children.push(nodes.get(d.id)!)
      else top.push(nodes.get(d.id)!)
    }
    return top
  }, [live])

  const byUser = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])
  const inDept = (id: string) => members.filter((m) => m.department_ids.includes(id))
  const noDept = members.filter((m) => m.department_ids.length === 0)
  const subtree = (n: DeptNode): string[] => [n.dept.id, ...n.children.flatMap(subtree)]
  const allNodes = (ns: DeptNode[]): DeptNode[] => ns.flatMap((n) => [n, ...allNodes(n.children)])

  // Job roles per department (the org tree), with filled-of-planned seats.
  const rolesOf = (deptId: string) => {
    const d = [...(tree?.areas.flatMap((a) => a.departments) ?? []), ...(tree?.ungroupedDepartments ?? [])].find((x) => x.id === deptId)
    return d?.roles ?? []
  }

  // What lights up, and which departments open on their own.
  const q = find.trim().toLowerCase()
  const supervisees = openUserId ? new Set(supervision.filter((s) => s.supervisor_id === openUserId).map((s) => s.worker_id)) : new Set<string>()

  const libQ = useQuery({ queryKey: ['library-sops'], queryFn: libraryQueryFn, staleTime: 1000 * 60 * 2, enabled: lens === 'access' })
  const sops = libQ.data ?? []
  const sop = sops.find((s) => s.id === sopId) ?? null
  const accessQ = useQuery({
    queryKey: ['org-chart-access', sopId],
    enabled: lens === 'access' && !!sop,
    queryFn: async () => {
      const supabase = createClient()
      const ids = [sop!.id, (sop as { parent_sop_id?: string | null }).parent_sop_id].filter((x): x is string => !!x)
      const [d, p] = await Promise.all([
        supabase.from('sop_departments').select('department_id').in('sop_id', ids),
        supabase.from('sop_access_people').select('member_id').in('sop_id', ids),
      ])
      if (d.error) throw new Error(d.error.message)
      if (p.error) throw new Error(p.error.message)
      return {
        depts: new Set((d.data ?? []).map((r: { department_id: string }) => r.department_id)),
        people: new Set((p.data ?? []).map((r: { member_id: string }) => r.member_id)),
      }
    },
  })
  const access = accessQ.data ?? null
  const canSee = (m: TeamMember) => !!access && (access.people.has(m.user_id) || m.department_ids.some((d) => access.depts.has(d)))

  const lit = (m: TeamMember): boolean => {
    if (q) return label(m).toLowerCase().includes(q)
    if (lens === 'people') return supervisees.has(m.user_id)
    if (lens === 'who') return has(auth(m), power)
    if (lens === 'access') return canSee(m)
    return false
  }
  const dimming = !!q || (lens === 'people' && supervisees.size > 0) || lens === 'who' || (lens === 'access' && !!access)

  const auto = new Set<string>()
  for (const n of allNodes(roots)) {
    const ppl = subtree(n).flatMap(inDept)
    if ((q || (lens === 'people' && supervisees.size > 0)) && ppl.some(lit)) auto.add(n.dept.id)
  }
  const small = members.length <= OPEN_ALL_PEOPLE && live.length <= OPEN_ALL_DEPARTMENTS
  const openSet = open ?? new Set(small ? live.map((d) => d.id) : [])
  const isOpen = (id: string) => openSet.has(id) || auto.has(id)
  const toggle = (id: string) => {
    const next = new Set(openSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }
  const allOpen = live.length > 0 && live.every((d) => openSet.has(d.id))

  // Training: one matrix read per open department, only while the Training view is on.
  const trainingIds = lens === 'training' ? live.filter((d) => isOpen(d.id)).map((d) => d.id) : []
  const trainingQs = useQueries({
    queries: trainingIds.map((id) => ({ queryKey: ['training-matrix', id], queryFn: () => getTrainingMatrix({ departmentId: id }), staleTime: 1000 * 60 })),
  })
  // A person in two open departments is counted once per SOP.
  const sopsByUser = new Map<string, Map<string, boolean>>()
  const deptTraining = new Map<string, { n: number; of: number }>()
  trainingIds.forEach((id, i) => {
    const r = trainingQs[i]?.data
    if (!r || 'error' in r) return
    const cells = r.matrix.cells
    deptTraining.set(id, { n: cells.filter((c) => c.state === 'competent_signed_off').length, of: cells.length })
    for (const c of cells) {
      if (!sopsByUser.has(c.personId)) sopsByUser.set(c.personId, new Map())
      sopsByUser.get(c.personId)!.set(c.sopId, c.state === 'competent_signed_off')
    }
  })
  const signedByUser = new Map([...sopsByUser].map(([u, m]) => [u, { n: [...m.values()].filter(Boolean).length, of: m.size }]))

  const bar = (n: number, of: number) => (
    <span className="lane-fill w-24">
      <i style={{ width: `${of ? (n / of) * 100 : 0}%` }} />
    </span>
  )

  const chip = (m: TeamMember) => {
    const a = auth(m)
    let extra: React.ReactNode = null
    if (lens === 'people' && a.supervises > 0) extra = `looks after ${a.supervises}`
    if (lens === 'who' && has(a, power)) extra = power === 'signoff' && a.signOff === 'supervised' ? 'signs off their people' : POWER_WORDS[power]
    if (lens === 'training') {
      const t = signedByUser.get(m.user_id)
      extra = t ? (
        <span className="flex items-center gap-1.5">
          {bar(t.n, t.of)}
          {t.n} of {t.of} signed off
        </span>
      ) : null
    }
    if (lens === 'access' && canSee(m)) extra = access!.people.has(m.user_id) && !m.department_ids.some((d) => access!.depts.has(d)) ? 'by name' : 'through department'
    return (
      <button
        key={m.id}
        type="button"
        data-testid="org-person"
        data-member-id={m.id}
        className={`org-person${dimming && !lit(m) ? ' org-dim' : ''}${dimming && lit(m) ? ' org-lit' : ''}${m.user_id === openUserId ? ' org-sel' : ''}`}
        onClick={() => onOpen(m)}
      >
        <span className="flex items-center gap-1.5">
          <span className="face-av">{initials(label(m))}</span>
          <span className="min-w-0 truncate">{shortName(label(m))}</span>
        </span>
        {extra && <span className="org-person-note">{extra}</span>}
      </button>
    )
  }

  const deptSummary = (n: DeptNode) => {
    const ppl = subtree(n).flatMap(inDept)
    const uniq = [...new Map(ppl.map((m) => [m.id, m])).values()]
    if (lens === 'who') {
      const k = uniq.filter((m) => has(auth(m), power)).length
      if (uniq.length === 0) return <span>0 people</span>
      return k > 0 ? <span>{k} {k === 1 ? POWER_WORDS[power] : POWER_PLURAL[power]}</span> : <span className="tag tag-warn">Nobody here {POWER_WORDS[power]}</span>
    }
    if (lens === 'training') {
      const t = deptTraining.get(n.dept.id)
      if (!isOpen(n.dept.id)) return <span>Open to see training</span>
      return t ? (
        <span className="flex items-center gap-1.5">
          {bar(t.n, t.of)}
          {t.n} of {t.of} signed off
        </span>
      ) : (
        <span>Loading…</span>
      )
    }
    if (lens === 'access' && access) return access.depts.has(n.dept.id) ? <b className="text-ink-900">Can see it</b> : <span>Can’t see it</span>
    const seats = rolesOf(n.dept.id).reduce((s, r) => s + Math.max(0, r.budgetedCount - r.filledCount), 0)
    return (
      <span>
        {uniq.length === 1 ? '1 person' : `${uniq.length} people`}
        {seats > 0 ? ` · ${seats} empty seat${seats === 1 ? '' : 's'}` : ''}
      </span>
    )
  }

  const deptBody = (n: DeptNode) => {
    const here = inDept(n.dept.id)
    const roles = rolesOf(n.dept.id)
    const seated = new Set<string>()
    const groups: Array<{ key: string; roleId: string | null; name: string; cap: string; ppl: TeamMember[]; seats: number; planned: number }> = roles.map((r) => {
      const ppl = r.people.filter((p) => !p.isVacancy && p.id).map((p) => byUser.get(p.id!)).filter((m): m is TeamMember => !!m)
      ppl.forEach((m) => seated.add(m.id))
      return { key: r.id, roleId: r.id, name: r.name, cap: `${r.filledCount} of ${r.budgetedCount}`, ppl, seats: Math.max(0, r.budgetedCount - r.filledCount), planned: r.budgetedCount }
    })
    const rest = here.filter((m) => !seated.has(m.id))
    for (const role of ROLE_ORDER) {
      const ppl = rest.filter((m) => m.role === role)
      if (ppl.length) groups.push({ key: role, roleId: null, name: ROLE_PLURAL[role], cap: '', ppl, seats: 0, planned: 0 })
    }
    const input = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900'
    const quiet = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui font-semibold text-ink-900 disabled:opacity-50'
    const primary = 'min-h-tap rounded-lg bg-ink-900 px-3 text-ui font-semibold text-paper disabled:opacity-50'
    return (
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const editing = g.roleId !== null && edit?.roleId === g.roleId
          const picking = g.roleId !== null && seatPick === g.roleId
          return (
            <div key={g.key} className="org-role" data-testid={g.roleId ? 'org-role' : undefined}>
              {editing ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-micro text-ink-500">
                    Role
                    <input className={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="org-role-name" />
                  </label>
                  <label className="flex w-20 flex-col gap-1 text-micro text-ink-500">
                    Seats
                    <input type="number" min={0} className={input} value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: e.target.value })} data-testid="org-role-seats" />
                  </label>
                  <button type="button" className={primary} disabled={busy} onClick={() => void saveRole(g.roleId!)} data-testid="org-role-save">
                    Save
                  </button>
                  <button type="button" className={quiet} disabled={busy} onClick={() => setEdit(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-meta font-semibold text-ink-900">{g.name}</span>
                  <span className="flex items-baseline gap-2">
                    {g.cap && <span className="mono text-micro text-ink-600">{g.cap}</span>}
                    {g.roleId && (
                      <button
                        type="button"
                        className="text-micro font-semibold text-ink-600 underline-offset-2 hover:underline"
                        data-testid="org-role-edit"
                        onClick={() => {
                          setEdit({ roleId: g.roleId!, name: g.name, seats: String(g.planned), confirm: false })
                          setSeatPick(null)
                          setFail(null)
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {g.ppl.map((m) =>
                  editing ? (
                    <span key={m.id} className="flex items-center gap-1">
                      {chip(m)}
                      <button type="button" className="text-micro font-semibold text-ink-600 underline" disabled={busy} onClick={() => void seat(g.roleId!, m.user_id, false)} data-testid="org-role-unseat">
                        Take out
                      </button>
                    </span>
                  ) : (
                    chip(m)
                  ),
                )}
                {!editing &&
                  Array.from({ length: g.seats }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="org-person org-seat"
                      data-testid="org-seat"
                      onClick={() => {
                        setSeatPick(picking ? null : g.roleId)
                        setEdit(null)
                        setFail(null)
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="face-av org-seat-av">+</span>
                        Empty seat
                      </span>
                    </button>
                  ))}
              </div>
              {picking && (
                <div className="flex flex-col gap-1.5 border-t border-ink-200 pt-2" data-testid="org-seat-pick">
                  <span className="text-micro text-ink-500">Put someone in this seat</span>
                  <div className="flex flex-wrap gap-1.5">
                    {here
                      .filter((m) => !g.ppl.some((p) => p.id === m.id))
                      .sort((a, b) => Number(seated.has(a.id)) - Number(seated.has(b.id)))
                      .map((m) => (
                        <button key={m.id} type="button" className="face" disabled={busy} onClick={() => void seat(g.roleId!, m.user_id, true)} data-testid="org-seat-person">
                          <span className="face-av">{initials(label(m))}</span>
                          {shortName(label(m))}
                        </button>
                      ))}
                    {here.length === 0 && <span className="text-meta text-ink-500">Nobody in this department yet.</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={quiet} onClick={onInvite}>
                      Invite someone new
                    </button>
                    <button type="button" className={quiet} onClick={() => setSeatPick(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {editing && (
                <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-2">
                  <button
                    type="button"
                    className={`${quiet} text-accent-escalate`}
                    disabled={busy}
                    data-testid="org-role-remove"
                    onClick={() => (edit.confirm ? void dropRole(g.roleId!) : setEdit({ ...edit, confirm: true }))}
                  >
                    {edit.confirm ? `Remove ${g.name}${g.ppl.length ? ` (${g.ppl.length} ${g.ppl.length === 1 ? 'person leaves' : 'people leave'} it)` : ''}` : 'Remove role'}
                  </button>
                </div>
              )}
              {fail && fail.place === g.roleId && <span className="text-micro text-accent-escalate">{fail.text}</span>}
            </div>
          )
        })}
        {groups.length === 0 && n.children.length === 0 && adding !== n.dept.id && <span className="text-meta text-ink-500">Nobody here yet.</span>}
        {adding === n.dept.id ? (
          <div className="org-role" data-testid="org-role-add-form">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-micro text-ink-500">
                New role
                <input className={input} placeholder="e.g. Operator, night shift" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="org-role-new-name" />
              </label>
              <label className="flex w-20 flex-col gap-1 text-micro text-ink-500">
                Seats
                <input type="number" min={0} className={input} value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: e.target.value })} data-testid="org-role-new-seats" />
              </label>
              <button type="button" className={primary} disabled={busy || !draft.name.trim()} onClick={() => void addRole(n.dept.id)} data-testid="org-role-new-save">
                Add
              </button>
              <button type="button" className={quiet} disabled={busy} onClick={() => setAdding(null)}>
                Cancel
              </button>
            </div>
            {fail && fail.place === n.dept.id && <span className="text-micro text-accent-escalate">{fail.text}</span>}
          </div>
        ) : (
          <button
            type="button"
            className="tag self-start"
            data-testid="org-role-add"
            onClick={() => {
              setAdding(n.dept.id)
              setDraft({ name: '', seats: '1' })
              setEdit(null)
              setSeatPick(null)
              setFail(null)
            }}
          >
            + Add a role
          </button>
        )}
        {n.children.length > 0 && <div className="flex flex-col gap-2">{n.children.map(deptCard)}</div>}
      </div>
    )
  }

  function deptCard(n: DeptNode): React.ReactNode {
    const o = isOpen(n.dept.id)
    const dimDept = lens === 'access' && !!access && !access.depts.has(n.dept.id) && !subtree(n).flatMap(inDept).some(canSee)
    return (
      <section key={n.dept.id} className={`org-dept${dimDept ? ' org-dim' : ''}`} data-testid="org-department" data-open={o ? '' : undefined}>
        <button type="button" className="org-dept-head" aria-expanded={o} onClick={() => toggle(n.dept.id)}>
          <span className="text-reading text-ink-500" aria-hidden>
            {o ? '▾' : '▸'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink-900">{n.dept.name}</span>
            <span className="block text-meta text-ink-600">{deptSummary(n)}</span>
          </span>
          {n.children.length > 0 && <span className="mono text-micro text-ink-500">{n.children.length} inside</span>}
        </button>
        {o && <div className="org-dept-body">{deptBody(n)}</div>}
      </section>
    )
  }

  const lensBar = (() => {
    if (lens === 'who') {
      const holders = members.filter((m) => has(auth(m), power))
      return (
        <>
          <span className="seg seg-quiet">
            {(Object.keys(POWER_WORDS) as Power[]).map((p) => (
              <button key={p} type="button" aria-pressed={power === p} onClick={() => setPower(p)}>
                {POWER_WORDS[p][0]!.toUpperCase() + POWER_WORDS[p].slice(1)}
              </button>
            ))}
          </span>
          <span className="text-meta text-ink-600">
            <b className="text-ink-900">{holders.length}</b> {holders.length === 1 ? 'person' : 'people'} {holders.length === 1 ? POWER_WORDS[power] : POWER_PLURAL[power]}
          </span>
        </>
      )
    }
    if (lens === 'access')
      return (
        <>
          <select
            data-testid="org-access-sop"
            className="min-h-tap max-w-full rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900"
            value={sopId}
            onChange={(e) => setSopId(e.target.value)}
          >
            <option value="">Pick a SOP…</option>
            {sops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title ?? 'Untitled SOP'}
              </option>
            ))}
          </select>
          {access && sop && (
            <>
              <span className="text-meta text-ink-600">
                Seen by <b className="text-ink-900">{members.filter(canSee).length}</b> of {members.length} people
              </span>
              <button type="button" className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900" onClick={() => onChangeAccess(sop.id)}>
                Change who sees it
              </button>
            </>
          )}
        </>
      )
    if (lens === 'training') return <span className="text-meta text-ink-600">How many of the SOPs each person’s work needs they are signed off on. Open a department to see its people.</span>
    return (
      <span className="text-meta text-ink-600">
        {openUserId && supervisees.size > 0
          ? `${shortName(label(byUser.get(openUserId)!))} looks after ${supervisees.size} ${supervisees.size === 1 ? 'person' : 'people'}, lit below.`
          : 'Click someone to open them. Opening a supervisor lights the people they look after.'}
      </span>
    )
  })()

  return (
    <div className="flex flex-col gap-3" data-testid="org-chart">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-paper-1 px-3 py-2">
        <span className="text-meta text-ink-500">Show</span>
        <span className="seg seg-quiet">
          {([['people', 'People'], ['who', 'Who can…'], ['training', 'Training'], ['access', 'SOP access']] as const).map(([k, t]) => (
            <button key={k} type="button" data-testid={`org-lens-${k}`} aria-pressed={lens === k} onClick={() => setLens(k)}>
              {t}
            </button>
          ))}
        </span>
        {lensBar}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          data-testid="org-find"
          placeholder="Find a person"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          className="min-h-tap w-64 max-w-full rounded-lg border border-ink-300 bg-paper-1 px-3 text-ui text-ink-900"
        />
        <button
          type="button"
          data-testid="org-toggle-all"
          className="ml-auto min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
          onClick={() => setOpen(allOpen ? new Set() : new Set(live.map((d) => d.id)))}
        >
          {allOpen ? 'Close all' : 'Open all'}
        </button>
      </div>

      <div className="org-chart bg-grid">
        <div className="org-root">{siteName}</div>
        <div className="org-depts">
          {roots.map(deptCard)}
          {noDept.length > 0 && (
            <section className="org-dept org-dept-dashed" data-testid="org-no-department">
              <div className="org-dept-head">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">No department</span>
                  <span className="block text-meta text-ink-600">{noDept.length === 1 ? '1 person' : `${noDept.length} people`}</span>
                </span>
              </div>
              <div className="org-dept-body flex flex-wrap gap-1.5">{noDept.map(chip)}</div>
            </section>
          )}
          {invited.length > 0 && (
            <section className="org-dept org-dept-dashed" data-testid="org-invited">
              <div className="org-dept-head">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">Invited, not joined yet</span>
                  <span className="block text-meta text-ink-600">{invited.length === 1 ? '1 person' : `${invited.length} people`}</span>
                </span>
              </div>
              <div className="org-dept-body flex flex-wrap gap-1.5">
                {invited.map((p) => (
                  <span key={p.user_id} className="org-person org-seat">
                    <span className="flex items-center gap-1.5">
                      <span className="face-av org-seat-av">{initials(p.email ?? '?')}</span>
                      {p.email}
                    </span>
                    <span className="org-person-note">{ROLE_WORDS[p.role]}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
