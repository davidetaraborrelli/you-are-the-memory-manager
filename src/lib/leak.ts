import { BELADY } from './levels.ts'
import { playback, type PlaybackFrame } from './code-lesson.ts'

export const SEARCH = [
  'Both memories are showing the moment after the highlighted request. Move them together and compare which pages they hold.',
  'Somewhere in these two runs, the smaller memory is holding a page that the bigger memory has already thrown away.',
  'Find the first step where that happens, then tap the page that proves it.',
]
export const FOUND = [
  "That's the leak. At the end of step 7, the smaller memory still has page 1, but the bigger memory has already lost it.",
  "You found where the runs split. Now let's rewind and see why clock made the larger memory drop page 1.",
]
export const EXPLANATIONS: Record<number, string[]> = {
  4: ['The extra frame helps here. Page 4 fits without a replacement. But that also means clock does not scan any old bits, and its hand stays on page 1.'],
  5: ['The larger memory saves a fault. But page 1\'s bit was already 1. One bit cannot say "used even more recently", and a hit does not move the hand.'],
  6: [
    'The same thing happens with page 2. The larger memory saves another fault.',
    'But its one-bit record still cannot distinguish the recent hits on pages 1 and 2 from the older uses of pages 3 and 4.',
    'So the extra frame has helped twice. It has also left clock with a different replacement history.',
    'Every page now looks equally recent, but the hand faces page 4 in the smaller run and page 1 in the larger run.',
  ],
  7: [
    'Every bit gives clock the same answer, so the hand breaks the tie. The smaller run returns to page 4. The larger run returns to page 1. Same rule. Same incoming page. Different history.',
    'Clock\'s bits did not malfunction. They remembered "used since the last inspection", exactly as designed.',
    'But once every bit says 1, they cannot preserve the exact recency, so the page under the hand decides.',
    'The extra frame did not make memory worse. It changed when clock had to inspect and replace pages, and that changed which page survived.',
  ],
  8: ['And page 1 comes back immediately. The smaller memory hits. The larger memory pays for a page it had room to keep, but clock had already thrown it away.'],
}
export const SUMMARY = [
  'The fourth frame helped twice at first. The different replacement history then cost three faults the smaller memory avoided. It gave back both savings and paid one more.',
]
export const BRIDGE = ['Clock can let a larger memory lose something a smaller memory still has. Is that unavoidable, or can another replacement rule prevent it?']

export const DIFFERENCES = BELADY.runs.clock.small.steps.flatMap((small, i) => {
  const big = BELADY.runs.clock.big.steps[i]
  const smallHit = small.outcome === 'hit', bigHit = big.outcome === 'hit'
  return smallHit === bigHit ? [] : [{ step: small.step, page: small.page, smallHit, bigHit, saved: bigHit }]
})

const timelines = (['small', 'big'] as const).map((size) => {
  const run = BELADY.runs.clock[size]
  return playback({ initialFrames: Array<null>(run.frames).fill(null), initialBits: Array<number>(run.frames).fill(0), ref: BELADY.ref, steps: run.steps })
})
/** Align each recorded request; a finished row waits while the other finishes scanning. */
export function replayRequest(step: number): { small: PlaybackFrame; big: PlaybackFrame }[] {
  const [small, big] = timelines.map((timeline) => timeline.filter((frame) => frame.step === step))
  return Array.from({ length: Math.max(small.length, big.length) }, (_, i) => ({
    small: small[Math.min(i, small.length - 1)], big: big[Math.min(i, big.length - 1)],
  }))
}
export interface LeakState {
  phase: 'search' | 'found' | 'ready' | 'play' | 'explain' | 'account-ready' | 'account' | 'summary' | 'bridge'
  step: number
  line: number
  frame: number
  error: string | null
  answer: { step: number; page: number } | null
  paused: boolean
  reduced: boolean
  compared: number
}
export type LeakAction = { type: 'next' } | { type: 'select'; step: number }
  | { type: 'choose'; page: number } | { type: 'tick' } | { type: 'step' } | { type: 'pause' } | { type: 'replay' }
