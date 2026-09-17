import { TRANSFER } from './levels.ts'

export type TransferStage = 'evidence' | 'pattern' | 'policy'
export const INTRO = [
  'An AI coding assistant works with a limited amount of text at a time: its **context window**.',
  'Imagine a simplified assistant whose window holds three whole code files. To load a fourth, it must leave one out.',
]
export const QUESTIONS: Record<TransferStage, string[]> = {
  evidence: ['Before its next file request, which of these does the assistant know for certain?'],
  pattern: ['In which task would you trust recent use more when deciding what to keep?'],
  policy: ['If B keeps repeating this loop, which rule would you expect to need the fewest file reloads?'],
}
export const OPTIONS = {
  evidence: [
    { id: 'steps', label: 'Every step it will take to finish the task' },
    { id: 'future', label: 'Every file it will need later' },
    { id: 'past', label: 'The file requests made so far' },
    { id: 'next-file', label: 'Exactly which file comes next' },
  ],
  pattern: [
    { id: 'a', label: 'Task A, iterative debugging' },
    { id: 'b', label: 'Task B, the four-file loop' },
    { id: 'same', label: 'The same in both' },
    { id: 'memory-only', label: 'Recency only works for virtual memory' },
  ],
  policy: [
    { id: 'lru', label: 'Drop the least recently used file' },
    { id: 'mru', label: 'Drop the most recently used file' },
    { id: 'fifo', label: 'Drop the file that has sat there longest' },
    { id: 'random', label: 'Drop one at random' },
  ],
}
export const ANSWERS: Record<TransferStage, string> = { evidence: 'past', pattern: 'a', policy: 'mru' }
export const CORRECT: Record<TransferStage, string[]> = {
  evidence: [
    'Exactly. The requests so far are a record it can inspect. Future requests are still predictions.',
    "Let's see whether recent use gives it a useful clue in these two tasks.",
  ],
  pattern: [
    'Exactly. A quickly returns to recently used files. Keeping them ready fits that pattern.',
    'In B, each file waits for the other three before returning. All four take turns, but the window only holds three.',
  ],
  policy: [
    'Exactly. If the loop continues, the file used most recently has the longest wait before its next turn.',
    'Here, dropping utils.py to load models.py keeps api.py and db.py ready. They are the next two files requested in the history.',
  ],
}
const UNKNOWN_FUTURE = ['The assistant can predict what it might need, but a prediction isn’t knowledge of the future. What information does it already have? Try again.']
export const WRONG: Record<TransferStage, Record<string, string[]>> = {
  evidence: { steps: UNKNOWN_FUTURE, future: UNKNOWN_FUTURE, 'next-file': UNKNOWN_FUTURE },
  pattern: {
    b: ['B repeats, but three other files are used before the same file returns. Compare that gap with the quick returns in A. Try again.'],
    same: ['Both patterns repeat files. Compare how much happens between two uses of the same file: that gap matters when space is limited. Try again.'],
    'memory-only': ['These slots keep files ready just as frames kept pages ready. Recent use can still be a clue to what will be needed again. Compare the two patterns and try again.'],
  },
  policy: {
    lru: [
      'When models.py arrives, the least recently used file in the window is api.py. Your rule drops it to make room.',
      'The very next request in the history is api.py. This rule keeps dropping the file whose turn is next. Compare the other rules and try again.',
    ],
    fifo: [
      'Here, the first file loaded is also the one used longest ago: nothing repeats before all four files have had a turn.',
      'So this rule also drops api.py when models.py arrives, just before api.py is needed again. Compare the other rules and try again.',
    ],
    random: [
      'Random sometimes keeps the next file, unlike LRU here. But it can also throw that file away.',
      'The loop gives you a clue that random ignores: compare how long each stored file waits for its next turn. Try again.',
    ],
  },
}
export const ENDING = [
  'You started by guessing which page to drop. Now you can explain what makes that guess useful: the evidence you keep and the pattern you expect to continue.',
  'Where else in computing does making room mean choosing what to forget?',
]
export interface TransferState {
  stage: TransferStage
  phase: 'intro' | 'question' | 'wrong' | 'correct' | 'ending'
  line: number
  chosen: string | null
}
export type TransferAction = { type: 'next' } | { type: 'choose'; id: string }
export function initialTransfer(): TransferState {
  return { stage: 'evidence', phase: 'intro', line: 0, chosen: null }
}
export function transferLines(state: TransferState): string[] {
  switch (state.phase) {
    case 'intro': return INTRO
    case 'question': return QUESTIONS[state.stage]
    case 'wrong': return WRONG[state.stage][state.chosen!]
    case 'correct': return CORRECT[state.stage]
    case 'ending': return ENDING
  }
}
export function transferReducer(state: TransferState, action: TransferAction): TransferState {
  if (action.type === 'choose') {
    if (state.phase !== 'question' || !OPTIONS[state.stage].some((o) => o.id === action.id)) return state
    return { ...state, chosen: action.id, line: 0, phase: action.id === ANSWERS[state.stage] ? 'correct' : 'wrong' }
  }
  if (state.line < transferLines(state).length - 1) return { ...state, line: state.line + 1 }
  if (state.phase === 'intro' || state.phase === 'wrong') return { ...state, phase: 'question', chosen: null, line: 0 }
  if (state.phase === 'correct') {
    if (state.stage === 'policy') return { ...state, phase: 'ending', line: 0 }
    return { stage: state.stage === 'evidence' ? 'pattern' : 'policy', phase: 'question', chosen: null, line: 0 }
  }
  return state
}
/** Only project earned evidence. In particular, never expose the victim early. */
export function transferView(state: TransferState) {
  const checkpoint = state.stage === 'policy'
  const explainPattern = state.stage === 'pattern' && state.phase === 'correct'
  const explainPolicy = checkpoint && ((state.phase === 'correct' && state.line >= 1) || state.phase === 'ending')
  return {
    slots: checkpoint ? TRANSFER.checkpoint.resident : Array<string | null>(TRANSFER.capacity).fill(null),
    request: checkpoint ? TRANSFER.checkpoint.incoming : null,
    requestIndex: checkpoint ? TRANSFER.checkpoint.requestIndex : null,
    taskA: state.stage === 'pattern' ? TRANSFER.taskA : null,
    taskB: state.stage !== 'evidence' ? TRANSFER.taskB : null,
    shortReturns: explainPattern ? TRANSFER.shortReturns : [],
    cycles: explainPattern || checkpoint,
    victim: explainPolicy ? TRANSFER.checkpoint.victim : null,
    nextIndices: explainPolicy ? TRANSFER.checkpoint.nextIndices : [],
  }
}
export function transferDone(state: TransferState) {
  return state.phase === 'ending' && state.line === ENDING.length - 1
}
