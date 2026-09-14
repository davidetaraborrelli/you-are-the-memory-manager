import { data, L3 } from './levels.ts'
import type { MachineState } from './types.ts'

// Screen 9 consumes recorded inspections. It never searches for a victim.
export const CLOCK = L3.traces.clock!
export const RECENCY = data.recencyDemo
export const COST_OPTIONS = [
  { id: 'full', label: 'Only when memory is full' },
  { id: 'fault', label: 'Only when a page fault happens' },
  { id: 'use', label: 'Whenever a resident page is used' },
]

type ActionKind = 'continue' | 'watch' | 'question' | 'explore' | 'inspect' | 'evict'
export interface GuideBeat {
  id: string
  lines: string[]
  action: ActionKind
  scene: 'exact' | 'scale' | 'bits' | 'run' | 'comparison'
  /** Number of resolved L3 requests; pending is the current unresolved one. */
  completed?: number
  pending?: number
  /** Recorded inspections already performed on the pending request. */
  inspected?: number
  hand?: boolean
  label?: string
}

export const GUIDE: GuideBeat[] = [
  { id: 'exact', scene: 'exact', action: 'continue', label: 'Watch two requests', lines: [
    "So, we've seen that LRU worked because I kept exact recency for every page: who was most recent, who was next, and so on.",
    'But, as I mentioned, that record does not maintain itself. Every time a resident page is used, I have to keep the recency information current.',
  ] },
  { id: 'hits', scene: 'exact', action: 'watch', lines: [
    'Watch the record as these two resident pages are used.',
  ] },
  { id: 'cost', scene: 'exact', action: 'question', lines: ['When does that bookkeeping have to happen?'] },
  { id: 'cost-earned', scene: 'exact', action: 'continue', lines: [
    'Exactly. And it is not one page at a time: to know who is least recent, I have to keep every resident page in order, on every single use.',
  ] },
  { id: 'scale', scene: 'scale', action: 'continue', lines: [
    "With three pages, that's tiny. But a real system may be tracking a huge number of pages.",
    "That's a ton of computing power that could be used somewhere else! Do we really need recency this precisely?",
  ] },
  { id: 'compress', scene: 'bits', action: 'continue', label: 'Try the cheaper clue', lines: [
    "Let's throw away the exact timestamps and keep just one cheaper clue per page: a **reference bit**.",
    'When a page is used, its bit becomes 1. We no longer know exactly when it was used, only that it has shown recent activity.',
  ] },
  { id: 'fill', scene: 'run', action: 'watch', completed: 0, lines: [
    'Here is level three. The first three pages enter empty slots. Each starts at 1 because it has just been used.',
  ] },
  { id: 'equal', scene: 'run', action: 'explore', completed: 3, pending: 4, lines: [
    'Page 5 needs a slot, but all three resident pages say 1. With the exact timestamps gone, can you tell which one is least recent?',
  ] },
  { id: 'first-inspection', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 0, hand: true, lines: [
    'Right. A single bit cannot tell us the exact order anymore. All three only say: "I\'ve been used recently."',
    "So let's make that evidence temporary. If we inspect a page with a 1, we'll spare it this time, clear its old evidence to 0, and keep looking.",
  ] },
  { id: 'spent', scene: 'run', action: 'continue', completed: 3, pending: 4, inspected: 1, hand: true, lines: [
    'Page 1 gets another chance. Its old evidence has now been spent.',
  ] },
  { id: 'inspect-middle', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 1, hand: true, lines: [] },
  { id: 'inspect-last', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 2, hand: true, lines: [] },
  { id: 'first-victim', scene: 'run', action: 'evict', completed: 3, pending: 4, inspected: 3, hand: true, lines: [
    "Notice: we didn't clear every bit at once. We inspected the pages one by one.",
    "Page 1 now says 0. Since we cleared its old evidence, it hasn't been used again.",
  ] },
  { id: 'loaded', scene: 'run', action: 'continue', completed: 4, lines: [
    'Page 5 starts at 1 because it has just been used.',
  ] },
  { id: 'return', scene: 'run', action: 'watch', completed: 4, lines: [
    'Now page 3 is requested again.',
  ] },
  { id: 'restored', scene: 'run', action: 'continue', completed: 5, lines: [
    'There it is. Page 3 was used again, so its bit went back to 1.',
    "Clearing a bit didn't mark the page as \"old\" forever. It gave the page a chance to prove it was still being used.",
  ] },
  { id: 'resume', scene: 'run', action: 'inspect', completed: 5, pending: 6, inspected: 0, hand: true, lines: [
    "We also remember where to continue the search next time. We don't always start again from the first slot.",
  ] },
  { id: 'second-victim', scene: 'run', action: 'evict', completed: 5, pending: 6, inspected: 1, hand: true, lines: [
    'Page 3 has fresh evidence, so it gets another chance.',
    "Page 2 still says 0. Unlike page 3, it hasn't been used again since we cleared its bit.",
  ] },
  { id: 'understood', scene: 'run', action: 'continue', completed: 6, hand: true, lines: [
    'Exactly. A 1 earns a page another chance. If the page is used again, it earns a new 1.',
    'A 0 means it has shown no fresh use since we last checked it, so it becomes a good candidate to remove.',
  ] },
  { id: 'compression-earned', scene: 'comparison', action: 'continue', completed: 6, lines: [
    'We no longer know exactly which page is least recent. But we kept the useful idea: pages that keep getting used keep earning another chance.',
  ] },
  { id: 'bridge', scene: 'comparison', action: 'continue', completed: 6, label: 'Make it a rule', lines: [
    "You've got the behaviour. Now let's get our hands dirty and make it a rule!",
  ] },
]

