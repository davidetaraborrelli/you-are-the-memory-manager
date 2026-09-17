import { BELADY } from './levels.ts'
import type { MemoryView } from './leak.ts'

export const OPEN = [
  "Let's test LRU on the same tape, with the same two memory sizes.",
  'LRU removes the page used longest ago. Will every page in the smaller memory now stay in the larger one too?',
  'First watch what changes in each memory. Then compare the pages they keep after the request.',
]
export const QUESTION = [
  'Every page in the smaller memory also has a place in the larger one. If that stays true, which outcome is impossible on the next request?',
]
export const OPTIONS = [
  { id: 'both-fault', label: '3 frames: fault · 4 frames: fault' },
  { id: 'small-fault', label: '3 frames: fault · 4 frames: hit' },
  { id: 'large-fault', label: '3 frames: hit · 4 frames: fault' },
]
export const FEEDBACK: Record<string, string[]> = {
  'both-fault': ['A page can still be missing from both memories. That happened on the very first request, so this outcome is possible.'],
  'small-fault': ['The larger memory can hold an extra page. At request 5, it has page 1 while the smaller memory must fetch it. This outcome is possible.'],
}
export const EXPLANATION = [
  'Exactly. If the smaller memory hits, the requested page is there. Every page it holds is also in the larger memory, so the larger memory must hit too.',
  'LRU always keeps the most recently used distinct pages. Once four have appeared, three frames keep the latest three; four keep those same three plus one.',
  'That nesting rule is called the **stack property**. Algorithms that always preserve it are called **stack algorithms**.',
  "With LRU, every hit in the smaller memory is also a hit in the larger one. Extra frames can save faults, but cannot add any.",
]
export const RESULT = [
  'On this tape, LRU improves from 10 faults to 8. Yet with three frames, Clock did better: 9 faults to LRU\'s 10.',
  'LRU\'s guarantee concerns adding memory. Which rule performs best is a separate question, and the request pattern matters.',
]
export const BRIDGE = [
  "You've learned to ask what the past tells you before choosing what to keep. Let's try that with code files instead of pages.",
]

/** Compare page identities in generated snapshots; this never runs LRU. */
export function residentPages(step: number): number[] {
  return BELADY.runs.lru.small.steps[step - 1].frames.filter((page): page is number => page !== null)
}

export interface StackState {
  phase: 'intro' | 'checking' | 'question' | 'feedback' | 'explain' | 'result' | 'bridge'
  line: number
  step: number
  /** Show the affected slot before and after serving the request, then match pages. */
  beat: 'before' | 'after' | 'match'
  /** Number of resident pairs visibly matched at this request. */
  matched: number
  /** Counts only snapshots whose last resident pair has been shown. */
  checked: number
  chosen: string | null
  paused: boolean
  reduced: boolean
}
export type StackAction = { type: 'next' } | { type: 'tick' } | { type: 'step' }
  | { type: 'pause' } | { type: 'replay' } | { type: 'choose'; id: string }

