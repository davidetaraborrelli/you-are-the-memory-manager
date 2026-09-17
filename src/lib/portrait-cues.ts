import type { MachineState } from './types.ts'
import type { ComparisonState } from './act6.ts'
import type { LeakState } from './leak.ts'
import type { StackState } from './stack.ts'
import type { TransferState } from './transfer.ts'

// Reactions belong to visible evidence or to feedback after a commitment.
// No clocks, random faces, hidden scores, or reactions to hovered choices.
export function comparisonFace(s: ComparisonState): MachineState {
  if (!s.prediction || s.phase === 'intro') return 'neutral'
  if (s.phase === 'run') return 'withholding'
  return s.line === 0 || s.line === 2 ? 'apologetic' : 'neutral'
}

export function leakFace(s: LeakState): MachineState {
  if (s.phase === 'search') return s.error ? 'correction' : 'neutral'
  if (!s.answer) return 'neutral'
  if (s.phase === 'found' && s.line === 0) return 'approval'
  // The limitation has been observed and the learner already found the leak.
  if (s.phase === 'explain' && ((s.step === 7 && s.line === 1) || s.step === 8)) return 'apologetic'
  return 'neutral'
}

export function stackFace(s: StackState): MachineState {
  if (s.phase === 'feedback') return 'correction'
  if (s.chosen !== 'large-fault') return 'neutral'
  if (s.phase === 'explain') {
    if (s.line === 0) return 'approval'
    if (s.line >= 2) return 'satisfied'
  }
  // The result compares policies; a permanent smile would endorse a winner.
  return 'neutral'
}

export function transferFace(s: TransferState): MachineState {
  if (s.phase === 'wrong') return 'correction'
  if (s.phase === 'correct') return s.line === 0 || s.stage === 'policy' ? 'approval' : 'neutral'
  if (s.phase === 'ending') return s.line === 0 ? 'satisfied' : 'neutral'
  return 'neutral'
}

export function optNarrationFace(phase: string, line: number): MachineState | null {
  if (phase === 'whole') return line === 0 ? 'approval' : 'neutral'
  if (phase === 'proof') return line === 2 ? 'satisfied' : 'neutral'
  if (phase === 'extract') return line === 0 ? 'satisfied' : 'approval'
  return null // Interactive feedback remains owned by the submitted choice.
}
