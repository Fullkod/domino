'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  clubReport,
  createTemplate,
  getMyClub,
  getTreasuryBalance,
  listClubMovements,
  listMembers,
  listTemplates,
  movementTitle,
  moveChips,
  reviewMember,
  ROLE_LABEL,
  setMemberRole,
  setMemberStatus,
  setTemplateActive,
  STATUS_LABEL,
  templateLabel,
  updateRake,
  type ChipLedgerRow,
  type MemberRow,
  type MyClub,
  type TableTemplate,
  type TemplateInput,
} from '@/features/clubs/services/clubs-service'
import { ContactSheet } from '@/features/contacts/components/ContactSheet'
import { ContactsEditor } from '@/features/contacts/components/ContactsEditor'
import { InviteButton } from '@/features/invites/components/InviteButton'
import { Badge, Button, Card, Field, Input, Notice, Select, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'
import { whenLabel } from '@/shared/lib/time'

type Tab = 'requests' | 'members' | 'tables' | 'treasury' | 'contacts'

interface AdminData {
  club: MyClub
  members: MemberRow[]
  templates: TableTemplate[]
  treasury: number
  movements: ChipLedgerRow[]
  report: Awaited<ReturnType<typeof clubReport>> | undefined
}

export default function ClubAdminPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ClubAdmin />
    </Suspense>
  )
}

function ClubAdmin() {
  const clubId = useSearchParams().get('id') ?? ''
  const { userId, profile } = useCurrentUser()
  const [platformContact, setPlatformContact] = useState<string | null>(null)
  const [data, setData] = useState<AdminData | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('requests')
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [version, setVersion] = useState(0)
  // True from an action until the reload after it lands, so stale rows cannot be tapped twice.
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    async function fetchAll(): Promise<AdminData | null> {
      const club = await getMyClub(clubId, userId)
      if (!club || club.status !== 'active' || club.role === 'player') return null
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      const [members, templates, treasury, movements, report] = await Promise.all([
        listMembers(clubId),
        listTemplates(clubId, true),
        getTreasuryBalance(clubId),
        listClubMovements(clubId),
        clubReport(clubId, since, new Date(Date.now() + 60_000)),
      ])
      return { club, members, templates, treasury, movements, report }
    }
    fetchAll().then(
      (next) => {
        if (!current) return
        setData(next)
        setBusy(false)
      },
      (err) => {
        if (!current) return
        setMessage({ tone: 'error', text: errorMessage(err) })
        setBusy(false)
      },
    )
    return () => {
      current = false
    }
  }, [clubId, userId, version])

  /** Runs an admin action, shows its outcome and reloads. */
  const act = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setMessage(null)
      setBusy(true)
      try {
        await fn()
        setMessage({ tone: 'success', text: success })
        reload()
        return true
      } catch (err) {
        setMessage({ tone: 'error', text: errorMessage(err) })
        setBusy(false)
        return false
      }
    },
    [reload],
  )

  if (data === undefined) return <Spinner />
  if (data === null) return <Notice tone="info">No administras este club.</Notice>

  const pending = data.members.filter((m) => m.status === 'pending')
  const isOwner = data.club.role === 'owner'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.club.club.name}</h1>
          <p className="text-sm text-neutral-400">
            Código para invitar: <span className="font-mono text-lg tracking-widest text-white">{data.club.club.code}</span>
          </p>
        </div>
        <Link href={`/club/?id=${clubId}`}>
          <Button variant="ghost">Volver</Button>
        </Link>
      </div>
      <InviteButton clubName={data.club.club.name} code={data.club.club.code} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">Fichas del club (tesorería)</span>
          <span className="text-2xl font-bold">{formatChips(data.treasury)}</span>
        </div>
        {data.treasury === 0 && (
          <Button variant="secondary" className="w-full" onClick={() => setPlatformContact('La tesorería del club está vacía.')}>
            Contactar a la plataforma
          </Button>
        )}
      </Card>

      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ['requests', `Solicitudes${pending.length ? ` (${pending.length})` : ''}`],
            ['members', 'Miembros'],
            ['tables', 'Mesas'],
            ['treasury', 'Caja'],
            ['contacts', 'Contacto'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              tab === value ? 'bg-neutral-800 text-white' : 'text-neutral-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-70">
      {tab === 'requests' && (
        <Requests
          pending={pending}
          onReview={(m, approve) =>
            act(() => reviewMember(clubId, m.userId, approve), approve ? `${m.displayName} ya es miembro.` : 'Solicitud rechazada.')
          }
        />
      )}
      {tab === 'members' && (
        <Members
          members={data.members.filter((m) => m.status !== 'pending')}
          clubId={clubId}
          userId={userId}
          isOwner={isOwner}
          treasury={data.treasury}
          onShort={() => setPlatformContact(PLATFORM_SHORT)}
          act={act}
        />
      )}
      {tab === 'tables' && <Templates templates={data.templates} clubId={clubId} act={act} />}
      {tab === 'treasury' && <Treasury data={data} clubId={clubId} isOwner={isOwner} act={act} />}
      {tab === 'contacts' && (
        <ContactsEditor
          clubId={clubId}
          intro="Los jugadores ven estos teléfonos cuando no tienen fichas suficientes para jugar. Ponlos con el código del país."
        />
      )}
      </fieldset>
      {platformContact && (
        <ContactSheet
          clubId={null}
          title="Contactar a la plataforma"
          reason={platformContact}
          message={`Hola, soy ${profile?.display_name ?? ''}, del club ${data.club.club.name} (código ${data.club.club.code}).`}
          onClose={() => setPlatformContact(null)}
        />
      )}
    </div>
  )
}

