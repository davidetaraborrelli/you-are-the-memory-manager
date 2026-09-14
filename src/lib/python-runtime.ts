import { PythonClient } from './worker-client.ts'
import { version } from 'pyodide/package.json'

export const pythonRuntime = new PythonClient({
  createWorker: () => new Worker(new URL('../workers/python.worker.ts', import.meta.url), { type: 'module' }),
  indexURL: new URL(`${import.meta.env.BASE_URL}pyodide/v${version}/`, window.location.origin).href,
})
