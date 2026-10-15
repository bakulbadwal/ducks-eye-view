/* Eye Exam — checks. `node tests/check.js` verifies the machinery and prints every number the page and
   ACCEPTANCE.md quote. Everything is seeded, so the printout is the same on every machine. Exits non-zero if a
   check fails. No dependencies. */
"use strict";
var EE = require("../js/core.js");
var fails = 0, t0 = Date.now();
function ok(cond, what) { if (!cond) { fails++; console.log("  ✗ " + what); } else console.log("  ✓ " + what); }
function f(n, d) { return Number(n).toFixed(d == null ? 2 : d); }
function pct(x, d) { return f(x * 100, d == null ? 2 : d) + "%"; }
function head(s) { console.log("\n" + s); }
function card(c) { return "fx " + f(c.fx) + " · fy " + f(c.fy) + " · cx " + f(c.cx) + " · cy " + f(c.cy) + " · skew " + f(c.skew || 0) + " · k1 " + f(c.k1 || 0, 3) + " · k2 " + f(c.k2 || 0, 3); }
function evalLine(e) { return e.ok ? "RMS " + f(e.rms, 3) + " px · hold-out " + f(e.hold, 3) + " px · map mean " + f(e.mapMean) + " / max " + f(e.mapMax, 1) + " px · fx " + (e.fxErr >= 0 ? "+" : "") + pct(e.fxErr) + " · worst head turn " + (e.turn >= 0 ? "+" : "") + f(e.turn) + "° at b = " + e.turnAt : "no prescription: " + e.reason; }

/* ---------- the machinery ---------- */
head("Machinery");
(function () {
  var r = EE.rng(3), A = [];
  for (var i = 0; i < 14; i++) { A.push([]); for (var j = 0; j < 9; j++) A[i].push(r.normal() * Math.pow(10, j % 3)); }
  var d = EE.svd(A), US = d.U.map(function (row) { return row.map(function (v, k) { return v * d.S[k]; }); }), Rc = EE.mul(US, EE.T(d.V)), m = 0;
  for (i = 0; i < 14; i++) for (j = 0; j < 9; j++) m = Math.max(m, Math.abs(Rc[i][j] - A[i][j]) / 100);
  ok(m < 1e-12, "SVD (one-sided Jacobi) rebuilds a 14 × 9 matrix: U S Vᵀ = A to " + m.toExponential(1));
  var VtV = EE.mul(EE.T(d.V), d.V), o = 0; for (i = 0; i < 9; i++) for (j = 0; j < 9; j++) o = Math.max(o, Math.abs(VtV[i][j] - (i === j ? 1 : 0)));
  ok(o < 1e-12, "V is orthonormal (|VᵀV − I| " + o.toExponential(1) + ")");
  var S = EE.mul(EE.T(A), A), e = EE.symEig(S), se = 0; e.values.forEach(function (v, k) { se = Math.max(se, Math.abs(Math.sqrt(Math.max(0, v)) - d.S[k]) / d.S[0]); });
  ok(se < 1e-10, "Jacobi eigenvalues of AᵀA are the squared singular values");
  var M = [[2, 1, 0.5], [0.3, 3, 1], [1, 0.2, 4]], Mi = EE.inv3(M), I3 = EE.mul(M, Mi), ie = 0; for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) ie = Math.max(ie, Math.abs(I3[i][j] - (i === j ? 1 : 0)));
  ok(ie < 1e-14, "3 × 3 inverse: M M⁻¹ = I");
  var rv = [0.3, -1.1, 2.2], rv2 = EE.rotToVec(EE.rodrigues(rv));
  ok(Math.abs(rv2[0] - rv[0]) + Math.abs(rv2[1] - rv[1]) + Math.abs(rv2[2] - rv[2]) < 1e-12, "Rodrigues there and back");
  var Q = EE.rodrigues([0.2, 0.4, -0.3]).map(function (row) { return row.map(function (v) { return v * 1.3 + 0.01; }); }), Rn = EE.nearestRotation(Q);
  ok(Math.abs(EE.det3(Rn) - 1) < 1e-12, "nearest rotation (Zhang App. C) has determinant 1");
  var Sx = [[4, 1], [1, 3]], x = EE.cholSolve(Sx, [1, 2]);
  ok(Math.abs(4 * x[0] + x[1] - 1) + Math.abs(x[0] + 3 * x[1] - 2) < 1e-14, "Cholesky solve");
  var u = EE.undistortN.apply(null, EE.distortN(0.55, -0.4, EE.MICRODUCK.k1, EE.MICRODUCK.k2).concat([EE.MICRODUCK.k1, EE.MICRODUCK.k2]));
  ok(Math.abs(u[0] - 0.55) + Math.abs(u[1] + 0.4) < 1e-12, "the lens model inverts (undistort ∘ distort = identity) at the frame's corner");
  var a1 = JSON.stringify(EE.session(EE.SESSIONS.exam)[4].pts), a2 = JSON.stringify(EE.session(EE.SESSIONS.exam)[4].pts);
  ok(a1 === a2, "a seeded session is the same every time");
})();

