import raw from '../data/levels.json' with { type: 'json' }
import type { Level, LevelData, Policy, Step } from './types.ts'

export const data = raw as unknown as LevelData

export const L1 = data.levels.l1
export const L2 = data.levels.l2
export const L3 = data.levels.l3
export const BELADY = data.belady

/** A reference trace, e.g. the OPT replay screen 8 plays back. */
export function trace(level: Level, policy: Policy): Step[] {
  const t = level.traces[policy]
  if (!t) throw new Error(`${level.name} has no ${policy} trace — add it in gen_levels.py`)
  return t
}

/**
 * Page identity colour. Colour never encodes recency or anything else the
 * learner has to reason about, and the number is always printed on top, so a
 * learner who cannot tell the hues apart loses nothing.
 */
export function pageColor(page: number): string {
  return `var(--color-page-${((page - 1) % 6) + 1})`
}
