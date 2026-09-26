/* Duck's-Eye View — step 3 · The Box Desk.
   Unit 6 + Unit 2's YOLO page: 2,100 candidates, the planar tensor, threshold, greedy NMS, IoU by hand,
   precision/recall/AP on a held-out session, and how to read the tensor right.
   decode/NMS/IoU/AP are exact ports (core.js); the scores come from the teaching detector. */
Object.assign(window.DEV_GLOSSARY, {
  planar: ["Planar layout", "The head's output is [1, 5, 2100]: five rows of 2,100 numbers (all cx, then all cy, all w, all h, all scores), not 2,100 records of five. Candidate i lives at raw[k·2100 + i].", "Five long shelves of notes, not one note per pigeonhole with five lines on it."],
  threshold: ["Confidence threshold", "The score a candidate needs before it is considered at all. Raise it: fewer false alarms, more misses. Microduck's is 0.35.", "The gate a sticky note must pass to reach the shredder clerk."],
  precision: ["Precision", "Of the boxes the detector reported, the fraction that were right: TP ÷ (TP + FP).", "Of the notes that left the desk, how many were about a real duck."],
  recall: ["Recall", "Of the real objects, the fraction the detector found: TP ÷ (TP + FN).", "Of the real ducks, how many got a note."],
  tp: ["TP · FP · FN", "True positive: a reported box that overlaps a not-yet-matched true box by IoU ≥ 0.5. False positive: a reported box that doesn't (a look-alike, or a second box on the same duck). False negative: a true box nobody matched.", "A note on a duck · a note on a rubber duck · a duck with no note."],
  prcurve: ["Precision–recall curve", "Sweep the threshold from strict to loose and plot precision against recall at every setting. AP is the area under it, after making precision non-increasing.", "The inspector's chart: every gate setting, one dot."],
  ap: ["AP50 · AP101", "Average precision counting a box right at IoU ≥ 0.5. All-point AP integrates the exact envelope (VOC 2010+); AP101 samples it at 101 recall points (COCO). One class, so mAP50 = AP50.", "The inspector's final grade."],
  heldout: ["Held-out session", "Test frames from a recording the model never trained on. Frames from one session are near-copies of each other, so a random frame split would test memory, not sight.", "Grading the clerks on a day they never practised."],
  hardneg: ["Hard negative", "A look-alike labelled “not a duck” (rubber ducks, white duck prints). They train precision, and a held-out score can hide their cost.", "Decoys planted to catch a sloppy clerk."],
  decode: ["decode", "duck-detect's function that turns the raw tensor into boxes: read planar, drop scores under the threshold, undo the letterbox, sort, greedy NMS. Ported line for line from lib.rs.", "Everything on the box desk after the pigeonholes: gate, sort, shredder, un-mount."],
  segmentation: ["Segmentation", "Labelling every pixel instead of drawing boxes. Semantic: one label per kind. Instance: one mask per object. Panoptic: both. Microduck does none of it.", "Colouring the duck in instead of boxing it."]
});
DEV.navIcon("s3", "s3note");

