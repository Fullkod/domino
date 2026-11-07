import { createClient } from '@/lib/supabase/client'
import type { Club } from '@/features/clubs/services/clubs-service'

function db() {
  return createClient()
}

function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

export interface PlatformClub {
  club: Club
  ownerName: string
  treasury: number
  /** Accumulated platform share of the rake (settled outside the app, then retired). */
  platformShare: number
}

export async function listAllClubs(): Promise<PlatformClub[]> {
  const [clubs, treasuries] = await Promise.all([
    db().from('clubs').select('*, profiles!clubs_owner_id_fkey(display_name)').order('created_at', { ascending: false }),
    db().from('chip_accounts').select('club_id, kind, balance').in('kind', ['treasury', 'platform']),
  ])
  const accounts = must(treasuries) ?? []
  const balances = new Map(accounts.filter((a) => a.kind === 'treasury').map((t) => [t.club_id, t.balance]))
  const shares = new Map(accounts.filter((a) => a.kind === 'platform').map((t) => [t.club_id, t.balance]))
  return (must(clubs) ?? []).map((c) => ({
    club: c as Club,
    ownerName: (c.profiles as { display_name: string } | null)?.display_name ?? '—',
    treasury: balances.get(c.id) ?? 0,
    platformShare: shares.get(c.id) ?? 0,
  }))
}

export async function findUserByEmail(email: string) {
  return (must(await db().rpc('platform_find_user', { p_email: email })) ?? [])[0] ?? null
}

export async function createClub(name: string, ownerId: string, rakePct: number) {
  return must(await db().rpc('platform_create_club', { p_name: name, p_owner: ownerId, p_rake_pct: rakePct }))
}

export async function issueChips(clubId: string, amount: number, note: string) {
  must(await db().rpc('platform_issue_chips', { p_club: clubId, p_amount: amount, p_note: note }))
}

export async function getMinAppVersion(): Promise<string> {
  return must(await db().from('app_settings').select('min_app_version').maybeSingle())?.min_app_version ?? ''
}

export async function setMinAppVersion(version: string) {
  must(await db().rpc('platform_update_settings', { p_min_app_version: version }))
}

/** Chips back from a club to the platform (settled outside the app). Note required. */
export async function retireChips(clubId: string, source: 'treasury' | 'platform', amount: number, note: string) {
  must(await db().rpc('platform_retire_chips', { p_club: clubId, p_source: source, p_amount: amount, p_note: note }))
}

export async function setClubShare(clubId: string, sharePct: number) {
  must(await db().rpc('platform_set_club_share', { p_club: clubId, p_share_pct: sharePct }))
}

export async function setClubStatus(clubId: string, status: 'active' | 'suspended') {
  must(await db().rpc('platform_set_club_status', { p_club: clubId, p_status: status }))
}

/** Ledger integrity problems; an empty list means every club balances. */
export async function auditChips() {
  return must(await db().rpc('chip_audit')) ?? []
}
