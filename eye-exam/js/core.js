/* Eye Exam — the math. Pure functions, no DOM, no dependencies. Exposed as window.EE in the browser and as a
   Node module for tests/check.js. Everything random is seeded, so every number is the same for everyone.

   What is here:
   - small dense linear algebra written out by hand: products, a 3×3 inverse, a Cholesky solve, a symmetric
     eigen-decomposition (cyclic Jacobi) and a singular value decomposition (one-sided Jacobi);
   - the camera: a pinhole with intrinsic matrix K (fx, fy, cx, cy, skew) and Zhang's two-term radial distortion
     (k1, k2), in OpenCV's axes (+X right, +Y down, +Z forward) and OpenCV's pixel convention (pixel centres at
     integers);
   - the eye chart (a 9 × 6 grid of inner checkerboard corners, 25 mm squares) and seeded "photos" of it;
   - Zhang's method (Z. Zhang, A Flexible New Technique for Camera Calibration, MSR-TR-98-71 / TPAMI 2000):
     homographies by DLT with Hartley normalisation (App. A), the V b = 0 stack (eq. 8-9), K from B (App. B),
     the extrinsics (§3.1) with the nearest rotation (App. C), radial distortion by linear least squares
     (eq. 13), and the full maximum-likelihood refinement (eq. 14) by Levenberg–Marquardt;
   - what a calibration costs the duck: the error map over the frame, and the bearing → head-turn angle on
     Microduck's upright 720 × 1280 frame. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DEG = Math.PI / 180;

  /* ================= seeded randomness ================= */
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    function next() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    next.normal = function () { var u = 0, v = 0; while (u === 0) u = next(); v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return next;
  }

  /* ================= linear algebra ================= */
  function zeros(m, n) { var A = []; for (var i = 0; i < m; i++) { A.push(new Array(n).fill(0)); } return A; }
  function eye(n) { var A = zeros(n, n); for (var i = 0; i < n; i++) A[i][i] = 1; return A; }
  function T(A) { var m = A.length, n = A[0].length, B = zeros(n, m); for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) B[j][i] = A[i][j]; return B; }
  function mul(A, B) {
    var m = A.length, k = B.length, n = B[0].length, C = zeros(m, n);
    for (var i = 0; i < m; i++) for (var p = 0; p < k; p++) { var a = A[i][p]; if (a === 0) continue; for (var j = 0; j < n; j++) C[i][j] += a * B[p][j]; }
    return C;
  }
  function mv(A, x) { return A.map(function (r) { var s = 0; for (var j = 0; j < r.length; j++) s += r[j] * x[j]; return s; }); }
  function det3(A) { return A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]); }
  function inv3(A) {
    var d = det3(A);
    if (!isFinite(d) || Math.abs(d) < 1e-300) return null;
    return [
      [(A[1][1] * A[2][2] - A[1][2] * A[2][1]) / d, (A[0][2] * A[2][1] - A[0][1] * A[2][2]) / d, (A[0][1] * A[1][2] - A[0][2] * A[1][1]) / d],
      [(A[1][2] * A[2][0] - A[1][0] * A[2][2]) / d, (A[0][0] * A[2][2] - A[0][2] * A[2][0]) / d, (A[0][2] * A[1][0] - A[0][0] * A[1][2]) / d],
      [(A[1][0] * A[2][1] - A[1][1] * A[2][0]) / d, (A[0][1] * A[2][0] - A[0][0] * A[2][1]) / d, (A[0][0] * A[1][1] - A[0][1] * A[1][0]) / d]
    ];
  }
  function norm(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s); }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function col(A, j) { return A.map(function (r) { return r[j]; }); }

  // Symmetric eigen-decomposition by cyclic Jacobi rotations. Returns values sorted largest first, and the
  // matching eigenvectors as the columns of `vectors`.
  function symEig(S) {
    var n = S.length, A = S.map(function (r) { return r.slice(); }), V = eye(n);
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-30) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        var th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (var k = 0; k < n; k++) { var akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (k = 0; k < n; k++) { var apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (k = 0; k < n; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    var idx = []; for (var i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return A[b][b] - A[a][a]; });
    return { values: idx.map(function (i) { return A[i][i]; }), vectors: V.map(function (r) { return idx.map(function (i) { return r[i]; }); }) };
  }

  // Singular value decomposition A = U S Vᵀ by one-sided Jacobi (Hestenes): orthogonalise the columns of A by
  // plane rotations accumulated in V. Works for any m × n; a short matrix is padded with zero rows, which adds
  // zero singular values (the honest answer: those directions are unconstrained). Values sorted largest first.
  function svd(A0) {
    var m = A0.length, n = A0[0].length, A = A0.map(function (r) { return r.slice(); });
    while (A.length < n) A.push(new Array(n).fill(0));
    m = A.length;
    var V = eye(n);
    for (var sweep = 0; sweep < 80; sweep++) {
      var rot = 0;
      for (var p = 0; p < n - 1; p++) for (var q = p + 1; q < n; q++) {
        var a = 0, b = 0, g = 0;
        for (var i = 0; i < m; i++) { var x = A[i][p], y = A[i][q]; a += x * x; b += y * y; g += x * y; }
        if (Math.abs(g) <= 1e-15 * Math.sqrt(a * b) || g === 0) continue;
        rot++;
        var z = (b - a) / (2 * g), t = (z >= 0 ? 1 : -1) / (Math.abs(z) + Math.sqrt(1 + z * z)), c = 1 / Math.sqrt(1 + t * t), s = c * t;
        for (i = 0; i < m; i++) { x = A[i][p]; y = A[i][q]; A[i][p] = c * x - s * y; A[i][q] = s * x + c * y; }
        for (i = 0; i < n; i++) { x = V[i][p]; y = V[i][q]; V[i][p] = c * x - s * y; V[i][q] = s * x + c * y; }
      }
      if (!rot) break;
    }
    var S = [], idx = [];
    for (var j = 0; j < n; j++) { S.push(norm(col(A, j))); idx.push(j); }
    idx.sort(function (a, b) { return S[b] - S[a]; });
    var U = A.map(function (r) { return idx.map(function (j) { return S[j] > 1e-300 ? r[j] / S[j] : 0; }); });
    return { U: U, S: idx.map(function (j) { return S[j]; }), V: V.map(function (r) { return idx.map(function (j) { return r[j]; }); }) };
  }
  // The unit vector x that makes |A x| smallest: the right singular vector of the smallest singular value.
  function nullVec(A) { var d = svd(A); return { x: col(d.V, d.V[0].length - 1), S: d.S }; }

  // Solves the symmetric positive-definite system A x = b (Cholesky). Returns null if A isn't positive definite.
  function cholSolve(A, b) {
    var n = A.length, L = zeros(n, n);
    for (var i = 0; i < n; i++) for (var j = 0; j <= i; j++) {
      var s = A[i][j]; for (var k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (!(s > 0)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    var y = new Array(n); for (i = 0; i < n; i++) { s = b[i]; for (k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    var x = new Array(n); for (i = n - 1; i >= 0; i--) { s = y[i]; for (k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
    return x;
  }

  /* ================= rotations ================= */
  // Rodrigues: a 3-vector along the rotation axis whose length is the angle (Zhang §3.2; OpenCV's rvec).
  function rodrigues(r) {
    var th = norm(r);
    if (th < 1e-12) return [[1, -r[2], r[1]], [r[2], 1, -r[0]], [-r[1], r[0], 1]];
    var k = [r[0] / th, r[1] / th, r[2] / th], c = Math.cos(th), s = Math.sin(th), v = 1 - c;
    return [
      [c + k[0] * k[0] * v, k[0] * k[1] * v - k[2] * s, k[0] * k[2] * v + k[1] * s],
      [k[1] * k[0] * v + k[2] * s, c + k[1] * k[1] * v, k[1] * k[2] * v - k[0] * s],
      [k[2] * k[0] * v - k[1] * s, k[2] * k[1] * v + k[0] * s, c + k[2] * k[2] * v]
    ];
  }
  function rotToVec(R) {
    var c = Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)), th = Math.acos(c);
    if (th < 1e-9) return [(R[2][1] - R[1][2]) / 2, (R[0][2] - R[2][0]) / 2, (R[1][0] - R[0][1]) / 2];
    if (Math.PI - th < 1e-6) {
      // near 180°: the axis from the diagonal
      var x = Math.sqrt(Math.max(0, (R[0][0] + 1) / 2)), y = Math.sqrt(Math.max(0, (R[1][1] + 1) / 2)), z = Math.sqrt(Math.max(0, (R[2][2] + 1) / 2));
      if (R[0][1] < 0) y = -y; if (R[0][2] < 0) z = -z;
      return [x * th, y * th, z * th];
    }
    var s = 2 * Math.sin(th);
    return [(R[2][1] - R[1][2]) / s * th, (R[0][2] - R[2][0]) / s * th, (R[1][0] - R[0][1]) / s * th];
  }
  // Zhang App. C: the rotation nearest a 3 × 3 matrix Q in the Frobenius norm is U Vᵀ from Q = U S Vᵀ.
  function nearestRotation(Q) {
    var d = svd(Q), R = mul(d.U, T(d.V));
    if (det3(R) < 0) { var U = d.U.map(function (r) { return [r[0], r[1], -r[2]]; }); R = mul(U, T(d.V)); }
    return R;
  }
  function axisAngle(axis, ang) { var n = norm(axis); return rodrigues([axis[0] / n * ang, axis[1] / n * ang, axis[2] / n * ang]); }

  /* ================= the camera ================= */
  // The ground truth: Microduck's alpha-family calibration as its repo ships it (robotd-params/src/lib.rs,
  // CameraIntrinsics::alpha, solved 2026-09-08 on the 1280 × 720 frame as mediad sends it, unrotated),
  // rounded, keeping Zhang's two radial terms. The real solve also has p1, p2 (tangential) and k3, which move
  // a corner pixel by a few pixels at most; this lab's model, like Zhang's paper, has k1 and k2 only.
  var MICRODUCK = { fx: 1061.81, fy: 1062.19, cx: 596.78, cy: 474.52, skew: 0, k1: -0.34695, k2: 0.14616 };
  var REPO_SOLVE = { fx: 1061.8060025020175, fy: 1062.193713957031, cx: 596.7776848217006, cy: 474.52348043048636, k1: -0.34695388691888, k2: 0.14615866153945595, p1: -0.0007449157712424215, p2: -0.0022167170528743837, k3: -0.016437266141048814 };
  var W = 1280, H = 720;
  function camera(o) { return Object.assign({ fx: MICRODUCK.fx, fy: MICRODUCK.fy, cx: MICRODUCK.cx, cy: MICRODUCK.cy, skew: 0, k1: 0, k2: 0 }, o || {}); }
  var TRUE_LENS = camera({ k1: MICRODUCK.k1, k2: MICRODUCK.k2 });   // the duck's eye with its real lens
  var TRUE_PIN = camera({});                                           // the same eye with the lens dial at 0
  function Kmat(c) { return [[c.fx, c.skew || 0, c.cx], [0, c.fy, c.cy], [0, 0, 1]]; }
  function distortN(x, y, k1, k2) { var r2 = x * x + y * y, f = 1 + k1 * r2 + k2 * r2 * r2; return [x * f, y * f]; }
  // Inverts the radial model by fixed-point iteration: x = x_d / (1 + k1 r² + k2 r⁴), r from the current x.
  function undistortN(xd, yd, k1, k2) {
    var x = xd, y = yd;
    for (var i = 0; i < 40; i++) { var r2 = x * x + y * y, f = 1 + k1 * r2 + k2 * r2 * r2; x = xd / f; y = yd / f; }
    return [x, y];
  }
  // Camera-frame point → pixel. u = fx·x_d + skew·y_d + cx, v = fy·y_d + cy (Zhang eq. 1, then §3.3).
  function projectCam(c, Xc) {
    if (Xc[2] <= 1e-9) return null;
    var x = Xc[0] / Xc[2], y = Xc[1] / Xc[2], d = distortN(x, y, c.k1 || 0, c.k2 || 0);
    return [c.fx * d[0] + (c.skew || 0) * d[1] + c.cx, c.fy * d[1] + c.cy];
  }
  // A chart point (X, Y, 0) in mm, seen from pose (R, t).
  function toCam(R, t, X, Y) { return [R[0][0] * X + R[0][1] * Y + t[0], R[1][0] * X + R[1][1] * Y + t[1], R[2][0] * X + R[2][1] * Y + t[2]]; }
  function project(c, pose, X, Y) { return projectCam(c, toCam(pose.R, pose.t, X, Y)); }
  // Pixel → the undistorted normalised ray (x, y, 1).
  function pixelToRay(c, u, v) {
    var yd = (v - c.cy) / c.fy, xd = (u - c.cx - (c.skew || 0) * yd) / c.fx;
    return undistortN(xd, yd, c.k1 || 0, c.k2 || 0);
  }

  /* ================= the eye chart ================= */
  var CHART = { cols: 9, rows: 6, sq: 25 };   // inner corners, and the square side in mm (OpenCV's tutorial pattern is 9 × 6)
  function chartPoints(ch) {
    ch = ch || CHART; var P = [];
    for (var j = 0; j < ch.rows; j++) for (var i = 0; i < ch.cols; i++) P.push([i * ch.sq, j * ch.sq]);
    return P;
  }
  var PTS = chartPoints();
  var CHART_W = (CHART.cols - 1) * CHART.sq, CHART_H = (CHART.rows - 1) * CHART.sq;   // 200 × 125 mm between the outer corners

  /* ================= photos of the chart ================= */
  // A pose: tilt the chart by `tilt` degrees about an in-plane axis at angle `axis`, spin it by `spin` in its own
  // plane, and place its middle on the ray through pixel `at` at distance `dist` mm. If any corner (with a
  // 20-pixel margin) would leave the frame, the chart is pulled towards the frame's middle and then back.
  function makePose(spec, cam) {
    cam = cam || TRUE_LENS;
    var Rspin = rodrigues([0, 0, (spec.spin || 0) * DEG]),
        a = (spec.axis || 0) * DEG, Rtilt = axisAngle([Math.cos(a), Math.sin(a), 0], (spec.tilt || 0) * DEG),
        R = mul(Rtilt, Rspin), mid = [CHART_W / 2, CHART_H / 2, 0];
    var at = (spec.at || [W / 2, H / 2]).slice(), dist = spec.dist || 450, margin = spec.margin == null ? 20 : spec.margin;
    for (var tries = 0; tries < 200; tries++) {
      var ray = pixelToRay(cam, at[0], at[1]), dir = [ray[0], ray[1], 1], dn = norm(dir);
      var C = [dir[0] / dn * dist, dir[1] / dn * dist, dir[2] / dn * dist], Rm = mv(R, mid), t = [C[0] - Rm[0], C[1] - Rm[1], C[2] - Rm[2]];
      var pose = { R: R, t: t, spec: spec };
      if (inFrame(cam, pose, margin)) { pose.at = at; pose.dist = dist; return pose; }
      if (tries % 2 === 0) { at[0] += (W / 2 - at[0]) * 0.12; at[1] += (H / 2 - at[1]) * 0.12; } else dist *= 1.04;
    }
    return null;
  }
  function inFrame(cam, pose, margin) {
    for (var i = 0; i < PTS.length; i++) {
      var p = project(cam, pose, PTS[i][0], PTS[i][1]);
      if (!p || p[0] < margin || p[0] > W - 1 - margin || p[1] < margin || p[1] > H - 1 - margin) return false;
    }
    // every corner in front, and the chart facing the camera
    return pose.R[2][2] > 0.05;
  }
  // The corners the corner-finder reports: the true projection plus Gaussian noise of σ pixels per axis.
  function observe(cam, pose, sigma, r) {
    return PTS.map(function (P) { var p = project(cam, pose, P[0], P[1]); return [p[0] + (sigma ? sigma * r.normal() : 0), p[1] + (sigma ? sigma * r.normal() : 0)]; });
  }
  // A session: a list of photos. Each photo's tilt, axis, spin, place and distance are drawn from the seed.
  //   region: "all" (chart middles spread over a 4 × 3 grid of the frame, so the corners get covered),
  //           "centre" (every chart middle within the frame's central 30% × 30%);
  //   tilt: [min, max] degrees; frontal: true pins tilt at 0; lens: false photographs with the dial at 0.
  function session(o) {
    o = Object.assign({ n: 12, seed: 1, sigma: 0.25, region: "all", tilt: [20, 50], lens: true, dist: [380, 620] }, o || {});
    var cam = o.cam || (o.lens ? TRUE_LENS : TRUE_PIN), r = rng(o.seed), rn = rng(o.seed * 7919 + 13), views = [];
    for (var k = 0; views.length < o.n && k < o.n * 6; k++) {
      var gx, gy;
      if (o.region === "centre") { gx = W * (0.35 + 0.3 * r()); gy = H * (0.35 + 0.3 * r()); }
      else { var cell = (k + o.seed) % 12; gx = W * ((cell % 4) + 0.15 + 0.7 * r()) / 4; gy = H * (Math.floor(cell / 4) + 0.15 + 0.7 * r()) / 3; }
      var tilt = o.frontal ? 0 : o.tilt[0] + (o.tilt[1] - o.tilt[0]) * r();
      var spec = { tilt: tilt, axis: 360 * r(), spin: -25 + 50 * r(), at: [gx, gy], dist: o.dist[0] + (o.dist[1] - o.dist[0]) * r() };
      var pose = makePose(spec, cam);
      if (!pose) continue;
      views.push({ id: views.length, pose: pose, pts: observe(cam, pose, o.sigma, rn), ideal: observe(cam, pose, 0, rn), sigma: o.sigma, tilt: tilt });
    }
    return views;
  }
  // One photo from an explicit pose spec (the step widgets).
  function photo(spec, o) {
    o = o || {};
    var cam = o.cam || (o.lens === false ? TRUE_PIN : TRUE_LENS), pose = makePose(spec, cam);
    if (!pose) return null;
    var r = rng(o.seed || 1);
    return { pose: pose, pts: observe(cam, pose, o.sigma || 0, r), ideal: observe(cam, pose, 0, r), sigma: o.sigma || 0, tilt: spec.tilt || 0 };
  }

  /* ================= one photo: the homography (Zhang App. A) ================= */
  // Hartley's normalisation: move the points' centroid to the origin and scale so the mean distance is √2.
  function normT(P) {
    var mx = 0, my = 0; P.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= P.length; my /= P.length;
    var d = 0; P.forEach(function (p) { d += Math.hypot(p[0] - mx, p[1] - my); }); d /= P.length;
    var s = Math.SQRT2 / d;
    return [[s, 0, -s * mx], [0, s, -s * my], [0, 0, 1]];
  }
  function applyH(Hm, X, Y) { var w = Hm[2][0] * X + Hm[2][1] * Y + Hm[2][2]; return [(Hm[0][0] * X + Hm[0][1] * Y + Hm[0][2]) / w, (Hm[1][0] * X + Hm[1][1] * Y + Hm[1][2]) / w]; }
  // The 2N × 9 DLT matrix L of Zhang App. A: [Mᵀ 0 −u Mᵀ ; 0 Mᵀ −v Mᵀ] x = 0, M = (X, Y, 1).
  function dltMatrix(M, m) {
    var L = [];
    for (var i = 0; i < M.length; i++) {
      var X = M[i][0], Y = M[i][1], u = m[i][0], v = m[i][1];
      L.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y, -u]);
      L.push([0, 0, 0, X, Y, 1, -v * X, -v * Y, -v]);
    }
    return L;
  }
  // Direct linear transform. With normalize, both point sets are normalised first and H is denormalised after:
  // H = T_m⁻¹ Ĥ T_M. `fp32` rounds every entry of L to single precision, the precision a GPU or an embedded
  // board often works in. Returns H scaled so H[2][2] = 1, and the conditioning of the solve:
  // cond = σ₁/σ₈ of L (how much the 8 constrained directions differ in size) and gap = σ₈/σ₉.
  function homography(M, m, o) {
    o = o || {};
    var TM = o.normalize ? normT(M) : eye(3), Tm = o.normalize ? normT(m) : eye(3);
    var Mn = M.map(function (p) { return applyH(TM, p[0], p[1]); }), mn = m.map(function (p) { return applyH(Tm, p[0], p[1]); });
    var L = dltMatrix(Mn, mn);
    if (o.fp32) L = L.map(function (r) { return r.map(Math.fround); });
    var d = svd(L), x = col(d.V, 8), Hn = [[x[0], x[1], x[2]], [x[3], x[4], x[5]], [x[6], x[7], x[8]]];
    var Hm = mul(mul(inv3(Tm), Hn), TM);
    if (Math.abs(Hm[2][2]) > 1e-300) { var s = Hm[2][2]; Hm = Hm.map(function (r) { return r.map(function (v) { return v / s; }); }); }
    return { H: Hm, S: d.S, cond: d.S[0] / d.S[7], gap: d.S[7] / Math.max(d.S[8], 1e-300) };
  }
  // RMS distance, in pixels, between where H sends the chart corners and where they were seen.
  function transferRms(Hm, M, m) {
    var s = 0; for (var i = 0; i < M.length; i++) { var p = applyH(Hm, M[i][0], M[i][1]); s += Math.pow(p[0] - m[i][0], 2) + Math.pow(p[1] - m[i][1], 2); }
    return Math.sqrt(s / M.length);
  }
  // The homography a pinhole camera K at pose (R, t) induces on the chart: H = K [r1 r2 t] (Zhang eq. 2), scaled to H[2][2] = 1.
  function trueH(c, pose) {
    var Hm = mul(Kmat(c), [[pose.R[0][0], pose.R[0][1], pose.t[0]], [pose.R[1][0], pose.R[1][1], pose.t[1]], [pose.R[2][0], pose.R[2][1], pose.t[2]]]), s = Hm[2][2];
    return Hm.map(function (r) { return r.map(function (v) { return v / s; }); });
  }
  function hDiff(A, B) { var m = 0; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) m = Math.max(m, Math.abs(A[i][j] - B[i][j]) / Math.max(1e-12, Math.abs(B[i][j]))); return m; }

  /* ================= many photos: B = K⁻ᵀK⁻¹ and Zhang's closed form ================= */
  function vij(Hm, i, j) {
    var hi = [Hm[0][i], Hm[1][i], Hm[2][i]], hj = [Hm[0][j], Hm[1][j], Hm[2][j]];
    return [hi[0] * hj[0], hi[0] * hj[1] + hi[1] * hj[0], hi[1] * hj[1], hi[2] * hj[0] + hi[0] * hj[2], hi[2] * hj[1] + hi[1] * hj[2], hi[2] * hj[2]];
  }
  // Each homography gives two rows of V (eq. 8): v12ᵀ b = 0 and (v11 − v22)ᵀ b = 0.
  // The homographies are first expressed in pixel units divided by `scale` (K' = diag(1/s,1/s,1) K), which only
  // conditions the arithmetic; K is scaled back at the end.
  function stackV(Hs, o) {
    o = o || {}; var s = o.scale || 1, N = [[1 / s, 0, 0], [0, 1 / s, 0], [0, 0, 1]], V = [];
    Hs.forEach(function (H0) {
      var Hm = mul(N, H0), n1 = norm([Hm[0][0], Hm[1][0], Hm[2][0]]); Hm = Hm.map(function (r) { return r.map(function (v) { return v / n1; }); });
      var v12 = vij(Hm, 0, 1), v11 = vij(Hm, 0, 0), v22 = vij(Hm, 1, 1);
      V.push(v12); V.push(v11.map(function (v, k) { return v - v22[k]; }));
    });
    if (o.skewZero) V.push([0, 1, 0, 0, 0, 0].map(function (v) { return v * (o.skewWeight || 1); }));   // Zhang §3.1: γ = 0 for n = 2
    return V;
  }
  // Zhang App. B: the intrinsics from b = (B11, B12, B22, B13, B23, B33), defined up to scale.
  function kFromB(b) {
    if (b[0] < 0) b = b.map(function (v) { return -v; });
    var B11 = b[0], B12 = b[1], B22 = b[2], B13 = b[3], B23 = b[4], B33 = b[5], den = B11 * B22 - B12 * B12;
    if (!(B11 > 0) || !(den > 0)) return { ok: false, reason: "B is not positive definite: no real camera has this B" };
    var v0 = (B12 * B13 - B11 * B23) / den, lam = B33 - (B13 * B13 + v0 * (B12 * B13 - B11 * B23)) / B11;
    if (!(lam / B11 > 0)) return { ok: false, reason: "λ/B11 is negative: the focal length would be imaginary" };
    var alpha = Math.sqrt(lam / B11), beta = Math.sqrt(lam * B11 / den), gamma = -B12 * alpha * alpha * beta / lam, u0 = gamma * v0 / beta - B13 * alpha * alpha / lam;
    var c = { fx: alpha, fy: beta, skew: gamma, cx: u0, cy: v0, k1: 0, k2: 0 };
    if (![alpha, beta, gamma, u0, v0].every(isFinite)) return { ok: false, reason: "the numbers ran off to infinity" };
    return { ok: true, cam: c };
  }
  var VSCALE = 1000;
  // Zhang §3.1 end to end: one homography per photo, V b = 0 by SVD, K by App. B. Returns the six singular
  // values of V, the dimension of its (numerical) null space, and either a camera or the reason there isn't one.
  function zhangClosed(views, o) {
    o = o || {};
    var Hs = views.map(function (v) { return homography(PTS, v.pts, { normalize: true }).H; });
    var Vm = stackV(Hs, { scale: VSCALE, skewZero: o.skewZero }), d = svd(Vm), b = col(d.V, 5);
    var nullDim = 0; d.S.forEach(function (s) { if (s / d.S[0] < 1e-9) nullDim++; });
    var out = { Hs: Hs, S: d.S, rows: Vm.length, nullDim: nullDim, ratio: d.S[5] / d.S[4] };
    if (nullDim >= 2) { out.ok = false; out.reason = "V has " + nullDim + " zero singular values: " + (nullDim === 2 ? "a whole line" : "a " + nullDim + "-dimensional family") + " of B's fit, so there is no one answer"; return out; }
    var k = kFromB(b);
    if (!k.ok) { out.ok = false; out.reason = k.reason; return out; }
    var c = k.cam; c.fx *= VSCALE; c.fy *= VSCALE; c.cx *= VSCALE; c.cy *= VSCALE; c.skew *= VSCALE;
    out.ok = true; out.cam = c; out.poses = Hs.map(function (Hm) { return extrinsics(c, Hm); });
    return out;
  }
  // Zhang §3.1: r1 = λK⁻¹h1, r2 = λK⁻¹h2, r3 = r1 × r2, t = λK⁻¹h3, λ = 1/|K⁻¹h1|; then the nearest rotation (App. C).
  function extrinsics(c, Hm) {
    var Ki = inv3(Kmat(c)), h1 = mv(Ki, col(Hm, 0)), h2 = mv(Ki, col(Hm, 1)), h3 = mv(Ki, col(Hm, 2)), lam = 1 / norm(h1);
    if (h3[2] * lam < 0) lam = -lam;   // the chart is in front of the camera
    var r1 = h1.map(function (v) { return v * lam; }), r2 = h2.map(function (v) { return v * lam; }), r3 = cross(r1, r2), t = h3.map(function (v) { return v * lam; });
    var Q = [[r1[0], r2[0], r3[0]], [r1[1], r2[1], r3[1]], [r1[2], r2[2], r3[2]]];
    return { R: nearestRotation(Q), t: t, Q: Q };
  }

  /* ================= the lens dial: radial distortion by least squares (eq. 13) ================= */
  // With a pinhole estimate in hand: ideal pixels (u, v) from the pinhole, observed (ŭ, v̆); two equations per corner
  //   (u − u0)(x² + y²) k1 + (u − u0)(x² + y²)² k2 = ŭ − u   (and the same in v), stacked, solved as k = (DᵀD)⁻¹Dᵀd.
  function distortionLinear(c, poses, views) {
    var DtD = [[0, 0], [0, 0]], Dtd = [0, 0];
    views.forEach(function (v, i) {
      PTS.forEach(function (P, j) {
        var Xc = toCam(poses[i].R, poses[i].t, P[0], P[1]), x = Xc[0] / Xc[2], y = Xc[1] / Xc[2], r2 = x * x + y * y;
        var u = c.fx * x + (c.skew || 0) * y + c.cx, vv = c.fy * y + c.cy;
        [[(u - c.cx) * r2, (u - c.cx) * r2 * r2, v.pts[j][0] - u], [(vv - c.cy) * r2, (vv - c.cy) * r2 * r2, v.pts[j][1] - vv]].forEach(function (row) {
          DtD[0][0] += row[0] * row[0]; DtD[0][1] += row[0] * row[1]; DtD[1][1] += row[1] * row[1]; Dtd[0] += row[0] * row[2]; Dtd[1] += row[1] * row[2];
        });
      });
    });
    DtD[1][0] = DtD[0][1];
    var det = DtD[0][0] * DtD[1][1] - DtD[0][1] * DtD[1][0];
    return { k1: (DtD[1][1] * Dtd[0] - DtD[0][1] * Dtd[1]) / det, k2: (DtD[0][0] * Dtd[1] - DtD[1][0] * Dtd[0]) / det };
  }

  /* ================= reprojection error ================= */
  // RMS distance in pixels between seen corners and where the camera model puts them: OpenCV's calibrateCamera
  // return value, sqrt(Σ|e|² / number of corners), and Zhang's "RMS" row.
  function reprojection(c, poses, views) {
    var s = 0, n = 0, per = [], vecs = [];
    views.forEach(function (v, i) {
      var sv = 0, vv = [];
      PTS.forEach(function (P, j) { var p = project(c, poses[i], P[0], P[1]), e = p ? [v.pts[j][0] - p[0], v.pts[j][1] - p[1]] : [1e3, 1e3]; sv += e[0] * e[0] + e[1] * e[1]; vv.push(e); });
      s += sv; n += PTS.length; per.push(Math.sqrt(sv / PTS.length)); vecs.push(vv);
    });
    return { rms: Math.sqrt(s / n), perView: per, vecs: vecs };
  }

  /* ================= the refinement: Levenberg–Marquardt on eq. 14 ================= */
  // Parameters: [fx, fy, cx, cy, skew, k1, k2] then (rvec, t) for every photo. `fix` names intrinsics held still:
  // OpenCV holds the skew at 0 (it has no skew parameter); "dist" holds k1 = k2 = 0 (a pinhole-only model).
  var INAMES = ["fx", "fy", "cx", "cy", "skew", "k1", "k2"];
  function packParams(c, poses) { var p = INAMES.map(function (k) { return c[k] || 0; }); poses.forEach(function (ps) { p.push.apply(p, rotToVec(ps.R)); p.push.apply(p, ps.t); }); return p; }
  function unpackCam(p) { var c = {}; INAMES.forEach(function (k, i) { c[k] = p[i]; }); return c; }
  function unpackPose(p, i) { var o = 7 + 6 * i; return { R: rodrigues([p[o], p[o + 1], p[o + 2]]), t: [p[o + 3], p[o + 4], p[o + 5]] }; }
  function viewResiduals(c, pose, v, out, at) {
    for (var j = 0; j < PTS.length; j++) {
      var q = project(c, pose, PTS[j][0], PTS[j][1]);
      out[at + 2 * j] = q ? v.pts[j][0] - q[0] : 1e3; out[at + 2 * j + 1] = q ? v.pts[j][1] - q[1] : 1e3;
    }
  }
  function lm(views, init, o) {
    o = Object.assign({ fix: { skew: true }, iters: 60 }, o || {});
    var nv = views.length, NP = 7 + 6 * nv, NR = 2 * PTS.length, p = packParams(init.cam, init.poses);
    if (o.fix.dist) { p[5] = 0; p[6] = 0; }
    if (o.fix.skew) p[4] = 0;
    var free = INAMES.map(function (k) { return !(o.fix[k] || (o.fix.dist && (k === "k1" || k === "k2"))); });
    function residuals(pp) { var c = unpackCam(pp), r = new Array(NR * nv); for (var i = 0; i < nv; i++) viewResiduals(c, unpackPose(pp, i), views[i], r, NR * i); return r; }
    function cost(r) { var s = 0; for (var i = 0; i < r.length; i++) s += r[i] * r[i]; return s; }
    var r = residuals(p), E = cost(r), lambda = 1e-3, hist = [{ it: 0, rms: Math.sqrt(E / (nv * PTS.length)), cam: unpackCam(p), p: p.slice() }];
    for (var it = 1; it <= o.iters; it++) {
      // Jacobian of the residuals, block by block: intrinsics touch every photo, a pose only its own.
      var A = zeros(NP, NP), g = new Array(NP).fill(0), Ji = [], Je = [];
      var c0 = unpackCam(p);
      for (var i = 0; i < nv; i++) {
        var pose0 = unpackPose(p, i), cols = [], idx = [];
        for (var k = 0; k < 7; k++) if (free[k]) idx.push(k);
        for (k = 0; k < 6; k++) idx.push(7 + 6 * i + k);
        idx.forEach(function (q) {
          var h = 1e-6 * Math.max(1, Math.abs(p[q])), pp = p.slice(), pm = p.slice(); pp[q] += h; pm[q] -= h;
          var rp = new Array(NR), rm = new Array(NR);
          viewResiduals(unpackCam(pp), unpackPose(pp, i), views[i], rp, 0); viewResiduals(unpackCam(pm), unpackPose(pm, i), views[i], rm, 0);
          var cj = new Array(NR); for (var m = 0; m < NR; m++) cj[m] = -(rp[m] - rm[m]) / (2 * h);   // ∂(projection)/∂p = −∂r/∂p
          cols.push(cj);
        });
        for (var a = 0; a < idx.length; a++) {
          var ca = cols[a], sg = 0; for (var m = 0; m < NR; m++) sg += ca[m] * r[NR * i + m];
          g[idx[a]] += sg;
          for (var b2 = a; b2 < idx.length; b2++) { var cb = cols[b2], s = 0; for (m = 0; m < NR; m++) s += ca[m] * cb[m]; A[idx[a]][idx[b2]] += s; if (b2 !== a) A[idx[b2]][idx[a]] += s; }
        }
      }
      var improved = false;
      for (var tries = 0; tries < 12; tries++) {
        var Ad = A.map(function (row, q) { var rr = row.slice(); rr[q] = row[q] * (1 + lambda) + (row[q] === 0 ? 1 : 0); return rr; });
        var delta = cholSolve(Ad, g);
        if (!delta) { lambda *= 10; continue; }
        var pn = p.map(function (v, q) { return v + delta[q]; }), rn = residuals(pn), En = cost(rn);
        if (En < E) { var rel = (E - En) / E; p = pn; r = rn; E = En; lambda = Math.max(1e-9, lambda / 10); improved = true; hist.push({ it: it, rms: Math.sqrt(E / (nv * PTS.length)), cam: unpackCam(p), lambda: lambda, p: p.slice() }); break; }
        lambda *= 10;
      }
      if (!improved || rel < 1e-12) break;
    }
    var cam = unpackCam(p), poses = []; for (var i2 = 0; i2 < nv; i2++) poses.push(unpackPose(p, i2));
    return { cam: cam, poses: poses, rms: Math.sqrt(E / (nv * PTS.length)), hist: hist, iters: hist.length - 1 };
  }

  // The poses stored in a parameter vector (for showing any step of the refinement).
  function posesOf(p, n) { var out = []; for (var i = 0; i < n; i++) out.push(unpackPose(p, i)); return out; }

  /* ================= the whole exam ================= */
  // Zhang §3.4: closed form → distortion by least squares → refine everything. Each stage is returned so the
  // page can show the prescription card after every step. `model`: "full" (k1, k2 free) or "pinhole" (k1 = k2 = 0).
  function calibrate(views, o) {
    o = Object.assign({ model: "full", skewZero: false }, o || {});
    var cf = zhangClosed(views, { skewZero: o.skewZero || views.length < 3 });
    if (!cf.ok) return { ok: false, closed: cf, reason: cf.reason };
    var start = { cam: Object.assign({}, cf.cam), poses: cf.poses };
    var kd = o.model === "pinhole" ? { k1: 0, k2: 0 } : distortionLinear(cf.cam, cf.poses, views);
    var withDist = Object.assign({}, cf.cam, kd);
    var fix = { skew: o.fixSkew !== false };
    if (o.model === "pinhole") fix.dist = true;
    var ref = lm(views, { cam: withDist, poses: cf.poses }, { fix: fix, iters: o.iters || 60 });
    return { ok: true, closed: cf, linear: { cam: withDist, rms: reprojection(withDist, cf.poses, views).rms }, closedRms: reprojection(cf.cam, cf.poses, views).rms, refined: ref, cam: ref.cam, poses: ref.poses, rms: ref.rms };
  }
  // A held-out photo, judged with the intrinsics frozen: find its pose (homography, then LM on the 6 pose
  // numbers only) and report its reprojection RMS. This is how a calibration is tested on photos it never saw.
  function holdout(c, views) {
    var per = views.map(function (v) {
      var undist = v.pts.map(function (p) { var ray = pixelToRay(c, p[0], p[1]); return [c.fx * ray[0] + (c.skew || 0) * ray[1] + c.cx, c.fy * ray[1] + c.cy]; });
      var Hm = homography(PTS, undist, { normalize: true }).H, pose = extrinsics(c, Hm);
      var fix = { fx: true, fy: true, cx: true, cy: true, skew: true, k1: true, k2: true };
      var res = lm([v], { cam: c, poses: [pose] }, { fix: fix, iters: 40 });
      return res.rms;
    });
    var s = 0; per.forEach(function (x) { s += x * x; });
    return { rms: Math.sqrt(s / per.length), perView: per };
  }

  /* ================= what it costs: the error map and the head turn ================= */
  // For a grid of pixels: take the true camera's ray through the pixel, and ask where the estimated camera puts
  // that ray. The distance is how far off the estimate is there, in pixels. Only a lab knows the truth to do this.
  function mapError(est, truth, o) {
    o = o || {}; var nx = o.nx || 32, ny = o.ny || 18, g = [], s = 0, mx = 0, n = 0, corner = 0;
    truth = truth || TRUE_LENS;
    for (var j = 0; j < ny; j++) { var rowv = []; for (var i = 0; i < nx; i++) {
      var u = (i + 0.5) / nx * (W - 1), v = (j + 0.5) / ny * (H - 1), ray = pixelToRay(truth, u, v), q = projectCam(est, [ray[0], ray[1], 1]), e = q ? Math.hypot(q[0] - u, q[1] - v) : 999;
      rowv.push(e); s += e; n++; if (e > mx) mx = e;
    } g.push(rowv); }
    // the four corner cells of the frame
    corner = (g[0][0] + g[0][nx - 1] + g[ny - 1][0] + g[ny - 1][nx - 1]) / 4;
    return { grid: g, mean: s / n, max: mx, corner: corner, centre: g[Math.floor(ny / 2)][Math.floor(nx / 2)] };
  }
  // Microduck's detector works on the frame turned a quarter turn clockwise (720 × 1280, upright): upright pixel
  // (x', y') samples stream pixel (y', 719 − x') (uyvy/src/lib.rs, Turn::Right::source). Its bearing is
  // b = (box centre x' / 720)·2 − 1 (duck-detect/src/lib.rs). Left-right on the upright frame is the stream's
  // vertical axis, so fy and cy are the numbers that set a bearing's angle.
  var UP_W = 720, UP_H = 1280;
  function bearingPixel(b) { var xc = (b + 1) / 2 * UP_W, xp = xc - 0.5, yp = UP_H / 2 - 0.5; return { u: yp, v: (H - 1) - xp }; }
  // The angle to turn the head, in degrees, positive to the duck's right, relative to the camera's optical axis,
  // for a duck seen at bearing b in the middle of the upright frame, as camera model c reads it.
  function bearingAngle(c, b) { var px = bearingPixel(b), ray = pixelToRay(c, px.u, px.v); return Math.atan(-ray[1]) / DEG; }
  // Two simpler readings of a bearing Duck's-Eye View worked with, as camera models on the stream frame:
  //   nominal: mediad's design figures, f = 640/tan 31° = 1065.14 px on 1280 wide, principal point central, no
  //            distortion (mediad/src/camera.rs) — the model Duck's-Eye View called "calibrated";
  //   placeholder: Duck's-Eye View's guess at a placeholder, "62° across the 720-pixel upright width", f = 599.1 px.
  var NOMINAL = camera({ fx: 640 / Math.tan(31 * DEG), fy: 640 / Math.tan(31 * DEG), cx: (W - 1) / 2, cy: (H - 1) / 2 });
  var PLACEHOLDER = camera({ fx: 360 / Math.tan(31 * DEG), fy: 360 / Math.tan(31 * DEG), cx: (W - 1) / 2, cy: (H - 1) / 2 });
  function turnErrors(c, bs) { return (bs || [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]).map(function (b) { var tr = bearingAngle(TRUE_LENS, b), es = bearingAngle(c, b); return { b: b, truth: tr, est: es, err: es - tr }; }); }
  function worstTurn(c) { var m = 0, at = 0; for (var b = -1; b <= 1.0001; b += 0.02) { var e = bearingAngle(c, b) - bearingAngle(TRUE_LENS, b); if (Math.abs(e) > Math.abs(m)) { m = e; at = b; } } return { err: m, at: Math.round(at * 100) / 100 }; }
  // Sideways miss at distance d (m) for an angle error e (degrees).
  function missAt(errDeg, d) { return d * Math.tan(Math.abs(errDeg) * DEG); }

  /* ================= small helpers for the page ================= */
  function relErr(est, tru) { return (est - tru) / tru; }
  function camErrors(c, truth) { truth = truth || TRUE_LENS; return { fx: relErr(c.fx, truth.fx), fy: relErr(c.fy, truth.fy), cx: c.cx - truth.cx, cy: c.cy - truth.cy, skew: (c.skew || 0) - (truth.skew || 0), k1: (c.k1 || 0) - truth.k1, k2: (c.k2 || 0) - truth.k2 }; }
  // How far a straight row of chart corners bends: max distance of the middle corners from the chord through
  // the row's two ends, in pixels.
  function rowBend(pts, row) {
    var a = pts[row * CHART.cols], b = pts[row * CHART.cols + CHART.cols - 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), m = 0;
    for (var i = 1; i < CHART.cols - 1; i++) { var p = pts[row * CHART.cols + i], d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L; if (d > m) m = d; }
    return m;
  }

  /* ================= the lab's fixed experiments (the page and tests/check.js call these) ================= */
  // The second-opinion photos: 10 photos that cover the frame, never used to calibrate.
  var HOLD_SPEC = { n: 10, seed: 900, sigma: 0.25, region: "all" };
  var _hold = null;
  function holdSet() { if (!_hold) _hold = session(HOLD_SPEC); return _hold; }
  // Everything a lab can say about a calibration: what the optician sees (RMS), the second opinion (hold-out
  // RMS), and what only the answer key shows (error map, focal-length error, the worst head-turn error).
  function evaluate(cal) {
    if (!cal || !cal.ok) return { ok: false, reason: cal ? cal.reason : "no calibration" };
    var m = mapError(cal.cam), w = worstTurn(cal.cam);
    return { ok: true, rms: cal.rms, hold: holdout(cal.cam, holdSet()).rms, mapMean: m.mean, mapMax: m.max, corner: m.corner, fxErr: relErr(cal.cam.fx, TRUE_LENS.fx), turn: w.err, turnAt: w.at, map: m };
  }
  // Step 1: the same chart photographed N times with fresh noise, its corners numbered from an origin `offset` mm
  // away along both axes. Median and worst distance (px) between H's corners and the true, noise-free corners.
  function dltTrial(spec, offset, sigma, N) {
    var un = [], nz = [], cu = 0, cn = 0;
    for (var s = 1; s <= N; s++) {
      var ph = photo(spec, { lens: false, sigma: sigma, seed: s }); if (!ph) return null;
      var M = PTS.map(function (p) { return [p[0] + offset, p[1] + offset]; });
      var a = homography(M, ph.pts, { normalize: false }), b = homography(M, ph.pts, { normalize: true });
      un.push(transferRms(a.H, M, ph.ideal)); nz.push(transferRms(b.H, M, ph.ideal)); cu = a.cond; cn = b.cond;
    }
    function q(x) { x.sort(function (p, r) { return p - r; }); return { med: x[Math.floor(x.length / 2)], worst: x[x.length - 1] }; }
    return { un: q(un), nz: q(nz), condUn: cu, condNz: cn };
  }
  // Step 2: `trials` sessions of 3 photos tilted `tilt` degrees about random in-plane axes, σ px of noise, the
  // lens dial at 0. How many give no camera at all (or one more than 50% off in fx), and the typical error otherwise.
  // `start` lets the page run the same sessions in slices (sessions start … start + trials − 1); the counts add up.
  function flatTrial(tilt, trials, sigma, start) {
    var fail = 0, ef = 0, ok = 0, s0 = start || 1;
    for (var s = s0; s < s0 + trials; s++) {
      var r = rng(1000 + s), vs = [];
      for (var k = 0; k < 3; k++) { var p = photo({ tilt: tilt, axis: 360 * r(), spin: -30 + 60 * r(), at: [640 + 200 * (r() - 0.5), 360 + 120 * (r() - 0.5)], dist: 500 }, { lens: false, sigma: sigma, seed: s * 10 + k }); if (p) vs.push(p); }
      var z = zhangClosed(vs);
      if (!z.ok || Math.abs(z.cam.fx / TRUE_PIN.fx - 1) > 0.5) { fail++; continue; }
      ok++; ef += Math.abs(z.cam.fx / TRUE_PIN.fx - 1);
    }
    return { tilt: tilt, fail: fail, trials: trials, ok: ok, efSum: ef, fxErr: ok ? ef / ok : null };
  }
  // Step 3: the closed form alone on n lens-free photos, averaged over `seeds` sessions.
  function closedTrial(n, sigma, seeds) {
    var ef = 0, ep = 0, ok = 0;
    for (var s = 1; s <= seeds; s++) {
      var z = zhangClosed(session({ n: n, seed: 300 + s, sigma: sigma, lens: false }), { skewZero: n < 3 });
      if (!z.ok) continue; ok++;
      ef += Math.abs(z.cam.fx / TRUE_PIN.fx - 1); ep += Math.hypot(z.cam.cx - TRUE_PIN.cx, z.cam.cy - TRUE_PIN.cy);
    }
    return { n: n, fxErr: ok ? ef / ok : null, ppErr: ok ? ep / ok : null, ok: ok, seeds: seeds };
  }
  // The named sessions the page uses. `exam` is the main 12-photo session with Microduck's real lens.
  var SESSIONS = {
    exam: { n: 12, seed: 3, sigma: 0.25 },
    trial: { n: 20, seed: 7, sigma: 0.5, lens: false },
    flat: { n: 12, seed: 11, sigma: 0.25, tilt: [5, 15] },
    flat30: { n: 30, seed: 11, sigma: 0.25, tilt: [5, 15] },
    flatSharp: { n: 12, seed: 11, sigma: 0.1, tilt: [5, 15] },
    flatFixed: { n: 12, seed: 11, sigma: 0.25, tilt: [20, 50] },
    blind: { n: 12, seed: 22, sigma: 0.25, region: "centre", dist: [1200, 1600] },
    blind30: { n: 30, seed: 22, sigma: 0.25, region: "centre", dist: [1200, 1600] },
    blindSharp: { n: 12, seed: 22, sigma: 0.1, region: "centre", dist: [1200, 1600] },
    blindFixed: { n: 12, seed: 22, sigma: 0.25, region: "all" },
    straight: { n: 12, seed: 23, sigma: 0.25 },
    straight30: { n: 30, seed: 23, sigma: 0.25 }
  };
  // Calibrate with the lens dial held at 0, then keep the photos whose own error is in the better half and
  // solve again: the tempting fix that lowers the RMS without touching the cause.
  function dropWorstHalf(views, o) {
    var c = calibrate(views, o); if (!c.ok) return c;
    var per = reprojection(c.cam, c.poses, views).perView, keep = per.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, Math.ceil(views.length / 2)).map(function (x) { return views[x[1]]; });
    var c2 = calibrate(keep, o); c2.kept = keep.length; return c2;
  }
  // Step 6's session planner: the knobs a person controls in a real session.
  var TILTS = { flat: [0, 5], low: [5, 15], mid: [10, 20], good: [20, 50], steep: [50, 70] };
  function planSession(o) {
    var spec = { n: o.n || 12, seed: o.seed || 31, sigma: o.sigma == null ? 0.25 : o.sigma, tilt: TILTS[o.tilt || "good"], region: o.cover === "centre" ? "centre" : "all" };
    if (o.cover === "centre") spec.dist = [1200, 1600];
    return spec;
  }

  return {
    HOLD_SPEC: HOLD_SPEC, holdSet: holdSet, evaluate: evaluate, dltTrial: dltTrial, flatTrial: flatTrial, closedTrial: closedTrial, SESSIONS: SESSIONS, dropWorstHalf: dropWorstHalf, TILTS: TILTS, planSession: planSession,
    DEG: DEG, rng: rng, zeros: zeros, eye: eye, T: T, mul: mul, mv: mv, det3: det3, inv3: inv3, norm: norm, cross: cross, col: col,
    symEig: symEig, svd: svd, nullVec: nullVec, cholSolve: cholSolve,
    rodrigues: rodrigues, rotToVec: rotToVec, nearestRotation: nearestRotation, axisAngle: axisAngle,
    W: W, H: H, MICRODUCK: MICRODUCK, REPO_SOLVE: REPO_SOLVE, TRUE_LENS: TRUE_LENS, TRUE_PIN: TRUE_PIN, NOMINAL: NOMINAL, PLACEHOLDER: PLACEHOLDER, camera: camera, Kmat: Kmat,
    distortN: distortN, undistortN: undistortN, projectCam: projectCam, toCam: toCam, project: project, pixelToRay: pixelToRay,
    CHART: CHART, PTS: PTS, CHART_W: CHART_W, CHART_H: CHART_H, chartPoints: chartPoints,
    makePose: makePose, inFrame: inFrame, observe: observe, session: session, photo: photo,
    normT: normT, applyH: applyH, dltMatrix: dltMatrix, homography: homography, transferRms: transferRms, trueH: trueH, hDiff: hDiff,
    vij: vij, stackV: stackV, kFromB: kFromB, zhangClosed: zhangClosed, extrinsics: extrinsics, VSCALE: VSCALE,
    distortionLinear: distortionLinear, reprojection: reprojection, lm: lm, posesOf: posesOf, calibrate: calibrate, holdout: holdout,
    mapError: mapError, UP_W: UP_W, UP_H: UP_H, bearingPixel: bearingPixel, bearingAngle: bearingAngle, turnErrors: turnErrors, worstTurn: worstTurn, missAt: missAt,
    relErr: relErr, camErrors: camErrors, rowBend: rowBend, INAMES: INAMES
  };
});
