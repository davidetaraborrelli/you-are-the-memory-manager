import { MachinePortrait } from './MachinePortrait'

/**
 * Key terms are written **like this** in the copy and rendered bold and
 * tinted. A term is marked the first time the lesson hands it over and never
 * again — the highlight means "this word is new and it is going to matter",
 * so repeating it on every later mention would drain it of exactly that.
 */
function render(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-key">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

/**
 * The voice, beside the portrait — one bubble at a time.
 *
 * Lines arrive in sequence and replace one another, the way a person talking
 * to you does. Stacking them turns a conversation into a wall of text, and a
 * learner facing a wall skims it, which is the same as not reading it.
 *
 * Results never go in here: scores, tables and run comparisons are page text.
 *
 * The position in the group is owned by the caller, not by this component,
 * because the board needs to know whether the voice has finished: while it is
 * still speaking, the frames are inert. Turn-taking is only legible if exactly
 * one thing is ever asking to be touched.
 */
export function Bubble({
  lines,
  index,
  onNext,
  onDone,
  doneLabel = 'Got it',
  nextLabel = 'Next',
}: {
  lines: string[]
  index: number
  onNext: () => void
  /** Omit for an ambient group: its last line hands the turn to the board. */
  onDone?: () => void
  doneLabel?: string
  nextLabel?: string
}) {
  const line = lines[Math.min(index, lines.length - 1)]
  const last = index >= lines.length - 1

  return (
    <div className="flex items-start gap-4">
      <MachinePortrait />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        {line && (
          <p
            key={index}
            className="animate-[fade-in_240ms_ease-out] rounded-2xl rounded-tl-none border border-edge bg-surface px-4 py-3 text-[15px] leading-relaxed"
          >
            {render(line)}
          </p>
        )}

        {(onDone || !last) && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (last ? onDone?.() : onNext())}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ground transition-opacity hover:opacity-85"
            >
              {last ? doneLabel : nextLabel}
            </button>
            {lines.length > 1 && (
              <span className="flex gap-1" aria-hidden>
                {lines.map((_, n) => (
                  <span
                    key={n}
                    className={`size-1.5 rounded-full transition-colors ${
                      n <= index ? 'bg-ink-faint' : 'bg-surface-hi'
                    }`}
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
