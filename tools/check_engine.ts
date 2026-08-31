/**
 * Drives the game engine with the decisions each reference policy made, and
 * checks it lands on the same fault count sim.py did.
 *
 * The engine never chooses a victim — the learner does. So the way to test it
 * is to *be* FIFO, LRU, clock and OPT in turn, replaying the slot each of them
 * picked, and see whether the engine agrees about what that cost. If it does,
 * the accounting the learner sees is the accounting the oracle asserts.
 *
 * Run: npm run test:engine
 */

import { createGame, advance, resolve, isDone, credit } from '../src/lib/game.ts'
import { BEATS, ambientFor, beatLines, endCard } from '../src/lib/act1.ts'
import * as act2 from '../src/lib/act2.ts'
import type { Game } from '../src/lib/game.ts'
import type { LevelData, Step } from '../src/lib/types.ts'
// Imported directly rather than through src/lib/levels.ts: that module uses the
// '@/' alias, which Vite resolves and bare Node does not.
import raw from '../src/data/levels.json' with { type: 'json' }

const data = raw as unknown as LevelData

let failures = 0

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}

/** Replay one policy's trace through the engine, obeying its slot choices. */
function replay(ref: number[], frameCount: number, steps: Step[]) {
  let g = createGame(ref, frameCount)
  const regrets: { page: number; stepsAgo: number }[] = []

  while (!isDone(g)) {
    g = advance(g)
    if (g.awaiting) {
      if (g.awaiting.regret) regrets.push(g.awaiting.regret)
      // The trace records the slot this policy put the page into, which for a
      // full memory is the slot it emptied. That is the learner's tap.
      g = resolve(g, steps[g.awaiting.step - 1].slot)
    }
  }
  return { faults: g.faults, regrets, credit: credit(g), frames: g.frames }
}

console.log('engine vs sim.py\n')

for (const key of ['l1', 'l2', 'l3'] as const) {
  const lvl = data.levels[key]
  for (const [policy, steps] of Object.entries(lvl.traces)) {
    const r = replay(lvl.ref, lvl.frames, steps)
    check(`${key} ${policy} faults`, r.faults, lvl.scores[policy as keyof typeof lvl.scores])
    // The engine's residency must match the trace at the end, not just the count.
    const last = steps[steps.length - 1].frames
    check(`${key} ${policy} final residency`, [...r.frames].sort(), [...last].sort())
  }
}

console.log('\nbelady, both memory sizes')
for (const policy of ['clock', 'lru', 'fifo', 'opt'] as const) {
  const run = data.belady.runs[policy]
  for (const size of ['small', 'big'] as const) {
    const r = replay(data.belady.ref, run[size].frames, run[size].steps)
    check(`belady ${policy} @${run[size].frames}`, r.faults, run[size].faults)
  }
}

console.log('\nfeedback mechanics on level 1, played as LRU')
{
  const lvl = data.levels.l1
  const r = replay(lvl.ref, lvl.frames, lvl.traces.lru!)
  // sim.py asserts the first LRU regret lands at step 8, three steps after the
  // eviction, and that page 1 is the one that never comes back.
  check('first regret is 3 steps deep', r.regrets[0], { page: 2, stepsAgo: 3 })
  check('positive credit', r.credit.map((c) => c.page), [1])
}

// -- pacing -----------------------------------------------------------------
// Sequential bubbles make every surplus line a surplus tap, and a learner who
// is tapping through prose has stopped playing. These caps are the ones the
// act-1 rewrite settled on; raising one should be a deliberate decision, not
// something that happens because a beat quietly grew.

console.log('\npacing of the voice')
const MAX_CHARS = 190

