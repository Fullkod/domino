'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AuthShell } from '@/features/auth/components/AuthShell'
import { NewPasswordForm } from '@/features/auth/components/NewPasswordForm'
import { openRecoverySession } from '@/features/auth/services/auth-service'
import { createClient } from '@/lib/supabase/client'
import { Notice, Spinner } from '@/shared/components/ui'

// Step 2 of password recovery: the reset e-mail link lands here (APK via App Links, or web).
type State = 'checking' | 'ready' | 'invalid' | 'done'

async function checkLink(url: URL): Promise<State> {
  const result = await openRecoverySession(url)
  if (result === 'invalid') return 'invalid'
  // With no tokens in the URL, Supabase may already have read the link when it started (web).
  const { data } = await createClient().auth.getSession()
  return data.session ? 'ready' : 'invalid'
}

export default function ResetPage() {
  const router = useRouter()
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let current = true
    checkLink(new URL(window.location.href))
      .catch((): State => 'invalid')
      .then((next) => {
        if (!current) return
        // Drop the tokens from the address bar.
        window.history.replaceState(null, '', '/restablecer/')
        setState(next)
      })
    return () => {
      current = false
    }
  }, [])

  return (
    <AuthShell subtitle="Pon una contraseña nueva">
      {state === 'checking' && <Spinner />}
      {state === 'invalid' && (
        <>
          <Notice>El enlace no es válido o ya caducó. Pide otro.</Notice>
          <p className="text-center text-sm">
            <Link href="/recuperar/" className="text-violet-400">
              Pedir otro enlace
            </Link>
          </p>
        </>
      )}
      {state === 'ready' && <NewPasswordForm submitLabel="Guardar contraseña" onDone={() => setState('done')} />}
      {state === 'done' && (
        <>
          <Notice tone="success">Contraseña cambiada. Ya estás dentro.</Notice>
          <button
            type="button"
            className="w-full text-center text-sm text-violet-400"
            onClick={() => router.replace('/clubs/')}
          >
            Ir a mis clubes
          </button>
        </>
      )}
    </AuthShell>
  )
}
