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
    "Here's the record behind LRU: when each page was last used. It tells us which page was used longest ago.",
    'Watch what happens to the record when a page already in memory is used again.',
  ] },
  { id: 'hits', scene: 'exact', action: 'watch', lines: [
    'Both requests are hits. Watch the last-used values change.',
  ] },
  { id: 'cost', scene: 'exact', action: 'question', lines: ['When does that bookkeeping have to happen?'] },
  { id: 'cost-earned', scene: 'exact', action: 'continue', lines: [
    'Exactly. Even a hit can change the recency order. LRU must track where the used page belongs among all the others.',
  ] },
  { id: 'scale', scene: 'scale', action: 'continue', lines: [
    "Keeping that exact order takes work, especially with many pages.",
    "Could we keep a useful clue about recent use without tracking the whole order?",
  ] },
  { id: 'compress', scene: 'bits', action: 'continue', label: 'Try the cheaper clue', lines: [
    "Let's replace each timestamp with a **reference bit**: a marker that can be 0 or 1.",
    'Using a page sets its bit to 1. That records the use, but not when it happened.',
  ] },
  { id: 'fill', scene: 'run', action: 'watch', completed: 0, lines: [
    'Here is level three. The first three pages enter empty slots. Each starts at 1 because it has just been used.',
  ] },
  { id: 'equal', scene: 'run', action: 'explore', completed: 3, pending: 4, lines: [
    'Page 5 needs a slot, but all three resident pages say 1. With the exact timestamps gone, can you tell which one is least recent?',
  ] },
  { id: 'first-inspection', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 0, hand: true, lines: [
    'All three bits say 1. The bits alone cannot tell us which page was used longest ago.',
    "Let's make a 1 worth one extra chance. When we inspect it, we'll change it to 0, spare the page, and move to the next slot.",
  ] },
  { id: 'spent', scene: 'run', action: 'continue', completed: 3, pending: 4, inspected: 1, hand: true, lines: [
    'Page 1 stays. Its bit is now 0, so another use can leave a fresh mark.',
  ] },
  { id: 'inspect-middle', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 1, hand: true, lines: [] },
  { id: 'inspect-last', scene: 'run', action: 'inspect', completed: 3, pending: 4, inspected: 2, hand: true, lines: [] },
  { id: 'first-victim', scene: 'run', action: 'evict', completed: 3, pending: 4, inspected: 3, hand: true, lines: [
    "We've inspected each slot once. Now we're back at page 1.",
    "Its bit is still 0: it hasn't been used since we cleared the bit.",
  ] },
  { id: 'loaded', scene: 'run', action: 'continue', completed: 4, lines: [
    'Page 5 starts at 1 because it has just been used.',
  ] },
  { id: 'return', scene: 'run', action: 'watch', completed: 4, lines: [
    'Now page 3 is requested again.',
  ] },
  { id: 'restored', scene: 'run', action: 'continue', completed: 5, lines: [
    'There it is. Page 3 was used again, so its bit went back to 1.',
    "A new use restores the chance that the previous inspection took away.",
  ] },
  { id: 'resume', scene: 'run', action: 'inspect', completed: 5, pending: 6, inspected: 0, hand: true, lines: [
    "Page 4 needs a slot. We resume just after the last replacement, at page 3.",
  ] },
  { id: 'second-victim', scene: 'run', action: 'evict', completed: 5, pending: 6, inspected: 1, hand: true, lines: [
    'Page 3 has fresh evidence, so it gets another chance.',
    "Page 2 still says 0. Unlike page 3, it hasn't been used again since we cleared its bit.",
  ] },
  { id: 'understood', scene: 'run', action: 'continue', completed: 6, hand: true, lines: [
    'You removed a page still at 0 when the search reached it. A page marked 1 gets another chance.',
    'Every use still sets a bit. The saving is that we no longer maintain the exact order; we inspect and clear bits when a replacement is required.',
  ] },
  { id: 'compression-earned', scene: 'comparison', action: 'continue', completed: 6, lines: [
    'One bit per page and a remembered search position. Less information than LRU, but repeated use can still protect a page.',
  ] },
  { id: 'bridge', scene: 'comparison', action: 'continue', completed: 6, label: 'Make it a rule', lines: [
    "You have followed the rule by hand. Now make the computer follow it.",
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
const forward = (s: GuideState): GuideState => {
  const next = GUIDE[s.beat + 1]?.id
  return {
    ...s, beat: s.beat + 1, line: 0, ticks: 0, error: null,
    reaction: next === 'compression-earned' ? 'satisfied' : next === 'restored' ? 'approval' : 'neutral',
  }
}

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
    if (s.line < beat.lines.length - 1) return {
      ...s, line: s.line + 1,
      // The apology belongs to the discovered limit, not the next proposal.
      reaction: ['first-inspection', 'restored', 'second-victim', 'understood'].includes(beat.id) ? 'neutral' : s.reaction,
    }
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
    return explored.length === L3.frames ? { ...forward(s), explored, reaction: 'apologetic' }
      : { ...s, explored, error: `Page ${board.frames[action.slot]} has bit 1. The bit records use, but not when it happened.`, attempts: s.attempts + 1 }
  }
  if (beat.action === 'inspect') {
    if (action.slot !== board.hand) return s
    const next = forward(s)
    // Acknowledge the first cleared bit and the renewed chance on page 3.
    return beat.id === 'first-inspection' || beat.id === 'resume' ? { ...next, reaction: 'approval' } : next
  }
  if (beat.action !== 'evict') return s
  if (action.slot === CLOCK[beat.pending! - 1].slot) return { ...forward(s), reaction: 'approval' }
  const fresh = board.bits[action.slot] === 1
  return { ...s, attempts: s.attempts + 1, reaction: 'correction', error: fresh
    ? 'This page still has a 1. Its evidence has not been cleared in this search.'
    : board.cleared.includes(action.slot) && beat.id === 'second-victim'
      ? 'We just gave this page another chance and moved on. Continue from the inspection marker.'
      : "The search hasn't reached this slot again yet. Follow the inspection marker." }
}
