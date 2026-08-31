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
}: {
  tape: number[]
  /** Index of the request being served right now. */
  cursor: number
  reveal?: boolean
  /** 1-based step to flash green — a hit that just passed for free. */
  flashStep?: number | null
  /** Draw the eye to the hidden future while the voice is talking about it. */
  pulseMask?: boolean
}) {
  return (
    <div className="tape">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        requests
      </p>
      <div className="relative overflow-hidden py-3">
      {/* The marker the tape runs under. */}
      <div
        className="pointer-events-none absolute inset-y-3 left-[var(--tape-anchor)] z-10 w-[calc(var(--pitch)-0.5rem)] rounded-md ring-2 ring-focus"
        aria-hidden
      />
      <div
        className="flex gap-2 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(calc(var(--tape-anchor) - ${cursor} * var(--pitch)))` }}
      >
        {tape.map((page, i) => {
          const past = i < cursor
          const now = i === cursor
          const hidden = i > cursor && !reveal
          const flash = flashStep !== null && i === flashStep - 1
          return (
            <div
              key={i}
              className={[
                'grid aspect-square w-[calc(var(--pitch)-0.5rem)] shrink-0 select-none place-items-center rounded-md',
                'font-mono text-sm transition-all duration-300',
                hidden ? 'border border-dashed border-edge bg-surface' : '',
                hidden && pulseMask ? 'animate-[mask-pulse_1.4s_ease-in-out_infinite]' : '',
                past ? 'scale-90 opacity-70' : '',
                now ? 'scale-105 font-semibold' : '',
                flash ? 'ring-2 ring-hit' : '',
              ].join(' ')}
              style={
                hidden
                  ? undefined
                  : { background: pageColor(page), color: 'var(--color-ground)' }
              }
              aria-hidden={hidden}
            >
              {hidden ? '' : page}
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