// Act 2's voice is not all in beats: the question, the feedback branches, the
// handover and the scoreboard copy are plain arrays, and every one of them is
// read out one bubble at a time exactly like a beat. They get the same limits.
// Screen 7's copy branches on declaration AND outcome; every reachable branch
// gets the same pacing limits, so the pairs below cover each guard once.
const levelOne = data.levels.l1
const levelTwo = data.levels.l2
const scorePairs: [Parameters<typeof act2.scoreboardCopy>[0], number][] = [
  ['lru', 6], ['lru', 8], ['fifo', 6], ['fifo', 10], ['fifo', 12],
  ['lfu', 6], ['lfu', 8], ['lfu', 10], ['random', 6], ['random', 9],
]
const act2Groups: { id: string; lines: string[]; focus?: unknown[] }[] = [
  { id: 'ask-the-rule', lines: act2.ASK_THE_RULE },
  // The hand-over to act 4 branches on whether the learner reached the floor.
  { id: 'floor:matched', lines: act2.theFloor(levelTwo.scores.opt) },
  { id: 'floor:missed', lines: act2.theFloor(levelTwo.scores.opt + 3) },
  ...(['lru', 'fifo', 'lfu', 'random'] as const).map((r) => {
    const h = act2.handover(r)
    return { id: `handover:${r}`, lines: h.lines, focus: h.focus }
  }),
  ...act2.RULE_OPTIONS.map((o) => ({ id: `feedback:${o.id}`, lines: act2.ruleFeedback(o.id) })),
  ...scorePairs.map(([r, f]) => ({ id: `scoreboard:${r}`, lines: act2.scoreboardCopy(r, f) })),
  // Screen 7's second group: the same four branches, one bubble at a time.
  ...(['lru', 'fifo', 'lfu', 'random'] as const).map((r) => ({
    id: `naming:${r}`,
    lines: act2.namingCopy(r),
  })),
]

// A beat whose lines depend on the run is two groups to read, not one.
const floorBeat = BEATS.find((b) => b.id === 'the-floor')!
const atTheFloor = { ...createGame(levelOne.ref, levelOne.frames), faults: levelOne.scores.opt }
const aboveIt = { ...createGame(levelOne.ref, levelOne.frames), faults: levelOne.scores.opt + 3 }

const groups = [
  ...BEATS.map((b) => ({ id: b.id, lines: b.lines, focus: b.focus })),
  { id: 'the-floor:matched', lines: beatLines(floorBeat, atTheFloor), focus: undefined },
  { id: 'the-floor:above', lines: beatLines(floorBeat, aboveIt), focus: undefined },
  ...act2.BEATS.map((b) => ({ id: b.id, lines: b.lines, focus: b.focus })),
  ...act2Groups.map((g) => ({ ...g, focus: undefined })),
]

for (const beat of groups) {
  // Only the welcome earns a long group: it is the entire setup, each of its
  // lines introduces a different object on the board, and each one lights that
  // object up while it is read. It went from six to seven when the fog beat was
  // deleted and its one load-bearing line moved here — a net loss of two lines
  // and, more to the point, of a mid-game interruption that explained nothing
  // that had just happened.
  const cap = beat.id === 'welcome' ? 7 : 4
  check(`${beat.id}: ${beat.lines.length} line(s), cap ${cap}`, beat.lines.length <= cap, true)
  check(
    `${beat.id}: every line under ${MAX_CHARS} chars`,
    // The ** markers are formatting, not reading load.
    beat.lines.filter((l) => l.replace(/\*\*/g, '').length > MAX_CHARS).length,
    0,
  )
  // A focus hint per line, or the tour points at the wrong thing halfway down.
  if (beat.focus) {
    check(`${beat.id}: focus entries match lines`, beat.focus.length, beat.lines.length)
  }
}

// The lines beside a decision are most of what act 1 says, and nothing has ever
// checked them: the caps above read beats and act 2's written groups, both of
// which are literal arrays a person can look at, while the ambient voice is
// generated per step and appears in no list. That is precisely where a
// three-bubble regret group sat with a pronoun that changed referent between
// bubbles. Replaying two policies per level walks the branches, including the
// first-regret group, which only fires on a path that evicts a page that comes
// back soon after.
console.log('\nthe voice beside a decision')
function ambientGroups(
  ref: number[],
  frameCount: number,
  steps: Step[],
  voice: (g: Game) => string[] | null,
) {
  let g = createGame(ref, frameCount)
  const said: string[][] = []
  while (!isDone(g)) {
    g = advance(g)
    if (g.awaiting) {
      const lines = voice(g)
      if (lines) said.push(lines)
      g = resolve(g, steps[g.awaiting.step - 1].slot)
    }
  }
  return said
}

