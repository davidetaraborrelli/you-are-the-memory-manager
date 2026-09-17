import { useEffect, useRef, useState } from 'react'
import { Bubble, useVoice } from '@/components/Bubble'
import { CodePlayback } from '@/components/CodePlayback'
import { ProgressBar } from '@/components/ProgressBar'
import { PythonScaffold } from '@/components/PythonScaffold'
import { Scoreboard } from '@/components/Scoreboard'
import { ANSWERS, FULL, INTRO, QUICK, REFERENCE_AFTER, initialEditor, playback, recordResult, resultLines, validateBlanks,
  type Blanks, type PlaybackFrame, type RunResult } from '@/lib/code-lesson'
import { L3 } from '@/lib/levels'
import { pythonRuntime } from '@/lib/python-runtime'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'

type Phase = 'intro' | 'editor' | 'quick-intro' | 'play' | 'quick-passed' | 'difference' | 'result'
type CompletedRun = Extract<RunResult, { records: unknown }>

/** The coding screen owns its failure paths; the rest of the lesson uses static traces. */
export function Act5({ onDone }: { onDone: (reference: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [line, setLine] = useState(0)
  const [editor, setEditor] = useState(initialEditor)
  const [availability, setAvailability] = useState<'checking' | 'ready' | 'runtime_unavailable'>('checking')
  const [reference, setReference] = useState(false)
  const [runtimeFailed, setRuntimeFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<'quick' | 'full'>('quick')
  const [execution, setExecution] = useState<CompletedRun | null>(null)
  const [timeline, setTimeline] = useState<PlaybackFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [repair, setRepair] = useState(false)
  const alive = useRef(true)
  const sequence = useRef(0)
  const spec = stage === 'quick' ? QUICK : FULL
  const frame = timeline[frameIndex]

  useEffect(() => {
    alive.current = true
    resetMachine()
    machineGate('act5:10')
    // A local test route can exercise the same branch as a blocked WASM fetch.
    const forced = import.meta.env.DEV && new URLSearchParams(location.search).get('python') === 'unavailable'
    void (forced ? Promise.resolve(false) : pythonRuntime.enter()).then((ready) => {
      if (!alive.current) return
      setAvailability(ready ? 'ready' : 'runtime_unavailable')
      setReference(!ready)
    })
    return () => { alive.current = false; sequence.current++ }
  }, [])

  function go(next: Phase) { setLine(0); setPhase(next) }
  function beginPlayback(selectedStage: 'quick' | 'full', result: CompletedRun, isRepair = false) {
    setStage(selectedStage)
    const steps = playback(selectedStage === 'quick' ? QUICK : FULL, result.records)
    setTimeline(isRepair ? steps.filter((f) => f.step === execution?.differenceStep) : steps)
    setFrameIndex(0)
    setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setRepair(isRepair)
    if (!isRepair) setExecution(result)
    go('play')
  }

  function referenceQuick() {
    setStage('quick')
    setExecution({ status: 'passed', records: QUICK.steps })
    setRepair(false)
    go('quick-intro')
  }

  async function run(selectedStage: 'quick' | 'full') {
    if (busy) return
    learnerCommitted()
    setMachineState('neutral')
    if (reference) {
      if (selectedStage === 'quick') referenceQuick()
      else beginPlayback('full', { status: 'passed', records: FULL.steps })
      return
    }
    const errors = validateBlanks(editor.fields)
    if (errors.some(Boolean)) { setMachineState('correction'); setEditor((e) => ({ ...e, errors })); return }
    setBusy(true)
    setEditor((e) => ({ ...e, errors: [null, null, null], message: null }))
    const ticket = ++sequence.current
    const result = await pythonRuntime.run(editor.fields.map((v) => v.trim()) as Blanks, selectedStage === 'quick' ? QUICK : FULL)
    if (!alive.current || ticket !== sequence.current) return
    setBusy(false)
    if (result.status === 'runtime_error') {
      setMachineState('apologetic')
      setRuntimeFailed(true)
      setEditor((e) => ({ ...e, message: result.message }))
      go('editor')
      return
    }
    setEditor((e) => recordResult(e, result))
    if (result.status === 'technical') {
      setMachineState('correction')
      go('editor')
      return
    }
    setStage(selectedStage)
    setExecution(result)
    if (selectedStage === 'quick') go('quick-intro')
    else beginPlayback(selectedStage, result)
  }

  function finishPlayback() {
    if (repair) { referenceQuick(); return }
    if (execution?.status === 'different') {
      setMachineState('correction')
      go('difference')
    } else if (stage === 'quick') {
      setMachineState('approval')
      go('quick-passed')
    }
    else {
      setMachineState(reference ? 'approval' : 'satisfied')
      go('result')
    }
  }
  function advanceFrame() {
    if (frameIndex + 1 < timeline.length) setFrameIndex((i) => i + 1)
    else finishPlayback()
  }
  useEffect(() => {
    if (phase !== 'play' || paused) return
    const delay = frame?.kind === 'inspect' || frame?.kind === 'return' ? 850 : 450
    const timer = setTimeout(advanceFrame, delay)
    return () => clearTimeout(timer)
  }, [phase, paused, frameIndex, timeline, repair, execution])

  function useReference() {
    learnerCommitted()
    setMachineState('neutral')
    setReference(true)
    setEditor((e) => ({ ...e, errors: [null, null, null], message: null }))
    if (execution?.status === 'different' && execution.differenceStep) {
      beginPlayback(stage, { status: 'passed', records: spec.steps }, true)
    } else referenceQuick()
  }

  const fallbackOffered = !reference && (editor.failures >= REFERENCE_AFTER || runtimeFailed)
  const shownFrame = phase === 'quick-intro' ? playback(QUICK)[0]
    : ['play', 'quick-passed', 'difference', 'result'].includes(phase) ? frame : undefined
  const lines = phase === 'intro' ? INTRO
    : phase === 'quick-intro' ? [reference ? "Let's try the reference rule on two small choices first." : "Let's try your rule on two small choices first."]
    : phase === 'quick-passed' ? ['That matches the rule. Now let\'s run it on the whole tape.']
    : phase === 'difference' ? [execution?.message ?? 'This choice differs. Look at the page removed and the bits left behind.']
    : phase === 'result' ? resultLines(reference) : []
  // The editor and the playback are both stretches with no voice: one is the
  // learner typing, the other is the machine running what they typed. Each
  // keeps the line that handed it the screen.
  const voice = useVoice(lines, line, phase)
  const done = phase === 'intro' ? (availability === 'checking' ? undefined : () => go('editor'))
    : phase === 'quick-intro' ? () => beginPlayback('quick', execution!)
    : phase === 'quick-passed' ? (busy ? undefined : () => { void run('full') })
    : phase === 'difference' ? () => { setMachineState('neutral'); go('editor') }
    : phase === 'result' ? () => onDone(reference) : undefined

  return <>
    <ProgressBar screen={10} />
    <main className="mx-auto flex lesson-content max-w-3xl flex-col justify-center gap-6 px-5 py-10 sm:py-12">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">Make the cheap rule executable</p>
      {phase === 'editor' && <>
        {availability === 'runtime_unavailable' && <p className="field-border-disabled p-4 text-sm text-ink-dim" role="status">
          Python isn't available here, so we'll walk through the reference rule. You can still watch every choice.
        </p>}
        <PythonScaffold fields={editor.fields} errors={editor.errors} hints={editor.hints}
          disabled={busy} reference={reference}
          onChange={(index, value) => {
            setMachineState('neutral')
            setEditor((e) => {
              const fields = [...e.fields] as Blanks; fields[index] = value
              const errors = [...e.errors]; errors[index] = null
              return { ...e, fields, errors, message: null }
            })
          }}
          onHint={() => setEditor((e) => ({ ...e, hints: Math.min(3, e.hints + 1) }))}
          onAnswers={() => setEditor((e) => ({ ...e, fields: [...ANSWERS], errors: [null, null, null], message: null }))}
        />
        {editor.message && !editor.errors.some(Boolean) && <p role="alert" className="text-sm text-fault">{editor.message}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || (!reference && (runtimeFailed || editor.fields.some((v) => !v.trim())))}
            onClick={() => { void run('quick') }} className="px-4 py-3 text-sm font-medium disabled:opacity-35">
            {busy ? 'Running your rule…' : reference ? 'Continue with the reference rule' : 'Run my rule'}
          </button>
          {fallbackOffered && <button type="button" disabled={busy} onClick={useReference} className="border border-edge px-4 py-3 text-sm">Use the reference rule</button>}
        </div>
      </>}
      {shownFrame && <CodePlayback frame={shownFrame} spec={phase === 'quick-intro' ? QUICK : spec} stage={phase === 'quick-intro' ? 'quick' : stage} reference={reference} />}
      {phase === 'play' && <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={() => setPaused((p) => !p)} className="min-h-11 border border-edge px-4 py-2">{paused ? 'Play' : 'Pause'}</button>
        <button type="button" onClick={() => { setPaused(true); advanceFrame() }} className="min-h-11 border border-edge px-4 py-2">Next action</button>
        {repair && <span className="text-ink-dim">Reference replay of this choice</span>}
      </div>}
      {phase === 'result' && <Scoreboard rows={[
        { id: 'clock', label: reference ? 'reference rule' : 'your function', value: L3.scores.clock, emphasis: true },
        { id: 'lru', label: 'LRU, exact recency', value: L3.scores.lru },
        { id: 'opt', label: 'OPT, perfect future', value: L3.scores.opt },
      ]} caption="Page faults on level three" />}
      {voice.lines.length > 0 && <Bubble key={voice.key} lines={voice.lines} index={voice.index} onNext={() => {
        if (phase === 'result' && line + 1 === lines.length - 1) setMachineState('neutral')
        setLine((i) => i + 1)
      }} onDone={done}
        doneLabel={phase === 'intro' ? 'Open the code' : phase === 'quick-intro' ? 'Watch the choices' : phase === 'quick-passed' ? 'Run the full tape' : phase === 'difference' ? 'Back to editor' : 'One more slot'} />}
      {phase === 'intro' && availability === 'checking' && line === INTRO.length - 1 && <p role="status" className="text-sm text-ink-dim">Preparing the code activity…</p>}
      {busy && phase !== 'editor' && <p role="status" className="text-sm text-ink-dim">Running your rule…</p>}
      {phase === 'difference' && fallbackOffered && <button type="button" onClick={useReference} className="self-start border border-edge px-4 py-3 text-sm">Use the reference rule</button>}
    </main>
  </>
}
