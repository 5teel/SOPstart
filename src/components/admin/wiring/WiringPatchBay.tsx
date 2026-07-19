'use client'

/**
 * Phase 32-08 — D-hybrid wiring surface (sketch 003 variant D, the shipping
 * form — permission-wiring-views.md § "At Scale: the D Hybrid"). Translates
 * the ~700-line vanilla-JS reference, not a redesign:
 *
 *  1. GROUPED — departments group under their area; a collapsed area is one
 *     jack with an aggregated wire + count badge, expand-in-place to trace
 *     individual departments (D-04). Areas are themselves grantable (D-06),
 *     so a group jack stays clickable/focusable/wireable whether collapsed
 *     or expanded — a deliberate extension of the sketch (whose "groups"
 *     were presentational, not real grant subjects). Collections render
 *     FLAT: D-01 defines `collections` as a flat org-scoped entity with no
 *     domain/group table — sketch 003's COL_GROUPS was demo-data grouping,
 *     not a real model; at ~20 rows a flat list stays scannable without it.
 *  2. FOCUS — quiet by default: zero wires drawn until a click/search.
 *     Focusing a unit or collection draws only its wires, dims the rest.
 *  3. TRACE — every wire is resolved via the ONE resolveEffectiveAccess()
 *     (RESEARCH Pattern 2, no per-view recompute): direct/inherited = solid,
 *     personal (D-13) = dashed.
 *  4. WIRE-UP (D-12) — a NEW·UNWIRED SOP pins atop the library column;
 *     clicking it enters connect mode where left-side org units (org / area
 *     / department / role / person — the full ladder, 33-06) become grant
 *     toggles. Each toggle draws a live wire and updates a PEOPLE
 *     blast-radius banner. ✓ Done writes via `createGrant` (T-32-08-01 —
 *     the action self-enforces org scope, client toggles are never trusted
 *     directly).
 *
 * D-11 (additive-only): there is NO in-place inherited-revoke affordance in
 * this component — revoking a grant happens at its source (a future
 * `/admin/team` or grants-list surface), never as a click here.
 *
 * Person-level jacks come from two sources: (1) the full org ladder — every
 * dept→role→person in `tree` (33-06, Pattern 3) is a real grantable jack,
 * vacancies rendered dashed/inert; (2) a legacy flat list derived from the
 * `grants` prop (subjectType='person') for any grant subject NOT present in
 * the tree (pre-roles-era grants). No arbitrary org-member picker — every
 * person jack is either a tree member or an existing grant subject.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccessGrant, ChainLink, EffectiveAccess, OrgPerson, OrgTree, OrgTreeDepartment, OrgTreeRole, SubjectType } from '@/types/org-model'
import { resolveEffectiveAccess } from '@/lib/org-model/resolve-access'
import { createGrant } from '@/actions/grants'
import { SelectionStrip } from './SelectionStrip'
import { ViewToggle } from '@/components/admin/org-model/ViewToggle'

export interface WiringCollection {
  id: string
  name: string
  colour: string
  sopCount: number
}

export interface WiringNewSop {
  id: string
  title: string
  /**
   * CR-01: grants target COLLECTIONS, never SOP ids — the page resolves (and,
   * via ensureSopCollections, creates) the SOP's collection(s) server-side.
   * Empty means the SOP has no category/collection and cannot be wired yet.
   */
  collectionIds: string[]
}

interface WiringPatchBayProps {
  tree: OrgTree
  orgName?: string
  collections: WiringCollection[]
  grants: AccessGrant[]
  newSop?: WiringNewSop | null
  /**
   * WR-03: dept id -> member ids from the Phase 25 member_departments junction
   * (fetched server-side). Dept-level grants materialize into sop_departments,
   * which workers see via member_departments — role_members alone materially
   * under-reports the blast radius (day-one orgs have no job roles at all).
   */
  deptMembers?: Record<string, string[]>
  /** Called after wire-up ✓ Done successfully writes grants — caller decides how to refetch. */
  onWireUpComplete?: () => void
}

