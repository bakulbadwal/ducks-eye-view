# Sources

Every figure the page quotes from a paper, a library or the robot's repository, with where it comes from. Checked on 2026-10-15 against Zhang's technical report (the PDF OpenCV's own bibliography links), the OpenCV 4.x source at `9d80321` (2026-10-15), and pollen-robotics/microduck at `648bf22` (2026-10-14). Numbers the lab computes itself are in [`ACCEPTANCE.md`](ACCEPTANCE.md), not here.

## Zhang's method

Z. Zhang, *A Flexible New Technique for Camera Calibration*, Microsoft Research technical report [MSR-TR-98-71](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr98-71.pdf) (December 1998, last updated 13 August 2008). The journal version is IEEE TPAMI 22(11):1330–1334, 2000; it was not opened for this build, and the page cites the report's section numbers.

- **§2.1, eq. (1):** the pinhole s·m̃ = A[R t]M̃, with A = [[α, γ, u0], [0, β, v0], [0, 0, 1]]: "(u0, v0) the coordinates of the principal point, α and β the scale factors in image u and v axes, and γ the parameter describing the skewness". The page writes A as K and (α, β, γ, u0, v0) as (fx, fy, skew, cx, cy).
- **§2.2, eq. (2):** with the model plane at Z = 0, "a model point M and its image m is related by a homography H … with H = A[r1 r2 t]. … the 3 × 3 matrix H is defined up to a scale factor."
- **§2.3, eqs. (3)–(4):** h1ᵀA⁻ᵀA⁻¹h2 = 0 and h1ᵀA⁻ᵀA⁻¹h1 = h2ᵀA⁻ᵀA⁻¹h2: "Because a homography has 8 degrees of freedom and there are 6 extrinsic parameters (3 for rotation and 3 for translation), we can only obtain 2 constraints on the intrinsic parameters."
- **§3.1, eqs. (5)–(9):** B = A⁻ᵀA⁻¹ is symmetric, "defined by a 6D vector b"; each homography gives two rows [v12ᵀ; (v11 − v22)ᵀ]b = 0; stacked, Vb = 0 with V a 2n × 6 matrix. "If n ≥ 3, we will have in general a unique solution b defined up to a scale factor. If n = 2, we can impose the skewless constraint γ = 0 … If n = 1, we can only solve two camera intrinsic parameters, e.g., α and β, assuming u0 and v0 are known." The solution is "the right singular vector of V associated with the smallest singular value". Extrinsics: r1 = λA⁻¹h1, r2 = λA⁻¹h2, r3 = r1 × r2, t = λA⁻¹h3, λ = 1/‖A⁻¹h1‖.
- **§3.2, eq. (10):** maximum-likelihood refinement of Σ‖mij − m̂(A, Ri, ti, Mj)‖², rotations as Rodrigues vectors, "solved with the Levenberg-Marquardt Algorithm as implemented in Minpack".
- **§3.3:** radial distortion x̆ = x + x[k1(x² + y²) + k2(x² + y²)²] (and the same in y), centred on the principal point; "the distortion function is totally dominated by the radial components, and especially dominated by the first term"; the linear least-squares estimate k = (DᵀD)⁻¹Dᵀd (eq. 13); then the complete refinement of eq. (14).
- **§3.4:** the recommended procedure, closed form → linear distortion → full refinement. The lab follows it in that order.
- **§4, Proposition 1:** "If the model plane at the second position is parallel to its first position, then the second homography does not provide additional constraints." Pure translation is ruled out the same way.
- **§5.1, simulations:** errors "increase linearly with the noise level"; for σ = 0.5 px the errors in α and β are under 0.3% and in u0, v0 around 1 px (his camera: α = 1250, β = 900, 512 × 512, a 10 × 14-corner chart); "From 2 to 3, the errors decrease significantly"; with three planes at θ = 5°, "40% of the trials failed because the planes are almost parallel to each other"; "Best performance seems to be achieved with an angle around 45°. Note that in practice, when the angle increases, foreshortening makes the corner detection less precise, but this is not considered in this experiment."
- **§5.2, Table 1 (real camera, 640 × 480, 256 corners):** 3 images: closed form α = 917.65, final 830.80; 5 images: final α = 832.50, β = 832.53, γ = 0.2045, u0 = 303.96, v0 = 206.59, k1 = −0.228, k2 = 0.190, RMS 0.335 px. Closed-form k1 is positive (0.161 with 2 images, 0.128 with 3) while the final k1 is about −0.228: "the predicted outer points lie closer to the image center than the detected ones. The subsequent distortion estimation tries to spread the outer points … although the distortion shape (with positive k1, called pincushion distortion) does not correspond to the real distortion (with negative k1, called barrel distortion)." The LM refinement "takes 3 to 5 iterations to converge" (§5).
- **App. A:** the homography by the 2n × 9 system Lx = 0, then: "L poorly conditioned numerically. Much better results can be obtained by performing a simple data normalization, such as the one proposed in [12]" — [12] is R. Hartley, *In defence of the 8-point algorithm*, ICCV 1995.
- **App. B:** v0 = (B12B13 − B11B23)/(B11B22 − B12²); λ = B33 − [B13² + v0(B12B13 − B11B23)]/B11; α = √(λ/B11); β = √(λB11/(B11B22 − B12²)); γ = −B12α²β/λ; u0 = γv0/β − B13α²/λ. (`js/core.js` implements exactly these.)
- **App. C:** the rotation nearest a matrix Q is UVᵀ from Q = USVᵀ.

## Hartley normalisation

R. Hartley, *In Defence of the 8-Point Algorithm*, ICCV 1995 (journal version: IEEE TPAMI, 1997), cited by Zhang's App. A. **Not opened for this build** (the hosts were unreachable from the build environment). The page uses the textbook form, translate each point set so its centroid is at the origin and scale it so the mean distance from the origin is √2, and calls it Hartley's normalisation; the √2 detail is as other papers restate it, not checked against the original. The page's own claims about normalisation are measured in the lab (step 1), not quoted.

## OpenCV

Source: [opencv/opencv](https://github.com/opencv/opencv) branch 4.x at `9d80321`, `modules/calib3d/include/opencv2/calib3d.hpp` and `modules/calib3d/src/calibration.cpp`; the tutorial `doc/tutorials/calib3d/camera_calibration/camera_calibration.markdown`; the bibliography `doc/opencv.bib`.

- `calibrateCamera` "@return the overall RMS re-projection error"; it computes `std::sqrt(reprojErr/total)` over all points (calibration.cpp), the definition the lab uses.
- Its steps: "Compute the initial intrinsic parameters (the option only available for planar calibration patterns) … The distortion coefficients are all set to zeros initially … Estimate the initial camera pose … using solvePnP. Run the global Levenberg-Marquardt optimization algorithm to minimize the reprojection error."
- "In practice, robust acquisition is essential for stable results: use multiple board poses with significant tilt, avoid collecting all views at a single working distance, span the expected working-distance range."
- In this 4.x revision the default optimiser is "a sparse bundle adjustment formulation with Schur complement"; `CALIB_DISABLE_SCHUR_COMPLEMENT` switches to "the Bouguet calibration engine (@cite Zhang2000, @cite BouguetMCT)". The bibliography entry `Zhang2000` is the TPAMI paper and links the MSR-TR-98-71 PDF above.
- The initial guess, `initIntrinsicParams2D` (calibration.cpp): principal point fixed at ((w − 1)/2, (h − 1)/2), a homography per view by `findHomography`, and fx, fy by least squares from the two orthogonality constraints. This is a cut-down version of Zhang's closed form; the lab uses Zhang's full one. OpenCV's camera matrix has no skew term.
- Distortion coefficients in OpenCV's order (k1, k2, p1, p2[, k3 …]); `CALIB_FIX_K1 … K6` hold terms fixed.
- Tutorial: "in theory the chessboard pattern requires at least two snapshots. However, in practice we have a good amount of noise present in our input images, so for good results you will probably need at least 10 good snapshots of the input pattern in different positions." The returned re-projection error "should be as close to zero as possible" (the lab's step 5 shows why a low value alone isn't enough).
- `cornerSubPix` is named on the page as an example of sub-pixel corner refinement; its accuracy is not quoted.

## Microduck

[pollen-robotics/microduck](https://github.com/pollen-robotics/microduck) at `648bf22` (Apache-2.0).

- **The answer key.** `robotd-params/src/lib.rs`, `CameraIntrinsics::alpha()`: width 1280, height 720, fx 1061.8060025020175, fy 1062.193713957031, cx 596.7776848217006, cy 474.52348043048636, distortion `[k1 k2 p1 p2 k3]` = −0.34695388691888, 0.14615866153945595, −0.0007449157712424215, −0.0022167170528743837, −0.016437266141048814. Doc comment: "Solved on unit *graphite*, 2026-09-08 — ChArUco board on a screen (caliper-measured), 80 views, 0.79 px RMS, on the 1280×720 frame as `mediad` sends it (unrotated). This is the **~62° full field of view** of the production `1920×1080@30` sensor mode." `CameraIntrinsics` is described as "A camera calibration, as OpenCV's `calibrateCamera` produces one." The lab rounds these and keeps k1 and k2; `tests/check.js` measures that the left-out p1, p2, k3 move a frame-corner pixel by up to 19.0 px.
- **The off-centre principal point.** `mediad/src/camera.rs`: "the principal point is *assumed* central — which is the part a real calibration corrects (the measured `cy` sits ~110 px low)"; and the nominal focal length "`fx = (W/2) / tan(62°/2)`, so 1280 wide gives `fx` ≈ 1065", with a test asserting 1065.14. The module header also records that on this board's driver the 1920×1080 mode "is a *scaled full-frame readout* … **not** the native-pixel 39° crop", "validated on hardware 2026-09-08".
- **The quarter turn.** `uyvy/src/lib.rs`: `Turn::Right` (90° clockwise) maps upright pixel (ux, uy) to source `(uy, height − 1 − ux)`; a test asserts `Turn::Right.upright(1280, 720) == (720, 1280)`. `mediad/src/pipeline.rs`: "A quarter turn clockwise: what this robot's mount needs." `duck-detect/src/lib.rs`: frames arrive "turned the right way up (`--rotate`, default 90°)"; a test comment: "The camera is portrait after the daemon's quarter turn — 720×1280".
- **The bearing.** `duck-detect/src/lib.rs`, `Detection::bearing`: "-1 hard left, 0 straight ahead, 1 hard right … `(centre / frame_width) * 2.0 - 1.0`".
- **The old TODO.** `docs/ideas/autonomous_behavior.md`, line 88: "Fix the placeholder IMX219 intrinsics during the mediad port (audit §04 TODO)." The line is still in the design notes at `648bf22`; the code now ships the family solve above.
- **Not checked:** the `duckslam` tool the comment names ("Re-solve with `duckslam calib intrinsics`") is not in this repository, so how the solve was computed beyond the comment is not claimed.

## Duck's-Eye View

[bakulbadwal/ducks-eye-view](https://github.com/bakulbadwal/ducks-eye-view), built against microduck at `590b986`. Its step 5 assumed the widest 16:9 sensor mode with a centred principal point (f = 640/tan 31° = 1065.1 px across the 1280 axis), read bearing b = 0.5 as 9.59°, and showed a "62° across the 720-pixel width" placeholder (f = 599.1 px) reading it as 16.72°, an over-turn of about 7° (its ACCEPTANCE.md, rows A1, A4, A5). This lab recomputes all three against the repo's solve (step 6).

## What else exists (the README's "why this one")

Found by web search on 2026-10-15; none was opened in a browser for this build, so each is described only as its own page or paper describes it.

- Kyle Simek, [*Dissecting the Camera Matrix*](https://ksimek.github.io/2013/08/13/intrinsic/) (2013): interactive demos of the intrinsic and extrinsic matrices. About what K does, not how to estimate it.
- P. Rojtberg, *calibDB: enabling web based computer vision through on-the-fly camera calibration* ([arXiv:1907.04100](https://arxiv.org/abs/1907.04100), Web3D 2019), and *Efficient Pose Selection for Interactive Camera Calibration*: a web service that calibrates your own camera with guided poses. A tool for doing it, built on the same idea as step 6 (pick poses that reduce uncertainty), not an explainer of the math.
- MATLAB's Camera Calibrator and `showReprojectionErrors`, OpenCV's calibration tutorial, and Bouguet's Camera Calibration Toolbox for Matlab: tools that report reprojection errors on your own photos; there's no answer key to compare against.
- [pvphan/camera-calibration](https://github.com/pvphan/camera-calibration): a Python implementation of Zhang's method that, per its description, can animate the reprojection error at each iteration.
