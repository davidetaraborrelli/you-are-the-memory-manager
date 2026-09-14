import { useEffect, useReducer, useState } from 'react'
import { Bubble } from '@/components/Bubble'
import { Choice } from '@/components/Choice'
import { ProgressBar } from '@/components/ProgressBar'
import { BeladyBoard } from '@/components/BeladyBoard'
import { LeakControls } from '@/components/LeakControls'
import { BELADY } from '@/lib/levels'
import { initialLeak, leakReducer, leakBoard, searchEnabled, type LeakAction } from '@/lib/leak'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'
import { OPEN, PREDICTIONS, RESULT, canPredict, comparisonBoard, comparisonReducer,
  comparisonResults, initialComparison, ruleLabel } from '@/lib/act6'

/** Screens 11–12 share their tape and memory banks throughout. */
export function Act6({ reference, onDone, initialInspect = false }: { reference: boolean; onDone: () => void; initialInspect?: boolean }) {
  const [investigate, setInvestigate] = useState(initialInspect)
  const [leak, sendLeak] = useReducer(leakReducer, undefined,
    () => initialLeak(window.matchMedia('(prefers-reduced-motion: reduce)').matches))
  const [state, dispatch] = useReducer(comparisonReducer, undefined,
    () => initialComparison(window.matchMedia('(prefers-reduced-motion: reduce)').matches))
  useEffect(() => { resetMachine(); machineGate('act6:11') }, [])
  useEffect(() => {
    if (investigate) { setMachineState('neutral'); machineGate('act6:12') }
  }, [investigate])
  useEffect(() => {
    if (!investigate || leak.paused || !['play', 'account'].includes(leak.phase)) return
    const timer = window.setTimeout(() => sendLeak({ type: 'tick' }), leak.phase === 'account' ? 1200 : 650)
    return () => window.clearTimeout(timer)
  }, [investigate, leak.phase, leak.paused, leak.step, leak.frame, leak.compared])
  useEffect(() => {
    if (state.phase !== 'run' || state.paused) return
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), 850)
    return () => window.clearTimeout(timer)
  }, [state.phase, state.paused, state.step])

  function predict(id: string) {
    if (comparisonReducer(state, { type: 'predict', id }) === state) return
    learnerCommitted()
    setMachineState('withholding')
    dispatch({ type: 'predict', id })
  }

  function dispatchLeak(action: LeakAction) {
    const next = leakReducer(leak, action)
    if (next === leak) return
    if (action.type === 'choose') {
      learnerCommitted()
      setMachineState(next.answer ? 'approval' : 'correction')
    } else if (action.type === 'select') setMachineState('neutral')
    sendLeak(action)
  }

  function comparisonView(size: 'small' | 'big') {
    const board = comparisonBoard(state, size)
    const event = board.event
    return { frames: board.frames, faults: board.faults, slot: event?.slot, hit: event?.outcome === 'hit',
      caption: !event ? 'Ready for the same requests.' : event.outcome === 'hit'
        ? `Hit: page ${event.page} was already here.` : event.outcome === 'fill'
        ? `Page fault: page ${event.page} fills an empty frame.` : `Page fault: page ${event.page} replaces page ${event.victim}.` }
  }

  const results = comparisonResults(state)
  const showOpt = results?.[0].opt !== null && results?.[0].opt !== undefined
  const lines = state.phase === 'intro' ? OPEN : state.phase === 'result' ? RESULT
    : ["Let's run both memories on the same tape."]
  const boardDimmed = state.phase === 'intro' && !canPredict(state)
  return <>
    <ProgressBar screen={investigate ? 12 : 11} />
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-5 py-10 sm:py-12">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">{investigate ? 'Find the leak' : 'One more slot'}</p>
      <BeladyBoard
        small={investigate ? leakBoard(leak, 'small') : comparisonView('small')}
        big={investigate ? leakBoard(leak, 'big') : comparisonView('big')}
        step={investigate ? leak.step : state.step} rule={ruleLabel(reference)}
        caption={investigate && leak.phase === 'play'
          ? `During request ${leak.step}: page ${BELADY.ref[leak.step - 1]}. Each row shows its recorded actions.`
          : (investigate ? leak.step : state.step) === 0 ? 'Both memories start empty.'
          : `After request ${investigate ? leak.step : state.step} of ${BELADY.length}: page ${BELADY.ref[(investigate ? leak.step : state.step) - 1]}`}
        dimmed={investigate ? leak.phase === 'search' && !searchEnabled(leak) : boardDimmed}
        slots={!investigate && state.phase === 'intro' && state.line === 0}
        reveal={investigate || state.phase === 'result'}
        onSelect={investigate ? (step) => dispatchLeak({ type: 'select', step }) : undefined}
        searchEnabled={investigate && searchEnabled(leak)}
        onChoose={investigate ? (page) => dispatchLeak({ type: 'choose', page }) : undefined}
      />
      {investigate ? <LeakControls state={leak} dispatch={dispatchLeak} onDone={onDone} /> : <>
      {state.phase === 'intro' && <Choice options={PREDICTIONS} chosen={null} disabled={!canPredict(state)} onChoose={predict} />}
      {state.prediction && <p className="text-sm text-ink-dim">Your prediction: <span className="text-ink">{PREDICTIONS.find((p) => p.id === state.prediction)?.label}</span></p>}
      {state.phase === 'run' && <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => dispatch({ type: 'pause' })} className="rounded-lg border border-edge px-4 py-3 text-sm">{state.paused ? 'Play' : 'Pause'}</button>
        <button type="button" onClick={() => dispatch({ type: 'step' })} className="rounded-lg border border-edge px-4 py-3 text-sm">Next request</button>
      </div>}
      {results && <table className="w-full border-collapse text-right text-sm">
        <caption className="pb-2 text-left text-ink-dim">Page faults on this tape</caption>
        <thead><tr><th scope="col" className="py-2 text-left">Memory</th><th scope="col">Clock</th>{showOpt && <th scope="col">OPT<br /><span className="text-xs font-normal text-ink-dim">Minimum possible</span></th>}</tr></thead>
        <tbody>{results.map((row) => <tr key={row.frames} className="border-t border-edge">
          <th scope="row" className="py-2 text-left font-normal">{row.frames} frames</th>
          <td className="font-mono text-lg font-semibold">{row.clock}</td>{showOpt && <td className="font-mono text-ink-dim">{row.opt}</td>}
        </tr>)}</tbody>
      </table>}
      <Bubble key={state.phase} lines={lines} index={state.line} onNext={() => dispatch({ type: 'next' })}
        onDone={state.phase === 'result' ? () => setInvestigate(true) : undefined} doneLabel="Compare the two runs" />
      </>}
    </main>
  </>
}
