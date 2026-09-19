import { useEffect, useState } from 'react'
import { Bubble, useVoice } from '@/components/Bubble'
import { Choice } from '@/components/Choice'
import { Counter } from '@/components/Counter'
import { ProgressBar } from '@/components/ProgressBar'
import { Tape } from '@/components/Tape'
import { L3, pageColor } from '@/lib/levels'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'
import { COST_OPTIONS, GUIDE, RECENCY, guideBoard, guideReducer, initialGuide, type GuideAction } from '@/lib/act4'

/** Screen 9: exact recency, then learner-paced reference-bit inspections. */
export function Act4({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState(initialGuide)
  const beat = GUIDE[state.beat]
  const board = guideBoard(state)
  const speaking = state.line < beat.lines.length - 1
  const liveRun = beat.scene === 'run' || beat.scene === 'comparison'
  const exact = beat.scene === 'exact' || beat.scene === 'scale'
  const snapshotIndex = beat.id === 'exact' ? 0 : beat.id === 'hits' ? state.ticks : RECENCY.snapshots.length - 1
  const snapshot = RECENCY.snapshots[snapshotIndex]
  const frames = liveRun ? board.frames : RECENCY.frames
  const bits = liveRun ? board.bits : RECENCY.frames.map(() => 1)
  const input = !speaking && ['explore', 'inspect', 'evict'].includes(beat.action)
  const hitPage = beat.id === 'hits' && state.ticks > 0 ? snapshot.page
    : board.flashStep !== null ? L3.ref[board.flashStep - 1] : null

  // Two beats of the scan say nothing new: the learner is carrying out the
  // proposal the beat before them made, and that line stays up while they do.
  const voice = useVoice(state.error ? [state.error] : beat.lines,
    state.error ? 0 : state.line, `${beat.id}:${state.attempts}`)

  useEffect(() => {
    resetMachine()
    machineGate('act4:9:0')
  }, [])

  function send(action: GuideAction) {
    const next = guideReducer(state, action)
    if (next === state) return
    if (action.type === 'choose' || action.type === 'answer') learnerCommitted()
    setMachineState(next.reaction)
    // Explanations may react to the work just done. Disarm only at the next
    // input gate; explanatory bubbles and observed consequences are not new questions.
    const nextBeat = GUIDE[next.beat]
    if (next.beat !== state.beat && nextBeat && ['question', 'explore', 'inspect', 'evict'].includes(nextBeat.action)) {
      machineGate(`act4:9:${next.beat}`)
    }
    if (next.beat === GUIDE.length) return onDone()
    setState(next)
  }

  useEffect(() => {
    if (beat.action !== 'watch') return
    // Motion can be reduced without skipping the readable before/after states.
    const timer = setTimeout(() => send({ type: 'tick' }), 1000)
    return () => clearTimeout(timer)
  }, [state])

  const actionText = beat.action === 'explore'
    ? `Inspect each page · ${state.explored.length}/${L3.frames}`
    : beat.action === 'inspect' ? `Inspect page ${frames[board.hand]}`
    : beat.action === 'evict' ? `Choose a page to replace with page ${L3.ref[beat.pending! - 1]}` : null
  const lastCleared = board.cleared.at(-1)
  const eventText = beat.id === 'equal' ? 'Each page has the same bit. Tap to inspect it.'
    : lastCleared !== undefined ? `Inspected page ${frames[lastCleared]}: 1 → 0.`
    : board.flashStep !== null ? 'Page 3 used again: 0 → 1. No page fault.'
    : beat.id === 'loaded' ? 'Page 5 loaded: reference bit 1.'
    : beat.id === 'understood' ? 'Page 4 loaded: reference bit 1.' : ''

  return (
    <>
      <ProgressBar screen={9} />
      <main className="mx-auto flex lesson-content max-w-2xl flex-col justify-center gap-5 px-5 py-10 sm:gap-6 sm:py-12">
        <div className="lesson-activity">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              {liveRun ? 'Level three · one bit per page' : 'Exact recency has a price'}
            </p>
            {liveRun && <Counter faults={board.faults} named />}
          </div>

          {liveRun ? (
            <Tape tape={L3.ref} cursor={board.cursor} flashStep={board.flashStep} />
          ) : (
            <div className="flex min-h-16 items-center justify-between gap-3 field-border-disabled px-4 py-3" aria-live="polite">
              <p className="text-sm text-ink-dim">{exact ? 'Three resident pages' : 'One clue per resident page'}</p>
              {exact && snapshotIndex > 0 && (
                <span key={snapshotIndex} className="animate-[fade-in_240ms_ease-out] font-mono text-sm text-hit">
                  Page {snapshot.page} · hit
                </span>
              )}
            </div>
          )}

          <section aria-label={exact ? 'Exact recency records' : 'Reference bits'} className={speaking ? 'opacity-45 transition-opacity' : 'transition-opacity'}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">memory</p>
            <div className="grid grid-cols-3 gap-3">
              {frames.map((page, slot) => {
                const tappable = input && (beat.action !== 'inspect' || slot === board.hand)
                const marked = liveRun && beat.hand && board.hand === slot
                const label = page === null ? `Empty slot ${slot + 1}`
                  : tappable ? `${beat.action === 'evict' ? 'Evict' : 'Inspect'} page ${page}`
                  : `Page ${page}, ${exact ? `last used at request ${snapshot.lastUsed[slot]}` : `reference bit ${bits[slot]}`}`
                return (
                  <div key={slot} className="min-w-0">
                    <div className="mb-1 flex h-6 items-center justify-center text-[10px] text-focus sm:text-xs" aria-hidden="true">
                      {marked ? '↓ inspect next' : ''}
                    </div>
                    <button
                      type="button"
                      disabled={!tappable}
                      onClick={() => send({ type: 'choose', slot })}
                      aria-label={label}
                      className={[
                        'memory-slot',
                        'relative flex min-h-32 w-full flex-col items-center justify-center gap-3 px-1 py-3 transition-all duration-300 sm:min-h-40',
                        page === null ? 'border-2 border-dashed border-edge' : '',
                        tappable ? 'cursor-pointer ring-2 ring-focus focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink' : '',
                        hitPage === page && page !== null ? 'ring-2 ring-hit ring-offset-4 ring-offset-surface' : '',
                      ].join(' ')}
                      style={page === null ? undefined : { background: pageColor(page), color: 'var(--color-page-ink)' }}
                    >
                      <span className="font-mono text-3xl font-semibold">{page ?? '·'}</span>
                      {page !== null && (
                        <span key={`${exact}:${exact ? snapshot.lastUsed[slot] : bits[slot]}`} className="flex animate-[fade-in_300ms_ease-out] flex-col items-center gap-1 font-mono">
                          <span className="text-[9px] uppercase tracking-wide sm:text-[10px]">{exact ? 'last used' : 'reference bit'}</span>
                          <span className={`px-3 py-0.5 text-lg font-semibold tabular-nums ${exact ? '' : 'bg-ground/15'}`}>
                            {exact ? snapshot.lastUsed[slot] : bits[slot]}
                          </span>
                        </span>
                      )}
                      {beat.action === 'explore' && state.explored.includes(slot) && (
                        <span className="text-[10px]">inspected</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            {beat.scene === 'scale' && (
              <div className="mt-4 grid animate-[fade-in_400ms_ease-out] grid-cols-6 gap-2" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex h-8 items-center gap-1 field-border-disabled px-2" style={{ opacity: 0.65 - Math.floor(i / 6) * 0.15 }}>
                    <span className="h-2 w-2 bg-ink-faint" /><span className="h-1 flex-1 bg-ink-faint" />
                  </div>
                ))}
              </div>
            )}

            {liveRun && (
              <p className="mt-3 min-h-5 text-center text-xs text-ink-dim" role="status">{eventText}</p>
            )}
          </section>

          {beat.scene === 'comparison' && (
            <div className="flex items-center justify-between gap-3 field-border-disabled p-4 text-sm">
              <div><p className="text-ink-dim">Exact recency</p><p className="mt-1 font-mono text-xs">{RECENCY.snapshots.at(-1)!.lastUsed.join(' → ')}</p></div>
              <span className="text-ink-faint" aria-hidden="true">→</span>
              <div><p className="text-ink-dim">Cheap evidence</p><p className="mt-1 font-mono text-xs">used again? 1 / 0</p></div>
            </div>
          )}
        </div>

        <div className="min-h-40">
          <Bubble
            key={voice.key}
            lines={voice.lines}
            index={voice.index}
            onNext={() => send({ type: 'next' })}
            onDone={beat.action === 'continue' ? () => send({ type: 'next' }) : undefined}
            doneLabel={beat.label ?? 'Got it'}
          />
          {actionText && !speaking && (
            <p className="mt-4 text-center text-sm text-ink-dim">{actionText}</p>
          )}
        </div>

        {beat.action === 'question' && (
          <Choice options={COST_OPTIONS} chosen={null} disabled={speaking} onChoose={(id) => send({ type: 'answer', id })} />
        )}
      </main>
    </>
  )
}
