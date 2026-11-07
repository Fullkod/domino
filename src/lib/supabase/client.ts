import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

export type DbClient = SupabaseClient<Database>

// Browser-only client. The app is a static export (APK + static web), so there is
// no server-side Supabase client: authorization is enforced by RLS and RPC grants.
// The session persists in localStorage, which also works inside the Capacitor WebView.
let client: DbClient | undefined

export function createClient(): DbClient {
  client ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return client
}
