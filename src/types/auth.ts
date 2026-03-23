export type AppRole = 'worker' | 'supervisor' | 'admin' | 'safety_manager'

export interface JWTClaims {
  organisation_id: string | null
  user_role: AppRole | 'pending'
}

export interface OrgMember {
  id: string
  organisation_id: string
  user_id: string
  role: AppRole
  created_at: string
}

export interface Organisation {
  id: string
  name: string
  invite_code: string
  trial_ends_at: string
  created_at: string
}
