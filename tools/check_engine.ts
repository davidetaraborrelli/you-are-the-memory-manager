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
import * as act3 from '../src/lib/act3.ts'
import {
  learnerCommitted,
  machineGate,
  resetMachine,
  tellRuleBroken,
} from '../src/lib/machine.ts'
import type { Game } from '../src/lib/game.ts'
import type { ClockStep, LevelData, Step } from '../src/lib/types.ts'
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

/**
 * Every transition of a trace, checked against the one before it.
 *
 * `replay` above reads exactly one field, `slot`, and compares the totals that
 * come out. That is a real check of the engine and none at all of the trace: a
 * committed levels.json whose intermediate `page`, `victim`, `frames` or `bits`
 * had been edited passed it unchanged. `npm run test:gen` now catches that by
 * rebuilding the file from the generator; this catches it a second way, and a
 * different way, because the two fail for different reasons. test:gen says the
 * bytes are not what Python produces. This says the record does not describe a
 * memory that could exist.
 *
 * Deliberately policy-agnostic. The front end never re-implements FIFO, LRU,
 * clock or OPT and neither does its test suite: the oracle owns *which* page
 * leaves, this owns whether the record of it is coherent. A step's frames have
 * to follow from the step before plus what the step says it did, and nothing
 * here needs to know why the victim was chosen.
 *
 * Screen 12 is why it exists. Its whole argument is a sequence of intermediate
 * states, so an unverified intermediate state there is a false claim made in
 * front of the learner. Clock's recorded inspections get an additional check
 * below: apply each supplied event, without searching for a victim ourselves.
 */
function traceViolations(ref: number[], frameCount: number, steps: Step[], policy: string): string[] {
  const bad: string[] = []
  const say = (i: number, msg: string) => bad.push(`step ${i + 1}: ${msg}`)

  if (steps.length !== ref.length) bad.push(`${steps.length} steps for ${ref.length} requests`)

  let prev: (number | null)[] = Array(frameCount).fill(null)
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.step !== i + 1) say(i, `numbered ${s.step}`)
    if (s.page !== ref[i]) say(i, `page ${s.page}, but the tape asks for ${ref[i]}`)

    if (s.frames.length !== frameCount) {
      say(i, `${s.frames.length} frames, not ${frameCount}`)
      prev = s.frames
      continue
    }
    if (!Number.isInteger(s.slot) || s.slot < 0 || s.slot >= frameCount) {
      say(i, `slot ${s.slot} is outside the memory`)
      prev = s.frames
      continue
    }

    if (s.frames[s.slot] !== s.page) say(i, `page ${s.page} is not in slot ${s.slot} afterwards`)
    for (let f = 0; f < frameCount; f++) {
      if (f !== s.slot && s.frames[f] !== prev[f]) {
        say(i, `slot ${f} changed, but this step touched slot ${s.slot}`)
      }
    }

    if (s.outcome === 'hit') {
      if (prev[s.slot] !== s.page) say(i, `hit on ${s.page}, but slot ${s.slot} held ${prev[s.slot]}`)
      if (s.victim !== null) say(i, `a hit cannot have victim ${s.victim}`)
    } else if (s.outcome === 'fill') {
      if (prev[s.slot] !== null) say(i, `filled slot ${s.slot}, which held ${prev[s.slot]}`)
      if (s.victim !== null) say(i, `a fill cannot have victim ${s.victim}`)
      if (prev.includes(s.page)) say(i, `filled page ${s.page}, which was already resident`)
    } else if (s.outcome === 'evict') {
      if (prev[s.slot] === null) say(i, `evicted from slot ${s.slot}, which was empty`)
      else if (s.victim !== prev[s.slot]) say(i, `victim ${s.victim}, but slot ${s.slot} held ${prev[s.slot]}`)
      if (prev.includes(null)) say(i, 'evicted before memory was full')
      if (prev.includes(s.page)) say(i, `evicted for page ${s.page}, which was already resident`)
    } else {
      say(i, `unknown outcome ${s.outcome}`)
    }

    if (s.bits) {
      if (s.bits.length !== frameCount) say(i, `${s.bits.length} bits for ${frameCount} frames`)
      if (s.bits.some((b) => b !== 0 && b !== 1)) say(i, `bits ${JSON.stringify(s.bits)}`)
    }

    prev = s.frames
  }
  return policy === 'clock' ? [...bad, ...clockTraceViolations(frameCount, steps)] : bad
}

