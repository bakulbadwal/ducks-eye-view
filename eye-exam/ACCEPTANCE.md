# Acceptance

Every number the page quotes, as `node tests/check.js` prints it (seeded: the same on every machine). The page computes the same numbers live, from the same seeds and the same functions in `js/core.js`; the lines marked ✓ are the invariants the build must keep. The check exits non-zero if any fails.

```

Machinery
  ✓ SVD (one-sided Jacobi) rebuilds a 14 × 9 matrix: U S Vᵀ = A to 2.3e-15
  ✓ V is orthonormal (|VᵀV − I| 1.6e-15)
  ✓ Jacobi eigenvalues of AᵀA are the squared singular values
  ✓ 3 × 3 inverse: M M⁻¹ = I
  ✓ Rodrigues there and back
  ✓ nearest rotation (Zhang App. C) has determinant 1
  ✓ Cholesky solve
  ✓ the lens model inverts (undistort ∘ distort = identity) at the frame's corner
  ✓ a seeded session is the same every time

The answer key: Microduck's alpha-family solve (robotd-params/src/lib.rs @ 648bf22), rounded, k1 and k2 only
  fx 1061.81 · fy 1062.19 · cx 596.78 · cy 474.52 · skew 0.00 · k1 -0.347 · k2 0.146 · frame 1280 × 720 (unrotated)
  repo: fx 1061.8060025020175 fy 1062.193713957031 cx 596.7776848217006 cy 474.52348043048636
  principal point vs the frame's middle (639.5, 359.5): -42.7 px across, 115.0 px down
  horizontal field of view 2·atan(640/fx) = 62.2° · vertical 2·atan(360/fy) = 37.4°
  nominal (mediad, 62° across 1280): f = 1065.14 px · placeholder (62° across the upright 720): f = 599.14 px
  the repo's p1, p2, k3 (left out here) move a frame-corner pixel by at most 19.0 px

Step 0 · The exam room
  frontal chart, 200 mm between outer corners, at 400 mm, lens dial at 0: 530.9 px wide (fx·200/400 = 530.9)
  ✓ pinhole: width = fx·X/Z
  the same chart through Microduck's lens: 515.5 px wide
  a ray the pinhole puts at the frame corner (0,0) lands 106.7 px nearer the middle through the lens
  a ray the pinhole puts at the frame corner (1279,0) lands 131.0 px nearer the middle through the lens

Step 1 · One photo: the homography by DLT (lens dial at 0)
  the L matrix is 108 × 9 (54 corners × 2 rows)
  ✓ zero noise: DLT recovers the true H = K[r1 r2 t] exactly, with and without normalisation (largest relative entry error 4.4e-15)
  condition σ1/σ8 of L: un-normalised 2.80e+5 · normalised 3.63
  smallest singular value σ9 (zero noise): 3.6e-15 / 2.6e-15
  near chart (450 mm), origin at its corner, σ 0.5 px, 100 photos: median error vs truth un-normalised 0.189 px · normalised 0.188 px
  far chart (2500 mm), origin 0 mm away: un-normalised median 0.194 / worst 0.31 px · normalised median 0.187 / worst 0.31 px · cond 2.5e+5 vs 3.5
  far chart (2500 mm), origin 200 mm away: un-normalised median 0.248 / worst 0.41 px · normalised median 0.187 / worst 0.31 px · cond 4.0e+6 vs 3.5
  far chart (2500 mm), origin 500 mm away: un-normalised median 0.499 / worst 0.68 px · normalised median 0.187 / worst 0.31 px · cond 4.2e+7 vs 3.5
  far chart (2500 mm), origin 1000 mm away: un-normalised median 5.410 / worst 2030.79 px · normalised median 0.187 / worst 0.31 px · cond 2.7e+8 vs 3.5
  far chart (2500 mm), origin 2000 mm away: un-normalised median 1.022 / worst 1.91 px · normalised median 0.187 / worst 0.31 px · cond 9.4e+8 vs 3.5
  far chart (2500 mm), origin 3000 mm away: un-normalised median 0.742 / worst 1.05 px · normalised median 0.187 / worst 0.31 px · cond 1.8e+9 vs 3.5
  ✓ far chart, origin 1 m off: un-normalised DLT is over 10× worse
  ✓ normalised DLT doesn't care where the origin is

Step 2 · Two clues per photo: counting constraints on B = K⁻ᵀK⁻¹ (lens dial at 0, zero noise)
  1 photo: V is 2 × 6, zero singular values 4 → V has 4 zero singular values: a 4-dimensional family of B's fit, so there is no one answer
  2 photos: V is 4 × 6, zero singular values 2 → V has 2 zero singular values: a whole line of B's fit, so there is no one answer
  2 photos + skew = 0: V is 5 × 6, zero singular values 1 → fx 1061.81 · fy 1062.19 · cx 596.78 · cy 474.52 · skew 0.00 · k1 0.000 · k2 0.000
  3 photos: V is 6 × 6, zero singular values 1 → fx 1061.81 · fy 1062.19 · cx 596.78 · cy 474.52 · skew -0.00 · k1 0.000 · k2 0.000
  5 photos: V is 10 × 6, zero singular values 1 → fx 1061.81 · fy 1062.19 · cx 596.78 · cy 474.52 · skew -0.00 · k1 0.000 · k2 0.000
  5 frontal photos: V is 10 × 6, zero singular values 4 → V has 4 zero singular values: a 4-dimensional family of B's fit, so there is no one answer
  5 photos, same tilt, moved: V is 10 × 6, zero singular values 4 → V has 4 zero singular values: a 4-dimensional family of B's fit, so there is no one answer
  ✓ 1 photo: 2 equations, 4 zero singular values, no answer
  ✓ 2 photos: 4 equations, a line of answers
  ✓ 2 photos + skew = 0 (Zhang §3.1): unique, exact
  ✓ 3 photos: Zhang's closed form recovers K exactly with zero noise
  ✓ degenerate: 5 frontal (parallel) photos give the same 2 equations as 1 (Zhang Prop. 1) — detected
  ✓ degenerate: 5 photos at one orientation, only moved (pure translation) — detected
  ratio σ6/σ5 for 3 photos: 4.0e-15
  how flat is too flat: 200 sessions of 3 photos at 500 mm, σ 0.5 px
    tilt 2°: 150 / 200 give no usable camera · mean |fx error| of the rest 23.19%
    tilt 5°: 45 / 200 give no usable camera · mean |fx error| of the rest 13.13%
    tilt 10°: 17 / 200 give no usable camera · mean |fx error| of the rest 6.41%
    tilt 20°: 5 / 200 give no usable camera · mean |fx error| of the rest 3.90%
    tilt 45°: 3 / 200 give no usable camera · mean |fx error| of the rest 1.55%

Step 3 · The closed form (lens dial at 0)
  ✓ 3 photos of the 20-photo trial session, zero noise: exact (fx 1061.81 · fy 1062.19 · cx 596.78 · cy 474.52 · skew -0.00 · k1 0.000 · k2 0.000)
  ✓ and the extrinsics: every chart position recovered to 9.4e-13 mm
  trial session, σ 0.5 px, first 3 photos: fx 1070.70 · fy 1068.07 · cx 597.01 · cy 463.66 · skew 0.80 · k1 0.000 · k2 0.000 · RMS 0.736 px
  trial session, σ 0.5 px, first 12 photos: fx 1061.95 · fy 1064.61 · cx 596.42 · cy 473.85 · skew -0.74 · k1 0.000 · k2 0.000 · RMS 0.889 px
  closed form alone, σ 0.5 px, mean over 20 sessions:
    2 photos (+ skew = 0): |fx error| 5.10% · principal point off by 49.3 px
    3 photos: |fx error| 1.04% · principal point off by 8.9 px
    4 photos: |fx error| 0.75% · principal point off by 7.8 px
    6 photos: |fx error| 0.42% · principal point off by 4.6 px
    8 photos: |fx error| 0.31% · principal point off by 3.7 px
    12 photos: |fx error| 0.25% · principal point off by 3.2 px
    20 photos: |fx error| 0.27% · principal point off by 2.5 px

Step 4 · The lens dial (Microduck's lens on)
  a chart near the top-left corner: its top row bends 5.5 px from straight through the lens, 0.000 px without
  the exam session: 12 photos, σ 0.25 px
  closed form, ignoring the lens: fx 983.07 · fy 998.92 · cx 583.29 · cy 237.08 · skew -38.98 · k1 0.000 · k2 0.000 · RMS 18.22 px
  + k1, k2 by linear least squares (eq. 13): k1 0.097 · k2 -0.272 · RMS 18.01 px
  ✓ as in Zhang's Table 1, the linear k1 comes out with the wrong sign (pincushion for a barrel lens)

Step 5 · Better one or two? Levenberg–Marquardt on the total reprojection error
  RMS by step: 18.856 → 7.616 → 1.781 → 1.126 → 0.899 → 0.792 → 0.703 → 0.630 → 0.589 → 0.394 → 0.350 → 0.350 → 0.350 → 0.350 px (13 steps; step 0 is the closed form + linear k1, k2 with the skew set to 0)
  refined: fx 1060.05 · fy 1060.11 · cx 597.58 · cy 474.58 · skew 0.00 · k1 -0.345 · k2 0.144
  vs the answer key: fx -0.17% · fy -0.20% · cx 0.80 px · cy 0.06 px · k1 0.0019 · k2 -0.0021
  ✓ LM cuts the RMS by more than 10×
  ✓ LM recovers the distortion (k1 within 0.01, k2 within 0.02) and fx within 0.5%
  ✓ zero noise: the whole pipeline recovers Microduck's K, k1, k2 exactly (RMS 8.1e-14 px)
  with the skew left free (Zhang): skew 0.279 px · RMS 0.3502 px (skew fixed at 0, as OpenCV does: RMS 0.3502)
  floor: σ√2 = 0.354 px for corners with σ = 0.25 px per axis
  is a low score a good eye?
    the exam (12 photos, lens free):        RMS 0.350 px · hold-out 0.342 px · map mean 0.88 / max 1.7 px · fx -0.17% · worst head turn +0.04° at b = 1
    12 photos, lens dial held at 0:         RMS 4.363 px · hold-out 3.653 px · map mean 230.52 / max 542.1 px · fx +26.62% · worst head turn -10.59° at b = 1
    … and the worst 6 photos dropped:       RMS 2.080 px · hold-out 3.809 px · map mean 173.35 / max 382.8 px · fx +7.03% · worst head turn -7.08° at b = 1
  ✓ dropping the worst photos halves the RMS and makes the hold-out error worse
    3 photos:                               RMS 0.372 px · hold-out 0.346 px · map mean 3.20 / max 4.1 px · fx +0.00% · worst head turn +0.20° at b = -1

Step 6 · The fitting: planning a session (seed 31) and what it costs the duck
  3 photos: no prescription: λ/B11 is negative: the focal length would be imaginary
  6 photos: RMS 0.361 px · hold-out 0.343 px · map mean 2.45 / max 2.9 px · fx +0.04% · worst head turn -0.11° at b = 1
  12 photos: RMS 0.355 px · hold-out 0.341 px · map mean 1.35 / max 1.6 px · fx +0.01% · worst head turn -0.02° at b = -1
  20 photos: RMS 0.346 px · hold-out 0.341 px · map mean 1.59 / max 2.0 px · fx +0.07% · worst head turn -0.03° at b = 1
  30 photos: RMS 0.344 px · hold-out 0.342 px · map mean 1.72 / max 2.1 px · fx +0.07% · worst head turn -0.11° at b = 1
  tilt 0–5°: no prescription: λ/B11 is negative: the focal length would be imaginary
  tilt 5–15°: RMS 0.355 px · hold-out 0.344 px · map mean 1.69 / max 3.1 px · fx -0.52% · worst head turn +0.10° at b = 1
  tilt 10–20°: RMS 0.355 px · hold-out 0.342 px · map mean 1.03 / max 2.0 px · fx -0.26% · worst head turn -0.06° at b = -1
  tilt 20–50°: RMS 0.355 px · hold-out 0.341 px · map mean 1.35 / max 1.6 px · fx +0.01% · worst head turn -0.02° at b = -1
  tilt 50–70°: RMS 0.355 px · hold-out 0.341 px · map mean 3.77 / max 4.2 px · fx +0.07% · worst head turn +0.07° at b = 1
  centre only, small and far: RMS 0.355 px · hold-out 1.141 px · map mean 40.25 / max 112.5 px · fx +0.31% · worst head turn +0.35° at b = 1
  σ 0.1 px: RMS 0.142 px · hold-out 0.341 px · map mean 0.53 / max 0.6 px · fx +0.00% · worst head turn -0.01° at b = -1
  σ 0.5 px: RMS 0.711 px · hold-out 0.341 px · map mean 2.82 / max 3.3 px · fx +0.02% · worst head turn -0.04° at b = -1
  σ 1 px: RMS 1.422 px · hold-out 0.346 px · map mean 6.15 / max 7.2 px · fx +0.05% · worst head turn -0.08° at b = -1
  σ 2 px: RMS 2.843 px · hold-out 0.368 px · map mean 14.36 / max 16.5 px · fx +0.09% · worst head turn -0.14° at b = -1
  head turn on the upright 720 × 1280 frame (degrees, + = the duck's right, from the optical axis):
    b = -1.0: truth -13.23 · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) -18.67 · placeholder 62° across 720 -31.00 · this exam -13.26
    b = -0.5: truth -3.51 · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) -9.59 · placeholder 62° across 720 -16.72 · this exam -3.51
    b = 0.0: truth 6.21 · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) 0.00 · placeholder 62° across 720 0.00 · this exam 6.22
    b = 0.5: truth 15.95 · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) 9.59 · placeholder 62° across 720 16.72 · this exam 15.98
    b = 1.0: truth 25.76 · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) 18.67 · placeholder 62° across 720 31.00 · this exam 25.81
  worst error across the frame: nominal -7.09° at b = 1 · placeholder -17.77° at b = -1 · this exam 0.04° at b = 1
  optical axis on the upright frame: x' = 719 − cy = 244.48 px, 115.0 px left of the middle → b = 0 is 6.21° right
  at 3 m, a 6.21° error misses by 33 cm; Duck's-Eye View's b = 0.5: 9.59° (its centred pinhole) vs 15.95° (the repo's solve)
  ✓ a good 12-photo calibration turns the head to within 0.5° everywhere on the bearing line
  ✓ Microduck's principal point puts the frame's middle 6.2° off the optical axis

Review board (each re-run is the named session, calibrated, judged against the answer key)
  Case 1 · the flat-lander
    as booked: 12 photos tilted 5–15°: RMS 0.656 px · hold-out 6.405 px · map mean 207.63 / max 391.4 px · fx -53.75% · worst head turn +20.46° at b = 1
    30 photos the same way: no prescription: λ/B11 is negative: the focal length would be imaginary
    sharper corners, σ 0.1 px: RMS 0.660 px · hold-out 9.140 px · map mean 295.32 / max 575.5 px · fx -74.26% · worst head turn +36.24° at b = 1
    re-take 12 photos tilted 20–50°: RMS 0.343 px · hold-out 0.342 px · map mean 1.59 / max 2.9 px · fx +0.00% · worst head turn +0.08° at b = 1
  Case 2 · the corner-blind
    as booked: 12 small charts in the middle: RMS 0.347 px · hold-out 0.635 px · map mean 41.49 / max 57.6 px · fx -0.38% · worst head turn -0.37° at b = -1
    30 photos the same way: RMS 0.348 px · hold-out 0.984 px · map mean 18.60 / max 52.9 px · fx +0.40% · worst head turn +0.36° at b = -1
    sharper corners, σ 0.1 px: RMS 0.139 px · hold-out 0.358 px · map mean 16.82 / max 19.6 px · fx -0.17% · worst head turn -0.14° at b = -1
    re-take 12 photos that fill the frame: RMS 0.348 px · hold-out 0.342 px · map mean 1.17 / max 1.5 px · fx -0.07% · worst head turn -0.04° at b = -1
  Case 3 · the straight-liner (lens dial held at 0)
    as booked: RMS 4.363 px · hold-out 3.653 px · map mean 230.52 / max 542.1 px · fx +26.62% · worst head turn -10.59° at b = 1
    drop the worst half of the photos: RMS 2.080 px · hold-out 3.809 px · map mean 173.35 / max 382.8 px · fx +7.03% · worst head turn -7.08° at b = 1
    30 photos, dial still at 0: RMS 3.783 px · hold-out 3.683 px · map mean 207.05 / max 469.1 px · fx +22.67% · worst head turn -9.74° at b = 1
    free the lens dial (estimate k1, k2): RMS 0.343 px · hold-out 0.341 px · map mean 1.19 / max 2.1 px · fx -0.05% · worst head turn -0.05° at b = -1
  ✓ case 1: only the tilted re-take passes (fx within 1%, head turn within 0.5°)
  ✓ case 2: only filling the frame passes (map error under 5 px everywhere, hold-out under 0.40 px)
  ✓ case 3: only freeing the lens dial passes (head turn within 0.5°, hold-out under 0.40 px)

all checks passed · 7.7 s
```

