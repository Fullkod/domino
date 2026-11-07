'use client'

import { useState, type FormEvent } from 'react'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { Button, Field, Notice } from '@/shared/components/ui'
import { errorMessage } from '@/shared/lib/errors'
import { fieldErrors, newPasswordSchema, updatePassword } from '../services/auth-service'

/** New password + confirmation for the signed-in user (reset link or profile). */
export function NewPasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [values, setValues] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = newPasswordSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await updatePassword(parsed.data.password)
      setValues({ password: '', confirm: '' })
      onDone()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nueva contraseña" hint="Al menos 8 caracteres.">
        <PasswordInput
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          autoComplete="new-password"
        />
        {errors.password && <span className="text-xs text-red-400">{errors.password}</span>}
      </Field>
      <Field label="Repite la contraseña">
        <PasswordInput
          value={values.confirm}
          onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))}
          autoComplete="new-password"
        />
        {errors.confirm && <span className="text-xs text-red-400">{errors.confirm}</span>}
      </Field>
      {formError && <Notice>{formError}</Notice>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Un momento…' : submitLabel}
      </Button>
    </form>
  )
}
