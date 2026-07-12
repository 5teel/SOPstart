/**
 * SafeStart — the roles & access structure (single source of truth).
 *
 * The /pathways page renders the "Roles & access" view ENTIRELY from this file,
 * the same way it renders flows from journeys.ts. Keep it matched to the real
 * model: org roles are `organisation_members.role` (surfaced as the JWT
 * `user_role` claim); the admin gate everywhere in the code is
 * `['admin','safety_manager']`. Overlays are NOT roles — they gate visibility /
 * accountability, never permissions.
 *
 * When a role's landing screen, an admin gate, or an overlay's meaning changes,
 * update this file in the SAME change (mirrors the journeys.ts maintenance rule
 * in CLAUDE.md § Pathways Map Maintenance).
 */

export type RoleKind = 'org' | 'platform' | 'overlay'

export interface RoleDef {
  /** Stable key — matches the DB/JWT value for org roles. */
  key: string
  label: string
  kind: RoleKind
  /** Hex accent for the dot / stripe. */
  colour: string
  /** One line: who this is. */
  who: string
  /** Home screen this role lands on after login (org roles only). */
  landsOn?: { label: string; route: string }
  /** What this role can do. */
  can: string[]
  /** Explicit limits — what it deliberately cannot do. */
  cannot?: string[]
  /** For overlays: what it gates (since it is not a permission role). */
  gates?: string
}

/**
 * Org roles in escalating order (pending → admin), then the platform role,
 * then the cross-cutting overlays.
 */
export const ROLES: RoleDef[] = [
  // ---------------------------------------------------------------- org roles
  {
    key: 'pending',
    label: 'Pending',
    kind: 'org',
    colour: '#a8a29e',
    who: 'A new member whose role has not been set yet.',
    landsOn: { label: 'Account pending', route: '/pending' },
    can: ['Sign in and see a "your account is being set up" holding screen'],
    cannot: ['Read SOPs', 'Access any admin or activity surface — until an admin assigns a role'],
  },
  {
    key: 'worker',
    label: 'Worker',
    kind: 'org',
    colour: '#2563eb',
    who: 'Front-line tradesperson / inspector following procedures on-site.',
    landsOn: { label: 'My SOPs', route: '/sops' },
    can: [
      'Read and walk through assigned / visible SOPs step-by-step',
      'Capture photos, complete steps, sign off their own instance',
      'Self-add a published SOP to "Your SOPs"',
    ],
    cannot: ['Create or edit SOPs', 'Manage the library, team, or departments', 'Review other people’s completions'],
  },
  {
    key: 'supervisor',
    label: 'Supervisor',
    kind: 'org',
    colour: '#7c3aed',
    who: 'Oversees a crew and reviews their completed work.',
    landsOn: { label: 'Activity', route: '/activity' },
    can: [
      'Review worker completion records and sign-offs',
      'Open a completion to inspect captured photos and step results',
    ],
    cannot: ['Create or edit SOPs', 'Manage the library, team, or departments (that is admin / safety-manager)'],
  },
  {
    key: 'safety_manager',
    label: 'Safety Manager',
    kind: 'org',
    colour: '#0d9488',
    who: 'Owns safety governance — supervisor oversight plus full admin authoring.',
    landsOn: { label: 'Activity', route: '/activity' },
    can: [
      'Everything a Supervisor can do',
      'Full admin authoring: create / upload / parse SOPs, manage the block library',
      'Manage team & roles, manage departments + owners, assign SOPs',
    ],
    cannot: ['Cross-org / platform curation (that is the Potenco platform admin)'],
  },
  {
    key: 'admin',
    label: 'Admin (SOP Admin)',
    kind: 'org',
    colour: '#b45309',
    who: 'The org’s administrator — the first sign-up becomes admin.',
    landsOn: { label: 'SOP library (admin)', route: '/admin/sops' },
    can: [
      'Create / upload / AI-parse SOPs and run them to publish',
      'Manage the block library (department tagging)',
      'Manage team, roles & invites; manage departments + owners',
      'Assign SOPs by role / department',
    ],
    cannot: ['Cross-org / platform curation (that is the Potenco platform admin)'],
  },
  // ------------------------------------------------------------- platform role
  {
    key: 'platform_admin',
    label: 'Platform Admin',
    kind: 'platform',
    colour: '#1c1b19',
    who: 'Potenco super-admin operating across organisations (not an org member role).',
    can: [
      'Cross-org operations gated by the is_platform_admin() RLS check',
      'Historically curated the shared global block library',
    ],
    cannot: [
      'Most cross-org curation surfaces were retired in Phase 25 (single-org + departments model)',
      'Not the same as an org Admin — belongs to Potenco, not the customer org',
    ],
  },
  // --------------------------------------------------------------- overlays
  {
    key: 'department',
    label: 'Department',
    kind: 'overlay',
    colour: '#0891b2',
    who: 'An org unit (Forming, Quality, Maintenance…) that organises SOPs, blocks & people.',
    gates: 'Worker SOP visibility (RLS, additive-OR with assignment + sub-trade). Organises the library & team.',
    can: ['A SOP / block / member can belong to many departments, or be org-wide ("All departments")'],
  },
  {
    key: 'department_owner',
    label: 'Department Owner',
    kind: 'overlay',
    colour: '#d97706',
    who: 'A named member accountable for a department — answers the Visy "nobody owns SOPs" gap.',
    gates: 'Accountability only (D-03) — grants NO edit / approve permissions beyond the member’s existing role.',
    can: [
      'Rendered as the "★ Owns {Dept}" team badge + the department-card owner line',
      'A department with no owner surfaces the red "No owner assigned" warning',
    ],
  },
  {
    key: 'sub_trade',
    label: 'Sub-trade',
    kind: 'overlay',
    colour: '#65a30d',
    who: 'A skill tag (operator / fitter / sparky) — orthogonal to role and to department.',
    gates: 'Worker SOP visibility (RLS, additive-OR). Left untouched by Phase 25; dept↔sub-trade combination deferred.',
    can: ['A member and a SOP each carry sub-trade tags; a match contributes to visibility'],
  },
]

