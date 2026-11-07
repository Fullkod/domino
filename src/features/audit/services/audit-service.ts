import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/shared/types/database'

// Read-only chip books for the supervisor ('auditor') and the platform. No contacts or
// personal data: only club names, display names and chip movements.
type Functions = Database['public']['Functions']
export type ClubBooks = Functions['audit_books']['Returns'][number]
export type AuditMovement = Functions['audit_movements']['Returns'][number]

function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

export async function loadBooks(): Promise<ClubBooks[]> {
  return must(await createClient().rpc('audit_books')) ?? []
}

export async function loadMovements(opts: { clubId?: string; kinds?: string[]; before?: number }): Promise<AuditMovement[]> {
  const args: Functions['audit_movements']['Args'] = { p_limit: 100 }
  if (opts.clubId) args.p_club = opts.clubId
  if (opts.kinds) args.p_kinds = opts.kinds
  if (opts.before) args.p_before = opts.before
  return must(await createClient().rpc('audit_movements', args)) ?? []
}

export async function auditProblems(): Promise<number> {
  return (must(await createClient().rpc('chip_audit')) ?? []).length
}

const ACCOUNT_LABEL: Record<string, string> = {
  issuance: 'Plataforma',
  treasury: 'Tesorería',
  platform: 'Parte plataforma',
  pot: 'Bote',
}

/** "Tesorería", "Bote" or the player's display name. */
export function accountLabel(kind: string, name: string | null): string {
  return kind === 'player' ? (name ?? 'Jugador') : (ACCOUNT_LABEL[kind] ?? kind)
}
