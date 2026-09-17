import { BELADY } from './levels.ts'
import type { ClockStep } from './types.ts'

export const OPEN = [
  "You've used three memory slots so far. Let's try four.",
  'A slot that holds one page is called a **frame**.',
  'We\'ll run Clock twice on a new tape: once with three frames, once with four. How will the extra frame affect the fault count?',
]
export const PREDICTIONS = [
  { id: 'fewer', label: 'Fewer page faults' },
  { id: 'same', label: 'The same number' },
  { id: 'more', label: 'More page faults' },
]
export const RESULT = [
  "Clock went from nine faults to ten. This doesn't happen every time memory grows, but it shows that an extra frame can increase Clock's faults.",
  "What could the extra frame have made possible? Let's check OPT, our benchmark with perfect knowledge of the future.",
  "OPT goes from seven faults to six on this same tape. More space allows a better result, yet Clock's choices produced a worse one.",
  "Let's compare the pages Clock kept in each run to find out how the extra frame led to more faults.",
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
