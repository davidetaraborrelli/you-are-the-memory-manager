/**
 * The fourteen screens, in order, as the storyboard lays them out.
 *
 * This is the spine of the lesson. Screens are built in acts (see the plan);
 * `built: false` means the screen exists in the storyboard but not yet in code.
 *
 * Revised 31 Aug 2026. The previous spine had fifteen: screen 8 opened the
 * tape and screen 9 asked separately why OPT cannot be deployed. Those are one
 * cognitive job — construct the floor, then discover what constructing it
 * required — so they are now one screen with six beats, and the acts renumber
 * behind it.
 */

export const SCREENS = [
  { n: 1, act: 1, id: 'your-new-job', title: 'Your new job', built: true },
  { n: 2, act: 1, id: 'first-decision', title: 'The first real decision', built: true },
  { n: 3, act: 1, id: 'the-bill', title: 'The bill arrives later', built: true },
  { n: 4, act: 2, id: 'finish-l1', title: 'Finish level one', built: true },
  { n: 5, act: 2, id: 'say-your-rule', title: 'Say your rule out loud', built: true },
  { n: 6, act: 3, id: 'run-the-experiment', title: 'Run the experiment', built: true },
  { n: 7, act: 3, id: 'recency-wins', title: 'Recency wins this test', built: true },
  { n: 8, act: 4, id: 'the-whole-tape', title: 'The whole tape', built: false },
  { n: 9, act: 5, id: 'recency-has-a-price', title: 'Exact recency has a price', built: false },
  { n: 10, act: 5, id: 'make-it-executable', title: 'Make the cheap rule executable', built: false },
  { n: 11, act: 6, id: 'one-more-slot', title: 'One more slot', built: false },
  { n: 12, act: 6, id: 'find-the-leak', title: 'Find the leak', built: false },
  { n: 13, act: 6, id: 'why-lru-cannot', title: 'Why LRU cannot do that', built: false },
  { n: 14, act: 7, id: 'transfer', title: 'Same problem, different decade', built: false },
] as const

export const TOTAL_SCREENS = SCREENS.length

export type ScreenId = (typeof SCREENS)[number]['id']