export function initialLeak(reduced = false): LeakState {
  return { phase: 'search', step: 1, line: 0, frame: 0, error: null, answer: null, paused: reduced, reduced, compared: 0 }
}
export function searchEnabled(state: LeakState) { return state.phase === 'search' && state.line === SEARCH.length - 1 }
export function leakLines(state: LeakState): string[] {
  switch (state.phase) {
    case 'search': return state.error ? [state.error] : SEARCH
    case 'found': return FOUND
    case 'ready': return ['Both runs are back to the end of request 3. Now watch what happens when page 4 arrives.']
    case 'explain': return EXPLANATIONS[state.step]
    case 'account-ready': return ["Let's collect the requests where the two runs had different hit or fault outcomes, including the earlier savings."]
    case 'summary': return SUMMARY
    case 'bridge': return BRIDGE
    default: return []
  }
}
export function canReplay(state: LeakState) {
  return state.answer !== null && ((state.phase === 'explain' && state.step >= 7) || ['account-ready', 'summary', 'bridge'].includes(state.phase))
}
export function leakReducer(state: LeakState, action: LeakAction): LeakState {
  if (action.type === 'select') {
    if (!searchEnabled(state) || !Number.isInteger(action.step) || action.step < 1 || action.step > BELADY.length) return state
    return { ...state, step: action.step, error: null }
  }
  if (action.type === 'choose') {
    if (!searchEnabled(state)) return state
    const small = BELADY.runs.clock.small.steps[state.step - 1], big = BELADY.runs.clock.big.steps[state.step - 1]
    if (!small.frames.includes(action.page)) return state
    if (big.frames.includes(action.page)) return { ...state, error: `Page ${action.page} is still in both memories after request ${state.step}. Keep looking.` }
    if (state.step !== BELADY.runs.clock.leakSteps[0]) return { ...state, error: `Page ${action.page} is missing from the larger memory here. You found a leak, but not the first one.` }
    return { ...state, phase: 'found', answer: { step: state.step, page: action.page }, error: null, line: 0 }
  }
  if (action.type === 'replay') return canReplay(state) ? { ...state, phase: 'ready', step: 3, frame: 0, line: 0, compared: 0 } : state
  if (action.type === 'next') {
    if (state.error) return state
    if (state.line < leakLines(state).length - 1) return { ...state, line: state.line + 1 }
    if (state.phase === 'found') return { ...state, phase: 'ready', step: 3, line: 0 }
    if (state.phase === 'ready' || (state.phase === 'explain' && state.step < 8)) return {
      ...state, phase: 'play', step: state.step + 1, frame: 0, line: 0, paused: state.reduced,
    }
    if (state.phase === 'explain') return { ...state, phase: 'account-ready', line: 0 }
    if (state.phase === 'account-ready') return { ...state, phase: 'account', step: DIFFERENCES[0].step, compared: 1, line: 0, paused: state.reduced }
    if (state.phase === 'summary') return { ...state, phase: 'bridge', line: 0 }
    return state
  }
  if (state.phase !== 'play' && state.phase !== 'account') return state
  if (action.type === 'pause') return { ...state, paused: !state.paused }
  if (action.type === 'tick' && state.paused) return state
  const paused = action.type === 'step' || state.paused
  if (state.phase === 'account') {
    return state.compared === DIFFERENCES.length ? { ...state, phase: 'summary', paused }
      : { ...state, step: DIFFERENCES[state.compared].step, compared: state.compared + 1, paused }
  }
  const last = replayRequest(state.step).length - 1
  return state.frame === last ? { ...state, phase: 'explain', line: 0, paused }
    : { ...state, frame: state.frame + 1, paused }
}

export interface MemoryView {
  frames: (number | null)[]
  bits?: number[]
  hand?: number
  slot?: number | null
  hit?: boolean
  faults?: number
  caption?: string
  focusPage?: number
  dimPages?: number[]
}
/** The search projection excludes all explanatory state, including screen-reader hints. */
export function leakBoard(state: LeakState, size: 'small' | 'big'): MemoryView {
  const event = BELADY.runs.clock[size].steps[state.step - 1]
  if (state.phase === 'search') return { frames: event.frames }
  if (state.phase === 'found') return { frames: event.frames, focusPage: state.answer!.page,
    dimPages: BELADY.runs.clock.small.steps[state.step - 1].frames.filter((page): page is number =>
      page !== null && BELADY.runs.clock.big.steps[state.step - 1].frames.includes(page)) }
  if (['account', 'summary', 'bridge'].includes(state.phase)) return { frames: event.frames,
    faults: BELADY.runs.clock[size].steps.slice(0, state.step).filter((s) => s.outcome !== 'hit').length,
    slot: event.slot, hit: event.outcome === 'hit', caption: event.outcome === 'hit' ? 'Hit' : 'Page fault' }
  const frame = state.phase === 'play' ? replayRequest(state.step)[state.frame][size]
    : timelines[size === 'small' ? 0 : 1].filter((f) => f.step === state.step).at(-1)!
  const previous = BELADY.runs.clock[size].steps[state.step - 2]
  return { frames: frame.frames, bits: frame.bits, hand: frame.hand, slot: frame.slot,
    hit: frame.hit, caption: frame.kind === 'resolved' && frame.hit
      ? `Hit: page ${event.page}, bit ${previous?.bits[event.slot] ?? 0} → 1. The hand stays put.` : frame.caption }
}
