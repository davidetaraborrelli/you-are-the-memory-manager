import assert from 'node:assert/strict'
import { CLOCK, COST_OPTIONS, GUIDE, RECENCY, guideBoard, guideReducer, initialGuide, type GuideAction } from '../src/lib/act4.ts'

let state = initialGuide()
const act = (action: GuideAction) => { state = guideReducer(state, action) }
const id = () => GUIDE[state.beat]?.id
const read = () => {
  while (state.line < GUIDE[state.beat].lines.length - 1) act({ type: 'next' })
}
const continueTo = (target: string) => {
  for (let guard = 0; id() !== target && guard < 100; guard++) {
    const beat = GUIDE[state.beat]
    assert.ok(beat, `finished before ${target}`)
    if (beat.action === 'watch') act({ type: 'tick' })
    else {
      assert.equal(beat.action, 'continue', `unexpected decision at ${beat.id}`)
      act({ type: 'next' })
    }
  }
  assert.equal(id(), target)
}

// The illustration ends at the exact values the storyboard compresses.
assert.deepEqual(RECENCY.snapshots.map((s) => s.lastUsed), [[16, 15, 11], [16, 17, 11], [18, 17, 11]])
const before = state
act({ type: 'choose', slot: 0 })
assert.equal(state, before, 'the board cannot interrupt narration')
continueTo('cost')
for (const id of ['full', 'fault']) {
  act({ type: 'answer', id })
  assert.equal(GUIDE[state.beat].id, 'cost')
  assert.equal(state.reaction, 'correction')
  assert.ok(state.error)
}
act({ type: 'next' })
assert.equal(id(), 'cost', 'Next cannot bypass the question')
act({ type: 'answer', id: 'use' })
assert.equal(state.reaction, 'approval')
continueTo('equal')
assert.deepEqual(guideBoard(state).frames, [1, 3, 2])
assert.deepEqual(guideBoard(state).bits, [1, 1, 1])
assert.equal(guideBoard(state).faults, 3)
assert.equal(guideBoard(state).cursor, 3, 'request 5 is current, later requests stay masked')
act({ type: 'choose', slot: 0 })
act({ type: 'choose', slot: 0 })
assert.equal(state.explored.length, 1, 'repeated inspection cannot skip the other pages')
act({ type: 'choose', slot: 2 })
act({ type: 'choose', slot: 1 })
assert.equal(id(), 'first-inspection')
const explaining = state
act({ type: 'choose', slot: 0 })
assert.equal(state, explaining, 'no bit changes before the instruction has finished')
read()
act({ type: 'choose', slot: 1 })
assert.equal(id(), 'first-inspection', 'only the current inspection executes')
act({ type: 'choose', slot: 0 })
assert.deepEqual(guideBoard(state).bits, [0, 1, 1])
assert.deepEqual(guideBoard(state).frames, [1, 3, 2], 'an inspection is not an eviction')
continueTo('inspect-middle')
act({ type: 'choose', slot: 1 })
assert.deepEqual(guideBoard(state).bits, [0, 0, 1])
act({ type: 'choose', slot: 2 })
assert.equal(id(), 'first-victim')
assert.deepEqual(guideBoard(state).bits, [0, 0, 0])
assert.equal(guideBoard(state).hand, 0, 'full sweep returns to its starting slot')
read()
const firstBoard = guideBoard(state)
act({ type: 'choose', slot: 1 })
assert.equal(id(), 'first-victim')
assert.deepEqual(guideBoard(state), firstBoard, 'a refused eviction cannot change the board')
act({ type: 'choose', slot: 0 })
assert.deepEqual(guideBoard(state).frames, CLOCK[3].frames)
assert.deepEqual(guideBoard(state).bits, CLOCK[3].bits)
assert.equal(guideBoard(state).faults, 4)
continueTo('restored')
assert.deepEqual(guideBoard(state).bits, [1, 1, 0], 'the hit restores page 3, not every bit')
assert.equal(guideBoard(state).faults, 4, 'a hit is free')
continueTo('resume')
assert.equal(guideBoard(state).hand, 1, 'the second search resumes after the first victim')
assert.equal(guideBoard(state).cursor, 5)
act({ type: 'choose', slot: 1 })
assert.deepEqual(guideBoard(state).bits, [1, 0, 0])
assert.equal(guideBoard(state).hand, 2)
read()
for (const slot of [0, 1]) {
  const prior = guideBoard(state)
  act({ type: 'choose', slot })
  assert.equal(id(), 'second-victim')
  assert.deepEqual(guideBoard(state), prior)
  assert.equal(state.reaction, 'correction')
}
act({ type: 'choose', slot: 2 })
assert.deepEqual(guideBoard(state).frames, CLOCK[5].frames)
assert.deepEqual(guideBoard(state).bits, CLOCK[5].bits)
assert.equal(guideBoard(state).faults, 5)
continueTo('bridge')
act({ type: 'next' })
assert.equal(state.beat, GUIDE.length, 'the bridge finishes screen 9')

for (const beat of GUIDE) {
  assert.ok(beat.lines.length <= 4, `${beat.id}: too many bubbles`)
  for (const line of beat.lines) {
    assert.ok(line.replace(/\*\*/g, '').length <= 190, `${beat.id}: long bubble`)
    assert.ok(!line.includes('—'), `${beat.id}: em dash`)
    assert.ok(!/\bclock\b/i.test(line), `${beat.id}: name arrives on screen 10`)
  }
}
assert.equal(COST_OPTIONS.length, 3)
console.log('screen 9: guided scans, retries, narration gates, bit restoration and bridge verified')
