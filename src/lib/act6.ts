import { BELADY } from './levels.ts'
import type { ClockStep } from './types.ts'

export const OPEN = [
  "So far you've worked with three slots all lesson. Let's add another one!",
  'Those physical-memory slots have a proper name, by the way; they are called **frames**.',
  'Now, your turn. We have a new tape, same replacement rule, but one extra frame. How do you think that frame would affect page faults?',
]
export const PREDICTIONS = [
  { id: 'fewer', label: 'Fewer page faults' },
  { id: 'same', label: 'The same number' },
  { id: 'more', label: 'More page faults' },
]
export const RESULT = [
  "On this tape, Clock went from nine faults to ten. This doesn't happen every time you add memory, but it shows that more space does not guarantee fewer faults with Clock.",
  "Let's bring back OPT, our benchmark with perfect knowledge of the future, to check what this extra frame made possible.",
  "On this same tape, OPT improves from seven faults to six. The extra space could help, but Clock's choices made its result worse.",
  "The totals tell us what happened. To find out why, let's go back through the two Clock runs and compare which pages they kept.",
]
export const OPT_RESULT_LINE = 2
export function ruleLabel(reference: boolean) {
  return reference ? 'Clock, the rule you were building' : 'Clock, the rule you built'
}

export interface ComparisonState {
  phase: 'intro' | 'run' | 'result'
  line: number
  prediction: string | null
  /** Number of completed requests in both memories; zero is the empty board. */
  step: number
  paused: boolean
}
export type ComparisonAction =
  | { type: 'next' }
  | { type: 'predict'; id: string }
  | { type: 'tick' }
  | { type: 'step' }
  | { type: 'pause' }

export function initialComparison(paused = false): ComparisonState {
  return { phase: 'intro', line: 0, prediction: null, step: 0, paused }
}
export function canPredict(state: ComparisonState) {
  return state.phase === 'intro' && state.line === OPEN.length - 1
}
export function comparisonReducer(state: ComparisonState, action: ComparisonAction): ComparisonState {
  if (action.type === 'next') {
    const lines = state.phase === 'intro' ? OPEN : state.phase === 'result' ? RESULT : []
    return state.line < lines.length - 1 ? { ...state, line: state.line + 1 } : state
  }
  if (action.type === 'predict') {
    if (!canPredict(state) || !PREDICTIONS.some((p) => p.id === action.id)) return state
    return { ...state, phase: 'run', line: 0, prediction: action.id }
  }
  if (state.phase !== 'run') return state
  if (action.type === 'pause') return { ...state, paused: !state.paused }
  if (action.type === 'tick' && state.paused) return state
  const step = state.step + 1
  return { ...state, step, paused: action.type === 'step' || state.paused,
    phase: step === BELADY.length ? 'result' : 'run', line: 0 }
}

/** Read recorded post-request states; never choose a victim in the UI. */
export function comparisonBoard(state: ComparisonState, size: 'small' | 'big') {
  const run = BELADY.runs.clock[size]
  const event: ClockStep | undefined = run.steps[state.step - 1]
  return {
    frames: event?.frames ?? Array<number | null>(run.frames).fill(null),
    event,
    faults: run.steps.slice(0, state.step).filter((s) => s.outcome !== 'hit').length,
  }
}

/** First show the observed Clock totals, then introduce OPT as the benchmark. */
export function comparisonResults(state: ComparisonState) {
  if (state.phase !== 'result') return null
  return (['small', 'big'] as const).map((size) => ({
    frames: BELADY.runs.clock[size].frames,
    clock: BELADY.runs.clock[size].faults,
    opt: state.line >= OPT_RESULT_LINE ? BELADY.runs.opt[size].faults : null,
  }))
}
