import { TOTAL_SCREENS } from '@/lib/screens'

/**
 * A thin line at the top, filling across the fifteen screens.
 *
 * No numbers, no labels. Brilliant never leaves a learner wondering how much is
 * left, and a lesson that ends on purpose on an open question looks broken
 * without one.
 */
export function ProgressBar({ screen }: { screen: number }) {
  const pct = (screen / TOTAL_SCREENS) * 100
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5 bg-surface"
      role="progressbar"
      aria-valuenow={screen}
      aria-valuemin={0}
      aria-valuemax={TOTAL_SCREENS}
      aria-label="lesson progress"
    >
      <div
        className="h-full bg-ink-faint transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
