import { useEffect, useReducer, useRef } from 'react'
import { Bubble } from '@/components/Bubble'
import { Choice } from '@/components/Choice'
import { ProgressBar } from '@/components/ProgressBar'
import { TransferBoard } from '@/components/TransferBoard'
import { initialTransfer, OPTIONS, QUESTIONS, transferLines, transferReducer, type TransferAction } from '@/lib/transfer'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'
import { transferFace } from '@/lib/portrait-cues'

/** The final screen: three commitments, then the closing question without a recap. */
export function Act7() {
  const [state, dispatch] = useReducer(transferReducer, undefined, initialTransfer)
  const question = useRef<HTMLElement>(null)
  useEffect(() => { resetMachine() }, [])
  useEffect(() => {
    setMachineState('neutral')
    machineGate(`act7:14:${state.stage}`)
  }, [state.stage])
  const portrait = transferFace(state)
  useEffect(() => { setMachineState(portrait) }, [portrait, state.stage])
  useEffect(() => {
    if (state.phase === 'question') question.current?.focus({ preventScroll: true })
  }, [state.stage, state.phase])

  function send(action: TransferAction) {
    const next = transferReducer(state, action)
    if (next === state) return
    if (action.type === 'choose') {
      learnerCommitted()
    }
    dispatch(action)
  }
  const choicesVisible = state.phase === 'question' || state.phase === 'wrong' || state.phase === 'correct'
  const doneLabel = state.phase === 'intro' ? 'Consider the evidence' : state.phase === 'wrong' ? 'Try again'
    : state.stage === 'evidence' ? 'Compare the two tasks' : state.stage === 'pattern' ? 'Choose a rule for B' : 'Continue'
  return <>
    <ProgressBar screen={14} />
    <main className="mx-auto flex lesson-content max-w-2xl flex-col justify-center gap-6 px-5 py-10 sm:py-12">
      <section ref={question} tabIndex={-1} aria-label={state.phase === 'ending' ? 'Closing question' : QUESTIONS[state.stage][0]} className="flex min-w-0 flex-col gap-[inherit] outline-none">
        <div className="lesson-activity">
          <h1 className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">From pages to files</h1>
          <TransferBoard state={state} />
          {choicesVisible && <Choice options={OPTIONS[state.stage]} chosen={state.chosen} disabled={state.phase !== 'question'}
            onChoose={(id) => send({ type: 'choose', id })} />}
        </div>
        <Bubble key={`${state.stage}:${state.phase}:${state.chosen}`} lines={transferLines(state)} index={state.line}
          onNext={() => send({ type: 'next' })}
          onDone={state.phase === 'question' || state.phase === 'ending' ? undefined : () => send({ type: 'next' })}
          doneLabel={doneLabel} />
      </section>
    </main>
  </>
}
