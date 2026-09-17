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
      "Hi! I'm this computer's memory manager. I decide what stays in fast memory. Today, you're taking over.",
      'The program asks for data in numbered chunks called **pages**. We fetch them from disk.',
      "This tape shows the program's page requests. You can see the past; the requests still to come are hidden.",
      'You get the same clues I do: page numbers as they arrive. You won\'t see what\'s inside each page.',
      'These three slots are fast memory. A page here is ready to use, but only three pages fit.',
      'If a requested page is missing, we fetch it from disk. The counter adds one **trip**.',
      'Disk is much slower than memory. Your goal: get through the tape with as few trips as possible.',
    ],
  },
  {
    id: 'the-score',
    screen: 1,
    when: (g) => g.cursor >= 1,
    focus: ['counter'],
    lines: ["Your first page is in memory. That's one trip on the counter."],
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
      'Three pages, three trips. Memory started empty, so each page had to be fetched.',
      'Those trips count, but no choice could have avoided them. Now memory is full, and your choices begin.',
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
      `The fewest trips possible on this tape with three slots is ${L1.scores.opt}.`,
      `We'll come back to that ${L1.scores.opt} and work out why it can't be beaten.`,
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
      'Each trip happened because a requested page was missing from memory. That is a **page fault**.',
      'Choosing which page to remove when memory is full is **page replacement**.',
      "A memory manager needs a rule for that choice. Think back to your decisions: were you already following one?",
    ],
  },
]

export function beatMachine(beat: Beat, g: Game): MachineState | null {
  if (!beat.machine) return null
  return typeof beat.machine === 'function' ? beat.machine(g) : beat.machine
}

/** React to the first visible cost of an earlier eviction, not its replacement. */
export function regretFace(g: Game, line: number): MachineState {
  const first = g.awaiting?.regret && !g.events.some((e) => e.kind === 'evict' && e.regret)
  return first && line === 0 ? 'apologetic' : 'neutral'
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
      "There's no rule to follow yet. Look at the requests so far and make your best guess.",
      "Which page seems least likely to come back soon? Tap it to make room.",
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

    return [
      `Ah, page ${page} is back already.`,
      `You dropped it ${gap(r.stepsAgo)} ago, so now we have to fetch it again.`,
    ]
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
