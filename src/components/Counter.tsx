/**
 * The only score on screen.
 *
 * It reads `trips` for the whole of level 1 and relabels itself to `page
 * faults` on screen 4, once the learner has paid for eight of them. The
 * vocabulary rule — what you just did has a name, and the name is X — is
 * performed by the interface here rather than stated in a bubble.
 */
export function Counter({ faults, named }: { faults: number; named: boolean }) {
  const label = named ? 'page faults' : faults === 1 ? 'trip' : 'trips'
  return (
    <div className="flex items-baseline gap-2" aria-live="polite">
      <span className="font-mono text-2xl font-semibold tabular-nums">{faults}</span>
      <span
        key={named ? 'named' : 'plain'}
        className="animate-[fade-in_400ms_ease-out] font-mono text-xs uppercase tracking-widest text-ink-dim"
      >
        {label}
      </span>
    </div>
  )
}