/* ---------- the ground truth ---------- */
head("The answer key: Microduck's alpha-family solve (robotd-params/src/lib.rs @ 648bf22), rounded, k1 and k2 only");
console.log("  " + card(EE.TRUE_LENS) + " · frame 1280 × 720 (unrotated)");
console.log("  repo: fx " + EE.REPO_SOLVE.fx + " fy " + EE.REPO_SOLVE.fy + " cx " + EE.REPO_SOLVE.cx + " cy " + EE.REPO_SOLVE.cy);
console.log("  principal point vs the frame's middle (639.5, 359.5): " + f(EE.TRUE_LENS.cx - 639.5, 1) + " px across, " + f(EE.TRUE_LENS.cy - 359.5, 1) + " px down");
console.log("  horizontal field of view 2·atan(640/fx) = " + f(2 * Math.atan(640 / EE.TRUE_LENS.fx) / EE.DEG, 1) + "° · vertical 2·atan(360/fy) = " + f(2 * Math.atan(360 / EE.TRUE_LENS.fy) / EE.DEG, 1) + "°");
console.log("  nominal (mediad, 62° across 1280): f = " + f(EE.NOMINAL.fx) + " px · placeholder (62° across the upright 720): f = " + f(EE.PLACEHOLDER.fx) + " px");
(function () {
  // what the repo's three extra terms would add, at the frame's corners
  var R = EE.REPO_SOLVE, worst = 0;
  [[0, 0], [1279, 0], [0, 719], [1279, 719]].forEach(function (p) {
    var ray = EE.pixelToRay(EE.TRUE_LENS, p[0], p[1]), x = ray[0], y = ray[1], r2 = x * x + y * y, rad = 1 + R.k1 * r2 + R.k2 * r2 * r2 + R.k3 * r2 * r2 * r2;
    var xd = x * rad + 2 * R.p1 * x * y + R.p2 * (r2 + 2 * x * x), yd = y * rad + R.p1 * (r2 + 2 * y * y) + 2 * R.p2 * x * y;
    var u = R.fx * xd + R.cx, v = R.fy * yd + R.cy; worst = Math.max(worst, Math.hypot(u - p[0], v - p[1]));
  });
  console.log("  the repo's p1, p2, k3 (left out here) move a frame-corner pixel by at most " + f(worst, 1) + " px");
})();

