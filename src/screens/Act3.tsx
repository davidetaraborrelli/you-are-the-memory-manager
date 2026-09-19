import { useEffect, useState } from 'react'
import { Tape } from '@/components/Tape'
import { Frames, SwappedOut } from '@/components/Frames'
import { Counter } from '@/components/Counter'
import { Bubble, useVoice } from '@/components/Bubble'
import { Choice } from '@/components/Choice'
import { Scoreboard } from '@/components/Scoreboard'
import { ProgressBar } from '@/components/ProgressBar'
import { L1, L2, trace } from '@/lib/levels'
import { advance, createGame, isDone, resolve, swappedOut, type Game } from '@/lib/game'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'
import type { Focus } from '@/lib/act1'
import { optNarrationFace } from '@/lib/portrait-cues'
import {
  BRIDGE,
  CATEGORY,
  EXTRACT,
  MEASURED,
  OPEN,
  PROOF,
  RULER_CAPTION,
  WHY_NOT,
  WHY_OPTIONS,
  WHOLE_TAPE,
  askAt,
  decisionAt,
  isVictim,
  proofMarks,
  proofRows,
  rulerRows,
  verdict,
  whyFeedback,
} from '@/lib/act3'

/** The three regions of the board a line can be lit against. */
type Region = 'tape' | 'memory' | 'counter'

/**
 * The learner has played this tape before and the replay is not the lesson, so
 * it moves along. Slower than level 2's instrument panel, because here there is
 * something to read on the right of the marker.
 */
const HIT_MS = 400

/**
 * The level 2 demonstration in beat 6. Faster than the learner's own play,
 * because nothing is being decided: they are watching a tape they have already
 * played being played perfectly.
 */
const DEMO_MS = 220

/** OPT on level 2, as the oracle recorded it. Nothing here re-derives it. */
const L2_OPT = trace(L2, 'opt')

/**
 * Screen 8: level 1 replayed with the whole tape visible.
 *
 * One continuous run again, and the same board the learner has used since the
 * first screen. Two things are different, and both are the point: the mask is
 * gone, and a tap that is not the best available page does not execute.
 *
 * The run is played *for* them everywhere it holds no decision. Steps 1 to 4
 * are three unavoidable fetches and a hit, steps 6 to 9 and 11 to 14 are hits;
 * asking for a tap on any of those would be asking the learner to operate the
 * tape rather than to decide anything. What is left is exactly two forks, which
 * is why this screen needs no guided multistep: there is nothing to guide
 * through.
 *
 * ── Why there is no regret line here ───────────────────────────────────────
 * The engine still attributes one: page 3 is dropped at step 5 and comes back
 * at step 10, so `awaiting.regret` is set, and every earlier screen would draw
 * "you dropped this 5 requests ago" in fault red. On this screen that would be
 * a reproach for the choice the machine has just called correct, and the same
 * fault is the one beat 4 proves nobody could have avoided. The attribution is
 * true and it is not about anything the learner should change, so it stays off.
 */
type Phase =
  | 'open'
  | 'play'
  | 'whole'
  | 'proof'
  | 'extract'
  | 'why'
  | 'answered'
  | 'category'
  | 'measure'
  | 'measured'
  | 'bridge'

