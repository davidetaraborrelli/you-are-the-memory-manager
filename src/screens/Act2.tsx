import { useEffect, useState } from 'react'
import { Tape } from '@/components/Tape'
import { Frames, SwappedOut } from '@/components/Frames'
import { Counter } from '@/components/Counter'
import { Bubble } from '@/components/Bubble'
import { Choice } from '@/components/Choice'
import { Scoreboard } from '@/components/Scoreboard'
import { ProgressBar } from '@/components/ProgressBar'
import { L2 } from '@/lib/levels'
import { advance, createGame, isDone, resolve, swappedOut, tileStats } from '@/lib/game'
import { learnerCommitted, resetMachine, setMachineState } from '@/lib/machine'
import type { Focus } from '@/lib/act1'

/** The three regions of the board a line can be lit against. */
type Region = 'tape' | 'memory' | 'counter'
import {
  ASK_THE_RULE,
  ASK_THE_SIGNAL,
  FORK_COPY,
  GENERALISE,
  NAMING,
  OFF_RULE,
  RESULT,
  RULE_OPTIONS,
  SIGNAL_OPTIONS,
  THE_FLOOR,
  ambientL2,
  consistentSlots,
  experimentIntro,
  forkRows,
  ruleFeedback,
  ruleRows,
  testRuleFor,
  type TestRule,
} from '@/lib/act2'
import type { DeclaredRule } from '@/lib/types'

/**
 * With the three signals printed on the tiles there is nothing left to work out
 * while a hit goes by, so waiting is the only thing that can go wrong. The tape
 * runs faster here than in level 1.
 */
const HIT_MS = 300

/**
 * Screens 5–7: declare a rule, run it as a controlled experiment, price it.
 *
 * The experiment is the point, and it is enforced rather than requested: while
 * a signal is under test, a tap the signal does not point at does not execute.
 * Without that, screen 7's table compares a rule against a run that was only
 * approximately that rule, and every conclusion on it is worth nothing.
 *
 * Screen 7 is five groups rather than one because they do different jobs: the
 * result, the fork that explains it, the names, the generalisation, and the
 * promise from screen 4 coming due. The board and the tables stay mounted
 * underneath all five.
 */
type Phase =
  | 'ask'
  | 'feedback'
  | 'intro'
  | 'pick-signal'
  | 'play'
  | 'result'
  | 'fork'
  | 'naming'
  | 'generalise'
  | 'bridge'

