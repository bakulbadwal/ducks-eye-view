/* Step 4 · The Tiny Ruler: INT8 quantisation, the "about 1.3" bug, and the thermal limit (HF CV Course, Unit 9).
   Every number comes from DEV.core: qParams/quantize/dequantize (exact affine INT8), quantizeHead, decode, prCurve, apAllPoint
   (exact), and boardTemp (a labelled teaching model). */
Object.assign(window.DEV_GLOSSARY, {
  float32: ["float32", "The usual number format for training: 32 bits, about 7 significant digits, any size from tiny to huge.", "The long ruler with notches as fine as you like."],
  quant: ["Quantisation", "Storing numbers on a coarser grid: pick a range, split it into 2^bits equal steps, keep only which step each number is nearest. INT8 gives 256 steps.", "Cutting the long ruler down to one with 256 notches."],
  qscale: ["Scale", "How much one integer step is worth: (max − min) ÷ 255 for 8 bits. The spacing between notches.", "The gap between two notches on the tiny ruler."],
  zeropoint: ["Zero point", "The integer that stands for float 0.0, so zero is stored exactly: z = round(qmin − min ÷ scale).", "The notch the clerk lines up with 0."],
  pertensor: ["Per-tensor quantisation", "One scale and one zero point for a whole tensor. Simple and fast, but the biggest number in the tensor sets the notch spacing for everything in it.", "One ruler shared by the whole desk."],
  perchannel: ["Per-channel quantisation", "A separate scale and zero point for each channel (here: each of the five output rows), so a small-range row keeps fine notches.", "A ruler per pigeonhole row."],
  clipping: ["Clipping (saturation)", "A value outside the chosen range is stored as the nearest end of the range. The error can be huge: the range was picked from calibration data, and the live value left it.", "A note longer than the ruler gets its end torn off."],
  onnx: ["ONNX", "A portable file format for a trained network that many runtimes can read. Microduck's CPU fallback runs duck_detect.onnx through ONNX Runtime.", "The recipe card any kitchen can read."],
  rknn: ["RKNN", "Rockchip's compiled, quantised model format for its NPUs, produced by rknn-toolkit2 and run by the rknpu2 runtime. Not covered by the course.", "The recipe re-cut for this one calculator chip."],
  tops: ["TOPS", "Tera-operations per second: trillions of (usually INT8) multiply-adds a second. Microduck's NPU: 0.8, one core. Small.", "How fast the calculator chip clicks."],
  throttle: ["Thermal throttling", "When a chip gets too hot the system lowers its clock to cool it. Everything on that CPU slows down, including the walking loop.", "The fan can't keep up, so the whole workshop slows."],
  duty: ["Duty cycle", "The fraction of time a task keeps the chip busy: work per look ÷ time between looks. 60 ms every 500 ms is 12%.", "How much of each half-second the clerk is at the desk."],
  tie: ["Ties in NMS", "NMS sorts candidates by score and keeps the highest first. If many scores are exactly equal, a stable sort leaves them in grid order, so the survivor is whichever came first, not the most confident.", "Every note stamped the same; the shredder keeps the top of the pile."]
});
DEV.navIcon("s4", "ruler");
DEV.step("s4", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, C = ui.C, M = window.DEV_MICRODUCK, F = M.facts, sec = $("s4");
  var st = ui.store.s.s4 = ui.store.s.s4 || {};
  var touch = function () { ui.touch("s4"); };
  var drawers = {};
  var HAND = "'Patrick Hand', sans-serif";
  ui.qa("[data-cite]", sec).forEach(function (el) { el.innerHTML = M.cite(el.dataset.cite); });
  ui.qa("[data-fact]", sec).forEach(function (el) { var f = F[el.dataset.fact]; if (f) el.textContent = f.v; });
  // Typographic minus for negative numbers (fmt gives a hyphen); nm() also brackets a negative that follows an operator.
  function mf(n, d) { var t = d == null ? String(n) : fmt(n, d); return /^-0(\.0*)?$/.test(t) ? t.slice(1) : t.replace(/^-/, "−"); }
  function nm(n, d) { var t = mf(n, d); return t.charAt(0) === "−" ? "(" + t + ")" : t; }
  function txt(x, s, px, py, color, align, size) { x.font = (size || 13) + "px " + HAND; x.fillStyle = color || C.txt; x.textAlign = align || "left"; x.fillText(s, px, py); }
  function vline(x, px, y0, y1, color, width, dash) { x.strokeStyle = color; x.lineWidth = width || 1; x.setLineDash(dash || []); x.beginPath(); x.moveTo(px, y0); x.lineTo(px, y1); x.stroke(); x.setLineDash([]); }
  function dragOn(canvas, onPoint, onEnd) {
    var down = false;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top, w: r.width, h: r.height }; }
    canvas.addEventListener("pointerdown", function (e) { down = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} onPoint(pt(e)); e.preventDefault(); });
    canvas.addEventListener("pointermove", function (e) { if (down) onPoint(pt(e)); });
    function up() { if (down) { down = false; if (onEnd) onEnd(); } }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  }

  /* ================= A · the 256-notch ruler ================= */
  var A = { min: -1, max: 3, bits: 8, signed: false, x: 0.5 };
  function aQP() { return core.qParams(A.min, A.max, A.bits, A.signed); }
  function aSyncX() { var el = $("s4x"), span = A.max - A.min; el.min = (A.min - span * 0.3).toFixed(2); el.max = (A.max + span * 0.3).toFixed(2); el.value = A.x; }
  function aUpdate() {
    var qp = aQP(), q = core.quantize(A.x, qp), xh = core.dequantize(q, qp), err = xh - A.x, half = qp.scale / 2;
    var inside = A.x >= qp.min - 1e-9 && A.x <= qp.max + 1e-9;
    $("s4minv").textContent = mf(A.min, 1); $("s4maxv").textContent = mf(A.max, 1); $("s4xv").textContent = mf(A.x, 2);
    $("s4scale").textContent = fmt(qp.scale, 6); $("s4zp").textContent = mf(qp.zeroPoint); $("s4qv").textContent = mf(q); $("s4xh").textContent = mf(xh, 5);
    var e = $("s4err"); e.textContent = ui.sgn(err, 5); e.className = "v sm " + (Math.abs(err) <= half + 1e-9 ? "good" : "bad");
    $("s4worst").textContent = fmt(half, 5);
    var chip = $("s4errchip"); chip.className = "chip " + (inside ? "good" : "bad");
    chip.textContent = inside ? "inside the range: |error| " + fmt(Math.abs(err), 5) + " ≤ half a step " + fmt(half, 5) + " ✓" : "outside the range: clipped to q = " + q + ", error " + fmt(Math.abs(err), 3) + " ≈ " + fmt(Math.abs(err) / half, 0) + "× the in-range worst";
    $("s4qmath").innerHTML = '<div class="eq">s = (max − min) ÷ (q<sub>max</sub> − q<sub>min</sub>) · z = round(q<sub>min</sub> − min ÷ s)</div>' +
      '<div class="eqn">s = (' + mf(qp.max, 1) + ' − ' + nm(qp.min, 1) + ') ÷ (' + qp.qmax + ' − ' + nm(qp.qmin) + ') = <b>' + fmt(qp.scale, 6) + '</b> · z = round(' + mf(qp.qmin) + ' − ' + nm(qp.min, 1) + ' ÷ ' + fmt(qp.scale, 6) + ') = round(' + mf(qp.qmin - qp.min / qp.scale, 2) + ') = <b>' + mf(qp.zeroPoint) + '</b></div>' +
      '<div class="eq">q = clamp(round(x ÷ s) + z, q<sub>min</sub>, q<sub>max</sub>) · x̂ = s · (q − z)</div>' +
      '<div class="eqn">q = clamp(round(' + mf(A.x, 2) + ' ÷ ' + fmt(qp.scale, 6) + ') + ' + nm(qp.zeroPoint) + ') = clamp(' + mf(Math.round(A.x / qp.scale)) + ' + ' + nm(qp.zeroPoint) + ') = <b>' + mf(q) + '</b> · x̂ = ' + fmt(qp.scale, 6) + ' × ' + nm(q - qp.zeroPoint) + ' = <b>' + mf(xh, 5) + '</b> · error <b class="' + (inside ? "ok" : "bad") + '">' + ui.sgn(err, 5) + '</b>' + (inside ? ' ≤ s ÷ 2 = ' + fmt(half, 5) : ' (clipped)') + '</div>';
    drawers.s4ruler();
  }
  drawers.s4ruler = ui.drawer("s4ruler", function () {
    var g = ui.ctxFor("s4ruler"), x = g.x, w = g.w, qp = aQP(), span = qp.max - qp.min, step = qp.scale;
    var lo = qp.min - span * 0.3, hi = qp.max + span * 0.3, L = 14, R = w - 14;
    var X = function (v) { return L + (v - lo) / (hi - lo) * (R - L); };
    var n = qp.qmax - qp.qmin, q0 = core.quantize(A.x, qp), xh = core.dequantize(q0, qp);
    x.textBaseline = "middle";
    // float ruler, y 24..50
    x.fillStyle = "#EFE9DB"; x.fillRect(L, 24, R - L, 26);
    x.fillStyle = "#FBF7EC"; x.fillRect(X(qp.min), 24, X(qp.max) - X(qp.min), 26);
    x.save(); x.beginPath(); x.rect(L, 24, X(qp.min) - L, 26); x.rect(X(qp.max), 24, R - X(qp.max), 26); x.clip();
    x.strokeStyle = "rgba(200,69,47,.45)"; x.lineWidth = 1.5; for (var hx = L - 26; hx < R + 26; hx += 8) { x.beginPath(); x.moveTo(hx, 50); x.lineTo(hx + 26, 24); x.stroke(); } x.restore();
    var pxPer = (X(qp.max) - X(qp.min)) / n, every = Math.max(1, Math.ceil(2.5 / pxPer));
    x.strokeStyle = C.ink; x.lineWidth = 1;
    for (var q = qp.qmin; q <= qp.qmax; q += every) { var vx = X(core.dequantize(q, qp)), tall = ((q - qp.qmin) % (every * 8)) === 0; x.beginPath(); x.moveTo(vx, 50); x.lineTo(vx, tall ? 34 : 42); x.stroke(); }
    x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(L, 24, R - L, 26);
    txt(x, "min " + mf(qp.min, 2), X(qp.min), 60, C.txt, "center"); txt(x, "max " + mf(qp.max, 2), X(qp.max), 60, C.txt, "center");
    if (X(qp.min) - L > 46) txt(x, "clipped", (L + X(qp.min)) / 2, 37, "#A5321F", "center", 12);
    if (R - X(qp.max) > 46) txt(x, "clipped", (X(qp.max) + R) / 2, 37, "#A5321F", "center", 12);
    txt(x, (n + 1) + " notches, " + fmt(step, 4) + " apart", (X(qp.min) + X(qp.max)) / 2, 60, C.dim, "center", 12);
    // integer ruler, y 74..96
    x.fillStyle = "#FFF6DC"; x.fillRect(X(qp.min), 74, X(qp.max) - X(qp.min), 22); x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(X(qp.min), 74, X(qp.max) - X(qp.min), 22);
    txt(x, "q = " + mf(qp.qmin), X(qp.min) + 5, 85, C.txt, "left"); txt(x, String(qp.qmax), X(qp.max) - 5, 85, C.txt, "right");
    // zero point
    var zx = X(0); vline(x, zx, 24, 96, C.acc, 2.5); txt(x, "0.0 ↔ z = " + mf(qp.zeroPoint), zx, 105, "#0F4447", "center", 12);
    // marker x and its snap
    var mx = Math.max(L, Math.min(R, X(A.x))), hx2 = X(xh);
    x.strokeStyle = C.red; x.lineWidth = 2.5; x.beginPath(); x.moveTo(mx, 24); x.lineTo(hx2, 74); x.stroke();
    x.fillStyle = C.acc; x.beginPath(); x.arc(hx2, 85, 5, 0, 7); x.fill(); x.strokeStyle = C.ink; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = C.duck; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(mx, 24); x.lineTo(mx - 8, 12); x.lineTo(mx + 8, 12); x.closePath(); x.fill(); x.stroke();
    txt(x, "x = " + mf(A.x, 2), Math.max(L + 24, Math.min(R - 24, mx)), 6, C.txt, "center", 12);
    // magnifier, y 124..216
    var mlo = Math.min(A.x, xh) - step * 1.3, mhi = Math.max(A.x, xh) + step * 1.3;
    if (mhi - mlo < 4.6 * step) { var mc = (mlo + mhi) / 2; mlo = mc - 2.3 * step; mhi = mc + 2.3 * step; }
    var MX = function (v) { return L + (v - mlo) / (mhi - mlo) * (R - L); }, top = 130, bot = 220;
    x.fillStyle = "#FFFDF6"; x.fillRect(L, top, R - L, bot - top);
    x.save(); x.beginPath(); x.rect(L, top, R - L, bot - top); x.clip();
    x.fillStyle = "#EFE9DB"; if (mlo < qp.min) x.fillRect(L, top, MX(qp.min) - L, bot - top); if (mhi > qp.max) x.fillRect(MX(qp.max), top, R - MX(qp.max), bot - top);
    var pxStep = step / (mhi - mlo) * (R - L), everyM = Math.max(1, Math.ceil(3 / pxStep));
    var qa0 = Math.max(qp.qmin, core.quantize(mlo, qp) - 1), qa1 = Math.min(qp.qmax, core.quantize(mhi, qp) + 1);
    for (q = qa0; q <= qa1; q += everyM) {
      var v = core.dequantize(q, qp), vx2 = MX(v);
      vline(x, vx2, top + 30, bot - 22, C.ink, 1.5);
      if (pxStep > 34) txt(x, mf(q), vx2, bot - 11, C.txt, "center", 12);
      if (pxStep > 14 && v + step / 2 <= qp.max + step) vline(x, MX(v + step / 2), top + 30, bot - 22, "rgba(74,46,30,.4)", 1, [2, 3]);
    }
    vline(x, MX(A.x), top + 18, bot - 22, C.gold, 3); vline(x, MX(xh), top + 18, bot - 22, C.acc, 3);
    x.strokeStyle = C.red; x.lineWidth = 5; x.beginPath(); x.moveTo(MX(A.x), top + 52); x.lineTo(MX(xh), top + 52); x.stroke();
    var close = Math.abs(MX(A.x) - MX(xh)) < 34, right = MX(xh) >= MX(A.x);
    txt(x, "x", close ? MX(A.x) + (right ? -6 : 6) : MX(A.x), top + 10, "#8A5A12", close ? (right ? "right" : "left") : "center", 13);
    var hl = "x̂ = notch " + mf(q0); x.font = "13px " + HAND; var hw = x.measureText(hl).width, hRight = right ? MX(xh) + 6 + hw < R - 4 : MX(xh) - 6 - hw < L + 4;
    txt(x, hl, MX(xh) + (hRight ? 6 : -6), top + 10, "#0F4447", hRight ? "left" : "right", 13);
    txt(x, "error " + ui.sgn(xh - A.x, 5), Math.max(L + 50, Math.min(R - 50, (MX(A.x) + MX(xh)) / 2)), top + 66, "#A5321F", "center", 12);
    x.restore();
    x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(L, top, R - L, bot - top);
    txt(x, "magnifier ×" + fmt((hi - lo) / (mhi - mlo), 0) + " · dotted = where rounding flips", L + 6, top - 7, C.dim, "left", 12);
  });
  ui.range("s4min", function (e) { A.min = Math.min(0, +e.target.value); aSyncX(); aUpdate(); touch(); });
  ui.range("s4max", function (e) { A.max = Math.max(0, +e.target.value); aSyncX(); aUpdate(); touch(); });
  ui.range("s4x", function (e) { A.x = +e.target.value; aUpdate(); touch(); });
  var segBits = ui.seg("s4bits", [4, 5, 6, 7, 8].map(function (b) { return { v: b, label: b + " bits" }; }), 8, function (v) { A.bits = +v; aUpdate(); touch(); });
  var segSign = ui.seg("s4sign", [{ v: "u", label: "unsigned (uint8: 0…255)" }, { v: "s", label: "signed (int8: −128…127)" }], "u", function (v) { A.signed = v === "s"; aUpdate(); touch(); });
  ui.qa("#s4drops [data-x]").forEach(function (b) { b.onclick = function () { A.x = +b.dataset.x; aSyncX(); aUpdate(); touch(); }; });
  $("s4preset").onclick = function () { A = { min: -1, max: 3, bits: 8, signed: false, x: 0.5 }; $("s4min").value = -1; $("s4max").value = 3; segBits.set(8); segSign.set("u"); aSyncX(); aUpdate(); touch(); };
  dragOn($("s4ruler"), function (p) {
    var qp = aQP(), span = qp.max - qp.min, lo = qp.min - span * 0.3, hi = qp.max + span * 0.3, L = 14, R = p.w - 14;
    var v = lo + (p.px - L) / (R - L) * (hi - lo); A.x = Math.round(core.clamp(v, lo, hi) * 100) / 100; $("s4x").value = A.x; aUpdate();
  }, touch);
  $("s4ruler").addEventListener("keydown", function (e) { var d = e.key === "ArrowRight" ? 0.01 : e.key === "ArrowLeft" ? -0.01 : 0; if (d) { A.x = Math.round((A.x + d * (e.shiftKey ? 10 : 1)) * 100) / 100; $("s4x").value = A.x; aUpdate(); touch(); e.preventDefault(); } });
  aSyncX(); aUpdate();

  /* ================= B · 4× smaller? ================= */
  var B = { pm: 2.62, bytes: 4 }, FILES = { onnx: 10477940, rknn: 3851471 };
  function bUpdate() {
    var bytes = core.modelBytes(B.pm * 1e6, B.bytes), fp32 = core.modelBytes(B.pm * 1e6, 4);
    $("s4pmv").textContent = fmt(B.pm, 2) + " M";
    $("s4onnx").textContent = fmt(FILES.onnx / 1e6, 2) + " MB"; $("s4rknn").textContent = fmt(FILES.rknn / 1e6, 2) + " MB"; $("s4ratio").textContent = fmt(FILES.onnx / FILES.rknn, 2) + "×";
    $("s4szmath").innerHTML = '<div class="eq">size ≈ parameters × bytes per parameter</div>' +
      '<div class="eqn">' + fmt(B.pm, 2) + ' M × ' + B.bytes + ' B = <b>' + fmt(bytes / 1e6, 2) + ' MB</b>' + (B.bytes < 4 ? ' · vs float32 ' + fmt(fp32 / 1e6, 2) + ' MB = <b>' + fmt(fp32 / bytes, 0) + '× smaller</b>' : ' (float32)') + '</div>' +
      '<div class="eq">the real files</div>' +
      '<div class="eqn">' + fmt(FILES.onnx) + ' B ÷ ' + fmt(FILES.rknn) + ' B = <b>' + fmt(FILES.onnx / FILES.rknn, 2) + '×</b> · ' + fmt(FILES.onnx) + ' B ÷ 4 B ≈ <b>' + fmt(FILES.onnx / 4 / 1e6, 2) + ' M</b> parameters, a float32 yolo11n</div>';
    drawers.s4bars();
  }
  drawers.s4bars = ui.drawer("s4bars", function () {
    var g = ui.ctxFor("s4bars"), x = g.x, w = g.w, P = B.pm * 1e6;
    var rows = [
      { l: "float32 × 4 B", v: core.modelBytes(P, 4), c: B.bytes === 4 ? C.duck : "#DDBB8A" },
      { l: "float16 × 2 B", v: core.modelBytes(P, 2), c: B.bytes === 2 ? C.duck : "#DDBB8A" },
      { l: "INT8 × 1 B", v: core.modelBytes(P, 1), c: B.bytes === 1 ? C.duck : "#DDBB8A" },
      null,
      { l: "duck_detect.onnx", v: FILES.onnx, c: C.acc },
      { l: "duck_detect.rknn", v: FILES.rknn, c: C.acc }
    ];
    var maxV = Math.max(rows[0].v, FILES.onnx), L = 128, R = w - 70, top = 14, rh = 30;
    x.textBaseline = "middle";
    rows.forEach(function (r, i) {
      var y = top + i * rh;
      if (!r) { x.strokeStyle = C.line; x.lineWidth = 1.5; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(12, y + 14); x.lineTo(w - 12, y + 14); x.stroke(); x.setLineDash([]); txt(x, "textbook ↑ · real files ↓", w / 2, y + 14, C.dim, "center", 12); return; }
      var bw = Math.max(2, (R - L) * r.v / maxV);
      x.fillStyle = r.c; x.strokeStyle = C.ink; x.lineWidth = 2; x.fillRect(L, y + 3, bw, rh - 10); x.strokeRect(L, y + 3, bw, rh - 10);
      txt(x, r.l, L - 8, y + rh / 2 - 2, C.txt, "right", 14); txt(x, fmt(r.v / 1e6, 2) + " MB", L + bw + 6, y + rh / 2 - 2, C.txt, "left", 14);
    });
    var y4 = top + 4 * rh, yEnd = top + 6 * rh, qx = L + (R - L) * (FILES.onnx / 4) / maxV;
    x.strokeStyle = C.red; x.lineWidth = 2; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(qx, y4 - 4); x.lineTo(qx, yEnd - 2); x.stroke(); x.setLineDash([]);
    txt(x, "¼ of the onnx: where 4× would land", qx + 5, yEnd + 6, "#A5321F", "left", 12);
  });
  ui.range("s4pm", function (e) { B.pm = +e.target.value; bUpdate(); touch(); });
  ui.seg("s4prec", [{ v: 4, label: "float32 · 4 B" }, { v: 2, label: "float16 · 2 B" }, { v: 1, label: "INT8 · 1 B" }], 4, function (v) { B.bytes = +v; bUpdate(); touch(); });
  bUpdate();

  /* ================= C · the 1.3 mystery ================= */
  var K = core.modeIntrinsics("full"), NROW = 5;
  var SCENES = {
    pair: { label: "duck at 3 m + a rubber duck", scene: { seed: 7, objects: [{ kind: "microduck", x: 0.3, z: 3.0 }, { kind: "rubber", x: -0.5, z: 1.5 }] } },
    alone: { label: "one duck at 2 m", scene: { seed: 11, objects: [{ kind: "microduck", x: -0.2, z: 2.0 }] } },
    two: { label: "two ducks + a wall print", scene: { seed: 23, objects: [{ kind: "microduck", x: 0.6, z: 3.5 }, { kind: "microduck", x: -0.45, z: 1.6 }, { kind: "print", x: 0.8, z: 5 }] } }
  };
  var Cs = { q: st.q || "float", thr: 0.35, scene: st.scene || "pair" }, cCache = {};
  function cData() { var k = Cs.scene; if (!cCache[k]) { var d = core.detect(SCENES[k].scene, K); cCache[k] = { d: d, pt: core.quantizeHead(d.raw, false), pc: core.quantizeHead(d.raw, true) }; } return cCache[k]; }
  function cRaw(r) { return Cs.q === "float" ? r.d.raw : Cs.q === "pt" ? r.pt.raw : r.pc.raw; }
  function rowRange(raw, c, N) { var lo = Infinity, hi = -Infinity; for (var i = c * N; i < (c + 1) * N; i++) { if (raw[i] < lo) lo = raw[i]; if (raw[i] > hi) hi = raw[i]; } return [lo, hi]; }
  function cUpdate() {
    var r = cData(), raw = cRaw(r), N = r.d.N, res = core.decode(raw, r.d.lb, Cs.thr, 0.5, { trace: true });
    $("s4thrv").textContent = fmt(Cs.thr, 2);
    $("s4cand").textContent = res.candidates; $("s4kept").textContent = res.kept.length;
    var pt = r.pt.params[0], pc = r.pc.params[4], sr = rowRange(r.d.raw, 4, N), maxS = sr[1];
    var stepv = Cs.q === "pt" ? pt.scale : Cs.q === "pc" ? pc.scale : 0;
    $("s4step").textContent = Cs.q === "float" ? "—" : fmt(stepv, Cs.q === "pt" ? 4 : 5);
    $("s4vals").textContent = Cs.q === "float" ? "any, 0–1" : Cs.q === "pt" ? "0 or " + fmt(stepv, 4) : "256 steps";
    var atFloor = core.decode(raw, r.d.lb, 0.01, 0.5).length, dial = $("s4dial");
    if (Cs.q === "pt") { dial.className = "chip warn"; dial.textContent = "0.01 → " + fmt(Math.floor(pt.scale * 100) / 100, 2) + " all keep the same " + atFloor + " box" + (atFloor === 1 ? "" : "es") + ": a switch, not a dial"; }
    else { dial.className = "chip good"; dial.textContent = "at 0.01 the shredder keeps " + atFloor + ", at " + fmt(Cs.thr, 2) + " it keeps " + res.kept.length + ": a real dial"; }
    var mb = $("s4qhmath");
    if (Cs.q === "pt") {
      var ex1 = Math.min(maxS, 0.98), ex2 = 0.55;
      mb.innerHTML = '<div class="eq">one ruler for all 10,500 numbers: s = (max − min) ÷ 255</div>' +
        '<div class="eqn">the biggest number is a box coordinate: max = <b>' + fmt(pt.max, 2) + '</b>, min = ' + mf(pt.min, 2) + ' → s = <b>' + fmt(pt.scale, 4) + '</b> per notch, z = ' + mf(pt.zeroPoint) + '</div>' +
        '<div class="eq">a score s₀ → round(s₀ ÷ s) notches → back to float</div>' +
        '<div class="eqn">' + fmt(ex1, 2) + ' → round(' + fmt(ex1 / pt.scale, 2) + ') = 1 → <b>' + fmt(pt.scale, 4) + '</b> · ' + fmt(ex2, 2) + ' → round(' + fmt(ex2 / pt.scale, 2) + ') = 0 → <b>0</b> · cut-over at s ÷ 2 = <b>' + fmt(pt.scale / 2, 3) + '</b> · a box edge moves ≤ ' + fmt(pt.scale / 2, 2) + ' px in the input, ≈ ' + fmt(pt.scale / 2 / r.d.lb.scale, 1) + ' px in the frame</div>';
    } else if (Cs.q === "pc") {
      mb.innerHTML = '<div class="eq">a ruler per row: the score row gets s = (max − min) ÷ 255 of its own</div>' +
        '<div class="eqn">score row: max = ' + fmt(pc.max, 3) + ', min = ' + mf(pc.min, 3) + ' → s = <b>' + fmt(pc.scale, 5) + '</b> per notch: 256 notches between 0 and 1</div>' +
        '<div class="eqn">0.55 → round(' + fmt(0.55 / pc.scale, 1) + ') = ' + Math.round(0.55 / pc.scale) + ' → <b>' + fmt(core.fakeQuant(0.55, pc), 4) + '</b> · the box rows keep their own coarse ruler (s ≈ ' + fmt(r.pc.params[0].scale, 3) + ')</div>';
    } else {
      mb.innerHTML = '<div class="eq">float: the score is a sigmoid output, any value in 0–1</div>' +
        '<div class="eqn">scores in this frame run ' + fmt(sr[0], 4) + ' … <b>' + fmt(sr[1], 3) + '</b> · ' + res.candidates + ' of 2,100 clear ' + fmt(Cs.thr, 2) + ' · after NMS <b>' + res.kept.length + '</b></div>' +
        '<div class="eqn">box rows: cx ' + mf(rowRange(raw, 0, N)[0], 0) + ' to ' + mf(rowRange(raw, 0, N)[1], 0) + ', cy ' + mf(rowRange(raw, 1, N)[0], 0) + ' to ' + mf(rowRange(raw, 1, N)[1], 0) + ' px of the 320 input. That is what a shared ruler would have to reach.</div>';
    }
    // the frame with boxes
    var cam = $("s4cam"), out = ui.renderRoom(cam, SCENES[Cs.scene].scene, K, { scale: 0.25 }), cx = cam.getContext("2d"), s = out.scale;
    res.trace.forEach(function (t) { if (!t.kept) ui.boxPath(cx, t.d.box.map(function (v) { return v * s; }), "rgba(200,69,47,.5)", 1); });
    res.kept.forEach(function (d) {
      var b = d.box.map(function (v) { return v * s; }); ui.boxPath(cx, b, C.grn, 2.5);
      var lx = Math.max(0, b[0]), ly = Math.max(0, b[1] - 16);
      cx.fillStyle = "#3B7422"; cx.fillRect(lx, ly, 44, 15); cx.font = "12px " + HAND; cx.textBaseline = "middle"; cx.textAlign = "left"; cx.fillStyle = "#FFFDF6"; cx.fillText(fmt(d.score, 3), lx + 3, ly + 8);
    });
    drawers.s4hist(); drawers.s4strip();
  }
  drawers.s4hist = ui.drawer("s4hist", function () {
    var g = ui.ctxFor("s4hist"), x = g.x, w = g.w, r = cData(), N = r.d.N, raw = cRaw(r), names = ["cx", "cy", "w", "h", "score"];
    var L = 48, R = w - 96, rh = (g.h - 12) / NROW, BINS = 64;
    x.textBaseline = "middle";
    for (var c = 0; c < NROW; c++) {
      var y0 = 6 + c * rh, rg = rowRange(r.d.raw, c, N), rq = rowRange(raw, c, N), lo = Math.min(rg[0], rq[0]), hi = Math.max(rg[1], rq[1]);
      if (c === 4) { lo = 0; hi = Math.max(1, hi); }
      if (hi - lo < 1e-9) hi = lo + 1;
      var hf = new Float32Array(BINS), hq = new Float32Array(BINS);
      for (var i = c * N; i < (c + 1) * N; i++) { var bf = Math.min(BINS - 1, Math.floor((r.d.raw[i] - lo) / (hi - lo) * BINS)), bq = Math.min(BINS - 1, Math.floor((raw[i] - lo) / (hi - lo) * BINS)); hf[bf]++; hq[bq]++; }
      if (c === 4) { x.fillStyle = "#FFF1A8"; x.fillRect(L - 4, y0, R - L + 8, rh - 4); }
      var bw = (R - L) / BINS, hmax = Math.log1p(N);
      for (var k = 0; k < BINS; k++) {
        var hF = Math.log1p(hf[k]) / hmax * (rh - 10), hQ = Math.log1p(hq[k]) / hmax * (rh - 10);
        x.fillStyle = "rgba(110,80,64,.45)"; x.fillRect(L + k * bw, y0 + rh - 6 - hF, Math.max(1, bw - 1), hF);
        if (Cs.q !== "float") { x.fillStyle = "rgba(31,111,116,.85)"; x.fillRect(L + k * bw + bw * 0.25, y0 + rh - 6 - hQ, Math.max(1, bw * 0.5), hQ); }
      }
      x.strokeStyle = C.ink; x.lineWidth = 1; x.beginPath(); x.moveTo(L, y0 + rh - 6); x.lineTo(R, y0 + rh - 6); x.stroke();
      txt(x, names[c], L - 8, y0 + rh / 2 - 3, c === 4 ? "#A5321F" : C.txt, "right", 15);
      txt(x, mf(lo, c === 4 ? 2 : 0) + " … " + mf(hi, c === 4 ? 2 : 0), R + 6, y0 + rh / 2 - 3, C.dim, "left", 12);
    }
  });
  drawers.s4strip = ui.drawer("s4strip", function () {
    var g = ui.ctxFor("s4strip"), x = g.x, w = g.w, r = cData(), N = r.d.N, raw = cRaw(r), L = 86, R = w - 14, lo = 0, hi = 1.4;
    var X = function (v) { return L + (v - lo) / (hi - lo) * (R - L); };
    var lanes = [{ l: "float", data: r.d.raw, y: 22 }, { l: Cs.q === "float" ? "float again" : Cs.q === "pt" ? "one scale" : "per-channel", data: raw, y: 66 }];
    x.textBaseline = "middle";
    lanes.forEach(function (ln) {
      x.fillStyle = "#FFFDF6"; x.fillRect(L, ln.y, R - L, 28); x.strokeStyle = C.ink; x.lineWidth = 1.5; x.strokeRect(L, ln.y, R - L, 28);
      x.strokeStyle = "rgba(31,111,116,.28)"; x.lineWidth = 1;
      var above = 0;
      for (var i = 4 * N; i < 5 * N; i++) { var v = ln.data[i]; if (v >= Cs.thr) above++; var px = X(Math.min(hi, v)); x.beginPath(); x.moveTo(px, ln.y + 3); x.lineTo(px, ln.y + 25); x.stroke(); }
      txt(x, ln.l, L - 6, ln.y + 14, C.txt, "right", 13); txt(x, above + " ≥ thr", R - 4, ln.y + 14, above ? "#3B7422" : "#A5321F", "right", 12);
    });
    // the notches for the chosen mode along the bottom
    var ny = 112;
    x.strokeStyle = C.ink; x.lineWidth = 1.5; x.beginPath(); x.moveTo(L, ny); x.lineTo(R, ny); x.stroke();
    [0, 0.25, 0.5, 0.75, 1, 1.25].forEach(function (t) { vline(x, X(t), ny, ny + 5, C.ink, 1); txt(x, fmt(t, 2), X(t), ny + 13, C.dim, "center", 11); });
    if (Cs.q === "pt") {
      var s = r.pt.params[0].scale;
      for (var q = 0; q * s <= hi; q++) vline(x, X(q * s), 16, ny, C.gold, 3);
      vline(x, X(s / 2), 16, ny, "#A5321F", 1.5, [3, 3]);
      txt(x, "notch 0", X(0) + 4, 154, "#8A5A12", "left", 12); txt(x, "notch 1 = " + fmt(s, 4), X(s) - 4, 154, "#8A5A12", "right", 12); var cl = "cut-over " + fmt(s / 2, 3) + ": below → 0, above → notch 1"; x.font = "12px " + HAND; if (X(s / 2) + 4 + x.measureText(cl).width > w - 2) cl = "cut-over " + fmt(s / 2, 3); txt(x, cl, X(s / 2) + 4, 10, "#A5321F", "left", 12);
    } else if (Cs.q === "pc") {
      var sp = r.pc.params[4].scale;
      for (var qq = 0; qq * sp <= 1.0001; qq += 8) vline(x, X(qq * sp), ny - 6, ny, C.gold, 1);
      txt(x, "256 notches of " + fmt(sp, 5) + " between 0 and " + fmt(r.pc.params[4].max, 2) + " (every 8th drawn)", L + 4, 154, "#8A5A12", "left", 12);
    } else txt(x, "no notches: a float can sit anywhere on the line", L + 4, 154, C.dim, "left", 12);
    // the threshold
    vline(x, X(Cs.thr), 14, ny, C.red, 2.5); txt(x, "thr " + fmt(Cs.thr, 2), X(Cs.thr), ny + 30, "#A5321F", "center", 12);
  });
  var segQ = ui.seg("s4q", [{ v: "float", label: "float" }, { v: "pt", label: "INT8, one shared scale" }, { v: "pc", label: "INT8, per-channel" }], Cs.q, function (v) { Cs.q = v; st.q = v; ui.save(); cUpdate(); apDraw(); touch(); });
  ui.range("s4thr", function (e) { Cs.thr = +e.target.value; cUpdate(); touch(); });
  ui.seg("s4scene", Object.keys(SCENES).map(function (k) { return { v: k, label: SCENES[k].label }; }), Cs.scene, function (v) { Cs.scene = v; st.scene = v; ui.save(); cUpdate(); touch(); });
  cUpdate();
  void segQ;

  /* ---- the held-out session: AP50 float vs per-tensor vs per-channel (cached; ~0.1 s) ---- */
  var apCache = null, apSel = "t";
  function runAP() {
    if (apCache) return apCache;
    var S = core.makeSession(2026, 40);
    var one = function (opts) { var fr = core.evalSession(S, K, opts), pr = core.prCurve(fr, 0.5); return { ap: core.apAllPoint(pr.pts), pts: pr.pts, nGT: pr.nGT, fp: pr.fp, at35: core.precisionRecallAt(fr, 0.35, 0.5) }; };
    apCache = { f: one({}), t: one({ quant: "per-tensor" }), c: one({ quant: "per-channel" }), frames: S.length };
    return apCache;
  }
  function apDraw() {
    var a = runAP();
    $("s4apf").textContent = fmt(a.f.ap, 3); $("s4apt").textContent = fmt(a.t.ap, 3); $("s4apc").textContent = fmt(a.c.ap, 3);
    $("s4apnote").innerHTML = '<b>Read it.</b> ' + a.frames + ' frames, ' + a.f.nGT + ' ducks. Float: AP50 <b>' + fmt(a.f.ap, 3) + '</b>, and at the robot\'s 0.35 threshold precision ' + fmt(a.f.at35.precision, 2) + ' / recall ' + fmt(a.f.at35.recall, 2) + ' (' + a.f.at35.fp + ' false alarms: look-alikes and leftover duplicates). One shared scale: AP50 <b>' + fmt(a.t.ap, 3) + '</b>, yet precision at 0.35 is <b>' + fmt(a.t.at35.precision, 2) + '</b>, higher, because ' + (a.f.at35.fp - a.t.at35.fp) + ' weak false alarms rounded to 0. AP still fell: all ' + (a.t.at35.tp + a.t.at35.fp) + ' survivors tie at one notch and can\'t be ranked. Per-channel: AP50 <b>' + fmt(a.c.ap, 3) + '</b>, the float ranking restored. ' +
      '<span class="s4-src">Pre-processing mismatches on the same session (step 1): BGR ≈ 0.73, stretch ≈ 0.79, black padding ≈ 0.92.</span>';
    drawers.s4pr();
  }
  drawers.s4pr = ui.drawer("s4pr", function () {
    var g = ui.ctxFor("s4pr"), x = g.x, pad = { l: 46, r: 14, t: 12, b: 38 };
    if (!apCache) { txt(x, "computing the held-out session…", g.w / 2, g.h / 2, C.dim, "center", 15); return; }
    ui.axes(g, pad, 0, 1, 2, 0, 1, 2);
    txt(x, "recall", g.w / 2, g.h - 7, C.dim, "center", 13); x.save(); x.translate(12, g.h / 2); x.rotate(-Math.PI / 2); txt(x, "precision", 0, 0, C.dim, "center", 13); x.restore();
    var W = g.w - pad.l - pad.r, Hh = g.h - pad.t - pad.b;
    var curve = function (pts, color, width, dash) { var P = [[pad.l, pad.t]]; pts.forEach(function (p) { P.push([pad.l + p.recall * W, pad.t + (1 - p.precision) * Hh]); }); ui.line(x, P, color, width, dash); };
    var a = apCache, sel = apSel;
    curve(a.f.pts, sel === "f" ? C.grn : "rgba(59,116,34,.35)", sel === "f" ? 3.5 : 2);
    curve(a.c.pts, sel === "c" ? C.acc : "rgba(31,111,116,.5)", sel === "c" ? 3.5 : 2, [6, 4]);
    curve(a.t.pts, sel === "t" ? C.red : "rgba(200,69,47,.4)", sel === "t" ? 3.5 : 2);
    var lg = [["float " + fmt(a.f.ap, 3), C.grn], ["one scale " + fmt(a.t.ap, 3), C.red], ["per-channel " + fmt(a.c.ap, 3), C.acc]];
    lg.forEach(function (e, i) { var y = g.h - pad.b - 62 + i * 18; x.fillStyle = e[1]; x.fillRect(pad.l + 10, y - 5, 14, 10); txt(x, e[0], pad.l + 30, y, C.txt, "left", 13); });
  });
  ui.seg("s4apsel", [{ v: "f", label: "float" }, { v: "t", label: "one shared scale" }, { v: "c", label: "per-channel" }], apSel, function (v) { apSel = v; drawers.s4pr(); touch(); });
  var apStarted = false;
  DEV.onShow("s4", function () { if (apStarted) return; apStarted = true; setTimeout(apDraw, 60); });

  /* ================= D · walks badly to see well (teaching model; the 95 °C / 408 MHz anchor is the repo's) ================= */
  var D = { hz: st.hz || 2 }, WORK = 60, TICK = 20;
  function dUpdate() {
    var t = core.boardTemp(D.hz), th = core.throttled(D.hz), per = 1000 / D.hz, duty = WORK / per;
    $("s4hzv").textContent = fmt(D.hz, 1) + " looks/s"; $("s4hz").value = D.hz;
    var te = $("s4temp"); te.textContent = fmt(t, 1) + " °C"; te.className = "v " + (th ? "bad" : t > 80 ? "warn" : "good");
    var ce = $("s4clk"); ce.textContent = th ? "408 MHz" : "full clock"; ce.className = "v " + (th ? "bad" : "good");
    $("s4per").textContent = fmt(per, 0) + " ms"; $("s4duty").textContent = ui.pct(Math.min(1, duty), 0);
    $("s4tmath").innerHTML = '<div class="eq">period = 1000 ÷ rate · duty = work ÷ period · max rate if speed were the only limit = 1000 ÷ work</div>' +
      '<div class="eqn">1000 ÷ ' + fmt(D.hz, 1) + ' = <b>' + fmt(per, 0) + ' ms</b> between looks · ' + WORK + ' ÷ ' + fmt(per, 0) + ' = <b>' + ui.pct(Math.min(1, duty), 0) + '</b> busy · one look every ' + fmt(per / TICK, 1) + ' walking ticks · 1000 ÷ 60 = <b>16.7</b> looks/s flat out</div>' +
      '<div class="eqn">board ≈ <b>' + fmt(t, 1) + ' °C</b> (toy curve) → ' + (th ? '<b class="bad">throttled to 408 MHz</b>' : '<b class="ok">full clock</b>') + '</div>';
    drawers.s4thermo(); drawers.s4ticks();
  }
  drawers.s4thermo = ui.drawer("s4thermo", function () {
    var g = ui.ctxFor("s4thermo"), x = g.x, w = g.w, t = core.boardTemp(D.hz), th = core.throttled(D.hz);
    var cx = Math.min(44, w / 3), top = 18, bot = 178, Y = function (deg) { return bot - (deg - 40) / 60 * (bot - top); };
    x.textBaseline = "middle";
    x.fillStyle = "#FFFDF6"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.roundRect ? x.roundRect(cx - 9, top - 6, 18, bot - top + 6, 9) : x.rect(cx - 9, top - 6, 18, bot - top + 6); x.fill(); x.stroke();
    x.fillStyle = th ? C.red : t > 80 ? "#E0A91E" : C.acc; x.fillRect(cx - 4, Y(t), 8, bot - Y(t) + 4);
    x.fillStyle = C.red; x.beginPath(); x.arc(cx, bot + 18, 15, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = C.ink; x.lineWidth = 1;
    [40, 60, 80].forEach(function (d) { x.beginPath(); x.moveTo(cx + 9, Y(d)); x.lineTo(cx + 15, Y(d)); x.stroke(); txt(x, d + "°", cx + 18, Y(d), C.dim, "left", 11); });
    x.strokeStyle = "#A5321F"; x.lineWidth = 1.5; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(cx - 16, Y(90)); x.lineTo(w - 4, Y(90)); x.stroke(); x.setLineDash([]);
    txt(x, "90° throttle", cx + 18, Y(90) + 9, "#A5321F", "left", 11); txt(x, "95° flat out", cx + 18, Y(95) - 9, "#A5321F", "left", 11);
    txt(x, fmt(t, 1) + " °C", cx, bot + 44, th ? "#A5321F" : C.txt, "center", 16);
    // the fan, on when hot
    var fx = w - 30, fy = 138; if (fx > cx + 60) {
      x.fillStyle = "#E5F2FA"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(fx, fy, 22, 0, 7); x.fill(); x.stroke();
      var blades = t > 80 ? 8 : 4; for (var i = 0; i < blades; i++) { x.save(); x.translate(fx, fy); x.rotate(i * 2 * Math.PI / blades); x.fillStyle = t > 80 ? "rgba(185,189,194,.6)" : "#B9BDC2"; x.beginPath(); x.ellipse(0, -11, 5, 10, 0, 0, 7); x.fill(); x.restore(); }
      x.fillStyle = C.ink; x.beginPath(); x.arc(fx, fy, 3.5, 0, 7); x.fill();
      txt(x, t > 80 ? "fan: flat out" : "fan: idle", fx, fy + 34, C.dim, "center", 11);
    }
  });
  drawers.s4ticks = ui.drawer("s4ticks", function () {
    var g = ui.ctxFor("s4ticks"), x = g.x, w = g.w, th = core.throttled(D.hz), L = 10, R = w - 10, n = 50, tw = (R - L) / n;
    x.textBaseline = "middle";
    txt(x, "one second of the 50 Hz walking loop", L, 12, C.txt, "left", 14);
    var y0 = 30, hh = 44;
    // looks: each 60 ms = 3 ticks, starting every 1000/hz ms
    var looks = []; for (var k = 0; k * 1000 / D.hz < 1000; k++) looks.push(Math.round(k * n / D.hz));
    if (D.hz < 1) looks = [0];
    looks.forEach(function (s0) { x.fillStyle = "rgba(244,196,48,.55)"; x.fillRect(L + s0 * tw, y0 - 6, tw * 3, hh + 12); });
    for (var i = 0; i < n; i++) {
      var missed = th && (i % 2 === 1);
      x.fillStyle = missed ? "#F4B7A7" : "#BFE3A6"; x.strokeStyle = C.ink; x.lineWidth = 1;
      x.fillRect(L + i * tw + 1, y0, Math.max(1, tw - 2), hh); x.strokeRect(L + i * tw + 1, y0, Math.max(1, tw - 2), hh);
      if (missed && tw > 9) { x.strokeStyle = "#A5321F"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(L + i * tw + 3, y0 + 14); x.lineTo(L + i * tw + tw - 3, y0 + hh - 14); x.moveTo(L + i * tw + tw - 3, y0 + 14); x.lineTo(L + i * tw + 3, y0 + hh - 14); x.stroke(); }
    }
    txt(x, "0 ms", L, y0 + hh + 12, C.dim, "left", 11); txt(x, "500", L + 25 * tw, y0 + hh + 12, C.dim, "center", 11); txt(x, "1000 ms", R, y0 + hh + 12, C.dim, "right", 11);
    // legend + story
    var ly = y0 + hh + 34;
    x.fillStyle = "#BFE3A6"; x.fillRect(L, ly - 6, 12, 12); x.strokeStyle = C.ink; x.lineWidth = 1; x.strokeRect(L, ly - 6, 12, 12); txt(x, "tick on time (20 ms)", L + 18, ly, C.txt, "left", 12);
    x.fillStyle = "rgba(244,196,48,.55)"; x.fillRect(L + 150, ly - 6, 12, 12); x.strokeRect(L + 150, ly - 6, 12, 12); txt(x, "a look: ~60 ms of work", L + 168, ly, C.txt, "left", 12);
    x.fillStyle = "#F4B7A7"; x.fillRect(L, ly + 18 - 6, 12, 12); x.strokeRect(L, ly + 18 - 6, 12, 12); txt(x, "tick missed at 408 MHz", L + 18, ly + 18, C.txt, "left", 12);
    var msg = th ? "throttled: half the ticks miss, the walk stumbles" : D.hz <= 2 ? fmt(D.hz, 1) + " looks a second, " + fmt(WORK * D.hz / 10, 0) + "% busy: the walk never notices" : looks.length + " looks a second, " + fmt(Math.min(100, WORK * D.hz / 10), 0) + "% busy: still on time, but warming up";
    txt(x, msg, L, ly + 44, th ? "#A5321F" : C.txt, "left", 14);
    // an animated sweep line on change (≤ 600 ms, skipped under reduced motion)
  });
  var REDUCED = false; try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var sweepRaf = null;
  function sweep() {
    if (REDUCED) return; if (sweepRaf) cancelAnimationFrame(sweepRaf);
    var t0 = performance.now(), cvs = $("s4ticks");
    (function frame(now) {
      var p = Math.min(1, (now - t0) / 500); drawers.s4ticks();
      var x = cvs.getContext("2d"), dpr = window.devicePixelRatio || 1, w = cvs.width / dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      var px = 10 + p * (w - 20); x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(px, 22); x.lineTo(px, 84); x.stroke();
      if (p < 1) sweepRaf = requestAnimationFrame(frame); else { sweepRaf = null; drawers.s4ticks(); }
    })(t0);
  }
  ui.range("s4hz", function (e) { D.hz = +e.target.value; st.hz = D.hz; ui.save(); dUpdate(); touch(); });
  ui.qa("#s4hzbtns [data-hz]").forEach(function (b) { b.onclick = function () { D.hz = +b.dataset.hz; st.hz = D.hz; ui.save(); dUpdate(); sweep(); touch(); }; });
  dUpdate();
});
