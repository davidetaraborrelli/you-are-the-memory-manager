/**
 * The core loop, as a pure state machine. No React, no timers, no rendering.
 *
 * The learner *is* the algorithm: nothing here decides who gets evicted. It
 * tracks what is resident, what it cost, and — the part that carries the whole
 * lesson — which eviction is to blame when a page comes back.
 *
 * One rule governs the rhythm: **a miss needs a tap, a hit never does.** Hits
 * flow past on their own, so the learner never clicks in vain, and the tape
 * freezes exactly when there is a decision to make.
 */

/** Why the tape is frozen, and what the learner has to answer. */
export interface Awaiting {
  page: number
  /** 1-based position on the tape. */
  step: number
  /** 'fill' — a free slot exists, any will do. 'evict' — memory is full. */
  mode: 'fill' | 'evict'
  /**
   * Set when the page now being asked for is one the learner threw out. This
   * is the credit-assignment mechanic: without it the counter is noise.
   */
  regret: { page: number; stepsAgo: number } | null
}

export type GameEvent =
  | { kind: 'hit'; step: number; page: number; slot: number }
  | { kind: 'fill'; step: number; page: number; slot: number }
  | {
      kind: 'evict'
      step: number
      page: number
      slot: number
      victim: number
      regret: { page: number; stepsAgo: number } | null
    }

export interface Game {
  ref: number[]
  frameCount: number
  /** How many requests have been fully processed. */
  cursor: number
  frames: (number | null)[]
  faults: number
  /** page -> 1-based step at which the learner evicted it. Cleared on return. */
  evictedAt: Record<number, number>
  events: GameEvent[]
  awaiting: Awaiting | null
}

export function createGame(ref: number[], frameCount: number): Game {
  return {
    ref,
    frameCount,
    cursor: 0,
    frames: Array(frameCount).fill(null),
    faults: 0,
    evictedAt: {},
    events: [],
    awaiting: null,
  }
}

export function isDone(g: Game): boolean {
  return g.cursor >= g.ref.length && g.awaiting === null
}

/** The page being asked for right now, whether or not it needs an answer. */
export function currentPage(g: Game): number | null {
  if (g.awaiting) return g.awaiting.page
  return g.cursor < g.ref.length ? g.ref[g.cursor] : null
}

/**
 * Process the next request. A hit is applied and the cursor moves on; a miss
 * freezes the game with `awaiting` set and waits for resolve().
 */
export function advance(g: Game): Game {
  if (g.awaiting || isDone(g)) return g

  const step = g.cursor + 1
  const page = g.ref[g.cursor]
  const slot = g.frames.indexOf(page)

  if (slot !== -1) {
    return {
      ...g,
      cursor: g.cursor + 1,
      events: [...g.events, { kind: 'hit', step, page, slot }],
    }
  }

  const droppedAt = g.evictedAt[page]
  return {
    ...g,
    awaiting: {
      page,
      step,
      mode: g.frames.includes(null) ? 'fill' : 'evict',
      regret: droppedAt === undefined ? null : { page, stepsAgo: step - droppedAt },
    },
  }
}

/**
 * Answer the frozen request by naming a slot: an empty one to fill, or an
 * occupied one to throw out.
 */
export function resolve(g: Game, slot: number): Game {
  const a = g.awaiting
  if (!a) return g
  const occupant = g.frames[slot]
  if (a.mode === 'fill' && occupant !== null) return g
  if (a.mode === 'evict' && occupant === null) return g

  const frames = [...g.frames]
  frames[slot] = a.page

  const evictedAt = { ...g.evictedAt }
  // The page is back, so its eviction is settled — paid for by this fault.
  delete evictedAt[a.page]
  if (occupant !== null) evictedAt[occupant] = a.step

  const event: GameEvent =
    occupant === null
      ? { kind: 'fill', step: a.step, page: a.page, slot }
      : { kind: 'evict', step: a.step, page: a.page, slot, victim: occupant, regret: a.regret }

  return {
    ...g,
    frames,
    evictedAt,
    cursor: g.cursor + 1,
    faults: g.faults + 1,
    events: [...g.events, event],
    awaiting: null,
  }
}

/**
 * Positive credit: every page the learner threw out that never came back.
 *
 * Regret only ever attributes the mistakes. This is the same mechanic with the
 * sign flipped, and it is the cheapest honest "you're smart" signal in the
 * lesson — it is true, and it is specific to what this learner actually did.
 */
export function credit(g: Game): { page: number; step: number }[] {
  return Object.entries(g.evictedAt)
    .map(([page, step]) => ({ page: Number(page), step }))
    .filter(({ page, step }) => !g.ref.slice(step).includes(page))
    .sort((a, b) => a.step - b.step)
}

/** Pages thrown out and still gone — the "swapped out" strip under the frames. */
export function swappedOut(g: Game): number[] {
  return Object.keys(g.evictedAt).map(Number).sort((a, b) => a - b)
}

export interface TileStats {
  /** Steps since this page was last requested — the recency rule's number. */
  usedAgo: number
  /** Steps since this page entered memory — the arrival-order rule's number. */
  hereFor: number
  /** How many times this page has been requested so far — the counting rule's number. */
  count: number
}

/**
 * The instrument panel for level 2: for each resident page, the three
 * measurements a declarable rule could run on. One number per rule from
 * screen 5 — recency, age in memory, request count — so every strategy is
 * equally effortless to execute. The race between the measurements is fair;
 * which one wins is the tape's verdict, not the interface's.
 *
 * Level 1 shows none of this and asks the learner to hold their measurement
 * in their head. Nothing about the game changes between the levels, only how
 * much the manager can afford to remember — the whole argument of act 3.
 */
export function tileStats(g: Game): (TileStats | null)[] {
  const now = g.awaiting ? g.awaiting.step : g.cursor
  return g.frames.map((page) => {
    if (page === null) return null
    let usedAgo = 0
    let hereFor = 0
    for (let i = g.events.length - 1; i >= 0; i--) {
      const e = g.events[i]
      if (e.page !== page) continue
      if (usedAgo === 0 && e.kind === 'hit') usedAgo = now - e.step
      if (e.kind !== 'hit') {
        // The page's entry into memory. Re-entries count from the refetch,
        // matching how FIFO's queue treats them.
        if (usedAgo === 0) usedAgo = now - e.step
        hereFor = now - e.step
        break
      }
    }
    const count = g.ref.slice(0, now).filter((p) => p === page).length
    return { usedAgo, hereFor, count }
  })
}
