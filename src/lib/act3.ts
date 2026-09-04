import { L1, L2 } from './levels.ts'
import type { Decision } from './types.ts'
import type { Focus } from './act1.ts'

/**
 * Screen 8: the whole of level 1 again, played with the tape face up.
 *
 * The third continuous run, and the storyboard's act 4. The learner replays a
 * tape they already played blind, this time able to read the future, and
 * reaches 5 faults by their own hand. Only then does the screen prove that 5
 * was the floor, name what they were doing, and take the name away again as a
 * live policy.
 *
 * ── Why the screen is shaped like this ─────────────────────────────────────
 * The floor was promised on screen 4 and quoted again on screen 7 as a debt. A
 * tutor could simply pay it: *OPT looks at the future, here is the number*.
 * That is a fact to believe, and the learner has no way to disagree with it.
 *
 * So nothing here is asserted before it is played. The learner makes both
 * decisions, watches the counter stop at 5, and *then* is asked how anyone
 * could know 5 is the minimum. The proof that follows is two facts they can
 * read off the tape themselves, and the name arrives after all of it.
 *
 * ── Refusing a tap ─────────────────────────────────────────────────────────
 * A wrong tap does not execute, exactly as on screen 6. What is different is
 * that here the refusal can quote a fact: the tape is open, so every option has
 * a step number printed on it, or nothing at all where a page never returns.
 * Refusing with evidence the learner can check is not a hint, and it is the
 * only reason this screen may enforce a right answer at all.
 *
 * Every number below comes from levels.json, which comes from sim.py.
 */

const FLOOR = L1.floor
const DECISIONS = L1.decisions

/** Pages as the voice lists them: "1, 2, 3 and 4". */
function series(pages: number[], last = 'and'): string {
  if (pages.length <= 1) return String(pages[0] ?? '')
  return `${pages.slice(0, -1).join(', ')} ${last} ${pages[pages.length - 1]}`
}

// ── Beat 1 · Why the tape is open ────────────────────────────────────────────

export const OPEN: { lines: string[]; focus: (Focus | null)[] } = {
  lines: [
    "Here's level one again, but now the run is over. Every request it ever made can stay visible on the tape.",
    `Same ${L1.frames} slots. Same ${L1.length} requests. Same job. This time, nothing on the tape is hidden.`,
  ],
  focus: ['tape', 'tape'],
}

// ── Beats 2 and 3 · The two decisions ────────────────────────────────────────

/** The fork the tape is frozen at, or null between them. */
export function decisionAt(step: number): Decision | null {
  return DECISIONS.find((d) => d.step === step) ?? null
}

/** Only the page whose next use is farthest away executes. */
export function isVictim(d: Decision, page: number): boolean {
  return d.victim === page
}

/**
 * The prompt at a fork.
 *
 * The first one points at the new information, because looking right is the
 * whole method and the learner has spent four screens being told they cannot.
 * The second one does not: by then the method is theirs, and repeating it would
 * be the tutor taking back a job the learner is already doing.
 */
export function askAt(d: Decision): string[] {
  const i = DECISIONS.indexOf(d)
  if (i === 0) {
    return [
      'Last time you could only use what had already happened to make your guesses. This time, look to the right too to help you!',
      'Which page do you think is safest to drop?',
    ]
  }
  const free = d.step - DECISIONS[i - 1].step - 1
  return [
    `That bought you ${free} free requests in a row. Now page ${d.request} needs a slot. Same question.`,
  ]
}

/**
 * What the machine says about a tap, right or wrong.
 *
 * A refusal names the consequence of that page in particular and stops. It
 * never says which page is right, never counts how many tries have gone by, and
 * never calls the answer wrong: the learner reads what their own choice would
 * cost and looks again.
 */
