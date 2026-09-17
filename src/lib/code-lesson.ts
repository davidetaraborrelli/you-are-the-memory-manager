import { data, L3 } from './levels.ts'
import type { ClockStep } from './types.ts'

export type Blanks = [string, string, string]
export const ANSWERS: Blanks = ['1', '0', 'cursor']
export const REFERENCE_AFTER = 3
export const INTRO = [
  'Let\'s put your rule into Python and run it on the whole tape.',
  "I've already written the code that remembers where to start and moves around the slots.",
  'Fill in three choices: which bit keeps the search going, what it becomes, and which slot to choose when the search stops.',
]
export const SYNTAX = [
  ['cursor', 'the slot currently being inspected'],
  ['bits[cursor]', 'the bit in that slot'],
  ['==', 'asks whether two values are equal'],
  ['=', 'changes a value'],
  ['while', 'repeats its indented lines for as long as its condition is true'],
  ['victim', 'the position the function will remove'],
]
export const HINTS = [
  ['bits[cursor] is the bit under the cursor. The first blank asks: while that bit equals what?',
    'The second blank is the new value assigned to that bit. The last names the position where the loop stopped.'],
  ['Start at slot 0: page 3 has bit 1. That is the bit that earned another chance on the previous screen.',
    'Consume that evidence, then move to slot 1. Its bit is 0, so the loop stops.',
    'The last blank must name the position where the loop stopped.'],
  ['while bits[cursor] == 1:', '    bits[cursor] = 0', '    cursor = next_slot(cursor)', '', 'victim = cursor'],
]
export function validateBlanks(fields: Blanks): (string | null)[] {
  return fields.map((field, i) => {
    const value = field.trim()
    if (!value) return 'Complete this blank first.'
    return (i < 2 ? ['0', '1'].includes(value) : value === 'cursor') ? null
      : i < 2 ? 'Type one bit: 0 or 1.' : 'Use the variable that names the current slot.'
  })
}

export interface RunSpec {
  initialFrames: (number | null)[]
  initialBits: number[]
  ref: number[]
  steps: ClockStep[]
}
export const QUICK: RunSpec = data.clockQuickCheck
export const FULL: RunSpec = {
  initialFrames: Array<number | null>(L3.frames).fill(null),
  initialBits: Array<number>(L3.frames).fill(0), ref: L3.ref, steps: L3.traces.clock!,
}
export interface CodeAction { kind: 'inspect' | 'write'; slot: number; before: number; after?: number }
export interface ExecutedStep extends ClockStep { actions?: CodeAction[]; returnedBits?: number[] }
export type RunResult =
  | { status: 'passed' | 'different'; records: ExecutedStep[]; message?: string; differenceStep?: number }
  | { status: 'technical'; message: string; field?: number }

export interface EditorState {
  fields: Blanks
  hints: number
  failures: number
  errors: (string | null)[]
  message: string | null
}
export const initialEditor = (): EditorState => ({ fields: ['', '', ''], hints: 0, failures: 0, errors: [null, null, null], message: null })
export function recordResult(editor: EditorState, result: RunResult): EditorState {
  const errors: (string | null)[] = [null, null, null]
  if (result.status === 'technical' && result.field !== undefined) errors[result.field] = result.message
  return { ...editor, errors, message: result.status === 'technical' ? result.message : null,
    failures: editor.failures + (result.status === 'different' ? 1 : 0) }
}

export interface PlaybackFrame {
  step: number
  frames: (number | null)[]
  bits: number[]
  hand: number
  slot: number | null
  faults: number
  caption: string
  kind: 'request' | 'inspect' | 'write' | 'return' | 'resolved'
  hit: boolean
}

/** Apply recorded actions to snapshots. Neither mode chooses a victim here. */
export function playback(spec: RunSpec, records: ExecutedStep[] = spec.steps): PlaybackFrame[] {
  const out: PlaybackFrame[] = []
  let frames = [...spec.initialFrames], bits = [...spec.initialBits], faults = 0
  for (const event of records) {
    const push = (kind: PlaybackFrame['kind'], hand: number, slot: number | null, caption: string) => {
      out.push({ step: event.step, frames: [...frames], bits: [...bits], hand, slot, faults, caption, kind, hit: event.outcome === 'hit' })
    }
    push('request', event.handBefore, null, `Page ${event.page} is requested.`)
    if (event.outcome === 'evict') {
      // Reference traces record each inspection, including the terminal victim.
      // Learner runs record the actual reads and writes made by their Python.
      const actions: CodeAction[] = event.actions ?? event.scanned.flatMap((slot, i) => {
        const bit = i === event.scanned.length - 1 ? 0 : bits[slot]
        const inspection: CodeAction = { kind: 'inspect', slot, before: bit }
        return i === event.scanned.length - 1 ? [inspection]
          : [inspection, { kind: 'write' as const, slot, before: bit, after: 0 }]
      })
      for (const action of actions) {
        if (action.kind === 'write') bits[action.slot] = action.after!
        const page = frames[action.slot]
        push(action.kind, action.slot, action.slot, action.kind === 'inspect'
          ? `Inspect page ${page}: bit ${bits[action.slot]}.`
          : `Page ${page}: ${action.before} → ${action.after}.`)
      }
      if (event.returnedBits) bits = [...event.returnedBits]
      push('return', event.slot, event.slot, `Remove page ${event.victim} from slot ${event.slot}.`)
    }
    frames = [...event.frames]; bits = [...event.bits]
    if (event.outcome !== 'hit') faults++
    push('resolved', event.handAfter, event.slot, event.outcome === 'hit'
      ? `Page ${event.page} is a hit. Its bit becomes 1.`
      : `Page ${event.page} enters with bit 1.`)
  }
  return out
}

export const resultLines = (reference: boolean) => [
  `${L3.scores.clock} faults. Exact LRU also took ${L3.scores.lru}, while OPT took ${L3.scores.opt}.`,
  reference
    ? "On this tape, the one-bit rule matched LRU while keeping much less information."
    : "Your rule matched LRU on this tape while keeping much less information.",
  reference ? 'The rule you were building is called **Clock**. Its search position moves around the slots like a clock hand.' : 'The rule you just built is called **Clock**. Its search position moves around the slots like a clock hand.',
  'Now let\'s see what happens when we give the same rule more memory.',
]
