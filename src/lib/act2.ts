import type { Game } from './game.ts'
import { tileStats } from './game.ts'
import { L1, L2 } from './levels.ts'
import type { Beat, Focus } from './act1.ts'
import type { DeclaredRule } from './types.ts'

/**
 * Screens 5–7: name the rule, run it as an experiment, price it.
 *
 * ── What the 31 Aug 2026 revision changed ──────────────────────────────────
 * The old act 3 let the learner play level 2 however they liked and then
 * compared their score with the score of the rule they had declared. That is
 * not an experiment, it is a quiz with a trap: a learner who drifted got told
 * they had drifted, which is feedback about their compliance rather than about
 * the world, and the screen needed six honesty branches to say it without
 * lying.
 *
 * Now the learner commits to one signal and the board holds them to it: a tap
 * that the chosen signal does not point at simply does not execute. One run,
 * one rule, faithfully. That makes screen 7 a comparison between three rules
 * instead of a report card, and it means the learner's fault count *is* the
 * rule's fault count, which is the only reason the table on screen 7 can be
 * read as evidence about the rules at all.
 *
 * Every number here comes from levels.json, which comes from sim.py.
 */

/** The three signals a learner can commit to. Random is not one of them. */
export type TestRule = Exclude<DeclaredRule, 'random'>

export const RULE_NAME: Record<TestRule, string> = {
  lru: 'LRU',
  fifo: 'FIFO',
  lfu: 'LFU',
}

/** What each signal is called before it has a name: the tile line it reads. */
const SIGNAL_LABEL: Record<TestRule, string> = {
  lru: 'least recently used',
  fifo: 'first in',
  lfu: 'least frequently used',
}

// ── Screen 5 · Say your rule out loud ────────────────────────────────────────

export const ASK_THE_RULE = [
  'Which of these best describes the pages you chose to remove?',
]

/**
 * Four options, four different measurable things: time since last use, time in
 * memory, total number of uses, and nothing.
 *
 * An earlier set had two options that pointed at the same page ("hadn't touched
 * in a while" and "could remember least about") and one that was ambiguous
 * between two policies ("sitting there longest" reads as both arrival order and
 * idle time), which meant screen 6 could test a rule the learner had not meant.
 */
export const RULE_OPTIONS: { id: DeclaredRule; label: string }[] = [
  { id: 'lru', label: "The one I'd gone the longest without using" },
  { id: 'fifo', label: 'The one that had been in memory the longest' },
  { id: 'lfu', label: "The one I'd used the fewest times" },
  { id: 'random', label: 'Honestly, I was just picking' },
]

/**
 * The reply, then the word for what they have just done.
 *
 * "Just picking" is not a wrong answer and is not treated as one: it is the
 * honest description of playing level 1 without instruments, and the reply
 * credits the effort that took before offering to remove it.
 */
export function ruleFeedback(rule: DeclaredRule): string[] {
  const naming =
    'A step-by-step rule a computer can follow is an **algorithm**. Here, it will decide which page leaves.'
  if (rule === 'random') {
    return [
      'Fair enough. Let\'s give you something concrete to go on.',
      "I'll show you three records of past use. Choose one, and we'll test the rule it suggests.",
      naming,
    ]
  }
  return [
    'That gives us a rule to test. We can see what happens when you follow it every time.',
    "On the next tape, I'll keep the record your rule uses, so you can read it straight off the board.",
    naming,
  ]
}

// ── Screen 6 · Run the experiment ────────────────────────────────────────────

/** A declaration becomes the rule under test. "Just picking" picks on screen 6. */
export function testRuleFor(declared: DeclaredRule | null): TestRule | null {
  return declared === null || declared === 'random' ? null : declared
}

export function experimentIntro(): { lines: string[]; focus: (Focus | null)[] } {
  return {
    lines: [
      "Each page now shows when it was last used, how long it's been here, and how often it's been used.",
      "Follow one signal for the whole run. That way, the result tells us how that rule performs.",
    ],
    focus: ['memory', 'memory'],
  }
}

export const ASK_THE_SIGNAL = ['Which signal do you want to test?']

/** Descriptions, not acronyms: the names arrive on screen 7 and not before. */
export const SIGNAL_OPTIONS: { id: TestRule; label: string }[] = [
  { id: 'lru', label: 'Last used the longest ago' },
  { id: 'fifo', label: 'In memory the longest' },
  { id: 'lfu', label: 'Used the fewest times' },
]

/**
 * Which slots the chosen signal points at, right now.
 *
 * Every tied extreme is returned rather than one winner. The learner reads
 * three printed numbers and cannot see a hidden tie-break, so rejecting a tap
 * that the visible evidence permits would be the board enforcing a rule it
 * never showed. On level 2 the frequency signal never ties at all, which sim.py
 * asserts, so this only ever matters on tapes the lesson does not use.
 */
export function consistentSlots(g: Game, rule: TestRule): number[] {
  const stats = tileStats(g)
  const value = (i: number): number | null => {
    const s = stats[i]
    if (s === null) return null
    // Bigger is more evictable for the two age signals; for the count it is
    // smaller, so it is negated and the same comparison works for all three.
    return rule === 'lru' ? s.usedAgo : rule === 'fifo' ? s.hereFor : -s.count
  }
  const scored = g.frames.map((_, i) => value(i)).filter((v): v is number => v !== null)
  if (scored.length === 0) return []
  const best = Math.max(...scored)
  return g.frames.map((_, i) => i).filter((i) => value(i) === best)
}

