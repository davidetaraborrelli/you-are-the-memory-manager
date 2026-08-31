import type { Game } from './game.ts'
import { isDone } from './game.ts'
import type { Beat, Focus } from './act1.ts'
import type { DeclaredRule } from './types.ts'
import { L1, L2 } from './levels.ts'

/**
 * Screens 5–7: say the rule out loud, then have it tested.
 *
 * Screen 5 looks like an interruption and is the most important screen in act
 * 2. It makes the learner articulate a rule, which turns a run of intuitions
 * into a hypothesis — and screen 7 is where that hypothesis gets its number
 * next to theirs. The earlier draft promised this test and never delivered it.
 *
 * Screen 6 is level 1's loop with one thing added: the recency the learner has
 * been holding in their head is now printed on the tiles. Nothing else changes,
 * and that is the argument. They are not learning a new algorithm; they are
 * being given more memory to be a memory manager with.
 *
 * Screen 7 then does two things in order, and the order is the lesson's
 * vocabulary rule: first what happened (the declared rule against the played
 * one), then what it is called. See `namingCopy`.
 */

/** What screen 5 asks, and what each answer commits the learner to. */
export const RULE_OPTIONS: { id: DeclaredRule; label: string }[] = [
  { id: 'lru', label: "The one I'd gone the longest without using" },
  { id: 'fifo', label: "The one that came in first, whether I'd used it since or not" },
  { id: 'lfu', label: "The one I'd used the fewest times in total" },
  { id: 'random', label: "Honestly, I didn't have a rule. I was just picking." },
]

export const ASK_THE_RULE = [
  'Quick question before we move on, and there is genuinely no wrong answer here.',
  'When you had to drop a page, what were you actually going on?',
]

/** Every answer gets the same closing thought; one gets something of its own first. */
export function ruleFeedback(id: string): string[] {
  const opening =
    id === 'random'
      ? [
          "That's completely fair! Three pages and nothing written down is a lot to keep in your head.",
          "It's a real problem, and I'm about to fix it for you.",
        ]
      : []
  return [
    ...opening,
    "Whatever you picked, that's an **algorithm**. A rule you follow every time instead of deciding fresh.",
    "Hold onto it, because we're about to find out how good it actually is.",
  ]
}

/**
 * Screen 6's handover. Every tile grows an instrument panel: one number per
 * declarable rule — recency, age in memory, request count — so each strategy
 * from screen 5 is equally effortless to execute. An earlier design showed
 * recency alone, which made "you're free to keep your rule" hollow: a FIFO
 * player still had to remember arrival order in their head, the exact burden
 * this level exists to remove. With the full panel the race is fair, the
 * declared rule can be played to the letter in the learner's own hands, and
 * screen 7's numbers land on what they actually did.
 *
 * It also sharpens act 5: screen 10 confiscates the whole panel, not one
 * number, so the one-bit budget lands harder — and having watched the recency
 * column win a fair race, choosing to rebuild *that* measurement with the bit
 * is reasoned rather than default.
 */
export function handover(rule: DeclaredRule): { lines: string[]; focus: (Focus | null)[] } {
  const panel =
    "No more keeping things in your head! Every tile now shows three numbers: how long since the page was last used, how long it's been here, and how many times it's been used."
  const line2: Record<DeclaredRule, string> = {
    lru: 'The first number is your rule, written down. Play it to the letter if you like, or use anything you see. Watch!',
    fifo: 'The middle number is your rule, written down: who has been here longest. Play it to the letter if you like, or use anything you see!',
    lfu: 'The last number is your rule, written down: how many times each page was used. If two of them tie, drop whichever has gone longest without being used!',
    random: "You said you didn't have a rule. Well, now you have three numbers to build one from. See what you do!",
  }
  return { focus: ['memory', 'memory'], lines: [panel, line2[rule]] }
}

/**
 * Deliberately empty. Level 2 has no mid-run beat: the handover already
 * introduced the tiles, the tiles label themselves, and for FIFO/LFU declarers
 * any mid-run line pointing at the timestamps would spend screen 7's reveal
 * ("you quietly stopped playing your own rule") before its moment. An earlier
 * build had a "See? No more holding it in your head" beat here; it was wrong
 * for three declarers out of four and redundant for the fourth.
 */
export const BEATS: Beat[] = []

