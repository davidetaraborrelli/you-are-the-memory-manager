import { pageColor } from '@/lib/levels'
import type { Awaiting, TileStats } from '@/lib/game'

/**
 * The three frames. Big tap targets, because this is the only control the
 * learner has and it has to work with a thumb.
 *
 * Colour carries page *identity* only — never recency, never anything the
 * learner has to reason about — and the number is always printed on top, so a
 * learner who cannot separate the hues loses nothing.
 */
export function Frames({
  frames,
  awaiting,
  onChoose,
  regretPage = null,
  stats = null,
}: {
  frames: (number | null)[]
  awaiting: Awaiting | null
  onChoose: (slot: number) => void
  /** A page that just came back after the learner dropped it: flash it home. */
  regretPage?: number | null
  /**
   * The level 2 instrument panel: one number per declarable rule, so every
   * strategy from screen 5 is equally effortless to execute. Level 1 leaves
   * this null and the learner holds their measurement in their head; nothing
   * else about the game changes. That difference is the argument of act 3.
   */
  stats?: (TileStats | null)[] | null
}) {
  return (
    <div>
      {/* The three regions of the screen each carry their name permanently:
          requests above, memory here, swapped out below. The opening bubbles
          explain them once; these labels mean the learner never has to
          remember which shape was which. */}
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        memory
      </p>
      <div className="grid grid-cols-3 gap-3">
      {frames.map((page, slot) => {
        // A fill is not a decision: every empty slot is identical, so offering
        // three of them would teach the learner that their taps are arbitrary
        // — the exact opposite of what the evictions are about. One target.
        const firstEmpty = frames.indexOf(null)
        const tappable =
          awaiting !== null &&
          (awaiting.mode === 'fill' ? slot === firstEmpty : page !== null)
        const label =
          page === null
            ? tappable
              ? `bring page ${awaiting?.page} into memory`
              : `empty slot ${slot + 1}`
            : tappable
              ? `evict page ${page}`
              : `slot ${slot + 1} holds page ${page}`

        return (
          <button
            key={slot}
            type="button"
            disabled={!tappable}
            onClick={() => onChoose(slot)}
            aria-label={label}
            className={[
              'flex aspect-square select-none flex-col items-center justify-center rounded-xl font-mono text-3xl transition-all duration-200',
              page === null
                ? 'border-2 border-dashed border-edge text-ink-faint'
                : 'font-semibold',
              tappable
                ? 'cursor-pointer ring-2 ring-focus hover:scale-105 active:scale-95'
                : 'cursor-default',
              regretPage !== null && page === regretPage ? 'ring-2 ring-fault' : '',
            ].join(' ')}
            style={
              page === null
                ? undefined
                : { background: pageColor(page), color: 'var(--color-ground)' }
            }
          >
            <span>{page ?? ''}</span>
            {stats?.[slot] && (
              <span className="mt-1 flex flex-col items-center font-sans text-[10px] font-normal leading-snug opacity-75">
                <span>{stats[slot].usedAgo === 0 ? 'used just now' : `used ${stats[slot].usedAgo} ago`}</span>
                <span>here for {stats[slot].hereFor}</span>
                <span>used {stats[slot].count} times</span>
              </span>
            )}
          </button>
        )
      })}
      </div>
    </div>
  )
}

/** Pages the learner threw out and has not seen since. */
export function SwappedOut({ pages }: { pages: number[] }) {
  // Nothing has been thrown out yet, so the label would be naming an empty
  // space — one more unexplained word on a screen that has enough of them.
  if (pages.length === 0) return <div className="min-h-8" />
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        swapped out
      </span>
      {pages.map((p) => (
        <span
          key={p}
          className="grid size-6 place-items-center rounded font-mono text-xs opacity-45"
          style={{ background: pageColor(p), color: 'var(--color-ground)' }}
        >
          {p}
        </span>
      ))}
    </div>
  )
}