type Act = (fn: () => Promise<unknown>, success: string) => Promise<boolean>

const PLATFORM_SHORT = 'La tesorería del club no tiene fichas suficientes. Habla con la plataforma:'

function Requests({ pending, onReview }: { pending: MemberRow[]; onReview: (m: MemberRow, approve: boolean) => void }) {
  if (pending.length === 0) return <Notice tone="info">No hay solicitudes pendientes.</Notice>
  return (
    <ul className="space-y-2">
      {pending.map((m) => (
        <li key={m.userId}>
          <Card className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{m.displayName}</p>
              <p className="text-xs text-neutral-500">{new Date(m.requestedAt).toLocaleString('es')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onReview(m, false)}>
                Rechazar
              </Button>
              <Button onClick={() => onReview(m, true)}>Aceptar</Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function Members({
  members,
  clubId,
  userId,
  isOwner,
  treasury,
  onShort,
  act,
}: {
  members: MemberRow[]
  clubId: string
  userId: string
  isOwner: boolean
  treasury: number
  onShort: () => void
  act: Act
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const visible = members
    .filter((m) => m.displayName.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  return (
    <div className="space-y-3">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador" />
      <ul className="space-y-2">
        {visible.map((m) => (
          <li key={m.userId}>
            <Card>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === m.userId ? null : m.userId)}>
                <div>
                  <p className="font-medium">{m.displayName}</p>
                  <div className="mt-1 flex gap-1">
                    {m.role !== 'player' && <Badge tone="green">{ROLE_LABEL[m.role]}</Badge>}
                    {m.status !== 'active' && <Badge tone="red">{STATUS_LABEL[m.status]}</Badge>}
                  </div>
                </div>
                <span className="font-semibold text-emerald-300">{formatChips(m.balance)}</span>
              </button>
              {open === m.userId && (
                <MemberActions
                  member={m}
                  clubId={clubId}
                  self={m.userId === userId}
                  isOwner={isOwner}
                  treasury={treasury}
                  onShort={onShort}
                  act={act}
                />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MemberActions({
  member,
  clubId,
  self,
  isOwner,
  treasury,
  onShort,
  act,
}: {
  member: MemberRow
  clubId: string
  self: boolean
  isOwner: boolean
  treasury: number
  onShort: () => void
  act: Act
}) {
  const [action, setAction] = useState<'assign' | 'withdraw' | 'adjust'>('assign')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number.parseInt(amount, 10)
    if (!Number.isInteger(value) || value === 0 || (action !== 'adjust' && value < 0)) return
    const labels = { assign: 'Fichas asignadas.', withdraw: 'Fichas retiradas.', adjust: 'Ajuste registrado.' }
    const ok = await act(() => moveChips(action, clubId, member.userId, value, note.trim()), labels[action])
    if (ok) {
      setAmount('')
      setNote('')
    }
  }

  // Chips leave the treasury on assign and on a positive adjustment.
  const requested = Number.parseInt(amount, 10)
  const short = (action === 'assign' || action === 'adjust') && requested > 0 && requested > treasury

  const canManage = !self && member.role !== 'owner' && (member.role === 'player' || isOwner)

  return (
    <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ['assign', 'Asignar'],
              ['withdraw', 'Retirar'],
              ['adjust', 'Ajustar'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              onClick={() => setAction(value)}
              className={`rounded-lg py-1.5 text-sm ${action === value ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(action === 'adjust' ? /[^\d-]/g : /\D/g, ''))}
          placeholder={action === 'adjust' ? 'Cantidad (negativa para quitar)' : 'Cantidad'}
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={action === 'adjust' ? 'Motivo (obligatorio)' : 'Nota (opcional)'}
          maxLength={200}
        />
        {short ? (
          <>
            <Notice tone="info">La tesorería solo tiene {formatChips(treasury)} fichas.</Notice>
            <Button type="button" variant="secondary" className="w-full" onClick={onShort}>
              Contactar a la plataforma
            </Button>
          </>
        ) : (
          <Button type="submit" className="w-full" disabled={!amount || (action === 'adjust' && !note.trim())}>
            Confirmar
          </Button>
        )}
      </form>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {member.status === 'active' ? (
            <Button variant="danger" onClick={() => act(() => setMemberStatus(clubId, member.userId, 'suspended'), 'Miembro suspendido.')}>
              Suspender
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => act(() => setMemberStatus(clubId, member.userId, 'active'), 'Miembro reactivado.')}>
              Reactivar
            </Button>
          )}
          {isOwner && member.status === 'active' && (
            <Button
              variant="secondary"
              onClick={() =>
                act(
                  () => setMemberRole(clubId, member.userId, member.role === 'admin' ? 'player' : 'admin'),
                  member.role === 'admin' ? 'Ya no es admin.' : 'Ahora es admin.',
                )
              }
            >
              {member.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_TEMPLATE: TemplateInput = {
  name: '',
  max_pip: 9,
  format: 'pairs',
  entry: 10,
  target_points: 100,
  scoring: 'all_hands',
  turn_seconds: 30,
}

function Templates({ templates, clubId, act }: { templates: TableTemplate[]; clubId: string; act: Act }) {
  const [form, setForm] = useState<TemplateInput>(EMPTY_TEMPLATE)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Ponle un nombre a la mesa.')
    if (form.entry < 5 || form.entry > 10500) return setError('La entrada va de 5 a 10 500 fichas.')
    if (form.turn_seconds < 10 || form.turn_seconds > 120) return setError('El turno va de 10 a 120 segundos.')
    if (form.target_points < 1) return setError('Los puntos para ganar deben ser mayores que 0.')
    setError(null)
    const ok = await act(() => createTemplate(clubId, { ...form, name: form.name.trim() }), 'Mesa creada.')
    if (ok) setForm(EMPTY_TEMPLATE)
  }

  const num = (key: 'entry' | 'target_points' | 'turn_seconds') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: Number.parseInt(e.target.value || '0', 10) }))

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id}>
            <Card className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {t.name} {!t.is_active && <Badge tone="red">Cerrada</Badge>}
                </p>
                <p className="text-xs text-neutral-400">
                  {templateLabel(t)} · entrada {formatChips(t.entry)} · a {t.target_points} · {t.turn_seconds} s
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => act(() => setTemplateActive(t.id, !t.is_active), t.is_active ? 'Mesa cerrada.' : 'Mesa abierta.')}
              >
                {t.is_active ? 'Cerrar' : 'Abrir'}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <form onSubmit={submit} className="space-y-3">
          <h2 className="font-semibold">Nueva mesa</h2>
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} placeholder="Ej. Parejas 50" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Juego">
              <Select value={form.max_pip} onChange={(e) => setForm((f) => ({ ...f, max_pip: Number(e.target.value) }))}>
                <option value={9}>Doble 9</option>
                <option value={6}>Doble 6</option>
              </Select>
            </Field>
            <Field label="Formato">
              <Select value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}>
                <option value="pairs">Parejas (4)</option>
                <option value="one_vs_one">1 vs 1</option>
              </Select>
            </Field>
            <Field label="Entrada (fichas)">
              <Input inputMode="numeric" value={form.entry} onChange={num('entry')} />
            </Field>
            <Field label="Puntos para ganar">
              <Input inputMode="numeric" value={form.target_points} onChange={num('target_points')} />
            </Field>
            <Field label="Segundos por turno">
              <Input inputMode="numeric" value={form.turn_seconds} onChange={num('turn_seconds')} />
            </Field>
            <Field label="Al dominar cuentan">
              <Select value={form.scoring} onChange={(e) => setForm((f) => ({ ...f, scoring: e.target.value }))}>
                <option value="all_hands">Todas las manos</option>
                <option value="opponents">Solo las contrarias</option>
              </Select>
            </Field>
          </div>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" className="w-full">
            Crear mesa
          </Button>
        </form>
      </Card>
    </div>
  )
}

function Treasury({ data, clubId, isOwner, act }: { data: AdminData; clubId: string; isOwner: boolean; act: Act }) {
  const [pct, setPct] = useState(String(data.club.club.rake_pct))
  const [cap, setCap] = useState(data.club.club.rake_cap ? String(data.club.club.rake_cap) : '')
  const r = data.report

  async function saveRake(e: FormEvent) {
    e.preventDefault()
    const value = Number.parseFloat(pct.replace(',', '.'))
    if (!(value >= 0 && value <= 20)) return
    await act(() => updateRake(clubId, value, cap ? Number.parseInt(cap, 10) : null), 'Cargo actualizado.')
  }

  return (
    <div className="space-y-4">
      {r && (
        <Card>
          <h2 className="mb-2 font-semibold">Últimos 30 días</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-neutral-400">Partidas</dt>
            <dd className="text-right">
              {r.games} ({r.cancelled_games} anuladas)
            </dd>
            <dt className="text-neutral-400">Botes jugados</dt>
            <dd className="text-right">{formatChips(r.pot_total)}</dd>
            <dt className="text-neutral-400">Cargos cobrados</dt>
            <dd className="text-right">{formatChips(r.rake_total)}</dd>
            <dt className="text-neutral-400">Fichas recibidas</dt>
            <dd className="text-right">{formatChips(r.chips_issued)}</dd>
            <dt className="text-neutral-400">Asignadas a jugadores</dt>
            <dd className="text-right">{formatChips(r.chips_assigned)}</dd>
            <dt className="text-neutral-400">Retiradas a jugadores</dt>
            <dd className="text-right">{formatChips(r.chips_withdrawn)}</dd>
          </dl>
        </Card>
      )}

      <Card>
        <form onSubmit={saveRake} className="space-y-3">
          <h2 className="font-semibold">Cargo por partida</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Porcentaje del bote" hint="De 0 a 20 %">
              <Input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} disabled={!isOwner} />
            </Field>
            <Field label="Tope (fichas)" hint="Vacío = sin tope">
              <Input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} disabled={!isOwner} />
            </Field>
          </div>
          {isOwner ? (
            <Button type="submit">Guardar</Button>
          ) : (
            <p className="text-xs text-neutral-500">Solo el dueño del club puede cambiar el cargo.</p>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Movimientos recientes</h2>
        {data.movements.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 text-sm">
            {data.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p>{movementTitle(m)}</p>
                  <p className="text-xs text-neutral-500">
                    {whenLabel(m.created_at)}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </div>
                <span>{formatChips(m.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
