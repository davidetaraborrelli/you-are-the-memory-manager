import { Bubble, useVoice } from './Bubble'
import { DIFFERENCES, canReplay, leakLines, type LeakAction, type LeakState } from '@/lib/leak'

export function LeakControls({ state, dispatch, onDone }: { state: LeakState; dispatch: (action: LeakAction) => void; onDone: () => void }) {
  // The replay of a request and the walk through the accounting both tick
  // along on their own. Neither has a line, so both keep the one that sent
  // them off, and neither offers the button that belonged to it.
  const voice = useVoice(leakLines(state), state.error ? 0 : state.line, `${state.phase}:${state.step}:${state.error}`)
  const doneLabel = state.phase === 'found' ? 'Rewind both runs' : state.phase === 'ready' ? 'Replay request 4'
    : state.phase === 'explain' ? state.step < 8 ? `Replay request ${state.step + 1}` : 'Compare the costs'
    : state.phase === 'account-ready' ? 'Review differing requests' : state.phase === 'summary' ? 'Continue' : 'Try the same test with LRU'
  return <>
    {voice.lines.length > 0 && <Bubble key={voice.key} lines={voice.lines} index={voice.index}
      onNext={() => dispatch({ type: 'next' })}
      onDone={voice.held || state.phase === 'search' ? undefined : state.phase === 'bridge' ? onDone : () => dispatch({ type: 'next' })}
      doneLabel={doneLabel} />}
    {canReplay(state) && <button type="button" onClick={() => dispatch({ type: 'replay' })} className="self-start border border-edge px-4 py-3 text-sm">Replay explanation</button>}
  </>
}

/** Activity content shares the reserved area above the tutor. */
export function LeakActivity({ state, dispatch }: { state: LeakState; dispatch: (action: LeakAction) => void }) {
  const running = state.phase === 'play' || state.phase === 'account'
  const accounting = ['account', 'summary', 'bridge'].includes(state.phase)
  const saved = DIFFERENCES.filter((row) => row.saved).length
  const added = DIFFERENCES.length - saved
  return <>
    {running && <div className="flex flex-wrap gap-3">
      <button type="button" className="border border-edge px-4 py-3 text-sm" onClick={() => dispatch({ type: 'pause' })}>{state.paused ? 'Play' : 'Pause'}</button>
      <button type="button" className="border border-edge px-4 py-3 text-sm" onClick={() => dispatch({ type: 'step' })}>{state.phase === 'account' ? 'Next comparison' : 'Next action'}</button>
    </div>}
    {accounting && <table className="w-full border-collapse text-left text-xs sm:text-sm">
      <caption className="pb-2 text-left text-ink-dim">Requests with different outcomes</caption>
      <thead><tr><th scope="col" className="py-2">Request · page</th><th scope="col">3 frames</th><th scope="col">4 frames</th><th scope="col">Extra frame</th></tr></thead>
      <tbody>{DIFFERENCES.slice(0, state.compared).map((row) => <tr key={row.step} className={`border-t border-edge ${state.phase === 'account' && state.step === row.step ? 'bg-surface-hi' : ''}`}>
        <th scope="row" className="py-3 font-mono font-normal">{row.step} · {row.page}</th>
        <td>{row.smallHit ? 'hit' : 'fault'}</td><td>{row.bigHit ? 'hit' : 'fault'}</td><td>{row.saved ? 'saves' : 'costs'} 1 fault</td>
      </tr>)}</tbody>
    </table>}
    {['summary', 'bridge'].includes(state.phase) && <p className="text-sm">{added} faults added − {saved} faults saved = {added - saved} extra fault</p>}
    {state.phase === 'bridge' && <p className="field-border-disabled p-4 text-sm">More frames causing more page faults is <strong>Belady's anomaly.</strong></p>}
  </>
}