/**
 * Screen 7. The declared rule, played to the letter on this tape, next to what
 * the learner actually scored.
 */
export function declaredScore(rule: DeclaredRule): number {
  if (rule === 'lru') return L2.scores.lru
  if (rule === 'fifo') return L2.scores.fifo
  if (rule === 'lfu') return L2.scores.lfu
  return Math.round(L2.scores.randomAvg)
}

export function declaredLabel(rule: DeclaredRule): string {
  if (rule === 'lru') return '"the one I\'d gone longest without using", played to the letter'
  if (rule === 'fifo') return '"the one that came in first", played to the letter'
  if (rule === 'lfu') return '"the one I\'d used fewest times", played to the letter'
  return 'picking at random, on average'
}

/**
 * The copy depends on what they said *and* on what they scored, because the
 * interesting learner is the one who declared FIFO and then quietly played
 * recency once the timestamps appeared. Their algorithm changed under them, and
 * noticing that is the point of the whole act.
 */
export function scoreboardCopy(rule: DeclaredRule, faults: number): string[] {
  // Guards everywhere: the copy must never claim the learner switched rules
  // when they faithfully played the one they declared, or that they had a rule
  // when their score says they really were picking. Screen 7 is post-commit,
  // so it may be fully explicit — but only about what actually happened.
  if (rule === 'lru') {
    if (faults === L2.scores.lru) {
      return [
        `${faults}! And the rule you named, played to the letter, also gets ${L2.scores.lru}.`,
        'Recency is not a shabby shortcut on this tape. It is exactly the right answer.',
      ]
    }
    return [
      `Here's the interesting bit: the rule you named, played to the letter, scores ${L2.scores.lru}, and you got ${faults}.`,
      'So your instinct was exactly right! The drift away from it is what cost you, and the tiles were even keeping the number for you.',
    ]
  }
  if (rule === 'fifo') {
    if (faults < L2.scores.fifo) {
      return [
        `You said you were going by arrival order. Played to the letter, that scores ${L2.scores.fifo} on this tape. You got ${faults}.`,
        'So somewhere in there you quietly stopped playing your own rule and started trusting a different number on those tiles!',
      ]
    }
    if (faults === L2.scores.fifo) {
      return [
        `You said arrival order, and you stuck with it all the way: ${faults}, exactly what your rule scores here.`,
        `Arrival order ignores everything that happens after a page arrives. Dropping whichever had gone longest without being used would have scored ${L2.scores.lru}.`,
      ]
    }
    return [
      `Your declared rule, played to the letter, scores ${L2.scores.fifo} here. You got ${faults}, so the choices wandered somewhere else entirely.`,
      'Either way, the useful number was sitting on the tiles the whole time: how long each page had gone unused.',
    ]
  }
  if (rule === 'lfu') {
    if (faults === L2.scores.lfu) {
      // They played counting to the letter, so the punchline is theirs to keep:
      // the rule they trusted scores what a coin flip scores.
      return [
        `You said you were counting how many times each page was used, and you stuck with it all the way: ${faults}, exactly what your rule scores here.`,
        `Picking at random also averages ${L2.scores.lfu} here, so counting gave you nothing a coin flip wouldn't. Dropping whichever had gone longest without being used would have scored ${L2.scores.lru}.`,
      ]
    }
    if (faults < L2.scores.lfu) {
      // They beat their own rule, so they left it. Saying "counting told you
      // nothing, recency told you everything" here would explain a discovery
      // they have already made, and skip the thing they actually did.
      return [
        `You said you were counting how many times each page was used. Played to the letter, that scores ${L2.scores.lfu} here, and you got ${faults}.`,
        `So you left your own rule somewhere along the way, and it was worth leaving: counting scores ${L2.scores.lfu} here, the same as picking at random. Which number did you start trusting instead?`,
      ]
    }
    return [
      `Your declared rule, played to the letter, scores ${L2.scores.lfu} here. You got ${faults}, so the choices wandered somewhere else entirely.`,
      `Worth knowing anyway: counting scores ${L2.scores.lfu} here, the same as picking at random. Dropping whichever had gone longest without being used would have scored ${L2.scores.lru}.`,
    ]
  }
  if (faults < Math.round(L2.scores.randomAvg)) {
    return [
      `You said you didn't have a rule. Picking at random averages about ${Math.round(L2.scores.randomAvg)} here, and you got ${faults}.`,
      'So you did have one! Somewhere in those three numbers, you found a rule worth following.',
    ]
  }
  return [
    `You said you didn't have a rule, and picking at random averages about ${Math.round(L2.scores.randomAvg)} here. You got ${faults}, so that really was a coin-flip run!`,
    `Worth knowing now that it's over: the first of those three numbers was the one that mattered. Dropping whichever had gone longest without being used would have scored ${L2.scores.lru}.`,
  ]
}

