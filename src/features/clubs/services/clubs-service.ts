import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/shared/types/database'

type Tables = Database['public']['Tables']
export type Club = Tables['clubs']['Row']
export type ClubMember = Tables['club_members']['Row']
export type TableTemplate = Tables['table_templates']['Row']
export type ChipLedgerRow = Tables['chip_ledger']['Row']
export type MemberRole = 'owner' | 'admin' | 'player'
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'rejected'

function db() {
  return createClient()
}

function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

function rows<T>(result: { data: T[] | null; error: unknown }): T[] {
  return must(result) ?? []
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------

export interface MyClub {
  club: Club
  role: MemberRole
  status: MemberStatus
  balance: number
}

export async function listMyClubs(userId: string): Promise<MyClub[]> {
  const [members, accounts] = await Promise.all([
    db().from('club_members').select('role, status, clubs(*)').eq('user_id', userId).neq('status', 'rejected'),
    db().from('chip_accounts').select('club_id, balance').eq('user_id', userId).eq('kind', 'player'),
  ])
  const balances = new Map(rows(accounts).map((a) => [a.club_id, a.balance]))
  return rows(members)
    .filter((m) => m.clubs)
    .map((m) => ({
      club: m.clubs as Club,
      role: m.role as MemberRole,
      status: m.status as MemberStatus,
      balance: balances.get((m.clubs as Club).id) ?? 0,
    }))
    .sort((a, b) => a.club.name.localeCompare(b.club.name))
}

export async function findClub(code: string) {
  return rows(await db().rpc('find_club', { p_code: code }))[0] ?? null
}

export async function requestJoinClub(code: string): Promise<string> {
  return must(await db().rpc('request_join_club', { p_code: code })) ?? ''
}

export async function getMyClub(clubId: string, userId: string): Promise<MyClub | null> {
  const clubs = await listMyClubs(userId)
  return clubs.find((c) => c.club.id === clubId) ?? null
}

export async function listTemplates(clubId: string, includeInactive = false): Promise<TableTemplate[]> {
  let query = db().from('table_templates').select('*').eq('club_id', clubId)
  if (!includeInactive) query = query.eq('is_active', true)
  return rows(await query.order('sort_order').order('entry'))
}

/** The player's movements in a club; `accountId` tells the direction of each row. */
export async function listMyMovements(
  clubId: string,
  userId: string,
): Promise<{ accountId: string | null; movements: ChipLedgerRow[] }> {
  const account = must(
    await db().from('chip_accounts').select('id').eq('club_id', clubId).eq('user_id', userId).eq('kind', 'player').maybeSingle(),
  )
  if (!account) return { accountId: null, movements: [] }
  const movements = rows(
    await db()
      .from('chip_ledger')
      .select('*')
      .or(`from_account.eq.${account.id},to_account.eq.${account.id}`)
      .order('created_at', { ascending: false })
      .limit(50),
  )
  return { accountId: account.id, movements }
}

// ---------------------------------------------------------------------------
// Club admin side
// ---------------------------------------------------------------------------

export interface MemberRow {
  userId: string
  displayName: string
  role: MemberRole
  status: MemberStatus
  requestedAt: string
  balance: number
}

export async function listMembers(clubId: string): Promise<MemberRow[]> {
  const [members, accounts] = await Promise.all([
    db()
      .from('club_members')
      .select('user_id, role, status, requested_at, profiles!club_members_user_id_fkey(display_name)')
      .eq('club_id', clubId)
      .neq('status', 'rejected'),
    db().from('chip_accounts').select('user_id, balance').eq('club_id', clubId).eq('kind', 'player'),
  ])
  const balances = new Map(rows(accounts).map((a) => [a.user_id, a.balance]))
  return rows(members).map((m) => ({
    userId: m.user_id,
    displayName: (m.profiles as { display_name: string } | null)?.display_name ?? '—',
    role: m.role as MemberRole,
    status: m.status as MemberStatus,
    requestedAt: m.requested_at,
    balance: balances.get(m.user_id) ?? 0,
  }))
}

export async function getTreasuryBalance(clubId: string): Promise<number> {
  const row = must(
    await db().from('chip_accounts').select('balance').eq('club_id', clubId).eq('kind', 'treasury').maybeSingle(),
  )
  return row?.balance ?? 0
}

export async function reviewMember(clubId: string, userId: string, approve: boolean) {
  must(await db().rpc('club_review_member', { p_club: clubId, p_user: userId, p_approve: approve }))
}

export async function setMemberStatus(clubId: string, userId: string, status: 'active' | 'suspended') {
  must(await db().rpc('club_set_member_status', { p_club: clubId, p_user: userId, p_status: status }))
}

export async function setMemberRole(clubId: string, userId: string, role: 'admin' | 'player') {
  must(await db().rpc('club_set_member_role', { p_club: clubId, p_user: userId, p_role: role }))
}

export async function moveChips(
  action: 'assign' | 'withdraw' | 'adjust',
  clubId: string,
  userId: string,
  amount: number,
  note: string,
) {
  const args = { p_club: clubId, p_user: userId, p_amount: amount, p_note: note }
  if (action === 'assign') must(await db().rpc('club_assign_chips', args))
  else if (action === 'withdraw') must(await db().rpc('club_withdraw_chips', args))
  else must(await db().rpc('club_adjust_chips', args))
}

export type TemplateInput = Pick<
  TableTemplate,
  'name' | 'max_pip' | 'format' | 'entry' | 'target_points' | 'scoring' | 'turn_seconds'
>

export async function createTemplate(clubId: string, input: TemplateInput) {
  must(await db().from('table_templates').insert({ club_id: clubId, ...input }))
}

export async function setTemplateActive(templateId: string, isActive: boolean) {
  must(await db().from('table_templates').update({ is_active: isActive }).eq('id', templateId))
}

export async function updateRake(clubId: string, rakePct: number, rakeCap: number | null) {
  must(await db().rpc('club_update_rake', { p_club: clubId, p_rake_pct: rakePct, p_rake_cap: rakeCap as number /* null clears the cap; generated types omit nullability */ }))
}

export async function clubReport(clubId: string, from: Date, to: Date) {
  return rows(await db().rpc('club_report', { p_club: clubId, p_from: from.toISOString(), p_to: to.toISOString() }))[0]
}

export async function listClubMovements(clubId: string): Promise<ChipLedgerRow[]> {
  return rows(
    await db().from('chip_ledger').select('*').eq('club_id', clubId).order('created_at', { ascending: false }).limit(100),
  )
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const ROLE_LABEL: Record<MemberRole, string> = { owner: 'Dueño', admin: 'Admin', player: 'Jugador' }
export const STATUS_LABEL: Record<MemberStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  rejected: 'Rechazado',
}
export const MOVEMENT_LABEL: Record<string, string> = {
  issue: 'Emisión',
  retire: 'Devolución a la plataforma',
  assign: 'Asignación',
  withdraw: 'Retirada',
  buy_in: 'Entrada a mesa',
  payout: 'Premio de mesa',
  rake: 'Cargo de mesa',
  refund: 'Devolución',
  adjustment: 'Ajuste',
}

export function templateLabel(t: Pick<TableTemplate, 'max_pip' | 'format'>): string {
  return `${t.max_pip === 9 ? 'Doble 9' : 'Doble 6'} · ${t.format === 'pairs' ? 'Parejas' : '1 vs 1'}`
}
