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
}

export async function listAllClubs(): Promise<PlatformClub[]> {
  const [clubs, treasuries] = await Promise.all([
    db().from('clubs').select('*, profiles!clubs_owner_id_fkey(display_name)').order('created_at', { ascending: false }),
    db().from('chip_accounts').select('club_id, balance').eq('kind', 'treasury'),
  ])
  const balances = new Map((must(treasuries) ?? []).map((t) => [t.club_id, t.balance]))
  return (must(clubs) ?? []).map((c) => ({
    club: c as Club,
    ownerName: (c.profiles as { display_name: string } | null)?.display_name ?? '—',
    treasury: balances.get(c.id) ?? 0,
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

export async function setClubStatus(clubId: string, status: 'active' | 'suspended') {
  must(await db().rpc('platform_set_club_status', { p_club: clubId, p_status: status }))
}

/** Ledger integrity problems; an empty list means every club balances. */
export async function auditChips() {
  return must(await db().rpc('chip_audit')) ?? []
}
