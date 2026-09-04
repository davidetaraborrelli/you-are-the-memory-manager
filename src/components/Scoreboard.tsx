/**
 * Results, as page text.
 *
 * Rows carry an `id` as well as a label because a row can change its label in
 * place while its number stays put: screen 7 marks the rule the learner tested
 * without redrawing the table around it.
 *
 * Scores never go in a speech bubble. The voice reacts to a number; it does not
 * read one out. Keeping the two apart is what stops the machine sounding like a
 * results screen with a face attached.
 */
export function Scoreboard({
  rows,
  caption = null,
}: {
  rows: { id: string; label: string; value: number | string; emphasis?: boolean }[]
  /**
   * Which run these numbers are from.
   *
   * Optional, and needed exactly where a table prices a tape other than the
   * one on the board. Screen 8 ends by putting level 2's scores under level
   * 1's finished run: a floor of 5 has just been proved on the strip above,
   * and an unlabelled 6 underneath reads as a correction of it rather than
   * as a different tape. The floor belongs to the tape, not to the rule.
   */
  caption?: string | null
}) {
  return (
    <table className="w-full border-collapse text-sm">
      {caption && (
        <caption className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {caption}
        </caption>
      )}
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-edge first:border-t-0">
            <td className={`py-2 pr-4 ${r.emphasis ? 'text-ink' : 'text-ink-dim'}`}>
              {/* Keyed on the text, so a row that renames itself fades the new
                  label in while its number stays put. Screen 7 does this once,
                  the way the counter does on screen 4. */}
              <span key={r.label} className="animate-[fade-in_400ms_ease-out]">
                {r.label}
              </span>
            </td>
            <td
              className={`py-2 text-right font-mono tabular-nums ${
                r.emphasis ? 'text-lg font-semibold text-ink' : 'text-ink-dim'
              }`}
            >
              {r.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