export function Act2({
  declared,
  onDeclare,
  onDone,
}: {
  declared: DeclaredRule | null
  onDeclare: (rule: DeclaredRule) => void
  onDone: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ask')
  const [picked, setPicked] = useState<string | null>(null)
  const [signal, setSignal] = useState<string | null>(null)
  const [lineIdx, setLineIdx] = useState(0)
  const [game, setGame] = useState(() => createGame(L2.ref, L2.frames))
  // Set by a tap the tested signal does not point at. It replaces the prompt
  // until the learner taps again; it never says which page is the right one.
  const [offRule, setOffRule] = useState(false)

  const rule: TestRule | null = testRuleFor(declared) ?? (signal as TestRule | null)

  useEffect(() => resetMachine(), [])

  useEffect(() => {
    if (phase !== 'play' || game.awaiting || isDone(game)) return
    const t = setTimeout(() => setGame(advance), HIT_MS)
    return () => clearTimeout(t)
  }, [phase, game])

  useEffect(() => {
    if (phase === 'play' && isDone(game)) setPhase('result')
  }, [phase, game])

  /**
   * The one face in act 2, and it lands after the run is over: the learner
   * followed a rule to the end of a tape without switching, which is the thing
   * this act actually asked of them. It goes neutral again for the naming,
   * which is exposition and has nothing to approve of.
   */
  useEffect(() => {
    if (phase === 'result') setMachineState('approval')
    if (phase === 'naming') setMachineState('neutral')
  }, [phase])

  // --- what the voice is saying right now -----------------------------------

  const intro = experimentIntro()
  const lines: string[] =
    phase === 'ask'
      ? ASK_THE_RULE
      : phase === 'feedback'
        ? ruleFeedback(declared ?? 'random')
        : phase === 'intro'
          ? intro.lines
          : phase === 'pick-signal'
            ? ASK_THE_SIGNAL
            : phase === 'play'
              ? (offRule ? OFF_RULE : (ambientL2(game) ?? []))
              : phase === 'result'
                ? RESULT
                : phase === 'fork'
                  ? FORK_COPY
                  : phase === 'naming'
                    ? NAMING
                    : phase === 'generalise'
                      ? GENERALISE
                      : THE_FLOOR

  const groupKey = `${phase}:${game.awaiting?.step ?? picked ?? 'x'}:${offRule}`
  useEffect(() => setLineIdx(0), [groupKey])

  const speaking = lineIdx < lines.length - 1
  const focus: Focus | null = phase === 'intro' ? (intro.focus[lineIdx] ?? null) : null

  /** Same treatment as act 1: the region being pointed at is lit, not just undimmed. */
  const lit: Region | null = focus === 'mask' ? 'tape' : focus
  const region = (r: Region) => {
    const base = 'rounded-xl px-3 py-2 -mx-3 transition-all duration-300'
    if (lit) return lit === r ? `${base} bg-surface/40 ring-1 ring-edge` : `${base} opacity-30`
    return r === 'memory' && speaking ? `${base} opacity-45` : base
  }

  /**
   * Turn-taking: where the last line hands over to something the learner must
   * touch (the frames, or the options), the group ends without a button. A
   * button that closes nothing is a dead control.
   */
  const handsOverToInput = phase === 'play' || phase === 'ask' || phase === 'pick-signal'
  const NEXT: Partial<Record<Phase, Phase>> = {
    feedback: 'intro',
    result: 'fork',
    fork: 'naming',
    naming: 'generalise',
    generalise: 'bridge',
  }
  const onDoneLines = handsOverToInput
    ? undefined
    : () => {
        if (phase === 'intro') return setPhase(rule ? 'play' : 'pick-signal')
        if (phase === 'bridge') return onDone()
        setPhase(NEXT[phase]!)
      }

  /**
   * The experiment's one enforcement. An inconsistent tap is not scored, not
   * punished and not answered: the board simply does not move, and the voice
   * re-asks the question the learner already has the evidence for.
   */
  function choose(slot: number) {
    if (game.awaiting?.mode === 'evict' && rule && !consistentSlots(game, rule).includes(slot)) {
      setOffRule(true)
      return
    }
    learnerCommitted()
    setOffRule(false)
    setGame((g) => resolve(g, slot))
  }

  function pick(id: string) {
    learnerCommitted()
    setPicked(id)
    onDeclare(id as DeclaredRule)
    setPhase('feedback')
  }

  function pickSignal(id: string) {
    learnerCommitted()
    setSignal(id)
    setPhase('play')
  }

  const scoring = phase !== 'ask' && phase !== 'feedback' && phase !== 'intro' && phase !== 'pick-signal' && phase !== 'play'
  const showBoard = phase === 'intro' || phase === 'pick-signal' || phase === 'play' || scoring
  const last = game.events[game.events.length - 1]
  const screen = phase === 'ask' || phase === 'feedback' ? 5 : scoring ? 7 : 6
  const testing = rule ? SIGNAL_OPTIONS.find((o) => o.id === rule)!.label.toLowerCase() : null

  return (
    <>
      <ProgressBar screen={screen} />
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-5 py-12">
        {showBoard && (
          <>
            <div className={region('tape')}>
              <Tape
                tape={L2.ref}
                cursor={game.awaiting ? game.awaiting.step - 1 : Math.max(0, game.cursor - 1)}
                flashStep={last?.kind === 'hit' ? last.step : null}
                lit={lit === 'tape'}
              />
            </div>

            {game.awaiting?.regret && (
              <p className="text-sm text-fault">
                You dropped this {game.awaiting.regret.stepsAgo}{' '}
                {game.awaiting.regret.stepsAgo === 1 ? 'request' : 'requests'} ago.
              </p>
            )}

            <div className={region('memory')}>
              <Frames
                frames={game.frames}
                awaiting={speaking ? null : game.awaiting}
                onChoose={choose}
                regretPage={game.awaiting?.regret?.page ?? null}
                stats={tileStats(game)}
                lit={lit === 'memory'}
              />
            </div>

            <div className={`flex items-center justify-between ${region('counter')}`}>
              <SwappedOut pages={swappedOut(game)} />
              <Counter faults={game.faults} named lit={lit === 'counter'} />
            </div>

            {/* The commitment, kept on screen for the whole run. The learner
                agreed not to switch halfway; leaving what they agreed to off
                the board would make that a memory test. */}
            {phase === 'play' && testing && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                testing: {testing}
              </p>
            )}
          </>
        )}

        {scoring && (
          <section className="border-t border-edge pt-5">
            <Scoreboard rows={phase === 'fork' ? forkRows() : ruleRows(rule)} />
          </section>
        )}

        <div className="min-h-44">
          <Bubble
            lines={lines}
            index={lineIdx}
            onNext={() => setLineIdx((n) => n + 1)}
            onDone={onDoneLines}
            doneLabel={phase === 'bridge' ? 'Show me' : 'Got it'}
          />
        </div>

        {phase === 'ask' && (
          <Choice options={RULE_OPTIONS} chosen={picked} disabled={speaking} onChoose={pick} />
        )}
        {phase === 'pick-signal' && (
          <Choice options={SIGNAL_OPTIONS} chosen={signal} disabled={speaking} onChoose={pickSignal} />
        )}
      </main>
    </>
  )
}
