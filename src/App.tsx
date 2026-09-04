import { useState } from 'react'
import { Act1 } from '@/screens/Act1'
import { Act2 } from '@/screens/Act2'
import { Act3 } from '@/screens/Act3'
import { SCREENS } from '@/lib/screens'
import type { DeclaredRule } from '@/lib/types'

/**
 * The lesson. Acts run in sequence and the state that crosses between them
 * lives here: right now that is the rule the learner declares on screen 5,
 * which screen 6 then holds them to for the whole of level 2.
 */
/**
 * Which run renders which screen.
 *
 * A module is one continuous run of one tape, not one storyboard act: Act1 is
 * level 1 played blind (screens 1 to 4), Act2 is level 2 (5 to 7), Act3 is
 * level 1 again with the tape face up (8). src/lib/screens.ts numbers the acts
 * the way the storyboard does, which is a different count on purpose, so the
 * mapping between the two lives here rather than being inferred.
 */
const RUNS = [
  { act: 1, screens: [1, 2, 3, 4] },
  { act: 2, screens: [5, 6, 7] },
  { act: 3, screens: [8] },
]

/**
 * Development only: `?screen=8` opens the run that contains screen 8.
 *
 * It jumps to a run, never into one. A beat is a position in a game that has
 * been played, so there is nothing coherent to drop the learner into halfway
 * through: asking for screen 6 starts level 2 at its beginning, and asking for
 * screen 8 lands exactly on it because that run is one screen long.
 *
 * `import.meta.env.DEV` is replaced by a literal at build time, so this whole
 * branch is gone from the bundle a visitor loads.
 */
function startingAct(): number {
  if (!import.meta.env.DEV) return 1
  const asked = Number(new URLSearchParams(window.location.search).get('screen'))
  return RUNS.find((r) => r.screens.includes(asked))?.act ?? 1
}

export default function App() {
  const [act, setAct] = useState(startingAct)
  const [declared, setDeclared] = useState<DeclaredRule | null>(null)

  if (act === 1) return <Act1 onDone={() => setAct(2)} />
  if (act === 2) return <Act2 declared={declared} onDeclare={setDeclared} onDone={() => setAct(3)} />
  if (act === 3) return <Act3 onDone={() => setAct(4)} />
  return <NotBuiltYet />
}

/**
 * Where the built lesson stops. Acts are built in order (see src/lib/screens.ts)
 * and screen 9 is next; until it exists the bridge at the end of screen 8 has
 * somewhere honest to land instead of a button that does nothing.
 *
 * This is scaffolding, not lesson copy. It goes when the last act arrives.
 */
function NotBuiltYet() {
  const rest = SCREENS.filter((s) => !s.built)
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-3 px-5 py-12 text-sm text-ink-dim">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        end of what is built
      </p>
      <p>
        Screens {rest[0].n} to {rest[rest.length - 1].n} are still storyboard only.
      </p>
      <ol className="list-inside list-decimal space-y-1">
        {rest.map((s) => (
          <li key={s.id} value={s.n}>
            {s.title}
          </li>
        ))}
      </ol>
    </main>
  )
}