/* ---------- step 0 ---------- */
head("Step 0 · The exam room");
(function () {
  var fr = EE.photo({ tilt: 0, at: [EE.TRUE_PIN.cx, EE.TRUE_PIN.cy], dist: 400 }, { lens: false });
  var w = fr.pts[8][0] - fr.pts[0][0];
  console.log("  frontal chart, 200 mm between outer corners, at 400 mm, lens dial at 0: " + f(w, 1) + " px wide (fx·200/400 = " + f(EE.TRUE_PIN.fx * 200 / 400, 1) + ")");
  ok(Math.abs(w - EE.TRUE_PIN.fx * 0.5) < 1e-6, "pinhole: width = fx·X/Z");
  var fr2 = EE.photo({ tilt: 0, at: [EE.TRUE_PIN.cx, EE.TRUE_PIN.cy], dist: 400 }, { lens: true });
  console.log("  the same chart through Microduck's lens: " + f(fr2.pts[8][0] - fr2.pts[0][0], 1) + " px wide");
  var c = EE.TRUE_LENS;
  [[0, 0], [1279, 0]].forEach(function (p) {
    var ray = EE.pixelToRay(EE.TRUE_PIN, p[0], p[1]), q = EE.projectCam(c, [ray[0], ray[1], 1]);
    console.log("  a ray the pinhole puts at the frame corner (" + p + ") lands " + f(Math.hypot(q[0] - p[0], q[1] - p[1]), 1) + " px nearer the middle through the lens");
  });
})();

/* ---------- step 1 ---------- */
head("Step 1 · One photo: the homography by DLT (lens dial at 0)");
(function () {
  var ph = EE.photo({ tilt: 35, axis: 30, spin: 10, at: [600, 400], dist: 450 }, { lens: false, sigma: 0 }), Ht = EE.trueH(EE.TRUE_PIN, ph.pose);
  var a = EE.homography(EE.PTS, ph.pts, { normalize: false }), b = EE.homography(EE.PTS, ph.pts, { normalize: true });
  console.log("  the L matrix is " + EE.dltMatrix(EE.PTS, ph.pts).length + " × 9 (54 corners × 2 rows)");
  ok(EE.hDiff(a.H, Ht) < 1e-9 && EE.hDiff(b.H, Ht) < 1e-9, "zero noise: DLT recovers the true H = K[r1 r2 t] exactly, with and without normalisation (largest relative entry error " + Math.max(EE.hDiff(a.H, Ht), EE.hDiff(b.H, Ht)).toExponential(1) + ")");
  console.log("  condition σ1/σ8 of L: un-normalised " + a.cond.toExponential(2) + " · normalised " + f(b.cond, 2));
  console.log("  smallest singular value σ9 (zero noise): " + a.S[8].toExponential(1) + " / " + b.S[8].toExponential(1));
  var spec = { tilt: 35, axis: 30, spin: 10, at: [600, 400], dist: 450 };
  var nearT = EE.dltTrial(spec, 0, 0.5, 100);
  console.log("  near chart (450 mm), origin at its corner, σ 0.5 px, 100 photos: median error vs truth un-normalised " + f(nearT.un.med, 3) + " px · normalised " + f(nearT.nz.med, 3) + " px");
  var far = { tilt: 10, axis: 0, spin: 0, at: [640, 360], dist: 2500 };
  [0, 200, 500, 1000, 2000, 3000].forEach(function (off) {
    var t = EE.dltTrial(far, off, 0.5, 100);
    console.log("  far chart (2500 mm), origin " + off + " mm away: un-normalised median " + f(t.un.med, 3) + " / worst " + f(t.un.worst, 2) + " px · normalised median " + f(t.nz.med, 3) + " / worst " + f(t.nz.worst, 2) + " px · cond " + t.condUn.toExponential(1) + " vs " + f(t.condNz, 1));
  });
  var t1 = EE.dltTrial(far, 1000, 0.5, 100);
  ok(t1.un.med > 10 * t1.nz.med, "far chart, origin 1 m off: un-normalised DLT is over 10× worse");
  var tz = EE.dltTrial(far, 3000, 0.5, 100), tz0 = EE.dltTrial(far, 0, 0.5, 100);
  ok(Math.abs(tz.nz.med - tz0.nz.med) < 1e-6, "normalised DLT doesn't care where the origin is");
})();

