'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import {
  getMyClub,
  listMyMovements,
  listTemplates,
  MOVEMENT_LABEL,
  templateLabel,
  type ChipLedgerRow,
  type MyClub,
  type TableTemplate,
} from '@/features/clubs/services/clubs-service'
import { ContactSheet } from '@/features/contacts/components/ContactSheet'
import { getMySeat, joinTable } from '@/features/tables/services/tables-service'
import { Button, Card, Notice, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

export default function ClubPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ClubLobby />
    </Suspense>
  )
}

function ClubLobby() {
  const clubId = useSearchParams().get('id') ?? ''
  const router = useRouter()
  const { userId, profile } = useCurrentUser()
  const [club, setClub] = useState<MyClub | null | undefined>(undefined)
  const [templates, setTemplates] = useState<TableTemplate[]>([])
  const [movements, setMovements] = useState<{ accountId: string | null; movements: ChipLedgerRow[] }>({
    accountId: null,
    movements: [],
  })
  const [mySeatTable, setMySeatTable] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pairs' | 'one_vs_one'>('all')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [contactReason, setContactReason] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    async function fetchAll() {
      const mine = await getMyClub(clubId, userId)
      if (mine?.status !== 'active') return { mine, rest: null }
      const [tpls, moves, seat] = await Promise.all([
        listTemplates(clubId),
        listMyMovements(clubId, userId),
        getMySeat(userId),
      ])
      return { mine, rest: { tpls, moves, seat } }
    }
    fetchAll().then(
      ({ mine, rest }) => {
        if (!current) return
        setClub(mine)
        if (rest) {
          setTemplates(rest.tpls)
          setMovements(rest.moves)
          setMySeatTable(rest.seat?.table_id ?? null)
        }
      },
      (err) => current && setError(errorMessage(err)),
    )
    return () => {
      current = false
    }
  }, [clubId, userId])

  async function sit(template: TableTemplate) {
    setBusy(template.id)
    setError(null)
    try {
      const tableId = await joinTable(template.id)
      router.push(`/mesa/?id=${tableId}`)
    } catch (err) {
      setBusy(null)
      // The server is the authority on balances: if it says short, offer the club's contacts.
      if (errorMessage(err) === errorMessage('insufficient_chips')) setContactReason(SHORT_REASON)
      else setError(errorMessage(err))
    }
  }

  if (club === undefined) return <Spinner />
  if (club === null || club.status !== 'active') {
    return <Notice tone="info">No tienes acceso a este club.</Notice>
  }

  const visible = templates.filter((t) => filter === 'all' || t.format === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{club.club.name}</h1>
          <p className="text-xs text-neutral-500">Código {club.club.code}</p>
        </div>
        {club.role !== 'player' && (
          <Link href={`/club/admin/?id=${clubId}`}>
            <Button variant="secondary">Administrar</Button>
          </Link>
        )}
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">Tus fichas</span>
          <span className="text-2xl font-bold text-emerald-300">{formatChips(club.balance)}</span>
        </div>
        {club.balance === 0 && (
          <Button variant="secondary" className="w-full" onClick={() => setContactReason('No tienes fichas en este club.')}>
            Contactar al club
          </Button>
        )}
      </Card>

      {mySeatTable && (
        <Link href={`/mesa/?id=${mySeatTable}`} className="block">
          <Notice tone="success">Estás sentado en una mesa. Toca aquí para volver.</Notice>
        </Link>
      )}
      {error && <Notice>{error}</Notice>}

      <div className="flex gap-2">
        {(
          [
            ['all', 'Todas'],
            ['pairs', 'Parejas'],
            ['one_vs_one', '1 vs 1'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-sm ${filter === value ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Notice tone="info">El club todavía no tiene mesas de este tipo.</Notice>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li key={t.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-700 text-xl font-bold">
                    {t.max_pip}
                  </span>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-neutral-400">
                      {templateLabel(t)} · a {t.target_points} · {t.turn_seconds} s
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm">
                    Entrada <span className="font-semibold">{formatChips(t.entry)}</span>
                  </span>
                  {club.balance < t.entry ? (
                    <Button variant="secondary" onClick={() => setContactReason(SHORT_REASON)} className="px-3 py-1.5">
                      Contactar al club
                    </Button>
                  ) : (
                    <Button
                      onClick={() => sit(t)}
                      disabled={busy !== null || mySeatTable !== null}
                      className="px-3 py-1.5"
                    >
                      {busy === t.id ? '…' : 'Sentarse'}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <h2 className="mb-2 font-semibold">Tus movimientos</h2>
        {movements.movements.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 text-sm">
            {movements.movements.map((m) => (
              <MovementRow key={m.id} movement={m} incoming={m.to_account === movements.accountId} />
            ))}
          </ul>
        )}
      </Card>

      {contactReason && (
        <ContactSheet
          clubId={clubId}
          title="Contactar al club"
          reason={contactReason}
          message={`Hola, soy ${profile?.display_name ?? ''} del club ${club.club.name} (código ${club.club.code}).`}
          onClose={() => setContactReason(null)}
        />
      )}
    </div>
  )
}

const SHORT_REASON = 'No tienes fichas suficientes para esta mesa. Habla con el club:'

function MovementRow({ movement, incoming }: { movement: ChipLedgerRow; incoming: boolean }) {
  return (
    <li className="flex items-center justify-between py-2">
      <div>
        <p>{MOVEMENT_LABEL[movement.kind] ?? movement.kind}</p>
        <p className="text-xs text-neutral-500">{new Date(movement.created_at).toLocaleString('es')}</p>
      </div>
      <span className={incoming ? 'text-emerald-300' : 'text-red-300'}>
        {incoming ? '+' : '−'}
        {formatChips(movement.amount)}
      </span>
    </li>
  )
}
