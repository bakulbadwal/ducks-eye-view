# Product

## Platform

web

## Stack

Static HTML/CSS/JS, no build step, no dependencies. Hosted on GitHub Pages (https://bakulbadwal.github.io/ducks-eye-view/eye-exam/). Must also work opened straight from the file.

## Users

Primary: the author, an MBA (UVA Darden '27) who isn't an engineer and is learning physical AI. Duck's-Eye View showed him that a robot's head turn depends on the camera's intrinsics; this lab is how those numbers are measured. Secondary: anyone who has run OpenCV's `calibrateCamera`, got an RMS back, and wondered what it means; and anyone the author shares it with.

## Product purpose

Teach camera calibration with Zhang's method, the one inside OpenCV, by running every stage on photos through a known camera:

1. **The pinhole and K**, briefly, linking to Duck's-Eye View for the full treatment.
2. **One photo is one homography**, found by DLT, and why Hartley normalisation matters.
3. **Why one photo isn't enough**: two constraints per photo on B = K⁻ᵀK⁻¹, five unknowns, and the degenerate sets (parallel photos, pure translation) where the solve blows up.
4. **Zhang's closed form** for K and every photo's pose.
5. **Lens distortion**: the radial model, and why the closed form and the linear fit get it wrong.
6. **Refinement** by Levenberg–Marquardt on the total reprojection error; the RMS as a score, and why a low score isn't a good calibration.
7. **Practice**: how many photos, how much tilt, covering the frame's corners, sub-pixel corners, and what a bad calibration costs the duck in degrees.

Success: after about 70 minutes, the reader can explain where each number on a calibration result comes from, why three tilted photos are the minimum and parallel ones don't count, why the closed form needs refining, what an RMS of 0.35 px does and doesn't say, and how to book a session that gives a good camera, and can read Zhang's paper and OpenCV's `calibrateCamera` documentation without a glossary.

## Positioning

Interactive camera explainers show what K does (Kyle Simek's camera-matrix posts; Duck's-Eye View's map room). Calibration tools estimate K from your photos (OpenCV, MATLAB, calibDB) but can't tell you whether it's right. Nothing found walks Zhang's method stage by stage against a known answer. That's this lab: the answer key is a real robot's published calibration, so every estimate and every tempting fix is judged against the truth.

## Operating context

Used at a laptop in study sessions, and on a phone when shared. Steps are done in order (0–6, review board, field test) but people jump between them. Progress persists in localStorage. Heavy runs (200 sessions, 20 calibrations) go in small slices so the page stays responsive; a single calibration takes well under a second.

## Constraints

- Every number comes from `js/core.js`. `ACCEPTANCE.md` lists the verified values; `node tests/check.js` prints them.
- The honesty note (what's exact vs a teaching model) must remain, on the page and in the README.
- Figures quoted from Zhang, OpenCV and the robot's repo are cited and not altered (see `SOURCES.md`).
- The optician's shop is the vocabulary: the duck = the camera being calibrated, the eye chart = the checkerboard, a photo = a view, the magnifier = the corner detector, the tracing card = a homography, the clue tally = the constraints on B, the prescription card = K, the lens dial = the distortion model, "better one, or two?" = Levenberg–Marquardt, the second opinion = hold-out photos, the answer key = the ground truth only a lab has, the bill = the head-turn error.

## Brand commitments

- Name: **Eye Exam**. A sibling of Inference Kitchen, Policy Pond, Fork in the Road, Duck's-Eye View and Demos to Deployment: same design system, an optician's teal masthead.
- Must not look like "every AI tool" (dark ground, neon accent, glowing cards) or a corporate SaaS dashboard.
