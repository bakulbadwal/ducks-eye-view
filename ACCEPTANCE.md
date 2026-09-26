# Duck's-Eye View: acceptance criteria

Numeric checks are asserted against `window.DEV.core` (the pure math and the seeded toys). Section A runs as `node tests/core.test.js`; the rest were read back from the live page in a real browser. Verified 25 Sep 2026.

## A. The math is right (`tests/core.test.js`, 48 checks)

| # | Check | Expected | Result |
|---|---|---|---|
| A1 | Full-width 16:9 sensor mode, turned upright | left-right FOV 37.35°, vertical 62°, f = 640 / tan 31° = 1065.1 px | ✓ |
| A2 | 1920×1080 centre-crop mode | left-right FOV 22.38°, f = 1819.6 px | ✓ |
| A3 | No 16:9 mode sees wider left-right than the full-width crop | `maxLrFov()` = 37.35° | ✓ |
| A4 | Placeholder "62° across 720 px" | f = 599.1 px | ✓ |
| A5 | Bearing 0.5 → angle | 9.59° (calibrated) vs 16.72° (placeholder) vs 15.5° (b × 31°) | ✓ |
| A6 | Depth is lost | (0.5, −0.2, 3) and (1, −0.4, 6) → the same pixel (204.4, 102.2) at f 266.3 | ✓ |
| A7 | Letterbox 720×1280 → 320 (lib.rs:67-110) | scale 0.25, 180×320, pad 70 / 0; 43.75% grey; stretch 1.78× too wide | ✓ |
| A8 | Map back out of the letterbox | input [110, 150, 132, 172] → frame [160, 600, 248, 688] | ✓ |
| A9 | 25 cm duck at 3 m, full mode | 88.8 px tall in the frame, 22.2 px in the input; pixels-per-degree shortcut 24.6 px | ✓ |
| A10 | Convolution | 5×5 * 3×3 → 3×3 (13, 15, 2 / 14, 13, 1 / 15, 13, 0); 320, k3, s2, p1 → 160 | ✓ |
| A11 | 32 → 64, 3×3 | standard 18,496 vs separable 2,432 with bias (7.6×); 18,432 vs 2,336 without (7.89×) | ✓ |
| A12 | YOLO grids at 320 | 40² + 20² + 10² = 2,100 (lib.rs:4) | ✓ |
| A13 | IoU | two 10×10 boxes offset by 5 → 1/3; disjoint → 0 | ✓ |
| A14 | Decode + greedy NMS (lib.rs:237-277) | a duplicate at IoU ≥ 0.5 is shredded; boxes are mapped out of the letterbox | ✓ |
| A15 | INT8, [−1, 3] → uint8 | scale 0.015686, zero point 64; 0.5 → 96 → 0.50196; 2.2 → 204 → 2.19608; −0.7 → 19 → −0.70588; worst error 0.00784 | ✓ |
| A16 | The real model files | 10,477,940 B ÷ 3,851,471 B = 2.72× (not the textbook 4×) | ✓ |
| A17 | Stereo | Z = f·B/d round-trips; doubling Z quadruples the error per pixel of disparity | ✓ |

## B. The toys teach the right direction (seeded, the same for every visitor)

| # | Check | Expected | Result |
|---|---|---|---|
| B1 | The head fills the real layout | planar Float32Array of 5 × 2,100 | ✓ |
| B2 | One duck at 3 m (step 3 scene, seed 15) | 20 candidates ≥ 0.35 → NMS at IoU 0.5 keeps 1 (0.7 keeps 3; 0.9 keeps 17) | ✓ |
| B3 | Held-out session `makeSession(2026, 40)` | 35 ducks; AP50 0.979 (AP101 0.979); at 0.35: P 0.59, R 1.00, 35 TP / 24 FP / 0 FN | ✓ |
| B4 | Quietly worse | BGR 0.727 · stretch 0.787 · pad ≠ 114 0.918 · all three 0.450, all with no error | ✓ |
| B5 | Per-tensor INT8 | every score becomes 0 or one step (≈ 1.26, scale = max coordinate ÷ 255); the threshold does nothing between 0.01 and ~0.63; AP50 0.786 | ✓ |
| B6 | Per-channel INT8 | scores come back (score-row step 0.0039); AP50 0.979 | ✓ |
| B7 | Thermal toy | flat out (16.7 looks/s) = 95 °C, throttled to 408 MHz; 2 looks/s = 62 °C; throttle from ~14.1 looks/s | ✓ |
| B8 | Read the tensor interleaved | 1,686 "scores" ≥ 0.35 and 58 garbage boxes after NMS (planar: 20 → 1) | ✓ |
| B9 | Small-near vs big-far | 10 cm rubber duck at 1.2 m and 25 cm robot duck at 3 m are both 88.8 px tall | ✓ |
| B10 | Stereo error (OAK-D-like rig from the guide) | 2.62 cm per px of disparity at 94 cm; 26.5 cm at 3 m | ✓ |
| B11 | ToF beams (kinematics/src/tof.rs) | 8 zones over 45°, 5.625° apart, outer centres at ±19.69°; floor hits and < 10 cm dropped | ✓ |
| B12 | Bug board case 1 | RGB + letterbox + 114 at 0.35 passes; lowering the threshold fails (AP stays 0.727) | ✓ |
| B13 | Bug board case 2 | per-channel, or per-tensor documented as a switch, passes; "retrain" and threshold 0.01 fail | ✓ |
| B14 | Bug board case 3 | calibrated intrinsics at ≤ 2 looks/s pass; the placeholder (16.7°) and the b × 31° hack (27.9° vs 16.9° at b = 0.9) fail; 10 looks/s fails | ✓ |

## C. It teaches

- C1 Every step is interactive, with live visuals.
- C2 Steps 0–6 have 22 predict-then-reveal questions (3–4 each). Each has exactly one marked answer.
- C3 Every step 0–6 ends with a "say it out loud" line that unlocks after the predictions and three interactions.
- C4 Every technical term has a tooltip with its plain meaning and its head-workshop equivalent. None is missing.
- C5 Every step names the course unit and study-guide file it covers, and says plainly what isn't in the course (RKNN, the portrait-mount FOV).
- C6 Every Microduck fact links to its source line at `590b986`.
- C7 The honesty note is on the page (field test) and in the README.
- C8 The field test has eight questions answered by operating widgets, graded automatically; six or more earns the check.

## D. It works

- D1 Opens straight from the file: no server, no build step, no fetch of local files.
- D2 Zero console errors across all steps.
- D3 No horizontal page scroll at 375 px in any step.
- D4 Progress persists across reloads in localStorage, wrapped so it degrades safely.
- D5 A `#step` link opens that step, and changing the hash switches steps.
- D6 A fresh-context adversarial review, split across two reviewers. Findings and fixes are recorded in the commit history.
