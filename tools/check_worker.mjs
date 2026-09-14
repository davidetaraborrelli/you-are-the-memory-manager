import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import pkg from 'pyodide/package.json' with { type: 'json' }

// Execute Vite's emitted worker, with only the DedicatedWorker message API
// adapted to Node. Its loader, Python harness and request code are unchanged.
const file = (await readdir('dist/assets')).find((name) => /^python\.worker-.*\.js$/.test(name))
assert.ok(file, 'Run npm run build before the worker integration check')
const workerURL = pathToFileURL(resolve('dist/assets', file)).href
// Node's Pyodide loader needs a native directory; browser loading uses an HTTP
// URL. The ES module itself always has a URL in either environment.
const indexURL = resolve('public/pyodide', `v${pkg.version}`)
const moduleURL = pathToFileURL(resolve(indexURL, 'pyodide.mjs')).href
const wrapper = `
  import { parentPort } from 'node:worker_threads';
  globalThis.self = { postMessage: (message) => parentPort.postMessage(message) };
  await import(${JSON.stringify(workerURL)});
  parentPort.on('message', (data) => self.onmessage({ data }));
`
const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(wrapper)}`))
function response(message) {
  return new Promise((resolveReply, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('worker response timed out')) }, 15000)
    function cleanup() { clearTimeout(timeout); worker.off('message', received); worker.off('error', failed) }
    function received(reply) { cleanup(); resolveReply(reply) }
    function failed(error) { cleanup(); reject(error) }
    worker.on('message', received)
    worker.on('error', failed)
    worker.postMessage(message)
  })
}
try {
  assert.deepEqual(await response({ type: 'init', indexURL, moduleURL }), { type: 'ready' })
  const data = JSON.parse(await readFile('src/data/levels.json', 'utf8'))
  const spec = data.clockQuickCheck
  const good = await response({ type: 'run', id: 1, fields: ['1', '0', 'cursor'], spec })
  assert.equal(good.id, 1)
  assert.equal(good.result.status, 'passed')
  assert.deepEqual(good.result.records.map((r) => r.returnedBits), [[0, 0, 1], [0, 1, 0]])
  const bad = await response({ type: 'run', id: 2, fields: ['bad', '0', 'cursor'], spec })
  assert.equal(bad.id, 2)
  assert.equal(bad.result.status, 'technical')
  assert.equal(bad.result.field, 0)
  console.log('emitted worker: local Pyodide boot, message protocol, actual Python and field validation verified')
} finally {
  await worker.terminate()
}
