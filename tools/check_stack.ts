import assert from 'node:assert/strict'
import { BELADY } from '../src/lib/levels.ts'
import { OPEN, QUESTION, OPTIONS, FEEDBACK, EXPLANATION, RESULT, BRIDGE, initialStack, stackReducer,
  stackBoard, stackCaption, stackStepLabel, stackLines, stackEvidence, stackResults, canReplayStack, residentPages, type StackState } from '../src/lib/stack.ts'

function begin(reduced = false) {
  let state = initialStack(reduced)
  for (let i = 0; i < OPEN.length; i++) state = stackReducer(state, { type: 'next' })
  assert.equal(state.phase, 'checking')
  return state
}

const initial = initialStack()
for (const action of [{ type: 'tick' }, { type: 'step' }, { type: 'pause' }, { type: 'replay' },
  ...OPTIONS.map((o) => ({ type: 'choose' as const, id: o.id }))] as const) {
  assert.equal(stackReducer(initial, action), initial, 'the introduction cannot be skipped')
}
assert.equal(stackEvidence(initial), null)
assert.equal(stackResults(initial), null)
assert.equal(canReplayStack(initial), false)
assert.deepEqual(stackBoard(initial, 'small').frames, [null, null, null])
assert.deepEqual(stackBoard(initial, 'big').frames, [null, null, null, null])
assert.deepEqual(stackBoard(initial, 'small').matchedPages, [])
assert.equal(stackCaption(initial), 'Both memories start empty.')

