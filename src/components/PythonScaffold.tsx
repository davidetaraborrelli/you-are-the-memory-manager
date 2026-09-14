import { ANSWERS, HINTS, QUICK, SYNTAX, type Blanks } from '@/lib/code-lesson'

const LABELS = ['Continue while the bit equals', 'Set the inspected bit to', 'Use this slot as victim']

export function PythonScaffold({ fields, errors, hints, disabled, reference, onChange, onHint, onAnswers }: {
  fields: Blanks; errors: (string | null)[]; hints: number; disabled: boolean; reference: boolean
  onChange: (index: number, value: string) => void; onHint: () => void; onAnswers: () => void
}) {
  const input = (i: number) => (
    <input aria-label={LABELS[i]} aria-invalid={!!errors[i]} aria-describedby={errors[i] ? `blank-error-${i}` : undefined}
      value={reference ? ANSWERS[i] : fields[i]} readOnly={reference} disabled={disabled}
      onChange={(event) => onChange(i, event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
      maxLength={24} placeholder="___"
      className={`mx-1 rounded border-2 bg-ground px-1 py-1 text-center font-mono text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus ${i === 2 ? 'w-20' : 'w-12'} ${errors[i] ? 'border-fault' : 'border-focus'} disabled:opacity-50`}
    />
  )
  const locked = 'text-ink-dim'
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-edge bg-surface p-3 sm:p-4" aria-label="Python rule with three editable blanks">
        <div className="whitespace-pre font-mono text-xs leading-7 sm:text-sm">
          <div className={locked}>def evict(frames, bits, state):</div>
          <div className="text-[10px] text-ink-dim">    # Provided: resume at the saved slot, or 0.</div>
          <div className={locked}>    cursor = state.get("cursor", 0)</div>
          <div className="h-3" />
          <div>    while bits[cursor] == {input(0)}:</div>
          <div>        bits[cursor] = {input(1)}</div>
          <div className={locked}>        cursor = next_slot(cursor)</div>
          <div className="h-3" />
          <div>    victim = {input(2)}</div>
          <div className="h-3" />
          <div className="text-[10px] text-ink-dim">    # Provided: resume after the victim next time.</div>
          <div className={locked}>    state["cursor"] = next_slot(victim)</div>
          <div className={locked}>    return victim, bits</div>
        </div>
      </div>
      {errors.some(Boolean) && <div className="space-y-1 text-sm text-fault" role="alert">
        {errors.map((error, i) => error && <p id={`blank-error-${i}`} key={i}>{LABELS[i]}: {error}</p>)}
      </div>}
      <aside className="rounded-xl border border-edge p-4 text-sm" aria-label="How to read this code">
        <p className="mb-3 font-medium">How to read this code</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs sm:text-sm">
          {SYNTAX.map(([code, explanation]) => <div key={code} className="contents"><dt className="font-mono text-key">{code}</dt><dd className="text-ink-dim">{explanation}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-ink-dim">Provided: <code>next_slot</code> moves to the following slot and wraps from the last slot back to 0.</p>
      </aside>
      {!reference && <div className="space-y-3">
        {Array.from({ length: hints }, (_, i) => <section key={i} className="rounded-xl border border-edge bg-surface p-4 text-sm" aria-label={`Hint ${i + 1}`}>
          <p className="mb-2 font-medium">Hint {i + 1}</p>
          {i === 1 && <p className="mb-3 font-mono text-xs">cursor → {QUICK.initialFrames.map((page, slot) => `${page} [${QUICK.initialBits[slot]}]`).join('   ')}</p>}
          {i === 2 ? <pre className="overflow-x-auto text-xs leading-6 text-key">{HINTS[i].join('\n')}</pre>
            : <div className="space-y-2 text-ink-dim">{HINTS[i].map((line) => <p key={line}>{line}</p>)}</div>}
          {i === 2 && <button type="button" disabled={disabled} onClick={onAnswers} className="mt-3 rounded-lg border border-ink-faint px-3 py-2 disabled:opacity-40">Use these answers</button>}
        </section>)}
        {hints < HINTS.length && <button type="button" disabled={disabled} onClick={onHint} className="rounded-lg border border-edge px-3 py-2 text-sm text-ink-dim hover:text-ink disabled:opacity-40">Show hint {hints + 1}</button>}
      </div>}
    </div>
  )
}