export function verdict(d: Decision, page: number): string[] {
  const next = d.nextUse[String(page)] ?? null
  const first = d === DECISIONS[0]

  if (isVictim(d, page)) {
    if (next === null) {
      return [
        `Exactly. Page ${page} never appears again. Dropping it cannot create another fault on this tape.`,
      ]
    }
    // The enumeration is the argument: three pages, three distances, and the
    // one the learner picked is the far end of it.
    const order = [...d.mem].sort(
      (a, b) => (d.nextUse[String(a)] ?? Infinity) - (d.nextUse[String(b)] ?? Infinity),
    )
    const [a, b, c] = order
    return [
      `Yes. Page ${a} returns at ${d.nextUse[String(a)]}, page ${b} at ${d.nextUse[String(b)]}, and page ${c} not until ${d.nextUse[String(c)]}. Dropping ${c} buys the longest gap.`,
    ]
  }

  if (next === d.step + 1) {
    return first
      ? [
          `Page ${page} is the very next request. Drop it now and you'll have to fetch it straight back. Try another one.`,
        ]
      : [`Page ${page} is the very next request. That would cost us immediately. Try again.`]
  }

  // Somebody else is further away. Which somebody depends on the fork: at the
  // second one a page never returns at all, and saying so points harder than
  // "even longer" without giving the page away.
  //
  // Neither branch says the tap scored worse, because at the first fork it does
  // not: dropping page 2 there and page 1 at step 8 also finishes on 5, which is
  // the floor. Belady's rule is optimal, not uniquely optimal. What this screen
  // enforces is the rule, so the refusal asks for the rule, and never for an
  // outcome the tape would contradict. Checked by exhaustive enumeration on L1;
  // the second fork has no such tie.
  const anyNever = d.mem.some((m) => d.nextUse[String(m)] === null)
  return anyNever
    ? [`Page ${page} returns at step ${next}. Not bad, but one page here never returns at all.`]
    : [
        `Page ${page} returns at step ${next}. That drop can still work out, but one page here stays away even longer. Keep looking for it.`,
      ]
}

// ── Beat 4 · Reach and prove the floor ───────────────────────────────────────

/**
 * Beat 4 is an argument about the tape and the count, and the memory tiles
 * take no part in it. Worse, they contradict it: they hold what was resident
 * when the run ended, while the proof talks about what was resident at step
 * 5. So every line here points somewhere, which is what makes the board step
 * back for the whole beat.
 */
export const WHOLE_TAPE: { lines: string[]; focus: (Focus | null)[] } = {
  lines: [
    `That's the whole tape. ${FLOOR.achieved} faults.`,
    `But how do we know ${FLOOR.achieved} is REALLY the floor, and not just a very good run?`,
  ],
  focus: ['tape', 'counter'],
}

/**
 * The proof, in the two facts it is made of.
 *
 * Both are readable on the tape while the line is on screen: the first
 * appearance of every page, then the moment memory fills. The voice says what
 * the marks mean and nothing more, because a learner who is being *shown* the
 * evidence does not also need it described.
 */
export const PROOF: { lines: string[]; focus: (Focus | null)[] } = {
  lines: [
    `Pages ${series(Object.keys(FLOOR.firstUses).map(Number))} each have to enter memory at least once. That's ${FLOOR.unavoidable} faults nobody can avoid.`,
    `When page ${FLOOR.forcedRequest} arrives, one of ${series(FLOOR.resident, 'or')} has to leave, and every one of them is requested again later. So at least ONE MORE fault is unavoidable.`,
    `So for this run, ${FLOOR.achieved} faults isn't just a good score. It's the minimum possible.`,
  ],
  focus: ['tape', 'tape', 'counter'],
}

/**
 * The card under the proof, one stage per line of it.
 *
 * The bound is built in front of the learner rather than announced: the cold
 * misses, then the forced one, then what they actually scored beside the floor
 * those two add up to. `your run` is the counter's own number rather than a
 * repeat of the floor, so the two meeting is something the learner watches
 * happen.
 *
 * The resolution used to carry an `at least` row as well, which is what the
 * two rows above it had just added up to: the same 5 under a third name, one
 * line below the floor it was restating. Three identical numbers read as a
 * repetition rather than as a proof, and the one word doing the arguing got
 * lost among them.
 */
export function proofRows(stage: number, faults: number) {
  const rows = [
    { id: 'cold', label: 'pages that have to enter', value: FLOOR.unavoidable as number | string },
    { id: 'forced', label: `forced when page ${FLOOR.forcedRequest} arrives`, value: '+1' },
  ]
  if (stage < 2) return rows.slice(0, stage + 1)
  return [
    { id: 'yours', label: 'your run', value: faults },
    { id: 'floor', label: 'floor', value: FLOOR.atLeast, emphasis: true },
  ]
}

