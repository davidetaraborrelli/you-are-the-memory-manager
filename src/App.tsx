import { useState } from 'react'
import { Act1 } from '@/screens/Act1'
import { Act2 } from '@/screens/Act2'
import type { DeclaredRule } from '@/lib/types'

/**
 * The lesson. Acts run in sequence and the state that crosses between them
 * lives here: right now that is the rule the learner declares on screen 5,
 * which screen 7 tests and scores against what they actually played.
 */
export default function App() {
  const [act, setAct] = useState(1)
  const [declared, setDeclared] = useState<DeclaredRule | null>(null)

  if (act === 1) return <Act1 onDone={() => setAct(2)} />
  return <Act2 declared={declared} onDeclare={setDeclared} onDone={() => setAct(3)} />
}
