import type { Game } from './game.ts'
import { credit, isDone } from './game.ts'
import { L1 } from './levels.ts'
import type { MachineState } from './types.ts'

/**
 * Screens 1–4: the whole of level 1, played blind.
 *
 * Not four mounts — one continuous run with beats that pause it. The tape, the
 * frames and the counter never unmount between them.
 *
 * ── The voice ──────────────────────────────────────────────────────────────
 * Warm, clear and concrete. It explains the board and the consequences, states
 * the goal before you play rather than after, and says what just happened in
 * ordinary words.
 *
 * What it never does is hand over the decision. It will not tell you which page
 * to drop, and it will not name a pattern before you have met it. Being warm
 * and being a spoiler are different things.
 *
 * All copy here is the final draft in STORYBOARD.md, screens 1 to 4. The
 * 31 Aug 2026 revision shortened nearly every line: the previous draft narrated
 * the learner's own reasoning back at them after they had acted, which reads as
 * a lecture arriving where the game should have moved on.
 */

/**
 * A region of the board a line can point at while it is being read.
 *
 * `mask` is the tape too, with the hidden future pulsing under the line that
 * says nobody gets to see it. It is a separate value rather than a second flag
 * so that what a line points at stays one word, declared next to the line.
 */
export type Focus = 'tape' | 'mask' | 'memory' | 'counter'

export interface Beat {
  id: string
  screen: number
  /**
   * Optional, one entry per line: what that line is talking about. Exposition
   * attached to something lighting up is a guided tour; the same exposition
   * with a static board is a slideshow you tap through.
   */
  focus?: (Focus | null)[]
  /**
   * Delivered one bubble at a time, in order. Where a beat says something
   * different depending on how the run went, this holds the common case and
   * `linesFor` holds the branch; `beatLines` picks. Both are checked.
   */
  lines: string[]
  /** Overrides `lines` when what to say depends on the run. */
  linesFor?: (g: Game) => string[]
  /** A face, or a function of the run when it depends on what happened. */
  machine?: MachineState | ((g: Game) => MachineState | null)
  /**
   * Fires this beat once the condition first holds. `closedAt` maps a beat id
   * to the tape position when the learner dismissed it, which is how a beat
   * can require play — not just taps — to have happened since another one.
   */
  when: (g: Game, seen: string[], closedAt: Record<string, number>) => boolean
  /** Screen 4 only: the counter learns the word "page fault". */
  namesTheCounter?: boolean
  /** Label on the button that closes the beat. */
  doneLabel?: string
}

/** Did the learner throw page 1 out at the first decision? Path A if so. */
function droppedOneFirst(g: Game): boolean {
  const first = g.events.find((e) => e.kind === 'evict')
  return first?.kind === 'evict' && first.victim === 1
}

/** "one request" / "N requests" — the unit this lesson measures gaps in. */
function gap(n: number): string {
  return n === 1 ? 'one request' : `${n} requests`
}

export const BEATS: Beat[] = [
  {
    // Everything the learner needs before touching anything: who is talking,
    // what the pieces are, what a trip costs, and what winning looks like.
    //
    // Learning job: understand the board, the goal, and that the opening misses
    // are normal.
    id: 'welcome',
    screen: 1,
    when: () => true,
    doneLabel: "Let's go",
    focus: [null, null, 'mask', 'tape', 'memory', 'counter', 'counter'],
    lines: [
      "Hi! I'm the memory manager inside this computer. My job is deciding what stays in fast memory. For this run, you're doing it.",
      'A program is running. The data it needs is stored on disk in numbered chunks called **pages**.',
      "This strip is the program's request stream. You can see every request that already happened, but not the ones still to come.",
      'I never read the program itself. I only receive these page numbers as they arrive, so I do not know what any page means.',
      'These three slots are fast memory. A page already sitting here is ready immediately, but only three pages fit.',
      'If the program asks for a page that is not here, we fetch it from disk. That costs a **trip**.',
      'Fetching pages from the disk is A LOT slower than accessing them from memory. So, your job is to keep trips as low as possible!',
    ],
  },
  {
    id: 'the-score',
    screen: 1,
    when: (g) => g.cursor >= 1,
    focus: ['counter'],
    lines: ["That's one trip. The counter tracks them, so lower is better."],
  },
  {
    // The takeaway this screen has to leave: a miss is a normal consequence of
    // limited memory, not a mistake. A learner who reads the opening faults as
    // their own failure spends the rest of the lesson defending a score.
    id: 'three-trips',
    screen: 1,
    when: (g) => g.cursor >= 3,
    focus: ['counter', null],
    lines: [
      'Three trips already, but those were unavoidable. The program had never asked for those pages before, so they had to come in.',
      'Count those as free. The interesting part starts when memory is full.',
    ],
  },
  {
    id: 'free-hit',
    screen: 2,
    when: (g) => g.cursor >= 4,
    focus: ['memory'],
    lines: ["Page 1 again. It's already here, so that request costs nothing."],
  },
  {
    // Path B: they kept page 1 and the tape paid them back twice.
    //
    // One line, and then the run continues. The previous draft followed it with
    // a second line explaining what the learner had just done ("you read the
    // past, then made a guess about what was coming"), which is screen 5's
    // discovery said out loud two screens early.
    id: 'kept-it',
    screen: 3,
    when: (g) => g.cursor >= 7 && !droppedOneFirst(g),
    machine: 'approval',
    focus: ['memory'],
    lines: ['Page 1 again, and again. You kept it, so both requests were free.'],
  },
  {
    /**
     * The floor, and the promise it comes with.
     *
     * The fewest trips this tape allows used to be a line on the end card: page
     * text, stated and never mentioned again. It is not a result the learner
     * watched happen, it is a claim about a run that never took place, so it
     * belongs to the voice, where somebody is accountable for it. Saying it out
     * loud is also what lets the machine *owe* the learner an explanation, and
     * screen 7 closes by collecting on this promise.
     *
     * The word here is still `trips`. The counter renames itself on the next
     * beat, and the learner meets `page fault` there, not in a bubble early.
     */
    id: 'the-floor',
    screen: 4,
    when: isDone,
    machine: (g) => (g.faults === L1.scores.opt || credit(g).length > 0 ? 'approval' : null),
    focus: [null, 'counter', null],
    lines: [
      'Level one done. You made every replacement without seeing the future.',
      `Fun fact: the fewest trips this tape allows with three slots is ${L1.scores.opt}!`,
      `I haven't shown you where that ${L1.scores.opt} comes from yet. Keep it in the back of your mind, for now.`,
    ],
  },
  {
    id: 'the-name',
    screen: 4,
    when: isDone,
    namesTheCounter: true,
    focus: ['counter', 'memory', null],
    // The last line is a hook, not a summary: it names the gap between what the
    // learner just did (improvised) and what a computer does (follows a rule),
    // and hands over to screen 5, which asks which rule they were already on.
    lines: [
      'By the way, those trips have a proper name: **page faults**. A requested page was missing from memory, so it had to be fetched.',
      'And the choice you kept making, which resident page to remove, is called **page replacement**.',
      "As you might have guessed, a real memory manager can't just improvise every time. It needs a rule to keep those trips to a minimum. And you may have already been following one!",
    ],
  },
]

