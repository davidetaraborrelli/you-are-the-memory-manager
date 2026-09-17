import { TOTAL_SCREENS } from '@/lib/screens'

/**
 * A 98.css segmented progress indicator across the fourteen screens.
 *
 * No numbers, no labels. Brilliant never leaves a learner wondering how much is
 * left, and a lesson that ends on purpose on an open question looks broken
 * without one.
 */
export function ProgressBar({ screen }: { screen: number }) {
  const pct = (screen / TOTAL_SCREENS) * 100
  return (
    <div
      className="progress-indicator segmented lesson-progress"
      role="progressbar"
      aria-valuenow={screen}
      aria-valuemin={0}
      aria-valuemax={TOTAL_SCREENS}
      aria-label="lesson progress"
    >
      <div
        className="progress-indicator-bar transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
