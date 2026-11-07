'use client'

import { legalMoves } from '@engine/rules'
import type { HandState, Move, Seat, Side, Tile } from '@engine/types'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DominoTile, HiddenTiles } from '@/features/tables/components/DominoTile'
import {
  gameAction,
  leaveTable,
  loadTableView,
  setReady,
  subscribeTable,
  type TableView,
} from '@/features/tables/services/tables-service'
import { Badge, Button, Card, Notice, Spinner, formatChips } from '@/shared/components/ui'
import { useCurrentUser } from '@/shared/hooks/session'
import { errorMessage } from '@/shared/lib/errors'

const GAME_ERRORS: Record<string, string> = {
  not_your_turn: 'No es tu turno.',
  tile_does_not_fit: 'Esa ficha no entra por ese lado.',
  must_play_opening: 'Debes salir con el doble más alto.',
  cannot_pass_with_legal_move: 'Tienes jugada: no puedes pasar.',
}

const SILENT_GAME_ERRORS = new Set(['game_not_playing', 'hand_finished', 'conflict'])

export default function MesaPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Mesa />
    </Suspense>
  )
}

function Mesa() {
  const tableId = useSearchParams().get('id') ?? ''
  const router = useRouter()
  const { userId } = useCurrentUser()
  const [view, setView] = useState<TableView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const load = useCallback(() => setVersion((v) => v + 1), [])

  // Each bump reloads the view; a newer reload discards the result of an older one.
  // `busy` (set by an action) only clears once the fresh view lands, so the board never
  // offers a move based on the state from before the player's own action.
  useEffect(() => {
    let current = true
    loadTableView(tableId, userId).then(
      (next) => {
        if (!current) return
        setView(next)
        setBusy(false)
      },
      (err) => {
        if (!current) return
        setError(errorMessage(err))
        setBusy(false)
      },
    )
    return () => {
      current = false
    }
  }, [tableId, userId, version])

  const gameId = view?.game?.id ?? null
  useEffect(() => subscribeTable(tableId, gameId, load), [tableId, gameId, load])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null)
      setBusy(true)
      try {
        await fn()
      } catch (err) {
        const code = err instanceof Error ? err.message : ''
        // The table moved on (game ended, hand ended, someone else's move landed first):
        // not an error for the player, the reload below shows the current state.
        if (!SILENT_GAME_ERRORS.has(code)) setError(GAME_ERRORS[code] ?? errorMessage(err))
      } finally {
        load()
      }
    },
    [load],
  )

  // Start automatically when the table is full and everyone is ready.
  const startKey = useRef<string | null>(null)
  useEffect(() => {
    if (!view || view.table.status === 'playing' || view.table.status === 'closed') return
    const capacity = view.template.format === 'one_vs_one' ? 2 : 4
    const allReady = view.seats.length === capacity && view.seats.every((s) => s.ready)
    if (!allReady) return
    const key = view.seats.map((s) => s.userId).join(',') + (view.game?.id ?? '')
    if (startKey.current === key) return
    startKey.current = key
    void gameAction({ action: 'start', tableId }).then(
      (res) => {
        if (res.reason === 'insufficient_chips') setError('Alguien no tiene fichas suficientes.')
        load()
      },
      (err) => setError(errorMessage(err)),
    )
  }, [view, tableId, load])

  if (view === undefined) return <Spinner />
  if (view === null) return <Notice tone="info">Esta mesa ya no existe.</Notice>

  const playing = view.game?.status === 'playing'
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{view.template.name}</h1>
          <p className="text-xs text-neutral-400">
            Entrada {formatChips(view.template.entry)} · {view.template.max_pip === 9 ? 'Doble 9' : 'Doble 6'} · a{' '}
            {view.template.target_points}
          </p>
        </div>
        <Link href={`/club/?id=${view.table.club_id}`} className="text-sm text-neutral-400">
          Club
        </Link>
      </div>
      {error && <Notice>{error}</Notice>}
      {playing ? (
        <GameBoard view={view} userId={userId} busy={busy} run={run} />
      ) : (
        <WaitingRoom
          view={view}
          userId={userId}
          busy={busy}
          onReady={(ready) => run(() => setReady(ready))}
          onLeave={() =>
            run(async () => {
              await leaveTable()
              router.replace(`/club/?id=${view.table.club_id}`)
            })
          }
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Waiting room (before a game and between games)
// ---------------------------------------------------------------------------

function WaitingRoom({
  view,
  userId,
  busy,
  onReady,
  onLeave,
}: {
  view: TableView
  userId: string
  busy: boolean
  onReady: (ready: boolean) => void
  onLeave: () => void
}) {
  const capacity = view.template.format === 'one_vs_one' ? 2 : 4
  const me = view.seats.find((s) => s.userId === userId)
  return (
    <div className="space-y-4">
      {view.game && view.game.status !== 'playing' && <GameResult view={view} userId={userId} />}
      <Card className="space-y-3">
        <h2 className="font-semibold">
          Jugadores {view.seats.length}/{capacity}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {Array.from({ length: capacity }, (_, seat) => {
            const s = view.seats.find((x) => x.seat === seat)
            return (
              <li key={seat} className="rounded-lg border border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">
                  Asiento {seat + 1}
                  {capacity === 4 && ` · Pareja ${(seat % 2) + 1}`}
                </p>
                <p className="font-medium">{s ? s.name : 'Libre'}</p>
                {s && <Badge tone={s.ready ? 'green' : 'neutral'}>{s.ready ? 'Listo' : 'Esperando'}</Badge>}
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-neutral-400">
          La partida empieza sola cuando la mesa está llena y todos marcan «Listo». La entrada se cobra al empezar.
        </p>
      </Card>
      {me ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onReady(!me.ready)} disabled={busy}>
            {me.ready ? 'No estoy listo' : 'Listo'}
          </Button>
          <Button variant="secondary" onClick={onLeave} disabled={busy}>
            Levantarse
          </Button>
        </div>
      ) : (
        <Notice tone="info">No estás sentado en esta mesa.</Notice>
      )}
    </div>
  )
}

function GameResult({ view, userId }: { view: TableView; userId: string }) {
  const game = view.game!
  const me = view.players.find((p) => p.userId === userId)
  if (game.status === 'cancelled') {
    return (
      <Notice tone="info">
        Partida anulada{game.end_reason === 'abandoned_first_hand' ? ' por abandono en la primera mano' : ''}.{' '}
        {me?.refunded ? 'Se te devolvió la entrada.' : ''}
      </Notice>
    )
  }
  const won = me !== undefined && me.team === game.winner_team
  return (
    <Card className={won ? 'border-emerald-700' : ''}>
      <p className="text-lg font-bold">{won ? '¡Ganaste!' : 'Perdiste'}</p>
      <p className="text-sm text-neutral-400">
        Marcador {game.score_team0} – {game.score_team1}
        {game.end_reason === 'abandoned' && ' · por abandono'}
      </p>
      {won && me && <p className="mt-1 text-sm text-emerald-300">+{formatChips(me.payout)} fichas</p>}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function GameBoard({
  view,
  userId,
  busy,
  run,
}: {
  view: TableView
  userId: string
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const game = view.game!
  const hand = view.hand
  const players = game.players
  const me = view.players.find((p) => p.userId === userId)
  const [selected, setSelected] = useState<Tile | null>(null)
  const now = useNow()

  const myTurn = !!hand && !!me && hand.status === 'playing' && hand.turnSeat === me.seat
  const moves = useMemo<Move[]>(() => {
    if (!hand || !me || !myTurn) return []
    const hands: Tile[][] = Array.from({ length: players }, () => [])
    hands[me.seat] = view.myTiles
    const state: HandState = {
      hands,
      board: hand.board,
      ends: hand.ends,
      turn: hand.turnSeat as Seat,
      starter: hand.starterSeat as Seat,
      requiredOpening: hand.requiredOpening,
      passesInRow: 0,
      status: 'playing',
      result: null,
    }
    return legalMoves(state, me.seat as Seat)
  }, [hand, me, myTurn, players, view.myTiles])

  const canPass = moves.length === 1 && moves[0].type === 'pass'
  const sidesFor = (tile: Tile): Side[] =>
    moves.flatMap((m) => (m.type === 'play' && m.tile[0] === tile[0] && m.tile[1] === tile[1] ? [m.side] : []))

  // Nudge the server when a turn expires (deadline + grace) or when a finished hand is not
  // followed by a new one within 3 s. The server re-checks everything; retries every 5 s.
  const nextTick = useRef<{ key: string; at: number }>({ key: '', at: Number.POSITIVE_INFINITY })
  useEffect(() => {
    if (!hand) return
    const key = `${hand.id}:${hand.turnSeat}:${hand.board.length}:${hand.status}`
    if (nextTick.current.key !== key) {
      const deadline = hand.turnDeadline ? Date.parse(hand.turnDeadline) : null
      const at = hand.status === 'finished' ? now + 3000 : deadline !== null ? deadline + 1500 : Number.POSITIVE_INFINITY
      nextTick.current = { key, at }
    }
    if (now >= nextTick.current.at) {
      nextTick.current.at = now + 5000
      void gameAction({ action: 'tick', gameId: game.id }).catch(() => undefined)
    }
  }, [hand, now, game.id])

  function play(tile: Tile, side: Side) {
    setSelected(null)
    void run(() => gameAction({ action: 'play', gameId: game.id, tile, side }))
  }

  function onTile(tile: Tile) {
    const sides = sidesFor(tile)
    if (sides.length === 0) return
    if (sides.length === 1) play(tile, sides[0])
    else setSelected(tile)
  }

  if (!me) return <Notice tone="info">No juegas en esta partida.</Notice>
  if (!hand) return <Spinner label="Repartiendo…" />

  const seatAt = (offset: number) => ((me.seat + offset) % players) as Seat
  const playerAt = (seat: number) => view.players.find((p) => p.seat === seat)
  const remaining = hand.turnDeadline ? Math.max(0, Math.ceil((Date.parse(hand.turnDeadline) - now) / 1000)) : null
  const myTeamScore = me.team === 0 ? game.score_team0 : game.score_team1
  const theirScore = me.team === 0 ? game.score_team1 : game.score_team0

  const opponent = (offset: number) => {
    const seat = seatAt(offset)
    const p = playerAt(seat)
    const isTurn = hand.status === 'playing' && hand.turnSeat === seat
    return (
      <div className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 ${isTurn ? 'bg-emerald-950 ring-1 ring-emerald-600' : ''}`}>
        <span className="max-w-[7rem] truncate text-xs font-medium">{p?.name ?? '—'}</span>
        <HiddenTiles count={hand.tileCounts[seat] ?? 0} />
        {isTurn && remaining !== null && <span className="text-xs text-emerald-300">{remaining}s</span>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between rounded-lg bg-neutral-900 px-3 py-2 text-sm">
        <span>
          {players === 4 ? 'Nosotros' : 'Tú'} <b className="text-emerald-300">{myTeamScore}</b>
        </span>
        <span className="text-neutral-500">Mano {hand.handNo}</span>
        <span>
          {players === 4 ? 'Ellos' : playerAt(seatAt(1))?.name} <b>{theirScore}</b>
        </span>
      </div>

      <div className="flex justify-center">{opponent(players === 4 ? 2 : 1)}</div>
      <div className="flex items-stretch gap-2">
        {players === 4 && <div className="flex items-center">{opponent(3)}</div>}
        <div className="flex min-h-[9rem] flex-1 flex-wrap content-center items-center justify-center gap-0.5 rounded-xl bg-emerald-950/60 p-2">
          {hand.board.length === 0 ? (
            <span className="text-sm text-emerald-200/70">
              {hand.requiredOpening ? `Sale el ${hand.requiredOpening[0]}-${hand.requiredOpening[1]}` : 'Mesa vacía'}
            </span>
          ) : (
            hand.board.map((p, i) => (
              <DominoTile
                key={i}
                a={p.oriented[0]}
                b={p.oriented[1]}
                size="sm"
                orientation={p.oriented[0] === p.oriented[1] ? 'vertical' : 'horizontal'}
              />
            ))
          )}
        </div>
        {players === 4 && <div className="flex items-center">{opponent(1)}</div>}
      </div>

      {hand.status === 'finished' && hand.result && <HandOutcome view={view} myTeam={me.team} />}

      <div className={`rounded-xl p-3 ${myTurn ? 'bg-emerald-950/40 ring-1 ring-emerald-600' : 'bg-neutral-900'}`}>
        <p className="mb-2 text-center text-sm">
          {hand.status !== 'playing'
            ? 'Fin de la mano'
            : myTurn
              ? `Tu turno${remaining !== null ? ` · ${remaining}s` : ''}`
              : `Turno de ${playerAt(hand.turnSeat)?.name ?? '—'}`}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {view.myTiles.map((t) => {
            const playable = sidesFor(t).length > 0
            return (
              <DominoTile
                key={`${t[0]}-${t[1]}`}
                a={t[0]}
                b={t[1]}
                selected={selected?.[0] === t[0] && selected?.[1] === t[1]}
                disabled={!myTurn || !playable || busy}
                onClick={() => onTile(t)}
              />
            )
          })}
        </div>
        {selected && (
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => play(selected, 'left')} disabled={busy}>
              ← Izquierda ({hand.ends?.left})
            </Button>
            <Button variant="secondary" onClick={() => play(selected, 'right')} disabled={busy}>
              Derecha ({hand.ends?.right}) →
            </Button>
          </div>
        )}
        {myTurn && canPass && (
          <div className="mt-3 flex justify-center">
            <Button onClick={() => run(() => gameAction({ action: 'pass', gameId: game.id }))} disabled={busy}>
              Pasar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function HandOutcome({ view, myTeam }: { view: TableView; myTeam: number }) {
  const result = view.hand!.result!
  const winner = result.winnerSeat !== null ? view.players.find((p) => p.seat === result.winnerSeat)?.name : null
  const ours = result.winnerTeam === myTeam
  const text =
    result.kind === 'void'
      ? 'Tranque empatado: mano nula.'
      : `${result.kind === 'domino' ? `Dominó de ${winner}` : `Tranque: gana ${winner}`} · ${ours ? '+' : ''}${result.points} puntos ${ours ? 'para ti' : 'para ellos'}`
  return <Notice tone={ours ? 'success' : 'info'}>{text}</Notice>
}

function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
