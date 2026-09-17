import { useRef } from 'react'
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

export interface Spoken {
  lines: string[]
  index: number
  /** Remount key for the bubble, held with the line it belongs to. */
  key: string
  /**
   * True while the last line is being kept on screen. The group it belongs to
   * is over, so its closing button must not be offered a second time: a caller
   * whose `onDone` does not already fall away here has to suppress it.
   */
  held: boolean
}

/**
 * What the bubble shows, which is not always what the voice has to say.
 *
 * A group with no lines of its own is not silence. It is the board playing
 * while the machine stands beside what it just told you: the tape running
 * through hits between two beats, a recorded run played back, a comparison
 * ticking along on its own. Emptying the bubble there takes the last thing
 * said away at exactly the moment the learner looks up from the board to check
 * what they were asked to watch for, and an empty bubble beside a board that
 * has started moving reads as the screen having lost its place.
 *
 * So the last line stays until the voice has something else to say. The index
 * and the remount key are held with it, which is what makes it the *same* line
 * rather than a new one arriving: React keeps the paragraph it already
 * mounted, and the fade does not replay.
 *
 * Screen 8 used to do this by hand for its one demonstration, by naming the
 * line it wanted left standing. Every other automatic stretch of the lesson
 * went blank.
 */
export function useVoice(lines: string[], index: number, key = ''): Spoken {
  const held = useRef<Spoken>({ lines: [], index: 0, key: '', held: true })
  if (lines.length > 0) held.current = { lines, index, key, held: false }
  else if (!held.current.held) held.current = { ...held.current, held: true }
  return held.current
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
 * one thing is ever asking to be touched. It is also what lets a caller with
 * nothing to say hand back the group it said last — see useVoice.
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
    <div className="window tutor-window">
      <div className="title-bar inactive"><div className="title-bar-text">The machine</div></div>
      <div className="window-body tutor-body">
      <MachinePortrait />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        {line && (
          <p
            key={index}
            className="animate-[fade-in_240ms_ease-out] tutor-message text-[15px] leading-relaxed"
          >
            {render(line)}
          </p>
        )}

        {(onDone || !last) && (
          <div className="flex max-w-full flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => (last ? onDone?.() : onNext())}
              className="default min-h-11 max-w-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
            >
              {last ? doneLabel : nextLabel}
            </button>
            {lines.length > 1 && (
              <span className="flex gap-1" aria-hidden>
                {lines.map((_, n) => (
                  <span
                    key={n}
                    className={`size-1.5 transition-colors ${
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
    </div>
  )
}
