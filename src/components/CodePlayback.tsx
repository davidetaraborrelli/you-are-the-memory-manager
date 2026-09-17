import type { PlaybackFrame, RunSpec } from '@/lib/code-lesson'
import { pageColor } from '@/lib/levels'
import { Counter } from './Counter'
import { Tape } from './Tape'

export function CodePlayback({ frame, spec, stage, reference }: {
  frame: PlaybackFrame; spec: RunSpec; stage: 'quick' | 'full'; reference: boolean
}) {
  return <section className="space-y-4" aria-label={stage === 'quick' ? 'Two-choice rule check' : 'Level three run'}>
    <div className="flex items-center justify-between gap-3 text-xs text-ink-dim">
      <p>{stage === 'quick' ? `Choice ${frame.step} of ${spec.ref.length}` : 'Level three'} · {reference ? 'reference rule' : 'your function'}</p>
      {stage === 'full' && <Counter faults={frame.faults} named />}
    </div>
    <Tape tape={spec.ref} cursor={frame.step - 1} flashStep={frame.hit && frame.kind === 'resolved' ? frame.step : null} />
    <p className="text-sm text-ink-dim">Incoming page: <span className="font-mono text-ink">{spec.ref[frame.step - 1]}</span></p>
    <div className="grid grid-cols-3 gap-3">
      {frame.frames.map((page, slot) => <div key={slot} className="min-w-0">
        <p className="mb-1 h-5 text-center text-[10px] text-focus">{slot === frame.hand ? '↓ cursor' : ''}</p>
        <div className={`field-border-disabled flex min-h-28 flex-col items-center justify-center gap-2 py-3 transition-all duration-200 ${page === null ? 'border-2 border-dashed border-edge' : ''} ${frame.slot === slot ? `ring-2 ring-offset-2 ring-offset-surface ${frame.kind === 'return' ? 'ring-fault' : frame.hit ? 'ring-hit' : 'ring-focus'}` : ''}`}
          style={page === null ? undefined : { background: pageColor(page), color: 'var(--color-page-ink)' }}
          aria-label={`Slot ${slot}, ${page === null ? 'empty' : `page ${page}, bit ${frame.bits[slot]}`}`}>
          <span className="font-mono text-3xl font-semibold">{page ?? '·'}</span>
          {page !== null && <span key={frame.bits[slot]} className="animate-[fade-in_250ms_ease-out] font-mono text-sm">bit {frame.bits[slot]}</span>}
        </div>
        <p className="mt-1 text-center font-mono text-[10px] text-ink-faint">slot {slot}</p>
      </div>)}
    </div>
    <p role="status" className="min-h-6 text-center text-sm text-ink-dim">{frame.caption}</p>
  </section>
}
