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

// ---------------------------------------------------------------------------
// Password recovery and change
// ---------------------------------------------------------------------------

export const emailSchema = z.object({ email: z.string().trim().email('Escribe un correo válido.') })

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' })

/**
 * Sends the reset e-mail. The link lands on `<web>/restablecer/`, which opens the APK through
 * App Links (or the web), so the public web address must be configured.
 */
export async function requestPasswordReset(email: string, webUrl: string) {
  if (!webUrl) throw new Error('reset_not_configured')
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${webUrl}/restablecer/` })
  if (error) throw error
}

/**
 * Opens the recovery session carried by the reset link: tokens in the hash (implicit flow) or
 * a `code` in the query (PKCE). Needed in the APK, where the link arrives after the client
 * started, so Supabase does not read the URL by itself.
 */
export async function openRecoverySession(url: URL): Promise<'ok' | 'none' | 'invalid'> {
  const supabase = createClient()
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  if (hash.get('error') || url.searchParams.get('error')) return 'invalid'
  const access_token = hash.get('access_token')
  const refresh_token = hash.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    return error ? 'invalid' : 'ok'
  }
  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return error ? 'invalid' : 'ok'
  }
  return 'none'
}

export async function updatePassword(password: string) {
  const { error } = await createClient().auth.updateUser({ password })
  if (error) throw error
}