const ambient = [
  ...ambientGroups(levelOne.ref, levelOne.frames, levelOne.traces.lru!, ambientFor),
  ...ambientGroups(levelOne.ref, levelOne.frames, levelOne.traces.fifo!, ambientFor),
  ...ambientGroups(levelTwo.ref, levelTwo.frames, levelTwo.traces.lru!, act2.ambientL2),
  ...ambientGroups(levelTwo.ref, levelTwo.frames, levelTwo.traces.fifo!, act2.ambientL2),
]
// Tighter than a beat's four, because the learner is mid-decision: the board is
// waiting for a tap and every extra bubble is a tap that is not the one they
// came to make.
check('every ambient group is 3 bubbles or fewer', ambient.filter((g) => g.length > 3).length, 0)
check(
  `every ambient line under ${MAX_CHARS} chars`,
  ambient.flat().filter((l) => l.replace(/\*\*/g, '').length > MAX_CHARS).length,
  0,
)
check('no em dashes beside a decision', ambient.flat().filter((l) => l.includes('—')), [])
check('and one verb for a request', ambient.flat().filter((l) => /\bneed(ed|ing)\b/i.test(l)), [])

// A key term is highlighted the first time the lesson hands it over and never
// again: the tint means "this word is new and it will matter", and repeating it
// on every later mention spends exactly that meaning.
// Screen 7 must never lie about what the learner did: no "you switched" for a
// faithful player, no "you had a rule" for a score that says they didn't.
// "Drop whichever was needed fewest times" is under-determined, and on L2 the
// tie at step 15 changes the score (8 with a recency tie-break, 9 with arrival
// order). So screen 7 may only quote a number for it if screen 6 said which
// tie-break it meant. Recency and arrival order never tie, so only LFU needs it.
console.log('\nunder-determined rules must state their tie-break')
const lfuHandover = act2.handover('lfu').lines.join(' ').toLowerCase()
check('lfu handover states a tie-break', lfuHandover.includes('tie'), true)
check(
  'and it is the one the oracle uses (least recently used)',
  lfuHandover.includes('longest without being used'),
  true,
)

// Screen 7's job is to make a comparison land, and a comparison lands on a
// number. Wherever the copy concludes that one measurement beat another, it has
// to say what the winning one was worth — otherwise the learner is left holding
// an aphorism ("how recently told you everything") and has to do the arithmetic
// the screen was supposed to do for them.
console.log('\nconclusions cite the number that carries them')
const recency = String(levelTwo.scores.lru)
for (const [rule, faults] of [
  ['fifo', 10],
  ['lfu', 8],
  ['lfu', 10],
  ['random', 9],
] as [Parameters<typeof act2.scoreboardCopy>[0], number][]) {
  check(
    `${rule}@${faults} names what the good number scores (${recency})`,
    act2.scoreboardCopy(rule, faults).join(' ').includes(recency),
    true,
  )
}
// A tile shows a measurement; a rule is what plays. "The other number scores 6"
// is a category error, and an ambiguous one on a panel of three numbers: the
// learner cannot tell which number is meant or what it is supposed to have
// done. Conclusions name the action instead — "dropping whichever had gone
// longest without being needed would have scored 6".
// The tile prints "used N ago" for recency and "used N times" for the count:
// one verb, because both describe the same event, with when-vs-how-many doing
// the distinguishing. An earlier draft said "needed" for the count on the tile
// and "without being needed" for recency in the voice, so the same word meant
// two different measures on the same screen and the recency conclusion read as
// the counting rule. "Needed" is retired from act 2 entirely.
// Present-tense "needs" is ordinary English about what a program requires and
// is fine; "needed"/"needing" is what was standing in for a measurement.
check(
  'act 2 uses one verb for a request',
  groups.flatMap((g) => g.lines).filter((l) => /\bneed(ed|ing)\b/i.test(l)),
  [],
)
check(
  'a measurement is never said to score',
  scorePairs
    .flatMap(([r, f]) => act2.scoreboardCopy(r, f))
    .filter((l) => /\bnumber\b[^.]*\bscores?\b/i.test(l)),
  [],
)
check(
  'no stock gesturing left in screen 7',
  scorePairs.flatMap(([r, f]) => act2.scoreboardCopy(r, f)).filter((l) => /worth keeping/i.test(l)),
  [],
)

