'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { DownloadAppButton } from '@/features/app-update/components/DownloadAppButton'
import { afterSignInPath, readPendingInvite } from '@/features/invites/lib/invite'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { Button, Field, Input, Notice } from '@/shared/components/ui'
import { Logo } from '@/shared/components/Logo'
import { BRAND } from '@/shared/constants/brand'
import { errorMessage } from '@/shared/lib/errors'
import { fieldErrors, loginSchema, signIn, signUp, signupSchema } from '../services/auth-service'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [values, setValues] = useState({
    displayName: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setInfo(null)
    const parsed = mode === 'login' ? loginSchema.safeParse(values) : signupSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(loginSchema.parse(values))
        router.replace(afterSignInPath())
      } else {
        const { needsConfirmation } = await signUp(signupSchema.parse(values))
        if (needsConfirmation) setInfo('Te enviamos un correo para confirmar la cuenta.')
        else router.replace(afterSignInPath())
      }
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'
  // An invitation link opened before signing in (read on the client only).
  const pendingInvite = useSyncExternalStore(noSubscribe, readPendingInvite, () => null)

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
        <div className="space-y-1 text-center">
          <div className="flex justify-center">
            <Logo variant="stacked" height={104} />
          </div>
          <h1 className="sr-only">{BRAND.appName}</h1>
          <p className="text-sm text-neutral-400">{isSignup ? 'Crea tu cuenta para jugar' : BRAND.tagline}</p>
        </div>

        {pendingInvite && (
          <Notice tone="info">
            Te invitaron a un club (código {pendingInvite}). {isSignup ? 'Crea tu cuenta' : 'Entra'} y luego pides la
            entrada.
          </Notice>
        )}

        {isSignup && (
          <Field label="Nombre de jugador">
            <Input value={values.displayName} onChange={set('displayName')} autoComplete="nickname" maxLength={30} />
            {errors.displayName && <span className="text-xs text-red-400">{errors.displayName}</span>}
          </Field>
        )}
        <Field label="Correo">
          <Input type="email" value={values.email} onChange={set('email')} autoComplete="email" inputMode="email" />
          {errors.email && <span className="text-xs text-red-400">{errors.email}</span>}
        </Field>
        <Field label="Contraseña" hint={isSignup ? 'Al menos 8 caracteres.' : undefined}>
          <PasswordInput
            value={values.password}
            onChange={set('password')}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {errors.password && <span className="text-xs text-red-400">{errors.password}</span>}
        </Field>
        {!isSignup && (
          <p className="-mt-3 text-right text-sm">
            <Link href="/recuperar/" className="text-violet-400">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        )}

        {formError && <Notice>{formError}</Notice>}
        {info && <Notice tone="success">{info}</Notice>}

        {isSignup && (
          <p className="text-xs text-neutral-500">
            Al crear la cuenta confirmas que tienes 18 años o más y aceptas los{' '}
            <Link href="/terminos/" className="text-violet-400 underline">
              términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/terminos/#privacidad" className="text-violet-400 underline">
              privacidad
            </Link>
            .
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Un momento…' : isSignup ? 'Crear cuenta' : 'Entrar'}
        </Button>

        <p className="text-center text-sm text-neutral-400">
          {isSignup ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
          <Link href={isSignup ? '/login/' : '/signup/'} className="font-semibold text-violet-400">
            {isSignup ? 'Entra' : 'Regístrate'}
          </Link>
        </p>
        <DownloadAppButton />
        {!isSignup && (
          <p className="text-center text-xs">
            <Link href="/terminos/" className="text-neutral-500 underline">
              Términos y condiciones
            </Link>
          </p>
        )}
      </form>
    </div>
  )
}

function noSubscribe() {
  return () => undefined
}