export function Act3({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('open')
  const [game, setGame] = useState(() => createGame(L1.ref, L1.frames))
  const [lineIdx, setLineIdx] = useState(0)
  // A tap the tape does not support. It replaces the prompt until the learner
  // taps again, and the board keeps the turn: no button closes it.
  const [refusal, setRefusal] = useState<string[] | null>(null)
  // The best tap, already executed. This one takes the turn back, because it
  // says what the choice bought and the run should not walk over it.
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  // Every commit, counted. The bubble is keyed on the group, so without this
  // a second tap on the same refused page would redraw nothing at all: same
  // line, same key, no fade. Silence is how an interface says it is broken.
  const [taps, setTaps] = useState(0)
  /**
   * Beat 6's demonstration: level 2 replayed as OPT, driven from the oracle's
   * trace. It exists because the floor of that tape was never shown, only
   * quoted, and a screen that has just taught the learner to demand a proof
   * cannot hand them a 6 to believe two beats later.
   */
  const [demo, setDemo] = useState<Game | null>(null)

  useEffect(() => resetMachine(), [])
  // One screen, so this gate never changes. Declared anyway: the three acts
  // should say how they scope the tell rule in the same place, and the next
  // act to be built copies from one of them.
  useEffect(() => machineGate('act3:8'), [])

  useEffect(() => {
    const face = optNarrationFace(phase, lineIdx)
    if (face) setMachineState(face)
  }, [phase, lineIdx])

  /**
   * The replay. Everything that is not a fork runs on its own: hits pass, and
   * a miss into a free slot resolves itself, because every empty slot is the
   * same slot and choosing between them was never a decision.
   */
  useEffect(() => {
    if (phase !== 'play' || confirm) return
    if (isDone(game)) {
      setPhase('whole')
      return
    }
    if (game.awaiting?.mode === 'evict') return
    const t = setTimeout(
      () => setGame((g) => (g.awaiting ? resolve(g, g.frames.indexOf(null)) : advance(g))),
      HIT_MS,
    )
    return () => clearTimeout(t)
  }, [phase, game, confirm])

  // The machine plays level 2 to the end, taking every victim from the trace.
  useEffect(() => {
    if (phase !== 'measure' || !demo) return
    if (isDone(demo)) {
      setPhase('measured')
      return
    }
    const t = setTimeout(
      () => setDemo((g) => (g!.awaiting ? resolve(g!, L2_OPT[g!.awaiting.step - 1].slot) : advance(g!))),
      DEMO_MS,
    )
    return () => clearTimeout(t)
  }, [phase, demo])

  const decision = game.awaiting?.mode === 'evict' ? decisionAt(game.awaiting.step) : null

  /**
   * A tap at a fork. The tape is open, so a refusal can quote the step the
   * tapped page comes back on instead of hinting: the learner is told what
   * their own choice would cost and sent back to the evidence, never told which
   * page is the answer.
   */
  function choose(slot: number) {
    const page = game.frames[slot]
    if (!decision || page === null) return
    learnerCommitted()
    setTaps((n) => n + 1)
    if (!isVictim(decision, page)) {
      setRefusal(verdict(decision, page))
      setMachineState('correction')
      return
    }
    setRefusal(null)
    setConfirm(verdict(decision, page))
    setMachineState('approval')
    setGame((g) => resolve(g, slot))
  }

  function pickAnswer(id: string) {
    learnerCommitted()
    setTaps((n) => n + 1)
    setAnswer(id)
    const right = id === 'future'
    setSolved(right)
    setMachineState(right ? 'approval' : 'correction')
    setPhase('answered')
  }

  // --- what the voice is saying right now -----------------------------------

  const lines: string[] =
    phase === 'open'
      ? OPEN.lines
      : phase === 'play'
        ? (confirm ?? refusal ?? (decision ? askAt(decision) : []))
        : phase === 'whole'
          ? WHOLE_TAPE.lines
          : phase === 'proof'
            ? PROOF.lines
            : phase === 'extract'
              ? EXTRACT.lines
              : phase === 'why'
                ? WHY_NOT
                : phase === 'answered'
                  ? whyFeedback(answer ?? '')
                  : phase === 'category'
                    ? CATEGORY
                    // Nothing to say while the machine carries the instruction
                    // out: the bubble holds the line that asked for it, which
                    // is useVoice's job and no longer this expression's.
                    : phase === 'measure'
                      ? []
                      : phase === 'measured'
                        ? MEASURED
                        : BRIDGE

  // The replay runs itself wherever it holds no decision, and beat 6's
  // demonstration runs itself to the end. Both keep the line that set them off.
  const voice = useVoice(lines, lineIdx)

  const groupKey = `${phase}:${game.awaiting?.step ?? game.cursor}:${refusal ? 'no' : confirm ? 'yes' : '-'}:${answer ?? ''}:${taps}`
  useEffect(() => setLineIdx(0), [groupKey])

  const speaking = lineIdx < lines.length - 1

  /**
   * Turn-taking. Two groups hand over to something the learner must touch and
   * so end without a button: the prompt at a fork, and the question about why
   * OPT is not deployable. A wrong answer to that question hands the turn back
   * to the same options, so it ends without one too.
   */
  const handsOverToInput =
    (phase === 'play' && !confirm) ||
    phase === 'why' ||
    (phase === 'answered' && !solved) ||
    // The demonstration ends the group by finishing, not by being dismissed.
    phase === 'measure'

  const NEXT: Partial<Record<Phase, Phase>> = {
    open: 'play',
    whole: 'proof',
    proof: 'extract',
    extract: 'why',
    answered: 'category',
    category: 'measure',
    measured: 'bridge',
  }

  const onDoneLines = handsOverToInput
    ? undefined
    : () => {
        // The confirmation at a fork is not a phase: the run is already one
        // step further on and closing the bubble just lets it carry on.
        if (phase === 'play') {
          setConfirm(null)
          setMachineState('neutral')
          return
        }
        if (phase === 'bridge') return onDone()
        if (phase !== 'proof') setMachineState('neutral')
        // Level 2 arrives on the line that goes and gets it, so the learner
        // watches the tape change hands instead of finding it changed.
        if (phase === 'category') setDemo(createGame(L2.ref, L2.frames))
        setPhase(NEXT[phase]!)
      }

  // Which region each line points at. Beat 4's two groups and beat 5's both
  // point, so the memory tiles are dimmed for the whole argument about the
  // tape: they show the residency the run ended on, not the one being argued
  // about, and at full strength that is a contradiction the learner can read.
  const FOCUSED: Partial<Record<Phase, (Focus | null)[]>> = {
    open: OPEN.focus,
    whole: WHOLE_TAPE.focus,
    proof: PROOF.focus,
    extract: EXTRACT.focus,
  }
  const focus: Focus | null = FOCUSED[phase]?.[lineIdx] ?? null

  const lit: Region | null = focus === 'mask' ? 'tape' : focus
  const region = (r: Region) => {
    const base = 'px-3 py-2 -mx-3 transition-all duration-300'
    if (lit) return lit === r ? `${base} bg-surface/40 ring-1 ring-edge` : `${base} opacity-30`
    return r === 'memory' && speaking ? `${base} opacity-45` : base
  }

  // Once the run is over the tape stops being a strip that moves and becomes a
  // finished record, which is the thing beat 4 argues about. It is shown whole
  // from there on, and the proof marks land on cells the learner can see.
  const running = phase === 'open' || phase === 'play'
  const marks = phase === 'proof' ? proofMarks(lineIdx) : []
  // From beat 6 the board belongs to level 2. Same tape, same slots, same
  // counter: what changes is which run they are showing.
  const shown = demo ? { level: L2, g: demo } : { level: L1, g: game }
  const scrolling = running || phase === 'measure'
  const last = shown.g.events[shown.g.events.length - 1]

  const card = phase === 'proof' ? proofRows(lineIdx, game.faults) : null
  // Level 2's numbers appear on the line that goes and gets them, so the
  // learner watches the tape change hands instead of finding it changed. The
  // floor card holds the screen until then.
  // The table prices what the demonstration has already shown, so it may not
  // appear before it: printing 6 while the counter is still climbing to it
  // gives away the end of the thing the learner is watching.
  const ruler = phase === 'measured' || phase === 'bridge'
  // The floor card belongs to level 1, so it stays up for as long as level 1
  // is on the board and goes when the tape does. Dropping it a beat early
  // leaves a hole under a conversation that has not moved yet.
  const scored =
    phase === 'extract' || phase === 'why' || phase === 'answered' || phase === 'category'

  return (
    <>
      <ProgressBar screen={8} />
      <main className="mx-auto flex lesson-content max-w-2xl flex-col justify-center gap-6 px-5 py-12">
        <div className="lesson-activity">
          <div className={region('tape')}>
            <Tape
              tape={shown.level.ref}
              cursor={
                shown.g.awaiting ? shown.g.awaiting.step - 1 : Math.max(0, shown.g.cursor - 1)
              }
              reveal
              fit={!scrolling}
              markSteps={marks}
              flashStep={scrolling && last?.kind === 'hit' ? last.step : null}
              lit={lit === 'tape'}
            />
          </div>

          <div className={region('memory')}>
            <Frames
              frames={shown.g.frames}
              // Only a fork is ever offered, and only on the learner's own run.
              // The fills resolve themselves, so the board asks for a tap exactly
              // when there is a decision behind it.
              awaiting={demo || speaking || confirm || !decision ? null : game.awaiting}
              onChoose={choose}
              lit={lit === 'memory'}
            />
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 ${region('counter')}`}>
            <SwappedOut pages={swappedOut(shown.g)} />
            <Counter faults={shown.g.faults} named lit={lit === 'counter'} />
          </div>

          {(card || scored || ruler) && (
            <section className="border-t border-edge pt-5">
              <Scoreboard
                rows={ruler ? rulerRows() : (card ?? proofRows(2, game.faults))}
                caption={ruler ? RULER_CAPTION : null}
              />
            </section>
          )}
        </div>

        <div className="min-h-44">
          <Bubble
            lines={voice.lines}
            index={voice.index}
            onNext={() => setLineIdx((n) => n + 1)}
            onDone={onDoneLines}
            doneLabel={phase === 'bridge' ? 'Show me' : phase === 'open' ? 'Play it again' : 'Got it'}
          />
        </div>

        {(phase === 'why' || phase === 'answered') && (
          <Choice
            options={WHY_OPTIONS}
            // Nothing is marked until the answer is the right one: a refused
            // answer is not scored, the same way a refused tap is not.
            chosen={solved ? answer : null}
            disabled={speaking}
            onChoose={pickAnswer}
          />
        )}
      </main>
    </>
  )
}
