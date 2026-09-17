import assert from 'node:assert/strict'
import { TRANSFER } from '../src/lib/levels.ts'
import { INTRO, QUESTIONS, OPTIONS, ANSWERS, CORRECT, WRONG, ENDING, initialTransfer, transferLines,
  transferReducer, transferView, transferDone, type TransferState, type TransferStage } from '../src/lib/transfer.ts'
import { SCREENS } from '../src/lib/screens.ts'
import { resetMachine, machineGate, learnerCommitted, tellRuleBroken } from '../src/lib/machine.ts'

function finishReading(state: TransferState) {
  while (state.line < transferLines(state).length - 1) state = transferReducer(state, { type: 'next' })
  return state
}
let state = initialTransfer()
assert.deepEqual(transferView(state).slots, [null, null, null])
assert.equal(transferView(state).taskA, null)
assert.equal(transferView(state).taskB, null)
for (let line = 0; line < INTRO.length; line++) {
  assert.equal(transferReducer(state, { type: 'choose', id: 'past' }), state, 'read the setup before choosing')
  state = transferReducer(state, { type: 'next' })
}
resetMachine()
for (const stage of ['evidence', 'pattern', 'policy'] as const) {
  assert.equal(state.stage, stage)
  assert.equal(state.phase, 'question')
  machineGate(`act7:14:${stage}`)
  assert.equal(tellRuleBroken('approval'), true, 'each new question needs its own commitment')
  assert.equal(transferReducer(state, { type: 'next' }), state, 'no Continue skips a question')
  assert.equal(transferReducer(state, { type: 'choose', id: 'unknown' }), state)
  const evidence = transferView(state)
  assert.equal(evidence.victim, null)
  assert.deepEqual(evidence.nextIndices, [])
  assert.deepEqual(evidence.shortReturns, [])
  assert.equal(evidence.taskA !== null, stage === 'pattern')
  assert.equal(evidence.taskB !== null, stage !== 'evidence')
  assert.deepEqual(evidence.slots, stage === 'policy' ? ['api.py', 'db.py', 'utils.py'] : [null, null, null])
  assert.equal(evidence.request, stage === 'policy' ? 'models.py' : null)
  assert.ok(!('scores' in evidence) && !('faults' in evidence), 'no totals in the transfer UI')
  for (const option of OPTIONS[stage]) {
    if (option.id === ANSWERS[stage]) continue
    let wrong = transferReducer(state, { type: 'choose', id: option.id })
    assert.equal(wrong.phase, 'wrong')
    assert.equal(wrong.chosen, option.id)
    assert.deepEqual(transferLines(wrong), WRONG[stage][option.id], 'feedback is specific to the committed choice')
    for (let line = 0; line < WRONG[stage][option.id].length; line++) {
      assert.deepEqual(transferView(wrong), evidence, 'an error neither advances nor reveals the correct candidate')
      assert.equal(transferReducer(wrong, { type: 'choose', id: ANSWERS[stage] }), wrong, 'finish feedback before retrying')
      wrong = transferReducer(wrong, { type: 'next' })
    }
    assert.deepEqual(wrong, state, 'retry returns to the same question and evidence')
  }
  learnerCommitted()
  assert.equal(tellRuleBroken('approval'), false)
  state = transferReducer(state, { type: 'choose', id: ANSWERS[stage] })
  assert.equal(state.phase, 'correct')
  assert.equal(transferReducer(state, { type: 'choose', id: OPTIONS[stage][0].id }), state, 'the committed answer is locked')
  if (stage === 'evidence') {
    assert.equal(transferView(state).taskA, null, 'introduce the comparison before revealing it')
    assert.equal(transferView(finishReading(state)).taskB, null)
  }
  if (stage === 'pattern') {
    assert.deepEqual(transferView(state).shortReturns, [[0, 2], [4, 6]])
    assert.equal(transferView(state).cycles, true)
    assert.deepEqual(transferView(state).slots, [null, null, null], 'the replacement checkpoint is still hidden')
    assert.equal(transferView(finishReading(state)).victim, null)
  }
  if (stage === 'policy') {
    assert.equal(transferView(state).victim, null, 'wait for the concrete checkpoint explanation')
    state = transferReducer(state, { type: 'next' })
    assert.equal(transferView(state).victim, 'utils.py')
    assert.deepEqual(transferView(state).nextIndices, [4, 5])
    assert.deepEqual(transferView(state).slots, ['api.py', 'db.py', 'utils.py'], 'keep the labelled historical checkpoint; do not invent a live run')
    assert.deepEqual(TRANSFER.checkpoint.nextIndices.map((i) => TRANSFER.taskB[i]), ['api.py', 'db.py'])
  }
  state = transferReducer(finishReading(state), { type: 'next' })
}
assert.equal(state.phase, 'ending')
assert.equal(transferDone(state), false)
state = finishReading(state)
assert.equal(transferDone(state), true)
assert.deepEqual(transferLines(state), ENDING)
assert.equal(transferReducer(state, { type: 'next' }), state, 'the last question ends the lesson without another screen')
assert.equal(transferReducer(state, { type: 'choose', id: 'mru' }), state)
assert.ok(SCREENS.every((screen) => screen.built))
assert.equal(SCREENS.at(-1)?.n, 14)

for (const [start, end] of TRANSFER.shortReturns) {
  assert.equal(TRANSFER.taskA[start], TRANSFER.taskA[end])
  assert.ok(end > start && end - start <= 2)
}
assert.deepEqual(TRANSFER.taskB.slice(0, TRANSFER.cycleLength), TRANSFER.taskB.slice(TRANSFER.cycleLength))
assert.equal(new Set(TRANSFER.taskA).size, TRANSFER.capacity)
assert.equal(new Set(TRANSFER.taskB).size, TRANSFER.capacity + 1)
const groups = [INTRO, ENDING, ...Object.values(QUESTIONS), ...Object.values(CORRECT),
  ...Object.values(WRONG).flatMap((answers) => Object.values(answers))]
for (const group of groups) {
  assert.ok(group.length <= 4)
  for (const line of group) {
    assert.ok(line.replaceAll('**', '').length <= 190, `long bubble: ${line}`)
    assert.ok(!line.includes('—'))
  }
}
for (const stage of ['evidence', 'pattern', 'policy'] as TransferStage[]) {
  assert.ok(OPTIONS[stage].some((o) => o.id === ANSWERS[stage]))
}
console.log('screen 14: all choices and retries, progressive evidence, three commitment gates, conditional policy feedback, generated checkpoint and final ending verified')
