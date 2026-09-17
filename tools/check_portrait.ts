import assert from 'node:assert/strict'
import { comparisonFace, leakFace, stackFace, transferFace, optNarrationFace } from '../src/lib/portrait-cues.ts'
import { initialComparison, comparisonReducer } from '../src/lib/act6.ts'
import { initialLeak, leakReducer } from '../src/lib/leak.ts'
import { initialStack, stackReducer } from '../src/lib/stack.ts'
import { initialTransfer, transferReducer, transferLines, OPTIONS, ANSWERS } from '../src/lib/transfer.ts'
import { regretFace } from '../src/lib/act1.ts'
import { createGame, advance, resolve } from '../src/lib/game.ts'
import { L1 } from '../src/lib/levels.ts'

// No regret reaction while choosing; the returned page must be visible first.
let game = createGame(L1.ref, L1.frames)
while (game.awaiting?.step !== 5) {
  assert.equal(regretFace(game, 0), 'neutral')
  game = game.awaiting ? resolve(game, game.frames.indexOf(null)) : advance(game)
}
game = resolve(game, 0)
assert.equal(regretFace(game, 0), 'neutral', 'an eviction alone does not predict regret')
game = advance(game)
assert.equal(game.awaiting?.regret?.page, 1)
assert.equal(regretFace(game, 0), 'apologetic')
assert.equal(regretFace(game, 1), 'neutral', 'the sympathy ends before the next choice')

// All predictions get the same anticipation. Never encode correctness in a face.
for (const id of ['fewer', 'same', 'more']) {
  let s = initialComparison(true)
  for (let i = 0; i < 2; i++) {
    assert.equal(comparisonFace(s), 'neutral')
    s = comparisonReducer(s, { type: 'next' })
  }
  assert.equal(comparisonFace(s), 'neutral')
  s = comparisonReducer(s, { type: 'predict', id })
  while (s.phase === 'run') {
    assert.equal(comparisonFace(s), 'withholding')
    s = comparisonReducer(s, { type: 'step' })
  }
  assert.equal(comparisonFace(s), 'apologetic')
  s = comparisonReducer(s, { type: 'next' })
  assert.equal(comparisonFace(s), 'neutral')
  s = comparisonReducer(s, { type: 'next' })
  assert.equal(comparisonFace(s), 'apologetic')
  s = comparisonReducer(s, { type: 'next' })
  assert.equal(comparisonFace(s), 'neutral')
}

let leak = initialLeak(true)
leak = leakReducer(leakReducer(leak, { type: 'next' }), { type: 'next' })
for (let step = 1; step <= 12; step++) {
  leak = leakReducer(leak, { type: 'select', step })
  assert.equal(leakFace(leak), 'neutral', 'scrubbing over a leak must not reveal it')
}
leak = leakReducer(leak, { type: 'select', step: 1 })
leak = leakReducer(leak, { type: 'choose', page: 1 })
assert.equal(leakFace(leak), 'correction')
leak = leakReducer(leak, { type: 'select', step: 7 })
assert.equal(leakFace(leak), 'neutral')
leak = leakReducer(leak, { type: 'choose', page: 1 })
assert.equal(leakFace(leak), 'approval')
leak = leakReducer(leak, { type: 'next' })
assert.equal(leakFace(leak), 'neutral', 'approval stops when the explanation starts')
let apologies = 0
for (let guard = 0; leak.phase !== 'bridge' && guard < 300; guard++) {
  const face = leakFace(leak)
  if (face === 'apologetic') {
    apologies++
    assert.equal(leak.phase, 'explain')
    assert.ok(leak.step === 7 || leak.step === 8)
  }
  if (leak.phase === 'play' || leak.phase === 'account') assert.equal(face, 'neutral')
  leak = leakReducer(leak, { type: leak.phase === 'play' || leak.phase === 'account' ? 'step' : 'next' })
}
assert.equal(leak.phase, 'bridge')
assert.equal(apologies, 2)

let stack = initialStack(true)
for (let guard = 0; stack.phase !== 'question' && guard < 200; guard++) {
  assert.equal(stackFace(stack), 'neutral', 'inclusion replay must not answer the inference')
  stack = stackReducer(stack, { type: stack.phase === 'checking' ? 'step' : 'next' })
}
assert.equal(stack.phase, 'question')
stack = stackReducer(stack, { type: 'choose', id: 'both-fault' })
assert.equal(stackFace(stack), 'correction')
stack = stackReducer(stack, { type: 'next' })
assert.equal(stackFace(stack), 'neutral')
stack = stackReducer(stack, { type: 'choose', id: 'large-fault' })
assert.equal(stackFace(stack), 'approval')
stack = stackReducer(stack, { type: 'next' })
assert.equal(stackFace(stack), 'neutral')
stack = stackReducer(stack, { type: 'next' })
assert.equal(stackFace(stack), 'satisfied')
while (stack.phase === 'explain') stack = stackReducer(stack, { type: 'next' })
assert.equal(stackFace(stack), 'neutral', 'the mixed policy results are not a victory lap')

let transfer = initialTransfer()
while (transfer.phase !== 'question') transfer = transferReducer(transfer, { type: 'next' })
for (const stage of ['evidence', 'pattern', 'policy'] as const) {
  assert.equal(transferFace(transfer), 'neutral')
  const wrong = OPTIONS[stage].find(o => o.id !== ANSWERS[stage])!
  let retry = transferReducer(transfer, { type: 'choose', id: wrong.id })
  assert.equal(transferFace(retry), 'correction')
  while (retry.phase === 'wrong') retry = transferReducer(retry, { type: 'next' })
  assert.equal(transferFace(retry), 'neutral')
  transfer = transferReducer(retry, { type: 'choose', id: ANSWERS[stage] })
  assert.equal(transferFace(transfer), 'approval')
  transfer = transferReducer(transfer, { type: 'next' })
  assert.equal(transferFace(transfer), stage === 'policy' ? 'approval' : 'neutral')
  while (transfer.line < transferLines(transfer).length - 1) transfer = transferReducer(transfer, { type: 'next' })
  transfer = transferReducer(transfer, { type: 'next' })
}
assert.equal(transferFace(transfer), 'satisfied')
transfer = transferReducer(transfer, { type: 'next' })
assert.equal(transferFace(transfer), 'neutral')
assert.equal(optNarrationFace('play', 0), null)
assert.equal(optNarrationFace('whole', 0), 'approval')
assert.equal(optNarrationFace('whole', 1), 'neutral')
assert.equal(optNarrationFace('proof', 1), 'neutral')
assert.equal(optNarrationFace('proof', 2), 'satisfied')
assert.equal(optNarrationFace('why', 0), null)
console.log('portrait: earned reactions, visible consequences, full replays, retries and neutral question gates verified')
