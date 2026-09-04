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
let committedAtGate = false
let gate: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/**
 * Tell the machine the learner has locked something in — an eviction, an
 * answer, a prediction. The tell rule below is enforced against this.
 */
export function learnerCommitted() {
  committedAtGate = true
}

/**
 * Open a gate: the stretch of lesson the tell rule judges on its own, which is
 * one screen.
 *
 * This clears the commit flag and nothing else. It does not touch the face and
 * does not emit, so it cannot change anything the learner sees: the flag is
 * read by the warning below and by no other code. A screen boundary is not a
 * reason to wipe a face the previous beat earned, which is why this is not
 * resetMachine.
 *
 * Added 3 Sep 2026. The flag used to be cleared only by resetMachine, which
 * each act calls once from a mount effect. Acts hold several screens (act 1
 * holds 1 to 4, act 2 holds 5 to 7), so the first commit of an act armed the
 * rule for every screen after it and the check quietly stopped enforcing. It
 * was a contract that produced confidence instead of coverage.
 *
 * Call it *after* the effects that set the face. Effects run in declaration
 * order, so a beat that opens a new screen is still judged against the gate
 * that was open when the learner committed, which is the lenient answer and
 * the right one: approving a decision the learner has already made is not a
 * tell, and the face that beat sets is about the screen just finished.
 */
export function machineGate(next: string) {
  if (next === gate) return
  gate = next
  committedAtGate = false
}

/** Call when a new act mounts. Resets the face, the gate and the commit flag. */
export function resetMachine() {
  committedAtGate = false
  gate = null
  state = 'neutral'
  emit()
}

/**
 * The tell rule as a predicate, so it can be tested where the warning cannot.
 *
 * `import.meta.env` is undefined outside Vite, so a test that watched for the
 * console warning under bare node would be watching for something that never
 * fires and would pass for the wrong reason. tools/check_engine.ts asserts on
 * this instead.
 */
export function tellRuleBroken(next: MachineState): boolean {
  return next !== 'neutral' && !committedAtGate
}

export function setMachineState(next: MachineState) {
  // The tell rule, made mechanical. A dealer has no tells: the face may only
  // react to something the learner has already done. While the portrait is a
  // text box this is a legible bug rather than a judgement call, which is the
  // whole reason the placeholder exists.
  if (import.meta.env?.DEV && tellRuleBroken(next)) {
    console.warn(
      `[tell rule] machine went "${next}" before the learner committed` +
        `${gate ? ` at ${gate}` : ''}. ` +
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
