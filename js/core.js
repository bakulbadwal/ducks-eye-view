/* Duck's-Eye View — the math. Pure functions, exposed as window.DEV.core (and as a Node module for tests).
   Exact: the letterbox, decode and NMS (ported line for line from pollen-robotics/microduck
   duck-detect/src/lib.rs @ 590b986), IoU, precision/recall/AP, affine INT8 quantisation,
   convolution, the pinhole camera, stereo depth.
   Teaching models (labelled on the page): the synthetic room, and `detect`, a stand-in for the
   yolo11n head that fills the real [1, 5, 2100] output layout with synthesised scores. */
(function (root) {
  "use strict";

  /* ---------- seeded randomness: every demo is the same for every visitor ---------- */
  function rng(seed) {
    var s = seed >>> 0;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.normal = function () {
      var u = 0, v = 0;
      while (u === 0) u = f();
      while (v === 0) v = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return f;
  }
  var DEG = Math.PI / 180;
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  /* ================= The camera and the mount (Unit 1, Unit 8) =================
     Microduck's camera streams 1280×720 landscape (mediad/src/session.rs:242) and the detector
     turns it a quarter turn (Turn::Right) to 720×1280 portrait. The IMX219's ~62° is along its long
     axis (docs/ideas/autonomous_behavior.md:75), which the mount makes vertical. */
  var CAM = {
    streamW: 1280, streamH: 720,       // what the sensor mode delivers
    W: 720, H: 1280,                   // upright frame, after the quarter turn
    sensorW: 3280, sensorH: 2464,      // IMX219 active area (sensor spec, not from the repo)
    longFov: 62,                       // degrees across the sensor's full long axis
    input: 320,                        // the model's square input (npu-bringup.md)
    pad: 114,                          // ultralytics' letterbox grey (lib.rs:25)
    camHeight: 0.20,                   // metres above the floor: an assumption for the toy room
    strides: [8, 16, 32]
  };
  // Sensor modes, as a crop of the sensor in sensor pixels, scaled to 1280×720.
  var MODES = {
    full: { label: "full-width 16:9 crop", cropW: 3280, cropH: 1845 },   // the widest a 16:9 frame can be
    crop1080: { label: "1920×1080 centre crop (hypothetical)", cropW: 1920, cropH: 1080 }
  };
  // Field of view (degrees) of a crop along one sensor axis.
  function cropFov(cropPx) { return 2 * Math.atan(Math.tan(CAM.longFov / 2 * DEG) * cropPx / CAM.sensorW) / DEG; }
  // Intrinsics of the upright 720×1280 frame for a sensor mode. Square pixels: one focal length.
  function modeIntrinsics(modeKey) {
    var m = MODES[modeKey] || MODES.full;
    var fovV = cropFov(m.cropW), fovLR = cropFov(m.cropH);    // long axis is vertical after the turn
    var f = (CAM.H / 2) / Math.tan(fovV / 2 * DEG);
    return { mode: modeKey, fovLR: fovLR, fovV: fovV, f: f, cx: CAM.W / 2, cy: CAM.H / 2 };
  }
  // The widest left-right FOV any 16:9 mode can have: the short side of a full-width crop.
  function maxLrFov() { return cropFov(CAM.sensorW * 9 / 16); }
  function focalFromFov(widthPx, fovDeg) { return (widthPx / 2) / Math.tan(fovDeg / 2 * DEG); }
  function fovFromFocal(widthPx, f) { return 2 * Math.atan((widthPx / 2) / f) / DEG; }
  // Pinhole projection. Camera axes as in OpenCV: +X right, +Y down, +Z forward.
  function project(X, Y, Z, K) { return { u: K.cx + K.f * X / Z, v: K.cy + K.f * Y / Z }; }
  function pixelSize(sizeM, Z, f) { return f * sizeM / Z; }
  // Bearing from duck-detect: (box centre x ÷ frame width)·2 − 1 (lib.rs:45-52). Linear in pixels, not an angle.
  function bearing(box, frameW) { var c = (box[0] + box[2]) / 2; return (c / frameW) * 2 - 1; }
  // Pixel → angle needs the intrinsics: with the principal point at the centre, b·W/2 pixels off-axis.
  function bearingToAngle(b, fovLR) { return Math.atan(b * Math.tan(fovLR / 2 * DEG)) / DEG; }
  function angleToBearing(deg, fovLR) { return Math.tan(deg * DEG) / Math.tan(fovLR / 2 * DEG); }

  /* ================= The letterbox (Unit 1) — exact port of letterbox_rgb's geometry ================= */
  function letterboxFit(w, h, size) {
    var scale = Math.min(size / w, size / h);
    var fw = clamp(Math.round(w * scale), 1, size), fh = clamp(Math.round(h * scale), 1, size);
    return { scale: scale, fw: fw, fh: fh, padX: Math.floor((size - fw) / 2), padY: Math.floor((size - fh) / 2), size: size };
  }
  // Stretching (what the model was NOT trained on): separate x and y scales, no padding.
  function stretchFit(w, h, size) { return { sx: size / w, sy: size / h, size: size }; }
  // Frame pixel → model-input pixel, and back out (decode's `unpad`).
  function toInput(u, v, lb) { return lb.sx ? { x: u * lb.sx, y: v * lb.sy } : { x: u * lb.scale + lb.padX, y: v * lb.scale + lb.padY }; }
  function fromInput(x, y, lb) { return lb.sx ? { u: x / lb.sx, v: y / lb.sy } : { u: (x - lb.padX) / lb.scale, v: (y - lb.padY) / lb.scale }; }
  function boxToInput(b, lb) { var p = toInput(b[0], b[1], lb), q = toInput(b[2], b[3], lb); return [p.x, p.y, q.x, q.y]; }
  function boxFromInput(b, lb) { var p = fromInput(b[0], b[1], lb), q = fromInput(b[2], b[3], lb); return [p.u, p.v, q.u, q.v]; }
  // Nearest-neighbour letterbox of RGBA pixels (ImageData-like {data,width,height}) into a size×size RGB square.
  // Mirrors lib.rs:67-110: source index from the fitted size so rounding can't walk off the end.
  function letterboxPixels(src, size, opts) {
    opts = opts || {};
    var pad = opts.pad == null ? CAM.pad : opts.pad, bgr = opts.channel === "BGR", stretch = opts.fit === "stretch";
    var w = src.width, h = src.height, out = new Uint8ClampedArray(size * size * 4);
    for (var i = 0; i < size * size; i++) { out[i * 4] = pad; out[i * 4 + 1] = pad; out[i * 4 + 2] = pad; out[i * 4 + 3] = 255; }
    var fw, fh, px, py;
    if (stretch) { fw = size; fh = size; px = 0; py = 0; }
    else { var lb = letterboxFit(w, h, size); fw = lb.fw; fh = lb.fh; px = lb.padX; py = lb.padY; }
    for (var y = 0; y < fh; y++) {
      var sy = Math.floor(y * h / fh);
      for (var x = 0; x < fw; x++) {
        var sx = Math.floor(x * w / fw), s = (sy * w + sx) * 4, t = ((y + py) * size + (x + px)) * 4;
        out[t] = src.data[bgr ? s + 2 : s]; out[t + 1] = src.data[s + 1]; out[t + 2] = src.data[bgr ? s : s + 2]; out[t + 3] = 255;
      }
    }
    return { data: out, width: size, height: size };
  }

  /* ================= Convolution (Unit 2) ================= */
  function convOutSize(W, K, P, S) { return Math.floor((W - K + 2 * P) / S) + 1; }
  // 2D cross-correlation (what deep-learning libraries call convolution) on one channel.
  function conv2d(src, w, h, kernel, k, stride, pad) {
    stride = stride || 1; pad = pad || 0;
    var ow = convOutSize(w, k, pad, stride), oh = convOutSize(h, k, pad, stride), out = new Float32Array(Math.max(0, ow * oh));
    for (var oy = 0; oy < oh; oy++) for (var ox = 0; ox < ow; ox++) {
      var acc = 0;
      for (var ky = 0; ky < k; ky++) for (var kx = 0; kx < k; kx++) {
        var iy = oy * stride + ky - pad, ix = ox * stride + kx - pad;
        if (iy >= 0 && iy < h && ix >= 0 && ix < w) acc += src[iy * w + ix] * kernel[ky * k + kx];
      }
      out[oy * ow + ox] = acc;
    }
    return { out: out, w: ow, h: oh };
  }
  function toGray(img) {   // ITU-R BT.601 luma, 0–1
    var n = img.width * img.height, g = new Float32Array(n);
    for (var i = 0; i < n; i++) g[i] = (0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]) / 255;
    return g;
  }
  function convParams(cin, cout, k, bias) { return cin * cout * k * k + (bias ? cout : 0); }
  function separableParams(cin, cout, k, bias) { return cin * k * k + (bias ? cin : 0) + cin * cout + (bias ? cout : 0); }
  function convMults(cin, cout, k, ow, oh) { return cin * cout * k * k * ow * oh; }
  function separableMults(cin, cout, k, ow, oh) { return (cin * k * k + cin * cout) * ow * oh; }
  // Receptive field of a stack of layers [{k, s}]: r += (k − 1)·jump; jump *= s.
  function receptiveField(layers) { var r = 1, j = 1; layers.forEach(function (L) { r += (L.k - 1) * j; j *= L.s; }); return { r: r, jump: j }; }
  // YOLO's three detection grids at 320 px input: 40² + 20² + 10² = 2100 candidates.
  function yoloGrids(size, strides) {
    strides = strides || CAM.strides; var total = 0;
    var grids = strides.map(function (s) { var n = size / s; total += n * n; return { stride: s, n: n, cells: n * n }; });
    return { grids: grids, total: total };
  }
  // Cell i (0…total−1) → its grid, row, column, centre in input pixels.
  function cellInfo(i, size, strides) {
    strides = strides || CAM.strides; var off = 0;
    for (var g = 0; g < strides.length; g++) {
      var s = strides[g], n = size / s;
      if (i < off + n * n) { var j = i - off, r = Math.floor(j / n), c = j % n; return { grid: g, stride: s, row: r, col: c, x: (c + 0.5) * s, y: (r + 0.5) * s }; }
      off += n * n;
    }
    return null;
  }

  /* ================= Boxes: IoU, decode + NMS (Unit 6) — exact ports ================= */
  // lib.rs:279-288
  function iou(a, b) {
    var x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
    var overlap = Math.max(x1 - x0, 0) * Math.max(y1 - y0, 0);
    var area = function (r) { return Math.max(r[2] - r[0], 0) * Math.max(r[3] - r[1], 0); };
    var union = area(a) + area(b) - overlap;
    return union <= 0 ? 0 : overlap / union;
  }
  // lib.rs:237-277. `raw` is planar [5, N]: all cx, all cy, all w, all h, all score.
  // Returns kept detections in frame pixels; with opts.trace, also every candidate and why it was dropped.
  function decode(raw, lb, threshold, iouLimit, opts) {
    var N = raw.length / 5, found = [];
    for (var i = 0; i < N; i++) {
      var score = raw[4 * N + i];
      if (score < threshold) continue;
      var cx = raw[i], cy = raw[N + i], w = raw[2 * N + i], h = raw[3 * N + i];
      found.push({ score: score, cell: i, inBox: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], box: boxFromInput([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], lb) });
    }
    // Rust's sort_by is stable: equal scores keep grid order (matters once INT8 makes scores equal).
    found = found.map(function (d, k) { d._k = k; return d; }).sort(function (a, b) { return b.score - a.score || a._k - b._k; });
    var kept = [], trace = [];
    found.forEach(function (d) {
      var worst = null;
      for (var j = 0; j < kept.length; j++) { var o = iou(d.box, kept[j].box); if (o >= iouLimit) { worst = { by: j, iou: o }; break; } }
      if (!worst) kept.push(d);
      if (opts && opts.trace) trace.push({ d: d, kept: !worst, by: worst ? worst.by : null, iou: worst ? worst.iou : null });
    });
    return opts && opts.trace ? { kept: kept, candidates: found.length, trace: trace } : kept;
  }

  /* ================= Scoring a detector: precision, recall, AP (Unit 6) ================= */
  // frames: [{dets:[{score, box}], gts:[box]}]. Greedy match per frame, highest score first, IoU ≥ iouThr, each GT once.
  function prCurve(frames, iouThr) {
    iouThr = iouThr == null ? 0.5 : iouThr;
    var all = [], nGT = 0;
    frames.forEach(function (fr, fi) {
      nGT += fr.gts.length;
      fr.dets.forEach(function (d) { all.push({ score: d.score, box: d.box, fi: fi }); });
    });
    all.sort(function (a, b) { return b.score - a.score; });
    var used = frames.map(function (fr) { return fr.gts.map(function () { return false; }); });
    var tp = 0, fp = 0, pts = [];
    all.forEach(function (d) {
      var gts = frames[d.fi].gts, best = -1, bestIou = iouThr;
      gts.forEach(function (g, gi) { var o = iou(d.box, g); if (!used[d.fi][gi] && o >= bestIou) { best = gi; bestIou = o; } });
      if (best >= 0) { used[d.fi][best] = true; tp++; d.tp = true; } else { fp++; d.tp = false; }
      pts.push({ score: d.score, tp: d.tp, precision: tp / (tp + fp), recall: nGT ? tp / nGT : 0 });
    });
    return { pts: pts, nGT: nGT, tp: tp, fp: fp };
  }
  // All-point interpolated AP (VOC 2010+, the area under the precision envelope).
  function apAllPoint(pts) {
    var r = [0], p = [0];
    pts.forEach(function (q) { r.push(q.recall); p.push(q.precision); });
    r.push(r[r.length - 1]); p.push(0);
    for (var i = p.length - 2; i >= 0; i--) p[i] = Math.max(p[i], p[i + 1]);
    var ap = 0; for (var k = 1; k < r.length; k++) ap += (r[k] - r[k - 1]) * p[k];
    return ap;
  }
  // COCO-style 101-point interpolation.
  function ap101(pts) {
    var s = 0;
    for (var i = 0; i <= 100; i++) {
      var t = i / 100, best = 0;
      pts.forEach(function (q) { if (q.recall >= t - 1e-12 && q.precision > best) best = q.precision; });
      s += best;
    }
    return s / 101;
  }
  function precisionRecallAt(frames, threshold, iouThr) {
    var c = prCurve(frames.map(function (fr) { return { gts: fr.gts, dets: fr.dets.filter(function (d) { return d.score >= threshold; }) }; }), iouThr);
    return { precision: c.tp + c.fp ? c.tp / (c.tp + c.fp) : 1, recall: c.nGT ? c.tp / c.nGT : 0, tp: c.tp, fp: c.fp, fn: c.nGT - c.tp };
  }

  /* ================= INT8 (Unit 9) ================= */
  // Affine (asymmetric) quantisation to `bits` unsigned or signed integers: q = round(x / scale) + zeroPoint.
  function qParams(min, max, bits, signed) {
    bits = bits || 8; min = Math.min(min, 0); max = Math.max(max, 0);   // the range must contain 0
    var qmin = signed ? -(1 << (bits - 1)) : 0, qmax = signed ? (1 << (bits - 1)) - 1 : (1 << bits) - 1;
    var scale = (max - min) / (qmax - qmin) || 1;
    var zp = clamp(Math.round(qmin - min / scale), qmin, qmax);
    return { scale: scale, zeroPoint: zp, qmin: qmin, qmax: qmax, min: min, max: max };
  }
  function quantize(x, qp) { return clamp(Math.round(x / qp.scale) + qp.zeroPoint, qp.qmin, qp.qmax); }
  function dequantize(q, qp) { return (q - qp.zeroPoint) * qp.scale; }
  function fakeQuant(x, qp) { return dequantize(quantize(x, qp), qp); }
  // Quantise a whole planar [5, N] head output with ONE scale (per-tensor), or one per row (per-channel).
  function quantizeHead(raw, perChannel, bits) {
    var N = raw.length / 5, out = new Float32Array(raw.length), params = [];
    function range(a, b) { var lo = Infinity, hi = -Infinity; for (var i = a; i < b; i++) { if (raw[i] < lo) lo = raw[i]; if (raw[i] > hi) hi = raw[i]; } return [lo, hi]; }
    if (!perChannel) {
      var r = range(0, raw.length), qp = qParams(r[0], r[1], bits || 8, true); params.push(qp);
      for (var i = 0; i < raw.length; i++) out[i] = fakeQuant(raw[i], qp);
    } else {
      for (var c = 0; c < 5; c++) {
        var rc = range(c * N, (c + 1) * N), q = qParams(rc[0], rc[1], bits || 8, true); params.push(q);
        for (var j = c * N; j < (c + 1) * N; j++) out[j] = fakeQuant(raw[j], q);
      }
    }
    return { raw: out, params: params };
  }
  function modelBytes(params, bytesPerParam) { return params * bytesPerParam; }

  /* ================= Depth (Unit 8) ================= */
  function stereoDepth(f, B, d) { return f * B / d; }
  function stereoDisparity(f, B, Z) { return f * B / Z; }
  // First-order depth error for a disparity error of dd pixels: |dZ| ≈ Z² · dd / (f·B).
  function stereoError(f, B, Z, dd) { return Z * Z * (dd == null ? 1 : dd) / (f * B); }

  /* ================= The toy room (teaching model) =================
     Objects stand on the floor at (x metres right, z metres ahead). Their boxes come from the
     pinhole model, so the picture and the ground truth always agree. */
  var KINDS = {
    microduck: { w: 0.20, h: 0.25, label: "another Microduck", isDuck: true },
    rubber: { w: 0.11, h: 0.10, label: "a rubber duck (hard negative)", isDuck: false },
    print: { w: 0.30, h: 0.30, label: "a white duck print on the wall (hard negative)", isDuck: false, onWall: true, lift: 0.35 }
  };
  var WALL_Z = 5;
  function objectBox(o, K) {
    var k = KINDS[o.kind], z = k.onWall ? WALL_Z : o.z, hc = CAM.camHeight;
    var bottomY = k.onWall ? hc - (k.lift) : hc, topY = bottomY - k.h;   // camera frame: +Y down, floor at +hc
    var u0 = K.cx + K.f * (o.x - k.w / 2) / z, u1 = K.cx + K.f * (o.x + k.w / 2) / z;
    return [u0, K.cy + K.f * topY / z, u1, K.cy + K.f * bottomY / z];
  }
  function inFrame(b) { return b[2] > 0 && b[0] < CAM.W && b[3] > 0 && b[1] < CAM.H; }
  function sceneGTs(scene, K) {
    return scene.objects.map(function (o) { return { kind: o.kind, box: objectBox(o, K), isDuck: KINDS[o.kind].isDuck }; })
      .filter(function (g) { return inFrame(g.box); });
  }
  // A recording session: n frames with seeded placements.
  function makeSession(seed, n, K) {
    var R = rng(seed), frames = [];
    K = K || modeIntrinsics("full");
    var half = Math.tan(K.fovLR / 2 * DEG) * 0.85;
    for (var i = 0; i < n; i++) {
      var objs = [];
      if (R() < 0.8) { var z = 0.7 + R() * 3.3; objs.push({ kind: "microduck", z: z, x: (R() * 2 - 1) * half * z }); }
      if (R() < 0.45) { var z2 = 0.6 + R() * 2.4; objs.push({ kind: "rubber", z: z2, x: (R() * 2 - 1) * half * z2 }); }
      if (R() < 0.35) objs.push({ kind: "print", z: WALL_Z, x: (R() * 2 - 1) * half * WALL_Z * 0.8 });
      frames.push({ id: i, seed: (seed * 7919 + i * 104729) >>> 0, objects: objs });
    }
    return frames;
  }

  /* ================= The teaching detector =================
     NOT yolo11n. It fills the real output layout — [1, 5, 2100], planar, three grids — with
     synthesised candidates: cells near an object, on the grid whose stride suits its size, fire; the
     score falls with distance in cells; look-alikes fire weaker. It reacts to pre-processing
     mismatches the way the real code warns ("quietly worse"). */
  var LOOKS = { microduck: 4.4, rubber: 0.6, print: -0.4 };
  function detect(scene, K, opts) {
    opts = opts || {};
    var pre = opts.pre || {}, size = CAM.input, R = rng(scene.seed || 1);
    var lb = pre.fit === "stretch" ? stretchFit(CAM.W, CAM.H, size) : letterboxFit(CAM.W, CAM.H, size);
    var mismatch = (pre.channel === "BGR" ? 3.4 : 0) + (pre.fit === "stretch" ? 2.4 : 0) + (pre.pad != null && pre.pad !== CAM.pad ? 1.3 : 0);
    // Each object gets a seeded "how hard is this one" offset: lighting, pose, motion blur.
    var Ro = rng((scene.seed || 1) ^ 0x5bd1e995);
    var gts = sceneGTs(scene, K).map(function (g) { g.inBox = boxToInput(g.box, lb); g.hard = Ro.normal() * (g.isDuck ? 1.3 : 1.5); return g; });
    var grids = yoloGrids(size), N = grids.total, raw = new Float32Array(5 * N);
    for (var i = 0; i < N; i++) {
      var c = cellInfo(i, size), best = -8 + R.normal() * 0.6, bb = null;
      gts.forEach(function (g) {
        var b = g.inBox, ox = (b[0] + b[2]) / 2, oy = (b[1] + b[3]) / 2, bw = b[2] - b[0], bh = b[3] - b[1];
        var s = Math.sqrt(Math.max(bw * bh, 1)), d2 = ((c.x - ox) * (c.x - ox) + (c.y - oy) * (c.y - oy)) / (c.stride * c.stride);
        var m = Math.log(s / c.stride / 3) / Math.LN2;
        var tiny = Math.max(0, 1 - s / 16);                         // small, far objects are harder
        var logit = LOOKS[g.kind] + g.hard - (g.isDuck ? mismatch : 0) - 1.5 * d2 - 1.6 * m * m - 4 * tiny;
        if (logit > best) { best = logit; bb = { ox: ox, oy: oy, bw: bw, bh: bh, d: Math.sqrt(d2), st: c.stride }; }
      });
      var score = sigmoid(best + R.normal() * 0.35), cx, cy, w, h;
      if (bb) {
        var jit = 0.6 + 0.35 * bb.d * bb.st / 8;
        cx = bb.ox + R.normal() * jit; cy = bb.oy + R.normal() * jit;
        w = bb.bw * (1 + R.normal() * 0.06); h = bb.bh * (1 + R.normal() * 0.06);
      } else {   // background slots still carry a box: whatever the head guesses for that cell
        cx = c.x + R.normal() * 2; cy = c.y + R.normal() * 2; w = c.stride * (1.5 + R()); h = c.stride * (1.5 + R());
      }
      raw[i] = cx; raw[N + i] = cy; raw[2 * N + i] = w; raw[3 * N + i] = h; raw[4 * N + i] = score;
    }
    return { raw: raw, lb: lb, gts: gts, N: N };
  }
  // Run the detector + decode over a session and shape it for prCurve. Only real ducks count as ground truth.
  function evalSession(frames, K, opts) {
    opts = opts || {};
    return frames.map(function (sc) {
      var d = detect(sc, K, opts), raw = opts.quant ? quantizeHead(d.raw, opts.quant === "per-channel").raw : d.raw;
      var dets = decode(raw, opts.decodeLb || d.lb, opts.floor == null ? 0.01 : opts.floor, opts.iou == null ? 0.5 : opts.iou);
      return { gts: d.gts.filter(function (g) { return g.isDuck; }).map(function (g) { return g.box; }), dets: dets, all: d.gts };
    });
  }

  /* ================= Deployment toys (Unit 9, teaching models) ================= */
  // Board temperature vs looks per second. Anchors: flat out (~16.7 looks/s at ~60 ms each) reaches
  // 95 °C and throttles the CPU to 408 MHz (deploy/robotd.toml [detect]). The curve between is a toy.
  var THERMAL = { idle: 55, flatOut: 95, flatHz: 1000 / 60, throttleAt: 90, exp: 0.8 };
  function boardTemp(hz) { return THERMAL.idle + (THERMAL.flatOut - THERMAL.idle) * Math.pow(clamp(hz / THERMAL.flatHz, 0, 1), THERMAL.exp); }
  function throttled(hz) { return boardTemp(hz) >= THERMAL.throttleAt; }

  var core = {
    rng: rng, clamp: clamp, sigmoid: sigmoid, DEG: DEG, CAM: CAM, MODES: MODES, KINDS: KINDS, WALL_Z: WALL_Z, THERMAL: THERMAL,
    cropFov: cropFov, modeIntrinsics: modeIntrinsics, maxLrFov: maxLrFov, focalFromFov: focalFromFov, fovFromFocal: fovFromFocal,
    project: project, pixelSize: pixelSize, bearing: bearing, bearingToAngle: bearingToAngle, angleToBearing: angleToBearing,
    letterboxFit: letterboxFit, stretchFit: stretchFit, toInput: toInput, fromInput: fromInput, boxToInput: boxToInput, boxFromInput: boxFromInput, letterboxPixels: letterboxPixels,
    convOutSize: convOutSize, conv2d: conv2d, toGray: toGray, convParams: convParams, separableParams: separableParams, convMults: convMults, separableMults: separableMults,
    receptiveField: receptiveField, yoloGrids: yoloGrids, cellInfo: cellInfo,
    iou: iou, decode: decode, prCurve: prCurve, apAllPoint: apAllPoint, ap101: ap101, precisionRecallAt: precisionRecallAt,
    qParams: qParams, quantize: quantize, dequantize: dequantize, fakeQuant: fakeQuant, quantizeHead: quantizeHead, modelBytes: modelBytes,
    stereoDepth: stereoDepth, stereoDisparity: stereoDisparity, stereoError: stereoError,
    objectBox: objectBox, sceneGTs: sceneGTs, makeSession: makeSession, detect: detect, evalSession: evalSession,
    boardTemp: boardTemp, throttled: throttled
  };
  root.DEV = root.DEV || {};
  root.DEV.core = core;
  if (typeof module !== "undefined" && module.exports) module.exports = core;
})(typeof window !== "undefined" ? window : globalThis);