/* ---------- step 2 ---------- */
head("Step 2 · Two clues per photo: counting constraints on B = K⁻ᵀK⁻¹ (lens dial at 0, zero noise)");
var GOOD = [{ tilt: 40, axis: 0, spin: 0, at: [400, 300], dist: 450 }, { tilt: 40, axis: 90, spin: 15, at: [900, 400], dist: 500 }, { tilt: 35, axis: 45, spin: -10, at: [640, 360], dist: 450 }, { tilt: 30, axis: 135, spin: 5, at: [500, 450], dist: 520 }, { tilt: 45, axis: 200, spin: 20, at: [800, 300], dist: 480 }];
var FRONTAL = [0, 1, 2, 3, 4].map(function (i) { return { tilt: 0, spin: i * 20 - 40, at: [300 + i * 150, 200 + i * 80], dist: 400 + i * 60 }; });
var MOVED = [0, 1, 2, 3, 4].map(function (i) { return { tilt: 35, axis: 30, spin: 10, at: [300 + i * 150, 200 + i * 80], dist: 400 + i * 60 }; });
function pv(specs, sig) { return specs.map(function (s, i) { return EE.photo(s, { lens: false, sigma: sig || 0, seed: i + 1 }); }); }
function zl(name, views, o) {
  var z = EE.zhangClosed(views, o || {});
  console.log("  " + name + ": V is " + z.rows + " × 6, zero singular values " + z.nullDim + " → " + (z.ok ? card(z.cam) : z.reason));
  return z;
}
(function () {
  var z1 = zl("1 photo", pv(GOOD.slice(0, 1))), z2 = zl("2 photos", pv(GOOD.slice(0, 2))), z2s = zl("2 photos + skew = 0", pv(GOOD.slice(0, 2)), { skewZero: true });
  var z3 = zl("3 photos", pv(GOOD.slice(0, 3))), z5 = zl("5 photos", pv(GOOD));
  var zf = zl("5 frontal photos", pv(FRONTAL)), zm = zl("5 photos, same tilt, moved", pv(MOVED));
  ok(z1.nullDim === 4 && !z1.ok, "1 photo: 2 equations, 4 zero singular values, no answer");
  ok(z2.nullDim === 2 && !z2.ok, "2 photos: 4 equations, a line of answers");
  ok(z2s.ok && Math.abs(z2s.cam.fx - EE.TRUE_PIN.fx) < 1e-6, "2 photos + skew = 0 (Zhang §3.1): unique, exact");
  ok(z3.ok && Math.abs(z3.cam.fx - EE.TRUE_PIN.fx) < 1e-6 && Math.abs(z3.cam.cy - EE.TRUE_PIN.cy) < 1e-6 && Math.abs(z3.cam.skew) < 1e-6, "3 photos: Zhang's closed form recovers K exactly with zero noise");
  ok(zf.nullDim === 4 && !zf.ok, "degenerate: 5 frontal (parallel) photos give the same 2 equations as 1 (Zhang Prop. 1) — detected");
  ok(zm.nullDim === 4 && !zm.ok, "degenerate: 5 photos at one orientation, only moved (pure translation) — detected");
  console.log("  ratio σ6/σ5 for 3 photos: " + z3.ratio.toExponential(1));
  console.log("  how flat is too flat: 200 sessions of 3 photos at 500 mm, σ 0.5 px");
  [2, 5, 10, 20, 45].forEach(function (th) { var t = EE.flatTrial(th, 200, 0.5); console.log("    tilt " + th + "°: " + t.fail + " / 200 give no usable camera · mean |fx error| of the rest " + pct(t.fxErr) + ""); });
})();

