import type { Blanks, RunResult, RunSpec } from './code-lesson.ts'

export type RunOutcome = RunResult | { status: 'runtime_error'; message: string }
export interface WorkerPort {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((event: MessageEvent) => unknown) | null
  onerror: ((event: ErrorEvent) => unknown) | null
  onmessageerror: ((event: MessageEvent) => unknown) | null
}

/** One warmed worker, one request at a time, with deadlines owned by the UI thread. */
export class PythonClient {
  private readonly options: { createWorker: () => WorkerPort; indexURL: string; initMs?: number; runMs?: number }
  private worker: WorkerPort | null = null
  private ready: Promise<boolean> | null = null
  private settleReady: ((ready: boolean) => void) | null = null
  private bootTimer: ReturnType<typeof setTimeout> | null = null
  private pending: { id: number; resolve: (result: RunOutcome) => void; timer: ReturnType<typeof setTimeout> } | null = null
  private serial = 0
  private status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'

  constructor(options: {
    createWorker: () => WorkerPort
    indexURL: string
    initMs?: number
    runMs?: number
  }) { this.options = options }

  warm(): Promise<boolean> {
    if (this.ready) return this.ready
    this.status = 'loading'
    this.ready = new Promise((resolve) => { this.settleReady = resolve })
    this.bootTimer = setTimeout(() => this.fail(), this.options.initMs ?? 15000)
    try {
      this.worker = this.options.createWorker()
      this.worker.onmessage = (event) => {
        if (this.status === 'failed') return
        const message = event.data
        if (message.type === 'ready' && this.status === 'loading') {
          this.status = 'ready'
          if (this.bootTimer) clearTimeout(this.bootTimer)
          this.settleReady?.(true)
        } else if (message.type === 'unavailable') this.fail()
        else if (message.type === 'result' && this.pending && this.pending.id === message.id) {
          const pending = this.pending
          this.pending = null
          clearTimeout(pending.timer)
          pending.resolve(message.result as RunResult)
        }
      }
      this.worker.onerror = () => this.fail()
      this.worker.onmessageerror = () => this.fail()
      this.worker.postMessage({ type: 'init', indexURL: this.options.indexURL, moduleURL: `${this.options.indexURL}pyodide.mjs` })
    } catch { this.fail() }
    return this.ready
  }

  /** Decide once on entry. A late ready message cannot re-enable the editor. */
  async enter(waitMs = 6000): Promise<boolean> {
    const ready = this.warm()
    if (this.status === 'ready') return true
    if (this.status === 'failed') return false
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.fail(); resolve(false) }, waitMs)
      void ready.then((value) => { clearTimeout(timer); resolve(value) })
    })
  }

  run(fields: Blanks, spec: RunSpec): Promise<RunOutcome> {
    if (this.status !== 'ready' || !this.worker) return Promise.resolve(this.runtimeError())
    if (this.pending) return Promise.resolve({ status: 'technical', message: 'Let the current run finish first.' })
    return new Promise((resolve) => {
      const id = ++this.serial
      const timer = setTimeout(() => this.fail(), this.options.runMs ?? 1500)
      this.pending = { id, resolve, timer }
      try { this.worker!.postMessage({ type: 'run', id, fields, spec }) }
      catch { this.fail() }
    })
  }

  private runtimeError(): RunOutcome {
    return { status: 'runtime_error', message: 'Python is not responding. You can keep going with the reference rule.' }
  }
  private fail() {
    this.status = 'failed'
    if (this.bootTimer) clearTimeout(this.bootTimer)
    this.worker?.terminate()
    this.worker = null
    this.settleReady?.(false)
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.resolve(this.runtimeError())
      this.pending = null
    }
  }
}
