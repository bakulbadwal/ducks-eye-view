/* Duck's-Eye View — step 6 "How Far?": known-size ambiguity, stereo, the 8×8 ToF, relative vs metric depth,
   and the camera + ToF + BLE fusion toy. The ToF beam table and filters are ported from
   pollen-robotics/microduck kinematics/src/tof.rs @ 590b986 (lines 97-119 and 162-196). */
(function (root) {
  "use strict";
  var DEG = Math.PI / 180;
  // tof.rs:27-34, 97-101: 8×8 zones over 45°×45°, floor safety 0.85, returns under 0.10 m dropped.
  var TOF = { rows: 8, cols: 8, fov: 45, floorSafety: 0.85, minRange: 0.10, maxRange: 4.0 };
  // tof.rs:104-119: zone centres evenly spread with a half-zone inset. Sensor frame +x forward, +y left, +z up.
  function beams() {
    var half = (TOF.fov / 2 - TOF.fov / TOF.cols / 2) * DEG, step = 2 * half / (TOF.cols - 1), out = [];
    for (var i = 0; i < TOF.rows * TOF.cols; i++) {
      var el = half - Math.floor(i / TOF.cols) * step, az = half - (i % TOF.cols) * step;
      out.push([Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]);
    }
    return { dirs: out, halfDeg: half / DEG, stepDeg: step / DEG };
  }
  // The head pitched down by `deg` (a rotation about the sensor's y axis): forward tips toward −z.
  function pitched(b, deg) { var p = deg * DEG, c = Math.cos(p), s = Math.sin(p); return [b[0] * c + b[2] * s, b[1], -b[0] * s + b[2] * c]; }
  // Ray from o along unit d against an axis-aligned box {lo:[x,y,z], hi:[x,y,z]}: distance to entry, or null.
  function rayBox(o, d, box) {
    var tmin = -Infinity, tmax = Infinity;
    for (var a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (o[a] < box.lo[a] || o[a] > box.hi[a]) return null; continue; }
      var t1 = (box.lo[a] - o[a]) / d[a], t2 = (box.hi[a] - o[a]) / d[a];
      if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return Math.max(tmin, 0);
  }
  // One scan. objects: [{x: metres right, z: metres ahead, w, d, h}] standing on the floor; hs: sensor height (m).
  // Returns 64 zones {kind: "empty"|"floor"|"close"|"hit", r (slant), range (horizontal), pt:[right, ahead, up]}, row-major.
  function scan(objects, hs, pitchDeg) {
    var B = beams(), zones = [];
    var boxes = objects.map(function (o) { return { lo: [o.z - o.d / 2, -o.x - o.w / 2, 0], hi: [o.z + o.d / 2, -o.x + o.w / 2, o.h], o: o }; });
    for (var i = 0; i < B.dirs.length; i++) {
      var dir = pitched(B.dirs[i], pitchDeg), o = [0, 0, hs], r = null, hitObj = null;
      boxes.forEach(function (bx) { var t = rayBox(o, dir, bx); if (t != null && t <= TOF.maxRange && (r == null || t < r)) { r = t; hitObj = bx.o; } });
      if (r == null && dir[2] < 0) { var tf = hs / -dir[2]; if (tf <= TOF.maxRange) r = tf; }
      var z = { kind: "empty", r: null, range: null, pt: null, obj: null, dir: dir };
      if (r != null) {
        var pt = [-(o[1] + r * dir[1]), o[0] + r * dir[0], o[2] + r * dir[2]];   // → right, ahead, up
        var downward = -dir[2], horizontal = r * Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
        z.r = r; z.pt = pt; z.obj = hitObj;
        if (hs > 0 && downward > 0 && r * downward >= hs * TOF.floorSafety) z.kind = "floor";          // tof.rs:182-184
        else if (horizontal < TOF.minRange) z.kind = "close";                                          // tof.rs:186-189
        else { z.kind = "hit"; z.range = horizontal; }                                                 // tof.rs:191-194
      }
      zones.push(z);
    }
    return zones;
  }
  function zoneWidth(Z) { return 2 * Z * Math.tan((TOF.fov / TOF.cols / 2) * DEG); }
  // Scale-and-shift-invariant normalisation (U8b page 8.7): subtract the median, divide by the mean absolute deviation.
  function normalise(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; }), n = s.length, med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    var mad = arr.reduce(function (acc, v) { return acc + Math.abs(v - med); }, 0) / n || 1;
    return { med: med, mad: mad, out: arr.map(function (v) { return (v - med) / mad; }) };
  }
  function relLoss(truth, pred) { var a = normalise(truth).out, b = normalise(pred).out, s = 0; for (var i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }
  var M = { TOF: TOF, beams: beams, pitched: pitched, rayBox: rayBox, scan: scan, zoneWidth: zoneWidth, normalise: normalise, relLoss: relLoss };
  root.DEV_S6 = M;
  if (typeof module !== "undefined" && module.exports) module.exports = M;
})(typeof window !== "undefined" ? window : globalThis);

