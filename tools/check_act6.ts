import assert from 'node:assert/strict'
import { BELADY } from '../src/lib/levels.ts'
import { OPEN, PREDICTIONS, RESULT, canPredict, comparisonBoard, comparisonReducer,
  comparisonResults, initialComparison, ruleLabel } from '../src/lib/act6.ts'

// Neither timer ticks nor navigation may reveal the experiment before commitment.
for (const prediction of PREDICTIONS) {
  let state = initialComparison()
  assert.equal(comparisonReducer(state, { type: 'predict', id: prediction.id }), state)
  assert.equal(comparisonReducer(state, { type: 'tick' }), state)
  assert.equal(comparisonResults(state), null)
  while (!canPredict(state)) state = comparisonReducer(state, { type: 'next' })
  assert.equal(comparisonReducer(state, { type: 'next' }), state, 'no Continue past the question')
  assert.equal(comparisonReducer(state, { type: 'predict', id: 'unknown' }), state)
  state = comparisonReducer(state, { type: 'predict', id: prediction.id })
  assert.equal(state.step, 0, 'commitment starts with empty memories')
  assert.equal(comparisonReducer(state, { type: 'predict', id: 'same' }), state, 'prediction is locked')
  for (let step = 1; step <= BELADY.length; step++) {
    assert.equal(comparisonResults(state), null, 'final totals stay hidden during playback')
    state = comparisonReducer(state, { type: 'tick' })
    assert.equal(state.step, step)
    for (const size of ['small', 'big'] as const) {
      assert.deepEqual(comparisonBoard(state, size).frames, BELADY.runs.clock[size].steps[step - 1].frames)
      assert.equal(comparisonBoard(state, size).event?.page, BELADY.ref[step - 1])
    }
  }
  assert.equal(state.phase, 'result')
  assert.equal(state.prediction, prediction.id)
  assert.deepEqual(comparisonResults(state), [{ frames: 3, clock: 9, opt: null }, { frames: 4, clock: 10, opt: null }],
    'the Clock result gets its own beat before OPT appears')
  state = comparisonReducer(state, { type: 'next' })
  assert.ok(comparisonResults(state)?.every((row) => row.opt === null), 'explain why OPT is relevant before revealing its totals')
  state = comparisonReducer(state, { type: 'next' })
  assert.deepEqual(comparisonResults(state), [{ frames: 3, clock: 9, opt: 7 }, { frames: 4, clock: 10, opt: 6 }])
  state = comparisonReducer(state, { type: 'next' })
  assert.equal(state.line, RESULT.length - 1, 'close by returning to the two Clock runs')
  assert.equal(state.step, BELADY.length, 'narration does not restart the completed runs')
  assert.equal(comparisonBoard(state, 'small').faults, 9)
  assert.equal(comparisonBoard(state, 'big').faults, 10)
  assert.equal(comparisonReducer(state, { type: 'tick' }), state, 'timer stops at the last request')
}

// Reduced motion permits the same complete experiment without automatic advancement.
let manual = initialComparison(true)
assert.deepEqual(comparisonBoard(manual, 'big').frames, [null, null, null, null])
while (!canPredict(manual)) manual = comparisonReducer(manual, { type: 'next' })
manual = comparisonReducer(manual, { type: 'predict', id: 'fewer' })
assert.equal(comparisonReducer(manual, { type: 'tick' }), manual)
manual = comparisonReducer(manual, { type: 'step' })
assert.equal(manual.step, 1)
assert.equal(manual.paused, true)
manual = comparisonReducer(manual, { type: 'pause' })
manual = comparisonReducer(manual, { type: 'tick' })
assert.equal(manual.step, 2)
manual = comparisonReducer(manual, { type: 'step' })
assert.equal(manual.paused, true, 'manual stepping cancels autoplay')
while (manual.phase === 'run') manual = comparisonReducer(manual, { type: 'step' })
assert.equal(manual.step, BELADY.length)
assert.equal(ruleLabel(false), 'Clock, the rule you built')
assert.equal(ruleLabel(true), 'Clock, the rule you were building')
for (const line of [...OPEN, ...RESULT]) {
  assert.ok(line.length <= 190, `bubble too long: ${line}`)
  assert.ok(!line.includes('—'), 'no em dashes in the voice')
}
console.log('screen 11 prediction gate, synchronized traces, results and playback controls verified')
