import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'deepgram_not_configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'token_grant_failed' }, { status: 502 })
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number }
    return NextResponse.json({
      access_token: json.access_token,
      expires_in: json.expires_in ?? 30,
    })
  } catch {
    return NextResponse.json({ error: 'token_grant_failed' }, { status: 502 })
  }
}