export interface GuideState {
  beat: number
  line: number
  ticks: number
  explored: number[]
  error: string | null
  reaction: MachineState
  attempts: number
}
export type GuideAction =
  | { type: 'next' | 'tick' }
  | { type: 'answer'; id: string }
  | { type: 'choose'; slot: number }

export const initialGuide = (): GuideState => ({
  beat: 0, line: 0, ticks: 0, explored: [], error: null, reaction: 'neutral', attempts: 0,
})
const forward = (s: GuideState): GuideState => ({
  ...s, beat: s.beat + 1, line: 0, ticks: 0, error: null, reaction: 'neutral',
})

/** Render an event prefix: replay supplied clear operations, never infer a scan. */
export function guideBoard(s: GuideState) {
  const beat = GUIDE[s.beat]
  let completed = beat.completed ?? 0
  if (beat.id === 'fill') completed = s.ticks
  if (beat.id === 'return') completed += s.ticks
  const previous = CLOCK[completed - 1]
  const frames = previous ? [...previous.frames] : Array<number | null>(L3.frames).fill(null)
  const bits = previous ? [...previous.bits] : Array<number>(L3.frames).fill(0)
  const pending = beat.pending ? CLOCK[beat.pending - 1] : null
  const inspected = beat.inspected ?? 0
  const cleared = pending?.scanned.slice(0, inspected) ?? []
  for (const slot of cleared) bits[slot] = 0
  const hand = pending ? pending.scanned[inspected] : (previous?.handAfter ?? 0)
  const cursor = beat.pending ? beat.pending - 1
    : beat.id === 'return' ? 4 : Math.max(0, completed - 1)
  return {
    frames, bits, hand, cleared, completed, cursor,
    faults: CLOCK.slice(0, completed).filter((event) => event.outcome !== 'hit').length,
    flashStep: (beat.id === 'return' && s.ticks > 0) || beat.id === 'restored' ? 5 : null,
  }
}

/** Guards are shared by keyboard, mouse and timed playback. */
export function guideReducer(s: GuideState, action: GuideAction): GuideState {
  const beat = GUIDE[s.beat]
  if (!beat) return s
  if (action.type === 'next') {
    if (s.line < beat.lines.length - 1) return { ...s, line: s.line + 1 }
    return beat.action === 'continue' ? forward(s) : s
  }
  if (action.type === 'tick') {
    if (beat.action !== 'watch') return s
    const limit = beat.id === 'hits' ? RECENCY.snapshots.length - 1 : beat.id === 'fill' ? 3 : 1
    return s.ticks < limit ? { ...s, ticks: s.ticks + 1 } : forward(s)
  }
  if (s.line < beat.lines.length - 1) return s
  if (action.type === 'answer' && beat.action === 'question') {
    if (!COST_OPTIONS.some((o) => o.id === action.id)) return s
    if (action.id === 'use') return { ...forward(s), reaction: 'approval' }
    return { ...s, attempts: s.attempts + 1, reaction: 'correction', error: action.id === 'full'
      ? 'The slots were already full before both hits. Did the record stay still?'
      : 'Both requests were hits. No page had to be fetched. Look at what happened to the record.' }
  }
  if (action.type !== 'choose') return s
  const board = guideBoard(s)
  if (!Number.isInteger(action.slot) || board.frames[action.slot] == null) return s
  if (beat.action === 'explore') {
    const explored = [...new Set([...s.explored, action.slot])]
    return explored.length === L3.frames ? { ...forward(s), explored }
      : { ...s, explored, error: `Page ${board.frames[action.slot]} says 1: it has been used recently.`, attempts: s.attempts + 1 }
  }
  if (beat.action === 'inspect') return action.slot === board.hand ? forward(s) : s
  if (beat.action !== 'evict') return s
  if (action.slot === CLOCK[beat.pending! - 1].slot) return { ...forward(s), reaction: 'approval' }
  const fresh = board.bits[action.slot] === 1
  return { ...s, attempts: s.attempts + 1, reaction: 'correction', error: fresh
    ? 'This page still has a 1. Its evidence has not been cleared in this search.'
    : board.cleared.includes(action.slot) && beat.id === 'second-victim'
      ? 'We just gave this page another chance and moved on. Continue from the inspection marker.'
      : "The search hasn't reached this slot again yet. Follow the inspection marker." }
}
