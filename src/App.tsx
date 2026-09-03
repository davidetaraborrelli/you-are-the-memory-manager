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
export default function App() {
  const [act, setAct] = useState(1)
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
