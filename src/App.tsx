import { useEffect, useState } from 'react'
import { Act1 } from '@/screens/Act1'
import { Act2 } from '@/screens/Act2'
import { Act3 } from '@/screens/Act3'
import { Act4 } from '@/screens/Act4'
import { Act5 } from '@/screens/Act5'
import { Act6 } from '@/screens/Act6'
import { Act7 } from '@/screens/Act7'
import type { DeclaredRule } from '@/lib/types'
import { pythonRuntime } from '@/lib/python-runtime'
import { Desktop } from '@/components/Desktop'

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
 * level 1 again with the tape face up (8), Act4 is the reference-bit discovery
 * on level 3 (9). src/lib/screens.ts numbers the acts
 * the way the storyboard does, which is a different count on purpose, so the
 * mapping between the two lives here rather than being inferred.
 */
const RUNS = [
  { act: 1, screens: [1, 2, 3, 4] },
  { act: 2, screens: [5, 6, 7] },
  { act: 3, screens: [8] },
  { act: 4, screens: [9] },
  { act: 5, screens: [10] },
  { act: 6, screens: [11, 12, 13] },
  { act: 7, screens: [14] },
]

/**
 * Development only: `?screen=8` opens the run that contains screen 8.
 *
 * It jumps to a run, never into one. A beat is a position in a game that has
 * been played, so there is nothing coherent to drop the learner into halfway
 * through: asking for screen 6 starts level 2 at its beginning, and asking for
 * screen 8 lands exactly on it because that run is one screen long.
 * Screens 12 and 13 inspect completed runs, so their dev links can open
 * directly with canonical results already available.
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
  return <Desktop><Lesson /></Desktop>
}

function Lesson() {
  const [act, setAct] = useState(startingAct)
  const [declared, setDeclared] = useState<DeclaredRule | null>(null)
  const [reference, setReference] = useState(true)
  useEffect(() => { void pythonRuntime.warm() }, [])

  if (act === 1) return <Act1 onDone={() => setAct(2)} />
  if (act === 2) return <Act2 declared={declared} onDeclare={setDeclared} onDone={() => setAct(3)} />
  if (act === 3) return <Act3 onDone={() => setAct(4)} />
  if (act === 4) return <Act4 onDone={() => setAct(5)} />
  if (act === 5) return <Act5 onDone={(usedReference) => { setReference(usedReference); setAct(6) }} />
  if (act === 6) return <Act6 reference={reference} onDone={() => setAct(7)}
    initialScreen={import.meta.env.DEV && new URLSearchParams(window.location.search).get('screen') === '13' ? 13
      : import.meta.env.DEV && new URLSearchParams(window.location.search).get('screen') === '12' ? 12 : 11} />
  return <Act7 />
}
