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
}: {
  rows: { id: string; label: string; value: number | string; emphasis?: boolean }[]
}) {
  return (
    <table className="w-full border-collapse text-sm">
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
