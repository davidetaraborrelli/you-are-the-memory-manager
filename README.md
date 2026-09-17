# You are the memory manager

An interactive lesson on page replacement. Fourteen screens, no backend.

## Version 1.0 checkpoint

The annotated Git tag `v1.0.0` preserves the complete fourteen-screen lesson,
Windows 98 theme, tutor artwork and expression timing, and automated checks.
Keep this tag at its original commit; later improvements can continue on new
branches without changing the checkpoint.

To reopen this exact version on a separate branch, first commit or stash any
local changes, then run:

```bash
git fetch origin tag v1.0.0
git switch -c restore-v1.0.0 v1.0.0
npm ci
npm run dev
```

This creates a branch at the checkpoint and preserves the history of `main`.
Design documents and local tooling remain outside Git, as configured in
`.gitignore`; the tag preserves the application files tracked in this repository.

## Development

```bash
npm install
npm run data      # regenerate src/data/levels.json from Python
npm run dev
```

All fourteen screens are implemented. Screen 9 introduces reference bits through two
guided replacements; screen 10 runs a three-blank Python scaffold in Pyodide.
Screen 11 asks for a prediction, then replays the same tape with three and four
frames using the reference Clock traces. The final comparison includes OPT.
Screen 12 inspects those completed runs on a shared timeline, then replays the
recorded Clock scans and accounts for the extra fault. Its search hides bits,
hands, counters and difference highlights until the learner finds the first leak.
Screen 13 switches the same board to LRU, shows each request's outgoing and incoming
pages (or a hit/empty slot), then matches the pages remaining in both memories.
After all twelve states, it asks which hit/fault outcome is impossible. The stack property and
fault totals appear after the learner's correct answer. Checks can be paused,
stepped or replayed; reduced motion uses manual steps throughout.
Screen 14 transfers the reasoning to a simplified coding assistant's context
window: identify available evidence, compare two observed file histories, then
choose a rule if the four-file loop continues. Every wrong answer gets feedback
and a retry; the historical checkpoint is explained after commitment. The lesson
ends on its closing question, with no recap screen.
In the dev server, `?screen=14` opens the final screen;
`?screen=13` opens the LRU comparison;
`?screen=12` opens the investigation directly; `?screen=11` opens the preceding comparison;
`?screen=10` opens the editor activity;
`?screen=10&python=unavailable` exercises its read-only reference path.

`npm test` checks the guided interaction and runs the actual WASM Python
interpreter against both visible choices and every L3 transition. After
`npm run build`, `npm run test:worker` also executes Vite's emitted worker using
Node's worker transport. `npm run test:comparison` checks the prediction gate,
synchronized playback, pause controls and the final Clock/OPT results.
`npm run test:leak` checks every puzzle answer, the hidden search evidence,
each replay inspection and bit update, and the two savings versus three costs.
`npm run test:stack` checks all twelve LRU transitions before/after the request,
page matches, question and result gates, retries, pause/replay and strictly manual reduced motion.
`npm run test:transfer` checks all three questions and their retries, progressive
evidence, the historical checkpoint, delayed highlights and the final ending.
`tools/sim.py` also verifies the file-loop policy comparison, including exact
expected random reloads; the transfer screen does not display fault totals.
Browser visual/responsive verification is still pending.

Mobile layouts use a smaller portrait, wrapping action rows, larger frame statistics,
and two rows for the complete request tape below 640px. The Python editor scrolls
horizontally within its panel and has larger input targets. These changes have been
reviewed in code; a phone/browser usability check is still needed.

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
inside the box. The rest of the app calls `setMachineState(s)`. The approved
Windows 98 computer faces right. One fixed body and six display crops from a
local PNG atlas prevent the housing from changing with the expression.
The portrait is 96px on desktop and 64px on mobile, with accessible state labels.
Screen 9 acknowledges the bit limit only after exploring all three pages;
screen 10 celebrates a successful full learner-code replay; screen 14 celebrates
the completed transfer. Reference-code results retain ordinary approval.

Expressions also follow smaller earned moments throughout the lesson. Their
timing is mapped in the storyboard's portrait-pacing table. `npm run test:portrait`
checks that faces do not reveal future outcomes during predictions, searches
or unanswered inclusion questions, and that feedback resets on retries.

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

## Windows 98 theme

The interface uses [98.css](https://jdan.github.io/98.css/) 0.1.21 (MIT),
including its bundled Pixelated MS Sans Serif fonts, window/title/status bars,
buttons, inset panels, slider and segmented progress indicator. Assets are
bundled locally by Vite; the lesson does not load the theme from a CDN.

`Desktop.tsx` wraps the existing lesson; its maximize/restore control preserves
lesson state. `src/index.css` imports 98.css in a layer between the base reset
and utility styles. Lesson-specific rules adapt spacing, page colours, focus
indicators and mobile tap targets while retaining the library's native chrome.
The tutor portrait uses the approved local artwork in `src/assets/tutor/`.

98.css 0.1.21 contains an upstream `@media (not(hover))` query that Vite's CSS
optimizer warns about. Builds succeed; normal press/focus styling still applies.
