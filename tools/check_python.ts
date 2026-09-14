import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadPyodide } from 'pyodide'
import pkg from 'pyodide/package.json' with { type: 'json' }
import { ANSWERS, FULL, INTRO, QUICK, initialEditor, playback, recordResult, resultLines, validateBlanks, type Blanks, type RunResult } from '../src/lib/code-lesson.ts'
import { PythonClient, type WorkerPort } from '../src/lib/worker-client.ts'

// Exercise the actual distributed WASM interpreter and the same harness used
// by the browser worker. No network, simulated Python, or policy substitution.
const python = await loadPyodide({ indexURL: resolve('public', 'pyodide', `v${pkg.version}`) })
python.runPython(await readFile('src/lib/runner.py', 'utf8'))
function run(fields: Blanks, spec = QUICK): RunResult {
  python.globals.set('_test_request', JSON.stringify({ fields, spec }))
  return JSON.parse(python.runPython('run_request(_test_request)') as string)
}
const quick = run(ANSWERS)
assert.equal(quick.status, 'passed')
assert.ok('records' in quick)
assert.deepEqual(quick.records.map((r) => r.returnedBits), [[0, 0, 1], [0, 1, 0]])
assert.deepEqual(quick.records.map((r) => r.handBefore), [0, 2], 'the two choices share state')
assert.deepEqual(quick.records.map((r) => r.scanned), [[0, 1], [2, 0]])
assert.deepEqual(run(ANSWERS), quick, 'a new quick run starts with fresh state')
const full = run(ANSWERS, FULL)
assert.equal(full.status, 'passed')
assert.ok('records' in full)
assert.equal(full.records.filter((r) => r.outcome !== 'hit').length, 8)
for (const [i, event] of full.records.entries()) {
  for (const field of ['page', 'outcome', 'slot', 'victim', 'frames', 'bits', 'handBefore', 'scanned', 'handAfter'] as const) {
    assert.deepEqual(event[field], FULL.steps[i][field], `L3 step ${i + 1}: ${field}`)
  }
}
for (const fields of [['0', '0', 'cursor'], ['0', '1', 'cursor'], ['1', '1', 'cursor']] as Blanks[]) {
  const result = run(fields)
  assert.equal(result.status, 'different')
  assert.ok('records' in result)
  assert.equal(result.records.length, 1, 'stop at the first observable difference')
}
const started = performance.now()
const endless = run(['1', '1', 'cursor'], FULL)
assert.equal(endless.status, 'technical')
assert.ok(performance.now() - started < 1500, 'the instruction budget bounds an infinite loop')
assert.equal(python.runPython('sys.gettrace() is None'), true)
assert.equal(run(ANSWERS).status, 'passed', 'a technical failure does not poison later runs')
for (const [field, value] of [[0, '2'], [0, '1 or True'], [1, 'print(1)'], [2, '0'], [2, 'len(frames)'], [2, 'cursor\nprint(123)']] as const) {
  const fields = [...ANSWERS] as Blanks
  fields[field] = value
  assert.ok(validateBlanks(fields)[field])
  const result = run(fields)
  assert.equal(result.status, 'technical')
  assert.ok(result.status === 'technical' && result.field === field)
}
assert.deepEqual(validateBlanks([' 1 ', '0', 'cursor']), [null, null, null])

const referenceFrames = playback(QUICK)
const actualFrames = playback(QUICK, quick.records)
assert.deepEqual(actualFrames, referenceFrames, 'the fallback shows the same actions as correct Python')
assert.deepEqual(referenceFrames.filter((f) => f.kind === 'return').map((f) => f.bits), [[0, 0, 1], [0, 1, 0]])
assert.deepEqual(playback(FULL, full.records), playback(FULL))
const failed = run(['0', '0', 'cursor'])
assert.ok('records' in failed)
assert.equal(playback(QUICK, failed.records).at(-1)!.frames[0], 4, 'a wrong rule replays its own victim')

const editor = { ...initialEditor(), fields: ['1', '1', 'cursor'] as Blanks, hints: 2 }
const technical = recordResult(editor, endless)
assert.deepEqual(technical.fields, editor.fields)
assert.equal(technical.hints, 2)
assert.equal(technical.failures, 0, 'technical errors do not consume valid attempts')
const difference = recordResult(editor, failed)
assert.equal(difference.failures, 1)
assert.deepEqual(difference.fields, editor.fields)
assert.equal(difference.hints, 2, 'differences do not reveal hints')
assert.ok(resultLines(false).some((line) => line.includes('you just built')))
assert.ok(resultLines(true).some((line) => line.includes('you were building')))
for (const line of [...INTRO, ...resultLines(false), ...resultLines(true)]) {
  assert.ok(line.replace(/\*\*/g, '').length <= 190)
  assert.ok(!line.includes('—'))
}

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null
  onerror: WorkerPort['onerror'] = null
  onmessageerror: WorkerPort['onmessageerror'] = null
  stopped = false
  messages: unknown[] = []
  postMessage(message: unknown) { this.messages.push(message) }
  terminate() { this.stopped = true }
  emit(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })) }
}
const unavailable = new PythonClient({ createWorker: () => { throw new Error('Worker blocked') }, indexURL: '/local/' })
assert.equal(await unavailable.enter(), false)
const lateWorker = new FakeWorker()
const late = new PythonClient({ createWorker: () => lateWorker, indexURL: '/local/', initMs: 100 })
assert.equal(await late.enter(10), false)
lateWorker.emit({ type: 'ready' })
assert.equal(await late.enter(), false, 'late readiness cannot change the entry decision')
assert.equal(lateWorker.stopped, true)
const missing = new FakeWorker()
const missingClient = new PythonClient({ createWorker: () => missing, indexURL: '/local/', initMs: 10 })
assert.equal(await missingClient.warm(), false, 'WASM initialisation cannot wait forever')
const broken = new FakeWorker()
const brokenClient = new PythonClient({ createWorker: () => broken, indexURL: '/local/' })
const brokenReady = brokenClient.warm()
broken.emit({ type: 'unavailable' })
assert.equal(await brokenReady, false)
const fake = new FakeWorker()
const client = new PythonClient({ createWorker: () => fake, indexURL: '/local/', runMs: 15 })
const ready = client.warm()
fake.emit({ type: 'ready' })
assert.equal(await ready, true)
const answer = client.run(ANSWERS, QUICK)
fake.emit({ type: 'result', id: 1, result: quick })
assert.deepEqual(await answer, quick)
const hung = client.run(ANSWERS, FULL)
assert.equal((await hung).status, 'runtime_error')
assert.equal(fake.stopped, true, 'a hung worker is terminated outside Python')
fake.emit({ type: 'result', id: 2, result: full })
assert.equal((await client.run(ANSWERS, QUICK)).status, 'runtime_error')
console.log('screen 10: real Pyodide execution, full trace parity, invalid tokens, loop limits, fresh state, fallback replay and worker failures verified')
