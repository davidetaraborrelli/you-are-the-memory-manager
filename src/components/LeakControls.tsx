import { Bubble } from './Bubble'
import { DIFFERENCES, canReplay, leakLines, type LeakAction, type LeakState } from '@/lib/leak'

export function LeakControls({ state, dispatch, onDone }: { state: LeakState; dispatch: (action: LeakAction) => void; onDone: () => void }) {
  const lines = leakLines(state)
  const running = state.phase === 'play' || state.phase === 'account'
  const accounting = ['account', 'summary', 'bridge'].includes(state.phase)
  const saved = DIFFERENCES.filter((row) => row.saved).length
  const added = DIFFERENCES.length - saved
  const doneLabel = state.phase === 'found' ? 'Rewind both runs' : state.phase === 'ready' ? 'Replay request 4'
    : state.phase === 'explain' ? state.step < 8 ? `Replay request ${state.step + 1}` : 'Compare the costs'
    : state.phase === 'account-ready' ? 'Review differing requests' : state.phase === 'summary' ? 'Continue' : 'Try the same test with LRU'
  return <>
    {running && <div className="flex flex-wrap gap-3">
      <button type="button" className="rounded-lg border border-edge px-4 py-3 text-sm" onClick={() => dispatch({ type: 'pause' })}>{state.paused ? 'Play' : 'Pause'}</button>
      <button type="button" className="rounded-lg border border-edge px-4 py-3 text-sm" onClick={() => dispatch({ type: 'step' })}>{state.phase === 'account' ? 'Next comparison' : 'Next action'}</button>
    </div>}
    {accounting && <table className="w-full border-collapse text-left text-xs sm:text-sm">
      <caption className="pb-2 text-left text-ink-dim">Requests with different outcomes</caption>
      <thead><tr><th scope="col" className="py-2">Request · page</th><th scope="col">3 frames</th><th scope="col">4 frames</th><th scope="col">Extra frame</th></tr></thead>
      <tbody>{DIFFERENCES.slice(0, state.compared).map((row) => <tr key={row.step} className={`border-t border-edge ${state.phase === 'account' && state.step === row.step ? 'bg-surface-hi' : ''}`}>
        <th scope="row" className="py-3 font-mono font-normal">{row.step} · {row.page}</th>
        <td>{row.smallHit ? 'hit' : 'fault'}</td><td>{row.bigHit ? 'hit' : 'fault'}</td><td>{row.saved ? 'saves' : 'costs'} 1 fault</td>
      </tr>)}</tbody>
    </table>}
    {['summary', 'bridge'].includes(state.phase) && <p className="text-sm">{saved} faults saved − {added} faults added = {added - saved} extra fault</p>}
    {state.phase === 'bridge' && <p className="rounded-xl border border-edge bg-surface p-4 text-sm">More frames causing more page faults is <strong>Belady's anomaly.</strong></p>}
    {lines.length > 0 && <Bubble key={`${state.phase}:${state.step}:${state.error}`} lines={lines} index={state.error ? 0 : state.line}
      onNext={() => dispatch({ type: 'next' })}
      onDone={state.phase === 'search' ? undefined : state.phase === 'bridge' ? onDone : () => dispatch({ type: 'next' })}
      doneLabel={doneLabel} />}
    {canReplay(state) && <button type="button" onClick={() => dispatch({ type: 'replay' })} className="self-start rounded-lg border border-edge px-4 py-3 text-sm">Replay explanation</button>}
  </>
}
