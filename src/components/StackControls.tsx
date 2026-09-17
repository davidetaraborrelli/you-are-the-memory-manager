import { Bubble, useVoice } from './Bubble'
import { Choice } from './Choice'
import { BELADY } from '@/lib/levels'
import { OPTIONS, canReplayStack, stackEvidence, stackLines, stackResults, stackStepLabel, type StackAction, type StackState } from '@/lib/stack'

export function StackControls({ state, dispatch, onDone }: {
  state: StackState; dispatch: (action: StackAction) => void; onDone: () => void
}) {
  // The check runs itself through the whole tape with nothing to add, so the
  // line that asked the learner to watch it stays up until it is over.
  const voice = useVoice(stackLines(state), state.line, state.phase)
  const evidence = stackEvidence(state)
  const results = stackResults(state)
  const doneLabel = state.phase === 'intro' ? 'Run the same test' : state.phase === 'feedback' ? 'Try again'
    : state.phase === 'explain' ? 'Compare the totals' : state.phase === 'result' ? 'Continue' : 'Try a different setting'
  return <>
    {evidence && <div className="space-y-2 text-sm" role="status" aria-live="polite" aria-atomic="true">
      <p className="font-mono text-ink-dim">States checked: {evidence.checked} / {BELADY.length}</p>
      {evidence.complete ? <p className="field-border-disabled p-4">
        {BELADY.length} / {BELADY.length} states: every page in the 3-frame memory was also in the 4-frame memory
      </p> : <>
        <p>{evidence.match}</p>
        <p className="min-h-5 text-ink-dim">{evidence.allMatched ? 'Every page is also in the larger memory' : '\u00a0'}</p>
      </>}
    </div>}
    {state.phase === 'checking' && <div className="flex flex-wrap gap-3">
      {!state.reduced && <button type="button" onClick={() => dispatch({ type: 'pause' })} className="min-h-11 border border-edge px-4 py-3 text-sm">{state.paused ? 'Play' : 'Pause'}</button>}
      <button type="button" onClick={() => dispatch({ type: 'step' })} className="min-h-11 border border-edge px-4 py-3 text-sm">{stackStepLabel(state)}</button>
    </div>}
    {(state.phase === 'question' || state.phase === 'feedback') && <Choice options={OPTIONS}
      chosen={state.chosen} disabled={state.phase !== 'question'} onChoose={(id) => dispatch({ type: 'choose', id })} />}
    {results && <table className="w-full border-collapse text-right text-sm">
      <caption className="pb-2 text-left text-ink-dim">Page faults on this tape</caption>
      <thead><tr><th scope="col" className="py-2 text-left">Memory</th><th scope="col">LRU</th><th scope="col">OPT<br /><span className="text-xs font-normal text-ink-dim">Minimum possible</span></th></tr></thead>
      <tbody>{results.map((row) => <tr key={row.frames} className="border-t border-edge">
        <th scope="row" className="py-2 text-left font-normal">{row.frames} frames</th>
        <td className="font-mono text-lg font-semibold">{row.lru}</td><td className="font-mono text-ink-dim">{row.opt}</td>
      </tr>)}</tbody>
    </table>}
    {voice.lines.length > 0 && <Bubble key={voice.key} lines={voice.lines} index={voice.index} onNext={() => dispatch({ type: 'next' })}
      onDone={voice.held || state.phase === 'question' ? undefined : state.phase === 'bridge' ? onDone : () => dispatch({ type: 'next' })}
      doneLabel={doneLabel} />}
    {canReplayStack(state) && <button type="button" onClick={() => dispatch({ type: 'replay' })}
      className="min-h-11 self-start border border-edge px-4 py-3 text-sm">Replay the check</button>}
  </>
}
