import { useSyncExternalStore } from 'react'
import type { MachineState } from './types'

/**
 * The machine's face, as a store rather than a prop.
 *
 * PROGETTO.md is explicit that the rest of the app must never know what is
 * drawn inside the portrait: one call site, one graphic slot. Dropping in the
 * finished sprite sheet should touch MachinePortrait.tsx and nothing else.
 */

let state: MachineState = 'neutral'
let committedThisScreen = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/**
 * Tell the machine the learner has locked something in — an eviction, an
 * answer, a prediction. The tell rule below is enforced against this.
 */
export function learnerCommitted() {
  committedThisScreen = true
}

/** Call when a new screen mounts. Resets the face and the commit flag. */
export function resetMachine() {
  committedThisScreen = false
  state = 'neutral'
  emit()
}

export function setMachineState(next: MachineState) {
  // The tell rule, made mechanical. A dealer has no tells: the face may only
  // react to something the learner has already done. While the portrait is a
  // text box this is a legible bug rather than a judgement call, which is the
  // whole reason the placeholder exists.
  if (import.meta.env.DEV && next !== 'neutral' && !committedThisScreen) {
    console.warn(
      `[tell rule] machine went "${next}" before the learner committed. ` +
        `A face that reacts early gives the answer away in a channel the ` +
        `learner will read instead of reasoning.`,
    )
  }
  state = next
  emit()
}

export function useMachineState(): MachineState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => state,
  )
}
