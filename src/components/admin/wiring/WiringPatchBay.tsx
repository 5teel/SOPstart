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
 *     Each collection also expands in place to its own SOP rows (33-08, SC-2
 *     — closes G2): `expandedCollections` mirrors `expandedAreas`.
 *  2. FOCUS — quiet by default: zero wires drawn until a click/search.
 *     Focusing a unit or collection draws only its wires, dims the rest.
 *  3. TRACE — every wire is resolved via the ONE resolveEffectiveAccess()
 *     (RESEARCH Pattern 2, no per-view recompute): direct/inherited = solid,
 *     personal (D-13) = dashed. Called twice (33-08): once over collection
 *     grants (`grantsByUnit`), once over SOP-target grants (`sopGrantsByUnit`)
 *     — same pure resolver, a second grant-kind input, per Pattern 1.
 *  4. WIRE-UP (D-12, generalized 33-08) — ANY SOP row (the pinned post-publish
 *     `newSop`, or any SOP drilled into from its collection) is organically
 *     selectable into connect mode: left-side org units (org / area /
 *     department / role / person — the full ladder, 33-06) become grant
 *     toggles. Each toggle draws a live wire and updates a PEOPLE
 *     blast-radius banner. ✓ Done writes ONE SOP-target grant per pending
 *     subject via `createGrant({..., sopId})` (33-05's arm — the SOP becomes
 *     chosen-by-name/overridden, stops following its collection). The
 *     `?sop=` pin survives only as a deep-link nicety that pre-selects and
 *     pre-expands — it is no longer a wiring precondition.
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

/** 33-08 SC-2: one row of a collection's SOP drill-down (page.tsx `sopsByCollection`). */
export interface WiringSop {
  id: string
  title: string
  status: string
}

export interface WiringNewSop {
  id: string
  title: string
  /**
   * Deep-link nicety only (33-08): pre-selects/pre-expands the pinned SOP's
   * collection. NOT a wiring precondition — a collection-less SOP is fully
   * wireable by name via the SOP-target grant arm (33-05 CR-02 relaxation).
   */
  collectionIds: string[]
}

