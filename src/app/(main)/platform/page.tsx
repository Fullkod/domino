'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  auditChips,
  createClub,
  findUserByEmail,
  issueChips,
  listAllClubs,
  setClubStatus,
  type PlatformClub,
} from '@/features/platform/services/platform-service'
import { Badge, Button, Card, Field, Input, Notice, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

type Message = { tone: 'error' | 'success'; text: string } | null

export default function PlatformPage() {
  const { profile } = useCurrentUser()
  const [clubs, setClubs] = useState<PlatformClub[] | null>(null)
  const [audit, setAudit] = useState<number | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const isPlatform = profile?.role === 'platform'

  useEffect(() => {
    if (!isPlatform) return
    let current = true
    Promise.all([listAllClubs(), auditChips()]).then(
      ([list, problems]) => {
        if (!current) return
        setClubs(list)
        setAudit(problems.length)
      },
      (err) => current && setMessage({ tone: 'error', text: errorMessage(err) }),
    )
    return () => {
      current = false
    }
  }, [isPlatform, version])

  const act = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setMessage(null)
      try {
        await fn()
        setMessage({ tone: 'success', text: success })
        reload()
        return true
      } catch (err) {
        setMessage({ tone: 'error', text: errorMessage(err) })
        return false
      }
    },
    [reload],
  )

  if (!isPlatform) return <Notice tone="info">Esta sección es solo para la plataforma.</Notice>
  if (clubs === null) return <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plataforma</h1>
      {audit !== null &&
        (audit === 0 ? (
          <Notice tone="success">Cuadre de fichas correcto en todos los clubes.</Notice>
        ) : (
          <Notice>Cuadre de fichas: {audit} problema(s). Revisar antes de seguir operando.</Notice>
        ))}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <NewClub act={act} />

      <ul className="space-y-2">
        {clubs.map((c) => (
          <li key={c.club.id}>
            <ClubRow item={c} act={act} />
          </li>
        ))}
      </ul>
    </div>
  )
}

type Act = (fn: () => Promise<unknown>, success: string) => Promise<boolean>

function NewClub({ act }: { act: Act }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rake, setRake] = useState('5')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const rakePct = Number.parseFloat(rake.replace(',', '.'))
    if (name.trim().length < 2) return setError('El nombre del club debe tener al menos 2 caracteres.')
    if (!(rakePct >= 0 && rakePct <= 20)) return setError('El cargo va de 0 a 20 %.')
    try {
      const owner = await findUserByEmail(email)
      if (!owner) return setError('No hay ningún usuario registrado con ese correo.')
      const ok = await act(() => createClub(name.trim(), owner.user_id, rakePct), `Club creado. Dueño: ${owner.display_name}.`)
      if (ok) {
        setName('')
        setEmail('')
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">Nuevo club</h2>
        <Field label="Nombre del club">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Correo del dueño" hint="Debe haberse registrado antes en la app.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Cargo por partida (%)">
          <Input inputMode="decimal" value={rake} onChange={(e) => setRake(e.target.value)} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <Button type="submit" className="w-full">
          Crear club
        </Button>
      </form>
    </Card>
  )
}

function ClubRow({ item, act }: { item: PlatformClub; act: Act }) {
  const [amount, setAmount] = useState('')
  const { club } = item

  async function issue(e: FormEvent) {
    e.preventDefault()
    const value = Number.parseInt(amount, 10)
    if (!(value > 0)) return
    const ok = await act(() => issueChips(club.id, value, 'Emisión de la plataforma'), `${formatChips(value)} fichas emitidas a ${club.name}.`)
    if (ok) setAmount('')
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">
            {club.name} {club.status === 'suspended' && <Badge tone="red">Suspendido</Badge>}
          </p>
          <p className="text-xs text-neutral-400">
            Código {club.code} · dueño {item.ownerName} · cargo {club.rake_pct} %
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-500">Tesorería</p>
          <p className="font-semibold">{formatChips(item.treasury)}</p>
        </div>
      </div>
      <form onSubmit={issue} className="flex gap-2">
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="Fichas a emitir" />
        <Button type="submit" disabled={!amount}>
          Emitir
        </Button>
      </form>
      <Button
        variant={club.status === 'active' ? 'danger' : 'secondary'}
        onClick={() =>
          act(
            () => setClubStatus(club.id, club.status === 'active' ? 'suspended' : 'active'),
            club.status === 'active' ? 'Club suspendido.' : 'Club reactivado.',
          )
        }
      >
        {club.status === 'active' ? 'Suspender club' : 'Reactivar club'}
      </Button>
    </Card>
  )
}
