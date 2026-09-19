import { useEffect, useState } from 'react'
import { Tape } from '@/components/Tape'
import { Frames, SwappedOut } from '@/components/Frames'
import { Counter } from '@/components/Counter'
import { Bubble, useVoice } from '@/components/Bubble'
import { ProgressBar } from '@/components/ProgressBar'
import { L1 } from '@/lib/levels'
import { advance, createGame, isDone, resolve, swappedOut } from '@/lib/game'
import { learnerCommitted, machineGate, resetMachine, setMachineState } from '@/lib/machine'
import { BEATS, ambientFor, beatLines, beatMachine, endCard, regretFace, type Beat, type Focus } from '@/lib/act1'

/** The three regions of the board a line can be lit against. */
type Region = 'tape' | 'memory' | 'counter'

/** Hits pass on their own; this is how long the learner gets to see one go by. */
const HIT_MS = 500

/**
 * Screens 1–4: the whole of level 1, played blind.
 *
 * One game, a run of beats' worth of narration over it. The tape advances on its
 * own and stops for exactly two reasons — a miss needs a tap, or a beat has
 * something to say. There is no pause control and no step button: the learner
 * is the algorithm, not its operator.
 */
export function Act1({ onDone }: { onDone: () => void }) {
  const [game, setGame] = useState(() => createGame(L1.ref, L1.frames))
  const [seen, setSeen] = useState<string[]>([])
  const [beat, setBeat] = useState<Beat | null>(null)
  const [named, setNamed] = useState(false)
  const [lineIdx, setLineIdx] = useState(0)
  // Where the tape stood when each beat was closed — lets a beat require that
  // play has happened since another one, not merely that a button was tapped.
  const [closedAt, setClosedAt] = useState<Record<string, number>>({})

  useEffect(() => resetMachine(), [])

  // Fire the first unseen beat whose moment has arrived. Checked after every
  // resolved request, so a beat can only ever land on something already done.
  useEffect(() => {
    if (beat) return
    const next = BEATS.find((b) => !seen.includes(b.id) && b.when(game, seen, closedAt))
    if (!next) return
    setBeat(next)
    const face = beatMachine(next, game)
    if (face) setMachineState(face)
  }, [game, beat, seen, closedAt])

  // While nothing is blocking, the tape runs.
  useEffect(() => {
    if (beat || game.awaiting || isDone(game) || !seen.includes('welcome')) return
    const t = setTimeout(() => setGame(advance), HIT_MS)
    return () => clearTimeout(t)
  }, [game, beat, seen, closedAt])

  function choose(slot: number) {
    learnerCommitted()
    setMachineState('neutral')
    setGame((g) => resolve(g, slot))
  }

  /**
   * The word arrives *after* the sentence that hands it over: the learner reads
   * "every trip you made is a page fault" and then watches the counter relabel
   * itself under it. Renaming on the same bubble spends the beat before it
   * lands.
   *
   * It used to happen on the beat's dismissal, which is one action too late:
   * that beat is the last of the act and closing it hands over to act 2 in the
   * same click, so the relabel and the unmount landed in one render and nobody
   * ever saw it. The counter still read `page faults` from level 2 onwards, so
   * the word arrived; what was missing was the moment it arrives *on a number
   * the learner has already paid eight times*, which is the whole reason the
   * interface performs this naming instead of the voice just asserting it.
   */
  function advanceLine() {
    if (beat?.namesTheCounter && lineIdx === 0) setNamed(true)
    setLineIdx((n) => n + 1)
  }

  function dismissBeat() {
    if (!beat) return
    // Belt and braces: a learner who reaches the end of the group any other way
    // still leaves with the counter renamed.
    if (beat.namesTheCounter) setNamed(true)
    setClosedAt((m) => ({ ...m, [beat.id]: game.cursor }))
    setSeen((s) => [...s, beat.id])
    setBeat(null)
    setMachineState('neutral')
    // 'the-name' is the last beat of the act; closing it hands over to act 2.
    if (beat.id === 'the-name') onDone()
  }

  const last = game.events[game.events.length - 1]
  const ambient = beat ? null : ambientFor(game)
  const lines = beat ? beatLines(beat, game) : (ambient ?? [])

  // Sympathy for a consequence now visible, never a judgement of the next
  // victim. Later regrets stay matter-of-fact instead of repeating the gag.
  useEffect(() => {
    if (beat || !game.awaiting) return
    const face = regretFace(game, lineIdx)
    // The recorded eviction is an actual earlier commitment, even when a
    // narration boundary has since opened screen 3's gate.
    if (face === 'apologetic') learnerCommitted()
    setMachineState(face)
  }, [beat, game, lineIdx])

  // Between two groups the tape runs by itself and there is no group at all.
  // The bubble keeps the last line through it rather than emptying under a
  // board that has started moving.
  const voice = useVoice(lines, lineIdx)

  // One group of lines at a time; the index resets when the group changes.
  const groupKey = beat ? `beat:${beat.id}` : `ambient:${game.awaiting?.step ?? 'idle'}`

  // Turn-taking. While the voice still has something to say, the frames are
  // inert — the learner is either advancing the conversation or acting on the
  // board, never guessing which of the two the screen wants. The board takes
  // the turn on the group's last line, so a prompt is never left dangling.
  const speaking = beat !== null || lineIdx < lines.length - 1

  // What the current line is pointing at. Everything else steps back, so the
  // learner's eye lands on the thing being described instead of hunting for it.
  const focus: Focus | null = beat?.focus?.[lineIdx] ?? null

  /** `mask` is the tape with its hidden future pulsing; the region is the tape. */
  const lit: Region | null = focus === 'mask' ? 'tape' : focus

  /**
   * How lit each region is. Two rules, and the order between them is the whole
   * point: a region the voice is pointing at is never dimmed, even though the
   * board is inert while the voice has the turn.
   *
   * That precedence used to be the other way round for the frames, and it is
   * invisible in the code and glaring on the screen. `focus === 'memory'` fell
   * through to the inert dim, so while the welcome explained the slots the
   * *highlighted* region sat at 45% against 30% for everything else. Fifteen
   * points of difference is not a highlight.
   *
   * Dimming the rest is only half of pointing, and it is the half the learner
   * sees in their peripheral vision at best: the strip looked exactly as it had
   * a sentence earlier while the voice said "this strip". So the region being
   * talked about is also drawn as a lit panel, and its own label comes up to
   * full strength. The panel is neutral on purpose — an outline in the focus
   * colour would read as "tappable", which on this screen nothing is.
   */
  const region = (r: Region) => {
    const base = 'px-3 py-2 -mx-3 transition-all duration-300'
    if (lit) return lit === r ? `${base} bg-surface/40 ring-1 ring-edge` : `${base} opacity-30`
    // Nothing is being pointed at, so only the board the learner taps on
    // carries the turn-taking dim.
    return r === 'memory' && speaking ? `${base} opacity-45` : base
  }

  useEffect(() => setLineIdx(0), [groupKey])
  const screen = beat?.screen ?? (seen.length ? BEATS.find((b) => b.id === seen[seen.length - 1])!.screen : 1)

  // The tell rule, scoped to the screen rather than to the act. Declared after
  // the effect that sets the face on purpose: see machineGate.
  useEffect(() => machineGate(`act1:${screen}`), [screen])
  const done = isDone(game)
  const card = done ? endCard(game) : null

  return (
    <>
      <ProgressBar screen={screen} />
      <main className="mx-auto flex lesson-content max-w-2xl flex-col justify-center gap-6 px-5 py-12">
        <div className="lesson-activity">
          {/* The marker sits on the request being *dealt with*, not the one after
              it: while a beat is speaking about a hit, the tape has to still be
              showing that hit. When frozen for a decision it moves forward to the
              request being decided, because you cannot choose blind about which
              page is asking. */}
          <div className={region('tape')}>
          <Tape
            tape={L1.ref}
            cursor={game.awaiting ? game.awaiting.step - 1 : Math.max(0, game.cursor - 1)}
            flashStep={last?.kind === 'hit' ? last.step : null}
            lit={lit === 'tape'}
            pulseMask={focus === 'mask'}
          />
          </div>

          {/* Delayed regret. Without this line the counter is noise: it is the
              only thing that ties a fault back to the choice that caused it. */}
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
              lit={lit === 'memory'}
            />
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 ${region('counter')}`}>
            <SwappedOut pages={swappedOut(game)} />
            <Counter faults={game.faults} named={named} lit={lit === 'counter'} />
          </div>

          {card && (
            <section className="space-y-3 border-t border-edge pt-5 text-sm">
              <p>
                You finished with{' '}
                <strong className="font-semibold">
                  {card.faults} {named ? 'page faults' : 'trips'}
                </strong>{' '}
                out of {card.requests} requests.
              </p>
              {card.credit.map((c) => (
                <p key={c.page} className="text-hit">
                  Page {c.page}, dropped at step {c.step}. Never came back. Good call.
                </p>
              ))}
            </section>
          )}
        </div>

        <div className="min-h-44">
          <Bubble
            lines={voice.lines}
            index={voice.index}
            onNext={advanceLine}
            onDone={beat ? dismissBeat : undefined}
            doneLabel={beat?.doneLabel}
          />
        </div>
      </main>
    </>
  )
}