/* ---------- step 3 ---------- */
head("Step 3 · The closed form (lens dial at 0)");
(function () {
  var S = EE.session(Object.assign({}, EE.SESSIONS.trial, { sigma: 0 }));
  var z = EE.zhangClosed(S.slice(0, 3));
  ok(z.ok && Math.abs(z.cam.fx - EE.TRUE_PIN.fx) < 1e-6, "3 photos of the 20-photo trial session, zero noise: exact (" + card(z.cam) + ")");
  var maxT = 0; z.poses.forEach(function (p, i) { maxT = Math.max(maxT, Math.hypot(p.t[0] - S[i].pose.t[0], p.t[1] - S[i].pose.t[1], p.t[2] - S[i].pose.t[2])); });
  ok(maxT < 1e-6, "and the extrinsics: every chart position recovered to " + maxT.toExponential(1) + " mm");
  [3, 12].forEach(function (n) {
    var Sn = EE.session(EE.SESSIONS.trial).slice(0, n), zz = EE.zhangClosed(Sn);
    var rms = EE.reprojection(zz.cam, zz.poses, Sn).rms;
    console.log("  trial session, σ 0.5 px, first " + n + " photos: " + card(zz.cam) + " · RMS " + f(rms, 3) + " px");
  });
  console.log("  closed form alone, σ 0.5 px, mean over 20 sessions:");
  [2, 3, 4, 6, 8, 12, 20].forEach(function (n) { var t = EE.closedTrial(n, 0.5, 20); console.log("    " + n + " photos" + (n < 3 ? " (+ skew = 0)" : "") + ": |fx error| " + pct(t.fxErr) + " · principal point off by " + f(t.ppErr, 1) + " px"); });
})();

/* ---------- step 4 ---------- */
head("Step 4 · The lens dial (Microduck's lens on)");
var EXAM = EE.session(EE.SESSIONS.exam), CAL = EE.calibrate(EXAM);
(function () {
  var ph = EE.photo({ tilt: 25, axis: 60, spin: 5, at: [250, 160], dist: 420 }, { lens: true }), ph0 = EE.photo({ tilt: 25, axis: 60, spin: 5, at: [250, 160], dist: 420 }, { lens: false });
  console.log("  a chart near the top-left corner: its top row bends " + f(EE.rowBend(ph.pts, 0), 1) + " px from straight through the lens, " + f(EE.rowBend(ph0.pts, 0), 3) + " px without");
  console.log("  the exam session: " + EXAM.length + " photos, σ 0.25 px");
  console.log("  closed form, ignoring the lens: " + card(CAL.closed.cam) + " · RMS " + f(CAL.closedRms) + " px");
  console.log("  + k1, k2 by linear least squares (eq. 13): k1 " + f(CAL.linear.cam.k1, 3) + " · k2 " + f(CAL.linear.cam.k2, 3) + " · RMS " + f(CAL.linear.rms) + " px");
  ok(CAL.linear.cam.k1 > 0 && EE.TRUE_LENS.k1 < 0, "as in Zhang's Table 1, the linear k1 comes out with the wrong sign (pincushion for a barrel lens)");
})();

/* ---------- step 5 ---------- */
head("Step 5 · Better one or two? Levenberg–Marquardt on the total reprojection error");
(function () {
  console.log("  RMS by step: " + CAL.refined.hist.map(function (h) { return f(h.rms, 3); }).join(" → ") + " px (" + CAL.refined.iters + " steps; step 0 is the closed form + linear k1, k2 with the skew set to 0)");
  console.log("  refined: " + card(CAL.cam));
  var e = EE.camErrors(CAL.cam);
  console.log("  vs the answer key: fx " + pct(e.fx) + " · fy " + pct(e.fy) + " · cx " + f(e.cx, 2) + " px · cy " + f(e.cy, 2) + " px · k1 " + f(e.k1, 4) + " · k2 " + f(e.k2, 4));
  ok(CAL.rms < CAL.linear.rms / 10, "LM cuts the RMS by more than 10×");
  ok(Math.abs(e.k1) < 0.01 && Math.abs(e.k2) < 0.02 && Math.abs(e.fx) < 0.005, "LM recovers the distortion (k1 within 0.01, k2 within 0.02) and fx within 0.5%");
  var z0 = EE.calibrate(EE.session(Object.assign({}, EE.SESSIONS.exam, { sigma: 0 })));
  ok(Math.abs(z0.cam.k1 - EE.TRUE_LENS.k1) < 1e-8 && Math.abs(z0.cam.fx - EE.TRUE_LENS.fx) < 1e-6 && z0.rms < 1e-6, "zero noise: the whole pipeline recovers Microduck's K, k1, k2 exactly (RMS " + z0.rms.toExponential(1) + " px)");
  var fs = EE.calibrate(EXAM, { fixSkew: false });
  console.log("  with the skew left free (Zhang): skew " + f(fs.cam.skew, 3) + " px · RMS " + f(fs.rms, 4) + " px (skew fixed at 0, as OpenCV does: RMS " + f(CAL.rms, 4) + ")");
  console.log("  floor: σ√2 = " + f(0.25 * Math.SQRT2, 3) + " px for corners with σ = 0.25 px per axis");
  console.log("  is a low score a good eye?");
  var E = EE.evaluate(CAL); console.log("    the exam (12 photos, lens free):        " + evalLine(E));
  var S3 = EE.session(EE.SESSIONS.straight), P = EE.calibrate(S3, { model: "pinhole" }), PD = EE.dropWorstHalf(S3, { model: "pinhole" });
  var eP = EE.evaluate(P), eD = EE.evaluate(PD);
  console.log("    12 photos, lens dial held at 0:         " + evalLine(eP));
  console.log("    … and the worst 6 photos dropped:       " + evalLine(eD));
  ok(eD.rms < eP.rms / 1.8 && eD.hold > eP.hold, "dropping the worst photos halves the RMS and makes the hold-out error worse");
  var three = EE.calibrate(EE.session({ n: 3, seed: 3, sigma: 0.25 }));
  console.log("    3 photos:                               " + evalLine(EE.evaluate(three)));
})();

