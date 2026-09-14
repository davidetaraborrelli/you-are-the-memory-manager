import { Tape } from './Tape'
import { BELADY, pageColor } from '@/lib/levels'
import type { MemoryView } from '@/lib/leak'

/** One board persists across the experiment, investigation and explanation. */
export function BeladyBoard({ small, big, step, caption, rule, dimmed = false, slots = false,
  reveal = false, onSelect, searchEnabled = false, onChoose }: {
  small: MemoryView; big: MemoryView; step: number; caption: string; rule: string
  dimmed?: boolean; slots?: boolean; reveal?: boolean
  onSelect?: (step: number) => void; searchEnabled?: boolean; onChoose?: (page: number) => void
}) {
  return <section aria-label="Same tape with two memory sizes" className={`space-y-4 transition-opacity ${dimmed ? 'opacity-40' : ''}`}>
    <p className="text-sm text-ink-dim">{rule}</p>
    <Tape tape={BELADY.ref} cursor={Math.max(0, step - 1)} reveal={reveal} fit={reveal}
      onSelect={onSelect} selectionDisabled={!searchEnabled} />
    <p className="text-sm text-ink-dim" role="status">{caption}</p>
    {onSelect && <div className="flex flex-wrap items-center gap-3">
      <button type="button" aria-label="Previous request" disabled={!searchEnabled || step <= 1} onClick={() => onSelect(step - 1)} className="min-h-11 rounded-lg border border-edge px-3 text-sm disabled:opacity-35">Previous</button>
      <input type="range" min={1} max={BELADY.length} step={1} value={step} disabled={!searchEnabled}
        aria-label="Compare memories after request" aria-valuetext={`After request ${step} of ${BELADY.length}, page ${BELADY.ref[step - 1]}`}
        onChange={(event) => onSelect(Number(event.target.value))} className="h-11 min-w-24 flex-1 accent-[var(--color-focus)]" />
      <button type="button" aria-label="Next request on timeline" disabled={!searchEnabled || step >= BELADY.length} onClick={() => onSelect(step + 1)} className="min-h-11 rounded-lg border border-edge px-3 text-sm disabled:opacity-35">Next</button>
    </div>}
    {([small, big]).map((view, i) => {
      const label = `${view.frames.length} ${slots ? 'slots' : 'frames'}`
      return <section key={i} aria-label={label} className="rounded-xl border border-edge bg-surface p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <h2 className="font-medium">{label}</h2>
          {view.faults !== undefined && <span className="font-mono tabular-nums">{view.faults} page faults</span>}
        </div>
        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${view.frames.length}, minmax(0, 1fr))` }}>
          {view.frames.map((page, slot) => <div key={slot} className="min-w-0">
            {view.hand !== undefined && <p className="mb-1 h-5 text-center text-xs text-focus">{view.hand === slot ? '↓ hand' : ''}</p>}
            <button type="button" disabled={!onChoose || !searchEnabled || i !== 0 || page === null}
              onClick={() => page !== null && onChoose?.(page)}
              aria-label={`${label}, slot ${slot + 1}: ${page === null ? 'empty' : `page ${page}`}${view.bits ? `, bit ${view.bits[slot]}` : ''}${view.hand === slot ? ', hand here' : ''}`}
              className={`flex min-h-16 w-full min-w-11 flex-col items-center justify-center rounded-lg font-mono text-2xl font-semibold sm:min-h-20 ${page === null ? 'border-2 border-dashed border-edge' : ''} ${onChoose && searchEnabled && i === 0 && page !== null ? 'cursor-pointer hover:ring-2 hover:ring-focus' : ''} ${page !== null && view.dimPages?.includes(page) ? 'opacity-35' : ''} ${view.slot === slot || view.focusPage === page ? `ring-2 ring-offset-2 ring-offset-surface ${view.hit ? 'ring-hit' : 'ring-focus'}` : ''}`}
              style={page === null ? undefined : { background: pageColor(page), color: 'var(--color-ground)' }}>
              <span>{page ?? '·'}</span>
              {view.bits && page !== null && <span key={`${step}:${view.bits[slot]}`} className="animate-[fade-in_250ms_ease-out] text-xs font-normal">bit {view.bits[slot]}</span>}
            </button>
          </div>)}
        </div>
        <p className="sr-only" role="status">{label} contains: {view.frames.filter((page) => page !== null).join(', ') || 'no pages'}.</p>
        {view.caption && <p className="mt-3 min-h-5 text-xs text-ink-dim" role="status">{view.caption}</p>}
      </section>
    })}
  </section>
}