## In the browser

Driven with Playwright (headless Chromium) at 1200 px and 375 px wide, from a cleared localStorage, served over `python3 -m http.server`:

- every step shown, every button, slider, toggle, preset and photo card operated, every prediction answered, every "say it out loud" line unlocked (`said` = all nine sections);
- the page's live numbers match the printout above: step 0's row width 530.9 px with the lens off; step 1's 5.410 / 2,031 / 0.187 px; step 2's 4 zero singular values for five square-on photos and the 45 / 200 failures at 5°; step 3's sweep table; step 4's lens-blind card (fx −7.42%, cy 237.08, skew −38.98) and linear k1 = 0.097; step 5's 18.86 → 0.350 px in 13 steps and the five-session table; step 6's planner and head-turn table (+6.21° at b = 0);
- the review board: for each case, the as-booked run and all three fixes; only the right fix passes, three stars;
- the field test: the ten answers above, 10 / 10;
- zero console errors or warnings, no failed requests (fonts excepted when offline), no horizontal page scroll at either width.

## Content

- Every step names the paper section, library line or repository file it covers, and the honesty card says what's exact and what's a teaching model.
- Every figure quoted from Zhang, OpenCV or Microduck's repository is in `SOURCES.md` with its section or file and commit.
- Nothing the page says about Microduck goes beyond what its repository's files say at `648bf22`; the bearing → angle conversion and the "camera looks straight down the head's axis" assumption are labelled as ours.
