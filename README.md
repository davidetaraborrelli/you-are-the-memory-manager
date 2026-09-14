# You are the memory manager

An interactive lesson on page replacement. Fourteen screens, no backend.

```bash
npm install
npm run data      # regenerate src/data/levels.json from Python
npm run dev
```

Screens 1–12 are implemented. Screen 9 introduces reference bits through two
guided replacements; screen 10 runs a three-blank Python scaffold in Pyodide.
Screen 11 asks for a prediction, then replays the same tape with three and four
frames using the reference Clock traces. The final comparison includes OPT.
Screen 12 inspects those completed runs on a shared timeline, then replays the
recorded Clock scans and accounts for the extra fault. Its search hides bits,
hands, counters and difference highlights until the learner finds the first leak.
Screens 13–14 are next. In the dev server, `?screen=12` opens the investigation
directly; `?screen=11` opens the preceding comparison;
`?screen=10` opens the editor activity;
`?screen=10&python=unavailable` exercises its read-only reference path.

`npm test` checks the guided interaction and runs the actual WASM Python
interpreter against both visible choices and every L3 transition. After
`npm run build`, `npm run test:worker` also executes Vite's emitted worker using
Node's worker transport. `npm run test:comparison` checks the prediction gate,
synchronized playback, pause controls and the final Clock/OPT results.
`npm run test:leak` checks every puzzle answer, the hidden search evidence,
each replay inspection and bit update, and the two savings versus three costs.
Browser visual/responsive verification is still pending.

## How this is put together

**Python owns every number.** `tools/sim.py` is the oracle: it asserts each
figure quoted in the storyboard. `tools/gen_levels.py` extends it with
slot-accurate traces — which frame held which page at every step — and writes
`src/data/levels.json`. It cross-checks its own traces against `sim.py` before
writing, so a subtly wrong trace fails the build rather than reaching a screen.

Clock's full events come from `sim.clock_events()`: snapshots of frames and
bits, the hand before and after each request, and every inspected slot. A scan
includes its final zero-bit victim, even when that repeats the starting slot.
The checks cover the guided discovery and Belady replay states as well as the
fault totals, so future screens can replay the recorded scans directly.

The front end never re-implements FIFO, LRU, clock or OPT. It reads the traces.
The only live logic in TypeScript is the learner's own play: is this page
resident, evict this slot, count the fault, attribute the regret.

**The one exception is screen 10**, where the learner's `evict()` has to run for
real. That is Pyodide in a Web Worker, started warming in the background from
screen 1 so the editor is ready by the time the learner reaches it.

Only the three field tokens enter the locked scaffold. Python has an instruction
budget, and the UI thread has an independent worker deadline. Technical errors
preserve the fields and hints; three valid differences offer the reference rule.
If initialisation fails or the bounded entry wait expires, the editor becomes
read-only and both checks replay generated traces. Results then say `reference
rule`, never `your function`.

**Screens are beats, not mounts.** An act is one continuous run of one level,
with beats that pause it. The tape, the frames and the counter never unmount
between screens, so `src/screens/` holds one module per *act*, not per screen.

## Layout

| Path | What lives there |
|---|---|
| `tools/` | The Python oracle and the data generator |
| `src/data/levels.json` | Generated. Never edit by hand. |
| `src/lib/` | Types, level access, the machine-state store |
| `src/components/` | Shared UI: portrait, progress bar, tape, frames |
| `src/screens/` | One module per act; `src/lib/act*.ts` holds its copy |
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

`npm run dev` and `npm run build` copy the pinned npm runtime into a versioned
directory there. These generated binary assets are ignored by Git and included
in `dist` by Vite. No external Python packages are downloaded by the lesson.
The module worker and local `indexURL` follow the
[official Pyodide worker guidance](https://pyodide.org/en/stable/usage/webworker.html).
