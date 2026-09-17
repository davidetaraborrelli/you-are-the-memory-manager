/**
 * A single-select question.
 *
 * Options stay live only once the voice has finished asking, the same
 * turn-taking rule the board follows: at any moment exactly one thing is
 * asking to be touched.
 *
 * After a commit the chosen option is marked and the rest fade. Nothing is
 * ever marked right or wrong by colour alone — the voice does that, and on
 * screen 5 there is no wrong answer at all.
 */
export interface Option {
  id: string
  label: string
}

export function Choice({
  options,
  chosen,
  disabled,
  onChoose,
}: {
  options: Option[]
  /** The option already committed to, if any. */
  chosen: string | null
  /** True while the voice still has lines left. */
  disabled: boolean
  onChoose: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const picked = chosen === o.id
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled || chosen !== null}
            onClick={() => onChoose(o.id)}
            aria-pressed={picked}
            className={`lesson-choice px-4 py-3 text-left text-[15px] ${picked ? 'chosen' : ''}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