/**
 * Screen 7, once the number has landed: the rule the learner named gets the
 * name everyone else uses for it.
 *
 * Screen 5 told them that whatever they picked was an *algorithm* and stopped
 * there. This is the other half of that sentence, and this is the first place
 * it can honestly be said: they declared a rule, played a level with it, and
 * watched it score. Said on screen 5 the name would have been a hint about
 * which of the four answers was the good one; said here it is a label on
 * something they already own.
 *
 * The expansion is the point, not the acronym. "Least recently used" is their
 * own screen-5 sentence with the words shortened, so the copy always spells it
 * out. Three capitals on their own are a thing to memorise, and the claim this
 * lesson keeps making is that you do not have to.
 *
 * Everyone leaves with all three names, and the order is what keeps that from
 * being the "choose your algorithm" menu this lesson cut. The rule they
 * declared is named first, on its own, as the thing they earned. The other two
 * follow as one aside, and they are not unmet strangers: level 2 printed all
 * three measurements on every tile, so every learner has had all three in
 * their hands whether or not they played them.
 *
 * The alternative was worse. Naming only the declared rule would have made a
 * learner's whole vocabulary depend on which of four buttons they pressed on
 * screen 5, and the university slide this lesson is aimed at has all of them
 * on it.
 *
 * In the aside the description carries the expansion: "dropping whichever page
 * was used fewest times is LFU" says *least frequently used* in words the
 * learner already has, which is the same trick as the main naming line and the
 * reason the aside can be one bubble instead of three.
 */
export const RULE_NAME: Record<Exclude<DeclaredRule, 'random'>, string> = {
  lru: 'LRU',
  fifo: 'FIFO',
  lfu: 'LFU',
}

export function namingCopy(rule: DeclaredRule): string[] {
  const opener =
    'Back on the last screen I said that whatever you picked was an algorithm. Well, yours has a name too.'
  // The aside, for the two learners whose own rule is the recency one.
  const otherTwo =
    'The other two have names as well: dropping whichever page was used fewest times is **LFU**, least frequently used, and whichever arrived first is **FIFO**, first in, first out.'
  if (rule === 'lru') {
    return [
      opener,
      'Dropping whichever page has gone longest without being used is called **LRU**, short for least recently used. Your own sentence, shortened.',
      otherTwo,
    ]
  }
  if (rule === 'fifo') {
    return [
      opener,
      'Dropping whichever page came in first, whatever happened since, is called **FIFO**: first in, first out.',
      `And the rule that scored ${L2.scores.lru} here has a name as well: **LRU**, least recently used.`,
      'The third one, dropping whichever page was used fewest times, is **LFU**, least frequently used.',
    ]
  }
  if (rule === 'lfu') {
    // One letter apart, and on this tape that letter is the whole of M4: the
    // learner who counted uses has just paid this gap in page faults.
    const gap = L2.scores.lfu - L2.scores.lru
    return [
      opener,
      'Dropping whichever page was used fewest times is called **LFU**: least frequently used.',
      `The rule that scored ${L2.scores.lru} is **LRU**, least recently used. One letter apart, and on this tape that letter is worth ${gap} page fault${gap === 1 ? '' : 's'}.`,
      'And the third one, dropping whichever page arrived first, is **FIFO**: first in, first out.',
    ]
  }
  // They declared nothing, so there is nothing of theirs to label. The name
  // still has somewhere honest to land: the rule that wins on this tape.
  return [
    "You said you didn't have a rule, so let me hand you the name of the one that does best here.",
    'Dropping whichever page has gone longest without being used is called **LRU**, short for least recently used.',
    otherTwo,
  ]
}

/**
 * Row 2 of the scoreboard, before and after the naming.
 *
 * The swap is the move the counter makes on screen 4: the label the learner
 * wrote in their own words becomes the label a textbook would use, in place,
 * beside the number it has been sitting next to all along. The `random` row
 * never swaps, because that learner declared nothing to relabel.
 */
