# Tutor artwork

`avatar-sheet.png` is the user-approved, horizontally mirrored six-expression
preview generated with the built-in imagegen tool on 17 September 2026.
The keyboard opens toward the right. This is the original approved PNG, copied
without resampling; Italian labels belong to the design sheet and are never
shown in the lesson.

`avatar-sheet-transparent.png` is the background-extracted version used by the
app. The built-in imagegen edit removes the exterior teal background and sheet
captions, with real PNG alpha transparency, preserving the teal CRT displays,
six expressions, right-facing keyboard and original atlas dimensions. The
original sheet is kept as the approved design reference.

`MachinePortrait.tsx` displays a 384 × 384 crop of the neutral computer, with
only its screen interior replaced using crops from the same atlas. All six
states therefore share exactly the same housing and keyboard. The SVG is a
viewport over the approved raster, not a redrawing of it. Atlas coordinates
are private to that component. Display size is 96px, or 64px below 640px.

Expressions: neutral, approval, correction, apologetic, withholding, satisfied.
Their triggers are documented in STORYBOARD.md. `satisfied` replaces the unused
`smug` state and expresses pride in the learner's achievement.

Source generation: Windows 98 gray CRT, desktop unit and keyboard in crisp
pixel art; two eyes and a mouth in the teal display; six labelled expressions
on a teal contact sheet. The final edit requested: horizontally mirror each
computer in place so its dark side is on the left and its keyboard projects
to the lower right, preserving expression order and readable labels.

Background extraction prompt: remove only the background outside the computer
silhouettes and captions; keep the 1536 × 1024 canvas, sprite coordinates,
faces, screen colors and orientation, and output real alpha transparency.
