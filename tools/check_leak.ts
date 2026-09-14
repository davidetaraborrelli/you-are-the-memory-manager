import assert from 'node:assert/strict'
import { BELADY } from '../src/lib/levels.ts'
import { SEARCH, FOUND, EXPLANATIONS, SUMMARY, BRIDGE, DIFFERENCES, initialLeak, leakReducer,
  leakBoard, leakLines, replayRequest, searchEnabled, canReplay, type LeakState } from '../src/lib/leak.ts'

function read(state: LeakState) {
  while (state.line < leakLines(state).length - 1) state = leakReducer(state, { type: 'next' })
  return state
}
let state = initialLeak(true)
assert.equal(state.step, 1)
for (const action of [{ type: 'select', step: 7 }, { type: 'choose', page: 1 }, { type: 'tick' }, { type: 'replay' }] as const) {
  assert.equal(leakReducer(state, action), state, 'no action bypasses the opening or reveals the explanation')
}
state = read(state)
assert.ok(searchEnabled(state))
assert.equal(leakReducer(state, { type: 'next' }), state, 'no Continue skips the puzzle')
// Exhaustively inspect every legal answer; exploration is never a commitment.
for (let step = 1; step <= BELADY.length; step++) {
  const selected = leakReducer(state, { type: 'select', step })
  assert.equal(selected.answer, null)
  for (const size of ['small', 'big'] as const) {
    assert.deepEqual(leakBoard(selected, size), { frames: BELADY.runs.clock[size].steps[step - 1].frames }, 'no bits, hands, counters, captions or highlights leak into the search')
  }
  for (const page of BELADY.runs.clock.small.steps[step - 1].frames) {
    if (page === null) continue
    const answer = leakReducer(selected, { type: 'choose', page })
    assert.equal(answer.step, step)
    const accepted = step === 7 && page === 1
    assert.equal(answer.phase, accepted ? 'found' : 'search')
    if (accepted) assert.deepEqual(answer.answer, { step: 7, page: 1 })
    else {
      assert.equal(answer.answer, null)
      assert.ok(answer.error?.includes(BELADY.runs.clock.big.steps[step - 1].frames.includes(page) ? 'still in both' : 'not the first'))
      assert.deepEqual(leakBoard(answer, 'small'), leakBoard(selected, 'small'))
      assert.equal(leakReducer(answer, { type: 'select', step: step === 12 ? 1 : step + 1 }).error, null)
    }
  }
}
state = leakReducer(state, { type: 'select', step: 7 })
state = leakReducer(state, { type: 'choose', page: 1 })
assert.equal(leakBoard(state, 'small').focusPage, 1)
assert.equal(leakBoard(state, 'small').bits, undefined)
assert.equal(leakReducer(state, { type: 'select', step: 8 }), state, 'correct answer locks both rows')
state = leakReducer(read(state), { type: 'next' })
assert.equal(state.phase, 'ready')
assert.equal(state.step, 3)
assert.deepEqual(leakBoard(state, 'small').frames, [1, 2, 3])
assert.deepEqual(leakBoard(state, 'big').frames, [1, 2, 3, null])
assert.equal(leakBoard(state, 'big').hand, 0)

for (let step = 4; step <= 8; step++) {
  state = leakReducer(state, { type: 'next' })
  assert.equal(state.phase, 'play')
  assert.equal(state.step, step)
  assert.equal(leakReducer(state, { type: 'tick' }), state, 'reduced motion waits for the learner')
  const frames = replayRequest(step)
  for (const size of ['small', 'big'] as const) {
    const event = BELADY.runs.clock[size].steps[step - 1]
    const before = BELADY.runs.clock[size].steps[step - 2]
    // Remove only repeated padding at the end; repeated scan slots remain distinct.
    const actions = frames.map((pair) => pair[size]).filter((frame, i, all) => i === 0 || frame !== all[i - 1])
    assert.deepEqual(actions[0].frames, before.frames)
    assert.deepEqual(actions[0].bits, before.bits)
    assert.equal(actions[0].hand, event.handBefore)
    assert.deepEqual(actions.filter((f) => f.kind === 'inspect').map((f) => f.slot), event.scanned)
    for (let i = 1; i < actions.length; i++) {
      const frame = actions[i], prior = actions[i - 1]
      if (frame.kind === 'write') {
        const expected = [...prior.bits]; expected[frame.slot!] = 0
        assert.deepEqual(frame.bits, expected, 'one recorded inspection clears one bit')
      }
      if (frame.kind !== 'resolved') assert.deepEqual(frame.frames, before.frames, 'page residency changes only at load')
    }
    assert.deepEqual(actions.at(-1)?.frames, event.frames)
    assert.deepEqual(actions.at(-1)?.bits, event.bits)
    assert.equal(actions.at(-1)?.hand, event.handAfter)
  }
  while (state.phase === 'play') state = leakReducer(state, { type: 'step' })
  assert.equal(state.phase, 'explain', 'every request pauses for its explanation')
  assert.equal(leakReducer(state, { type: 'tick' }), state)
  if (step === 5 || step === 6) assert.ok(leakBoard(state, 'big').caption?.includes('1 → 1'))
  if (step === 8) {
    assert.ok(leakBoard(state, 'small').caption?.includes('0 → 1'))
    assert.equal(leakBoard(state, 'small').hit, true)
    assert.equal(leakBoard(state, 'big').hit, false)
  }
  if (step === 7) {
    assert.ok(canReplay(state))
    const again = leakReducer(state, { type: 'replay' })
    assert.equal(again.step, 3)
    assert.equal(again.phase, 'ready')
    assert.deepEqual(again.answer, { step: 7, page: 1 }, 'replay does not require solving again')
  }
  state = read(state)
}
state = leakReducer(state, { type: 'next' })
assert.equal(state.phase, 'account-ready')
state = leakReducer(state, { type: 'next' })
assert.equal(state.step, 5)
assert.equal(leakReducer(state, { type: 'tick' }), state)
state = leakReducer(state, { type: 'pause' })
const seen = [state.step]
while (state.phase === 'account') {
  state = leakReducer(state, { type: 'tick' })
  if (state.phase === 'account') seen.push(state.step)
}
assert.deepEqual(seen, [5, 6, 8, 9, 12])
assert.equal(DIFFERENCES.filter((row) => row.saved).length, 2)
assert.equal(DIFFERENCES.filter((row) => !row.saved).length, 3)
assert.equal(leakBoard(state, 'small').faults, 9)
assert.equal(leakBoard(state, 'big').faults, 10)
assert.equal(state.phase, 'summary')
state = leakReducer(state, { type: 'next' })
assert.equal(state.phase, 'bridge')
assert.ok(canReplay(state))
for (const line of [...SEARCH, ...FOUND, ...Object.values(EXPLANATIONS).flat(), ...SUMMARY, ...BRIDGE]) {
  assert.ok(line.length <= 190, `long bubble (${line.length}): ${line}`)
  assert.ok(!line.includes('—'))
}
console.log('screen 12: all puzzle answers, hidden evidence, canonical scans, bit changes, replay controls and 9→10 accounting verified')