if (typeof DEV !== "undefined" && DEV.step) DEV.step("s6", function (ui, core) {
  "use strict";
  Object.assign(window.DEV_GLOSSARY, {
    stereo: ["Stereo vision", "Two cameras a known distance apart see the same point at different pixels. The shift between them gives the depth by triangulation: Z = f·B ÷ d.", "Two eyes on a bar. Microduck has one."],
    disparity: ["Disparity", "How many pixels a point shifts between the left and right images. Big for near things, small for far things; depth is inversely proportional to it.", "How far the sticky note jumps when you close one eye, then the other."],
    baseline: ["Baseline (B)", "The distance between the two cameras of a stereo rig. A longer baseline gives more disparity, so better depth at range.", "The length of the bar the two eyes sit on."],
    monodepth: ["Monocular depth estimation", "A network that predicts a depth map from a single image, using cues like size, perspective and occlusion. Most general models give relative depth (ordering), not metres.", "A clerk guessing distances from one photo."],
    knownsize: ["Known-size cue", "If you know an object's real height H and see it h pixels tall, Z = f·H ÷ h. It is the pinhole run backwards, and it only works if you know what the object is.", "Measuring the room with a ruler you recognise."],
    scaleshift: ["Scale-and-shift ambiguity", "A depth map is known only up to an unknown factor (scale) and offset (shift). Models trained with a scale-and-shift-invariant loss can't recover either; they learn shape, not metres.", "A map with no scale bar and no origin."],
    ble: ["BLE beacon", "A small Bluetooth Low Energy transmitter each duck carries. Its ID says which duck is present; signal strength is only a rough hint of range.", "The radio mast: it says who, not where."],
    fusion: ["Sensor fusion", "Combining senses that are each good at one thing: here the camera for direction, the ToF for distance and BLE for identity.", "Three ducklings comparing notes before the neck crank turns."],
    floorfilter: ["Floor filter", "In tof.rs: a downward beam whose range times its downward component reaches 85% of the sensor's height above the floor hit the floor, not an obstacle.", "The tape measure ignoring the ground it is standing on."]
  });
  DEV.navIcon("s6", "tape");
  var $ = ui.$, fmt = ui.fmt, C = ui.C, M = window.DEV_S6, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), CAM = core.CAM;
  var st = ui.store.s.s6 = ui.store.s.s6 || {};
  var REDUCED = false; try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function touch() { ui.touch("s6"); }
  function save() { ui.save(); }
  function cite(k) { return MD.cite(k); }

  /* ================= 1 · small and near, or big and far ================= */
  var near = st.near = st.near || { z: 2 };
  var nearOff = document.createElement("canvas"), nearGts = null;
  function nearScene() { return { seed: 61, objects: [{ kind: "rubber", x: -0.13 * near.z, z: near.z }, { kind: "microduck", x: 0.45, z: 3 }] }; }
  function drawNear() {
    var cam = $("s6ncam"), sc = nearScene(), s = 0.35;
    var r = ui.renderRoom(cam, sc, K, { scale: s }); nearGts = r.gts;
    var x = cam.getContext("2d"); x.setTransform(s, 0, 0, s, 0, 0); x.font = "36px 'Patrick Hand', sans-serif"; x.textBaseline = "bottom";
    r.gts.forEach(function (g) {
      var b = g.box, h = b[3] - b[1], col = g.isDuck ? C.acc : C.red;
      ui.boxPath(x, b, col, 6);
      var lab = fmt(h, 1) + " px"; x.fillStyle = col; x.textAlign = "left";
      x.fillText(lab, Math.min(b[0], CAM.W - 150), Math.max(b[1] - 8, 40));
    });
    x.setTransform(1, 0, 0, 1, 0, 0);
    ui.renderRoom(nearOff, sc, K, { scale: 0.5 });
    drawCrops();
  }
  function drawCrops() {
    if (!nearGts) return;
    var span = 300;   // full-frame pixels shown in each crop, so both use one magnification
    var byKind = function (k) { return nearGts.filter(function (gg) { return gg.kind === k; })[0]; };   // renderRoom sorts far to near
    [["s6ncropA", byKind("rubber")], ["s6ncropB", byKind("microduck")]].forEach(function (p) {
      if (!p[1]) return;
      var g = ui.ctxFor(p[0]), x = g.x, b = p[1].box, cy = (b[1] + b[3]) / 2, cx = (b[0] + b[2]) / 2;
      var mag = g.h / span, sw = g.w / mag, sh = span;
      var sx0 = core.clamp(cx - sw / 2, 0, CAM.W - sw), sy0 = core.clamp(cy - sh / 2, 0, CAM.H - sh);
      x.imageSmoothingEnabled = false;
      x.drawImage(nearOff, sx0 * 0.5, sy0 * 0.5, sw * 0.5, sh * 0.5, 0, 0, g.w, g.h);
      x.strokeStyle = p[1].isDuck ? C.acc : C.red; x.lineWidth = 2;
      x.strokeRect((b[0] - sx0) * mag, (b[1] - sy0) * mag, (b[2] - b[0]) * mag, (b[3] - b[1]) * mag);
      x.fillStyle = C.dim; x.textAlign = "right"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText(fmt(span) + " frame px tall", g.w - 6, g.h - 10);
    });
  }
  function updNear() {
    var z = near.z, h1 = core.pixelSize(0.10, z, K.f), h2 = core.pixelSize(0.25, 3, K.f), same = Math.abs(h1 - h2) < 0.6;
    $("s6nzv").textContent = fmt(z, 2) + " m";
    $("s6nh1").textContent = fmt(h1, 1) + " px"; $("s6nh2").textContent = fmt(h2, 1) + " px";
    $("s6ni1").textContent = fmt(h1 * 0.25, 1) + " px"; $("s6ni2").textContent = fmt(h2 * 0.25, 1) + " px";
    var zRead = K.f * 0.25 / h1;
    $("s6nmath").innerHTML = '<div class="eq">h = f · H ÷ Z</div><div class="eqn">rubber duck: 1065.1 × 0.10 ÷ ' + fmt(z, 2) + ' = <b>' + fmt(h1, 1) + ' px</b> · Microduck: 1065.1 × 0.25 ÷ 3.0 = <b>' + fmt(h2, 1) + ' px</b>' + (same ? ' <span class="ok">← the same picture</span>' : '') + '</div>' +
      '<div class="eq" style="margin-top:8px">Known-size cue, run backwards: Z = f · H ÷ h</div><div class="eqn">If the head <i>assumes</i> every duck-shaped box is a 25 cm Microduck: Z = 1065.1 × 0.25 ÷ ' + fmt(h1, 1) + ' = <b>' + fmt(zRead, 2) + ' m</b>, but the rubber duck is at ' + fmt(z, 2) + ' m: <b class="bad">' + fmt(zRead / z, 1) + '× too far</b>. Right formula, wrong ruler.</div>';
    drawNear();
  }
  $("s6nz").value = near.z;
  ui.range("s6nz", function () { near.z = +$("s6nz").value; updNear(); touch(); });
  ui.drawer("s6ncropA", drawCrops);

  /* ================= 2 · stereo ================= */
  var stereo = st.stereo = st.stereo || { f: 452.9, B: 7.5, Z: 94.35, rig: "oak" };
  var RIGS = { oak: { f: 452.9, B: 7.5 }, duck: { f: 266.3, B: 6 } };
  var rigSeg = ui.seg("s6rig", [{ v: "oak", label: "OAK-D Lite (course): f 452.9 px, B 7.5 cm" }, { v: "duck", label: "duck-head rig (hypothetical): f 266.3 px, B 6 cm" }, { v: "custom", label: "custom" }], stereo.rig, function (v) {
    stereo.rig = v; if (RIGS[v]) { stereo.f = RIGS[v].f; stereo.B = RIGS[v].B; $("s6sf").value = stereo.f; $("s6sb").value = stereo.B; }
    updStereo(); touch();
  });
  function isOak() { return Math.abs(stereo.f - 452.9) < 0.05 && Math.abs(stereo.B - 7.5) < 0.01; }
  function updStereo() {
    var f = stereo.f, B = stereo.B, Z = stereo.Z, d = core.stereoDisparity(f, B, Z), err = core.stereoError(f, B, Z, 1);
    var Zoff = core.stereoDepth(f, B, d + 1);
    $("s6sfv").textContent = fmt(f, 1) + " px"; $("s6sbv").textContent = fmt(B, 1) + " cm"; $("s6szv").textContent = fmt(Z, 2) + " cm";
    $("s6sd").textContent = fmt(d, 1) + " px"; $("s6sZ").textContent = fmt(Zoff, 1) + " cm"; $("s6se").textContent = fmt(err, 2) + " cm";
    $("s6sZ").nextElementSibling.textContent = "Z if the match is 1 px off (d + 1)";
    $("s6smath").innerHTML = '<div class="eq">d = f · B ÷ Z &nbsp;·&nbsp; Z = f · B ÷ d</div><div class="eqn">' + fmt(f, 1) + ' × ' + fmt(B, 1) + ' ÷ ' + fmt(Z, 2) + ' = <b>' + fmt(d, 2) + ' px</b> of disparity; f·B = <b>' + fmt(f * B, 1) + '</b> px·cm</div>' +
      '<div class="eq" style="margin-top:8px">ΔZ ≈ Z² ÷ (f · B) per pixel</div><div class="eqn">' + fmt(Z, 2) + '² ÷ ' + fmt(f * B, 1) + ' = <b>' + fmt(err, 2) + ' cm per px</b>' + (d < 2 ? ' <span class="bad">· under 2 px of disparity: the match is one rounding error from nonsense</span>' : '') + '</div>';
    $("s6srobot").innerHTML = '<b>On the robot.</b> Microduck has <b>one camera</b>, so no stereo. The plan gets distance from the ToF instead: ' + MD.facts.fusion.v + ' <span class="muted">(' + cite("fusion") + ')</span>. A hypothetical second eye 6 cm away at the detector’s f ≈ 266 px would see only 5.3 px of disparity at 3 m and be off by 56 cm per pixel (our numbers, from the study guide). Pick the duck-head rig above to see it.';
    ui.redrawAll();
  }
  ["s6sf", "s6sb", "s6sz"].forEach(function (id) {
    $(id).value = { s6sf: stereo.f, s6sb: stereo.B, s6sz: stereo.Z }[id];
    ui.range(id, function () {
      if (id === "s6sz") stereo.Z = +$(id).value; else { stereo[id === "s6sf" ? "f" : "B"] = +$(id).value; stereo.rig = "custom"; rigSeg.set("custom"); }
      updStereo(); touch();
    });
  });
  ui.drawer("s6srig", function () {
    var g = ui.ctxFor("s6srig"), x = g.x, Zmax = 400, top = 18, bot = g.h - 28, cx = g.w / 2;
    var bw = core.clamp(stereo.B * 5, 24, Math.min(160, g.w * 0.45)), py = bot - (bot - top) * stereo.Z / Zmax;
    var eL = cx - bw / 2, eR = cx + bw / 2;
    // distance rule
    x.strokeStyle = C.line; x.lineWidth = 1; x.setLineDash([3, 4]); [100, 200, 300, 400].forEach(function (zc) { var y = bot - (bot - top) * zc / Zmax; x.beginPath(); x.moveTo(10, y); x.lineTo(g.w - 10, y); x.stroke(); x.fillStyle = C.dim; x.textAlign = "left"; x.font = "12px 'Patrick Hand', sans-serif"; x.fillText(zc + " cm", 12, y - 7); }); x.setLineDash([]);
    // rays
    x.strokeStyle = C.acc; x.lineWidth = 2; x.beginPath(); x.moveTo(eL, bot); x.lineTo(cx, py); x.lineTo(eR, bot); x.stroke();
    // eyes
    [eL, eR].forEach(function (ex) { x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(ex, bot, 9, 0, 7); x.fill(); x.stroke(); x.fillStyle = C.acc; x.beginPath(); x.arc(ex, bot, 5, 0, 7); x.fill(); });
    x.strokeStyle = "#B8793F"; x.lineWidth = 5; x.beginPath(); x.moveTo(eL, bot + 12); x.lineTo(eR, bot + 12); x.stroke();
    x.fillStyle = C.txt; x.textAlign = "center"; x.font = "14px 'Patrick Hand', sans-serif"; x.fillText("B = " + fmt(stereo.B, 1) + " cm (drawn wide)", cx, g.h - 4);
    // the point
    x.fillStyle = C.red; x.beginPath(); x.arc(cx, py, 6, 0, 7); x.fill();
    x.fillStyle = C.txt; x.textAlign = "left"; x.fillText("P at Z = " + fmt(stereo.Z, 0) + " cm · d = " + fmt(core.stereoDisparity(stereo.f, stereo.B, stereo.Z), 1) + " px", cx + 12, Math.max(py, top + 6));
  });
  ui.drawer("s6serr", function () {
    var g = ui.ctxFor("s6serr"), x = g.x, pad = { l: 46, r: 14, t: 12, b: 28 }, f = stereo.f, B = stereo.B;
    var emax = core.stereoError(f, B, 400, 1), yhi = Math.min(200, Math.max(8, Math.ceil(emax / 8) * 8));   // quarter ticks stay whole numbers
    ui.axes(g, pad, 0, yhi, 0, 0, 400, 0);
    var sx = function (Z) { return pad.l + (g.w - pad.l - pad.r) * Z / 400; }, sy = function (e) { return pad.t + (g.h - pad.t - pad.b) * (1 - Math.min(e, yhi) / yhi); };
    var pts = []; for (var Z = 20; Z <= 400; Z += 4) pts.push([sx(Z), sy(core.stereoError(f, B, Z, 1))]);
    ui.line(x, pts, C.red, 3);
    x.fillStyle = C.dim; x.textAlign = "left"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText("cm of depth per px", pad.l + 4, pad.t + 2); x.textAlign = "right"; x.fillText("Z, cm", g.w - pad.r, g.h - 4);
    if (isOak()) [[94.35, "2.62 cm @ 94 cm"], [300, "26.5 cm @ 3 m"]].forEach(function (p, i) { var e = core.stereoError(f, B, p[0], 1); x.fillStyle = C.dim; x.beginPath(); x.arc(sx(p[0]), sy(e), 5, 0, 7); x.fill(); x.textAlign = i ? "right" : "left"; x.fillText(p[1], sx(p[0]) + (i ? -8 : 8), sy(e) - 10); });
    var e0 = core.stereoError(f, B, stereo.Z, 1);
    x.fillStyle = C.gold; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(sx(stereo.Z), sy(e0), 7, 0, 7); x.fill(); x.stroke();
  });

  /* ================= 3 · 64 beams ================= */
  var DEF_OBJS = [
    { name: "Microduck", kind: "microduck", x: 0.35, z: 1.4, w: 0.20, d: 0.16, h: 0.25 },
    { name: "rubber duck", kind: "rubber", x: -0.22, z: 0.8, w: 0.11, d: 0.11, h: 0.10 },
    { name: "cardboard box", kind: "box", x: -0.9, z: 2.3, w: 0.45, d: 0.45, h: 0.50 }
  ];
  var tof = st.tof = st.tof || {};
  if (!tof.objects) tof.objects = DEF_OBJS.map(function (o) { return { x: o.x, z: o.z }; });
  if (tof.row == null) tof.row = 4; if (tof.pitch == null) tof.pitch = 0;
  var HS = CAM.camHeight, tofZones = null, tofSel = 0;
  function tofObjs() { return DEF_OBJS.map(function (o, i) { return Object.assign({}, o, tof.objects[i]); }); }
  var rowSeg = ui.seg("s6trow", [0, 1, 2, 3, 4, 5, 6, 7].map(function (r) { return { v: r, label: String(r) }; }), tof.row, function (v) { tof.row = +v; updTof(); touch(); });
  $("s6tp").value = tof.pitch;
  ui.range("s6tp", function () { tof.pitch = +$("s6tp").value; updTof(); touch(); });
  $("s6treset").onclick = function () { tof.objects = DEF_OBJS.map(function (o) { return { x: o.x, z: o.z }; }); updTof(); touch(); };
  var Bt = M.beams();
  function updTof() {
    tofZones = M.scan(tofObjs(), HS, tof.pitch);
    var n = { hit: 0, floor: 0, close: 0, empty: 0 }; tofZones.forEach(function (z) { n[z.kind]++; });
    $("s6tpv").textContent = (tof.pitch > 0 ? "+" : "") + tof.pitch + "°";
    $("s6thit").textContent = n.hit; $("s6tfloor").textContent = n.floor; $("s6tclose").textContent = n.close; $("s6tempty").textContent = n.empty;
    var el = Bt.halfDeg - tof.row * Bt.stepDeg - tof.pitch;
    $("s6tmath").innerHTML = '<div class="eq">beam table (tof.rs:104-119)</div><div class="eqn">half-angle = 45 ÷ 2 − (45 ÷ 8) ÷ 2 = <b>' + fmt(Bt.halfDeg, 4) + '°</b> · step = 2 × ' + fmt(Bt.halfDeg, 4) + ' ÷ 7 = <b>' + fmt(Bt.stepDeg, 3) + '°</b> · row ' + tof.row + ' looks <b>' + fmt(Math.abs(el), 1) + '°</b> ' + (el >= 0 ? 'above' : 'below') + ' the horizon after your pitch</div>' +
      '<div class="eq" style="margin-top:8px">floor rule (tof.rs:182)</div><div class="eqn">range × downward ≥ 0.85 × ' + fmt(HS, 2) + ' m = <b>' + fmt(HS * 0.85, 3) + ' m</b> → "floor" · horizontal &lt; <b>0.10 m</b> → dropped · one zone at 3 m is <b>' + fmt(M.zoneWidth(3), 2) + ' m</b> wide</div>';
    $("s6trobot").innerHTML = '<b>On the robot.</b> ' + MD.facts.tof.v + ' <span class="muted">(' + cite("tof") + ')</span>. ' + MD.facts.tofReproject.v + ' <span class="muted">(' + cite("tofReproject") + ')</span>. The daemon publishes raw slant ranges; the geometry lives in <code>kinematics</code> so clients never link the sensor driver.';
    ui.redrawAll();
  }
  var planGeom = null;
  function planXY(g) { var s = (g.h - 44) / 4.2, x0 = g.w / 2, y0 = g.h - 26; return { s: s, x0: x0, y0: y0, toPx: function (xr, za) { return [x0 + xr * s, y0 - za * s]; }, toM: function (px, py) { return { x: (px - x0) / s, z: (y0 - py) / s }; } }; }
  function zoneColor(z) {
    if (z.kind === "floor") return "#9A9A9A"; if (z.kind === "close") return "#F4B7A7"; if (z.kind === "empty") return "#FFFDF6";
    var t = core.clamp(z.range / 4, 0, 1); var r = Math.round(244 + (255 - 244) * t), gg = Math.round(162 + (233 - 162) * t), b = Math.round(91 + (199 - 91) * t); return "rgb(" + r + "," + gg + "," + b + ")";
  }
  ui.drawer("s6tplan", function () {
    if (!tofZones) return;
    var g = ui.ctxFor("s6tplan"), x = g.x, P = planXY(g); planGeom = P;
    // FOV wedge
    var half = 22.5 * core.DEG;
    x.fillStyle = "#FFF6DC"; x.beginPath(); x.moveTo(P.x0, P.y0); x.lineTo(P.x0 - Math.sin(half) * 4.2 * P.s, P.y0 - Math.cos(half) * 4.2 * P.s); x.arc(P.x0, P.y0, 4.2 * P.s, -Math.PI / 2 - half, -Math.PI / 2 + half); x.closePath(); x.fill();
    x.strokeStyle = C.line; x.lineWidth = 1; x.setLineDash([3, 4]);
    [1, 2, 3, 4].forEach(function (m) { x.beginPath(); x.arc(P.x0, P.y0, m * P.s, -Math.PI / 2 - half, -Math.PI / 2 + half); x.stroke(); x.fillStyle = C.dim; x.textAlign = "left"; x.font = "12px 'Patrick Hand', sans-serif"; x.fillText(m + " m", P.x0 + Math.sin(half) * m * P.s + 4, P.y0 - Math.cos(half) * m * P.s); });
    x.setLineDash([]);
    // the selected row's beams
    for (var c = 0; c < 8; c++) {
      var z = tofZones[tof.row * 8 + c], dir = z.dir, hx = dir[1], hz = dir[0], hl = Math.sqrt(hx * hx + hz * hz) || 1;
      var far = P.toPx(-hx / hl * 4.0, hz / hl * 4.0);
      if (z.kind === "empty") { ui.line(x, [[P.x0, P.y0], far], "rgba(74,46,30,.25)", 1.5, [4, 5]); continue; }
      var end = P.toPx(z.pt[0], z.pt[1]);
      var col = z.kind === "hit" ? C.red : z.kind === "floor" ? "#8A8A8A" : C.bill;
      ui.line(x, [[P.x0, P.y0], end], col, z.kind === "hit" ? 2.5 : 1.5, z.kind === "floor" ? [2, 4] : []);
      x.fillStyle = col; x.beginPath(); x.arc(end[0], end[1], z.kind === "hit" ? 4 : 3, 0, 7); x.fill();
    }
    // objects
    tofObjs().forEach(function (o, i) {
      var p = P.toPx(o.x, o.z), w = o.w * P.s, d = o.d * P.s;
      x.strokeStyle = C.ink; x.lineWidth = i === tofSel ? 3 : 2;
      if (o.kind === "box") { x.fillStyle = "#DDBB8A"; x.fillRect(p[0] - w / 2, p[1] - d / 2, w, d); x.strokeRect(p[0] - w / 2, p[1] - d / 2, w, d); }
      else {
        x.fillStyle = o.kind === "microduck" ? "#E9EEF0" : "#F4C430"; x.beginPath(); x.ellipse(p[0], p[1], Math.max(w / 2, 7), Math.max(d / 2, 6), 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = C.bill; x.beginPath(); x.moveTo(p[0] - 3, p[1] - Math.max(d / 2, 6)); x.lineTo(p[0], p[1] - Math.max(d / 2, 6) - 7); x.lineTo(p[0] + 3, p[1] - Math.max(d / 2, 6)); x.fill();
      }
      x.fillStyle = C.txt; x.textAlign = "center"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText(o.name + " · " + fmt(o.h * 100) + " cm tall", p[0], p[1] + Math.max(d / 2, 7) + 10);
    });
    // sensor
    x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(P.x0, P.y0, 12, 0, 7); x.fill(); x.stroke();
    x.fillStyle = "#F4C430"; x.fillRect(P.x0 - 7, P.y0 - 5, 14, 10); x.strokeRect(P.x0 - 7, P.y0 - 5, 14, 10);
    x.fillStyle = C.txt; x.textAlign = "center"; x.fillText("sensor, " + fmt(HS * 100) + " cm up · row " + tof.row, P.x0, g.h - 6);
    x.textAlign = "left"; x.fillStyle = C.dim; x.fillText("45° fan", 8, 16);
  });
  ui.drawer("s6tgrid", function () {
    if (!tofZones) return;
    var g = ui.ctxFor("s6tgrid"), x = g.x, cell = Math.min((g.w - 42) / 8, (g.h - 34) / 8), ox = Math.max(20, (g.w - cell * 8) / 2 - 2), oy = 22;
    x.fillStyle = C.dim; x.textAlign = "center"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText("← sensor's left · columns · right →", ox + cell * 4, 11);
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var z = tofZones[r * 8 + c], X = ox + c * cell, Y = oy + r * cell;
      x.fillStyle = zoneColor(z); x.fillRect(X, Y, cell, cell);
      x.strokeStyle = "rgba(74,46,30,.35)"; x.lineWidth = 1; x.strokeRect(X + .5, Y + .5, cell - 1, cell - 1);
      x.fillStyle = z.kind === "floor" ? "#FFFDF6" : C.txt; x.textAlign = "center"; x.font = (cell > 34 ? 14 : 11) + "px 'Patrick Hand', sans-serif";
      var t = z.kind === "hit" ? fmt(z.range * 100) : z.kind === "floor" ? "floor" : z.kind === "close" ? "×" : "·";
      x.fillText(t, X + cell / 2, Y + cell / 2);
    }
    x.strokeStyle = C.ink; x.lineWidth = 3; x.strokeRect(ox, oy + tof.row * cell, cell * 8, cell);
    x.fillStyle = C.dim; x.textAlign = "right"; x.font = "12px 'Patrick Hand', sans-serif";
    for (var rr = 0; rr < 8; rr++) x.fillText(String(rr), ox - 4, oy + rr * cell + cell / 2);
    x.save(); x.translate(g.w - 6, oy + cell * 4); x.rotate(-Math.PI / 2); x.textAlign = "center"; x.fillText("row 0 = top of the grid", 0, 0); x.restore();
    g.c._cell = { cell: cell, ox: ox, oy: oy };
  });
  $("s6tgrid").addEventListener("click", function (e) {
    var c = this._cell; if (!c) return; var r = Math.floor((e.offsetY - c.oy) / c.cell);
    if (r >= 0 && r < 8) { tof.row = r; rowSeg.set(r); updTof(); touch(); }
  });
  // dragging in the plan view
  (function () {
    var cv = $("s6tplan"), drag = null;
    function pick(px, py) { if (!planGeom) return -1; var best = -1, bd = 22; tofObjs().forEach(function (o, i) { var p = planGeom.toPx(o.x, o.z), d = Math.hypot(p[0] - px, p[1] - py); if (d < bd) { bd = d; best = i; } }); return best; }
    function moveTo(i, px, py) { var m = planGeom.toM(px, py); tof.objects[i] = { x: core.clamp(m.x, -2, 2), z: core.clamp(m.z, 0.05, 4.1) }; updTof(); }
    cv.addEventListener("pointerdown", function (e) { var i = pick(e.offsetX, e.offsetY); if (i < 0) return; drag = i; tofSel = i; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; e.preventDefault(); });
    cv.addEventListener("pointermove", function (e) { if (drag == null) return; moveTo(drag, e.offsetX, e.offsetY); });
    function up() { if (drag == null) return; drag = null; cv.style.cursor = "grab"; save(); touch(); }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.tabIndex = 0; cv.setAttribute("aria-label", "Plan view. Drag an object, or press 1, 2 or 3 to choose one and the arrow keys to move it 5 cm.");
    cv.addEventListener("keydown", function (e) {
      var k = e.key; if (k === "1" || k === "2" || k === "3") { tofSel = +k - 1; ui.redrawAll(); e.preventDefault(); return; }
      var dx = k === "ArrowLeft" ? -0.05 : k === "ArrowRight" ? 0.05 : 0, dz = k === "ArrowUp" ? 0.05 : k === "ArrowDown" ? -0.05 : 0;
      if (!dx && !dz) return; var o = tof.objects[tofSel]; tof.objects[tofSel] = { x: core.clamp(o.x + dx, -2, 2), z: core.clamp(o.z + dz, 0.05, 4.1) }; updTof(); touch(); e.preventDefault();
    });
  })();

  /* ================= 4 · relative vs metric ================= */
  var rel = st.rel = st.rel || { a: 3, b: 5 };
  $("s6ra").value = rel.a; $("s6rb").value = rel.b;
  function updRel() {
    var T = [1, 2, 4], P = T.map(function (t) { return rel.a * t + rel.b; }), nt = M.normalise(T), np = M.normalise(P), loss = M.relLoss(T, P);
    var arr = function (a, d) { return "[" + a.map(function (v) { return fmt(v, d == null ? 0 : d); }).join(", ") + "]"; };
    $("s6rav").textContent = fmt(rel.a, 1); $("s6rbv").textContent = (rel.b >= 0 ? "+" : "") + fmt(rel.b);
    $("s6rel").innerHTML = '<span>truth</span><span><code>' + arr(T) + '</code> <span class="arr">median ' + fmt(nt.med) + ', MAD ' + fmt(nt.mad, 2) + ' →</span> <code>' + arr(nt.out, 2) + '</code></span>' +
      '<span>prediction</span><span><code>' + arr(P, 1) + '</code> <span class="arr">= ' + fmt(rel.a, 1) + ' × truth ' + (rel.b >= 0 ? "+ " : "− ") + fmt(Math.abs(rel.b)) + ' · median ' + fmt(np.med, 1) + ', MAD ' + fmt(np.mad, 2) + ' →</span> <code>' + arr(np.out, 2) + '</code></span>' +
      '<span>loss</span><span>mean |Δ| after normalising = <b class="num">' + fmt(loss, 3) + '</b>' + (loss < 1e-9 ? ' · perfect score, and no idea whether the room is 1 m or 15 m deep' : '') + '</span>';
  }
  ui.range("s6ra", function () { rel.a = +$("s6ra").value; updRel(); touch(); });
  ui.range("s6rb", function () { rel.b = +$("s6rb").value; updRel(); touch(); });

  /* ================= 5 · which duck? ================= */
  var W = st.w = st.w || { seed: 7, pick: null, yaw: 0, done: false };
  var wCase = null, wOff = document.createElement("canvas"), wGts = [], wYawShown = W.yaw || 0, wReveal = false;
  var tanHalf = Math.tan(K.fovLR / 2 * core.DEG);
  function makePair(seed) {
    var R = core.rng(seed * 2654435761 + 11), tries = 0, a, b;
    do {
      a = { z: 0.8 + R() * 0.6, b: (R() * 2 - 1) * 0.72 }; b = { z: 2.0 + R() * 1.6, b: (R() * 2 - 1) * 0.72 }; tries++;
    } while (Math.abs(a.b - b.b) < 0.4 && tries < 50);
    var ducks = [a, b].map(function (d, i) { return { z: d.z, x: d.b * tanHalf * d.z, b: d.b, near: i === 0, range: 0, angle: core.bearingToAngle(d.b, K.fovLR) }; });
    ducks.forEach(function (d) { d.range = Math.hypot(d.x, d.z); });
    ducks.sort(function (p, q) { return p.b - q.b; });   // duck 1 is the left one on screen
    var jo = R() < 0.5 ? 0 : 1;
    return { ducks: ducks, jo: jo, joNear: ducks[jo].near };
  }
  function wScene() { return { seed: 500 + W.seed, objects: wCase.ducks.map(function (d) { return { kind: "microduck", x: d.x, z: d.z }; }) }; }
  function tofCol(angleDeg) { return core.clamp(Math.round((Bt.halfDeg + angleDeg) / Bt.stepDeg), 0, 7); }   // az positive = left, angle positive = right
  function drawWCam() {
    var cam = $("s6wcamv"), s = 0.35, r = ui.renderRoom(cam, wScene(), K, { scale: s });
    wGts = r.gts.map(function (g) { var bb = core.bearing(g.box, CAM.W), idx = 0, bd = 1e9; wCase.ducks.forEach(function (d, i) { var e = Math.abs(bb - d.b); if (e < bd) { bd = e; idx = i; } }); return { box: g.box, idx: idx }; });
    var x = cam.getContext("2d"); x.setTransform(s, 0, 0, s, 0, 0); x.font = "34px 'Patrick Hand', sans-serif"; x.textBaseline = "bottom"; x.textAlign = "center";
    wGts.forEach(function (g) {
      var d = wCase.ducks[g.idx], picked = W.pick === g.idx, isJo = wReveal && g.idx === wCase.jo;
      ui.boxPath(x, g.box, isJo ? C.grn : picked ? C.gold : C.acc, picked || isJo ? 8 : 5);
      x.fillStyle = isJo ? C.grn : picked ? C.gold : C.acc;
      x.fillText("duck " + (g.idx + 1) + " · b " + ui.sgn(d.b, 2), core.clamp((g.box[0] + g.box[2]) / 2, 90, CAM.W - 90), Math.max(g.box[1] - 10, 40));
      if (isJo) x.fillText("Jo!", (g.box[0] + g.box[2]) / 2, g.box[3] + 44);
    });
    x.setTransform(1, 0, 0, 1, 0, 0);
  }
  function updW(noDraw) {
    var d = wCase.ducks, jo = d[wCase.jo];
    $("s6wcamt").innerHTML = 'Two boxes. duck 1 at bearing <b>' + ui.sgn(d[0].b, 2) + '</b>, duck 2 at <b>' + ui.sgn(d[1].b, 2) + '</b>. Same class, same score, no names.';
    var row = ""; for (var c = 0; c < 8; c++) { var hit = d.map(function (dd, i) { return tofCol(dd.angle) === c ? i : -1; }).filter(function (i) { return i >= 0; }); row += '<div class="' + (hit.length ? (wReveal && hit.indexOf(wCase.jo) >= 0 ? "jo" : "on") : "") + '" title="column ' + c + '">' + (hit.length ? fmt(d[hit[0]].range, 1) : "·") + '</div>'; }
    $("s6wtofrow").innerHTML = row;
    $("s6wtoft").innerHTML = 'Column ' + tofCol(d[0].angle) + ' returns <b>' + fmt(d[0].range, 2) + ' m</b> (duck 1) and column ' + tofCol(d[1].angle) + ' returns <b>' + fmt(d[1].range, 2) + ' m</b> (duck 2). The row shown is the one at duck height.';
    $("s6wblet").innerHTML = 'Jo’s beacon: <b>present</b> · signal <b>' + (wCase.joNear ? "strong" : "weak") + '</b> (toy hint: ' + (wCase.joNear ? "within about 1.5 m" : "beyond about 1.5 m") + '). The other duck’s beacon is also present. Neither says which box is which.';
    $("s6wpick").textContent = W.pick == null ? "click a box in the camera view" : "duck " + (W.pick + 1) + " (bearing " + ui.sgn(d[W.pick].b, 2) + ")";
    $("s6wyv").textContent = ui.sgn(W.yaw, 1) + "°";
    var m = '<div class="eq">angle = atan( b × tan(FOV<sub>LR</sub> ÷ 2) ) &nbsp;·&nbsp; FOV<sub>LR</sub> = 37.35°, tan(18.67°) = ' + fmt(tanHalf, 3) + '</div>';
    if (W.pick != null) m += '<div class="eqn">your pick, duck ' + (W.pick + 1) + ': atan(' + ui.sgn(d[W.pick].b, 2) + ' × ' + fmt(tanHalf, 3) + ') = atan(' + ui.sgn(d[W.pick].b * tanHalf, 3) + ') = <b>' + ui.sgn(d[W.pick].angle, 1) + '°</b> · the crank is at ' + ui.sgn(W.yaw, 1) + '°</div>';
    else m += '<div class="eqn">duck 1: <b>' + ui.sgn(d[0].angle, 1) + '°</b> · duck 2: <b>' + ui.sgn(d[1].angle, 1) + '°</b>. Which one does the beacon’s hint match?</div>';
    $("s6wmath").innerHTML = m;
    $("s6wrobot").innerHTML = '<b>On the robot.</b> The design note says vision cannot tell identical ducks apart, so: ' + MD.facts.fusion.v + ' <span class="muted">(' + cite("fusion") + ')</span>. The neck crank itself is solved as gaze IK toward a point in the trunk frame; turning a bearing into that point needs the intrinsics from step 5 (our reading of <code>kinematics/src/head.rs</code>).';
    if (!noDraw) { drawWCam(); ui.redrawAll(); }
  }
  function setCase() { wCase = makePair(W.seed); wReveal = !!W.done; updW(); }
  ui.drawer("s6wplan", function () {
    if (!wCase) return;
    var g = ui.ctxFor("s6wplan"), x = g.x, s = (g.h - 44) / 4.0, x0 = g.w / 2, y0 = g.h - 26, half = K.fovLR / 2 * core.DEG;
    var P = function (xr, za) { return [x0 + xr * s, y0 - za * s]; };
    x.fillStyle = "#EAF4FB"; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 - Math.sin(half) * 4 * s, y0 - Math.cos(half) * 4 * s); x.arc(x0, y0, 4 * s, -Math.PI / 2 - half, -Math.PI / 2 + half); x.closePath(); x.fill();
    x.strokeStyle = C.line; x.lineWidth = 1; x.setLineDash([3, 4]); [1, 2, 3].forEach(function (m) { x.beginPath(); x.arc(x0, y0, m * s, -Math.PI / 2 - half - 0.2, -Math.PI / 2 + half + 0.2); x.stroke(); x.fillStyle = C.dim; x.textAlign = "left"; x.font = "12px 'Patrick Hand', sans-serif"; x.fillText(m + " m", x0 + Math.sin(half + 0.2) * m * s + 3, y0 - Math.cos(half + 0.2) * m * s); }); x.setLineDash([]);
    // the ducks
    wCase.ducks.forEach(function (d, i) {
      var p = P(d.x, d.z), isJo = wReveal && i === wCase.jo, picked = W.pick === i;
      x.fillStyle = isJo ? "#BFE3A6" : picked ? "#FFF1A8" : "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2;
      x.beginPath(); x.ellipse(p[0], p[1], 10, 8, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = C.bill; x.beginPath(); x.moveTo(p[0] - 3, p[1] - 8); x.lineTo(p[0], p[1] - 15); x.lineTo(p[0] + 3, p[1] - 8); x.fill();
      var right = d.x >= 0; x.fillStyle = C.txt; x.textAlign = right ? "left" : "right"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText("duck " + (i + 1) + (isJo ? " = Jo" : "") + " · " + fmt(d.range, 2) + " m", p[0] + (right ? 16 : -16), p[1] + 4);
      if (isJo) { x.fillStyle = C.grn; x.beginPath(); x.arc(p[0], p[1], 4, 0, 7); x.fill(); }
    });
    // the look line
    var yaw = wYawShown * core.DEG, L = 3.9 * s;
    ui.line(x, [[x0, y0], [x0 + Math.sin(yaw) * L, y0 - Math.cos(yaw) * L]], C.acc, 3);
    // head
    x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(x0, y0, 14, 0, 7); x.fill(); x.stroke();
    x.save(); x.translate(x0, y0); x.rotate(yaw); x.fillStyle = C.bill; x.beginPath(); x.moveTo(-6, -12); x.lineTo(0, -24); x.lineTo(6, -12); x.closePath(); x.fill(); x.stroke(); x.fillStyle = "#1F6F74"; x.beginPath(); x.arc(0, -6, 4, 0, 7); x.fill(); x.restore();
    x.fillStyle = C.txt; x.textAlign = "center"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText("head yaw " + ui.sgn(wYawShown, 1) + "°", x0, g.h - 6);
  });
  $("s6wcamv").addEventListener("click", function (e) {
    var cam = this, sx = cam.width / cam.clientWidth, px = e.offsetX * sx / 0.35, py = e.offsetY * sx / 0.35, best = -1, bd = 1e9;
    wGts.forEach(function (g) { var b = g.box, inside = px >= b[0] - 30 && px <= b[2] + 30 && py >= b[1] - 30 && py <= b[3] + 30; var d = Math.hypot((b[0] + b[2]) / 2 - px, (b[1] + b[3]) / 2 - py); if (inside && d < bd) { bd = d; best = g.idx; } });
    if (best < 0) return; W.pick = best; save(); updW(); touch();
  });
  $("s6wy").value = W.yaw;
  ui.range("s6wy", function () { W.yaw = +$("s6wy").value; updW(true); $("s6wyv").textContent = ui.sgn(W.yaw, 1) + "°"; });
  function animateYaw(to, done) {
    var from = wYawShown, t0 = null, dur = REDUCED ? 0 : 520;
    if (!dur || document.hidden) { wYawShown = to; ui.redrawAll(); done(); return; }
    function frame(ts) { if (t0 == null) t0 = ts; var u = dur ? Math.min(1, (ts - t0) / dur) : 1, e = 1 - Math.pow(1 - u, 3); wYawShown = from + (to - from) * e; ui.redrawAll(); if (u < 1) requestAnimationFrame(frame); else done(); }
    requestAnimationFrame(frame);
  }
  $("s6wgo").onclick = function () {
    touch();
    animateYaw(W.yaw, function () {
      var d = wCase.ducks, jo = d[wCase.jo], err = Math.abs(W.yaw - jo.angle), okPick = W.pick === wCase.jo, okAim = err <= 1.5;
      var miss = jo.range * Math.abs(Math.tan(W.yaw * core.DEG) - Math.tan(jo.angle * core.DEG));
      var html;
      if (okPick && okAim) { wReveal = true; W.done = true; html = '<div class="callout co-g"><b>Jo found.</b> The head looks ' + ui.sgn(W.yaw, 1) + '° and Jo is at ' + ui.sgn(jo.angle, 1) + '°, ' + fmt(miss * 100) + ' cm off at ' + fmt(jo.range, 1) + ' m. Camera said where, ToF said how far, the beacon said who. No single sense could have done it.</div>'; }
      else if (!okPick && W.pick != null) html = '<div class="callout co-r"><b>That’s the other duck.</b> Jo’s beacon reads ' + (wCase.joNear ? "strong" : "weak") + ', and the ToF says duck ' + (W.pick + 1) + ' is ' + fmt(d[W.pick].range, 1) + ' m away. Match the beacon’s hint to a <i>distance</i>, then take that column’s bearing.</div>';
      else if (W.pick == null) html = '<div class="callout co-w"><b>Pick a duck first.</b> Click one of the boxes in the camera view.</div>';
      else html = '<div class="callout co-w"><b>Right duck, crank off by ' + fmt(err, 1) + '°</b> (that is ' + fmt(miss * 100) + ' cm at ' + fmt(jo.range, 1) + ' m). Use the formula in the chalkboard: bearing → angle needs the left–right field of view (37.35° here), not the sensor’s 62°.</div>';
      $("s6wres").innerHTML = html; save(); updW();
    });
  };
  $("s6wnew").onclick = function () { W.seed = (W.seed + 1) % 1000; W.pick = null; W.done = false; wReveal = false; $("s6wres").innerHTML = ""; save(); setCase(); touch(); };
  $("s6data").innerHTML = '<b>Unit 10 in one line: where the training pictures come from.</b> ' + MD.facts.dataPlan.v + ' <span class="muted">(' + cite("dataPlan") + ')</span>. The synthetic part is BlenderProc’s job: render the duck from its CAD model in the rare poses real footage seldom catches, with exact boxes for free, then push the renders through the very same letterbox (grey 114, RGB, portrait) the camera path uses, or the detector gets quietly worse on the sim-to-real gap.';

  /* ================= boot ================= */
  updNear(); updStereo(); updTof(); updRel(); setCase();
  DEV.onShow("s6", function () { drawNear(); drawWCam(); });
});