type LensView = 'wiring' | 'matrix' | 'illuminate'
const LENS_OPTIONS = [
  { value: 'wiring', label: '⌇ Wiring' },
  { value: 'matrix', label: '▦ Matrix' },
  { value: 'illuminate', label: '◉ Illuminate' },
]

interface PendingGrant {
  subjectType: SubjectType
  subjectId: string | null
}

interface WireAgg {
  l: string
  r: string
  count: number
  dashed: boolean
}

function allDepartments(tree: OrgTree): OrgTreeDepartment[] {
  return [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]
}

function deptPeopleIds(dept: OrgTreeDepartment): string[] {
  return dept.roles.flatMap((r) => r.people.filter((p) => !p.isVacancy && p.id).map((p) => p.id as string))
}

export function WiringPatchBay({ tree, orgName = 'Whole site', collections, grants, newSop, deptMembers, onWireUpComplete }: WiringPatchBayProps) {
  const [lens, setLens] = useState<LensView>('wiring')
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [pending, setPending] = useState<Map<string, PendingGrant>>(new Map())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const bayRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // ---- data indices (rebuilt when inputs change) --------------------------
  const depts = useMemo(() => allDepartments(tree), [tree])
  const deptById = useMemo(() => new Map(depts.map((d) => [d.id, d])), [depts])
  const roleById = useMemo(() => {
    const m = new Map<string, OrgTreeRole>()
    for (const dept of depts) for (const role of dept.roles) m.set(role.id, role)
    return m
  }, [depts])
  // Person ids that exist as real (non-vacancy) members of a role in the tree
  // — these route through the role→dept→area?→org chain (Pattern 3), not the
  // flat legacy org→person chain.
  const treePersonIds = useMemo(() => {
    const s = new Set<string>()
    for (const dept of depts) for (const role of dept.roles) for (const p of role.people) if (!p.isVacancy && p.id) s.add(p.id)
    return s
  }, [depts])

  const personGrants = useMemo(() => grants.filter((g) => g.subjectType === 'person' && g.subjectId), [grants])
  const personIds = useMemo(() => [...new Set(personGrants.map((g) => g.subjectId as string))], [personGrants])

  // UAT G2 fix: the pinned SOP's saved state must come from the GRANTS list,
  // not the in-session `pending` toggles — otherwise a reload shows a wired
  // SOP as "NEW · UNWIRED" and ✓ Done looks like it never persisted.
  const sopExistingGrants = useMemo(
    () => (newSop ? grants.filter((g) => newSop.collectionIds.includes(g.collectionId)) : []),
    [grants, newSop],
  )
  const sopWired = sopExistingGrants.length > 0
  // UAT G2 fix: nest the pinned SOP under its collection (hierarchy), not as a
  // sibling of the collections list. Falls back to top-of-column when the SOP
  // has no collection yet.
  const sopParentCollectionId = newSop && newSop.collectionIds.length > 0 ? newSop.collectionIds[0] : null
  const personName = useCallback((id: string): string => {
    for (const dept of depts) for (const role of dept.roles) for (const p of role.people) if (p.id === id) return p.name
    return 'Person'
  }, [depts])

  const peopleIndex = useMemo(() => {
    const idx = new Map<string, string[]>()
    const allIds: string[] = []
    for (const dept of depts) {
      // WR-03: role members UNION member_departments members — dept-level
      // grants reach both populations. Only dept ids in OUR tree are indexed,
      // so any foreign-org member_departments rows are ignored here.
      const ids = [...new Set([...deptPeopleIds(dept), ...(deptMembers?.[dept.id] ?? [])])]
      idx.set(dept.id, ids)
      allIds.push(...ids)
      for (const role of dept.roles) {
        idx.set(role.id, role.people.filter((p) => !p.isVacancy && p.id).map((p) => p.id as string))
      }
    }
    for (const area of tree.areas) idx.set(area.id, [...new Set(area.departments.flatMap((d) => idx.get(d.id) ?? []))])
    idx.set(tree.organisationId, [...new Set(allIds)])
    for (const id of personIds) if (!idx.has(id)) idx.set(id, [id])
    return idx
  }, [tree, depts, personIds, deptMembers])

  const chains = useMemo(() => {
    const m = new Map<string, ChainLink[]>()
    const orgLink: ChainLink = { unitId: tree.organisationId, subjectType: 'org' }
    m.set(tree.organisationId, [orgLink])
    for (const area of tree.areas) {
      const areaLink: ChainLink = { unitId: area.id, subjectType: 'area' }
      m.set(area.id, [orgLink, areaLink])
      for (const dept of area.departments) m.set(dept.id, [orgLink, areaLink, { unitId: dept.id, subjectType: 'department' }])
    }
    for (const dept of tree.ungroupedDepartments) m.set(dept.id, [orgLink, { unitId: dept.id, subjectType: 'department' }])
    // Pattern 3: role chains (org→area?→dept→role) + person chains routed
    // through their role (…→role→person). Vacancies (no id) are skipped.
    for (const dept of depts) {
      const deptChain = m.get(dept.id) ?? [orgLink, { unitId: dept.id, subjectType: 'department' }]
      for (const role of dept.roles) {
        const roleChain: ChainLink[] = [...deptChain, { unitId: role.id, subjectType: 'role' }]
        m.set(role.id, roleChain)
        for (const p of role.people) {
          if (p.isVacancy || !p.id) continue
          m.set(p.id, [...roleChain, { unitId: p.id, subjectType: 'person' }])
        }
      }
    }
    // Legacy flat org→person chain, kept only for person-grant subjects not
    // present in any tree role (a role chain above always wins if present).
    for (const id of personIds) if (!m.has(id)) m.set(id, [orgLink, { unitId: id, subjectType: 'person' }])
    return m
  }, [tree, personIds, depts])

  const grantsByUnit = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const g of grants) {
      const key = g.subjectType === 'org' ? tree.organisationId : g.subjectId
      if (!key) continue
      ;(m[key] ??= []).push(g.collectionId)
    }
    return m
  }, [grants, tree.organisationId])

  // The ONE resolver (RESEARCH Pattern 2) — never recomputed per-view.
  const accessByUnit = useMemo(() => {
    const m = new Map<string, EffectiveAccess>()
    for (const [unitId, chain] of chains) m.set(unitId, resolveEffectiveAccess(chain, grantsByUnit))
    return m
  }, [chains, grantsByUnit])

  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections])

  const isLeftId = useCallback(
    (id: string): boolean =>
      id === tree.organisationId ||
      tree.areas.some((a) => a.id === id) ||
      deptById.has(id) ||
      roleById.has(id) ||
      personIds.includes(id) ||
      treePersonIds.has(id),
    [tree, deptById, roleById, personIds, treePersonIds],
  )

  // Which tiers are currently collapsed (children not rendered).
  const isCollapsed = useCallback(
    (link: ChainLink): boolean => {
      if (link.subjectType === 'area') return !expandedAreas.has(link.unitId)
      if (link.subjectType === 'department') return !expandedDepts.has(link.unitId)
      if (link.subjectType === 'role') return !expandedRoles.has(link.unitId)
      return false
    },
    [expandedAreas, expandedDepts, expandedRoles],
  )

  // Nearest-collapsed-ancestor endpoint resolution: walk the unit's chain
  // root-first and anchor the wire at the first collapsed tier found — that
  // tier is always the deepest one still actually rendered (a collapsed
  // ancestor hides everything below it, so nothing past it exists in the DOM
  // to anchor to). Generalizes the old area-only collapse redirect to
  // area/department/role.
  const leftEndpoint = useCallback(
    (unitId: string): string => {
      const chain = chains.get(unitId)
      if (!chain) return unitId
      for (const link of chain) {
        if (link.unitId === unitId) break
        if (isCollapsed(link)) return link.unitId
      }
      return unitId
    },
    [chains, isCollapsed],
  )

  // Every unit's own resolved access, flattened to raw edges (T-32-08-02 —
  // display uses the SAME resolver as materialization, can't disagree).
  const rawEdges = useMemo(() => {
    const edges: Array<{ unitId: string; collectionId: string; personal: boolean }> = []
    for (const [unitId, access] of accessByUnit) {
      for (const c of access.direct) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: false })
      for (const c of Object.keys(access.inherited)) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: false })
      for (const c of access.personal) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: true })
    }
    return edges
  }, [accessByUnit, collectionById])

  // Quiet-by-default guard: zero wires until connect mode or a focus click.
  const visibleRawEdges = useMemo(() => {
    if (connecting) return []
    if (!focus) return []
    if (isLeftId(focus)) return rawEdges.filter((e) => e.unitId === focus)
    return rawEdges.filter((e) => e.collectionId === focus)
  }, [connecting, focus, isLeftId, rawEdges])

  const wires = useMemo((): WireAgg[] => {
    const agg = new Map<string, WireAgg>()
    const add = (l: string, r: string, dashed: boolean) => {
      const key = `${l}|${r}`
      const prev = agg.get(key)
      if (prev) { prev.count += 1; prev.dashed = prev.dashed || dashed } else agg.set(key, { l, r, count: 1, dashed })
    }
    if (connecting && newSop) {
      for (const [unitId, grant] of pending) add(leftEndpoint(unitId), newSop.id, grant.subjectType === 'person')
      // Saved grants draw too — entering wire-up on an already-wired SOP shows
      // what's connected instead of pretending it's blank.
      for (const g of sopExistingGrants) {
        const unitId = g.subjectType === 'org' ? tree.organisationId : g.subjectId
        if (unitId) add(leftEndpoint(unitId), newSop.id, g.subjectType === 'person')
      }
      return [...agg.values()]
    }
    for (const e of visibleRawEdges) add(leftEndpoint(e.unitId), e.collectionId, e.personal)
    return [...agg.values()]
  }, [connecting, newSop, pending, sopExistingGrants, tree.organisationId, visibleRawEdges, leftEndpoint])

  const litIds = useMemo(() => {
    const s = new Set<string>()
    if (connecting) { for (const w of wires) s.add(w.l) }
    else if (focus) { s.add(focus); for (const w of wires) { s.add(w.l); s.add(w.r) } }
    return s
  }, [connecting, focus, wires])

  // ---- draw SVG wires imperatively (OrgChartCanvas/FlowGraphCanvas idiom) --
  const drawWires = useCallback(() => {
    const bay = bayRef.current
    const svg = svgRef.current
    if (!bay || !svg) return
    svg.innerHTML = ''
    const bayBox = bay.getBoundingClientRect()
    for (const w of wires) {
      const fromEl = nodeRefs.current.get(w.l)
      const toEl = nodeRefs.current.get(w.r)
      if (!fromEl || !toEl) continue
      const f = fromEl.getBoundingClientRect()
      const t = toEl.getBoundingClientRect()
      const x1 = f.right - bayBox.left
      const y1 = f.top + f.height / 2 - bayBox.top
      const x2 = t.left - bayBox.left
      const y2 = t.top + t.height / 2 - bayBox.top
      const mid = (x1 + x2) / 2
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', w.dashed ? 'var(--accent-decision)' : 'var(--accent-ok)')
      path.setAttribute('stroke-width', '2')
      if (w.dashed) path.setAttribute('stroke-dasharray', '5 4')
      svg.appendChild(path)
    }
  }, [wires])

  useEffect(() => {
    drawWires()
    const onResize = () => drawWires()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawWires])

  const registerNode = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) nodeRefs.current.set(id, el)
      else nodeRefs.current.delete(id)
    },
    [],
  )

  // ---- interaction ---------------------------------------------------------
  const toggleArea = useCallback((areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }, [])

  const toggleDept = useCallback((deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(deptId)) next.delete(deptId)
      else next.add(deptId)
      return next
    })
  }, [])

  const toggleRole = useCallback((roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }, [])

  const handleLeftClick = useCallback(
    (id: string, subjectType: SubjectType) => {
      if (connecting) {
        setPending((prev) => {
          const next = new Map(prev)
          if (next.has(id)) next.delete(id)
          else next.set(id, { subjectType, subjectId: subjectType === 'org' ? null : id })
          return next
        })
        return
      }
      setFocus((prev) => (prev === id ? null : id))
    },
    [connecting],
  )

  const handleRightClick = useCallback(
    (id: string) => {
      if (connecting) return
      setFocus((prev) => (prev === id ? null : id))
    },
    [connecting],
  )

  const enterWireUp = useCallback(() => {
    if (!newSop) return
    setConnecting((c) => !c)
    setFocus(null)
    setPending(new Map())
    setSaveError(null)
  }, [newSop])

  // Blast radius = distinct people reached by the DRAFT grants (D-11, unit is
  // PEOPLE not SOPs — the whole point of wire-up mode).
  const blastRadiusPeople = useMemo(() => {
    const s = new Set<string>()
    for (const [unitId] of pending) for (const pid of peopleIndex.get(unitId) ?? []) s.add(pid)
    return s.size
  }, [pending, peopleIndex])

  // CR-01: grants are written against the SOP's COLLECTION(s) — a SOP id can
  // never pass createGrant's collection guard, so granting newSop.id silently
  // wrote NOTHING while the UI reported success. Any failure now aborts,
  // surfaces in the banner, and KEEPS the pending toggles (never a false
  // "wired" state).
  const handleDone = useCallback(async () => {
    if (!newSop || pending.size === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      if (newSop.collectionIds.length === 0) {
        setSaveError('This SOP has no collection — set its category first, then wire up access.')
        return
      }
      for (const grant of pending.values()) {
        for (const collectionId of newSop.collectionIds) {
          const result = await createGrant({ subjectType: grant.subjectType, subjectId: grant.subjectId, collectionId })
          if ('error' in result) {
            setSaveError(result.error)
            return
          }
        }
      }
      setConnecting(false)
      setPending(new Map())
      onWireUpComplete?.()
    } finally {
      setSaving(false)
    }
  }, [newSop, pending, onWireUpComplete])

  // ---- selection-strip content ----------------------------------------------
  const stripState = connecting ? 'wiring' : focus ? 'selection' : 'idle'

  const focusLabel = useMemo(() => {
    if (connecting) return newSop?.title
    if (!focus) return undefined
    if (focus === tree.organisationId) return orgName
    const area = tree.areas.find((a) => a.id === focus)
    if (area) return area.name
    const dept = deptById.get(focus)
    if (dept) return dept.name
    const role = roleById.get(focus)
    if (role) return role.name
    if (personIds.includes(focus) || treePersonIds.has(focus)) return personName(focus)
    return collectionById.get(focus)?.name
  }, [connecting, focus, newSop, tree, deptById, roleById, personIds, treePersonIds, personName, collectionById, orgName])

  const focusPeopleCount = useMemo(() => {
    if (!focus) return 0
    if (isLeftId(focus)) return (peopleIndex.get(focus) ?? []).length
    const s = new Set<string>()
    for (const e of visibleRawEdges) for (const pid of peopleIndex.get(e.unitId) ?? []) s.add(pid)
    return s.size
  }, [focus, isLeftId, peopleIndex, visibleRawEdges])

  // WR-05: for a focused COLLECTION, "via M grants" counts the real source
  // grants on that collection — visibleRawEdges holds one derived edge per
  // unit that RESOLVES access (org + each area + each dept + each person from
  // a single org-level grant), so one grant rendered as "via 12 grants". For
  // a focused left-side unit the edge count IS its effective collections —
  // kept as-is.
  const focusGrantCount = useMemo(() => {
    if (!focus) return 0
    if (collectionById.has(focus)) return grants.filter((g) => g.collectionId === focus).length
    return visibleRawEdges.length
  }, [focus, collectionById, grants, visibleRawEdges])

  // 32-09 SC-4 (viz-as-library-filter): a focused department or collection is
  // a valid /admin/sops server-side filter target — org/area/person focus
  // has no equivalent library query param, so no link renders for those.
  const openInLibraryHref = useMemo(() => {
    if (connecting || !focus) return undefined
    if (deptById.has(focus)) return `/admin/sops?departments=${focus}`
    if (collectionById.has(focus)) return `/admin/sops?collection=${focus}`
    return undefined
  }, [connecting, focus, deptById, collectionById])

  // ---- search: auto-expand areas containing matches -------------------------
  const matchIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const s = new Set<string>()
    for (const dept of depts) {
      if (dept.name.toLowerCase().includes(q)) s.add(dept.id)
      for (const role of dept.roles) {
        if (role.name.toLowerCase().includes(q)) s.add(role.id)
        for (const p of role.people) if (!p.isVacancy && p.id && p.name.toLowerCase().includes(q)) s.add(p.id)
      }
    }
    for (const area of tree.areas) if (area.name.toLowerCase().includes(q)) s.add(area.id)
    for (const c of collections) if (c.name.toLowerCase().includes(q)) s.add(c.id)
    return s
  }, [search, depts, tree.areas, collections])

  // Search auto-expands every ancestor tier of a match (mirrors the shipped
  // area auto-expand) so a role/person match is never hidden behind a
  // collapsed dept or role twist.
  useEffect(() => {
    if (!matchIds) return
    const deptHasMatch = (dept: OrgTreeDepartment): boolean =>
      matchIds.has(dept.id) || dept.roles.some((r) => matchIds.has(r.id) || r.people.some((p) => p.id && matchIds.has(p.id)))
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      for (const area of tree.areas) if (area.departments.some(deptHasMatch)) next.add(area.id)
      return next
    })
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      for (const dept of depts) if (dept.roles.some((r) => matchIds.has(r.id) || r.people.some((p) => p.id && matchIds.has(p.id)))) next.add(dept.id)
      return next
    })
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      for (const dept of depts) for (const role of dept.roles) if (role.people.some((p) => p.id && matchIds.has(p.id))) next.add(role.id)
      return next
    })
  }, [matchIds, tree.areas, depts])

  const resetFocus = useCallback(() => {
    if (!connecting) setFocus(null)
  }, [connecting])

  // ---- Pattern 3: role/person row renderers (mirror the area/dept jack
  // machinery above, one indent level deeper each tier) -------------------
  const renderPersonRow = (p: OrgPerson, indent: number, key: string) => {
    if (p.isVacancy || !p.id) {
      return (
        <div key={key} className="jack vacancy" style={{ marginLeft: indent }}>
          <span className="name">{p.name}</span>
          <span className="meta mono">vacant</span>
        </div>
      )
    }
    const id = p.id
    const dim = !connecting && !!focus && !litIds.has(id)
    return (
      <div
        key={id}
        ref={registerNode(id)}
        className={jackClasses(undefined, litIds.has(id), dim, !!matchIds?.has(id), connecting && pending.has(id))}
        style={{ marginLeft: indent }}
        onClick={() => handleLeftClick(id, 'person')}
      >
        <span className="name">{p.name}</span>
        <span className="meta mono">person</span>
        <span className="port" />
      </div>
    )
  }

  const renderRoleRow = (role: OrgTreeRole, indent: number) => {
    const expanded = expandedRoles.has(role.id)
    const dim = !connecting && !!focus && !litIds.has(role.id)
    return (
      <div key={role.id}>
        <div
          ref={registerNode(role.id)}
          className={jackClasses(undefined, litIds.has(role.id), dim, !!matchIds?.has(role.id), connecting && pending.has(role.id))}
          style={{ marginLeft: indent }}
          onClick={() => handleLeftClick(role.id, 'role')}
        >
          <span className="twist mono" onClick={(e) => { e.stopPropagation(); toggleRole(role.id) }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span className="name">{role.name}</span>
          <span className="meta mono">{role.filledCount}/{role.budgetedCount}</span>
          <span className="port" />
        </div>
        {expanded && role.people.map((p, i) => renderPersonRow(p, indent + 18, p.id ?? `${role.id}-vacancy-${i}`))}
      </div>
    )
  }

  const renderDeptRow = (dept: OrgTreeDepartment, indent: number, colour: string) => {
    const expanded = expandedDepts.has(dept.id)
    const dim = !connecting && !!focus && !litIds.has(dept.id)
    return (
      <div key={dept.id}>
        <div
          ref={registerNode(dept.id)}
          className={jackClasses(undefined, litIds.has(dept.id), dim, !!matchIds?.has(dept.id), connecting && pending.has(dept.id))}
          style={{ marginLeft: indent }}
          onClick={() => handleLeftClick(dept.id, 'department')}
        >
          <span className="twist mono" onClick={(e) => { e.stopPropagation(); toggleDept(dept.id) }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span className="dept-dot" style={{ background: colour }} />
          <span className="name">{dept.name}</span>
          {!expanded && <span className="meta mono">{deptPeopleIds(dept).length}p</span>}
          <span className="port" />
        </div>
        {expanded && dept.roles.map((role) => renderRoleRow(role, indent + 18))}
      </div>
    )
  }

  if (lens !== 'wiring') {
    return (
      <div className="p-6">
        <div className="mono text-[11px] uppercase tracking-wide text-[var(--ink-500)] mb-3">
          {lens === 'matrix' ? '▦ Matrix' : '◉ Illuminate'} — coming soon, ⌇ Wiring is the shipping default
        </div>
        <ViewToggle options={LENS_OPTIONS} value={lens} onChange={(v) => setLens(v as LensView)} />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="searchbar mono">
          <input
            type="search"
            placeholder="Search org or collections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ViewToggle options={LENS_OPTIONS} value={lens} onChange={(v) => setLens(v as LensView)} />
      </div>

      <SelectionStrip
        state={stripState}
        label={focusLabel}
        peopleCount={connecting ? blastRadiusPeople : focusPeopleCount}
        grantCount={connecting ? pending.size : focusGrantCount}
        onDone={() => void handleDone()}
        doneDisabled={saving || pending.size === 0}
        openInLibraryHref={openInLibraryHref}
      />

      {saveError && (
        <div role="alert" className="mono text-[11px] uppercase tracking-wide text-red-600 mt-1">
          Wiring failed — {saveError} Nothing was saved; your pending grants are kept.
        </div>
      )}

      <div ref={bayRef} className="bay" onClick={(e) => { if (e.target === e.currentTarget) resetFocus() }}>
        <svg ref={svgRef} className="bay-svg" />
        <div className="cols">
          <div className="col left">
            <h2 className="mono">Org — {orgName}</h2>

            <div
              ref={registerNode(tree.organisationId)}
              className={jackClasses('site-jack', litIds.has(tree.organisationId), !connecting && !!focus && !litIds.has(tree.organisationId), !!matchIds?.has(tree.organisationId))}
              onClick={() => handleLeftClick(tree.organisationId, 'org')}
            >
              <span className="name">{orgName}</span>
              <span className="meta mono">{(peopleIndex.get(tree.organisationId) ?? []).length} people</span>
              <span className="port" />
            </div>

            {tree.areas.map((area) => {
              const expanded = expandedAreas.has(area.id)
              const dim = !connecting && !!focus && !litIds.has(area.id)
              return (
                <div key={area.id}>
                  <div
                    ref={registerNode(area.id)}
                    className={jackClasses('group-jack', litIds.has(area.id), dim, !!matchIds?.has(area.id), connecting && pending.has(area.id))}
                    onClick={() => handleLeftClick(area.id, 'area')}
                  >
                    <span
                      className="twist mono"
                      onClick={(e) => { e.stopPropagation(); toggleArea(area.id) }}
                    >
                      {expanded ? '▾' : '▸'}
                    </span>
                    <span className="dept-dot" style={{ background: area.colour }} />
                    <span className="name mono">{area.name}</span>
                    {!expanded && <span className="meta mono">{area.departments.length} depts</span>}
                    <span className="port" />
                  </div>
                  {expanded && area.departments.map((dept) => renderDeptRow(dept, 18, area.colour))}
                </div>
              )
            })}

            {tree.ungroupedDepartments.map((dept) => renderDeptRow(dept, 0, dept.colour))}

            {personIds.filter((id) => !treePersonIds.has(id)).map((id) => {
              const dim = !connecting && !!focus && !litIds.has(id)
              return (
                <div
                  key={id}
                  ref={registerNode(id)}
                  className={jackClasses('child', litIds.has(id), dim, false, connecting && pending.has(id))}
                  onClick={() => handleLeftClick(id, 'person')}
                >
                  <span className="name">{personName(id)}</span>
                  <span className="meta mono">person</span>
                  <span className="port" />
                </div>
              )
            })}
          </div>

          <div className="col right">
            <h2 className="mono">Library — {collections.length} collections{newSop ? ' + 1 new SOP' : ''}</h2>

            {/* Fallback position only when the SOP has no collection yet —
                otherwise it renders nested under its collection below. */}
            {newSop && !sopParentCollectionId && (
              <div
                ref={registerNode(newSop.id)}
                className={`jack newsop${connecting ? ' lit' : ''}`}
                onClick={enterWireUp}
              >
                <span className="newpill mono">{connecting && pending.size > 0 ? 'NEW' : sopWired ? 'WIRED' : 'NEW · UNWIRED'}</span>
                <span className="name">{newSop.title}</span>
                <span className="meta mono">{connecting ? pending.size : sopExistingGrants.length} grant{(connecting ? pending.size : sopExistingGrants.length) === 1 ? '' : 's'}</span>
                <span className="port" />
              </div>
            )}

            {collections.map((c) => {
              const dim = connecting || (!!focus && !litIds.has(c.id))
              const holdsPinnedSop = !!newSop && sopParentCollectionId === c.id
              return (
                <div key={c.id}>
                  <div
                    ref={registerNode(c.id)}
                    className={jackClasses(undefined, litIds.has(c.id), dim && !holdsPinnedSop, !!matchIds?.has(c.id))}
                    onClick={() => handleRightClick(c.id)}
                  >
                    <span className="dept-dot" style={{ background: c.colour }} />
                    <span className="name">{c.name}</span>
                    <span className="meta mono">{c.sopCount} SOPs</span>
                    <span className="port" />
                  </div>
                  {holdsPinnedSop && newSop && (
                    <div
                      ref={registerNode(newSop.id)}
                      className={`jack child newsop${connecting ? ' lit' : ''}`}
                      onClick={enterWireUp}
                    >
                      <span className="newpill mono">{connecting && pending.size > 0 ? 'NEW' : sopWired ? 'WIRED' : 'NEW · UNWIRED'}</span>
                      <span className="name">{newSop.title}</span>
                      <span className="meta mono">{connecting ? pending.size : sopExistingGrants.length} grant{(connecting ? pending.size : sopExistingGrants.length) === 1 ? '' : 's'}</span>
                      <span className="port" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="bay-hint mono">
        CLICK ▸ TO EXPAND A GROUP · CLICK ANYTHING TO FOCUS · CLICK THE NEW SOP TO WIRE IT UP
      </div>
    </div>
  )
}

function jackClasses(extra: string | undefined, lit: boolean, dim: boolean, match: boolean, wiredTarget = false): string {
  return ['jack', extra, lit && 'lit', dim && 'dim', match && 'match', wiredTarget && 'wired-target'].filter(Boolean).join(' ')
}
