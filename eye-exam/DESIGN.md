# Design: Eye Exam

Eye Exam uses the design system recorded in [Inference Kitchen's DESIGN.md](https://github.com/bakulbadwal/inference-kitchen/blob/master/DESIGN.md): a Busytown cross-section, flat gouache fields on warm paper, one warm-brown outline, and every object wearing a hand-lettered label. Buttons are painted signs, readouts are price tags on a nail, predictions are sticky notes, takeaways are chalked on a wood-framed board, and the glossary is a menu board. The type is Grandstander for signboards, Patrick Hand for labels and Andika for body text. The CSS and the page framework (nav, predictions, tooltips, say-it-out-loud, sliced runs, review board, field test) are Wet Paint's, rethemed.

This file records only what the optician's shop changes.

## The world

A Busytown optician's shop in cutaway: a plank floor, a wainscoted wall with spectacle frames on a shelf and an old letter chart, a red exam chair with a lens dial on a swing arm, a desk with a lamp. Microduck, a small yellow robot duck whose eye is a camera, sits in the chair. The optician wears a white coat, round glasses and a head mirror.

## Palette additions

| Token | Hex | Use |
|---|---|---|
| shop / shop-d | `#1F7A7A` / `#145B5B` | masthead, footer, the lens dial, the prescription card's header |
| mint | `#CDEBE6` | lens glass, spectacle lenses |
| wall / wainscot / floor | `#F3E7CF` / `#EAD9B8` / `#C99A62` | the shop interior in every scene |
| eye | `#1F6F74` / `#9FD3D6` / `#0F4447` | the duck's camera eye (ring, glass, pupil), matching Duck's-Eye View |
| duck | `#F9D95B` with a `#E8923A` bill | Microduck, as the siblings draw it |
| frame wall | `#EDE7DA` | the background of every 1280 × 720 camera frame |

Data colours are fixed on every canvas: a corner **as seen** is a yellow dot with a dark outline (it has to show on black and white squares); where the **model** predicts it is a blue ring (`#246A9C`); **truth** is green (`#3B7422`); an **error** is a brick-red arrow (`#A5321F`); the true principal point is a red cross and the frame's middle a brown one.

## New objects

- **The camera frame** (`canvas.frame`, 16:9): the duck's 1280 × 720 view, with the checkerboard painted through the actual camera model (every square's edges are sampled, so the lens visibly bends them), corners as seen, predicted rings, error arrows drawn k× longer (the scale is printed on the frame), and the two crosses.
- **The prescription card** (`.rx`): a ruled card with a ℞ and a table: this card, the answer key, and how far off, coloured green / amber / red by size. Every estimate on the page is shown this way.
- **Singular-value bars** (`canvas.bars`): log-scale bars relative to the largest, with zeros in red and marked ≈ 0.
- **The photo tray** (step 2): photo cards with a thumbnail of the chart, tapped in and out of the set.
- **The top view** (step 3): the camera at the bottom, its 62° field dashed, and each chart's outline seen from above, true in green and recovered in blue.
- **The error map** (step 6): the frame shaded by how many pixels the card is off, log scale with a key, and the session's corners dotted over it.
- **Matrices** (`.mat`): 3 × 3 numbers between bracket rules, for H.

## Scenes

Eight hand-built SVG scenes, 960 × 400, in `js/art.js`, from a drawn cast:

- **the duck**: Microduck, yellow, with a teal camera eye and an orange bill; sitting, standing, or in new round glasses (step 6);
- **the optician**: a Busytown person in a white coat, round glasses and a head mirror; the assistant in step 1 stands on a step stool with a magnifier;
- **the eye chart**: a 10 × 7-square checkerboard on a white board, drawn in any quad, or bent by a barrel lens;
- **the lens dial**: a teal phoropter with two lens windows, knobs and a numbered wheel, on a swing arm;
- **photos** (polaroids of the chart at angles), **the tracing card**, **the prescription card**, **the clue tally** (a chalkboard), **the answer key** (a sealed envelope), **the bill** (a receipt in degrees).

Each scene labels its objects with their calibration meaning ("the tracing card = a homography H"). The duck is drawn as a generic small robot duck; nothing implies Pollen Robotics endorses the lab.
