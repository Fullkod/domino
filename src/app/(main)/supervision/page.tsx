'use client'

import { useEffect, useState } from 'react'
import {
  accountLabel,
  auditProblems,
  loadBooks,
  loadMovements,
  type AuditMovement,
  type ClubBooks,
} from '@/features/audit/services/audit-service'
import { MOVEMENT_LABEL } from '@/features/clubs/services/clubs-service'
import { Badge, Button, Card, Notice, Select, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

// Supervisor screen: chip movements of the operator and of every club, read-only.
const KIND_FILTERS = {
  all: { label: 'Todos los movimientos', kinds: undefined },
  platform: { label: 'Plataforma ↔ clubes', kinds: ['issue', 'retire'] },
  club: { label: 'Club ↔ jugadores', kinds: ['assign', 'withdraw', 'adjustment'] },
  games: { label: 'Mesas', kinds: ['buy_in', 'payout', 'rake', 'refund'] },
} as const
type KindFilter = keyof typeof KIND_FILTERS

function kindsOf(filter: KindFilter): string[] | undefined {
  const kinds = KIND_FILTERS[filter].kinds
  return kinds ? [...kinds] : undefined
}

export default function SupervisionPage() {
  const { profile } = useCurrentUser()
  const allowed = profile?.role === 'auditor' || profile?.role === 'platform'
  const [books, setBooks] = useState<ClubBooks[] | null>(null)
  const [problems, setProblems] = useState<number | null>(null)
  const [clubId, setClubId] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [movements, setMovements] = useState<AuditMovement[]>([])
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let current = true
    Promise.all([loadBooks(), auditProblems()]).then(
      ([b, p]) => {
        if (!current) return
        setBooks(b)
        setProblems(p)
      },
      (err) => current && setError(errorMessage(err)),
    )
    return () => {
      current = false
    }
  }, [allowed])

  useEffect(() => {
    if (!allowed) return
    let current = true
    loadMovements({ clubId: clubId || undefined, kinds: kindsOf(kind) }).then(
      (rows) => {
        if (!current) return
        setMovements(rows)
        setMore(rows.length === 100)
      },
      (err) => current && setError(errorMessage(err)),
    )
    return () => {
      current = false
    }
  }, [allowed, clubId, kind])

  async function loadMore() {
    const last = movements[movements.length - 1]
    if (!last) return
    try {
      const rows = await loadMovements({
        clubId: clubId || undefined,
        kinds: kindsOf(kind),
        before: last.id,
      })
      setMovements((prev) => [...prev, ...rows])
      setMore(rows.length === 100)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!allowed) return <Notice tone="info">Esta sección es solo para supervisión.</Notice>
  if (books === null) return error ? <Notice>{error}</Notice> : <Spinner />

  const totals = books.reduce(
    (t, b) => ({
      issued: t.issued + Number(b.issued),
      treasury: t.treasury + Number(b.treasury),
      players: t.players + Number(b.players),
      share: t.share + Number(b.platform_share),
    }),
    { issued: 0, treasury: 0, players: 0, share: 0 },
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Supervisión</h1>
      {problems === 0 ? (
        <Notice tone="success">Cuadre de fichas correcto en todos los clubes.</Notice>
      ) : (
        <Notice>Cuadre de fichas: {problems} problema(s).</Notice>
      )}
      {error && <Notice>{error}</Notice>}

      <Card>
        <h2 className="mb-2 font-semibold">Total plataforma</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-neutral-400">Fichas emitidas (netas)</dt>
          <dd className="text-right font-semibold">{formatChips(totals.issued)}</dd>
          <dt className="text-neutral-400">En tesorerías</dt>
          <dd className="text-right">{formatChips(totals.treasury)}</dd>
          <dt className="text-neutral-400">En manos de jugadores</dt>
          <dd className="text-right">{formatChips(totals.players)}</dd>
          <dt className="text-neutral-400">Parte de la plataforma</dt>
          <dd className="text-right">{formatChips(totals.share)}</dd>
        </dl>
      </Card>

      <ul className="space-y-2">
        {books.map((b) => (
          <li key={b.club_id}>
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {b.club_name} <span className="text-xs font-normal text-neutral-500">{b.club_code}</span>{' '}
                  {b.club_status === 'suspended' && <Badge tone="red">Suspendido</Badge>}
                </p>
                <span className="text-xs text-neutral-500">{Number(b.player_count)} jugadores</span>
              </div>
              <dl className="grid grid-cols-2 gap-y-0.5 text-sm">
                <dt className="text-neutral-400">Emitidas (netas)</dt>
                <dd className="text-right">{formatChips(b.issued)}</dd>
                <dt className="text-neutral-400">Tesorería</dt>
                <dd className="text-right">{formatChips(b.treasury)}</dd>
                <dt className="text-neutral-400">Jugadores</dt>
                <dd className="text-right">{formatChips(b.players)}</dd>
                {Number(b.pots) > 0 && (
                  <>
                    <dt className="text-neutral-400">En mesas ahora</dt>
                    <dd className="text-right">{formatChips(b.pots)}</dd>
                  </>
                )}
                {(Number(b.platform_share_pct) > 0 || Number(b.platform_share) > 0) && (
                  <>
                    <dt className="text-neutral-400">Parte plataforma ({b.platform_share_pct} %)</dt>
                    <dd className="text-right">{formatChips(b.platform_share)}</dd>
                  </>
                )}
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="space-y-3">
        <h2 className="font-semibold">Movimientos</h2>
        <div className="grid grid-cols-2 gap-2">
          <Select value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">Todos los clubes</option>
            {books.map((b) => (
              <option key={b.club_id} value={b.club_id}>
                {b.club_name}
              </option>
            ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
            {Object.entries(KIND_FILTERS).map(([value, f]) => (
              <option key={value} value={value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        {movements.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin movimientos.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{MOVEMENT_LABEL[m.kind] ?? m.kind}</p>
                  <span className="font-semibold">{formatChips(m.amount)}</span>
                </div>
                <p className="text-xs text-neutral-400">
                  {accountLabel(m.from_kind, m.from_name)} → {accountLabel(m.to_kind, m.to_name)}
                  {!clubId && ` · ${m.club_name}`}
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(m.created_at).toLocaleString('es')} · {m.actor_name ?? 'Sistema'}
                  {m.note ? ` · ${m.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        {more && (
          <Button variant="secondary" className="w-full" onClick={loadMore}>
            Ver más
          </Button>
        )}
      </Card>
    </div>
  )
}