// Every check must match actual page identities, then count the completed state.
// Independently reconstruct the recency order from requests to validate the
// structure the explanation promises, beyond checking totals or inclusion alone.
let state = begin()
let recency: number[] = []
for (let step = 1; step <= BELADY.length; step++) {
  assert.equal(state.step, step)
  assert.equal(state.beat, 'before')
  assert.equal(state.matched, 0)
  assert.equal(state.checked, step - 1)
  assert.equal(stackEvidence(state)?.allMatched, false)
  assert.equal(stackStepLabel(state), 'Apply request')
  assert.equal(stackCaption(state), `Before request ${step} of 12: page ${BELADY.ref[step - 1]}`)
  assert.equal(stackResults(state), null)
  assert.equal(stackReducer(state, { type: 'choose', id: 'large-fault' }), state)
  assert.equal(stackReducer(state, { type: 'next' }), state, 'only playback controls advance a request')
  for (const size of ['small', 'big'] as const) {
    const run = BELADY.runs.lru[size]
    const event = run.steps[step - 1]
    const board = stackBoard(state, size)
    const before = run.steps[step - 2]?.frames ?? Array(run.frames).fill(null)
    assert.deepEqual(board.frames, before, 'show the outgoing page before changing residency')
    assert.equal(board.slot, event.slot)
    assert.equal(board.frames[board.slot!], event.outcome === 'hit' ? event.page : event.victim)
    assert.equal(board.slotLabel, event.outcome === 'hit' ? 'Here' : event.outcome === 'evict' ? 'Out' : 'Empty')
    assert.deepEqual(board.matchedPages, [], 'transition highlights must not look like page matches')
    assert.equal(board.focusPage, undefined)
    assert.equal(board.faults, undefined)
    assert.equal(board.caption, event.outcome === 'evict' ? `Out: ${event.victim} · In: ${event.page}`
      : event.outcome === 'fill' ? `Page ${event.page} enters an empty slot` : `Page ${event.page} already here · no replacement`)
  }
  // Concrete contrast: the same request replaces page 1 in three frames,
  // but uses an empty fourth frame in the larger memory.
  if (step === 4) {
    assert.equal(stackBoard(state, 'small').caption, 'Out: 1 · In: 4')
    assert.equal(stackBoard(state, 'small').frames[0], 1)
    assert.equal(stackBoard(state, 'big').caption, 'Page 4 enters an empty slot')
    assert.equal(stackBoard(state, 'big').frames[3], null)
  }
  state = stackReducer(state, { type: 'tick' })
  assert.equal(state.beat, 'after')
  assert.equal(state.checked, step - 1, 'serving the request is not a completed inclusion check')
  assert.equal(state.matched, 0)
  assert.equal(stackEvidence(state)?.allMatched, false)
  assert.equal(stackStepLabel(state), 'Compare pages')
  assert.equal(stackCaption(state), `After request ${step} of 12: page ${BELADY.ref[step - 1]}`)
  const page = BELADY.ref[step - 1]
  recency = [page, ...recency.filter((resident) => resident !== page)]
  for (const size of ['small', 'big'] as const) {
    const board = stackBoard(state, size)
    const recorded = BELADY.runs.lru[size].steps[step - 1]
    assert.deepEqual(board.frames, recorded.frames)
    assert.equal(board.frames[board.slot!], page, 'the arriving or already resident page is highlighted')
    assert.equal(board.slotLabel, recorded.outcome === 'hit' ? 'Here' : 'In')
    assert.equal(board.hit, recorded.outcome === 'hit')
    assert.deepEqual(board.matchedPages, [], 'give the arrival its own moment before matching')
    if (recorded.outcome === 'hit') assert.deepEqual(board.frames, BELADY.runs.lru[size].steps[step - 2].frames, 'a hit never changes the resident pages')
    assert.deepEqual(new Set(board.frames.filter((p) => p !== null)), new Set(recency.slice(0, board.frames.length)))
    for (const key of ['bits', 'hand', 'faults'] as const) {
      assert.equal(board[key], undefined, `${key} stays hidden during the replay`)
    }
  }
  const pages = residentPages(step)
  assert.equal(pages.length, Math.min(step, 3), 'empty slots are never matched')
  for (let matched = 1; matched <= pages.length; matched++) {
    assert.equal(stackReducer(state, { type: 'choose', id: 'large-fault' }), state, 'finish all twelve states before asking')
    assert.equal(stackReducer(state, { type: 'next' }), state, 'no generic Continue skips checks')
    state = stackReducer(state, { type: 'tick' })
    assert.equal(state.beat, 'match')
    const evidence = stackEvidence(state)!
    assert.equal(evidence.allMatched, matched === pages.length)
    assert.equal(evidence.checked, matched === pages.length ? step : step - 1)
    for (const size of ['small', 'big'] as const) {
      const board = stackBoard(state, size)
      assert.deepEqual(board.matchedPages, pages.slice(0, matched))
      assert.equal(board.focusPage, pages[matched - 1])
      assert.ok(board.frames.includes(board.focusPage!))
      assert.equal(board.slot, undefined, 'the replacement highlight clears before the matches')
      assert.equal(board.slotLabel, undefined)
      assert.equal(board.hit, undefined)
    }
    assert.equal(evidence.match, `Page ${pages[matched - 1]} is in both memories.`, 'the match is also communicated in text')
    assert.equal(stackResults(state), null)
    assert.ok(!stackLines(state).join(' ').includes('stack property'))
  }
  assert.equal(stackStepLabel(state), step < 12 ? 'Next request' : 'Answer the question')
  state = stackReducer(state, { type: 'tick' })
}
assert.equal(state.phase, 'question')
assert.equal(state.checked, 12)
assert.equal(stackEvidence(state)?.complete, true)
assert.equal(stackResults(state), null)
assert.equal(stackReducer(state, { type: 'next' }), state, 'the inference requires an answer')
assert.equal(stackReducer(state, { type: 'choose', id: 'unknown' }), state)
assert.equal(stackReducer(state, { type: 'tick' }), state, 'autoplay stops for the question')
const question = state

// Incorrect choices explain actual counterexamples and return to the same
// evidence. They cannot reveal the proof or the scores, or complete the screen.
for (const id of ['both-fault', 'small-fault']) {
  const wrong = stackReducer(question, { type: 'choose', id })
  assert.equal(wrong.phase, 'feedback')
  assert.equal(wrong.chosen, id)
  assert.deepEqual(stackLines(wrong), FEEDBACK[id])
  assert.equal(stackResults(wrong), null)
  assert.equal(wrong.step, 12)
  assert.equal(wrong.checked, 12)
  assert.equal(stackReducer(wrong, { type: 'choose', id: 'large-fault' }), wrong, 'read feedback before retrying')
  const retry = stackReducer(wrong, { type: 'next' })
  assert.deepEqual(retry, question)
}
for (const size of ['small', 'big'] as const) assert.notEqual(BELADY.runs.lru[size].steps[0].outcome, 'hit')
assert.equal(BELADY.runs.lru.small.steps[4].page, 1)
assert.notEqual(BELADY.runs.lru.small.steps[4].outcome, 'hit')
assert.equal(BELADY.runs.lru.big.steps[4].outcome, 'hit')
assert.ok(BELADY.runs.lru.small.steps.every((small, i) => small.outcome !== 'hit' || BELADY.runs.lru.big.steps[i].outcome === 'hit'))