/** The tap the experiment does not accept. It re-asks; it never answers. */
export const OFF_RULE = [
  "For this run we're testing one rule. Which page does the signal you chose point to?",
]

/**
 * Lines beside a decision on level 2.
 *
 * Shorter than level 1's, and deliberately so: the reasoning has moved onto the
 * tiles, so a long prompt here is prose in front of a board the learner is
 * already reading. The regret line is page text under the tape, not a bubble.
 */
export function ambientL2(g: Game): string[] | null {
  if (!g.awaiting) return null
  const { page, mode } = g.awaiting
  if (mode === 'fill') return [`Page ${page} is not here yet. Tap the empty slot.`]
  const firstEviction = !g.events.some((e) => e.kind === 'evict')
  return firstEviction
    ? [
        `Memory is full and page ${page} needs a slot.`,
        'Read the three numbers on each page, then tap the one your signal points to.',
      ]
    : [`Page ${page} needs a slot. Which page does your signal point to?`]
}

/** No beats interrupt level 2. The instruments carry the screen. */
export const BEATS: Beat[] = []

// ── Screen 7 · Recency wins this test ────────────────────────────────────────

/**
 * The comparison, as page text.
 *
 * All three rules, always, whichever one the learner tested. A table with only
 * their rule and one rival would leave the third as an untested rumour, and the
 * learner has been reading all three numbers on every tile for a whole level.
 */
export function ruleRows(rule: TestRule | null): {
  id: string
  label: string
  value: number
  emphasis?: boolean
}[] {
  return (['lru', 'fifo', 'lfu'] as const).map((r) => ({
    id: r,
    label: r === rule ? `${SIGNAL_LABEL[r]} (yours)` : SIGNAL_LABEL[r],
    value: L2.scores[r],
    // The winning row is the one the table is arguing for. Which row is the
    // learner's is carried by the label, so the two never compete for the eye.
    emphasis: r === 'lru',
  }))
}

export const RESULT = [
  "Here's your rule alongside the other two, all tested on the same tape.",
  `Recency won this test: ${L2.scores.lru} faults instead of ${L2.scores.fifo}. Let's look at one choice that helped.`,
]

/** sim.first_signal_fork: the one eviction where the three signals disagree. */
const FORK = L2.fork!

/** What each resident page did next, revealed only now. */
export function forkRows(): { id: string; label: string; value: string }[] {
  return FORK.mem.map((p) => {
    const next = FORK.nextUse[String(p)]
    return {
      id: `p${p}`,
      label: `page ${p}`,
      value: next === null ? 'never returns' : `returns at step ${next}`,
    }
  })
}

/** "N requests later", measured from the fork. */
function afterFork(page: number): string {
  const next = FORK.nextUse[String(page)]!
  const n = next - FORK.step
  return n === 1 ? 'one request later' : `${n} requests later`
}

/**
 * The fork, explained by what happened rather than by which rule is best.
 *
 * This is the pedagogical hinge of the act: three signals, three different
 * pages, and the consequence readable on the tape afterwards. Recency is not
 * asserted to be right, it is shown to have dropped the one page that never
 * came back.
 */
export const FORK_COPY = [
  `At the first fork, all three signals pointed somewhere different. Recency dropped page ${FORK.lru}, and page ${FORK.lru} never came back.`,
  `The arrival-time rule dropped page ${FORK.fifo} because it had been there the longest. But page ${FORK.fifo} came back just ${afterFork(FORK.fifo)}.`,
  `Frequency kept page ${FORK.lru} and dropped page ${FORK.lfu}. But ${FORK.lfu} came back. A high use count kept page ${FORK.lru} in memory after the program stopped using it.`,
]

/**
 * The names, last.
 *
 * Every learner leaves with all three, and an acronym is only a name once the
 * words behind it have been said: three capitals on their own are a thing to
 * memorise. Level 2 printed all three measurements on every tile, so none of
 * the three rules is a stranger by the time it is labelled.
 */
export const NAMING = [
  'You have now compared three page-replacement algorithms. Each remembers a different part of the past.',
  'Dropping the page that arrived first is **FIFO (First In, First Out)**. Dropping the least frequently used page is **LFU (Least Frequently Used)**.',
  'Dropping the page used longest ago is **LRU (Least Recently Used)**.',
]

/**
 * The generalisation, and the guard on it immediately after.
 *
 * One tape is one result. The second line is not hedging: a learner who leaves
 * act 3 believing recency wins by law has learned the thing screens 8 and 11
 * exist to undo.
 */
export const GENERALISE = [
  "Programs often return to pages they've used recently. That's why LRU can be a useful rule beyond this tape.",
  'It is still a bet: recent use is a clue to what comes next.',
]

/**
 * The bridge: screen 4 promised an explanation of the floor, and this collects
 * on it. It asks the question and stops. Answering it here would spend screen 8.
 */
export const THE_FLOOR = [
  `But I still owe you something. Back on level one I said ${L1.scores.opt} faults were possible. Where did that number come from?`,
]