interface WiringPatchBayProps {
  tree: OrgTree
  orgName?: string
  collections: WiringCollection[]
  /** 33-08 SC-2: collection id -> its SOPs (id/title/status), for drill-down. */
  sopsByCollection?: Record<string, WiringSop[]>
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

export function WiringPatchBay({ tree, orgName = 'Whole site', collections, sopsByCollection = {}, grants, newSop, deptMembers, onWireUpComplete }: WiringPatchBayProps) {
  const [lens, setLens] = useState<LensView>('wiring')
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [activeSopId, setActiveSopId] = useState<string | null>(null)
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

  // 33-08 SC-2: id -> SOP lookup and id -> parent collection id, across every
  // drilled-down collection PLUS the pinned newSop (merged in even if its
  // collection's join read hasn't caught up yet — its own collectionIds win).
  const sopById = useMemo(() => {
    const m = new Map<string, WiringSop>()
    for (const sops of Object.values(sopsByCollection)) for (const s of sops) m.set(s.id, s)
    if (newSop && !m.has(newSop.id)) m.set(newSop.id, { id: newSop.id, title: newSop.title, status: 'draft' })
    return m
  }, [sopsByCollection, newSop])

  const sopParentCollection = useMemo(() => {
    const m = new Map<string, string>()
    for (const [cid, sops] of Object.entries(sopsByCollection)) for (const s of sops) m.set(s.id, cid)
    if (newSop && newSop.collectionIds.length > 0 && !m.has(newSop.id)) m.set(newSop.id, newSop.collectionIds[0])
    return m
  }, [sopsByCollection, newSop])

  // UAT G2 fix, generalized 33-08: the pinned SOP nests under its collection
  // (hierarchy) — falls back to top-of-column only when it truly has none.
  const sopParentCollectionId = newSop ? (sopParentCollection.get(newSop.id) ?? null) : null

  // Deep-link nicety: a pinned ?sop= pre-expands its collection so the drill-
  // down UX shows it immediately, without making expansion a precondition.
  useEffect(() => {
    if (!sopParentCollectionId) return
    setExpandedCollections((prev) => (prev.has(sopParentCollectionId) ? prev : new Set(prev).add(sopParentCollectionId)))
  }, [sopParentCollectionId])

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
      if (!g.collectionId) continue // 33-08: SOP-target grants (null collectionId) go through sopGrantsByUnit
      const key = g.subjectType === 'org' ? tree.organisationId : g.subjectId
      if (!key) continue
      ;(m[key] ??= []).push(g.collectionId)
    }
    return m
  }, [grants, tree.organisationId])

  // 33-08 SC-3: the same union resolver, fed SOP ids instead of collection
  // ids (Pattern 1) — org/area/department/role/person SOP-target grants
  // inherit down the chain exactly like collection grants.
  const sopGrantsByUnit = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const g of grants) {
      if (!g.sopId) continue
      const key = g.subjectType === 'org' ? tree.organisationId : g.subjectId
      if (!key) continue
      ;(m[key] ??= []).push(g.sopId)
    }
    return m
  }, [grants, tree.organisationId])

  // The ONE resolver (RESEARCH Pattern 2) — never recomputed per-view.
  const accessByUnit = useMemo(() => {
    const m = new Map<string, EffectiveAccess>()
    for (const [unitId, chain] of chains) m.set(unitId, resolveEffectiveAccess(chain, grantsByUnit))
    return m
  }, [chains, grantsByUnit])

  const sopAccessByUnit = useMemo(() => {
    const m = new Map<string, EffectiveAccess>()
    for (const [unitId, chain] of chains) m.set(unitId, resolveEffectiveAccess(chain, sopGrantsByUnit))
    return m
  }, [chains, sopGrantsByUnit])

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

  // 33-08 rightEndpoint: mirror of leftEndpoint for the library side — a
  // SOP-target wire anchors at the SOP row when its collection is expanded,
  // else collapses to the collection jack (aggregated via WireAgg.count).
  const rightEndpoint = useCallback(
    (sopId: string): string => {
      const collectionId = sopParentCollection.get(sopId)
      if (!collectionId) return sopId
      return expandedCollections.has(collectionId) ? sopId : collectionId
    },
    [sopParentCollection, expandedCollections],
  )

  // Every unit's own resolved COLLECTION access, flattened to raw edges
  // (T-32-08-02 — display uses the SAME resolver as materialization).
  const rawEdges = useMemo(() => {
    const edges: Array<{ unitId: string; collectionId: string; personal: boolean }> = []
    for (const [unitId, access] of accessByUnit) {
      for (const c of access.direct) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: false })
      for (const c of Object.keys(access.inherited)) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: false })
      for (const c of access.personal) if (collectionById.has(c)) edges.push({ unitId, collectionId: c, personal: true })
    }
    return edges
  }, [accessByUnit, collectionById])

  // 33-08: the SOP-target counterpart of rawEdges — kept as a separate array
  // (not unioned into rawEdges) so the shipped collection-edge shape/pin
  // stays byte-identical.
  const rawSopEdges = useMemo(() => {
    const edges: Array<{ unitId: string; sopId: string; personal: boolean }> = []
    for (const [unitId, access] of sopAccessByUnit) {
      for (const s of access.direct) if (sopParentCollection.has(s)) edges.push({ unitId, sopId: s, personal: false })
      for (const s of Object.keys(access.inherited)) if (sopParentCollection.has(s)) edges.push({ unitId, sopId: s, personal: false })
      for (const s of access.personal) if (sopParentCollection.has(s)) edges.push({ unitId, sopId: s, personal: true })
    }
    return edges
  }, [sopAccessByUnit, sopParentCollection])

  // Quiet-by-default guard: zero wires until connect mode or a focus click.
  const visibleRawEdges = useMemo(() => {
    if (connecting) return []
    if (!focus) return []
    if (isLeftId(focus)) return rawEdges.filter((e) => e.unitId === focus)
    return rawEdges.filter((e) => e.collectionId === focus)
  }, [connecting, focus, isLeftId, rawEdges])

  const visibleSopEdges = useMemo(() => {
    if (connecting) return []
    if (!focus) return []
    if (isLeftId(focus)) return rawSopEdges.filter((e) => e.unitId === focus)
    return rawSopEdges.filter((e) => e.sopId === focus)
  }, [connecting, focus, isLeftId, rawSopEdges])

  // 33-08: the SOP currently targeted by connect mode — the pinned newSop or
  // any SOP drilled into from its collection, resolved through the one
  // sopById index so both sources render identically.
  const activeSop = useMemo(() => (activeSopId ? (sopById.get(activeSopId) ?? null) : null), [activeSopId, sopById])

  // UAT G2 fix, generalized 33-08: a SOP's saved state comes from the GRANTS
  // list (SOP-target grants, sopId === activeSopId), not in-session `pending`
  // toggles — otherwise a reload shows a wired SOP as unwired.
  const activeSopExistingGrants = useMemo(
    () => (activeSopId ? grants.filter((g) => g.sopId === activeSopId) : []),
    [grants, activeSopId],
  )

  const wires = useMemo((): WireAgg[] => {
    const agg = new Map<string, WireAgg>()
    const add = (l: string, r: string, dashed: boolean) => {
      const key = `${l}|${r}`
      const prev = agg.get(key)
      if (prev) { prev.count += 1; prev.dashed = prev.dashed || dashed } else agg.set(key, { l, r, count: 1, dashed })
    }
    if (connecting && activeSop) {
      for (const [unitId, grant] of pending) add(leftEndpoint(unitId), rightEndpoint(activeSop.id), grant.subjectType === 'person')
      // Saved grants draw too — entering wire-up on an already-wired SOP shows
      // what's connected instead of pretending it's blank.
      for (const g of activeSopExistingGrants) {
        const unitId = g.subjectType === 'org' ? tree.organisationId : g.subjectId
        if (unitId) add(leftEndpoint(unitId), rightEndpoint(activeSop.id), g.subjectType === 'person')
      }
      return [...agg.values()]
    }
    for (const e of visibleRawEdges) add(leftEndpoint(e.unitId), e.collectionId, e.personal)
    for (const e of visibleSopEdges) add(leftEndpoint(e.unitId), rightEndpoint(e.sopId), e.personal)
    return [...agg.values()]
  }, [connecting, activeSop, pending, activeSopExistingGrants, tree.organisationId, visibleRawEdges, visibleSopEdges, leftEndpoint, rightEndpoint])

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

  const toggleCollection = useCallback((collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(collectionId)) next.delete(collectionId)
      else next.add(collectionId)
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

  // 33-08: generalized WIRE-UP entry — ANY SOP row (pinned or drilled-down)
  // enters/exits connect mode targeting that SOP. Re-clicking the SAME
  // already-active SOP exits; clicking a different SOP switches target.
  const enterWireUp = useCallback(
    (sopId: string) => {
      setConnecting((c) => (c && activeSopId === sopId ? false : true))
      setActiveSopId(sopId)
      setFocus(null)
      setPending(new Map())
      setSaveError(null)
    },
    [activeSopId],
  )

  // Blast radius = distinct people reached by the DRAFT grants (D-11, unit is
  // PEOPLE not SOPs — the whole point of wire-up mode).
  const blastRadiusPeople = useMemo(() => {
    const s = new Set<string>()
    for (const [unitId] of pending) for (const pid of peopleIndex.get(unitId) ?? []) s.add(pid)
    return s.size
  }, [pending, peopleIndex])

  // 33-08 SC-3: Done writes ONE SOP-target grant per pending subject
  // (sopId set, collectionId omitted/null — the createGrant XOR schema
  // defaults it) — any tier. The SOP becomes chosen-by-name/overridden; no
  // collection is required (CR-02 relaxation, 33-05), so the old "this SOP
  // has no collection" dead-end is gone. A createGrant failure still aborts,
  // surfaces in the banner, and keeps pending (never a false "wired" state).
  const handleDone = useCallback(async () => {
    if (!activeSop || pending.size === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      for (const grant of pending.values()) {
        const result = await createGrant({ subjectType: grant.subjectType, subjectId: grant.subjectId, sopId: activeSop.id })
        if ('error' in result) {
          setSaveError(result.error)
          return
        }
      }
      setConnecting(false)
      setPending(new Map())
      setActiveSopId(null)
      onWireUpComplete?.()
    } finally {
      setSaving(false)
    }
  }, [activeSop, pending, onWireUpComplete])

  // ---- selection-strip content ----------------------------------------------
  const stripState = connecting ? 'wiring' : focus ? 'selection' : 'idle'

  const focusLabel = useMemo(() => {
    if (connecting) return activeSop?.title
    if (!focus) return undefined
    if (focus === tree.organisationId) return orgName
    const area = tree.areas.find((a) => a.id === focus)
    if (area) return area.name
    const dept = deptById.get(focus)
    if (dept) return dept.name
    const role = roleById.get(focus)
    if (role) return role.name
    if (personIds.includes(focus) || treePersonIds.has(focus)) return personName(focus)
    const sop = sopById.get(focus)
    if (sop) return sop.title
    return collectionById.get(focus)?.name
  }, [connecting, focus, activeSop, tree, deptById, roleById, personIds, treePersonIds, personName, sopById, collectionById, orgName])

  const focusPeopleCount = useMemo(() => {
    if (!focus) return 0
    if (isLeftId(focus)) return (peopleIndex.get(focus) ?? []).length
    const s = new Set<string>()
    for (const e of visibleRawEdges) for (const pid of peopleIndex.get(e.unitId) ?? []) s.add(pid)
    for (const e of visibleSopEdges) for (const pid of peopleIndex.get(e.unitId) ?? []) s.add(pid)
    return s.size
  }, [focus, isLeftId, peopleIndex, visibleRawEdges, visibleSopEdges])

  // WR-05: for a focused COLLECTION, "via M grants" counts the real source
  // grants on that collection — visibleRawEdges holds one derived edge per
  // unit that RESOLVES access (org + each area + each dept + each person from
  // a single org-level grant), so one grant rendered as "via 12 grants". For
  // a focused left-side unit the edge count IS its effective collections —
  // kept as-is. 33-08: a focused SOP counts its own direct grant rows.
  const focusGrantCount = useMemo(() => {
    if (!focus) return 0
    if (collectionById.has(focus)) return grants.filter((g) => g.collectionId === focus).length
    if (sopById.has(focus)) return grants.filter((g) => g.sopId === focus).length
    return visibleRawEdges.length
  }, [focus, collectionById, sopById, grants, visibleRawEdges])

  // 32-09 SC-4 (viz-as-library-filter): a focused department or collection is
  // a valid /admin/sops server-side filter target — org/area/person focus
  // has no equivalent library query param, so no link renders for those.
  const openInLibraryHref = useMemo(() => {
    if (connecting || !focus) return undefined
    if (deptById.has(focus)) return `/admin/sops?departments=${focus}`
    if (collectionById.has(focus)) return `/admin/sops?collection=${focus}`
    return undefined
  }, [connecting, focus, deptById, collectionById])

  // ---- search: auto-expand areas/depts/roles/collections containing matches -
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
    for (const sops of Object.values(sopsByCollection)) for (const sop of sops) if (sop.title.toLowerCase().includes(q)) s.add(sop.id)
    return s
  }, [search, depts, tree.areas, collections, sopsByCollection])

  // Search auto-expands every ancestor tier of a match (mirrors the shipped
  // area auto-expand) so a role/person/SOP match is never hidden behind a
  // collapsed twist.
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
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      for (const [cid, sops] of Object.entries(sopsByCollection)) if (sops.some((s) => matchIds.has(s.id))) next.add(cid)
      return next
    })
  }, [matchIds, tree.areas, depts, sopsByCollection])

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

  // 33-08 SC-2: one SOP row — the child-row pattern from d3fc9f5, generalized
  // from "the one pinned newSop" to any SOP. `isPinned` keeps the post-publish
  // NEW · UNWIRED/WIRED pill on the deep-linked SOP only; every other row
  // shows a "chosen by name" pill when it carries a direct SOP-target grant
  // (the override trigger, derived client-side — no stored flag).
  const renderSopRow = (s: WiringSop, opts: { isPinned: boolean; nested: boolean }) => {
    const active = connecting && activeSopId === s.id
    const overridden = grants.some((g) => g.sopId === s.id)
    const grantCount = grants.filter((g) => g.sopId === s.id).length
    return (
      <div
        key={s.id}
        ref={registerNode(s.id)}
        className={`jack${opts.nested ? ' child' : ''} newsop${active ? ' lit' : ''}`}
        onClick={() => enterWireUp(s.id)}
      >
        {opts.isPinned ? (
          <span className="newpill mono">{active && pending.size > 0 ? 'NEW' : overridden ? 'WIRED' : 'NEW · UNWIRED'}</span>
        ) : overridden ? (
          <span className="newpill mono">CHOSEN BY NAME</span>
        ) : null}
        <span className="name">{s.title}</span>
        <span className="meta mono">{grantCount} grant{grantCount === 1 ? '' : 's'}</span>
        <span className="port" />
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
            {newSop && !sopParentCollectionId && renderSopRow({ id: newSop.id, title: newSop.title, status: 'draft' }, { isPinned: true, nested: false })}

            {collections.map((c) => {
              const expanded = expandedCollections.has(c.id)
              const dim = connecting || (!!focus && !litIds.has(c.id))
              const sopsHere = sopsByCollection[c.id] ?? []
              const sopsHereWithPin =
                newSop && sopParentCollectionId === c.id && !sopsHere.some((s) => s.id === newSop.id)
                  ? [...sopsHere, { id: newSop.id, title: newSop.title, status: 'draft' }]
                  : sopsHere
              return (
                <div key={c.id}>
                  <div
                    ref={registerNode(c.id)}
                    className={jackClasses(undefined, litIds.has(c.id), dim, !!matchIds?.has(c.id))}
                    onClick={() => handleRightClick(c.id)}
                  >
                    <span className="twist mono" onClick={(e) => { e.stopPropagation(); toggleCollection(c.id) }}>
                      {expanded ? '▾' : '▸'}
                    </span>
                    <span className="dept-dot" style={{ background: c.colour }} />
                    <span className="name">{c.name}</span>
                    <span className="meta mono">{c.sopCount} SOPs</span>
                    <span className="port" />
                  </div>
                  {expanded && sopsHereWithPin.map((s) => renderSopRow(s, { isPinned: !!newSop && s.id === newSop.id, nested: true }))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="bay-hint mono">
        CLICK ▸ TO EXPAND A GROUP · CLICK ANYTHING TO FOCUS · CLICK A SOP TO WIRE IT UP
      </div>
    </div>
  )
}

function jackClasses(extra: string | undefined, lit: boolean, dim: boolean, match: boolean, wiredTarget = false): string {
  return ['jack', extra, lit && 'lit', dim && 'dim', match && 'match', wiredTarget && 'wired-target'].filter(Boolean).join(' ')
}