DEV.step("s3", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, C = ui.C, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), SIZE = core.CAM.input, LB = core.letterboxFit(core.CAM.W, core.CAM.H, SIZE);
  var GRIDS = core.yoloGrids(SIZE).grids, N = core.yoloGrids(SIZE).total;
  var st = ui.store.s.s3 = ui.store.s.s3 || {};
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function touch() { ui.touch("s3"); }
  function r1(v) { return fmt(v, 1); }
  // ui.ctxFor overwrites the height attribute with the device-pixel height; restore the CSS height first.
  function ctx(id, h) { $(id).setAttribute("height", h); return ui.ctxFor(id); }

  /* the frame every desk widget works on: one duck straight ahead, z metres away.
     Seed 15 is the one where a duck at 3 m draws exactly 20 notes ≥ 0.35 (checked in node). */
  var cache = {};
  function run(z) {
    var key = String(z);
    if (!cache[key]) { var scene = { seed: 15, objects: [{ kind: "microduck", x: 0, z: z }] }, d = core.detect(scene, K, {}); cache[key] = { scene: scene, d: d, img: core.letterboxPixels(ui.roomImage(scene, K, 0.5), SIZE, {}) }; }
    return cache[key];
  }
  function drawInput(canvasId, ovId, z) { var r = run(z); ui.putImage($(canvasId), r.img); var ov = $(ovId); ov.width = SIZE; ov.height = SIZE; return r; }
  // A ×3 crop of the input around the duck, so twenty small notes are legible. Returns the run and a context
  // on the overlay whose transform is in input-pixel coordinates.
  var ZOOM = 3, CROP = 100;
  function drawZoom(canvasId, ovId, z) {
    var r = run(z);
    if (!r.cv) { r.cv = document.createElement("canvas"); ui.putImage(r.cv, r.img); }
    var gt = r.d.gts[0], cx = gt ? (gt.inBox[0] + gt.inBox[2]) / 2 : SIZE / 2, cy = gt ? (gt.inBox[1] + gt.inBox[3]) / 2 : SIZE / 2;
    var x0 = core.clamp(Math.round(cx - CROP / 2), 0, SIZE - CROP), y0 = core.clamp(Math.round(cy - CROP / 2), 0, SIZE - CROP);
    var base = $(canvasId); base.width = CROP * ZOOM; base.height = CROP * ZOOM;
    var bx = base.getContext("2d"); bx.imageSmoothingEnabled = false; bx.drawImage(r.cv, x0, y0, CROP, CROP, 0, 0, CROP * ZOOM, CROP * ZOOM);
    var ov = $(ovId); ov.width = CROP * ZOOM; ov.height = CROP * ZOOM;
    var x = ov.getContext("2d"); x.setTransform(ZOOM, 0, 0, ZOOM, -x0 * ZOOM, -y0 * ZOOM);
    return { r: r, x: x, x0: x0, y0: y0 };
  }
  function inBoxOf(raw, i) { var cx = raw[i], cy = raw[N + i], w = raw[2 * N + i], h = raw[3 * N + i]; return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]; }
  function gridOffset(g) { var off = 0; for (var q = 0; q < g; q++) off += GRIDS[q].cells; return off; }
  function bindTap(frameId, canvasId, fn) {
    var f = $(frameId), cv = $(canvasId);
    f.addEventListener("pointerdown", function (e) { var rc = cv.getBoundingClientRect(); fn((e.clientX - rc.left) / rc.width, (e.clientY - rc.top) / rc.height); e.preventDefault(); });
  }
  function boxStr(b, d) { return "[" + b.map(function (v) { return fmt(v, d == null ? 0 : d); }).join(", ") + "]"; }
  var zShared = 3;

  /* ================= Widget 1 · The pigeonholes ================= */
  var w1 = { grid: 0, thr: 0.35, cell: null };
  function w1render() {
    var r = drawInput("s3pin", "s3pov", zShared), raw = r.d.raw, x = $("s3pov").getContext("2d");
    var g = GRIDS[w1.grid], off = gridOffset(w1.grid), s = g.stride, counts = [0, 0, 0], top = -1, topIn = -1;
    for (var i = 0; i < N; i++) { var sc = raw[4 * N + i]; if (sc >= w1.thr) counts[core.cellInfo(i, SIZE).grid]++; if (top < 0 || sc > raw[4 * N + top]) top = i; if (i >= off && i < off + g.cells && (topIn < 0 || sc > raw[4 * N + topIn])) topIn = i; }
    for (var rr = 0; rr < g.n; rr++) for (var cc = 0; cc < g.n; cc++) {
      var j = off + rr * g.n + cc, sj = raw[4 * N + j];
      x.fillStyle = "rgba(200,69,47," + (0.9 * sj).toFixed(3) + ")"; x.fillRect(cc * s, rr * s, s, s);
      if (sj >= w1.thr) { x.strokeStyle = "#F4C430"; x.lineWidth = 1.5; x.strokeRect(cc * s + 0.75, rr * s + 0.75, s - 1.5, s - 1.5); }
    }
    x.strokeStyle = "rgba(255,253,246,.35)"; x.lineWidth = 1;
    for (var q = 0; q <= SIZE; q += s) { x.beginPath(); x.moveTo(q + 0.5, 0); x.lineTo(q + 0.5, SIZE); x.stroke(); x.beginPath(); x.moveTo(0, q + 0.5); x.lineTo(SIZE, q + 0.5); x.stroke(); }
    var gt = r.d.gts[0];
    if (gt) { x.setLineDash([5, 3]); x.strokeStyle = "#FFFDF6"; x.lineWidth = 2; x.strokeRect(gt.inBox[0], gt.inBox[1], gt.inBox[2] - gt.inBox[0], gt.inBox[3] - gt.inBox[1]); x.setLineDash([]); }
    if (w1.cell == null || core.cellInfo(w1.cell, SIZE).grid !== w1.grid) w1.cell = topIn;
    var ci = core.cellInfo(w1.cell, SIZE), b = inBoxOf(raw, w1.cell), sco = raw[4 * N + w1.cell];
    x.strokeStyle = "#1F6F74"; x.lineWidth = 2.5; x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    x.strokeStyle = "#4A2E1E"; x.lineWidth = 2.5; x.strokeRect(ci.col * s + 1.25, ci.row * s + 1.25, s - 2.5, s - 2.5); x.strokeStyle = "#FFE27A"; x.lineWidth = 1; x.strokeRect(ci.col * s + 2.5, ci.row * s + 2.5, s - 5, s - 5);
    var kept = core.decode(raw, r.d.lb, w1.thr, 0.5), total = counts[0] + counts[1] + counts[2];
    $("s3pstat").innerHTML = '<div class="stat"><div class="v">' + counts[w1.grid] + '</div><div class="l">notes ≥ ' + fmt(w1.thr, 2) + " on this floor (" + g.n + "×" + g.n + ')</div></div><div class="stat"><div class="v acc">' + total + '</div><div class="l">notes ≥ ' + fmt(w1.thr, 2) + ' on all three floors (' + counts.join(" · ") + ')</div></div><div class="stat"><div class="v good">' + kept.length + '</div><div class="l">left after the shredder (IoU 0.5)</div></div>';
    var fb = core.boxFromInput(b, r.d.lb), pass = sco >= w1.thr;
    $("s3note").innerHTML = '<div class="nt"><b>Pigeonhole #' + w1.cell + "</b> · the " + g.n + "×" + g.n + " floor (stride " + s + "), row " + ci.row + ", col " + ci.col + ", centre (" + ci.x + ", " + ci.y + ") px" +
      '<table><tr><td>cx</td><td>raw[' + w1.cell + "]</td><td>" + r1(raw[w1.cell]) + "</td></tr><tr><td>cy</td><td>raw[" + N + " + " + w1.cell + "]</td><td>" + r1(raw[N + w1.cell]) + "</td></tr><tr><td>w</td><td>raw[" + 2 * N + " + " + w1.cell + "]</td><td>" + r1(raw[2 * N + w1.cell]) + "</td></tr><tr><td>h</td><td>raw[" + 3 * N + " + " + w1.cell + "]</td><td>" + r1(raw[3 * N + w1.cell]) + "</td></tr><tr><td>score</td><td>raw[" + 4 * N + " + " + w1.cell + "]</td><td><b>" + fmt(sco, 3) + "</b></td></tr></table>" +
      "box in the 320 input " + boxStr(b) + " → in the frame " + boxStr(fb) + '<br><span class="chip ' + (pass ? "good" : "bad") + '">' + (pass ? "passes the " + fmt(w1.thr, 2) + " gate" : "below the " + fmt(w1.thr, 2) + " gate: never reaches the shredder") + "</span></div>";
    $("s3pcap").innerHTML = "Heat = each pigeonhole's score on the <b>" + g.n + "×" + g.n + "</b> floor; gold outline = passes the gate. Dashed white = the true duck box (" + r1(gt.inBox[3] - gt.inBox[1]) + " px tall here). Teal = the note in the tapped hole.";
  }
  function initW1() {
    ui.seg("s3pg", [{ v: 0, label: "40×40 · stride 8" }, { v: 1, label: "20×20 · stride 16" }, { v: 2, label: "10×10 · stride 32" }], 0, function (v) { w1.grid = +v; w1render(); touch(); });
    ui.range("s3pthr", function () { w1.thr = +$("s3pthr").value; $("s3pthrv").textContent = fmt(w1.thr, 2); w1render(); touch(); });
    $("s3pthrv").textContent = fmt(w1.thr, 2);
    ui.range("s3pz", function () { zShared = +$("s3pz").value; $("s3pzv").textContent = fmt(zShared, 2) + " m"; w1.cell = null; w1render(); w2compute(); w2render(); w5.i = null; w5render(); touch(); });
    $("s3pzv").textContent = fmt(zShared, 2) + " m";
    bindTap("s3pf", "s3pin", function (u, v) { var g = GRIDS[w1.grid], col = core.clamp(Math.floor(u * g.n), 0, g.n - 1), row = core.clamp(Math.floor(v * g.n), 0, g.n - 1); w1.cell = gridOffset(w1.grid) + row * g.n + col; w1render(); touch(); });
    $("s3pcite").innerHTML = "<b>On the robot.</b> " + MD.facts.candidates.v + " (" + MD.cite("candidates") + "); " + MD.facts.threshold.v + " (" + MD.cite("threshold") + "). The 40/20/10 split is the standard anchor-free YOLOv8/11 head at 320 px (our inference; the code states only the total).";
  }

  /* ================= Widget 2 · The shredder ================= */
  var w2 = { thr: 0.35, lim: 0.5, step: 0, tr: null, anim: null };
  function w2compute() { var r = run(zShared); w2.tr = core.decode(r.d.raw, r.d.lb, w2.thr, w2.lim, { trace: true }); w2.step = 0; }
  function w2render() {
    var Z = drawZoom("s3sin", "s3sov", zShared), r = Z.r, x = Z.x, T = w2.tr, n = T.trace.length, keptSoFar = 0, shred = 0, keptIdx = [];
    T.trace.forEach(function (t, k) { if (k < w2.step) { if (t.kept) { keptSoFar++; keptIdx[k] = keptSoFar; } else shred++; } });
    T.trace.forEach(function (t, k) {
      var b = t.d.inBox;
      if (k >= w2.step) { x.setLineDash([]); x.strokeStyle = "rgba(255,253,246,.8)"; x.lineWidth = 0.5; }
      else if (t.kept) { x.setLineDash([]); x.strokeStyle = "#5FA03C"; x.lineWidth = 1; }
      else { x.setLineDash([1.5, 1]); x.strokeStyle = "rgba(200,69,47,.85)"; x.lineWidth = 0.5; }
      x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    });
    if (w2.step > 0) { var cb = T.trace[w2.step - 1].d.inBox; x.setLineDash([]); x.strokeStyle = "#F4C430"; x.lineWidth = 1.2; x.strokeRect(cb[0], cb[1], cb[2] - cb[0], cb[3] - cb[1]); }
    x.setLineDash([]);
    $("s3sstat").innerHTML = '<div class="stat"><div class="v">' + n + '</div><div class="l">past the gate</div></div><div class="stat"><div class="v good">' + keptSoFar + '</div><div class="l">kept</div></div><div class="stat"><div class="v bad">' + shred + '</div><div class="l">shredded</div></div>';
    $("s3list").innerHTML = T.trace.map(function (t, k) {
      var cls = k < w2.step ? (t.kept ? "keep" : "shred") : k === w2.step ? "next" : "wait";
      var txt = k < w2.step ? (t.kept ? "kept · box #" + keptIdx[k] : "shredded · IoU " + fmt(t.iou, 2) + " with kept #" + (t.by + 1)) : k === w2.step ? "next up" : "waiting";
      return '<div class="ln ' + cls + '"><span class="rk">' + (k + 1) + '</span><span class="sc">score ' + fmt(t.d.score, 3) + '</span><span class="cell">hole #' + t.d.cell + '</span><span class="tx">' + txt + "</span></div>";
    }).join("") || '<div class="ln wait" style="grid-template-columns:1fr"><span class="tx">No note passes the gate at this threshold.</span></div>';
    var m;
    if (n === 0) m = '<div class="eq">nothing to shred</div><div class="eqn">Lower the gate.</div>';
    else if (w2.step === 0) m = '<div class="eq">sort by score, highest first</div><div class="eqn">Top note: score <b>' + fmt(T.trace[0].d.score, 3) + "</b> from hole #" + T.trace[0].d.cell + ". Nothing is kept yet, so it cannot overlap anything. Press <b>Next note</b>.</div>";
    else {
      var t = T.trace[w2.step - 1];
      m = '<div class="eq">keep it only if IoU with EVERY kept box &lt; ' + fmt(w2.lim, 2) + '</div><div class="eqn">Note ' + w2.step + " (score " + fmt(t.d.score, 3) + "): " + (t.kept ? (keptSoFar > 1 ? "overlaps each of the " + (keptSoFar - 1) + " kept box" + (keptSoFar > 2 ? "es" : "") + " by less than " + fmt(w2.lim, 2) : "first in line") + ' → <b class="ok">keep</b> (box #' + keptIdx[w2.step - 1] + ")" : "IoU with kept #" + (t.by + 1) + " = <b>" + fmt(t.iou, 3) + "</b> ≥ " + fmt(w2.lim, 2) + ' → <b class="bad">shred</b>') + "</div>";
    }
    $("s3smath").innerHTML = m;
    // back out of the letterbox: the first kept box, once it has been processed
    var first = null; for (var k = 0; k < w2.step; k++) if (T.trace[k].kept) { first = T.trace[k].d; break; }
    var full = $("s3full"); ui.renderRoom(full, r.scene, K, { scale: 0.25 });
    var fx = full.getContext("2d"); fx.setTransform(0.25, 0, 0, 0.25, 0, 0);
    T.kept.slice(0, Math.max(0, keptSoFar)).forEach(function (d, j) { fx.strokeStyle = j === 0 ? "#5FA03C" : "#F4C430"; fx.lineWidth = 8; fx.strokeRect(d.box[0], d.box[1], d.box[2] - d.box[0], d.box[3] - d.box[1]); });
    fx.setTransform(1, 0, 0, 1, 0, 0);
    if (first) {
      var cx = first.inBox[0] + (first.inBox[2] - first.inBox[0]) / 2, w = first.inBox[2] - first.inBox[0], cy = first.inBox[1] + (first.inBox[3] - first.inBox[1]) / 2, h = first.inBox[3] - first.inBox[1];
      $("s3unmath").innerHTML = '<div class="eq">frame = (input − pad) ÷ scale &nbsp;·&nbsp; scale ' + LB.scale + ", pad " + LB.padX + " × " + LB.padY + '</div><div class="eqn">x0 = (' + r1(cx) + " − " + r1(w / 2) + " − " + LB.padX + ") ÷ " + LB.scale + " = <b>" + fmt(first.box[0]) + "</b> · x1 = (" + r1(cx) + " + " + r1(w / 2) + " − " + LB.padX + ") ÷ " + LB.scale + " = <b>" + fmt(first.box[2]) + "</b><br>y0 = (" + r1(cy) + " − " + r1(h / 2) + " − " + LB.padY + ") ÷ " + LB.scale + " = <b>" + fmt(first.box[1]) + "</b> · y1 = (" + r1(cy) + " + " + r1(h / 2) + " − " + LB.padY + ") ÷ " + LB.scale + " = <b>" + fmt(first.box[3]) + "</b><br>kept box #1 in the upright 720×1280 frame: <b>" + boxStr(first.box) + "</b> · bearing (step 5) = (" + fmt((first.box[0] + first.box[2]) / 2) + " ÷ 720)·2 − 1 = <b>" + ui.sgn(core.bearing(first.box, core.CAM.W), 2) + "</b></div>";
    } else $("s3unmath").innerHTML = '<div class="eq">frame = (input − pad) ÷ scale</div><div class="eqn">Once a note is kept, its box is mapped back out of the letterbox here.</div>';
  }
  function w2runAll() {
    cancelAnimationFrame(w2.anim); var n = w2.tr.trace.length;
    if (reduced || n <= 1) { w2.step = n; w2render(); return; }
    var from = w2.step, t0 = performance.now(), dur = 600;
    (function tick(t) { var p = Math.min(1, (t - t0) / dur); w2.step = Math.min(n, from + Math.ceil(p * (n - from))); w2render(); if (p < 1) w2.anim = requestAnimationFrame(tick); })(t0);
  }
  function initW2() {
    ui.range("s3lim", function () { w2.lim = +$("s3lim").value; $("s3limv").textContent = fmt(w2.lim, 2); w2compute(); w2render(); touch(); });
    $("s3limv").textContent = fmt(w2.lim, 2);
    ui.range("s3sthr", function () { w2.thr = +$("s3sthr").value; $("s3sthrv").textContent = fmt(w2.thr, 2); w2compute(); w2render(); touch(); });
    $("s3sthrv").textContent = fmt(w2.thr, 2);
    $("s3next").onclick = function () { cancelAnimationFrame(w2.anim); if (w2.step < w2.tr.trace.length) w2.step++; w2render(); touch(); };
    $("s3all").onclick = function () { w2runAll(); touch(); };
    $("s3sreset").onclick = function () { cancelAnimationFrame(w2.anim); w2.step = 0; w2render(); touch(); };
    $("s3scite").innerHTML = "<b>On the robot.</b> " + MD.facts.twenty.v + " (" + MD.cite("twenty") + "). " + MD.facts.iouLimit.v + " (" + MD.cite("iouLimit") + "). The head itself “does not suppress anything”; <code>decode</code> does, and this widget runs the same greedy loop, ported from <code>lib.rs</code>.";
  }

  /* ================= Widget 3 · IoU by hand ================= */
  var U = 30, GT = [8, 8, 18, 18];
  var w3 = { b: (st.iou && st.iou.b) || [14, 12, 24, 22], drag: null, done: st.ch || {} };
  function w3geom() {
    var cv = $("s3iou"), w = cv.clientWidth || cv.parentNode.clientWidth || 600;
    cv.setAttribute("height", Math.min(380, Math.max(240, w + 30)));   // a square board plus the hint line, whatever the width
    var g = ui.ctxFor("s3iou"), cs = Math.floor(Math.min(g.w - 16, g.h - 30) / U), ox = Math.floor((g.w - cs * U) / 2), oy = 8; return { g: g, cs: cs, ox: ox, oy: oy };
  }
  var w3g = null;
  ui.drawer("s3iou", function () {
    var G = w3geom(); w3g = G; var x = G.g.x, cs = G.cs, ox = G.ox, oy = G.oy, b = w3.b, a = GT;
    function X(u) { return ox + u * cs; } function Y(v) { return oy + v * cs; }
    x.fillStyle = "#FFF6DC"; x.fillRect(ox, oy, U * cs, U * cs);
    x.strokeStyle = "rgba(74,46,30,.14)"; x.lineWidth = 1;
    for (var i = 0; i <= U; i++) { x.beginPath(); x.moveTo(X(i) + 0.5, oy); x.lineTo(X(i) + 0.5, oy + U * cs); x.stroke(); x.beginPath(); x.moveTo(ox, Y(i) + 0.5); x.lineTo(ox + U * cs, Y(i) + 0.5); x.stroke(); }
    // union = both boxes; intersection on top
    x.fillStyle = "rgba(249,217,91,.6)"; x.fillRect(X(a[0]), Y(a[1]), (a[2] - a[0]) * cs, (a[3] - a[1]) * cs);
    x.fillStyle = "rgba(159,211,214,.6)"; x.fillRect(X(b[0]), Y(b[1]), (b[2] - b[0]) * cs, (b[3] - b[1]) * cs);
    var ix0 = Math.max(a[0], b[0]), iy0 = Math.max(a[1], b[1]), ix1 = Math.min(a[2], b[2]), iy1 = Math.min(a[3], b[3]);
    if (ix1 > ix0 && iy1 > iy0) { x.fillStyle = "rgba(200,69,47,.7)"; x.fillRect(X(ix0), Y(iy0), (ix1 - ix0) * cs, (iy1 - iy0) * cs); }
    ui.drawMicroduck(x, [X(a[0]) + cs, Y(a[1]) + cs * 0.4, X(a[2]) - cs, Y(a[3]) - cs * 0.3]);
    x.setLineDash([]); x.strokeStyle = "#8A6300"; x.lineWidth = 3; x.strokeRect(X(a[0]), Y(a[1]), (a[2] - a[0]) * cs, (a[3] - a[1]) * cs);
    x.strokeStyle = "#1F6F74"; x.lineWidth = 3; x.strokeRect(X(b[0]), Y(b[1]), (b[2] - b[0]) * cs, (b[3] - b[1]) * cs);
    x.fillStyle = "#1F6F74"; x.strokeStyle = "#4A2E1E"; x.lineWidth = 2; x.fillRect(X(b[2]) - 7, Y(b[3]) - 7, 14, 14); x.strokeRect(X(b[2]) - 7, Y(b[3]) - 7, 14, 14);
    x.font = "15px 'Patrick Hand', sans-serif"; x.textAlign = "left"; x.fillStyle = "#8A6300"; x.fillText("true duck box " + (a[2] - a[0]) + "×" + (a[3] - a[1]), X(a[0]) + 4, Y(a[1]) - 9);
    x.fillStyle = "#0F4447"; x.fillText("your box " + (b[2] - b[0]) + "×" + (b[3] - b[1]), X(b[0]) + 4, Y(b[3]) + 11);
    x.fillStyle = C.dim; x.textAlign = "center"; x.fillText(G.g.w < 520 ? "drag · corner square resizes · arrows / shift+arrows" : "drag the box · drag the corner square to resize · arrows move, shift+arrows resize", G.g.w / 2, G.g.h - 9);
  });
  function w3stats() {
    var a = GT, b = w3.b, A = (a[2] - a[0]) * (a[3] - a[1]), B = (b[2] - b[0]) * (b[3] - b[1]);
    var ix0 = Math.max(a[0], b[0]), iy0 = Math.max(a[1], b[1]), ix1 = Math.min(a[2], b[2]), iy1 = Math.min(a[3], b[3]);
    var inter = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0), union = A + B - inter, io = core.iou(a, b);
    $("s3istat").innerHTML = '<div class="stat"><div class="v">' + A + '</div><div class="l">area A (true box)</div></div><div class="stat"><div class="v acc">' + B + '</div><div class="l">area B (yours)</div></div><div class="stat"><div class="v bad">' + inter + '</div><div class="l">overlap (brick)</div></div><div class="stat"><div class="v">' + union + '</div><div class="l">union = A + B − overlap</div></div><div class="stat big" style="grid-column:span 2"><div class="v ' + (io >= 0.5 ? "good" : "warn") + '">' + fmt(io, 3) + '</div><div class="l">IoU' + (io >= 0.5 ? " · counts as a hit at 0.5" : " · a miss at 0.5") + "</div></div>";
    $("s3imath").innerHTML = '<div class="eq">IoU = overlap ÷ (A + B − overlap)</div><div class="eqn">overlap = max(0, ' + Math.min(a[2], b[2]) + " − " + Math.max(a[0], b[0]) + ") × max(0, " + Math.min(a[3], b[3]) + " − " + Math.max(a[1], b[1]) + ") = " + Math.max(0, ix1 - ix0) + " × " + Math.max(0, iy1 - iy0) + " = <b>" + inter + "</b><br>union = " + A + " + " + B + " − " + inter + " = <b>" + union + "</b><br>IoU = " + inter + " ÷ " + union + " = <b>" + fmt(io, 3) + "</b> " + (io === 0 ? '<span class="muted">(no overlap: the max(0, …) clamps it to 0; same formula as lib.rs:279-288)</span>' : '<span class="muted">(the same formula as lib.rs:279-288)</span>') + "</div>";
    var tenTen = (b[2] - b[0]) === 10 && (b[3] - b[1]) === 10;
    if (io >= 0.5) w3.done.half = true;
    if (tenTen && Math.abs(io - 1 / 3) < 1e-9) w3.done.third = true;
    if (io >= 0.999) w3.done.perfect = true;
    st.ch = w3.done; st.iou = { b: w3.b.slice() }; ui.save();
    $("s3chal").innerHTML = '<span class="chip ' + (w3.done.half ? "good" : "") + '">' + (w3.done.half ? "✓ " : "") + 'get IoU ≥ 0.5</span><span class="chip ' + (w3.done.third ? "good" : "") + '">' + (w3.done.third ? "✓ " : "") + 'a 10×10 box with IoU exactly 1/3</span><span class="chip ' + (w3.done.perfect ? "good" : "") + '">' + (w3.done.perfect ? "✓ " : "") + 'IoU = 1</span>' + (w3.done.third ? '<span class="muted" style="font:15px var(--hand)">1/3: two 10×10 boxes offset by half. Overlap 50, union 150.</span>' : "");
  }
  function w3set(nb) {
    nb[0] = core.clamp(nb[0], 0, U - 1); nb[1] = core.clamp(nb[1], 0, U - 1); nb[2] = core.clamp(nb[2], nb[0] + 1, U); nb[3] = core.clamp(nb[3], nb[1] + 1, U);
    w3.b = nb; ui.redrawAll(); w3stats();
  }
  function initW3() {
    var cv = $("s3iou");
    cv.tabIndex = 0;
    function pos(e) { var rc = cv.getBoundingClientRect(), G = w3g || w3geom(); return [(e.clientX - rc.left - G.ox) / G.cs, (e.clientY - rc.top - G.oy) / G.cs]; }
    cv.addEventListener("pointerdown", function (e) {
      var p = pos(e), b = w3.b, G = w3g || w3geom(), hs = 10 / G.cs;
      if (Math.abs(p[0] - b[2]) < hs && Math.abs(p[1] - b[3]) < hs) w3.drag = { mode: "size", p: p, b: b.slice() };
      else if (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) w3.drag = { mode: "move", p: p, b: b.slice() };
      else return;
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!w3.drag) return;
      var p = pos(e), d = w3.drag, dx = Math.round(p[0] - d.p[0]), dy = Math.round(p[1] - d.p[1]), b = d.b;
      if (d.mode === "move") { var w = b[2] - b[0], h = b[3] - b[1], x0 = core.clamp(b[0] + dx, 0, U - w), y0 = core.clamp(b[1] + dy, 0, U - h); w3set([x0, y0, x0 + w, y0 + h]); }
      else w3set([b[0], b[1], Math.max(b[0] + 1, b[2] + dx), Math.max(b[1] + 1, b[3] + dy)]);
    });
    function up() { if (w3.drag) { w3.drag = null; touch(); } }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("keydown", function (e) {
      var k = e.key, b = w3.b.slice(), dx = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0, dy = k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0;
      if (!dx && !dy) return; e.preventDefault();
      if (e.shiftKey) w3set([b[0], b[1], b[2] + dx, b[3] + dy]);
      else { var w = b[2] - b[0], h = b[3] - b[1], x0 = core.clamp(b[0] + dx, 0, U - w), y0 = core.clamp(b[1] + dy, 0, U - h); w3set([x0, y0, x0 + w, y0 + h]); }
      touch();
    });
    $("s3ireset").onclick = function () { w3set([14, 12, 24, 22]); touch(); };
    $("s3icourse").onclick = function () { w3set([13, 10, 23, 20]); touch(); };
    w3stats();
  }

  /* ================= Widget 4 · The report card ================= */
  var w4 = { thr: 0.35, hn: true, frames: null, ev: {} };
  function w4data() {
    if (!w4.frames) w4.frames = core.makeSession(2026, 40, K);
    var key = w4.hn ? "hn" : "clean";
    if (!w4.ev[key]) {
      var fr = w4.hn ? w4.frames : w4.frames.map(function (f) { return { id: f.id, seed: f.seed, objects: f.objects.filter(function (o) { return o.kind === "microduck"; }) }; });
      var ev = core.evalSession(fr, K, {}), pr = core.prCurve(ev, 0.5);
      w4.ev[key] = { frames: fr, ev: ev, pr: pr, ap: core.apAllPoint(pr.pts), ap101: core.ap101(pr.pts) };
    }
    return w4.ev[key];
  }
  function w4matches(ev, thr) {
    var fps = [], fns = [];
    ev.forEach(function (f, fi) {
      var dets = f.dets.filter(function (d) { return d.score >= thr; }).sort(function (a, b) { return b.score - a.score; }), used = f.gts.map(function () { return false; });
      dets.forEach(function (d) {
        var best = -1, bi = 0.5;
        f.gts.forEach(function (g, gi) { var o = core.iou(d.box, g); if (!used[gi] && o >= bi) { best = gi; bi = o; } });
        if (best >= 0) used[best] = true;
        else { var what = "background", wk = ""; f.all.forEach(function (g) { if (core.iou(d.box, g.box) >= 0.3) { what = g.isDuck ? "a second box on a duck" : g.kind === "rubber" ? "a rubber duck" : "a duck print on the wall"; wk = g.kind; } }); fps.push({ fi: fi, box: d.box, score: d.score, what: what, kind: wk }); }
      });
      f.gts.forEach(function (g, gi) { if (!used[gi]) { var best = 0; f.dets.forEach(function (d) { if (core.iou(d.box, g) >= 0.5 && d.score > best) best = d.score; }); fns.push({ fi: fi, box: g, best: best }); } });
    });
    return { fps: fps, fns: fns };
  }
  ui.drawer("s3pr", function () {
    var g = ctx("s3pr", 260), x = g.x, D = w4data(), pad = { l: 44, r: 14, t: 12, b: 30 };
    ui.axes(g, pad, 0, 1, 1, 0, 1, 1);
    var sx = function (r) { return pad.l + r * (g.w - pad.l - pad.r); }, sy = function (p) { return pad.t + (1 - p) * (g.h - pad.t - pad.b); };
    // envelope (what AP integrates)
    var pts = D.pr.pts, env = [], best = 0;
    for (var i = pts.length - 1; i >= 0; i--) { best = Math.max(best, pts[i].precision); env[i] = best; }
    x.fillStyle = "rgba(159,211,214,.35)"; x.beginPath(); x.moveTo(sx(0), sy(0));
    pts.forEach(function (p, i) { x.lineTo(sx(p.recall), sy(env[i])); }); x.lineTo(sx(pts.length ? pts[pts.length - 1].recall : 0), sy(0)); x.closePath(); x.fill();
    ui.line(x, [[sx(0), sy(pts.length ? Math.max.apply(null, env) : 1)]].concat(pts.map(function (p, i) { return [sx(p.recall), sy(env[i])]; })), C.acc, 2, [5, 4]);
    ui.line(x, [[sx(0), sy(pts[0] ? pts[0].precision : 1)]].concat(pts.map(function (p) { return [sx(p.recall), sy(p.precision)]; })), C.ink, 2.5);
    var at = core.precisionRecallAt(D.ev, w4.thr, 0.5);
    x.fillStyle = C.red; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(sx(at.recall), sy(at.precision), 8, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.red; x.textAlign = at.recall > 0.6 ? "right" : "left"; x.fillText("threshold " + fmt(w4.thr, 2), sx(at.recall) + (at.recall > 0.6 ? -12 : 12), sy(at.precision) - 14);
    x.fillStyle = C.dim; x.textAlign = "center"; x.fillText("recall", (pad.l + g.w - pad.r) / 2, g.h - 6);
    x.save(); x.translate(12, (pad.t + g.h - pad.b) / 2); x.rotate(-Math.PI / 2); x.fillText("precision", 0, 0); x.restore();
  });
  function w4render() {
    var D = w4data(), at = core.precisionRecallAt(D.ev, w4.thr, 0.5), M = w4matches(D.ev, w4.thr);
    $("s3rthrv").textContent = fmt(w4.thr, 2);
    $("s3rstat").innerHTML = '<div class="stat big"><div class="v good">' + fmt(D.ap, 3) + '</div><div class="l">AP50, all-point (this toy)</div></div><div class="stat"><div class="v acc">' + fmt(D.ap101, 3) + '</div><div class="l">AP50, 101-point (COCO style)</div></div><div class="stat"><div class="v">' + D.pr.nGT + '</div><div class="l">real ducks in 40 frames</div></div>' +
      '<div class="stat"><div class="v">' + fmt(at.precision, 2) + '</div><div class="l">precision at ' + fmt(w4.thr, 2) + '</div></div><div class="stat"><div class="v">' + fmt(at.recall, 2) + '</div><div class="l">recall at ' + fmt(w4.thr, 2) + '</div></div><div class="stat"><div class="v"><span class="ok">' + at.tp + '</span> · <span class="bad">' + at.fp + '</span> · <span class="bad">' + at.fn + '</span></div><div class="l">TP · FP · FN</div></div>';
    $("s3rmath").innerHTML = '<div class="eq">precision = TP ÷ (TP + FP) &nbsp;·&nbsp; recall = TP ÷ (TP + FN)</div><div class="eqn">at ' + fmt(w4.thr, 2) + ": " + at.tp + " ÷ (" + at.tp + " + " + at.fp + ") = <b>" + fmt(at.precision, 3) + "</b> · " + at.tp + " ÷ (" + at.tp + " + " + at.fn + ") = <b>" + fmt(at.recall, 3) + "</b><br>AP50 = area under the precision envelope = <b>" + fmt(D.ap, 3) + "</b>" + (w4.hn ? "" : ' <span class="ok">(no look-alikes in the room: the only false positives left are extra boxes on real ducks)</span>') + "</div>";
    function thumbs(list, kind) {
      if (!list.length) return '<div class="empty">' + (kind === "fp" ? "No false positives at this threshold." : "No misses at this threshold" + (w4.thr < 0.9 ? " — the toy detector finds every duck until the gate is very high; try 0.90." : ".")) + "</div>";
      return list.slice(0, 6).map(function (m, j) { return '<figure><canvas class="th" data-fi="' + m.fi + '" data-box="' + m.box.join(",") + '" data-k="' + kind + '" width="72" height="128"></canvas><figcaption>frame ' + m.fi + " · " + (kind === "fp" ? m.what + " · " + fmt(m.score, 2) : "best box scored " + fmt(m.best, 3)) + "</figcaption></figure>"; }).join("") + (list.length > 6 ? '<div class="empty">+ ' + (list.length - 6) + " more</div>" : "");
    }
    $("s3fps").innerHTML = thumbs(M.fps, "fp"); $("s3fns").innerHTML = thumbs(M.fns, "fn");
    ui.qa("#s3fps canvas.th, #s3fns canvas.th").forEach(function (c) {
      var fr = D.frames[+c.dataset.fi], b = c.dataset.box.split(",").map(Number);
      ui.renderRoom(c, fr, K, { scale: 0.1 });
      var x = c.getContext("2d"); x.setTransform(0.1, 0, 0, 0.1, 0, 0); x.strokeStyle = c.dataset.k === "fp" ? "#C8452F" : "#F4C430"; x.lineWidth = 22; x.setLineDash(c.dataset.k === "fp" ? [] : [40, 25]); x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); x.setTransform(1, 0, 0, 1, 0, 0);
    });
    var fpk = { rubber: 0, print: 0, dup: 0 }; M.fps.forEach(function (m) { fpk[m.kind === "rubber" ? "rubber" : m.kind === "print" ? "print" : "dup"]++; });
    $("s3rcomp").innerHTML = M.fps.length ? "False positives at " + fmt(w4.thr, 2) + ": <b>" + fpk.rubber + "</b> on rubber ducks, <b>" + fpk.print + "</b> on wall prints, <b>" + fpk.dup + "</b> extra boxes on real ducks." : "";
    ui.redrawAll();
  }
  function initW4() {
    ui.range("s3rthr", function () { w4.thr = +$("s3rthr").value; w4render(); touch(); });
    $("s3hn").onchange = function () { w4.hn = $("s3hn").checked; w4render(); touch(); };
    $("s3rcite").innerHTML = "<b>On the robot.</b> The real model: " + MD.facts.training.v + " (" + MD.cite("training") + "). “Held out” means the test frames come from a recording session the model never trained on: same room and light within a session, so a random frame split would grade memory, not sight. The doc doesn't say whether 0.976 was the float or the INT8 model, or whether the held-out session had any look-alikes in it.";
  }

  /* ================= Widget 5 · Read the tensor right ================= */
  var w5 = { mode: "planar", i: null };
  function w5decode(raw, lb) {
    if (w5.mode === "planar") return core.decode(raw, lb, 0.35, 0.5, { trace: true });
    var il = new Float32Array(5 * N);
    for (var i = 0; i < N; i++) for (var k = 0; k < 5; k++) il[k * N + i] = raw[5 * i + k];
    return core.decode(il, lb, 0.35, 0.5, { trace: true });
  }
  function w5render() {
    var r = drawInput("s3tin", "s3tov", zShared), raw = r.d.raw, x = $("s3tov").getContext("2d");
    if (w5.i == null) { var top = 0; for (var q = 1; q < N; q++) if (raw[4 * N + q] > raw[4 * N + top]) top = q; w5.i = top; $("s3ti").value = top; }
    var i = w5.i, T = w5decode(raw, r.d.lb), planar = w5.mode === "planar";
    $("s3tiv").textContent = "#" + i;
    T.kept.forEach(function (d, j) { var b = d.inBox; x.strokeStyle = planar ? "#5FA03C" : "rgba(200,69,47,.85)"; x.lineWidth = planar ? 3 : 1.5; x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); });
    var big = T.kept.reduce(function (m, d) { var w = d.inBox[2] - d.inBox[0], h = d.inBox[3] - d.inBox[1]; return w * h > m.a ? { a: w * h, w: w, h: h } : m; }, { a: 0, w: 0, h: 0 });
    $("s3tstat").innerHTML = '<div class="stat"><div class="v ' + (planar ? "" : "bad") + '">' + fmt(T.candidates) + '</div><div class="l">“scores” ≥ 0.35</div></div><div class="stat"><div class="v ' + (planar ? "good" : "bad") + '">' + T.kept.length + '</div><div class="l">boxes after NMS</div></div><div class="stat"><div class="v">' + fmt(big.w) + "×" + fmt(big.h) + '</div><div class="l">largest kept box, input px</div></div>';
    var vals = planar ? [raw[i], raw[N + i], raw[2 * N + i], raw[3 * N + i], raw[4 * N + i]] : [raw[5 * i], raw[5 * i + 1], raw[5 * i + 2], raw[5 * i + 3], raw[5 * i + 4]];
    var names = ["cx", "cy", "w", "h", "score"], idx = planar ? [i, N + i, 2 * N + i, 3 * N + i, 4 * N + i] : [5 * i, 5 * i + 1, 5 * i + 2, 5 * i + 3, 5 * i + 4];
    var truth = idx.map(function (k) { return names[Math.floor(k / N)] + " of hole #" + (k % N); });
    var shelf = names[Math.min(4, Math.floor(5 * i / N))];
    $("s3tmath").innerHTML = '<div class="eq">' + (planar ? "candidate i → raw[k·N + i], N = 2100" : "candidate i → raw[5·i + k] (the wrong way)") + '</div><div class="eqn">' + names.map(function (nm, k) { return nm + " = raw[" + idx[k] + "] = <b>" + fmt(vals[k], nm === "score" ? 3 : 1) + "</b>" + (planar ? "" : ' <span class="muted">(really the ' + truth[k] + ")</span>"); }).join("<br>") + (planar ? "" : '<br><span class="bad">All five numbers came off the ' + shelf + " shelf, five neighbouring holes' " + shelf + " values. " + (shelf === "score" ? "Only candidates 1,680–2,099 even read real scores, and those are scores of the wrong holes." : "A “score” of " + fmt(vals[4], 1) + " sails through any threshold, and the box's w and h are really two other holes' " + shelf + " values.") + "</span>") + "</div>";
    $("s3tcap").innerHTML = planar ? "Green: the boxes <code>decode</code> keeps at 0.35 / IoU 0.5, reading planar. " + (T.kept.length === 1 ? "One duck, one box." : T.kept.length + " boxes.") : "Red: what survives if the reader assumes five numbers per box. " + T.kept.length + " confident boxes, many of them giants: the “almost plausible” failure.";
    ui.redrawAll();
  }
  ui.drawer("s3ten", function () {
    var g = ctx("s3ten", 170), x = g.x, r = run(zShared), raw = r.d.raw, pad = { l: 48, r: 8, t: 6, b: 22 }, W = g.w - pad.l - pad.r, rh = (g.h - pad.t - pad.b) / 5, names = ["cx", "cy", "w", "h", "score"];
    for (var k = 0; k < 5; k++) {
      var y = pad.t + k * rh;
      for (var px = 0; px < W; px++) {
        var i0 = Math.floor(px / W * N), i1 = Math.max(i0 + 1, Math.floor((px + 1) / W * N)), m = 0;
        for (var i = i0; i < i1; i++) m = Math.max(m, raw[k * N + i]);
        var t = k < 4 ? Math.min(1, m / SIZE) : Math.min(1, m);
        x.fillStyle = k < 4 ? "rgba(31,111,116," + (0.15 + 0.85 * t).toFixed(3) + ")" : "rgba(200,69,47," + (0.08 + 0.92 * t).toFixed(3) + ")";
        x.fillRect(pad.l + px, y + 1, 1, rh - 3);
      }
      x.fillStyle = C.txt; x.textAlign = "right"; x.font = "15px 'Patrick Hand', sans-serif"; x.fillText(names[k], pad.l - 6, y + rh / 2);
    }
    x.strokeStyle = C.ink; x.lineWidth = 1.5; x.strokeRect(pad.l, pad.t, W, 5 * rh - 1);
    var i = w5.i == null ? 0 : w5.i;
    if (w5.mode === "planar") { var cx = pad.l + (i + 0.5) / N * W; ui.line(x, [[cx, pad.t - 3], [cx, pad.t + 5 * rh]], "#F4C430", 3); ui.line(x, [[cx, pad.t - 3], [cx, pad.t + 5 * rh]], C.ink, 1); }
    else { var row = Math.min(4, Math.floor(5 * i / N)), col = (5 * i) % N, x0 = pad.l + col / N * W, x1 = pad.l + Math.min(N, col + 5) / N * W, ry = pad.t + row * rh; x.fillStyle = "rgba(244,196,48,.9)"; x.fillRect(x0 - 2, ry - 3, Math.max(6, x1 - x0 + 4), rh + 4); x.strokeStyle = C.ink; x.lineWidth = 1; x.strokeRect(x0 - 2, ry - 3, Math.max(6, x1 - x0 + 4), rh + 4); }
    x.fillStyle = C.dim; x.textAlign = "left"; x.fillText("0", pad.l, g.h - 8); x.textAlign = "right"; x.fillText("2099 →", g.w - pad.r, g.h - 8); x.textAlign = "center"; x.fillText("40×40 floor · 20×20 · 10×10", pad.l + W * 0.5, g.h - 8);
  });
  function initW5() {
    ui.seg("s3tmode", [{ v: "planar", label: "planar (the real layout)" }, { v: "inter", label: "interleaved (the mistake)" }], "planar", function (v) { w5.mode = v; w5render(); touch(); });
    ui.range("s3ti", function () { w5.i = +$("s3ti").value; w5render(); touch(); });
    $("s3tcite").innerHTML = "<b>On the robot.</b> " + MD.facts.planar.v + " (" + MD.cite("planar") + "). The crate's own test uses N = 2 and <code>raw = [10, 100, 20, 200, 4, 40, 6, 60, 0.9, 0.1]</code>: read planar, candidate 0 is cx 10, cy 20, w 4, h 6, score 0.9 → box [8, 17, 12, 23] (checked with <code>core.decode</code>). Read interleaved it would be cx 10, cy 100, w 20, h 200, “score” 4.";
  }

  /* ================= boot ================= */
  initW1(); initW2(); initW3(); initW4(); initW5();
  var first = true;
  DEV.onShow("s3", function () {
    if (first) { first = false; w1render(); w2compute(); w2render(); w5render(); w4render(); }
  });
});
