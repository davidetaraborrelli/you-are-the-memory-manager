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
import { beatMachine, type Beat, type Focus } from '@/lib/act1'
import {
  theFloor,
  ASK_THE_RULE,
  BEATS,
  RULE_OPTIONS,
  handover,
  ambientL2,
  declaredRowLabel,
  declaredScore,
  namingCopy,
  ruleFeedback,
  scoreboardCopy,
} from '@/lib/act2'
import type { DeclaredRule } from '@/lib/types'

/**
 * With the timestamps printed on the tiles there is nothing left to work out
 * while a hit goes by, so waiting is the only thing that can go wrong. The tape
 * runs faster here than in level 1.
 */
const HIT_MS = 300

/**
 * `score` is what happened, `name` is what it is called. Two groups rather than
 * one because the vocabulary rule wants the label to arrive on a number the
 * learner has already read, and because the scoreboard row relabels itself
 * between them.
 */
type Phase = 'ask' | 'feedback' | 'handover' | 'play' | 'score' | 'name' | 'ask-opt'

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
  const [lineIdx, setLineIdx] = useState(0)
  const [game, setGame] = useState(() => createGame(L2.ref, L2.frames))
  const [seen, setSeen] = useState<string[]>([])
  const [beat, setBeat] = useState<Beat | null>(null)

  useEffect(() => resetMachine(), [])

  useEffect(() => {
    if (phase !== 'play' || beat) return
    const next = BEATS.find((b) => !seen.includes(b.id) && b.when(game, seen, {}))
    if (!next) return
    setBeat(next)
    const face = beatMachine(next, game)
    if (face) setMachineState(face)
  }, [phase, game, beat, seen])

  useEffect(() => {
    if (phase !== 'play' || beat || game.awaiting || isDone(game)) return
    const t = setTimeout(() => setGame(advance), HIT_MS)
    return () => clearTimeout(t)
  }, [phase, game, beat])

  useEffect(() => {
    if (phase === 'play' && isDone(game) && !beat) setPhase('score')
  }, [phase, game, beat])

  // --- what the voice is saying right now -----------------------------------

  const ambient = phase === 'play' && !beat ? ambientL2(game) : null
  const lines: string[] =
    phase === 'ask'
      ? ASK_THE_RULE
      : phase === 'feedback'
        ? ruleFeedback(picked ?? '')
        : phase === 'handover'
          ? handover(declared ?? 'random').lines
          : phase === 'play'
            ? (beat?.lines ?? ambient ?? [])
            : phase === 'score'
              ? scoreboardCopy(declared ?? 'random', game.faults)
              : phase === 'name'
                ? namingCopy(declared ?? 'random')
                : theFloor(game.faults)

  const groupKey = `${phase}:${beat?.id ?? game.awaiting?.step ?? picked ?? 'x'}`
  useEffect(() => setLineIdx(0), [groupKey])

  const speaking = lineIdx < lines.length - 1
  const focus: Focus | null =
    phase === 'handover'
      ? (handover(declared ?? 'random').focus[lineIdx] ?? null)
      : (beat?.focus?.[lineIdx] ?? null)

  /**
   * Turn-taking again: where the last line hands over to something the learner
   * must touch (the frames, or the four options), the group ends without a
   * button. A button that closes nothing is a dead control.
   */
  const handsOverToInput = (phase === 'play' && !beat) || phase === 'ask'
  const onDoneLines = handsOverToInput
    ? undefined
    : () => {
        if (phase === 'feedback') return setPhase('handover')
        if (phase === 'handover') return setPhase('play')
        if (phase === 'score') return setPhase('name')
        if (phase === 'name') return setPhase('ask-opt')
        if (phase === 'ask-opt') return onDone()
        // a beat during play
        if (beat) {
          setSeen((s) => [...s, beat.id])
          setBeat(null)
          setMachineState('neutral')
        }
      }

  function choose(slot: number) {
    learnerCommitted()
    setGame((g) => resolve(g, slot))
  }

  function pick(id: string) {
    learnerCommitted()
    setPicked(id)
    onDeclare(id as DeclaredRule)
    setPhase('feedback')
  }

  const scoring = phase === 'score' || phase === 'name' || phase === 'ask-opt'
  const showBoard = phase === 'handover' || phase === 'play' || scoring
  const last = game.events[game.events.length - 1]
  const screen = phase === 'ask' || phase === 'feedback' ? 5 : scoring ? 7 : 6
  // The row keeps the learner's own wording until the group that renames it opens.
  const named = phase === 'name' || phase === 'ask-opt'
  const rule = declared ?? 'random'

  return (
    <>
      <ProgressBar screen={screen} />
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-5 py-12">
        {showBoard && (
          <>
            <div className={focus && focus !== 'tape' ? 'opacity-30 transition-opacity' : 'transition-opacity'}>
              <Tape
                tape={L2.ref}
                cursor={game.awaiting ? game.awaiting.step - 1 : Math.max(0, game.cursor - 1)}
                flashStep={last?.kind === 'hit' ? last.step : null}
              />
            </div>

            {game.awaiting?.regret && (
              <p className="text-sm text-fault">
                You dropped this {game.awaiting.regret.stepsAgo}{' '}
                {game.awaiting.regret.stepsAgo === 1 ? 'step' : 'steps'} ago.
              </p>
            )}

            <div
              className={`transition-opacity duration-300 ${
                focus && focus !== 'memory' ? 'opacity-30' : speaking || beat ? 'opacity-45' : ''
              }`}
            >
              <Frames
                frames={game.frames}
                awaiting={speaking || beat ? null : game.awaiting}
                onChoose={choose}
                regretPage={game.awaiting?.regret?.page ?? null}
                stats={tileStats(game)}
              />
            </div>

            <div className="flex items-center justify-between">
              <SwappedOut pages={swappedOut(game)} />
              <Counter faults={game.faults} named />
            </div>
          </>
        )}

        {scoring && (
          <section className="border-t border-edge pt-5">
            <Scoreboard
              rows={[
                { id: 'you', label: 'You', value: game.faults, emphasis: true },
                { id: 'declared', label: declaredRowLabel(rule, named), value: declaredScore(rule) },
              ]}
            />
          </section>
        )}

        <div className="min-h-44">
          <Bubble
            lines={lines}
            index={lineIdx}
            onNext={() => setLineIdx((n) => n + 1)}
            onDone={onDoneLines}
            doneLabel={phase === 'ask-opt' ? 'Show me' : 'Got it'}
          />
        </div>

        {phase === 'ask' && (
          <Choice
            options={RULE_OPTIONS}
            chosen={picked}
            disabled={speaking}
            onChoose={pick}
          />
        )}
      </main>
    </>
  )
}
