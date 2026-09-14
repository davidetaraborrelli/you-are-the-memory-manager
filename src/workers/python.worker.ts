import harness from '../lib/runner.py?raw'
import type { PyodideInterface } from 'pyodide'
import { validateBlanks, type Blanks, type RunSpec } from '../lib/code-lesson'

const worker = self as unknown as DedicatedWorkerGlobalScope
let python: PyodideInterface | null = null
worker.onmessage = async (event: MessageEvent<
  | { type: 'init'; indexURL: string; moduleURL: string }
  | { type: 'run'; id: number; fields: Blanks; spec: RunSpec }
>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      const url = message.moduleURL
      const { loadPyodide } = await import(/* @vite-ignore */ url) as typeof import('pyodide')
      python = await loadPyodide({ indexURL: message.indexURL })
      python.runPython(harness)
      worker.postMessage({ type: 'ready' })
    } catch { worker.postMessage({ type: 'unavailable' }) }
    return
  }
  if (!python) { worker.postMessage({ type: 'unavailable' }); return }
  const errors = validateBlanks(message.fields)
  const field = errors.findIndex(Boolean)
  if (field >= 0) {
    worker.postMessage({ type: 'result', id: message.id, result: { status: 'technical', field, message: errors[field] } })
    return
  }
  try {
    python.globals.set('_lesson_request', JSON.stringify(message))
    const result = JSON.parse(python.runPython('run_request(_lesson_request)') as string)
    python.globals.delete('_lesson_request')
    worker.postMessage({ type: 'result', id: message.id, result })
  } catch {
    worker.postMessage({ type: 'result', id: message.id, result: { status: 'technical', message: 'That run could not finish. Check the three fields and try again.' } })
  }
}