console.log('\nscreen 7 honesty guards')
check('fifo played faithfully: not told they switched', act2.scoreboardCopy('fifo', 10).join(' ').includes('stopped playing'), false)
check('fifo who improved: told they left their rule', act2.scoreboardCopy('fifo', 6).join(' ').includes('stopped playing'), true)
check('random at ~8: not told they had a rule', act2.scoreboardCopy('random', 9).join(' ').includes('you did have one'), false)
check('random who beat it: told they had a rule', act2.scoreboardCopy('random', 6).join(' ').includes('you did have one'), true)
check('lru who drifted: instinct affirmed, drift named', act2.scoreboardCopy('lru', 8).join(' ').toLowerCase().includes('drift'), true)
check('lfu played faithfully: not told they left it', act2.scoreboardCopy('lfu', 8).join(' ').includes('left your own rule'), false)
check('lfu who improved: told they left it', act2.scoreboardCopy('lfu', 6).join(' ').includes('left your own rule'), true)
check(
  'lfu who improved: not lectured on a discovery they made',
  act2.scoreboardCopy('lfu', 6).join(' ').includes('How recently told you everything'),
  false,
)

// The best possible score used to be the third row of the end card: page text,
// stated as settled, and the answer to the question the very next beat asks.
// The lesson's own deletion test says cut it, so it moved into the voice, where
// a learner is free to disbelieve it. What stays in the table is what they
// watched happen. And the floor is a property of the tape, never of a rule: on
// this level LRU and OPT both score 6 by design, and a learner who leaves
// believing 6 is the floor *because* of LRU has learned the thing screen 14
// exists to undo.
console.log('\nthe fun fact, and the promise it comes with')
{
  const said = beatLines(floorBeat, aboveIt).join(' ')
  const bragged = beatLines(floorBeat, atTheFloor).join(' ')
  check('screen 4 says the floor out loud', said.includes(String(levelOne.scores.opt)), true)
  // Still `trips`. The counter learns the words "page fault" on the next beat.
  check('and in the word the counter still uses', /\btrips\b/.test(said), true)
  check('not the one it has not learned yet', /page fault/.test(said), false)
  // The promise is what screen 7 collects on. Without it the callback there is
  // a claim about a line the learner may never have registered.
  check('it promises to come back to it', /come back to that later/.test(said), true)
  check('the congratulation is guarded on the number', /very good instinct/.test(said), false)
  check('and offered to the learner who earned it', /very good instinct/.test(bragged), true)
  // The end card is what they watched happen, and nothing else.
  check('the end card carries no claim', Object.keys(endCard(aboveIt)).sort(), ['credit', 'faults', 'requests'])
}

console.log('\nthe floor is a claim, not a row')
const floorCases: [string, string[]][] = [
  ['matched', act2.theFloor(levelTwo.scores.opt)],
  ['missed', act2.theFloor(levelTwo.scores.opt + 3)],
]
for (const [id, lines] of floorCases) {
  const said = lines.join(' ')
  check(`${id}: quotes the oracle's floor`, said.includes(String(levelTwo.scores.opt)), true)
  // Two tapes, two floors, and the only thing that changed is the tape. That
  // pair is the evidence for the line that follows it, so it has to be quoted.
  check(`${id}: and level 1's, to show it moved`, said.includes(String(levelOne.scores.opt)), true)
  check(`${id}: collects the promise screen 4 made`, /come back to it|fun fact/.test(said), true)
  check(`${id}: the floor belongs to the tape, not a rule`, said.includes('belongs to the tape, not to any rule'), true)
  // It poses the question and offers to answer it. Ending on the bare question
  // makes the button a way to find out what the machine meant; ending on the
  // offer makes the same tap an answer to an invitation.
  check(`${id}: asks how it could know`, /how do I know/i.test(said), true)
  check(`${id}: and offers to show`, /show you/i.test(lines[lines.length - 1]), true)
  // It asks how the number is known. Answering it here would spend screen 8.
  check(`${id}: does not answer its own question`, /in advance|every request|whole tape|the future/i.test(said), false)
}
check(
  'and no feedback branch settles it either',
  scorePairs
    .flatMap(([r, f]) => act2.scoreboardCopy(r, f))
    .filter((l) => /best possible|nothing could have done better/i.test(l)),
  [],
)