export function declaredRowLabel(rule: DeclaredRule, named: boolean): string {
  if (named && rule !== 'random') return `${RULE_NAME[rule]}, the rule you said you were using`
  return `The rule you said you were using: ${declaredLabel(rule)}`
}

/**
 * Screen 7's last group: the number nobody has earned, and the question that
 * opens act 4.
 *
 * The floor used to be the third row of the end card, page text, stated as
 * settled. That broke the lesson's own deletion test: it is the answer to the
 * question the very next beat asks. A row in a table cannot be doubted, and the
 * doubt is the whole pull into the OPT reveal, so the claim moves into the
 * voice where the learner is free to disbelieve it.
 *
 * Which leaves a clean division the rest of the lesson can follow: a number
 * that is a *result* goes in the table, because the learner watched it happen;
 * a number that is a *claim* goes in the voice, because someone has to be
 * accountable for it. The end card keeps the two rows the learner can verify
 * from their own run.
 *
 * The third line is the one this beat exists for. On level 2, LRU and OPT both
 * score 6, which is designed (recency is not a shabby heuristic, here it is
 * literally the right answer) and, presented carelessly, teaches the wrong
 * lesson: that 6 is the floor *because* of LRU. It is not. The floor is a
 * property of the tape, and screen 14 will need the learner to already believe
 * that when it shows them LRU losing.
 *
 * Quoting level 1's floor beside this one is what makes that line evidence
 * rather than assertion. Two tapes, two different numbers, and the only thing
 * that changed between them is the tape: the learner can see the claim instead
 * of being asked to take it.
 *
 * The last line points at the contradiction rather than resolving it: the
 * machine said in the welcome that it never gets to read the program, and it
 * has now twice announced a score nobody could beat. Both cannot be true the
 * way the learner currently understands them, and screen 8 is the resolution.
 *
 * It ends on the offer, not on the bare question. The machine asking something
 * and then leaving it hanging makes the learner tap a button to find out what
 * the machine meant; the machine asking and then saying *let me show you* makes
 * the same tap an answer to an invitation. "I never get to read the program" is
 * the welcome's own wording, so the contradiction is one the learner can check
 * rather than one they have to take on trust.
 *
 * The opener collects on a promise. Screen 4's `the-floor` beat says the fun
 * fact out loud and then says it will come back to it, so this group opens by
 * doing exactly that, and the last line reminds the learner what was owed. An
 * earlier draft opened with "a number I've been putting in front of you since
 * level 1", which claimed a habit out of a single quiet line on an end card.
 */
export function theFloor(faults: number): string[] {
  const floor = L2.scores.opt
  const matched = faults === floor
  const gap = faults - floor
  return [
    `Remember that fun fact at the end of the last tape? The fewest anyone could take there was ${L1.scores.opt}. On this one it's ${floor}.`,
    matched
      ? `And ${faults} is what you took. So there was no better run available here, and you found it.`
      : `You took ${faults}, so ${gap} of those page faults ${gap === 1 ? 'was' : 'were'} avoidable.`,
    matched
      ? `Notice it moved. Different tape, different floor: that number belongs to the tape, not to any rule, and your run happens to sit exactly on it.`
      : `Notice it moved. Different tape, different floor: that number belongs to the tape, not to any rule, and nothing gets underneath it.`,
    `But hold on. I never get to read the program, remember? So how do I know ${floor} is the fewest anyone could take? Glad you asked. Let me show you.`,
  ]
}

export function l2Complete(g: Game): boolean {
  return isDone(g)
}

/**
 * Beside a level 2 decision. Much quieter than act 1: the tiles now carry the
 * information the voice used to have to point at, so pointing at it again would
 * be reading the screen aloud.
 */
export function ambientL2(g: Game): string[] | null {
  if (!g.awaiting) return null
  const { page, mode, regret } = g.awaiting
  if (mode === 'fill') return [`Page ${page} is new. Tap the empty slot to fetch it in.`]
  if (regret) {
    const gap = regret.stepsAgo === 1 ? 'one step' : `${regret.stepsAgo} steps`
    return [`Page ${page} is back! You dropped it ${gap} ago. Have another go.`]
  }
  return [`Page ${page} isn't here. Which one goes?`]
}