export function initialStack(reduced = false): StackState {
  return { phase: 'intro', line: 0, step: 1, beat: 'before', matched: 0, checked: 0, chosen: null, paused: reduced, reduced }
}
export function stackLines(state: StackState): string[] {
  switch (state.phase) {
    case 'intro': return OPEN
    case 'question': return QUESTION
    case 'feedback': return FEEDBACK[state.chosen!]
    case 'explain': return EXPLANATION
    case 'result': return RESULT
    case 'bridge': return BRIDGE
    default: return []
  }
}
export function canReplayStack(state: StackState) {
  return state.phase === 'checking' || state.phase === 'question'
}
export function stackReducer(state: StackState, action: StackAction): StackState {
  if (action.type === 'choose') {
    if (state.phase !== 'question' || !OPTIONS.some((option) => option.id === action.id)) return state
    return { ...state, phase: action.id === 'large-fault' ? 'explain' : 'feedback', chosen: action.id, line: 0 }
  }
  if (action.type === 'replay') {
    return canReplayStack(state) ? { ...initialStack(state.reduced), phase: 'checking' } : state
  }
  if (action.type === 'next') {
    if (state.line < stackLines(state).length - 1) return { ...state, line: state.line + 1 }
    if (state.phase === 'intro') return { ...state, phase: 'checking', line: 0 }
    if (state.phase === 'feedback') return { ...state, phase: 'question', chosen: null, line: 0 }
    if (state.phase === 'explain') return { ...state, phase: 'result', line: 0 }
    if (state.phase === 'result') return { ...state, phase: 'bridge', line: 0 }
    return state
  }
  if (state.phase !== 'checking') return state
  // Reduced motion always advances on explicit steps, including after replay.
  if (action.type === 'pause') return state.reduced ? state : { ...state, paused: !state.paused }
  if (action.type === 'tick' && (state.paused || state.reduced)) return state
  const paused = action.type === 'step' || state.paused
  if (state.beat === 'before') return { ...state, beat: 'after', paused }
  const pages = residentPages(state.step)
  if (state.matched < pages.length) {
    const page = pages[state.matched]
    // Never announce inclusion if the recorded larger state does not contain the page.
    if (!BELADY.runs.lru.big.steps[state.step - 1].frames.includes(page)) {
      throw new Error(`LRU trace is missing page ${page} in the larger memory after request ${state.step}`)
    }
    const matched = state.matched + 1
    return { ...state, beat: 'match', matched, checked: matched === pages.length ? state.step : state.checked, paused }
  }
  return state.step === BELADY.length ? { ...state, phase: 'question', line: 0, paused }
    : { ...state, step: state.step + 1, beat: 'before', matched: 0, paused }
}

/** Replay the recorded request; do not derive a replacement policy in the UI. */
export function stackBoard(state: StackState, size: 'small' | 'big'): MemoryView {
  const run = BELADY.runs.lru[size]
  const event = run.steps[state.step - 1]
  const before = run.steps[state.step - 2]?.frames ?? Array<null>(run.frames).fill(null)
  if (state.phase === 'intro') return { frames: before, matchedPages: [], caption: '' }
  const caption = state.phase !== 'checking' ? '' : event.outcome === 'evict'
    ? `Out: ${event.victim} · In: ${event.page}` : event.outcome === 'fill'
    ? `Page ${event.page} enters an empty slot` : `Page ${event.page} already here · no replacement`
  if (state.phase === 'checking' && state.beat !== 'match') {
    return { frames: state.beat === 'before' ? before : event.frames, matchedPages: [], caption,
      slot: event.slot, hit: event.outcome === 'hit',
      slotLabel: event.outcome === 'hit' ? 'Here' : state.beat === 'after' ? 'In' : event.outcome === 'evict' ? 'Out' : 'Empty' }
  }
  const matchedPages = residentPages(state.step).slice(0, state.matched)
  return { frames: event.frames, matchedPages, caption,
    focusPage: state.phase === 'checking' ? matchedPages.at(-1) : undefined }
}
export function stackCaption(state: StackState) {
  if (state.phase === 'intro') return 'Both memories start empty.'
  const when = state.phase === 'checking' && state.beat === 'before' ? 'Before' : 'After'
  return `${when} request ${state.step} of ${BELADY.length}: page ${BELADY.ref[state.step - 1]}`
}
export function stackStepLabel(state: StackState) {
  if (state.beat === 'before') return 'Apply request'
  if (state.beat === 'after') return 'Compare pages'
  if (state.matched < residentPages(state.step).length) return 'Next match'
  return state.step < BELADY.length ? 'Next request' : 'Answer the question'
}
export function stackEvidence(state: StackState) {
  if (state.phase === 'intro') return null
  const page = residentPages(state.step)[state.matched - 1]
  return {
    checked: state.checked,
    complete: state.checked === BELADY.length,
    allMatched: state.matched === residentPages(state.step).length,
    match: state.beat === 'before' ? 'Follow the highlighted page or empty slot in each memory.'
      : state.beat === 'after' ? 'The request is complete. Next, compare the pages that remain.'
      : `Page ${page} is in both memories.`,
  }
}
export function stackResults(state: StackState) {
  if (state.phase !== 'result' && state.phase !== 'bridge') return null
  return (['small', 'big'] as const).map((size) => ({
    frames: BELADY.runs.lru[size].frames,
    lru: BELADY.runs.lru[size].faults,
    opt: BELADY.runs.opt[size].faults,
  }))
}