state = stackReducer(question, { type: 'choose', id: 'large-fault' })
assert.equal(state.phase, 'explain')
assert.equal(state.chosen, 'large-fault')
assert.equal(canReplayStack(state), false, 'the earned explanation stays in sequence')
for (let line = 0; line < EXPLANATION.length; line++) {
  assert.equal(stackResults(state), null, 'totals wait until after the general argument and its name')
  assert.equal(state.line, line)
  state = stackReducer(state, { type: 'next' })
}
assert.equal(state.phase, 'result')
assert.deepEqual(stackResults(state), [{ frames: 3, lru: 10, opt: 7 }, { frames: 4, lru: 8, opt: 6 }])
assert.equal(BELADY.runs.clock.small.faults, 9, 'the caveat compares to the observed Clock score')
for (let line = 0; line < RESULT.length; line++) state = stackReducer(state, { type: 'next' })
assert.equal(state.phase, 'bridge')
assert.deepEqual(stackLines(state), BRIDGE)
assert.equal(state.checked, 12)
assert.equal(stackReducer(state, { type: 'next' }), state)

// Pause, one-step advance and replay do not silently skip a transition or match.
let paused = stackReducer(begin(), { type: 'pause' })
assert.equal(stackReducer(paused, { type: 'tick' }), paused)
paused = stackReducer(paused, { type: 'step' })
assert.equal(paused.beat, 'after')
assert.equal(paused.matched, 0)
assert.equal(paused.checked, 0)
assert.equal(paused.paused, true)
assert.equal(stackReducer(paused, { type: 'tick' }), paused)
paused = stackReducer(paused, { type: 'pause' })
paused = stackReducer(paused, { type: 'step' })
assert.equal(paused.matched, 1)
assert.equal(paused.checked, 1)
assert.equal(paused.paused, true, 'manual stepping cancels autoplay')
paused = stackReducer(paused, { type: 'pause' })
assert.equal(stackReducer(paused, { type: 'tick' }).step, 2)
for (const earlier of [begin(), stackReducer(begin(), { type: 'tick' }), paused, question]) {
  const replay = stackReducer(earlier, { type: 'replay' })
  assert.deepEqual(replay, begin())
  assert.equal(stackReducer(replay, { type: 'choose', id: 'large-fault' }), replay)
}

// Reduced motion has no autoplay path, even after pause or replay actions.
let manual: StackState = begin(true)
let actions = 0
while (manual.phase === 'checking') {
  assert.equal(stackReducer(manual, { type: 'tick' }), manual)
  assert.equal(stackReducer(manual, { type: 'pause' }), manual)
  manual = stackReducer(manual, { type: 'step' })
  assert.equal(manual.paused, true)
  assert.ok(++actions <= BELADY.length * 5, 'manual playback must finish')
}
assert.equal(manual.phase, 'question')
assert.equal(manual.checked, 12)
assert.deepEqual(stackReducer(manual, { type: 'replay' }), begin(true))

// A damaged trace must not earn a false "all matched" result.
const firstBig = BELADY.runs.lru.big.steps[0]
const original = firstBig.frames
try {
  firstBig.frames = [999, null, null, null]
  const arrived = stackReducer(begin(), { type: 'tick' })
  assert.throws(() => stackReducer(arrived, { type: 'tick' }), /missing page 1/)
} finally {
  firstBig.frames = original
}
for (const line of [...OPEN, ...QUESTION, ...Object.values(FEEDBACK).flat(), ...EXPLANATION, ...RESULT, ...BRIDGE]) {
  assert.ok(line.length <= 190, `long bubble (${line.length}): ${line}`)
  assert.ok(!line.includes('—'))
}
console.log('screen 13: recorded departures, arrivals and hits precede all twelve page comparisons; inference gates, retries, delayed scores, replay and reduced motion verified')
