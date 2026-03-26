import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkerActivityView } from './WorkerActivityView'
import { SupervisorActivityView } from './SupervisorActivityView'

export const metadata: Metadata = {
  title: 'Activity',
}

export default async function ActivityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = member?.role ?? null

  if (role === 'worker') return <WorkerActivityView />
  if (role === 'supervisor' || role === 'safety_manager') {
    return <SupervisorActivityView role={role} />
  }

  redirect('/dashboard')
}
