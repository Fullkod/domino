'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  findClub,
  listMyClubs,
  requestJoinClub,
  ROLE_LABEL,
  STATUS_LABEL,
  type MyClub,
} from '@/features/clubs/services/clubs-service'
import { Badge, Button, Card, Input, Notice, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

export default function ClubsPage() {
  const { userId } = useCurrentUser()
  const [clubs, setClubs] = useState<MyClub[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState(0)
  const load = useCallback(async () => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    listMyClubs(userId).then(
      (data) => current && setClubs(data),
      (err) => current && setError(errorMessage(err)),
    )
    return () => {
      current = false
    }
  }, [userId, version])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Mis clubes</h1>
      {error && <Notice>{error}</Notice>}
      {clubs === null ? (
        <Spinner />
      ) : clubs.length === 0 ? (
        <Notice tone="info">Aún no estás en ningún club. Pide el código a tu club y búscalo abajo.</Notice>
      ) : (
        <ul className="space-y-3">
          {clubs.map(({ club, role, status, balance }) => (
            <li key={club.id}>
              <ClubCard clubId={club.id} active={status === 'active'}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{club.name}</p>
                    <p className="text-xs text-neutral-500">Código {club.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {status !== 'active' && <Badge tone={status === 'pending' ? 'amber' : 'red'}>{STATUS_LABEL[status]}</Badge>}
                    {role !== 'player' && <Badge tone="green">{ROLE_LABEL[role]}</Badge>}
                    {club.status === 'suspended' && <Badge tone="red">Club suspendido</Badge>}
                  </div>
                </div>
                {status === 'active' && (
                  <p className="mt-3 text-sm text-neutral-300">
                    Tus fichas: <span className="font-semibold text-violet-300">{formatChips(balance)}</span>
                  </p>
                )}
                {status === 'pending' && (
                  <p className="mt-3 text-sm text-neutral-400">Esperando a que un administrador del club te acepte.</p>
                )}
              </ClubCard>
            </li>
          ))}
        </ul>
      )}
      <JoinClub onJoined={load} />
    </div>
  )
}

function ClubCard({ clubId, active, children }: { clubId: string; active: boolean; children: React.ReactNode }) {
  if (!active) return <Card>{children}</Card>
  return (
    <Link href={`/club/?id=${clubId}`} className="block">
      <Card className="transition hover:border-violet-700">{children}</Card>
    </Link>
  )
}

function JoinClub({ onJoined }: { onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState<{ club_name: string; members: number } | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setFound(null)
    const clean = code.trim().toUpperCase()
    if (clean.length !== 6) {
      setMessage({ tone: 'error', text: 'El código tiene 6 caracteres.' })
      return
    }
    setBusy(true)
    try {
      const club = await findClub(clean)
      if (club) setFound(club)
      else setMessage({ tone: 'error', text: 'No hay ningún club con ese código.' })
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    try {
      await requestJoinClub(code.trim().toUpperCase())
      setMessage({ tone: 'success', text: 'Solicitud enviada. Te avisaremos cuando te acepten.' })
      setFound(null)
      setCode('')
      await onJoined()
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Buscar club</h2>
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Código del club"
          maxLength={6}
          autoCapitalize="characters"
          className="uppercase tracking-widest"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Buscar
        </Button>
      </form>
      {found && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-800/60 p-3">
          <div>
            <p className="font-semibold">{found.club_name}</p>
            <p className="text-xs text-neutral-400">{found.members} miembros</p>
          </div>
          <Button onClick={join} disabled={busy}>
            Solicitar entrada
          </Button>
        </div>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </Card>
  )
}
