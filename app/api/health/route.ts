import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      supabase: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
