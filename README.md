# You are the memory manager

An interactive lesson on page replacement. Fifteen screens, 9–12 minutes, no
backend. Design documents live in [`docs-progettazione/`](docs-progettazione/)
and are internal — they are not published and not part of the deliverable.

```bash
npm install
npm run data      # regenerate src/data/levels.json from Python
npm run dev
```

## How this is put together

**Python owns every number.** `tools/sim.py` is the oracle: it asserts each
figure quoted in the storyboard. `tools/gen_levels.py` extends it with
slot-accurate traces — which frame held which page at every step — and writes
`src/data/levels.json`. It cross-checks its own traces against `sim.py` before
writing, so a subtly wrong trace fails the build rather than reaching a screen.

The front end never re-implements FIFO, LRU, clock or OPT. It reads the traces.
The only live logic in TypeScript is the learner's own play: is this page
resident, evict this slot, count the fault, attribute the regret.

**The one exception is screen 11**, where the learner's `evict()` has to run for
real. That is Pyodide in a Web Worker, started warming in the background from
screen 1 so the editor is ready by the time the learner reaches it.

## Layout

| Path | What lives there |
|---|---|
| `tools/` | The Python oracle and the data generator |
| `src/data/levels.json` | Generated. Never edit by hand. |
| `src/lib/` | Types, level access, the machine-state store |
| `src/components/` | Shared UI: portrait, progress bar, tape, frames |
| `src/screens/` | One module per storyboard screen |
| `public/_headers` | WASM MIME type and cache rules for the host |

## Two contracts worth not breaking

**The portrait.** Nothing outside `MachinePortrait.tsx` knows what is drawn
inside the box. The rest of the app calls `setMachineState(s)`. The sprite sheet
is the last task of the project; until then the face is the state name in text,
at the size the sprite will occupy.

**The tell rule.** The machine's face may only change *after* the learner has
committed. `setMachineState` warns in development if it is called before
`learnerCommitted()` on that screen. A face that reacts early hands over the
answer in a channel the learner will read instead of reasoning.

## Hosting

Static, on a custom domain. The host must serve `.wasm` as `application/wasm`
(see `public/_headers`); Cloudflare Pages and Netlify both honour that file,
GitHub Pages does not. Pyodide is self-hosted from `public/pyodide/` rather than
pulled from a CDN — the link goes to a recruiter and must not depend on a third
party being reachable that day.