// The vocabulary rule: what you just did has a name, and the name is X. Never
// the name first as a clue. Screen 5 offers four rules in the learner's own
// words and screen 7 prices the one they picked; only once that number has
// landed does the label arrive. So the acronyms may appear in exactly one place
// in act 2 — and an acronym on its own is not a name yet: three capitals are a
// thing to memorise unless the words behind them are said too.
console.log('\na rule is named only after it has been played')
const ACRONYM = /\b(LRU|FIFO|LFU)\b/
const beforeTheName = [
  ...act2.ASK_THE_RULE,
  ...act2.RULE_OPTIONS.map((o) => o.label),
  ...act2.RULE_OPTIONS.flatMap((o) => act2.ruleFeedback(o.id)),
  ...(['lru', 'fifo', 'lfu', 'random'] as const).flatMap((r) => act2.handover(r).lines),
  ...scorePairs.flatMap(([r, f]) => act2.scoreboardCopy(r, f)),
]
check('no acronym anywhere before screen 7 names it', beforeTheName.filter((l) => ACRONYM.test(l)), [])

// Every learner leaves with all three names, and an acronym is only a name
// once the words behind it have been said. Level 2 printed all three
// measurements on every tile, so none of the three is a stranger, and nobody's
// vocabulary should depend on which of four buttons they pressed on screen 5.
const EXPANSION: [string, string][] = [
  ['LRU', 'least recently used'],
  ['FIFO', 'first in, first out'],
  ['LFU', 'least frequently used'],
]
const DECLARED: Record<string, string> = { lru: 'LRU', fifo: 'FIFO', lfu: 'LFU', random: 'LRU' }
for (const rule of ['lru', 'fifo', 'lfu', 'random'] as const) {
  const said = act2.namingCopy(rule).join(' ')
  for (const [name, expansion] of EXPANSION) {
    check(`${rule} meets ${name}`, said.includes(name), true)
    check(`${rule}: ${name} is spelled out`, said.toLowerCase().includes(expansion), true)
  }
  // Order carries the difference between a name and a menu: the rule they
  // declared is named on its own first, as the thing they earned, and the other
  // two follow as one aside. A learner who declared nothing is given the rule
  // that wins here first instead.
  const own = said.indexOf(DECLARED[rule])
  const others = EXPANSION.filter(([n]) => n !== DECLARED[rule]).map(([n]) => said.indexOf(n))
  check(`${rule}: their own rule is named first`, others.every((i) => i > own), true)
}

// The row relabels itself in place, the way the counter does on screen 4: the
// learner's own words until the naming group opens, the name after it.
console.log('\nthe scoreboard row performs the swap')
for (const rule of ['lru', 'fifo', 'lfu'] as const) {
  check(`${rule} row before: the learner's words`, ACRONYM.test(act2.declaredRowLabel(rule, false)), false)
  check(`${rule} row after: the name`, act2.declaredRowLabel(rule, true).startsWith(act2.RULE_NAME[rule]), true)
}
check(
  'the random row has nothing to relabel',
  act2.declaredRowLabel('random', true),
  act2.declaredRowLabel('random', false),
)

// The tutor speaks the way someone would out loud to a room of teenagers, and
// nobody says an em dash out loud. Commas, full stops and the occasional
// exclamation mark carry the same joins without the written-essay register.
const dashed = groups.flatMap((b) => b.lines.filter((l) => l.includes('—')))
check('no em dashes in the voice', dashed, [])

// Groups whose ids share a prefix before ':' are mutually exclusive branches
// (the four answers to screen 5, the three scoreboard cases). A learner sees
// exactly one of them, so a term marked in each is still marked once for them.
// Only the first variant of each branch counts.
const firstOfEachBranch = new Map<string, string[]>()
for (const g of groups) {
  const key = g.id.split(':')[0]
  if (!firstOfEachBranch.has(key)) firstOfEachBranch.set(key, g.lines)
}
const marked = [...firstOfEachBranch.values()]
  .flat()
  .flatMap((l) => [...l.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]))

const repeated = marked.filter((term, i) => marked.indexOf(term) !== i)
check(`key terms highlighted once each${marked.length ? ` (${marked.join(', ')})` : ''}`, repeated, [])

console.log(failures === 0 ? '\nengine agrees with the oracle' : `\n${failures} disagreement(s)`)
process.exit(failures === 0 ? 0 : 1)
