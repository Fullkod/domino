'use client'

import { Capacitor } from '@capacitor/core'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { DownloadAppButton } from '@/features/app-update/components/DownloadAppButton'
import { findClub, listMyClubs, requestJoinClub, type MyClub } from '@/features/clubs/services/clubs-service'
import { cleanCode, clearPendingInvite, invitePath, savePendingInvite } from '@/features/invites/lib/invite'
import { Button, Card, Notice, Spinner } from '@/shared/components/ui'
import { Logo } from '@/shared/components/Logo'
import { BRAND } from '@/shared/constants/brand'
import { useSession } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

// Invitation link target: /unirse/?c=CODE (opened by the APK through App Links, or in a browser).
const APP_ID = 'com.dominoclubes.app'

export default function JoinPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Join />
    </Suspense>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-5 py-10">
      <div className="text-center">
        <div className="flex justify-center">
          <Logo variant="stacked" height={104} />
        </div>
        <h1 className="sr-only">{BRAND.appName}</h1>
        <p className="text-sm text-neutral-400">{BRAND.tagline}</p>
      </div>
      {children}
    </div>
  )
}

function Join() {
  const code = cleanCode(useSearchParams().get('c'))
  const { loading, session } = useSession()
  const native = Capacitor.isNativePlatform()

  // Keep the code while the user signs in or creates an account.
  useEffect(() => {
    if (code && !loading && !session) savePendingInvite(code)
  }, [code, loading, session])

  if (!code) {
    return (
      <Shell>
        <Notice>Este enlace de invitación no es válido. Pide al club que te lo vuelva a mandar.</Notice>
        <Link href="/" className="text-center text-sm text-neutral-400 underline">
          Ir al inicio
        </Link>
      </Shell>
    )
  }
  if (loading) return <Spinner />
  if (session) return <JoinAsMember code={code} userId={session.user.id} />
  return <Shell>{native ? <SignInFirst code={code} /> : <WebLanding code={code} />}</Shell>
}

function CodeBox({ code }: { code: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
      <p className="text-xs text-neutral-500">Código del club</p>
      <p className="font-mono text-3xl font-bold tracking-[0.3em] text-violet-300">{code}</p>
    </div>
  )
}

function SignInFirst({ code }: { code: string }) {
  return (
    <Card className="space-y-4">
      <p className="text-center font-semibold">Te invitaron a un club</p>
      <CodeBox code={code} />
      <p className="text-sm text-neutral-400">
        Crea tu cuenta o entra con la que ya tienes. Después te llevamos al club para pedir la entrada.
      </p>
      <Link href="/signup/" className="block">
        <Button className="w-full">Crear cuenta</Button>
      </Link>
      <Link href="/login/" className="block">
        <Button variant="secondary" className="w-full">
          Ya tengo cuenta
        </Button>
      </Link>
    </Card>
  )
}

/** In a phone browser without the app (or with App Links not verified yet). */
function WebLanding({ code }: { code: string }) {
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.host))
  const openInApp = `intent://${origin}${invitePath(code)}#Intent;scheme=https;package=${APP_ID};end`
  return (
    <Card className="space-y-4">
      <p className="text-center font-semibold">Te invitaron a un club</p>
      <CodeBox code={code} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-300">
        <li>Descarga e instala la app.</li>
        <li>Vuelve a tocar el enlace de la invitación: se abrirá en la app.</li>
        <li>Crea tu cuenta y pide entrar al club.</li>
      </ol>
      <DownloadAppButton />
      <a href={openInApp} className="block">
        <Button variant="secondary" className="w-full">
          Ya la tengo: abrir en la app
        </Button>
      </a>
      <p className="text-xs text-neutral-500">
        Si Android avisa de que la app es de origen desconocido, permite la instalación desde el navegador.
      </p>
    </Card>
  )
}

type JoinState =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'not_found' }
  | { kind: 'ready'; clubName: string; members: number; mine: MyClub | null }
  | { kind: 'sent'; clubName: string }

function JoinAsMember({ code, userId }: { code: string; userId: string }) {
  const [state, setState] = useState<JoinState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    clearPendingInvite()
    let current = true
    Promise.all([findClub(code), listMyClubs(userId)]).then(
      ([club, mine]) => {
        if (!current) return
        if (!club) return setState({ kind: 'not_found' })
        setState({
          kind: 'ready',
          clubName: club.club_name,
          members: Number(club.members),
          mine: mine.find((m) => m.club.id === club.club_id) ?? null,
        })
      },
      (err) => current && setState({ kind: 'error', text: errorMessage(err) }),
    )
    return () => {
      current = false
    }
  }, [code, userId])

  async function join(clubName: string) {
    setBusy(true)
    try {
      await requestJoinClub(code)
      setState({ kind: 'sent', clubName })
    } catch (err) {
      setState({ kind: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      {state.kind === 'loading' && <Spinner />}
      {state.kind === 'error' && <Notice>{state.text}</Notice>}
      {state.kind === 'not_found' && <Notice>No hay ningún club activo con el código {code}.</Notice>}
      {state.kind === 'sent' && (
        <Notice tone="success">
          Solicitud enviada a «{state.clubName}». Un administrador del club tiene que aceptarte; lo verás en «Mis
          clubes».
        </Notice>
      )}
      {state.kind === 'ready' && (
        <Card className="space-y-4">
          <div className="text-center">
            <p className="text-xs text-neutral-500">Te invitaron al club</p>
            <p className="text-2xl font-bold">{state.clubName}</p>
            <p className="text-xs text-neutral-500">
              Código {code} · {state.members} miembros
            </p>
          </div>
          {state.mine?.status === 'active' ? (
            <>
              <Notice tone="success">Ya eres miembro de este club.</Notice>
              <Link href={`/club/?id=${state.mine.club.id}`} className="block">
                <Button className="w-full">Ir al club</Button>
              </Link>
            </>
          ) : state.mine?.status === 'pending' ? (
            <Notice tone="info">Ya pediste entrar. Falta que un administrador del club te acepte.</Notice>
          ) : state.mine?.status === 'suspended' ? (
            <Notice>Estás suspendido en este club. Habla con el club.</Notice>
          ) : (
            <Button className="w-full" onClick={() => join(state.clubName)} disabled={busy}>
              Pedir entrar al club
            </Button>
          )}
        </Card>
      )}
      <Link href="/clubs/" className="text-center text-sm text-neutral-400 underline">
        Ir a mis clubes
      </Link>
    </Shell>
  )
}
