'use client'

import { applyMove, legalMoves } from '@engine/rules'
import { sameTile } from '@engine/tiles'
import type { HandState, Move, PlayerCount, Seat, Side, Tile } from '@engine/types'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMyClub, type MyClub } from '@/features/clubs/services/clubs-service'
import { ContactSheet } from '@/features/contacts/components/ContactSheet'
import { BoardChain } from '@/features/tables/components/BoardChain'
import { DominoTile, HiddenTiles } from '@/features/tables/components/DominoTile'
import {
  gameAction,
  leaveTable,
  loadTableView,
  setReady,
  subscribeTable,
  toHandView,
  type HandView,
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
  const { userId, profile } = useCurrentUser()
  const [view, setView] = useState<TableView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [club, setClub] = useState<MyClub | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)

  // Realtime sends several events per move (hands, hand_tiles, games…): coalesce them into
  // one reload instead of restarting it for each event.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const load = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null
      setVersion((v) => v + 1)
    }, 150)
  }, [])
  useEffect(
    () => () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    },
    [],
  )

  // Each bump reloads the view; a newer reload discards the result of an older one, and
  // `mergeView` never lets a reload replace a newer hand (from Realtime or an optimistic move).
  useEffect(() => {
    let current = true
    loadTableView(tableId, userId).then(
      (next) => {
        if (!current) return
        setView((prev) => mergeView(prev, next))
      },
      (err) => {
        if (!current) return
        setError(errorMessage(err))
      },
    )
    return () => {
      current = false
    }
  }, [tableId, userId, version])

  // Hand and tile payloads update the board right away; the coalesced reload follows.
  const pendingTiles = useRef<{ handId: string; tiles: Tile[] } | null>(null)
  const onHand = useCallback((row: Parameters<typeof toHandView>[0]) => {
    setView((prev) => {
      if (!prev?.game || row.game_id !== prev.game.id) return prev
      const old = prev.hand
      if (old && (row.hand_no < old.handNo || (row.id === old.id && row.version <= old.version))) return prev
      const sameHand = old?.id === row.id
      const hand = toHandView(row, sameHand ? old.openingTile : null)
      if (!hand.openingTile && hand.board.length === 1) hand.openingTile = hand.board[0].tile
      let myTiles = prev.myTiles
      if (!sameHand) {
        const pending = pendingTiles.current
        myTiles = pending?.handId === row.id ? pending.tiles : []
      }
      return { ...prev, hand, myTiles }
    })
  }, [])
  const onTiles = useCallback(
    (row: { hand_id: string; seat: number; tiles: Tile[] }) => {
      pendingTiles.current = { handId: row.hand_id, tiles: row.tiles }
      setView((prev) => {
        if (!prev?.hand || prev.hand.id !== row.hand_id) return prev
        const me = prev.players.find((p) => p.userId === userId)
        if (!me || me.seat !== row.seat) return prev
        return { ...prev, myTiles: row.tiles.slice() }
      })
    },
    [userId],
  )

  // Balance for the waiting room: refreshed with every reload while no game is running.
  const clubId = view?.table.club_id ?? null
  const inGame = view?.game?.status === 'playing'
  useEffect(() => {
    if (!clubId || inGame) return
    let current = true
    getMyClub(clubId, userId).then(
      (mine) => current && setClub(mine),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [clubId, inGame, userId, version])

  const gameId = view?.game?.id ?? null
  useEffect(
    () => subscribeTable(tableId, gameId, { onChange: load, onHand, onTiles }),
    [tableId, gameId, load, onHand, onTiles],
  )

  // Shows the player's own move at once; the server's answer (Realtime) replaces it.
  const optimistic = useRef<{ hand: HandView; myTiles: Tile[] } | null>(null)
  const playOptimistic = useCallback(
    (move: Move) => {
      setView((prev) => {
        if (!prev?.hand || !prev.game) return prev
        const me = prev.players.find((p) => p.userId === userId)
        if (!me) return prev
        const next = predictMove(prev.hand, prev.myTiles, me.seat as Seat, prev.game.players, move)
        if (!next) return prev
        optimistic.current = { hand: prev.hand, myTiles: prev.myTiles }
        return { ...prev, hand: next.hand, myTiles: next.myTiles }
      })
    },
    [userId],
  )

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null)
      setBusy(true)
      try {
        await fn()
      } catch (err) {
        // Undo an optimistic move that the server did not accept.
        setView((prev) => {
          const saved = optimistic.current
          optimistic.current = null
          if (!saved || !prev?.hand || Number.isInteger(prev.hand.version)) return prev
          return { ...prev, hand: saved.hand, myTiles: saved.myTiles }
        })
        const code = err instanceof Error ? err.message : ''
        if (errorMessage(err) === errorMessage('insufficient_chips')) {
          setContactOpen(true)
          return
        }
        // The table moved on (game ended, hand ended, someone else's move landed first):
        // not an error for the player, the reload below shows the current state.
        if (!SILENT_GAME_ERRORS.has(code)) setError(GAME_ERRORS[code] ?? errorMessage(err))
      } finally {
        setBusy(false)
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
        <GameBoard view={view} userId={userId} busy={busy} run={run} predict={playOptimistic} />
      ) : (
        <WaitingRoom
          view={view}
          userId={userId}
          busy={busy}
          balance={club?.balance ?? null}
          onContact={() => setContactOpen(true)}
          onReady={(ready) => run(() => setReady(ready))}
          onLeave={() =>
            run(async () => {
              await leaveTable()
              router.replace(`/club/?id=${view.table.club_id}`)
            })
          }
        />
      )}
      {contactOpen && club && (
        <ContactSheet
          clubId={club.club.id}
          title="Contactar al club"
          reason={`No tienes fichas suficientes para la entrada de ${formatChips(view.template.entry)}. Habla con el club:`}
          message={`Hola, soy ${profile?.display_name ?? ''} del club ${club.club.name} (código ${club.club.code}).`}
          onClose={() => setContactOpen(false)}
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
  balance,
  onContact,
  onReady,
  onLeave,
}: {
  view: TableView
  userId: string
  busy: boolean
  balance: number | null
  onContact: () => void
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
          {!me.ready && balance !== null && balance < view.template.entry ? (
            <Button className="flex-1" onClick={onContact}>
              Contactar al club
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => onReady(!me.ready)} disabled={busy}>
              {me.ready ? 'No estoy listo' : 'Listo'}
            </Button>
          )}
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
    <Card className={won ? 'border-violet-700' : ''}>
      <p className="text-lg font-bold">{won ? '¡Ganaste!' : 'Perdiste'}</p>
      <p className="text-sm text-neutral-400">
        Marcador {game.score_team0} – {game.score_team1}
        {game.end_reason === 'abandoned' && ' · por abandono'}
      </p>
      {won && me && <p className="mt-1 text-sm text-violet-300">+{formatChips(me.payout)} fichas</p>}
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
  predict,
}: {
  view: TableView
  userId: string
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  predict: (move: Move) => void
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

  const board = hand?.board
  const boardPips = useMemo(() => (board ?? []).map((p) => p.oriented), [board])
  const openingTile = hand?.openingTile ?? null
  const openingIndex = useMemo(() => {
    if (!board || board.length === 0) return 0
    const found = openingTile ? board.findIndex((p) => sameTile(p.tile, openingTile)) : -1
    return found >= 0 ? found : Math.floor((board.length - 1) / 2)
  }, [board, openingTile])
  const lastPlayed = useLastPlayed(hand?.id ?? null, board ?? [])
  const [summary, dismissSummary] = useHandSummary(hand, now)

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
    predict({ type: 'play', tile, side })
    void run(() => gameAction({ action: 'play', gameId: game.id, tile, side }))
  }

  function pass() {
    predict({ type: 'pass' })
    void run(() => gameAction({ action: 'pass', gameId: game.id }))
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
      <div className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 ${isTurn ? 'bg-oro/10 ring-1 ring-oro' : ''}`}>
        <span className="max-w-[7rem] truncate text-xs font-medium">{p?.name ?? '—'}</span>
        <HiddenTiles count={hand.tileCounts[seat] ?? 0} />
        {isTurn && remaining !== null && <span className="font-mono text-xs text-oro">{remaining}s</span>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between rounded-lg bg-neutral-900 px-3 py-2 text-sm">
        <span>
          {players === 4 ? 'Nosotros' : 'Tú'} <b className="text-violet-300">{myTeamScore}</b>
        </span>
        <span className="text-neutral-500">
          Mano {hand.handNo} · a {game.target_points}
        </span>
        <span>
          {players === 4 ? 'Ellos' : playerAt(seatAt(1))?.name} <b>{theirScore}</b>
        </span>
      </div>

      <div className="flex justify-center">{opponent(players === 4 ? 2 : 1)}</div>
      <div className="flex items-stretch gap-2">
        {players === 4 && <div className="flex items-center">{opponent(3)}</div>}
        <div className="flex min-h-[9rem] min-w-0 flex-1 items-center justify-center rounded-xl bg-noche p-2">
          {hand.board.length === 0 ? (
            <span className="text-sm text-violet-200/70">
              {hand.requiredOpening ? `Sale el ${hand.requiredOpening[0]}-${hand.requiredOpening[1]}` : 'Mesa vacía'}
            </span>
          ) : (
            <BoardChain
              board={boardPips}
              openingIndex={openingIndex}
              highlightIndex={lastPlayed}
            />
          )}
        </div>
        {players === 4 && <div className="flex items-center">{opponent(1)}</div>}
      </div>

      {summary && (
        <HandSummaryCard
          view={view}
          summary={summary}
          myTeam={me.team}
          secondsLeft={Math.max(0, Math.ceil((summary.until - now) / 1000))}
          onClose={dismissSummary}
        />
      )}

      <div className={`rounded-xl p-3 ${myTurn ? 'bg-oro/5 ring-1 ring-oro' : 'bg-neutral-900'}`}>
        <p className={`mb-2 text-center text-sm ${myTurn ? 'font-semibold text-oro' : ''}`}>
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
            <Button onClick={pass} disabled={busy}>
              Pasar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface HandSummary {
  handId: string
  handNo: number
  result: NonNullable<HandView['result']>
  until: number
}

/** How long the end-of-hand summary stays up (the next hand is already dealt underneath). */
const SUMMARY_MS = 5000

/**
 * Keeps the result of the hand that just ended on screen for a few seconds: the server deals
 * the next hand at once, so without this the result would vanish before anyone reads it.
 */
function useHandSummary(hand: HandView | null, now: number): [HandSummary | null, () => void] {
  const [summary, setSummary] = useState<HandSummary | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (hand?.status === 'finished' && hand.result && summary?.handId !== hand.id && dismissed !== hand.id) {
    // Adjusting state while rendering (React's pattern for values derived from previous props).
    setSummary({ handId: hand.id, handNo: hand.handNo, result: hand.result, until: now + SUMMARY_MS })
  }
  const visible = summary && dismissed !== summary.handId && now < summary.until ? summary : null
  return [visible, () => summary && setDismissed(summary.handId)]
}

function HandSummaryCard({
  view,
  summary,
  myTeam,
  secondsLeft,
  onClose,
}: {
  view: TableView
  summary: HandSummary
  myTeam: number
  secondsLeft: number
  onClose: () => void
}) {
  const game = view.game!
  const { result } = summary
  const pairs = game.players === 4
  const winner = result.winnerSeat !== null ? view.players.find((p) => p.seat === result.winnerSeat)?.name : null
  const ours = result.winnerTeam === myTeam
  const rival = pairs ? 'Ellos' : (view.players.find((p) => p.team !== myTeam)?.name ?? 'Rival')
  const mine = myTeam === 0 ? game.score_team0 : game.score_team1
  const theirs = myTeam === 0 ? game.score_team1 : game.score_team0
  const gameOver = mine >= game.target_points || theirs >= game.target_points || game.status !== 'playing'

  const title =
    result.kind === 'void'
      ? 'Tranque empatado: mano nula'
      : result.kind === 'domino'
        ? `Dominó de ${winner ?? '—'}`
        : `Tranque: gana ${winner ?? '—'}`

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`w-full max-w-sm space-y-4 rounded-2xl border bg-neutral-900 p-5 text-center ${
          result.kind !== 'void' && ours ? 'border-violet-600' : 'border-neutral-700'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Fin de la mano {summary.handNo}</p>
          <p className="mt-1 text-lg font-bold">{title}</p>
          {result.kind !== 'void' && (
            <p className={`text-sm ${ours ? 'text-violet-300' : 'text-neutral-400'}`}>
              +{result.points} puntos {ours ? (pairs ? 'para nosotros' : 'para ti') : `para ${pairs ? 'ellos' : rival}`}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-neutral-800 p-3">
            <p className="truncate text-xs text-neutral-400">{pairs ? 'Nosotros' : 'Tú'}</p>
            <p className="text-3xl font-bold text-violet-300">{mine}</p>
          </div>
          <div className="rounded-xl bg-neutral-800 p-3">
            <p className="truncate text-xs text-neutral-400">{rival}</p>
            <p className="text-3xl font-bold">{theirs}</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400">
          Se juega a {game.target_points} puntos
          {!gameOver && ` · faltan ${Math.max(0, game.target_points - mine)} para ganar`}
        </p>
        <Button className="w-full" onClick={onClose}>
          {gameOver ? 'Ver resultado' : `Siguiente mano${secondsLeft > 0 ? ` en ${secondsLeft}…` : ''}`}
        </Button>
      </div>
    </div>
  )
}

function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Index of the tile just added to the board (either end), or null. */
function useLastPlayed(handId: string | null, board: readonly { tile: Tile }[]): number | null {
  const first = board[0]?.tile ?? null
  const [seen, setSeen] = useState<{ handId: string | null; first: Tile | null; length: number; last: number | null }>({
    handId: null,
    first: null,
    length: 0,
    last: null,
  })
  const changed =
    seen.handId !== handId ||
    seen.length !== board.length ||
    (seen.first !== null && first !== null && !sameTile(seen.first, first))
  if (!changed) return seen.last
  // Adjusting state while rendering (React's pattern for values derived from previous props).
  let last: number | null = board.length === 1 ? 0 : null
  if (seen.handId === handId && board.length === seen.length + 1 && board.length > 1) {
    last = seen.first && first && !sameTile(seen.first, first) ? 0 : board.length - 1
  }
  setSeen({ handId, first, length: board.length, last })
  return last
}

/** Newer state wins: a reload never replaces a later hand (Realtime or optimistic). */
function mergeView(prev: TableView | null | undefined, next: TableView | null): TableView | null {
  if (!prev?.hand || !next?.hand || prev.game?.id !== next.game?.id) return next
  const a = prev.hand
  const b = next.hand
  if (b.handNo < a.handNo || (b.id === a.id && b.version < a.version)) {
    return { ...next, hand: a, myTiles: prev.myTiles }
  }
  if (b.id === a.id && !b.openingTile && a.openingTile) return { ...next, hand: { ...b, openingTile: a.openingTile } }
  return next
}

/**
 * The player's own move as the server will apply it, to draw it before the answer arrives.
 * Only the board, the ends, the turn and the player's tiles are predicted; the version is
 * set between the current one and the next so the server's row always replaces it.
 */
function predictMove(
  hand: HandView,
  myTiles: Tile[],
  seat: Seat,
  players: number,
  move: Move,
): { hand: HandView; myTiles: Tile[] } | null {
  if (hand.status !== 'playing' || hand.turnSeat !== seat) return null
  const hands: Tile[][] = Array.from({ length: players }, () => [])
  hands[seat] = myTiles
  const state: HandState = {
    hands,
    board: hand.board,
    ends: hand.ends,
    turn: seat,
    starter: hand.starterSeat as Seat,
    requiredOpening: hand.requiredOpening,
    passesInRow: 0,
    status: 'playing',
    result: null,
  }
  const outcome = applyMove(state, seat, move, { maxPip: 6, targetPoints: 1000, scoring: 'all_hands' })
  if (!outcome.ok) return null
  const next = outcome.state
  const tileCounts = hand.tileCounts.slice()
  if (move.type === 'play') tileCounts[seat] = Math.max(0, (tileCounts[seat] ?? 1) - 1)
  return {
    hand: {
      ...hand,
      board: next.board,
      ends: next.ends,
      turnSeat: (seat + 1) % (players as PlayerCount),
      turnDeadline: null,
      tileCounts,
      requiredOpening: null,
      openingTile: hand.openingTile ?? next.board[0]?.tile ?? null,
      version: hand.version + 0.5,
    },
    myTiles: next.hands[seat].slice(),
  }
}
