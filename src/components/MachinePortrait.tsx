import { useMachineState } from '@/lib/machine'

/**
 * The machine's portrait.
 *
 * Until the sprite sheet exists (the final task of the project) this renders
 * the state as a word, at the size and position the finished sprite will
 * occupy. That is deliberate: while the face is a word, a leaked tell is
 * readable in plain text instead of being an impression.
 *
 * Swapping in the art means replacing the contents of <Face> and nothing else.
 */

const LABEL: Record<string, string> = {
  neutral: 'NEUTRAL',
  approval: 'APPROVE',
  correction: 'CORRECT',
  smug: 'SMUG',
  apologetic: 'SORRY',
  withholding: 'WITHHOLD',
}

function Face({ state }: { state: string }) {
  // --- placeholder ---------------------------------------------------------
  // Replaced wholesale by <img src={sprite} style={{objectPosition}} /> once
  // the sheet is drawn. 32x32 base, rendered at 3x = 96px.
  return (
    <div className="grid h-full w-full place-items-center bg-surface-hi font-mono text-[10px] tracking-widest text-ink-dim">
      {LABEL[state] ?? state.toUpperCase()}
    </div>
  )
}

export function MachinePortrait() {
  const state = useMachineState()
  return (
    <div
      className="pixelated size-24 shrink-0 select-none overflow-hidden rounded-sm border border-edge"
      role="img"
      aria-label={`the machine, ${state}`}
    >
      <Face state={state} />
    </div>
  )
}