/** The steps each stage of the proof marks on the tape. */
export function proofMarks(stage: number): number[] {
  if (stage === 0) return Object.values(FLOOR.firstUses)
  if (stage === 1) return FLOOR.forcedStep === null ? [] : [FLOOR.forcedStep]
  return []
}

// ── Beat 5 · Extract the rule, then take it away ─────────────────────────────

export const EXTRACT: { lines: string[]; focus: (Focus | null)[] } = {
  lines: [
    'Look again at the two choices you made. Each time you kept the pages coming back sooner, and dropped the one coming back last, or never.',
    'Any other choice throws out a page that comes back sooner.',
    'What you just did has a name: **OPT**, optimal page replacement. Nothing scores lower, because you just played the floor.',
  ],
  focus: ['tape', 'tape', null],
}

export const WHY_NOT = ["So why don't real memory managers use it on live runs?"]

/**
 * Two cost answers and one information answer.
 *
 * The distractors are both about resources, because that is the shape of every
 * reason the learner has met so far for why a computer cannot do something. The
 * point of the question is that this limit is not that kind of limit at all.
 */
export const WHY_OPTIONS = [
  { id: 'time', label: 'Comparing the pages would take too long' },
  { id: 'memory', label: 'It would use too much memory' },
  { id: 'future', label: 'The future requests are not known yet' },
]

export function whyFeedback(id: string): string[] {
  if (id !== 'future') {
    return [
      'That would be a cost problem. Think about the information that made your two choices possible. When did you finally get it?',
    ]
  }
  return [
    'Exactly. OPT needs the exact future request stream. During a live run, those requests have not happened yet.',
    'A real policy can predict from the past. OPT needs more than a prediction. It needs the exact future.',
  ]
}

// ── Beat 6 · Change OPT's category ───────────────────────────────────────────

/** The gap the beat is about, and the only number in it not on a counter. */
const CLOSE = L2.scores.lru - L2.scores.opt

/**
 * The benchmark, and the announcement that it is about to be used on something.
 *
 * The second line exists because the beat changes tape. Level 2's numbers arrive
 * under level 1's finished board, and anything that appears there unannounced
 * reads as a correction of the floor just proved rather than as a different
 * tape. A floor belongs to a tape, not to a rule, and this is where that has to
 * survive contact.
 */
export const CATEGORY = [
  'So OPT is not another algorithm to run. It is a benchmark: after a tape finishes, it tells us how good any algorithm could have been.',
  "So now we can measure how our last run really did. Let's go back to level two for a moment, and I'll play that tape as OPT.",
]

/**
 * What the demonstration was for.
 *
 * Level 2's floor is not asserted here. The machine replays that tape as OPT
 * while the learner watches the counter, so the 6 this line names is a number
 * they have just seen reached, the same way their own 5 was. Asserting it in a
 * table would be the exact move the whole screen exists to take apart, one beat
 * after taking it apart.
 *
 * It says *recency*, not *your result*. A learner who tested arrival order or
 * frequency on screen 6 scored 9 on level 2, and this comparison is not about
 * their run. Screen 7 hands recency to every learner as the rule that won, and
 * this collects on that.
 */
export const MEASURED = [
  `For this tape, OPT is ${L2.scores.opt}. LRU came within ${CLOSE} fault of perfect future knowledge.`,
  'Not bad! As I said, exact recency is usually a strong practical bet. Now you have the proof.',
]

/**
 * Screen 7's tape, priced against the benchmark the learner has just watched
 * being taken.
 *
 * The caption is not decoration. These are level 2's numbers, and the learner
 * proved a floor of 5 on level 1 two beats earlier; an unlabelled 6 says that
 * proof was wrong. What the beat actually teaches is that a floor belongs to a
 * tape.
 */
export const RULER_CAPTION = `level two, ${L2.frames} slots`

export function rulerRows() {
  return [
    { id: 'lru', label: 'LRU', value: L2.scores.lru },
    { id: 'opt', label: 'OPT', value: L2.scores.opt, emphasis: true },
  ]
}

export const BRIDGE = [
  'That makes exact recency worth having. Notice I used the term EXACT. Turns out, exact information comes at a price.',
  'And price, in computing, almost always means "resources". Let\'s see.',
]
