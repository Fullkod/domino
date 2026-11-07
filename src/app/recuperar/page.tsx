'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { emailSchema, requestPasswordReset } from '@/features/auth/services/auth-service'
import { Button, Field, Input, Notice } from '@/shared/components/ui'
import { BRAND } from '@/shared/constants/brand'
import { errorMessage } from '@/shared/lib/errors'

// Step 1 of password recovery: ask for the e-mail and send the reset link.
export default function RecoverPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = emailSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Escribe un correo válido.')
      return
    }
    setBusy(true)
    try {
      await requestPasswordReset(parsed.data.email, BRAND.webUrl)
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell subtitle="Recupera tu contraseña">
      {sent ? (
        <Notice tone="success">
          Si hay una cuenta con ese correo, te llegará un enlace para poner una contraseña nueva. Ábrelo desde este
          teléfono. Mira también en «Spam».
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-neutral-400">Escribe el correo de tu cuenta y te mandamos un enlace.</p>
          <Field label="Correo">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login/" className="text-violet-400">
          Volver a entrar
        </Link>
      </p>
    </AuthShell>
  )
}