export function beatMachine(beat: Beat, g: Game): MachineState | null {
  if (!beat.machine) return null
  return typeof beat.machine === 'function' ? beat.machine(g) : beat.machine
}

export function beatLines(beat: Beat, g: Game): string[] {
  return beat.linesFor ? beat.linesFor(g) : beat.lines
}

/**
 * Lines that sit beside a decision without gating it. These are the ones that
 * say what to do right now, so they are never withheld and never clever.
 */
export function ambientFor(g: Game): string[] | null {
  if (!g.awaiting) return null
  const { page, mode, step } = g.awaiting
  if (mode === 'fill') {
    // There is nothing to decide here — every empty slot is the same slot —
    // so the copy says "the" and the board offers exactly one target.
    return step === 1
      ? [`Page ${page} is being asked for and it is not here yet. Tap the empty slot to fetch it in.`]
      : [`Page ${page} now, also not here. Tap the next empty slot.`]
  }

  const firstEviction = !g.events.some((e) => e.kind === 'evict')
  if (firstEviction) {
    // Prompt, then stop. It admits no rule has been taught yet, points at the
    // evidence, and asks for an instinct. What it does not do is characterise
    // the evidence ("one of them was used much more recently"), which would
    // hand over the intuition the learner is here to have.
    return [
      `Now memory is full and page ${page} needs a slot. One of these three pages has to go.`,
      "I know, I haven't taught you how to choose yet. Just look at the pages requested so far and see what your instinct tells you.",
      "Which page do you think you're least likely to need next? Tap it.",
    ]
  }

  // The page they dropped is being asked for again: the most instructive moment
  // in the level, and the whole of it is said here, once, while the learner is
  // looking at it and about to choose again.
  const r = g.awaiting.regret
  if (r) {
    const firstBurn = !g.events.some((e) => e.kind === 'evict' && e.regret !== null)
    if (!firstBurn) {
      // Every regret after the first is one line. The lesson does not improve
      // by being delivered a second time.
      return [`Page ${page} is back. You dropped it ${gap(r.stepsAgo)} ago.`]
    }

    const lines = [
      `Ah, page ${page} is back already.`,
      `You dropped it ${gap(r.stepsAgo)} ago, so now we have to fetch it again.`,
    ]
    // If the page had just been requested, the evidence was on the tape and
    // saying so now costs nothing: the choice it comments on is already
    // committed. It stops at "maybe that was a clue" because naming the clue is
    // the rule, and the rule is screen 5's job, not this screen's.
    const droppedAt = g.awaiting.step - r.stepsAgo
    const lastUse = g.ref.lastIndexOf(page, droppedAt - 2)
    if (lastUse >= 0 && droppedAt - 1 - lastUse <= 2) {
      lines.push(`Page ${page} had just appeared. Maybe that was a clue!`)
    }
    return lines
  }

  return [`Page ${page} needs a slot. Which page do you drop?`]
}

/**
 * Screen 4's end card: what the learner did, as page text.
 *
 * It used to carry a *best possible on this tape* line too. That is not
 * something they watched happen, and a row in a table cannot be doubted, which
 * is exactly what the lesson wants the learner to do with it. The number moved
 * into the voice, one beat later. What is left here is the run itself.
 */
export function endCard(g: Game) {
  return { faults: g.faults, requests: g.ref.length, credit: credit(g) }
}
