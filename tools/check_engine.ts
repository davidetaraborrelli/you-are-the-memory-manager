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

const levelOne = data.levels.l1
const levelTwo = data.levels.l2
const fork = levelTwo.fork!

// -- screen 6's experiment ---------------------------------------------------
// The act rests on one claim: the learner's fault count IS the tested rule's
// fault count, because the board would not let them play anything else. If
// consistentSlots and the oracle ever disagree, screen 7's table stops being
// evidence about the rules and becomes a table of numbers about nothing.

console.log('\nthe experiment reproduces the oracle')
function playSignal(rule: act2.TestRule): number {
  let g = createGame(levelTwo.ref, levelTwo.frames)
  while (!isDone(g)) {
    g = advance(g)
    if (!g.awaiting) continue
    const slot =
      g.awaiting.mode === 'fill' ? g.frames.indexOf(null) : act2.consistentSlots(g, rule)[0]
    g = resolve(g, slot)
  }
  return g.faults
}
for (const rule of ['lru', 'fifo', 'lfu'] as const) {
  check(`following ${rule} exactly scores what sim.py says`, playSignal(rule), levelTwo.scores[rule])
}

// And the fork is where they part company. Reaching it is rule-independent —
// it is the first eviction, so every signal has agreed up to here — which is
// what lets one replay check all three.
console.log('\nthe diagnostic fork')
{
  // Advance to the first eviction, resolving the fills on the way. advance() is
  // a no-op while the game is awaiting an answer, so a loop that only advances
  // never gets past the first fill.
  let g = createGame(levelTwo.ref, levelTwo.frames)
  while (!g.awaiting || g.awaiting.mode !== 'evict') {
    g = g.awaiting ? resolve(g, g.frames.indexOf(null)) : advance(g)
  }
  check('the first eviction is the fork sim.py found', g.awaiting.step, fork.step)
  for (const rule of ['lru', 'fifo', 'lfu'] as const) {
    const slots = act2.consistentSlots(g, rule)
    check(`${rule} points where sim.py says`, slots.map((s) => g.frames[s]), [fork[rule]])
  }
  // Three signals, three different pages: if any two agreed here the screen
  // would be comparing rules that never actually disagreed in front of the
  // learner, and the whole diagnostic would be a claim rather than a sight.
  check(
    'and the three point somewhere different',
    new Set([fork.lru, fork.fifo, fork.lfu]).size,
    3,
  )
  // The enforcement, at the level the UI reads it: a victim another signal
  // points at is not accepted by this one.
  check(
    "a rival signal's victim is not consistent with recency",
    act2.consistentSlots(g, 'lru').map((s) => g.frames[s]).includes(fork.fifo),
    false,
  )
}

// -- pacing -----------------------------------------------------------------
// Sequential bubbles make every surplus line a surplus tap, and a learner who
// is tapping through prose has stopped playing. These caps are the ones the
// act-1 rewrite settled on; raising one should be a deliberate decision, not
// something that happens because a beat quietly grew.

console.log('\npacing of the voice')
const MAX_CHARS = 190

// Act 2's voice is not all in beats: the question, the feedback branches, the
// experiment briefing and every group on screen 7 are plain arrays, and each is
// read out one bubble at a time exactly like a beat. They get the same limits.
const intro = act2.experimentIntro()
const act2Groups: { id: string; lines: string[]; focus?: unknown[] }[] = [
  { id: 'ask-the-rule', lines: act2.ASK_THE_RULE },
  ...act2.RULE_OPTIONS.map((o) => ({ id: `feedback:${o.id}`, lines: act2.ruleFeedback(o.id) })),
  { id: 'experiment-intro', lines: intro.lines, focus: intro.focus },
  { id: 'ask-the-signal', lines: act2.ASK_THE_SIGNAL },
  { id: 'off-rule', lines: act2.OFF_RULE },
  { id: 'result', lines: act2.RESULT },
  { id: 'fork-copy', lines: act2.FORK_COPY },
  { id: 'naming', lines: act2.NAMING },
  { id: 'generalise', lines: act2.GENERALISE },
  { id: 'bridge', lines: act2.THE_FLOOR },
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
  ...act2Groups,
]

