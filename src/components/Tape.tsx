import type { CSSProperties } from 'react'
import { pageColor } from '@/lib/levels'

/**
 * The request tape: past behind, the current request under the marker, the
 * future masked.
 *
 * The mask is the whole reason the lesson works. The learner cannot see what is
 * coming, so blindness is something they feel rather than something they are
 * told — and when it lifts on screen 8 the reveal costs no words. `reveal`
 * is that switch, and screens 1–4 never set it.
 */
export function Tape({
  tape,
  cursor,
  reveal = false,
  flashStep = null,
  pulseMask = false,
  lit = false,
  fit = false,
  markSteps = null,
  onSelect,
  selectionDisabled = false,
}: {
  tape: number[]
  /** Index of the request being served right now. */
  cursor: number
  reveal?: boolean
  /** 1-based step to flash green — a hit that just passed for free. */
  flashStep?: number | null
  /** Draw the eye to the hidden future while the voice is talking about it. */
  pulseMask?: boolean
  /**
   * The voice is pointing at this region right now. The label comes up to full
   * strength, so "this strip" lands on a strip that says `requests` back.
   */
  lit?: boolean
  /**
   * Show the whole tape at once, with no marker and nothing clipped. Long
   * tapes wrap into two rows on phones, read left to right, then top to bottom.
   *
   * Screen 8 proves the floor by pointing at the first appearance of each page,
   * and on level 1 three of those are at steps 1, 2 and 3 while the run has
   * ended at step 14. Under the running layout the strip is translated by the
   * cursor and everything left of the anchor is clipped, so the proof would
   * have been an argument about cells nobody could see.
   */
  fit?: boolean
  /**
   * 1-based steps to ring. Everything unmarked steps back, so a claim about
   * four particular requests is drawn as four particular requests.
   */
  markSteps?: number[] | null
  /** Completed-run inspector, using 1-based post-request positions. */
  onSelect?: (step: number) => void
  selectionDisabled?: boolean
}) {
  const marks = markSteps ?? []

  /** One request. Identical in both layouts except for how wide it may be. */
  const cell = (page: number, i: number) => {
    if (onSelect) return <button key={i} type="button" disabled={selectionDisabled}
      onClick={() => onSelect(i + 1)} aria-label={`After request ${i + 1}, page ${page}`}
      aria-pressed={i === cursor}
      className={`tape-cell flex min-h-11 flex-col items-center justify-center font-mono text-sm ${i === cursor ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface font-semibold' : ''}`}
      style={{ background: pageColor(page), color: 'var(--color-page-ink)' }}>
      <span className="text-[9px]">{i + 1}</span><span>{page}</span>
    </button>
    const past = !fit && i < cursor
    const now = !fit && i === cursor
    const hidden = i > cursor && !reveal
    const flash = flashStep !== null && i === flashStep - 1
    const marked = marks.includes(i + 1)
    return (
      <div
        key={i}
        className={[
          'tape-cell grid aspect-square shrink-0 select-none place-items-center ',
          'font-mono transition-all duration-300',
          fit ? 'w-full text-xs' : 'w-[calc(var(--pitch)-0.5rem)] text-sm',
          hidden ? 'border border-dashed border-edge bg-surface' : '',
          hidden && pulseMask ? 'animate-[mask-pulse_1.4s_ease-in-out_infinite]' : '',
          past ? 'scale-90 opacity-70' : '',
          now ? 'scale-105 font-semibold' : '',
          flash ? 'ring-2 ring-hit' : '',
          // A mark outranks the running styles: while the voice is pointing at
          // four requests, those four are the only thing on the strip that is
          // not stepping back.
          marked ? 'scale-105 opacity-100 ring-2 ring-focus' : '',
          marks.length > 0 && !marked ? 'opacity-25' : '',
        ].join(' ')}
        style={hidden ? undefined : { background: pageColor(page), color: 'var(--color-page-ink)' }}
        aria-hidden={hidden}
      >
        {hidden ? '' : page}
      </div>
    )
  }

  return (
    <div className="tape">
      <p
        className={`mb-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300 ${
          lit ? 'text-ink' : 'text-ink-faint'
        }`}
      >
        requests
      </p>
      {onSelect ? <div className="grid grid-cols-4 gap-2 py-3 sm:grid-cols-12">{tape.map(cell)}</div> : fit ? (
        <div
          className="grid grid-cols-[repeat(var(--mobile-columns),minmax(0,1fr))] gap-1 py-3 sm:grid-cols-[repeat(var(--tape-columns),minmax(0,1fr))]"
          style={{ '--mobile-columns': tape.length > 8 ? Math.ceil(tape.length / 2) : tape.length, '--tape-columns': tape.length } as CSSProperties}
        >
          {tape.map(cell)}
        </div>
      ) : (
        <div className="relative overflow-hidden py-3">
          {/* The marker the tape runs under. */}
          <div
            className="pointer-events-none absolute inset-y-3 left-[var(--tape-anchor)] z-10 w-[calc(var(--pitch)-0.5rem)] ring-2 ring-focus"
            aria-hidden
          />
          <div
            className="flex gap-2 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(calc(var(--tape-anchor) - ${cursor} * var(--pitch)))` }}
          >
            {tape.map(cell)}
          </div>
        </div>
      )}
    </div>
  )
}
