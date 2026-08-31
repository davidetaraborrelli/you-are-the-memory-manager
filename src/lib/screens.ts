/**
 * The fifteen screens, in order, as the storyboard lays them out.
 *
 * This is the spine of the lesson. Screens are built in acts (see the plan);
 * `built: false` means the screen exists in the storyboard but not yet in code.
 */

export const SCREENS = [
  { n: 1, act: 1, id: 'cold-open', title: 'Cold open', built: true },
  { n: 2, act: 1, id: 'first-decision', title: 'The first real decision', built: true },
  { n: 3, act: 1, id: 'regret-and-fog', title: 'Regret, and the fog', built: true },
  { n: 4, act: 2, id: 'finish-l1', title: 'Finish the run', built: true },
  { n: 5, act: 2, id: 'declare-rule', title: 'Say the rule out loud', built: true },
  { n: 6, act: 3, id: 'timestamps', title: "Here, I'll keep score", built: true },
  { n: 7, act: 3, id: 'l2-scoreboard', title: 'You played it perfectly', built: true },
  { n: 8, act: 4, id: 'nothing-to-hide', title: 'Nothing left to hide', built: false },
  { n: 9, act: 4, id: 'ship-it', title: 'So can we ship it?', built: false },
  { n: 10, act: 5, id: 'budget-cut', title: "Those timestamps weren't free", built: false },
  { n: 11, act: 5, id: 'write-it-down', title: 'Write it down', built: false },
  { n: 12, act: 6, id: 'fourth-frame', title: "The thing you've been asking for", built: false },
  { n: 13, act: 6, id: 'find-the-leak', title: 'Find the leak', built: false },
  { n: 14, act: 6, id: 'other-rule', title: 'Try the other rule', built: false },
  { n: 15, act: 7, id: 'transfer', title: 'Same problem, different decade', built: false },
] as const

export const TOTAL_SCREENS = SCREENS.length

export type ScreenId = (typeof SCREENS)[number]['id']