/* ---------- step 6 ---------- */
head("Step 6 · The fitting: planning a session (seed 31) and what it costs the duck");
(function () {
  function plan(name, o) { var e = EE.evaluate(EE.calibrate(EE.session(EE.planSession(o)))); console.log("  " + name + ": " + evalLine(e)); return e; }
  [3, 6, 12, 20, 30].forEach(function (n) { plan(n + " photos", { n: n }); });
  Object.keys(EE.TILTS).forEach(function (t) { plan("tilt " + EE.TILTS[t].join("–") + "°", { tilt: t }); });
  plan("centre only, small and far", { cover: "centre" });
  [0.1, 0.5, 1, 2].forEach(function (s) { plan("σ " + s + " px", { sigma: s }); });
  console.log("  head turn on the upright 720 × 1280 frame (degrees, + = the duck's right, from the optical axis):");
  [-1, -0.5, 0, 0.5, 1].forEach(function (b) {
    console.log("    b = " + f(b, 1) + ": truth " + f(EE.bearingAngle(EE.TRUE_LENS, b)) + " · centred pinhole f 1065.14 (Duck's-Eye View, mediad nominal) " + f(EE.bearingAngle(EE.NOMINAL, b)) + " · placeholder 62° across 720 " + f(EE.bearingAngle(EE.PLACEHOLDER, b)) + " · this exam " + f(EE.bearingAngle(CAL.cam, b)));
  });
  var wn = EE.worstTurn(EE.NOMINAL), wp = EE.worstTurn(EE.PLACEHOLDER), we = EE.worstTurn(CAL.cam);
  console.log("  worst error across the frame: nominal " + f(wn.err) + "° at b = " + wn.at + " · placeholder " + f(wp.err) + "° at b = " + wp.at + " · this exam " + f(we.err) + "° at b = " + we.at);
  console.log("  optical axis on the upright frame: x' = 719 − cy = " + f(719 - EE.TRUE_LENS.cy, 2) + " px, " + f(359.5 - (719 - EE.TRUE_LENS.cy), 1) + " px left of the middle → b = 0 is " + f(EE.bearingAngle(EE.TRUE_LENS, 0)) + "° right");
  console.log("  at 3 m, a 6.21° error misses by " + f(EE.missAt(EE.bearingAngle(EE.TRUE_LENS, 0), 3) * 100, 0) + " cm; Duck's-Eye View's b = 0.5: " + f(EE.bearingAngle(EE.NOMINAL, 0.5)) + "° (its centred pinhole) vs " + f(EE.bearingAngle(EE.TRUE_LENS, 0.5)) + "° (the repo's solve)");
  ok(Math.abs(we.err) < 0.5, "a good 12-photo calibration turns the head to within 0.5° everywhere on the bearing line");
  ok(Math.abs(EE.bearingAngle(EE.TRUE_LENS, 0) - 6.2) < 0.05, "Microduck's principal point puts the frame's middle 6.2° off the optical axis");
})();

