import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/shared/types/database'

// Who to talk to when someone runs out of chips (BUSINESS_LOGIC §3.3). The app never handles
// the agreement itself: it only opens WhatsApp or the dialer.
export type Contact = Database['public']['Tables']['contacts']['Row']

/** `clubId` null = the platform operator's contacts (readable by club admins). */
export async function listContacts(clubId: string | null): Promise<Contact[]> {
  let query = createClient().from('contacts').select('*')
  query = clubId ? query.eq('club_id', clubId) : query.is('club_id', null)
  const { data, error } = await query.order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function addContact(clubId: string | null, label: string, phone: string) {
  const { error } = await createClient().from('contacts').insert({ club_id: clubId, label: label.trim(), phone: normalizePhone(phone) })
  if (error) throw error
}

export async function deleteContact(id: string) {
  const { error } = await createClient().from('contacts').delete().eq('id', id)
  if (error) throw error
}

/** Keeps digits and a leading +: "+53 5 123-4567" → "+5351234567". */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '')
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{7,15}$/.test(normalizePhone(phone))
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export function callUrl(phone: string): string {
  return `tel:${phone}`
}
