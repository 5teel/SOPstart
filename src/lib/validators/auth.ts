import { z } from 'zod'

export const orgSignUpSchema = z.object({
  organisationName: z.string().min(2, 'Organisation name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const inviteCodeSchema = z.object({
  code: z.string().min(1, 'Invite code is required').max(20).transform(v => v.toUpperCase().trim()),
})

export const inviteWorkerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  token: z.string().min(1, 'Invite token is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const updateRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(['worker', 'supervisor', 'admin', 'safety_manager']),
})

export type OrgSignUpInput = z.infer<typeof orgSignUpSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type InviteCodeInput = z.infer<typeof inviteCodeSchema>
export type InviteWorkerInput = z.infer<typeof inviteWorkerSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
