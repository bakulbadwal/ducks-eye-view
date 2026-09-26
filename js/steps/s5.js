/* Step 5 · The Map Room: pinhole camera, intrinsics, bearing → angle, the sensor-mode trap, and why depth is lost (HF CV Course, Unit 8 part 1).
   Every number comes from DEV.core: modeIntrinsics, maxLrFov, cropFov, focalFromFov, project, pixelSize, bearing, bearingToAngle, objectBox,
   letterboxFit (all exact). The room is the shared toy room. */
Object.assign(window.DEV_GLOSSARY, {
  pinhole: ["Pinhole camera model", "Every scene point connects to one image point by a straight line through one hole. pixel = focal length × (X ÷ Z) + centre. The standard camera model.", "The strings through the hole in the map-room wall."],
  focal: ["Focal length (in pixels)", "How strongly the camera magnifies: how many pixels one unit of X ÷ Z spans. f = (W ÷ 2) ÷ tan(FOV ÷ 2). Bigger f = more zoomed in, narrower view.", "How far the screen sits from the pinhole."],
  principal: ["Principal point (cx, cy)", "The pixel the optical axis passes through, usually near the image centre, rarely exactly on it.", "The centre mark on the map."],
  fov: ["Field of view", "The full angle the camera sees edge to edge along one axis. It depends on the sensor size and the focal length, and it differs across and down the frame.", "How wide the eye window opens."],
  sensormode: ["Sensor mode", "Which part of the sensor's 3280×2464 pixels a video mode reads, and how it scales them. A 16:9 mode must crop rows; some also crop columns. It decides the field of view.", "How much of the window the shutter uncovers."],
  ray: ["Ray", "The line from the camera's centre out through a pixel. One pixel = one direction, and every point along that direction lands on the same pixel.", "One string from the pinhole."],
  calibration: ["Camera calibration", "Measuring a real camera's intrinsics (and lens distortion) by photographing a known pattern, such as a checkerboard, from many angles.", "Measuring the map room instead of guessing."],
  extrinsics: ["Extrinsics", "Where the camera is and which way it points: a rotation and a translation into another frame (the head, the trunk). Microduck's come from the head's forward kinematics.", "Where the map room sits inside the duck."],
  homog: ["Homogeneous coordinates", "A point [x, y, z] written as [x, y, z, 1], so that rotation, scaling and translation all become one 4×4 matrix multiplication. Chains read right to left.", "One direction card per move; stack the cards."],
  overturn: ["Over-turn", "Turning the head further than the target because the pixel-to-angle conversion used the wrong focal length. Nothing crashes; the gaze lands off to one side.", "Cranking the neck past the duck."]
});
DEV.navIcon("s5", "protractor");
DEV.step("s5", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, C = ui.C, M = window.DEV_MICRODUCK, F = M.facts, sec = $("s5"), DEG = core.DEG;
  var st = ui.store.s.s5 = ui.store.s.s5 || {};
  var touch = function () { ui.touch("s5"); };
  var drawers = {}, HAND = "'Patrick Hand', sans-serif";
  var W = core.CAM.W, H = core.CAM.H;
  var MODEK = { full: core.modeIntrinsics("full"), crop1080: core.modeIntrinsics("crop1080") };
  var PH_FOV = 62, PH_F = core.focalFromFov(W, PH_FOV);
  ui.qa("[data-cite]", sec).forEach(function (el) { el.innerHTML = M.cite(el.dataset.cite); });
  ui.qa("[data-fact]", sec).forEach(function (el) { var f = F[el.dataset.fact]; if (f) el.textContent = f.v; });
  function txt(x, s, px, py, color, align, size) { x.font = (size || 13) + "px " + HAND; x.fillStyle = color || C.txt; x.textAlign = align || "left"; x.fillText(s, px, py); }
  // Typographic minus: fmt gives a hyphen for negatives.
  function mf(n, d) { var t = fmt(n, d == null ? 0 : d); return /^-0(\.0*)?$/.test(t) ? t.slice(1) : t.replace(/^-/, "−"); }
  function deg(v, d) { return mf(v, d == null ? 1 : d) + "°"; }
  function dragOn(canvas, onPoint, onEnd) {
    var down = false;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top, w: r.width, h: r.height }; }
    canvas.addEventListener("pointerdown", function (e) { down = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} onPoint(pt(e)); e.preventDefault(); });
    canvas.addEventListener("pointermove", function (e) { if (down) onPoint(pt(e)); });
    function up() { if (down) { down = false; if (onEnd) onEnd(); } }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  }
  // a top-down duck: a body, a head, a bill pointing at the camera
  function topDuck(x, px, py, r, fill) {
    x.fillStyle = fill || C.duck; x.strokeStyle = C.ink; x.lineWidth = 2; x.lineJoin = "round";
    x.beginPath(); x.ellipse(px, py, r, r * 0.75, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(px, py + r * 0.55, r * 0.5, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.bill; x.beginPath(); x.moveTo(px - r * 0.22, py + r * 0.95); x.lineTo(px, py + r * 1.35); x.lineTo(px + r * 0.22, py + r * 0.95); x.closePath(); x.fill(); x.stroke();
  }

  /* ================= A · where's the duck? ================= */
  var P = { mode: st.mode || "full", x: 0.507, z: 3.0 };
  function setForBearing(b, z) { var K = MODEK[P.mode]; P.z = z; P.x = z * Math.tan(core.bearingToAngle(b, K.fovLR) * DEG); }
  function pUpdate() {
    var K = MODEK[P.mode], box = core.objectBox({ kind: "microduck", x: P.x, z: P.z }, K);
    var b = core.bearing(box, W), inView = box[2] > 0 && box[0] < W;
    var trueA = Math.atan2(P.x, P.z) / DEG, corA = core.bearingToAngle(b, K.fovLR), phA = core.bearingToAngle(b, PH_FOV), linA = b * PH_FOV / 2;
    var overDeg = phA - trueA, overM = P.z * (Math.tan(phA * DEG) - Math.tan(trueA * DEG));
    $("s5xv").textContent = ui.sgn(P.x, 2) + " m"; $("s5zv").textContent = fmt(P.z, 2) + " m"; $("s5x").value = P.x; $("s5z").value = P.z;
    $("s5box").textContent = inView ? "[" + box.map(function (v) { return fmt(v, 0); }).join(", ") + "]" : "out of frame";
    $("s5b").textContent = ui.sgn(b, 3) + (Math.abs(b) > 1 ? " (off the edge)" : "");
    $("s5true").textContent = deg(trueA); $("s5cor").textContent = deg(corA); $("s5ph").textContent = deg(phA); $("s5lin").textContent = deg(linA);
    $("s5over").textContent = ui.sgn(overDeg, 1) + "°"; $("s5overm").textContent = ui.sgn(overM * 100, 0) + " cm";
    var cxb = (box[0] + box[2]) / 2;
    $("s5bmath").innerHTML = '<div class="eq">b = (box centre ÷ W) · 2 − 1 · angle = atan(b · tan(FOV<sub>LR</sub> ÷ 2)) = atan(b · (W ÷ 2) ÷ f)</div>' +
      '<div class="eqn">b = (' + fmt(cxb, 1) + ' ÷ 720) · 2 − 1 = <b>' + ui.sgn(b, 3) + '</b> · true: atan2(' + mf(P.x, 2) + ', ' + fmt(P.z, 2) + ') = <b class="ok">' + deg(trueA, 2) + '</b></div>' +
      '<div class="eqn">correct f = ' + fmt(K.f, 1) + ' px (FOV<sub>LR</sub> ' + deg(K.fovLR, 2) + '): atan(' + mf(b, 3) + ' × ' + fmt(Math.tan(K.fovLR / 2 * DEG), 4) + ') = <b class="ok">' + deg(corA, 2) + '</b> · a 62°-wide placeholder, f = ' + fmt(PH_F, 1) + ' px: atan(' + mf(b, 3) + ' × ' + fmt(Math.tan(31 * DEG), 4) + ') = <b class="bad">' + deg(phA, 2) + '</b> · lazy: ' + mf(b, 3) + ' × 31° = <b>' + deg(linA, 2) + '</b></div>' +
      '<div class="eqn">over-turn = ' + deg(phA, 2) + ' − ' + deg(trueA, 2) + ' = <b class="bad">' + ui.sgn(overDeg, 2) + '°</b> · at ' + fmt(P.z, 2) + ' m: ' + fmt(P.z, 2) + ' × (tan ' + deg(phA, 1) + ' − tan ' + deg(trueA, 1) + ') = <b class="bad">' + ui.sgn(overM, 3) + ' m</b>' + (Math.abs(overM) > 0.2 ? ', more than the duck is wide (20 cm)' : '') + '</div>';
    // the frame
    var cam = $("s5cam"), out = ui.renderRoom(cam, { seed: 1, objects: [{ kind: "microduck", x: P.x, z: P.z }] }, K, { scale: 0.3 }), x = cam.getContext("2d"), s = out.scale;
    if (inView) {
      var bb = box.map(function (v) { return v * s; }); ui.boxPath(x, bb, C.grn, 2.5);
      x.strokeStyle = "rgba(74,46,30,.5)"; x.lineWidth = 1; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(W * s / 2, 0); x.lineTo(W * s / 2, H * s); x.stroke(); x.setLineDash([]);
      x.fillStyle = "#3B7422"; x.fillRect(bb[0], Math.max(0, bb[1] - 16), 64, 15); txt(x, "b " + ui.sgn(b, 2), bb[0] + 3, Math.max(0, bb[1] - 16) + 8, "#FFFDF6", "left", 12);
      // bearing arrow along the bottom: −1 … +1
      var y0 = H * s - 16; x.strokeStyle = C.ink; x.lineWidth = 1.5; x.beginPath(); x.moveTo(8, y0); x.lineTo(W * s - 8, y0); x.stroke();
      x.fillStyle = C.acc; x.beginPath(); x.arc(cxb * s, y0, 5, 0, 7); x.fill();
      txt(x, "−1", 8, y0 - 10, "#FFFDF6", "left", 12); txt(x, "0", W * s / 2, y0 - 10, "#FFFDF6", "center", 12); txt(x, "+1", W * s - 8, y0 - 10, "#FFFDF6", "right", 12);
    } else { x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(0, 0, W * s, H * s); txt(x, "out of view", W * s / 2, H * s / 2, "#FFFDF6", "center", 18); }
    drawers.s5map();
  }
  var dragging = false;
  drawers.s5map = ui.drawer("s5map", function () {
    var g = ui.ctxFor("s5map"), x = g.x, w = g.w, h = g.h, K = MODEK[P.mode];
    var sc = Math.min((w - 20) / 6.2, (h - 40) / 5.5), ox = w / 2, oy = h - 22;
    var MX = function (mx) { return ox + mx * sc; }, MZ = function (mz) { return oy - mz * sc; };
    x.textBaseline = "middle";
    // floor grid, metres
    x.strokeStyle = "rgba(74,46,30,.12)"; x.lineWidth = 1;
    for (var m = -3; m <= 3; m++) { x.beginPath(); x.moveTo(MX(m), MZ(0)); x.lineTo(MX(m), MZ(5)); x.stroke(); }
    for (var z = 1; z <= 5; z++) { x.beginPath(); x.moveTo(MX(-3.1), MZ(z)); x.lineTo(MX(3.1), MZ(z)); x.stroke(); txt(x, z + " m", MX(-3.05), MZ(z) - 7, C.dim, "left", 11); }
    // the back wall
    x.fillStyle = "#E3D2B1"; x.fillRect(MX(-3.1), MZ(5.4), MX(3.1) - MX(-3.1), MZ(5) - MZ(5.4)); x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(MX(-3.1), MZ(5.4), MX(3.1) - MX(-3.1), MZ(5) - MZ(5.4));
    txt(x, "back wall, z = 5 m", ox, (MZ(5) + MZ(5.4)) / 2, C.txt, "center", 12);
    // wedges: the doc's 62° (dashed red) and the real mode (teal)
    var zf = 5.0, hp = Math.tan(31 * DEG), hr = Math.tan(K.fovLR / 2 * DEG);
    x.strokeStyle = C.red; x.lineWidth = 1.5; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(MX(-hp * zf), MZ(zf)); x.lineTo(ox, oy); x.lineTo(MX(hp * zf), MZ(zf)); x.stroke(); x.setLineDash([]);
    txt(x, "62°?", MX(-hp * 4.3) + 8, MZ(4.3), "#A5321F", "left", 12);
    x.fillStyle = "rgba(31,111,116,.14)"; x.beginPath(); x.moveTo(ox, oy); x.lineTo(MX(-hr * zf), MZ(zf)); x.lineTo(MX(hr * zf), MZ(zf)); x.closePath(); x.fill();
    x.strokeStyle = C.acc; x.lineWidth = 2; x.beginPath(); x.moveTo(MX(-hr * zf), MZ(zf)); x.lineTo(ox, oy); x.lineTo(MX(hr * zf), MZ(zf)); x.stroke();
    txt(x, deg(K.fovLR, 1) + " left–right", ox, MZ(zf) + 14, "#0F4447", "center", 12);
    // rays
    var trueA = Math.atan2(P.x, P.z), box = core.objectBox({ kind: "microduck", x: P.x, z: P.z }, K), b = core.bearing(box, W), phA = core.bearingToAngle(b, PH_FOV) * DEG, linA = b * 31 * DEG;
    var rayTo = function (ang, len, color, width, dash) { ui.line(x, [[ox, oy], [MX(Math.sin(ang) * len), MZ(Math.cos(ang) * len)]], color, width, dash); };
    var len = Math.min(5.3, Math.hypot(P.x, P.z) * 1.15);
    if (Math.abs(b) <= 1.6) { rayTo(linA, len, C.gold, 2, [6, 5]); rayTo(phA, len, C.red, 2.5); }
    rayTo(trueA, Math.hypot(P.x, P.z), C.grn, 2.5);
    // ghost duck where the placeholder points, at the duck's distance
    if (Math.abs(b) <= 1.6) {
      var gx = P.z * Math.tan(phA), gxp = MX(gx), gzp = MZ(P.z);
      x.save(); x.globalAlpha = 0.45; topDuck(x, gxp, gzp, 11, "#F4B7A7"); x.restore();
      x.strokeStyle = C.red; x.lineWidth = 3; x.beginPath(); x.moveTo(MX(P.x), gzp - 22); x.lineTo(gxp, gzp - 22); x.stroke();
      txt(x, fmt(Math.abs(gx - P.x) * 100, 0) + " cm off", (MX(P.x) + gxp) / 2, gzp - 32, "#A5321F", "center", 12);
    }
    // the duck
    topDuck(x, MX(P.x), MZ(P.z), 13, C.duck);
    if (dragging) { x.strokeStyle = C.acc; x.lineWidth = 2; x.setLineDash([3, 3]); x.beginPath(); x.arc(MX(P.x), MZ(P.z), 20, 0, 7); x.stroke(); x.setLineDash([]); }
    var lside = P.x >= 0 ? -1 : 1, lal = P.x >= 0 ? "right" : "left";
    txt(x, "drag me", MX(P.x) + lside * 18, MZ(P.z) - 12, C.dim, lal, 12);
    // the camera
    x.fillStyle = "#1B2226"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(ox, oy, 8, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.glass; x.beginPath(); x.arc(ox + 2, oy - 2, 3, 0, 7); x.fill();
    txt(x, "camera, looking up the page", ox + 14, oy - 2, C.txt, "left", 12);
    txt(x, "true " + deg(trueA / DEG, 1), MX(P.x) + lside * 18, MZ(P.z) + 6, "#3B7422", lal, 12);
  });
  dragOn($("s5map"), function (p) {
    dragging = true;
    var h = p.h, w = p.w, sc = Math.min((w - 20) / 6.2, (h - 40) / 5.5), ox = w / 2, oy = h - 22;
    P.x = core.clamp((p.px - ox) / sc, -3, 3); P.z = core.clamp((oy - p.py) / sc, 0.5, 5);
    P.x = Math.round(P.x * 100) / 100; P.z = Math.round(P.z * 100) / 100; pUpdate();
  }, function () { dragging = false; pUpdate(); touch(); });
  $("s5map").addEventListener("keydown", function (e) {
    var dx = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0, dz = e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0;
    if (dx || dz) { P.x = core.clamp(P.x + dx, -3, 3); P.z = core.clamp(P.z + dz, 0.5, 5); pUpdate(); touch(); e.preventDefault(); }
  });
  ui.range("s5x", function (e) { P.x = +e.target.value; pUpdate(); touch(); });
  ui.range("s5z", function (e) { P.z = +e.target.value; pUpdate(); touch(); });
  var segMode = ui.seg("s5mode", [{ v: "full", label: "full-width 16:9 (widest possible)" }, { v: "crop1080", label: "1920×1080 centre crop (hypothetical)" }], P.mode, function (v) { P.mode = v; st.mode = v; ui.save(); pUpdate(); touch(); });
  ui.qa("#s5presets [data-b]").forEach(function (btn) { btn.onclick = function () { setForBearing(+btn.dataset.b, +btn.dataset.z); pUpdate(); touch(); }; });
  setForBearing(0.5, 3); pUpdate();
  void segMode;

  /* ================= B · the sensor-mode puzzle ================= */
  var S = { mode: "full" };
  function sUpdate() {
    var K = MODEK[S.mode], m = core.MODES[S.mode], px3 = core.pixelSize(0.25, 3, K.f), lb = core.letterboxFit(W, H, core.CAM.input);
    $("s5fovlr").textContent = deg(K.fovLR, 2); $("s5fovv").textContent = deg(K.fovV, 2); $("s5f").textContent = fmt(K.f, 1) + " px";
    $("s5duckpx").textContent = fmt(px3, 1) + " px"; $("s5duckin").textContent = fmt(px3 * lb.scale, 1) + " px";
    $("s5smath").innerHTML = '<div class="eq">FOV of a crop = 2 · atan(tan(62° ÷ 2) · crop ÷ 3280) · f = (H ÷ 2) ÷ tan(FOV<sub>V</sub> ÷ 2)</div>' +
      '<div class="eqn">up–down (the long side after the turn): 2 · atan(' + fmt(Math.tan(31 * DEG), 4) + ' × ' + m.cropW + ' ÷ 3280) = <b>' + deg(K.fovV, 2) + '</b> · left–right: 2 · atan(' + fmt(Math.tan(31 * DEG), 4) + ' × ' + m.cropH + ' ÷ 3280) = <b>' + deg(K.fovLR, 2) + '</b></div>' +
      '<div class="eqn">f = 640 ÷ tan(' + deg(K.fovV / 2, 2) + ') = <b>' + fmt(K.f, 1) + ' px</b> · a 0.25 m duck at 3 m: ' + fmt(K.f, 1) + ' × 0.25 ÷ 3 = <b>' + fmt(px3, 1) + ' px</b> tall in the frame, × ' + lb.scale + ' = <b>' + fmt(px3 * lb.scale, 1) + ' px</b> in the 320 input</div>' +
      '<div class="eqn">ceiling for any 16:9 frame: 2 · atan(' + fmt(Math.tan(31 * DEG), 4) + ' × 1845 ÷ 3280) = <b>' + deg(core.maxLrFov(), 2) + '</b> · the whole 4:3 short side would be ' + deg(core.cropFov(core.CAM.sensorH), 1) + ', unreachable · 62° is up–down now</div>';
    drawers.s5sensor(); drawers.s5fovbar();
  }
  drawers.s5sensor = ui.drawer("s5sensor", function () {
    var g = ui.ctxFor("s5sensor"), x = g.x, w = g.w, K = MODEK[S.mode], m = core.MODES[S.mode];
    var sw = core.CAM.sensorW, sh = core.CAM.sensorH, k = Math.min((w * 0.5) / sw, 200 / sh), sx = 16, sy = 30;
    x.textBaseline = "middle";
    // the sensor
    x.fillStyle = "#C9D2D7"; x.strokeStyle = C.ink; x.lineWidth = 2; x.fillRect(sx, sy, sw * k, sh * k); x.strokeRect(sx, sy, sw * k, sh * k);
    txt(x, "IMX219 active area 3280 × 2464 (4:3)", sx, sy - 14, C.txt, "left", 13);
    // the crop
    var cx0 = sx + (sw - m.cropW) / 2 * k, cy0 = sy + (sh - m.cropH) / 2 * k;
    x.fillStyle = "rgba(159,211,214,.9)"; x.fillRect(cx0, cy0, m.cropW * k, m.cropH * k); x.strokeStyle = "#0F4447"; x.lineWidth = 2.5; x.strokeRect(cx0, cy0, m.cropW * k, m.cropH * k);
    txt(x, m.cropW + " × " + m.cropH + " (16:9)", cx0 + m.cropW * k / 2, cy0 + m.cropH * k / 2 - 8, "#0F4447", "center", 13);
    txt(x, "→ scaled to 1280 × 720", cx0 + m.cropW * k / 2, cy0 + m.cropH * k / 2 + 10, "#0F4447", "center", 12);
    // 62° across the long side
    x.strokeStyle = C.ink; x.lineWidth = 1.2; x.beginPath(); x.moveTo(sx, sy + sh * k + 12); x.lineTo(sx + sw * k, sy + sh * k + 12); x.stroke();
    txt(x, "62° across the full 3280 (the doc's figure)", sx + sw * k / 2, sy + sh * k + 26, C.txt, "center", 12);
    // thrown-away rows, hatched
    x.save(); x.beginPath(); x.rect(sx, sy, sw * k, cy0 - sy); x.rect(sx, cy0 + m.cropH * k, sw * k, sy + sh * k - cy0 - m.cropH * k); if (m.cropW < sw) { x.rect(sx, sy, cx0 - sx, sh * k); x.rect(cx0 + m.cropW * k, sy, sx + sw * k - cx0 - m.cropW * k, sh * k); } x.clip();
    x.strokeStyle = "rgba(74,46,30,.35)"; x.lineWidth = 1; for (var hx = sx - 200; hx < sx + sw * k + 200; hx += 9) { x.beginPath(); x.moveTo(hx, sy + sh * k); x.lineTo(hx + 200, sy); x.stroke(); } x.restore();
    // the quarter turn arrow
    var ax = sx + sw * k + 24, ay = sy + sh * k / 2;
    x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(ax + 14, ay, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.fillStyle = C.ink; x.beginPath(); x.moveTo(ax + 30, ay - 6); x.lineTo(ax + 24, ay - 14); x.lineTo(ax + 34, ay - 15); x.closePath(); x.fill();
    txt(x, "quarter turn", ax + 14, ay + 20, C.txt, "center", 12);
    // the turned frame: portrait, 720 × 1280 at a scale that fits
    var fw = 720, fh = 1280, kk = Math.min((w - ax - 100) / fw, 180 / fh), fx0 = ax + 62, fy0 = sy + (sh * k - fh * kk) / 2;
    if (fy0 < 8) fy0 = 8;
    x.fillStyle = "rgba(159,211,214,.9)"; x.strokeStyle = "#0F4447"; x.lineWidth = 2.5; x.fillRect(fx0, fy0, fw * kk, fh * kk); x.strokeRect(fx0, fy0, fw * kk, fh * kk);
    // the duck inside at 3 m, to scale
    var box = core.objectBox({ kind: "microduck", x: 0, z: 3 }, K), bb = [fx0 + box[0] * kk, fy0 + box[1] * kk, fx0 + box[2] * kk, fy0 + box[3] * kk];
    ui.drawMicroduck(x, bb);
    txt(x, "720 × 1280", fx0 + fw * kk / 2, fy0 + 12, "#0F4447", "center", 12);
    txt(x, fmt(core.pixelSize(0.25, 3, K.f), 0) + " px", bb[2] + 4, (bb[1] + bb[3]) / 2, C.txt, "left", 12);
    // spans
    x.strokeStyle = C.ink; x.lineWidth = 1.2; x.beginPath(); x.moveTo(fx0, fy0 + fh * kk + 10); x.lineTo(fx0 + fw * kk, fy0 + fh * kk + 10); x.stroke();
    txt(x, "left–right " + deg(K.fovLR, 1), fx0 + fw * kk / 2, fy0 + fh * kk + 24, "#A5321F", "center", 12);
    x.beginPath(); x.moveTo(fx0 + fw * kk + 10, fy0); x.lineTo(fx0 + fw * kk + 10, fy0 + fh * kk); x.stroke();
    x.save(); x.translate(fx0 + fw * kk + 24, fy0 + fh * kk / 2); x.rotate(-Math.PI / 2); txt(x, "up–down " + deg(K.fovV, 1), 0, 0, C.txt, "center", 12); x.restore();
  });
  drawers.s5fovbar = ui.drawer("s5fovbar", function () {
    var g = ui.ctxFor("s5fovbar"), x = g.x, w = g.w, L = 16, R = w - 16, y = 70, X = function (d) { return L + d / 70 * (R - L); };
    x.textBaseline = "middle";
    x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke();
    for (var d = 0; d <= 70; d += 10) { x.beginPath(); x.moveTo(X(d), y); x.lineTo(X(d), y + 6); x.stroke(); txt(x, d + "°", X(d), y + 16, C.dim, "center", 11); }
    // reachable band for 16:9 frames
    x.fillStyle = "rgba(31,111,116,.15)"; x.fillRect(X(0), y - 12, X(core.maxLrFov()) - X(0), 12);
    txt(x, "reachable by a 16:9 frame", (X(0) + X(core.maxLrFov())) / 2, y - 22, "#0F4447", "center", 11);
    var marks = [
      { d: core.maxLrFov(), l: "ceiling " + deg(core.maxLrFov(), 2) + " for any 16:9 frame", c: "#0F4447", y: 30, al: "left", dx: 4 },
      { d: 62, l: "62°: the long axis, now up–down", c: "#A5321F", y: 12, al: "right", dx: -4 },
      { d: core.cropFov(core.CAM.sensorH), l: "whole 4:3 short side " + deg(core.cropFov(core.CAM.sensorH), 1) + ": unreachable for 16:9", c: C.dim, y: 122, al: "center", dx: 0 }
    ];
    marks.forEach(function (mk) { x.strokeStyle = mk.c; x.lineWidth = 1.5; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(X(mk.d), mk.y > y ? y : y - 8); x.lineTo(X(mk.d), mk.y > y ? mk.y - 8 : mk.y + 7); x.stroke(); x.setLineDash([]); txt(x, mk.l, X(mk.d) + mk.dx, mk.y, mk.c, mk.al, 12); });
    var K = MODEK[S.mode];
    x.fillStyle = C.acc; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(X(K.fovLR), y); x.lineTo(X(K.fovLR) - 8, y - 14); x.lineTo(X(K.fovLR) + 8, y - 14); x.closePath(); x.fill(); x.stroke();
    txt(x, "your mode: " + deg(K.fovLR, 2), X(K.fovLR), y + 34, "#0F4447", "center", 13);
  });
  ui.seg("s5smode", [{ v: "full", label: "full-width crop 3280×1845" }, { v: "crop1080", label: "1920×1080 centre crop" }], "full", function (v) { S.mode = v; sUpdate(); touch(); });
  sUpdate();

  /* ================= C · the 25 px check ================= */
  var Q = { z: 3 }, F266 = core.focalFromFov(core.CAM.input, PH_FOV), LB = core.letterboxFit(W, H, core.CAM.input);
  function qUpdate() {
    var ang = 2 * Math.atan(0.125 / Q.z) / DEG, ppd = core.CAM.input * ang / PH_FOV, pin = core.pixelSize(0.25, Q.z, F266), Kf = MODEK.full, port = core.pixelSize(0.25, Q.z, Kf.f) * LB.scale, fport = core.focalFromFov(LB.fw, Kf.fovLR);
    $("s5dv").textContent = fmt(Q.z, 1) + " m";
    $("s5ppd").textContent = fmt(ppd, 1) + " px"; $("s5pin").textContent = fmt(pin, 1) + " px"; $("s5port").textContent = fmt(port, 1) + " px";
    $("s5dmath").innerHTML = '<div class="eq">the duck\'s angle = 2 · atan(0.125 ÷ Z)</div>' +
      '<div class="eqn">2 · atan(0.125 ÷ ' + fmt(Q.z, 1) + ') = <b>' + deg(ang, 2) + '</b></div>' +
      '<div class="eq">① pixels per degree: 320 px ÷ 62° × angle</div><div class="eqn">5.16 px/° × ' + deg(ang, 2) + ' = <b>' + fmt(ppd, 1) + ' px</b> (the doc\'s "~25")</div>' +
      '<div class="eq">② pinhole, 320 px across 62°: f · size ÷ Z</div><div class="eqn">f = 160 ÷ tan 31° = ' + fmt(F266, 1) + ' · ' + fmt(F266, 1) + ' × 0.25 ÷ ' + fmt(Q.z, 1) + ' = <b>' + fmt(pin, 1) + ' px</b></div>' +
      '<div class="eq">③ the portrait mount: f · size ÷ Z in the 720×1280 frame, × 0.25 into the 180-px picture area</div><div class="eqn">' + fmt(Kf.f, 1) + ' × 0.25 ÷ ' + fmt(Q.z, 1) + ' = ' + fmt(port / LB.scale, 1) + ' px, × 0.25 = <b>' + fmt(port, 1) + ' px</b> (same as ②: f for 180 px across ' + deg(Kf.fovLR, 2) + ' is ' + fmt(fport, 1) + ')</div>';
    drawers.s5input();
  }
  drawers.s5input = ui.drawer("s5input", function () {
    var g = ui.ctxFor("s5input"), x = g.x, w = g.w, size = core.CAM.input, k = Math.min((w - 140) / size, (g.h - 16) / size), x0 = 10, y0 = (g.h - size * k) / 2, Kf = MODEK.full;
    x.textBaseline = "middle";
    x.fillStyle = C.grey114; x.fillRect(x0, y0, size * k, size * k); x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(x0, y0, size * k, size * k);
    x.fillStyle = "#EFE3CB"; x.fillRect(x0 + LB.padX * k, y0, LB.fw * k, LB.fh * k);
    var scene = { seed: 1, objects: [{ kind: "microduck", x: 0, z: Q.z }] }, box = core.objectBox(scene.objects[0], Kf), ib = core.boxToInput(box, LB);
    // floor line for context
    var wallV = Kf.cy + Kf.f * core.CAM.camHeight / core.WALL_Z, iw = core.toInput(0, wallV, LB).y;
    x.fillStyle = "#C89B6A"; x.fillRect(x0 + LB.padX * k, y0 + iw * k, LB.fw * k, (LB.fh - iw) * k);
    ui.drawMicroduck(x, [x0 + ib[0] * k, y0 + ib[1] * k, x0 + ib[2] * k, y0 + ib[3] * k]);
    // bracket for the duck's height
    var bx = x0 + ib[2] * k + 6; x.strokeStyle = C.red; x.lineWidth = 2; x.beginPath(); x.moveTo(bx, y0 + ib[1] * k); x.lineTo(bx + 6, y0 + ib[1] * k); x.lineTo(bx + 6, y0 + ib[3] * k); x.lineTo(bx, y0 + ib[3] * k); x.stroke();
    var lab = fmt(ib[3] - ib[1], 1) + " px tall", ly = y0 + (ib[1] + ib[3]) / 2 * k;
    x.font = "14px " + HAND; var lw = x.measureText(lab).width; x.fillStyle = "rgba(255,253,246,.9)"; x.fillRect(bx + 8, ly - 9, lw + 8, 18);
    txt(x, lab, bx + 12, ly, "#A5321F", "left", 14);
    txt(x, "70 px", x0 + LB.padX * k / 2, y0 + 12, "#FFFDF6", "center", 11); txt(x, "70 px", x0 + size * k - LB.padX * k / 2, y0 + 12, "#FFFDF6", "center", 11);
    txt(x, "grey", x0 + LB.padX * k / 2, y0 + 26, "#FFFDF6", "center", 11); txt(x, "grey", x0 + size * k - LB.padX * k / 2, y0 + 26, "#FFFDF6", "center", 11);
    txt(x, "180 px of picture", x0 + size * k / 2, y0 + size * k - 10, C.txt, "center", 12);
    txt(x, "320 × 320 model input", x0 + size * k + 14, y0 + size * k - 8, C.dim, "left", 12);
  });
  ui.range("s5d", function (e) { Q.z = +e.target.value; qUpdate(); touch(); });
  qUpdate();

  /* ================= D · depth is lost ================= */
  var Dd = { X: 0.5, Y: -0.2, Z: 3.0, k: 2 }, K2 = { f: F266, cx: 160, cy: 120 };
  function dUpdate() {
    var p1 = core.project(Dd.X, Dd.Y, Dd.Z, K2), p2 = core.project(Dd.X * Dd.k, Dd.Y * Dd.k, Dd.Z * Dd.k, K2);
    $("s5Xv").textContent = ui.sgn(Dd.X, 2) + " m"; $("s5Yv").textContent = ui.sgn(Dd.Y, 2) + " m"; $("s5Zv").textContent = fmt(Dd.Z, 2) + " m"; $("s5kv").textContent = "× " + fmt(Dd.k, 2);
    $("s5p1").textContent = "(" + mf(p1.u, 1) + ", " + mf(p1.v, 1) + ")"; $("s5p2").textContent = "(" + mf(p2.u, 1) + ", " + mf(p2.v, 1) + ")";
    $("s5pmath").innerHTML = '<div class="eq">u = c<sub>x</sub> + f · X ÷ Z · v = c<sub>y</sub> + f · Y ÷ Z</div>' +
      '<div class="eqn">(' + mf(Dd.X, 2) + ', ' + mf(Dd.Y, 2) + ', ' + fmt(Dd.Z, 2) + '): u = 160 + ' + fmt(K2.f, 1) + ' × ' + mf(Dd.X / Dd.Z, 4) + ' = <b>' + mf(p1.u, 1) + '</b> · v = 120 + ' + fmt(K2.f, 1) + ' × ' + mf(Dd.Y / Dd.Z, 4) + ' = <b>' + mf(p1.v, 1) + '</b></div>' +
      '<div class="eqn">× ' + fmt(Dd.k, 2) + ' → (' + mf(Dd.X * Dd.k, 2) + ', ' + mf(Dd.Y * Dd.k, 2) + ', ' + fmt(Dd.Z * Dd.k, 2) + '): X ÷ Z is still ' + mf(Dd.X / Dd.Z, 4) + ' → u = <b>' + mf(p2.u, 1) + '</b>, v = <b>' + mf(p2.v, 1) + '</b> · <b class="ok">same pixel</b>, ' + fmt(Dd.k, 2) + '× as far</div>' +
      '<div class="eqn">the matrix way: K · [X, Y, Z]ᵀ = [' + mf(K2.f * Dd.X + K2.cx * Dd.Z, 1) + ', ' + mf(K2.f * Dd.Y + K2.cy * Dd.Z, 1) + ', ' + fmt(Dd.Z, 2) + '], ÷ ' + fmt(Dd.Z, 2) + ' → (' + mf(p1.u, 1) + ', ' + mf(p1.v, 1) + ') ✓</div>';
    drawers.s5depth();
  }
  drawers.s5depth = ui.drawer("s5depth", function () {
    var g = ui.ctxFor("s5depth"), x = g.x, w = g.w, h = g.h;
    x.textBaseline = "middle";
    // left: top-down (X vs Z) with the pinhole at the origin and the image plane at Z = f (drawn at a fixed screen distance)
    var lw = Math.min(w * 0.6, w - 150), ox = 40, oy = h / 2, zmax = Math.max(6.5, Dd.Z * Dd.k * 1.15), sz = (lw - 40) / zmax, sx = sz;
    var PX = function (Z) { return ox + Z * sz; }, PY = function (X) { return oy + X * sx * 0.9; };
    x.strokeStyle = "rgba(74,46,30,.15)"; x.lineWidth = 1; for (var z = 1; z <= zmax; z++) { x.beginPath(); x.moveTo(PX(z), 10); x.lineTo(PX(z), h - 10); x.stroke(); }
    x.strokeStyle = C.ink; x.lineWidth = 1.5; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + lw - 30, oy); x.stroke(); x.setLineDash([]);
    txt(x, "optical axis (Z)", ox + lw - 34, oy + 12, C.dim, "right", 11);
    // image plane at a fixed 0.6 m for drawing (f in metres would be tiny); labelled
    var fz = 0.6, ipx = PX(fz);
    x.strokeStyle = C.acc; x.lineWidth = 3; x.beginPath(); x.moveTo(ipx, oy - 60); x.lineTo(ipx, oy + 60); x.stroke();
    txt(x, "image plane, f", ipx, oy - 70, "#0F4447", "center", 12);
    // the two points and the ray
    var P1 = [Dd.X, Dd.Z], P2 = [Dd.X * Dd.k, Dd.Z * Dd.k], far = P2[1] >= P1[1] ? P2 : P1;
    ui.line(x, [[ox, oy], [PX(far[1]), PY(far[0])]], C.gold, 2, [6, 4]);
    var hit = [fz, Dd.X / Dd.Z * fz];
    x.fillStyle = C.red; x.beginPath(); x.arc(PX(hit[0]), PY(hit[1]), 5, 0, 7); x.fill(); x.strokeStyle = C.ink; x.lineWidth = 1.5; x.stroke();
    [[P1, "#3B7422", "(X, Y, Z)"], [P2, C.acc, "× " + fmt(Dd.k, 2)]].forEach(function (e) { x.fillStyle = e[1]; x.beginPath(); x.arc(PX(e[0][1]), PY(e[0][0]), 7, 0, 7); x.fill(); x.strokeStyle = C.ink; x.lineWidth = 1.5; x.stroke(); txt(x, e[2], PX(e[0][1]), PY(e[0][0]) - 16, e[1], "center", 12); });
    x.fillStyle = "#1B2226"; x.beginPath(); x.arc(ox, oy, 7, 0, 7); x.fill(); x.strokeStyle = C.ink; x.stroke(); txt(x, "pinhole", ox, oy + 18, C.txt, "center", 12);
    txt(x, "top-down: X across, Z along", ox, 12, C.dim, "left", 12);
    // right: the 320×240 image with the pixel
    var iw = 120, ih = 90, ix = w - iw - 12, iy = (h - ih) / 2;
    x.fillStyle = "#FFFDF6"; x.fillRect(ix, iy, iw, ih); x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(ix, iy, iw, ih);
    x.strokeStyle = "rgba(74,46,30,.25)"; x.lineWidth = 1; x.beginPath(); x.moveTo(ix + iw / 2, iy); x.lineTo(ix + iw / 2, iy + ih); x.moveTo(ix, iy + ih / 2); x.lineTo(ix + iw, iy + ih / 2); x.stroke();
    var p1 = core.project(Dd.X, Dd.Y, Dd.Z, K2), px = ix + core.clamp(p1.u, 0, 320) / 320 * iw, py = iy + core.clamp(p1.v, 0, 240) / 240 * ih;
    x.fillStyle = C.acc; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.fillStyle = "#3B7422"; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.strokeStyle = C.ink; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 9, 0, 7); x.stroke();
    txt(x, "320 × 240 image", ix + iw / 2, iy - 10, C.dim, "center", 12);
    txt(x, "both at (" + fmt(p1.u, 1) + ", " + fmt(p1.v, 1) + ")", ix + iw / 2, iy + ih + 12, C.txt, "center", 12);
  });
  ["X", "Y", "Z", "k"].forEach(function (kk) { ui.range("s5" + kk, function (e) { Dd[kk] = +e.target.value; dUpdate(); touch(); }); });
  $("s5dpre").onclick = function () { Dd = { X: 0.5, Y: -0.2, Z: 3.0, k: 2 }; ["X", "Y", "Z", "k"].forEach(function (kk) { $("s5" + kk).value = Dd[kk]; }); dUpdate(); touch(); };
  dUpdate();
});
