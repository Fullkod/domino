import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

export const loginSchema = z.object({
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(30, 'El nombre puede tener como máximo 30 caracteres.'),
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

export async function signIn({ email, password }: LoginInput) {
  const { error } = await createClient().auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** The `handle_new_user` trigger creates the profile from `display_name`. */
export async function signUp({ displayName, email, password }: SignupInput) {
  const { data, error } = await createClient().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })
  if (error) throw error
  // With email confirmation on, Supabase returns no session until the user confirms.
  return { needsConfirmation: data.session === null }
}

export async function signOut() {
  await createClient().auth.signOut()
}

/** First error message per field, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}