/** Validate Clock's supplied scan events; this never computes a scan path. */
function clockTraceViolations(frameCount: number, steps: Step[]): string[] {
  const bad: string[] = []
  const slotInMemory = (slot: unknown): slot is number =>
    typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < frameCount
  let frames: (number | null)[] = Array(frameCount).fill(null)
  let bits: number[] = Array(frameCount).fill(0)
  let hand = 0

  for (let i = 0; i < steps.length; i++) {
    // levels.json crosses a runtime boundary. Clock fields are required even
    // when somebody removes all of them and leaves an otherwise valid Step.
    const s: Partial<ClockStep> & Step = steps[i]
    const say = (msg: string) => bad.push(`step ${i + 1}: clock ${msg}`)
    const validBits = Array.isArray(s.bits) && s.bits.length === frameCount &&
      s.bits.every((bit) => bit === 0 || bit === 1)
    const validBefore = slotInMemory(s.handBefore)
    const validAfter = slotInMemory(s.handAfter)
    const validScan = Array.isArray(s.scanned) && s.scanned.every(slotInMemory)
    if (!validBits) say('requires one binary bit per frame')
    if (!validBefore) say('requires handBefore to be a slot in memory')
    if (!validAfter) say('requires handAfter to be a slot in memory')
    if (!validScan) say('requires scanned to be an array of slots in memory')

    if (validBefore && s.handBefore !== hand) say(`handBefore ${s.handBefore} does not continue hand ${hand}`)
    const afterBits = [...bits]
    if (s.outcome === 'hit' || s.outcome === 'fill') {
      if (validScan && s.scanned!.length !== 0) say(`${s.outcome} must not scan`)
      if (validBefore && validAfter && s.handBefore !== s.handAfter) say(`${s.outcome} moved the hand`)
      if (s.outcome === 'fill' && s.slot !== frames.indexOf(null)) say('fill must use the first empty slot')
    } else if (s.outcome === 'evict') {
      if (validScan) {
        const scanned = s.scanned!
        if (scanned.length === 0) say('eviction has no victim inspection')
        if (scanned.length > frameCount + 1) say('scan exceeds one full pass plus the victim')
        for (let j = 0; j < scanned.length; j++) {
          const slot = scanned[j]
          if (j === 0 && validBefore && slot !== s.handBefore) say('scan does not start at handBefore')
          if (j > 0 && slot !== (scanned[j - 1] + 1) % frameCount) say('scan skips or reverses a slot')
          if (j === scanned.length - 1) {
            if (afterBits[slot] !== 0) say('final inspection must find a zero bit')
            if (slot !== s.slot) say('final inspection does not identify the victim slot')
          } else {
            if (afterBits[slot] !== 1) say('scan continued past a zero bit')
            afterBits[slot] = 0
          }
        }
      }
      if (validAfter && s.handAfter !== (s.slot + 1) % frameCount) say('handAfter is not after the victim')
    }

    if (slotInMemory(s.slot)) afterBits[s.slot] = 1
    if (validBits && JSON.stringify(s.bits) !== JSON.stringify(afterBits)) say('bits do not follow the inspections and request')
    // Use the recorded end state as the next record's starting state, just as
    // the generic residency check does. A bad event is already reported above.
    if (validBits) bits = s.bits!
    if (validAfter) hand = s.handAfter!
    frames = s.frames
  }
  return bad
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

console.log('\nevery transition of every trace')
for (const key of ['l1', 'l2', 'l3'] as const) {
  const lvl = data.levels[key]
  for (const [policy, steps] of Object.entries(lvl.traces)) {
    check(`${key} ${policy} is coherent step by step`, traceViolations(lvl.ref, lvl.frames, steps, policy), [])
  }
}
for (const policy of ['clock', 'lru', 'fifo', 'opt'] as const) {
  const run = data.belady.runs[policy]
  for (const size of ['small', 'big'] as const) {
    check(
      `belady ${policy} @${run[size].frames} is coherent step by step`,
      traceViolations(data.belady.ref, run[size].frames, run[size].steps, policy),
      [],
    )
  }
}

console.log('\nclock events remain checked when the fault total is unchanged')
{
  // Explicit events exercise fills, all-ones wraparound, a hit restoring a
  // cleared bit, immediate zero-bit eviction, and a shorter mixed-bit scan.
  const ref = [1, 2, 3, 4, 3, 5, 6, 4, 7]
  const steps: ClockStep[] = [
    { step: 1, page: 1, outcome: 'fill', slot: 0, victim: null, frames: [1, null, null], bits: [1, 0, 0], handBefore: 0, scanned: [], handAfter: 0 },
    { step: 2, page: 2, outcome: 'fill', slot: 1, victim: null, frames: [1, 2, null], bits: [1, 1, 0], handBefore: 0, scanned: [], handAfter: 0 },
    { step: 3, page: 3, outcome: 'fill', slot: 2, victim: null, frames: [1, 2, 3], bits: [1, 1, 1], handBefore: 0, scanned: [], handAfter: 0 },
    { step: 4, page: 4, outcome: 'evict', slot: 0, victim: 1, frames: [4, 2, 3], bits: [1, 0, 0], handBefore: 0, scanned: [0, 1, 2, 0], handAfter: 1 },
    { step: 5, page: 3, outcome: 'hit', slot: 2, victim: null, frames: [4, 2, 3], bits: [1, 0, 1], handBefore: 1, scanned: [], handAfter: 1 },
    { step: 6, page: 5, outcome: 'evict', slot: 1, victim: 2, frames: [4, 5, 3], bits: [1, 1, 1], handBefore: 1, scanned: [1], handAfter: 2 },
    { step: 7, page: 6, outcome: 'evict', slot: 2, victim: 3, frames: [4, 5, 6], bits: [0, 0, 1], handBefore: 2, scanned: [2, 0, 1, 2], handAfter: 0 },
    { step: 8, page: 4, outcome: 'hit', slot: 0, victim: null, frames: [4, 5, 6], bits: [1, 0, 1], handBefore: 0, scanned: [], handAfter: 0 },
    { step: 9, page: 7, outcome: 'evict', slot: 1, victim: 5, frames: [4, 7, 6], bits: [0, 1, 1], handBefore: 0, scanned: [0, 1], handAfter: 2 },
  ]
  check('the complete event fixture is coherent', traceViolations(ref, 3, steps, 'clock'), [])

  const corruptions: [string, (trace: ClockStep[]) => void][] = [
    ['a reset hand', (trace) => { trace[4].handBefore = 0; trace[4].handAfter = 0 }],
    ['a hand that stays on the victim', (trace) => { trace[3].handAfter = 0 }],
    ['an out-of-range hand', (trace) => { trace[0].handBefore = 3 }],
    ['a fractional scan slot', (trace) => { trace[3].scanned[1] = 0.5 }],
    ['a scan that skips a slot', (trace) => { trace[3].scanned = [0, 2, 1, 0] }],
    ['a scan that starts away from the hand', (trace) => { trace[3].scanned = [1, 2, 0] }],
    ['a scan without the final victim inspection', (trace) => { trace[3].scanned.pop() }],
    ['a scan that continues past zero', (trace) => { trace[5].scanned = [1, 2, 0, 1] }],
    ['an inspection on a hit', (trace) => { trace[4].scanned = [1] }],
    ['a hit that fails to restore its bit', (trace) => { trace[4].bits[2] = 0 }],
    ['a skipped bit that was not cleared', (trace) => { trace[3].bits[1] = 1 }],
    ['an uninspected bit that was cleared', (trace) => { trace[8].bits[2] = 0 }],
    ['a frame changed outside the victim slot', (trace) => { trace[3].frames[1] = 9 }],
    ['an eviction with empty memory', (trace) => { trace[0].outcome = 'evict' }],
    ...(['bits', 'handBefore', 'scanned', 'handAfter'] as const).map((field): [string, (trace: ClockStep[]) => void] => [
      `missing ${field}`,
      (trace) => { delete (trace[3] as Partial<ClockStep>)[field] },
    ]),
  ]
  const faults = steps.filter((s) => s.outcome !== 'hit').length
  const accepted: string[] = []
  const changedTotals: string[] = []
  for (const [name, corrupt] of corruptions) {
    const changed = structuredClone(steps)
    corrupt(changed)
    if (traceViolations(ref, 3, changed, 'clock').length === 0) accepted.push(name)
    if (replay(ref, 3, changed).faults !== faults) changedTotals.push(name)
  }
  check('every corrupt event trace is rejected', accepted, [])
  check('fault totals alone would accept every corruption', changedTotals, [])
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

// -- screen 8's face-up replay ----------------------------------------------
// The screen enforces a right answer, which it may only do because the tape is
// open and every refusal can quote a fact off it. Two things therefore have to
// hold: the enforced run really is the floor, and no refusal ever hands over
// the page it is refusing.

console.log('\nthe face-up replay')
{
  let g = createGame(levelOne.ref, levelOne.frames)
  const forks: number[] = []
  while (!isDone(g)) {
    g = advance(g)
    if (!g.awaiting) continue
    if (g.awaiting.mode === 'fill') {
      // The screen resolves these itself: every empty slot is the same slot.
      g = resolve(g, g.frames.indexOf(null))
      continue
    }
    const d = act3.decisionAt(g.awaiting.step)
    check(`step ${g.awaiting.step} is a fork the screen knows`, d !== null, true)
    forks.push(g.awaiting.step)
    g = resolve(g, g.frames.indexOf(d!.victim))
  }
  // Playing only the taps the screen accepts has to land on the number screen 4
  // promised. If it did not, the screen would be enforcing a rule that never
  // reaches the floor it then claims to have proved.
  check('the two forks are the ones sim.py found', forks, levelOne.decisions.map((d) => d.step))
  check('and playing them scores the floor', g.faults, levelOne.scores.opt)
  check('which is the number screen 4 promised', g.faults, levelOne.floor.achieved)
}

console.log('\na refusal quotes the tape, never the answer')
for (const d of levelOne.decisions) {
  for (const page of d.mem) {
    const said = act3.verdict(d, page).join(' ')
    const next = d.nextUse[String(page)]
    if (page === d.victim) {
      // The confirmation is the argument, so it carries the evidence: every
      // page's next use, or the fact that this one has none.
      check(
        `fork ${d.step}: the confirmation shows its working`,
        next === null
          ? /never/.test(said)
          : d.mem.every((m) => said.includes(String(d.nextUse[String(m)]))),
        true,
      )
      continue
    }
    // A refusal prices the tap: the step that page comes back on, or the
    // stronger form of it when the page is the very next request.
    check(
      `fork ${d.step}: refusing ${page} prices it`,
      next === d.step + 1 ? /very next request/.test(said) : said.includes(String(next)),
      true,
    )
    // And never names the page that would have executed. A refusal that leaks
    // the answer turns two decisions into two taps.
    check(
      `fork ${d.step}: refusing ${page} does not name page ${d.victim}`,
      new RegExp(`\\b${d.victim}\\b`).test(said),
      false,
    )
  }
  // Nor does the prompt. The voice says everything except which page to drop.
  check(
    `fork ${d.step}: the prompt does not name page ${d.victim}`,
    new RegExp(`\\b${d.victim}\\b`).test(act3.askAt(d).join(' ')),
    false,
  )
}
// A refused tap is not scored and not marked, so it is not called wrong either.
check(
  'and nothing is called wrong',
  levelOne.decisions
    .flatMap((d) => d.mem.flatMap((p) => act3.verdict(d, p)))
    .filter((l) => /wrong|incorrect|mistake/i.test(l)),
  [],
)

console.log('\nthe floor is proved, not asserted')
{
  const fl = levelOne.floor
  check(
    'the bound is the score the learner reaches',
    [fl.atLeast, fl.achieved],
    [levelOne.scores.opt, levelOne.scores.opt],
  )
  const said = act3.PROOF.lines.join(' ')
  check('the proof quotes the faults nobody can avoid', said.includes(String(fl.unavoidable)), true)
  check('and the request that forces one more', said.includes(`page ${fl.forcedRequest}`), true)
  // Derived here rather than read back from the field the copy uses, so this is
  // a second opinion about which cells the line is pointing at.
  const firstAppearance = [...new Set(levelOne.ref)]
    .map((p) => levelOne.ref.indexOf(p) + 1)
    .sort((a, b) => a - b)
  check('the first mark is every first appearance', act3.proofMarks(0), firstAppearance)
  check('the second is the step memory fills', act3.proofMarks(1), [fl.forcedStep])
  // The card ends with the learner's own count beside the bound. Passing the
  // floor in for both would make the two meeting a foregone conclusion.
  const rows = act3.proofRows(2, levelOne.scores.opt)
  check(
    'the card ends on the run beside the floor',
    rows.map((r) => r.value),
    [levelOne.scores.opt, fl.atLeast],
  )
  // And says each number once. The rows above it already add up to the bound,
  // so a third row restating the total is the same 5 under a third name.
  check('and says each number once', rows.map((r) => r.label), ['your run', 'floor'])
  check('and it is the floor that is marked', rows.filter((r) => 'emphasis' in r && r.emphasis).map((r) => r.id), [
    'floor',
  ])
  check(
    'the run is quoted at the count it reached',
    act3.WHOLE_TAPE.lines.join(' ').includes(String(levelOne.scores.opt)),
    true,
  )
}

console.log('\nOPT is named after it has been played, and priced after that')
{
  const beforeTheName = [
    ...act3.OPEN.lines,
    ...levelOne.decisions.flatMap((d) => [
      ...act3.askAt(d),
      ...d.mem.flatMap((p) => act3.verdict(d, p)),
    ]),
    ...act3.WHOLE_TAPE.lines,
    ...act3.PROOF.lines,
  ]
  check('no name before the work that earns it', beforeTheName.filter((l) => /\bOPT\b/.test(l)), [])
  check('and it arrives spelled out', /optimal page replacement/i.test(act3.EXTRACT.lines.join(' ')), true)
  // Exactly one option is about information rather than cost, and the two that
  // are about cost are redirected at the same wall rather than marked wrong.
  check('the answer is the information option', act3.whyFeedback('future')[0].startsWith('Exactly'), true)
  for (const id of ['time', 'memory']) {
    check(`${id} is redirected, not scored`, /cost problem/.test(act3.whyFeedback(id)[0]), true)
  }
  // Beat 6 re-prices level 2 against the ruler the learner has just built.
  const rows = act3.rulerRows()
  check(
    'the ruler table carries the oracle',
    rows.map((r) => r.value),
    [levelTwo.scores.lru, levelTwo.scores.opt],
  )
  check(
    'and the gap the voice quotes is the one in the table',
    act3.MEASURED.join(' ').includes(String(levelTwo.scores.lru - levelTwo.scores.opt)),
    true,
  )
  // Level 2's floor is demonstrated, not asserted. The machine replays that tape
  // as OPT from the oracle's own trace while the learner watches the counter, so
  // what the counter reaches has to be the number the voice then says out loud.
  // Quoting a 6 the learner never saw arrive would be, one beat after teaching
  // them to demand a proof, the move the whole screen exists to take apart.
  {
    const shown = replay(levelTwo.ref, levelTwo.frames, levelTwo.traces.opt!)
    check('the level two demonstration reaches its floor', shown.faults, levelTwo.scores.opt)
    check(
      'and the voice quotes what the counter reached',
      act3.MEASURED.join(' ').includes(String(levelTwo.scores.opt)),
      true,
    )
  }
  // These are level 2's numbers under level 1's finished board, and the learner
  // has just proved a floor of 5 on the strip above them. An unlabelled 6 there
  // reads as a correction of the proof instead of as another tape, so the table
  // names its run and so does the sentence beside it.
  check('the ruler table names the tape it prices', /level two/i.test(act3.RULER_CAPTION), true)
  check('and so does the voice', /level two/i.test(act3.CATEGORY.join(' ')), true)
  // And says so before it uses the numbers, or the table has already changed
  // tape by the time the learner is told there was another tape.
  const beat6 = [...act3.CATEGORY, ...act3.MEASURED]
  const gap = String(levelTwo.scores.lru - levelTwo.scores.opt)
  const announced = beat6.findIndex((l) => /level two/i.test(l))
  const used = beat6.findIndex((l) => l.includes(gap))
  check('the change of tape is announced before it is used', announced >= 0 && announced < used, true)
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

// Screen 8's voice is written the same way: plain arrays read one bubble at a
// time, plus one branch per answer to the question that closes beat 5.
const act3Groups: { id: string; lines: string[]; focus?: unknown[] }[] = [
  { id: 'open', lines: act3.OPEN.lines, focus: act3.OPEN.focus },
  { id: 'whole-tape', lines: act3.WHOLE_TAPE.lines, focus: act3.WHOLE_TAPE.focus },
  { id: 'proof', lines: act3.PROOF.lines, focus: act3.PROOF.focus },
  { id: 'extract', lines: act3.EXTRACT.lines, focus: act3.EXTRACT.focus },
  { id: 'why-not', lines: act3.WHY_NOT },
  ...act3.WHY_OPTIONS.map((o) => ({ id: `why:${o.id}`, lines: act3.whyFeedback(o.id) })),
  { id: 'category', lines: act3.CATEGORY },
  { id: 'measured', lines: act3.MEASURED },
  { id: 'the-price', lines: act3.BRIDGE },
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
  ...act3Groups,
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

/** Screen 8's prompt at a fork. Silent everywhere else, like the others. */
function faceUp(g: Game): string[] | null {
  if (g.awaiting?.mode !== 'evict') return null
  const d = act3.decisionAt(g.awaiting.step)
  return d ? act3.askAt(d) : null
}

const ambient = [
  ...ambientGroups(levelOne.ref, levelOne.frames, levelOne.traces.lru!, ambientFor),
  ...ambientGroups(levelOne.ref, levelOne.frames, levelOne.traces.fifo!, ambientFor),
  ...ambientGroups(levelTwo.ref, levelTwo.frames, levelTwo.traces.lru!, act2.ambientL2),
  ...ambientGroups(levelTwo.ref, levelTwo.frames, levelTwo.traces.fifo!, act2.ambientL2),
  // Screen 8 speaks beside a decision twice, and answers every tap at both.
  ...ambientGroups(levelOne.ref, levelOne.frames, levelOne.traces.opt!, faceUp),
  ...levelOne.decisions.flatMap((d) => d.mem.map((p) => act3.verdict(d, p))),
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

// -- the tell rule ----------------------------------------------------------
// The machine's face may only react to something the learner has already done.
// The check lives in setMachineState as a development warning, which means it
// is never exercised by anything that runs in CI, which is how it managed to
// stop enforcing without anyone noticing: the commit flag was cleared only when
// an act mounted, and acts hold several screens, so the first commit of an act
// armed the rule for every screen after it.
//
// tellRuleBroken is that condition, exported so it can be asserted here. These
// are the module's semantics, not the components': whether a real screen ever
// trips it is a question for the dev server. What this pins is that the rule
// is capable of tripping at all, once per gate, which is what stopped being
// true.

console.log('\nthe tell rule is per gate, not per act')
{
  resetMachine()
  machineGate('screen:1')
  check('a face before any commit breaks the rule', tellRuleBroken('approval'), true)
  check('neutral never breaks it', tellRuleBroken('neutral'), false)

  learnerCommitted()
  check('and after a commit it does not', tellRuleBroken('approval'), false)

  // The regression. Before machineGate existed this stayed false for the rest
  // of the act, so every later screen could set any face it liked in silence.
  machineGate('screen:2')
  check('a new screen disarms it again', tellRuleBroken('approval'), true)

  learnerCommitted()
  machineGate('screen:2')
  check('re-opening the same gate is a no-op', tellRuleBroken('approval'), false)

  // Act 1's shape, which is the one that has to stay lenient: the learner
  // commits on one screen, and the beat that fires afterwards opens the next
  // one. Effects run in declaration order and the gate is declared last, so
  // that beat's face is still judged against the screen the commit happened
  // on. Approving a decision the learner has already made is not a tell.
  resetMachine()
  machineGate('act1:2')
  learnerCommitted()
  check('a beat that closes a screen may still show a face', tellRuleBroken('approval'), false)
  machineGate('act1:3')
  check('but the screen it opens starts disarmed', tellRuleBroken('approval'), true)

  resetMachine()
  check('and resetMachine still clears everything', tellRuleBroken('approval'), true)
}

console.log(failures === 0 ? '\nengine agrees with the oracle' : `\n${failures} disagreement(s)`)
process.exit(failures === 0 ? 0 : 1)
