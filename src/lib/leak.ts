import { BELADY } from './levels.ts'
import { playback, type PlaybackFrame } from './code-lesson.ts'

export const SEARCH = [
  'Move along the tape to compare both memories after the same request.',
  'Somewhere in these two runs, the smaller memory is holding a page that the bigger memory has already thrown away.',
  'Find the first step where that happens, then tap the page that proves it.',
]
export const FOUND = [
  "That's the first missing page. After request 7, page 1 is in the smaller memory and absent from the larger one.",
  "Now let's rewind to see why Clock kept page 1 in one run and removed it in the other.",
]
export const EXPLANATIONS: Record<number, string[]> = {
  4: ['With four frames, page 4 fits in the empty slot. There is no scan: the bits stay at 1, and the hand stays on page 1.'],
  5: ['The larger memory saves a fault on page 1. Its bit was already 1, so this newer use leaves no new information. The hand stays put.'],
  6: [
    'Page 2 saves the larger memory another fault. In the smaller run, a replacement moves the hand again.',
    'All bits are now 1 in both runs, despite the different times each page was used.',
    'The hands are in different places: page 4 in the smaller memory, page 1 in the larger one.',
  ],
  7: [
    'Each scan clears every 1, then returns to where it started. The smaller run removes page 4; the larger run removes page 1.',
    'A 1 records use since the bit was last cleared. It cannot rank pages by how recently they were used.',
    'The extra frame changed when Clock scanned and replaced pages. That changed the hand positions, then which page was removed.',
  ],
  8: ['Page 1 comes back on the very next request. The smaller memory still has it. The larger memory must fetch it again.'],
}
export const SUMMARY = [
  'The fourth frame saved two faults, then the changed replacements added three. That accounts for the rise from nine faults to ten.',
]
export const BRIDGE = ["Would keeping the exact recency order prevent the larger memory from losing a page the smaller one keeps?"]

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
  /** Short action label outside the highlighted slot, e.g. Out, In or Here. */
  slotLabel?: string
  hit?: boolean
  faults?: number
  caption?: string
  focusPage?: number
  dimPages?: number[]
  /** Matches shown by screen 13, labelled outside the page tiles. */
  matchedPages?: number[]
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
