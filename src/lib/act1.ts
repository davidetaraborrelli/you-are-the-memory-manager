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
 * Friendly, plain, and completely explicit about what it wants from you. It
 * introduces itself, states the goal before you play rather than after, and
 * explains what just happened in ordinary words.
 *
 * The one thing it still never does is hand over the discovery: it will not
 * tell you which page to drop, and it will not name a pattern before you have
 * met it. Being warm and being a spoiler are different things — this is warm.
 *
 * All copy here is final draft and matches STORYBOARD.md.
 */

/** A region of the board a line can point at while it is being read. */
export type Focus = 'tape' | 'memory' | 'counter'

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

export const BEATS: Beat[] = [
  {
    // Everything the learner needs before touching anything: who is talking,
    // what the pieces are, what a trip costs, and what winning looks like.
    // The old draft opened cold and only revealed the goal on screen 4, so the
    // learner played fourteen requests without knowing what they were for.
    id: 'welcome',
    screen: 1,
    when: () => true,
    doneLabel: "Let's go",
    focus: [null, null, 'tape', 'tape', 'memory', 'memory', 'counter'],
    lines: [
      "Hi there! I'm the memory manager inside this computer. Deciding what to keep in **fast memory** is my whole job, and today it's yours.",
      "So, a program is running right now. Everything it needs is stored on a disk, chopped up into numbered chunks called **pages**.",
      "See that strip along the top? Those are the program's requests, arriving one at a time. You get to see what has already happened, but never what's coming next.",
      "And before you ask, no, I can't see what's coming either! I never get to read the program. I just get this stream of numbers, same as you.",
      "These three slots? That's the fast memory. Any page sitting in one can be read instantly. Only three fit, though. That's all the room the hardware gives us.",
      "If the program asks for a page that isn't in a slot, we have to go and fetch it off the disk. That takes about 100,000 times longer! Let's call it a **trip**.",
      "So here's the whole job: try to have whatever the program wants next already sitting in a slot. Every time you pull that off, it's a trip nobody has to pay for.",
    ],
  },
  {
    id: 'the-score',
    screen: 1,
    when: (g) => g.cursor >= 1,
    lines: [
      "And that's one trip! The number in the corner is your score. It counts trips, so the lower you keep it, the better you're doing.",
    ],
  },
  {
    id: 'three-trips',
    screen: 1,
    when: (g) => g.cursor >= 3,
    focus: ['counter', null],
    lines: [
      "Three trips already! Don't worry though, those three had to happen. The program is just starting up, so those pages have to come in, and there is nothing either of us can do about it.",
      "So go ahead and consider them free! Everything from here is where it gets interesting.",
    ],
  },
  {
    id: 'free-hit',
    screen: 2,
    when: (g) => g.cursor >= 4,
    lines: [
      "Page 1 again, and look, it's already sitting in a slot! No trip, no cost, nothing for you to do. That right there is exactly what we're playing for.",
    ],
  },
  {
    // Path B: they kept page 1 and the tape paid them back twice.
    id: 'kept-it',
    screen: 3,
    when: (g) => g.cursor >= 7 && !droppedOneFirst(g),
    machine: 'approval',
    // The explanation half of prompt → attempt → explain. It says what the
    // learner just *did* (read the past, placed a bet) and deliberately stops
    // short of *which* reading works — that is the rule they articulate for
    // themselves on screen 5 and get tested on at screen 7.
    lines: [
      'Page 1 came back twice in a row, and you still had it both times! Two free requests. Nice call.',
      "And look at how you got there. You read what had already happened, then made a guess about what was coming next. That's the whole job, right there.",
    ],
  },
  {
    /**
     * The fun fact, and the promise it comes with.
     *
     * The fewest trips this tape allows used to be a line on the end card,
     * page text, stated and never mentioned again. It is not a result the
     * learner watched happen, it is a claim about a run that never took place,
     * so it belongs to the voice, where somebody is accountable for it. And
     * saying it out loud is what lets the machine *owe* the learner an
     * explanation: screen 7 opens by collecting on this promise.
     *
     * It is a separate beat rather than four more lines on the naming group
     * because it is about the run that just ended, while the naming group is
     * about what the run was called. Different subjects, and the cap is four.
     *
     * The word here is still `trips`. The counter renames itself on the next
     * beat, and the learner meets `page fault` there, not a bubble early.
     *
     * The congratulation is guarded on the number, not offered to everyone.
     * On this tape {@link L1.scores.opt} is what a player who could see the
     * whole tape would take, and recency alone takes one more, so a learner who
     * lands on it blind has done something genuinely uncommon. Saying it to the
     * rest would be the "well done" with nothing attached to it that the voice
     * rules forbid.
     */
    id: 'the-floor',
    screen: 4,
    when: isDone,
    machine: (g) => (g.faults === L1.scores.opt || credit(g).length > 0 ? 'approval' : null),
    lines: [
      'Nice work! Level one done, and you did the whole thing blind.',
      `Fun fact about that tape before we go on: the fewest trips anyone could have made on it was ${L1.scores.opt}.`,
      "I'll come back to that later, because there's something interesting hiding in how I know it.",
    ],
    linesFor: (g) =>
      g.faults === L1.scores.opt
        ? [
            'Nice work! Level one done, and you did the whole thing blind.',
            `Fun fact about that tape: the fewest trips anyone could have made on it was ${L1.scores.opt}, and that is exactly what you made.`,
            'Nobody could have done better than you just did, blind, on a first go. That is a very good instinct.',
            "I'll come back to that later, because there's something interesting hiding in how I know it.",
          ]
        : [
            'Nice work! Level one done, and you did the whole thing blind.',
            `Fun fact about that tape before we go on: the fewest trips anyone could have made on it was ${L1.scores.opt}.`,
            "I'll come back to that later, because there's something interesting hiding in how I know it.",
          ],
  },
  {
    id: 'the-name',
    screen: 4,
    when: isDone,
    namesTheCounter: true,
    // The last line is a hook, not a summary: it names the gap between what the
    // learner just did (guessed) and what a computer does (follows a rule), and
    // points at the next act. A lesson that ends on a closed door teaches that
    // the knowledge lives in the text; one that ends on an open question does
    // not — and this level is a door, not the end.
    lines: [
      "Every trip you made has a proper name, by the way. It's called a **page fault**: the program asked for a page that wasn't in memory, and everything had to stop until it arrived.",
      "That choice you kept making, which page to throw out when memory is full? It's called **page replacement**, and every computer on Earth is doing it right now, thousands of times a second.",
      "The difference is that a real one doesn't guess. It follows one precise rule, every single time. Figuring out what that rule should be is exactly what we're doing next!",
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
      ? [`Page ${page} is being asked for, and it isn't here yet. Tap the empty slot to fetch it in.`]
      : [`Page ${page} now, also not here. Tap the next empty slot.`]
  }
  const firstEviction = !g.events.some((e) => e.kind === 'evict')
  if (firstEviction) {
    // Prompt, then stop. It says evidence exists and where it is; it does not
    // say what the evidence shows. Characterising it ("one of them was used
    // much more recently") would hand over the intuition the learner is here
    // to have — and an intuition you were given is one you don't keep.
    return [
      `Okay, here's your first real decision! Page ${page} is being asked for, memory is full, so one of these three has to go.`,
      "This isn't a coin flip, by the way. Look back along the tape, every request so far is still up there. So, which of these three do you think you're least likely to need next?",
    ]
  }

  // The page they dropped is being asked for again — the most instructive
  // moment in the level, and the whole of it is said here, once, while the
  // learner is looking at it and about to choose again.
  //
  // It used to be said twice: an acknowledgement now and the identical lesson
  // as a beat after the next choice. Repeating yourself after someone has
  // acted reads as a lecture arriving where the game should have moved on.
  const r = g.awaiting.regret
  if (r) {
    const gap = r.stepsAgo === 1 ? 'one step' : `${r.stepsAgo} steps`
    const firstBurn = !g.events.some((e) => e.kind === 'evict' && e.regret !== null)
    if (!firstBurn) {
      // Every regret after the first gets the fact and nothing else. The
      // lesson does not improve by being delivered again.
      return [`Page ${page} is back! You dropped it ${gap} ago. Have another go.`]
    }

    const lines = [
      `Ah, page ${page} is back! And you let it go ${gap} ago, so now we have to fetch it all over again.`,
      "That's what a wrong guess costs around here. It never stings straight away. It comes back later and charges you a trip.",
    ]
    // If the page had just been used, the evidence was on the tape and saying
    // so now costs nothing — the choice it criticises was already committed.
    //
    // Two things this line has to be careful about. It names the page instead
    // of saying "it", because the previous line's "it" is the wrong guess, not
    // the page, and a pronoun that changes referent between two bubbles is a
    // pronoun the learner has to solve. And it measures along the tape rather
    // than in time: the first line already spent "N steps ago" on the distance
    // from now back to the eviction, so a second time-gap, counted from a
    // different origin, reads as a correction of the first. "Back along the
    // tape" is a place, and it is the phrase the previous screen already used
    // for exactly this move.
    const droppedAt = g.awaiting.step - r.stepsAgo
    const lastUse = g.ref.lastIndexOf(page, droppedAt - 2)
    const before = droppedAt - 1 - lastUse
    lines.push(
      lastUse >= 0 && before <= 2
        ? `Worth noticing! When you dropped page ${page}, its last request was only ${before === 1 ? 'one step' : `${before} steps`} back along the tape, still up there to see. Have another go.`
        : "No harm done, that's how this goes! Have another look and pick the one you're least likely to need.",
    )
    return lines
  }
  return [`Page ${page} isn't here. Drop whichever one you're least likely to need again.`]
}

/**
 * Screen 4's end card: what the learner did, as page text.
 *
 * It used to carry a *Best possible on this tape* line too. That is not
 * something they watched happen, and a row in a table cannot be doubted, which
 * is exactly what the lesson wants the learner to do with it. The number moved
 * into the voice, one beat earlier. What is left here is the run itself.
 */
export function endCard(g: Game) {
  return { faults: g.faults, requests: g.ref.length, credit: credit(g) }
}