for (const beat of groups) {
  // Only the welcome earns a long group: it is the entire setup, each of its
  // lines introduces a different object on the board, and each one lights that
  // object up while it is read.
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

// The regret line names a gap, and act 1 established what a gap is counted in.
// "Steps" and "requests" for the same distance on the same tape is two units
// for one thing, which is one more than a learner should have to hold.
check(
  'a gap is measured in requests, never steps',
  ambient.flat().filter((l) => /\b\d+ steps?\b/.test(l)),
  [],
)

// A tile shows a measurement; a rule is what plays. "The other number scores 6"
// is a category error, and an ambiguous one on a panel of three numbers: the
// learner cannot tell which number is meant or what it is supposed to have
// done. Conclusions name the action instead.
// The tile prints "last used" for recency and "uses" for the count: one verb,
// because both describe the same event, with when-vs-how-many doing the
// distinguishing. Present-tense "needs" is ordinary English about what a
// program requires and is fine; "needed"/"needing" is what was standing in for
// a measurement.
console.log('\nconclusions cite the number that carries them')
check(
  'act 2 uses one verb for a request',
  groups.flatMap((g) => g.lines).filter((l) => /\bneed(ed|ing)\b/i.test(l)),
  [],
)
check(
  'a measurement is never said to score',
  act2Groups.flatMap((g) => g.lines).filter((l) => /\bnumber\b[^.]*\bscores?\b/i.test(l)),
  [],
)
// Screen 7's job is to make a comparison land, and a comparison lands on a
// number. The result group has to say what the winner was worth and what it
// beat, or the learner is left holding an aphorism.
{
  const said = act2.RESULT.join(' ')
  check('the result quotes the winning count', said.includes(String(levelTwo.scores.lru)), true)
  check('and what it beat', said.includes(String(levelTwo.scores.fifo)), true)
}

// -- the table ---------------------------------------------------------------
// All three rules, always, whichever one the learner tested. Two rows would
// leave the third as an untested rumour on a screen whose whole argument is
// that the three were compared fairly.
console.log('\nthe screen 7 table')
const ACRONYM = /\b(LRU|FIFO|LFU)\b/
for (const rule of ['lru', 'fifo', 'lfu'] as const) {
  const rows = act2.ruleRows(rule)
  check(`${rule}: all three rules are priced`, rows.map((r) => r.id), ['lru', 'fifo', 'lfu'])
  check(
    `${rule}: every row carries the oracle's number`,
    rows.map((r) => r.value),
    ['lru', 'fifo', 'lfu'].map((r) => levelTwo.scores[r as 'lru']),
  )
  // The table is read before the naming group opens, so it may not use a name
  // the learner has not been given yet.
  check(`${rule}: no acronym in the labels`, rows.filter((r) => ACRONYM.test(r.label)), [])
  check(`${rule}: the learner's own row is marked`, rows.filter((r) => r.label.includes('(yours)')).map((r) => r.id), [rule])
}

// The fork table is the evidence for the fork copy: it may not be drawn before
// the run that produced it is over, and it says what each page did next.
{
  const rows = act2.forkRows()
  check('the fork table lists the resident pages', rows.map((r) => r.label), fork.mem.map((p) => `page ${p}`))
  check(
    'and the page recency dropped is the one that never returns',
    rows.find((r) => r.label === `page ${fork.lru}`)!.value,
    'never returns',
  )
}

// -- the vocabulary rule -----------------------------------------------------
// What you just did has a name, and the name is X. Never the name first as a
// clue. Screen 5 offers four rules in the learner's own words, screen 6 runs
// one of them and screen 7 prices all three; only once those numbers have
// landed, and the fork has explained them, does the label arrive.
console.log('\na rule is named only after it has been played')
const beforeTheName = [
  ...act2.ASK_THE_RULE,
  ...act2.RULE_OPTIONS.map((o) => o.label),
  ...act2.RULE_OPTIONS.flatMap((o) => act2.ruleFeedback(o.id)),
  ...intro.lines,
  ...act2.ASK_THE_SIGNAL,
  ...act2.SIGNAL_OPTIONS.map((o) => o.label),
  ...act2.OFF_RULE,
  ...ambient.flat(),
  ...act2.RESULT,
  ...act2.FORK_COPY,
]
check('no acronym anywhere before the naming group', beforeTheName.filter((l) => ACRONYM.test(l)), [])

// Every learner leaves with all three names, whichever one they tested, and an
// acronym is only a name once the words behind it have been said: three
// capitals on their own are a thing to memorise. Level 2 printed all three
// measurements on every tile, so none of the three is a stranger by now.
const EXPANSION: [string, string][] = [
  ['LRU', 'least recently used'],
  ['FIFO', 'first in, first out'],
  ['LFU', 'least frequently used'],
]
{
  const said = act2.NAMING.join(' ')
  for (const [name, expansion] of EXPANSION) {
    check(`the learner meets ${name}`, said.includes(name), true)
    check(`${name} is spelled out`, said.toLowerCase().includes(expansion), true)
  }
  // Recency is named last and on its own line. It is the one the tape just
  // voted for, and the one act 5 spends two screens taking apart; the other two
  // arrive together as the rules it beat.
  const lru = said.indexOf('LRU')
  check(
    'recency is named last',
    [said.indexOf('FIFO'), said.indexOf('LFU')].every((i) => i < lru),
    true,
  )
  // And the generalisation is guarded in the same breath. A learner who leaves
  // act 3 believing recency wins by law has learned the thing screens 8 and 11
  // exist to undo.
  const general = act2.GENERALISE.join(' ')
  check('the win is generalised', /often|usually/i.test(general), true)
  check('and immediately bounded', /still a bet|not a guarantee/i.test(general), true)
}

// -- the promise from screen 4 -----------------------------------------------
console.log('\nthe fun fact, and the promise it comes with')
{
  const said = beatLines(floorBeat, aboveIt).join(' ')
  check('screen 4 says the floor out loud', said.includes(String(levelOne.scores.opt)), true)
  // Still `trips`. The counter learns the words "page fault" on the next beat.
  check('and in the word the counter still uses', /\btrips\b/.test(said), true)
  check('not the one it has not learned yet', /page fault/.test(said), false)
  // The promise is what screen 7 collects on. Without it the callback there is
  // a claim about a line the learner may never have registered.
  check('it promises to come back to it', /back of your mind|come back/i.test(said), true)
  // The end card is what they watched happen, and nothing else.
  check('the end card carries no claim', Object.keys(endCard(aboveIt)).sort(), ['credit', 'faults', 'requests'])
}

console.log('\nthe floor is a claim, not a row')
{
  const said = act2.THE_FLOOR.join(' ')
  check('it quotes the floor screen 4 promised', said.includes(String(levelOne.scores.opt)), true)
  check('collects the promise', /still owe you|back on level one/i.test(said), true)
  // It poses the question and stops. Answering it here would spend screen 8,
  // whose entire job is letting the learner construct that number themselves.
  check('asks where the number came from', /where did that number come from/i.test(said), true)
  check(
    'and does not answer its own question',
    /in advance|every request|whole tape|the future|because/i.test(said),
    false,
  )
}

// The tutor speaks the way someone would out loud to a room of teenagers, and
// nobody says an em dash out loud. Commas, full stops and the occasional
// exclamation mark carry the same joins without the written-essay register.
const dashed = groups.flatMap((b) => b.lines.filter((l) => l.includes('—')))
check('no em dashes in the voice', dashed, [])

// Groups whose ids share a prefix before ':' are mutually exclusive branches
// (the four answers to screen 5). A learner sees exactly one of them, so a term
// marked in each is still marked once for them. Only the first variant counts.
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