/* ---------- review board ---------- */
head("Review board (each re-run is the named session, calibrated, judged against the answer key)");
var CASES = [
  ["Case 1 · the flat-lander", [["as booked: 12 photos tilted 5–15°", "flat"], ["30 photos the same way", "flat30"], ["sharper corners, σ 0.1 px", "flatSharp"], ["re-take 12 photos tilted 20–50°", "flatFixed"]]],
  ["Case 2 · the corner-blind", [["as booked: 12 small charts in the middle", "blind"], ["30 photos the same way", "blind30"], ["sharper corners, σ 0.1 px", "blindSharp"], ["re-take 12 photos that fill the frame", "blindFixed"]]],
  ["Case 3 · the straight-liner (lens dial held at 0)", [["as booked", "straight", { model: "pinhole" }], ["drop the worst half of the photos", "straight", { model: "pinhole" }, true], ["30 photos, dial still at 0", "straight30", { model: "pinhole" }], ["free the lens dial (estimate k1, k2)", "straight", {}]]]
];
var CASE_RESULTS = {};
CASES.forEach(function (c) {
  console.log("  " + c[0]);
  c[1].forEach(function (row) {
    var views = EE.session(EE.SESSIONS[row[1]]), cal = row[3] ? EE.dropWorstHalf(views, row[2]) : EE.calibrate(views, row[2] || {}), e = EE.evaluate(cal);
    CASE_RESULTS[c[0] + row[0]] = e;
    console.log("    " + row[0] + ": " + evalLine(e));
  });
});
(function () {
  function pass1(e) { return e.ok && Math.abs(e.fxErr) < 0.01 && Math.abs(e.turn) < 0.5; }
  function pass2(e) { return e.ok && e.mapMax < 5 && e.hold < 0.4; }
  function pass3(e) { return e.ok && Math.abs(e.turn) < 0.5 && e.hold < 0.4; }
  var r = CASE_RESULTS;
  ok(!pass1(r["Case 1 · the flat-landeras booked: 12 photos tilted 5–15°"]) && !pass1(r["Case 1 · the flat-lander30 photos the same way"]) && !pass1(r["Case 1 · the flat-landersharper corners, σ 0.1 px"]) && pass1(r["Case 1 · the flat-landerre-take 12 photos tilted 20–50°"]), "case 1: only the tilted re-take passes (fx within 1%, head turn within 0.5°)");
  ok(!pass2(r["Case 2 · the corner-blindas booked: 12 small charts in the middle"]) && !pass2(r["Case 2 · the corner-blind30 photos the same way"]) && !pass2(r["Case 2 · the corner-blindsharper corners, σ 0.1 px"]) && pass2(r["Case 2 · the corner-blindre-take 12 photos that fill the frame"]), "case 2: only filling the frame passes (map error under 5 px everywhere, hold-out under 0.40 px)");
  ok(!pass3(r["Case 3 · the straight-liner (lens dial held at 0)as booked"]) && !pass3(r["Case 3 · the straight-liner (lens dial held at 0)drop the worst half of the photos"]) && !pass3(r["Case 3 · the straight-liner (lens dial held at 0)30 photos, dial still at 0"]) && pass3(r["Case 3 · the straight-liner (lens dial held at 0)free the lens dial (estimate k1, k2)"]), "case 3: only freeing the lens dial passes (head turn within 0.5°, hold-out under 0.40 px)");
})();

console.log("\n" + (fails ? fails + " check(s) FAILED" : "all checks passed") + " · " + f((Date.now() - t0) / 1000, 1) + " s");
process.exit(fails ? 1 : 0);
