import { describe, expect, it } from 'vitest'
import {
  addHandToScore,
  applyMove,
  autoMove,
  deal,
  findOpening,
  legalMoves,
  startHand,
  tileSet,
  viewFor,
  type HandState,
  type RuleConfig,
  type Tile,
} from './index.ts'

const config: RuleConfig = { maxPip: 9, targetPoints: 100, scoring: 'all_hands' }

/** Deterministic PRNG (mulberry32) so deals are reproducible. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fixedHand(hands: Tile[][], overrides: Partial<HandState> = {}): HandState {
  return { ...startHand(hands, 0, null), ...overrides }
}

describe('tiles and deal', () => {
  it('builds full sets', () => {
    expect(tileSet(6)).toHaveLength(28)
    expect(tileSet(9)).toHaveLength(55)
  })

  it('deals 10 tiles per player with double-nine and 15 left undealt, without repeats', () => {
    const { hands, undealt } = deal(9, seeded(1))
    expect(hands.map((h) => h.length)).toEqual([10, 10, 10, 10])
    expect(undealt).toHaveLength(15)
    const keys = new Set([...hands.flat(), ...undealt].map((t) => t.join('-')))
    expect(keys.size).toBe(55)
  })

  it('deals 7 per player with double-six and nothing left', () => {
    const { hands, undealt } = deal(6, seeded(2))
    expect(hands.map((h) => h.length)).toEqual([7, 7, 7, 7])
    expect(undealt).toHaveLength(0)
  })
})

describe('opening', () => {
  it('first hand: highest double opens and must play it', () => {
    const hands: Tile[][] = [[[1, 1]], [[9, 9]], [[3, 3]], [[2, 5]]]
    expect(findOpening(hands, true, 0)).toEqual({ starter: 1, requiredOpening: [9, 9] })
  })

  it('later hands: the rotated starter opens freely', () => {
    const hands: Tile[][] = [[[1, 1]], [[9, 9]], [[3, 3]], [[2, 5]]]
    expect(findOpening(hands, false, 2)).toEqual({ starter: 2, requiredOpening: null })
  })

  it('rejects a different opening tile when one is required', () => {
    const state = startHand([[[9, 9], [0, 1]], [[2, 2]], [[3, 3]], [[4, 4]]], 0, [9, 9])
    expect(applyMove(state, 0, { type: 'play', tile: [0, 1], side: 'left' }, config)).toEqual({
      ok: false,
      error: 'must_play_opening',
    })
    expect(legalMoves(state, 0)).toEqual([{ type: 'play', tile: [9, 9], side: 'left' }])
  })
})

describe('moves', () => {
  const hands: Tile[][] = [
    [[5, 6], [0, 0]],
    [[6, 6], [1, 2]],
    [[3, 4], [2, 2]],
    [[5, 5], [1, 1]],
  ]

  it('only the seat in turn can move', () => {
    const state = fixedHand(hands)
    expect(applyMove(state, 1, { type: 'pass' }, config)).toEqual({ ok: false, error: 'not_your_turn' })
  })

  it('places tiles and updates both ends', () => {
    let r = applyMove(fixedHand(hands), 0, { type: 'play', tile: [5, 6], side: 'left' }, config)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.ends).toEqual({ left: 5, right: 6 })
    expect(r.state.turn).toBe(1)

    r = applyMove(r.state, 1, { type: 'play', tile: [6, 6], side: 'right' }, config)
    expect(r.ok && r.state.ends).toEqual({ left: 5, right: 6 })
    if (!r.ok) return
    expect(r.state.board.map((p) => p.oriented)).toEqual([
      [5, 6],
      [6, 6],
    ])
  })

  it('rejects a tile that does not fit or is not in hand', () => {
    const r = applyMove(fixedHand(hands), 0, { type: 'play', tile: [5, 6], side: 'left' }, config)
    if (!r.ok) throw new Error('setup')
    expect(applyMove(r.state, 1, { type: 'play', tile: [1, 2], side: 'left' }, config)).toEqual({
      ok: false,
      error: 'tile_does_not_fit',
    })
    expect(applyMove(r.state, 1, { type: 'play', tile: [5, 5], side: 'left' }, config)).toEqual({
      ok: false,
      error: 'tile_not_in_hand',
    })
  })

  it('cannot pass while holding a legal play', () => {
    const r = applyMove(fixedHand(hands), 0, { type: 'play', tile: [5, 6], side: 'left' }, config)
    if (!r.ok) throw new Error('setup')
    expect(applyMove(r.state, 1, { type: 'pass' }, config)).toEqual({
      ok: false,
      error: 'cannot_pass_with_legal_move',
    })
  })

  it('auto move plays the highest playable tile, or passes', () => {
    const state = fixedHand([[[1, 5], [5, 6], [2, 3]], [], [], []], { ends: { left: 5, right: 0 } })
    expect(autoMove(state, 0)).toEqual({ type: 'play', tile: [5, 6], side: 'left' })
    const stuck = fixedHand([[[2, 3]], [], [], []], { ends: { left: 5, right: 0 } })
    expect(autoMove(stuck, 0)).toEqual({ type: 'pass' })
  })

  it('never shows other seats tiles in a player view', () => {
    const view = viewFor(fixedHand(hands), 2)
    expect(view.myTiles).toEqual(hands[2])
    expect(view.tileCounts).toEqual([2, 2, 2, 2])
    expect(JSON.stringify(view)).not.toContain('"hands"')
  })
})

describe('end of hand and scoring', () => {
  it('domino: playing the last tile wins for the team and counts all hands', () => {
    const state = fixedHand(
      [
        [[4, 4]],
        [[0, 1], [6, 6]],
        [[2, 3]],
        [[1, 1]],
      ],
      { ends: { left: 4, right: 1 }, board: [] },
    )
    const r = applyMove(state, 0, { type: 'play', tile: [4, 4], side: 'left' }, config)
    expect(r.ok && r.state.result).toEqual({ kind: 'domino', winnerTeam: 0, winnerSeat: 0, points: 1 + 12 + 5 + 2 })
  })

  it('domino with opponents-only scoring skips the partner hand', () => {
    const state = fixedHand([[[4, 4]], [[0, 1]], [[6, 6]], [[1, 1]]], { ends: { left: 4, right: 1 } })
    const r = applyMove(state, 0, { type: 'play', tile: [4, 4], side: 'left' }, { ...config, scoring: 'opponents' })
    expect(r.ok && r.state.result?.points).toBe(1 + 2)
  })

  it('blocked after four passes: lowest count wins for its team', () => {
    let state = fixedHand(
      [
        [[0, 1]],
        [[6, 6]],
        [[2, 2]],
        [[5, 6]],
      ],
      { ends: { left: 3, right: 3 } },
    )
    for (const seat of [0, 1, 2, 3] as const) {
      const r = applyMove(state, seat, { type: 'pass' }, config)
      if (!r.ok) throw new Error(r.error)
      state = r.state
    }
    expect(state.status).toBe('finished')
    expect(state.result).toEqual({ kind: 'blocked', winnerTeam: 0, winnerSeat: 0, points: 1 + 12 + 4 + 11 })
  })

  it('blocked tie across teams voids the hand', () => {
    let state = fixedHand([[[0, 2]], [[1, 1]], [[6, 6]], [[5, 6]]], { ends: { left: 3, right: 3 } })
    for (const seat of [0, 1, 2, 3] as const) {
      const r = applyMove(state, seat, { type: 'pass' }, config)
      if (!r.ok) throw new Error(r.error)
      state = r.state
    }
    expect(state.result).toEqual({ kind: 'void', winnerTeam: null, winnerSeat: null, points: 0 })
  })

  it('game ends when a team reaches the target', () => {
    const won = addHandToScore([90, 40], { kind: 'domino', winnerTeam: 0, winnerSeat: 2, points: 15 }, config)
    expect(won).toEqual({ scores: [105, 40], finished: true, winnerTeam: 0 })
    const notYet = addHandToScore([10, 40], { kind: 'void', winnerTeam: null, winnerSeat: null, points: 0 }, config)
    expect(notYet).toEqual({ scores: [10, 40], finished: false, winnerTeam: null })
  })
})

describe('full random games', () => {
  it('plays 200 hands with auto moves and always finishes with consistent tile counts', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { hands } = deal(9, seeded(seed))
      const { starter, requiredOpening } = findOpening(hands, true, 0)
      let state = startHand(hands, starter, requiredOpening)
      let guard = 0
      while (state.status === 'playing') {
        const r = applyMove(state, state.turn, autoMove(state, state.turn), config)
        if (!r.ok) throw new Error(`seed ${seed}: ${r.error}`)
        state = r.state
        if (++guard > 200) throw new Error(`seed ${seed}: did not finish`)
      }
      const remaining = state.hands.flat().length
      expect(remaining + state.board.length).toBe(40)
      expect(state.result).not.toBeNull()
    }
  })
})

describe('one-vs-one', () => {
  it('deals 2 hands and leaves the rest face down', () => {
    const d9 = deal(9, seeded(3), 2)
    expect(d9.hands.map((h) => h.length)).toEqual([10, 10])
    expect(d9.undealt).toHaveLength(35)
    const d6 = deal(6, seeded(4), 2)
    expect(d6.hands.map((h) => h.length)).toEqual([7, 7])
    expect(d6.undealt).toHaveLength(14)
  })

  it('first hand opens with the highest double among the two players', () => {
    expect(findOpening([[[2, 2]], [[7, 7]]], true, 0)).toEqual({ starter: 1, requiredOpening: [7, 7] })
  })

  it('turn alternates between seats 0 and 1', () => {
    const state = fixedHand([[[1, 2], [5, 5]], [[2, 3], [6, 6]]])
    const r = applyMove(state, 0, { type: 'play', tile: [1, 2], side: 'left' }, config)
    expect(r.ok && r.state.turn).toBe(1)
    if (!r.ok) throw new Error(r.error)
    const r2 = applyMove(r.state, 1, { type: 'play', tile: [2, 3], side: 'right' }, config)
    expect(r2.ok && r2.state.turn).toBe(0)
  })

  it('blocked after two passes: lowest count wins; equal counts void the hand', () => {
    const play = (hands: Tile[][]) => {
      let state = fixedHand(hands, { ends: { left: 3, right: 3 } })
      for (const seat of [0, 1] as const) {
        const r = applyMove(state, seat, { type: 'pass' }, config)
        if (!r.ok) throw new Error(r.error)
        state = r.state
      }
      return state
    }
    const won = play([[[6, 6]], [[0, 1]]])
    expect(won.status).toBe('finished')
    expect(won.result).toEqual({ kind: 'blocked', winnerTeam: 1, winnerSeat: 1, points: 12 + 1 })
    expect(play([[[0, 2]], [[1, 1]]]).result).toEqual({ kind: 'void', winnerTeam: null, winnerSeat: null, points: 0 })
  })

  it('domino counts the opponent hand (both scoring modes agree)', () => {
    const state = fixedHand([[[4, 4]], [[5, 6], [0, 1]]], { ends: { left: 4, right: 9 } })
    for (const scoring of ['all_hands', 'opponents'] as const) {
      const r = applyMove(state, 0, { type: 'play', tile: [4, 4], side: 'left' }, { ...config, scoring })
      expect(r.ok && r.state.result).toEqual({ kind: 'domino', winnerTeam: 0, winnerSeat: 0, points: 11 + 1 })
    }
  })

  it('rejects a starter that is not at the table and unsupported table sizes', () => {
    expect(() => startHand([[[1, 1]], [[2, 2]]], 2, null)).toThrow()
    expect(() => startHand([[[1, 1]], [[2, 2]], [[3, 3]]], 0, null)).toThrow()
  })

  it('plays 200 random hands to the end with consistent tile counts', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const maxPip = seed % 2 === 0 ? 6 : 9
      const { hands } = deal(maxPip, seeded(seed), 2)
      const { starter, requiredOpening } = findOpening(hands, true, 0)
      let state = startHand(hands, starter, requiredOpening)
      let guard = 0
      while (state.status === 'playing') {
        expect(state.turn).toBeLessThan(2)
        const r = applyMove(state, state.turn, autoMove(state, state.turn), { ...config, maxPip })
        if (!r.ok) throw new Error(`seed ${seed}: ${r.error}`)
        state = r.state
        if (++guard > 100) throw new Error(`seed ${seed}: did not finish`)
      }
      expect(state.hands.flat().length + state.board.length).toBe(maxPip === 6 ? 14 : 20)
    }
  })
})