export const ROLE_KIND_LABEL: Record<RoleKind, string> = {
  org: 'Organisation roles',
  platform: 'Platform (Potenco)',
  overlay: 'Overlays — not roles (gate visibility / accountability, not permissions)',
}

/**
 * Compact access matrix: which org roles reach each key surface.
 * `true` = full access · `'own'` = own records only · `false` = no access.
 * Admin gate in code is `['admin','safety_manager']`.
 */
export interface AccessRow {
  surface: string
  route: string
  /** keyed by org-role key */
  access: Record<'worker' | 'supervisor' | 'safety_manager' | 'admin', boolean | 'own'>
}

export const ACCESS_MATRIX: AccessRow[] = [
  { surface: 'My SOPs (read / walk)', route: '/sops',             access: { worker: true,  supervisor: true,  safety_manager: true, admin: true } },
  { surface: 'Activity (review sign-off)', route: '/activity',    access: { worker: 'own', supervisor: true,  safety_manager: true, admin: true } },
  { surface: 'Manage SOPs',          route: '/admin/sops',        access: { worker: false, supervisor: false, safety_manager: true, admin: true } },
  { surface: 'Block library',        route: '/admin/blocks',      access: { worker: false, supervisor: false, safety_manager: true, admin: true } },
  { surface: 'Team & roles',         route: '/admin/team',        access: { worker: false, supervisor: false, safety_manager: true, admin: true } },
  { surface: 'Departments',          route: '/admin/departments', access: { worker: false, supervisor: false, safety_manager: true, admin: true } },
]

export const ACCESS_ROLE_ORDER = ['worker', 'supervisor', 'safety_manager', 'admin'] as const
