/* Step 0 · One Look: the whole trip, one frame. */
Object.assign(window.DEV_GLOSSARY, {
  look: ["A look", "One pass of the detector over one frame: pre-process, run the network, decode. On Microduck that is about 60 ms of work, done twice a second.", "One print's whole trip through the head."],
  hardneg: ["Hard negative", "A training example that looks like the target but isn't (a rubber duck, a white print of a duck), labelled \"not a duck\" so the detector learns the difference.", "A decoy the clerks are trained to shred."],
  headturn: ["Head turn", "What the robot does with a detection: the box's bearing across the frame becomes a neck angle, using the camera's field of view.", "The neck crank."],
  tick: ["Control tick", "One step of the walking loop: read the joints and IMU, run the policy, command the motors. Microduck ticks 50 times a second, every 20 ms.", "One turn of the engine downstairs."]
});
DEV.navIcon("s0", "eye");
DEV.step("s0", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, sgn = ui.sgn, pct = ui.pct, C = ui.C, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), W = core.CAM.W, H = core.CAM.H, IN = core.CAM.input;
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var S = ui.store.s.s0 = Object.assign({ x: 0.6, z: 3, rubber: false, hz: 2, old: false, looks: 0 }, ui.store.s.s0 || {});
  var RUBBER = { kind: "rubber", x: 0.5, z: 1.4 };
  var THRESH = 0.35, IOU = 0.5, LOOK_MS = 60, OLD_PRE = 345, OLD_TOTAL = 407, P50 = 25.7, P95 = 58.4;
  function fact(key, text) { return (text || MD.facts[key].v) + " " + MD.cite(key); }
  // ui.ctxFor reads the canvas's height attribute, then overwrites it with the device-pixel height, so on a
  // 2× screen every redraw would double the canvas. Put the CSS height back before each call.
  function ctx(id, h) { $(id).setAttribute("height", h); return ui.ctxFor(id); }
  function scene(seed) { return { seed: seed, objects: [{ kind: "microduck", x: S.x, z: S.z }].concat(S.rubber ? [RUBBER] : []) }; }

  /* ---------- the top-down map ---------- */
  var mapGeom = null;
  ui.drawer("s0map", function () {
    var g = ctx("s0map", 200), x = g.x, cx = g.w / 2, cy = g.h - 16, ppm = (g.h - 34) / 4.6;
    mapGeom = { cx: cx, cy: cy, ppm: ppm };
    x.fillStyle = "#FFF6DC"; x.fillRect(0, 0, g.w, g.h);
    // the camera's wedge
    var half = K.fovLR / 2 * core.DEG, far = 4.8;
    x.fillStyle = "rgba(159,211,214,.45)"; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx - Math.tan(half) * far * ppm, cy - far * ppm); x.lineTo(cx + Math.tan(half) * far * ppm, cy - far * ppm); x.closePath(); x.fill();
    x.strokeStyle = C.acc; x.lineWidth = 1.5; x.setLineDash([4, 3]); x.stroke(); x.setLineDash([]);
    // metre lines
    x.strokeStyle = "rgba(74,46,30,.25)"; x.lineWidth = 1; x.fillStyle = C.dim; x.textAlign = "left"; x.font = "13px 'Patrick Hand', sans-serif";
    for (var m = 1; m <= 4; m++) { var yy = cy - m * ppm; x.beginPath(); x.moveTo(0, yy); x.lineTo(g.w, yy); x.stroke(); x.fillText(m + " m", 4, yy - 7); }
    x.textAlign = "right"; x.fillText("FOV " + fmt(K.fovLR, 1) + "° left–right", g.w - 6, 12);
    // the camera (this duck's head)
    x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.acc; x.beginPath(); x.arc(cx, cy - 4, 3, 0, 7); x.fill();
    x.fillStyle = C.dim; x.textAlign = "left"; x.fillText("camera", cx + 14, cy - 2);
    // the rubber duck
    if (S.rubber) { var rx = cx + RUBBER.x * ppm, ry = cy - RUBBER.z * ppm; x.fillStyle = "#F4C430"; x.strokeStyle = C.ink; x.lineWidth = 1.8; x.beginPath(); x.arc(rx, ry, 6, 0, 7); x.fill(); x.stroke(); x.fillStyle = C.bill; x.beginPath(); x.arc(rx + 5, ry - 1, 2.2, 0, 7); x.fill(); x.fillStyle = C.dim; x.textAlign = "left"; x.fillText("rubber", rx + 9, ry); }
    // the other Microduck (draggable)
    var dx = cx + S.x * ppm, dy = cy - S.z * ppm;
    x.fillStyle = "rgba(74,46,30,.15)"; x.beginPath(); x.arc(dx, dy, 15, 0, 7); x.fill();
    x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2.2; x.beginPath(); x.arc(dx, dy, 10, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.bill; x.beginPath(); x.moveTo(dx + 6, dy - 4); x.lineTo(dx + 15, dy - 1); x.lineTo(dx + 6, dy + 2); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "#1B2226"; x.beginPath(); x.arc(dx + 2, dy - 3, 2.2, 0, 7); x.fill();
    var inView = Math.abs(Math.atan2(S.x, S.z)) <= half;
    x.fillStyle = inView ? C.dim : C.red; x.textAlign = dx > g.w * 0.6 ? "right" : "left"; x.fillText(inView ? "drag me" : "out of view", dx + (dx > g.w * 0.6 ? -14 : 14), dy - 12);
  });
  function setPos(nx, nz, fromMap) {
    S.x = Math.round(core.clamp(nx, -2, 2) * 20) / 20; S.z = Math.round(core.clamp(nz, 0.6, 4.5) * 20) / 20;
    $("s0x").value = S.x; $("s0z").value = S.z; ui.save();
    labels(); ui.redrawAll(); queueFrames();
    if (!fromMap) ui.touch("s0");
  }
  function labels() { $("s0xv").textContent = sgn(S.x, 2) + " m"; $("s0zv").textContent = fmt(S.z, 2) + " m"; }
  (function bindMap() {
    var el = $("s0map"), drag = false;
    function at(e) { var r = el.getBoundingClientRect(), g = mapGeom; if (!g) return; setPos((e.clientX - r.left - g.cx) / g.ppm, (g.cy - (e.clientY - r.top)) / g.ppm, true); }
    el.addEventListener("pointerdown", function (e) { drag = true; el.setPointerCapture(e.pointerId); at(e); ui.touch("s0"); e.preventDefault(); });
    el.addEventListener("pointermove", function (e) { if (drag) at(e); });
    el.addEventListener("pointerup", function () { drag = false; }); el.addEventListener("pointercancel", function () { drag = false; });
    el.addEventListener("keydown", function (e) {
      var k = e.key, dx = k === "ArrowLeft" ? -0.1 : k === "ArrowRight" ? 0.1 : 0, dz = k === "ArrowUp" ? 0.1 : k === "ArrowDown" ? -0.1 : 0;
      if (dx || dz) { setPos(S.x + dx, S.z + dz); e.preventDefault(); }
    });
  })();
  ui.range("s0x", function () { setPos(+$("s0x").value, S.z); });
  ui.range("s0z", function () { setPos(S.x, +$("s0z").value); });
  $("s0rub").checked = S.rubber;
  $("s0rub").addEventListener("change", function () { S.rubber = $("s0rub").checked; ui.save(); ui.redrawAll(); queueFrames(); ui.touch("s0"); });

  /* ---------- the frames (live, before any look) ---------- */
  var full = document.createElement("canvas"), fq = null;
  function paintFrames(sc) {
    ui.renderRoom(full, sc, K, { scale: 1 });
    var c0 = $("s0c0").getContext("2d"); c0.setTransform(1, 0, 0, 1, 0, 0); c0.clearRect(0, 0, 640, 360);
    c0.save(); c0.translate(0, 360); c0.rotate(-Math.PI / 2); c0.drawImage(full, 0, 0, 360, 640); c0.restore();
    $("s0c1").getContext("2d").drawImage(full, 0, 0, 360, 640);
    var img = full.getContext("2d").getImageData(0, 0, W, H);
    ui.putImage($("s0c2"), core.letterboxPixels(img, IN, {}));
    ["s0o1", "s0o2"].forEach(function (id) { var c = $(id); c.getContext("2d").clearRect(0, 0, c.width, c.height); });
  }
  function queueFrames() {
    if (fq) return;
    fq = requestAnimationFrame(function () { fq = null; paintFrames(scene(7 + S.looks * 13)); resetStations(); });
  }
  function resetStations() {
    ui.qa("#s0pipe .st").forEach(function (s) { s.classList.remove("on", "done", "hot"); });
    ui.qa("#s0 .s0cell").forEach(function (c) { c.classList.remove("show"); });
    for (var i = 0; i < 8; i++) $("s0n" + i).textContent = "–";
    setHead(0, 0); drawDots();
  }

  /* ---------- the head, seen from above ---------- */
  var headAng = 0, headAnim = null;
  (function wedge() {
    var half = K.fovLR / 2 * core.DEG, r = 122, ex = r * Math.sin(half), ey = r * Math.cos(half);
    $("s0wedge").setAttribute("d", "M100 124 L" + (100 - ex).toFixed(1) + " " + (124 - ey).toFixed(1) + " A" + r + " " + r + " 0 0 1 " + (100 + ex).toFixed(1) + " " + (124 - ey).toFixed(1) + " Z");
  })();
  function setHead(deg, ms) {
    cancelAnimationFrame(headAnim);
    var from = headAng, t0 = performance.now(), dur = RM ? 0 : (ms == null ? 500 : ms);
    function step(t) {
      var u = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - u, 3);
      headAng = from + (deg - from) * e;
      $("s0turn").setAttribute("transform", "rotate(" + headAng.toFixed(2) + " 100 124)");
      if (u < 1) headAnim = requestAnimationFrame(step);
    }
    step(t0 + (dur ? 0 : 1));
  }
  function drawDots(gts) {
    var g = $("s0dots"), h = "";
    (gts || core.sceneGTs(scene(1), K)).forEach(function (o) {
      var src = o.kind === "rubber" ? RUBBER : { x: S.x, z: S.z }, a = Math.atan2(src.x, src.z), R = 88 + (o.kind === "rubber" ? -22 : 0);
      var px = 100 + R * Math.sin(a), py = 124 - R * Math.cos(a);
      h += o.kind === "rubber" ? '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6" fill="#F4C430" stroke="#4A2E1E" stroke-width="1.8"/>'
        : '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="8" fill="#E9EEF0" stroke="#4A2E1E" stroke-width="2"/><circle cx="' + (px + 2).toFixed(1) + '" cy="' + (py - 2).toFixed(1) + '" r="2" fill="#1B2226"/>';
    });
    g.innerHTML = h;
  }

  /* ---------- one look ---------- */
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function look() {
    clearTimers(); S.looks++; ui.save(); ui.touch("s0");
    var sc = scene(7 + S.looks * 13);
    paintFrames(sc); resetStations();
    var d = core.detect(sc, K, {}), N = d.N, n35 = 0, i;
    for (i = 0; i < N; i++) if (d.raw[4 * N + i] >= THRESH) n35++;
    var dec = core.decode(d.raw, d.lb, THRESH, IOU, { trace: true }), kept = dec.kept, top = kept[0] || null;
    var b = top ? core.bearing(top.box, W) : null, ang = b == null ? null : core.bearingToAngle(b, K.fovLR);
    function overlaps(box, kind) { var best = 0; d.gts.forEach(function (g) { if (g.kind === kind) best = Math.max(best, core.iou(box, g.box)); }); return best; }
    var rubKept = kept.filter(function (k) { return overlaps(k.box, "rubber") >= 0.3; }), topIsRubber = top && overlaps(top.box, "rubber") >= 0.3 && overlaps(top.box, "microduck") < 0.3;
    var duckInView = d.gts.some(function (g) { return g.isDuck; });
    var o1 = $("s0o1").getContext("2d"), o2 = $("s0o2").getContext("2d");
    var stations = [
      function () { $("s0n0").textContent = "1280×720"; },
      function () { $("s0n1").textContent = "720×1280"; },
      function () { $("s0n2").textContent = "×0.25 · pad 70"; },
      function () { $("s0n3").textContent = "320×320×3 in"; sweep(); },
      function () {
        $("s0n4").textContent = fmt(N) + " · " + n35 + " ≥ " + THRESH;
        o2.lineWidth = 1.2; o2.strokeStyle = "rgba(201,138,11,.85)";
        for (var j = 0; j < N; j++) { var s = d.raw[4 * N + j]; if (s < THRESH) continue; var cx = d.raw[j], cy = d.raw[N + j], w = d.raw[2 * N + j], h = d.raw[3 * N + j]; o2.strokeRect(cx - w / 2, cy - h / 2, w, h); }
      },
      function () {
        $("s0n5").textContent = kept.length + (kept.length === 1 ? " box" : " boxes");
        kept.forEach(function (k, j) {
          var col = j === 0 ? C.grn : "#8E78C0";
          o2.lineWidth = 3; o2.strokeStyle = col; o2.strokeRect(k.inBox[0], k.inBox[1], k.inBox[2] - k.inBox[0], k.inBox[3] - k.inBox[1]);
          o1.lineWidth = 3; o1.strokeStyle = col; o1.strokeRect(k.box[0] / 2, k.box[1] / 2, (k.box[2] - k.box[0]) / 2, (k.box[3] - k.box[1]) / 2);
          o1.fillStyle = col; o1.font = "bold 15px Grandstander, sans-serif"; o1.textBaseline = "bottom"; o1.fillText(fmt(k.score, 2), k.box[0] / 2, k.box[1] / 2 - 3);
        });
        if (!kept.length) { o1.fillStyle = "rgba(200,69,47,.9)"; o1.font = "bold 22px Grandstander, sans-serif"; o1.textAlign = "center"; o1.textBaseline = "middle"; o1.fillText("nothing ≥ 0.35", 180, 320); o1.textAlign = "left"; }
      },
      function () {
        $("s0n6").textContent = b == null ? "none" : sgn(b, 2);
        if (top) { var cxp = (top.box[0] + top.box[2]) / 4; o1.strokeStyle = C.red; o1.lineWidth = 2; o1.setLineDash([6, 4]); o1.beginPath(); o1.moveTo(cxp, 0); o1.lineTo(cxp, 640); o1.stroke(); o1.setLineDash([]); o1.beginPath(); o1.moveTo(180, 0); o1.lineTo(180, 640); o1.strokeStyle = "rgba(74,46,30,.5)"; o1.lineWidth = 1; o1.stroke(); }
      },
      function () {
        $("s0n7").textContent = ang == null ? "stay put" : sgn(ang, 1) + "°";
        $("s0angtxt").textContent = ang == null ? "no turn" : "turn " + sgn(ang, 1) + "°";
        if (ang != null) setHead(ang);
        mathbox(); note();
      }
    ];
    function mathbox() {
      var eq = '<div class="eq">bearing = (box centre x ÷ 720) · 2 − 1 &nbsp;·&nbsp; angle = atan(bearing · tan(FOV<sub>LR</sub> ÷ 2))</div>';
      if (!top) { $("s0math").innerHTML = eq + '<div class="eqn">' + fmt(N) + ' notes posted, <b>' + n35 + '</b> at or above ' + THRESH + (duckInView ? ', but none survived: no bearing, the head stays put.' : '. The duck is outside the wedge, so there is nothing to find: no bearing, no turn.') + '</div>'; return; }
      var cx = (top.box[0] + top.box[2]) / 2, tanh = Math.tan(K.fovLR / 2 * core.DEG);
      $("s0math").innerHTML = eq + '<div class="eqn">kept box, frame px: [' + top.box.map(function (v) { return fmt(v, 0); }).join(", ") + '] at score <b>' + fmt(top.score, 2) + '</b><br>centre x = ' + fmt(cx, 1) + ' → bearing = (' + fmt(cx, 1) + ' ÷ 720) · 2 − 1 = <b>' + sgn(b, 3) + '</b><br>FOV<sub>LR</sub> = ' + fmt(K.fovLR, 2) + '° (full-width 16:9 mode, our inference) → tan(' + fmt(K.fovLR / 2, 2) + '°) = ' + fmt(tanh, 3) + '<br>angle = atan(' + sgn(b, 3) + ' × ' + fmt(tanh, 3) + ') = <b>' + sgn(ang, 2) + '°</b>' + (b !== 0 ? ' · the bearing is linear in pixels; the angle isn\'t, which is the map room\'s job (step 5)' : '') + '</div>';
    }
    function note() {
      var h = '<b>On the robot.</b> ' + fact("candidates") + ' · ' + fact("twenty") + ' · ' + fact("threshold") + ' · ' + fact("bearing") + '.';
      if (S.rubber) h += rubKept.length ? ' <span class="chip bad">the rubber duck sneaked through at ' + fmt(rubKept[0].score, 2) + '</span>' : ' <span class="chip good">the rubber duck stayed below ' + THRESH + ' this time</span>';
      if (topIsRubber) h += ' <span class="chip warn">and the head turned toward it</span>';
      if (S.rubber) h += ' A hard negative is exactly the kind of thing the data plan trains against: ' + fact("dataPlan", "\"hard negatives (rubber ducks, white prints)\"") + '.';
      $("s0onrobot").innerHTML = h;
    }
    function sweep() {
      if (RM) return;
      var t0 = performance.now(), dur = 420, saved = o2.getImageData(0, 0, IN, IN);
      (function f(t) {
        var u = Math.min(1, (t - t0) / dur); o2.putImageData(saved, 0, 0);
        if (u < 1) { o2.strokeStyle = "rgba(31,111,116,.9)"; o2.lineWidth = 2; var p = u * (IN - 24); o2.strokeRect(p, p * 0.9 + 20, 24, 24); requestAnimationFrame(f); }
      })(t0);
    }
    var sts = ui.qa("#s0pipe .st"), cells = ui.qa("#s0 .s0cell"), cellFor = [0, 1, 2, 2, 2, 1, 1, 3];
    stations.forEach(function (fn, k) {
      var run = function () {
        sts.forEach(function (s, j) { s.classList.toggle("on", j === k); if (j < k) s.classList.add("done"); });
        cells[cellFor[k]].classList.add("show"); fn();
        if (k === 7) sts[7].classList.add("done");
      };
      if (RM) run(); else timers.push(setTimeout(run, k * 380));
    });
    drawDots(d.gts);
  }
  $("s0go").onclick = look; $("s0again").onclick = look;
  $("s0onrobot").innerHTML = '<b>On the robot.</b> ' + fact("stream") + ' · ' + fact("turn") + ' · ' + fact("model") + ' · ' + fact("candidates") + '. Press <b>Take one look</b> and the box desk, shredder and neck crank fill in.';

  /* ---------- the time budget ---------- */
  var preSeg = ui.seg("s0pre", [{ v: "new", label: "sample 102,400 px (now)" }, { v: "old", label: "convert all 921,600 px (old)" }], S.old ? "old" : "new", function (v) { S.old = v === "old"; ui.save(); budget(); ui.touch("s0"); });
  $("s0hz").value = S.hz;
  ui.range("s0hz", function () { S.hz = +$("s0hz").value; ui.save(); budget(); ui.touch("s0"); });
  function lookMs() { return S.old ? OLD_TOTAL : LOOK_MS; }
  function effHz() { return S.hz * lookMs() / LOOK_MS; }   // the toy: temperature follows work per second
  ui.drawer("s0tl", function () {
    var g = ctx("s0tl", 170), x = g.x, pad = { l: 8, r: 8, t: 22, b: 22 }, Wd = g.w - pad.l - pad.r, X = function (ms) { return pad.l + Wd * ms / 1000; };
    var y1 = pad.t + 14, h1 = 26, y2 = pad.t + 66, h2 = 46, hz = S.hz, L = lookMs();
    x.fillStyle = C.dim; x.textAlign = "left"; x.font = "14px 'Patrick Hand', sans-serif"; x.textBaseline = "middle";
    x.fillText("walking loop · 50 ticks", pad.l, y1 - 9); x.fillText("detector · " + hz + (hz === 1 ? " look" : " looks") + " × " + L + " ms", pad.l, y2 - 9);
    for (var i = 0; i < 50; i++) { x.fillStyle = "#5FA03C"; x.fillRect(X(i * 20) + 0.5, y1, Math.max(1, Wd / 50 - 2), h1); }
    var over = hz * L > 1000;
    for (var k = 0; k < hz; k++) {
      var t0 = k * 1000 / hz, t1 = Math.min(1000, t0 + L);
      if (S.old) {
        var tp = Math.min(1000, t0 + OLD_PRE);
        x.fillStyle = "#F4B7A7"; x.fillRect(X(t0), y2, X(tp) - X(t0), h2);
        x.strokeStyle = "rgba(74,46,30,.35)"; x.lineWidth = 1; for (var s = t0; s < tp; s += 25) { x.beginPath(); x.moveTo(X(s), y2 + h2); x.lineTo(Math.min(X(tp), X(s) + 14), y2); x.stroke(); }
        if (t1 > tp) { x.fillStyle = C.acc; x.fillRect(X(tp), y2, X(t1) - X(tp), h2); }
      } else {
        x.fillStyle = "#9FD3D6"; x.fillRect(X(t0), y2, X(t1) - X(t0), h2);
        x.fillStyle = C.acc; x.fillRect(X(t0), y2, X(t0 + P50) - X(t0), h2);
        x.fillStyle = "rgba(31,111,116,.55)"; x.fillRect(X(t0 + P50), y2, X(t0 + P95) - X(t0 + P50), h2);
      }
      x.strokeStyle = C.ink; x.lineWidth = 1.5; x.strokeRect(X(t0), y2, X(t1) - X(t0), h2);
    }
    if (over) { x.fillStyle = "rgba(200,69,47,.92)"; x.textAlign = "center"; x.font = "bold 16px Grandstander, sans-serif"; x.fillText("looks overlap: it can't keep up", g.w / 2, y2 + h2 / 2); }
    x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(pad.l, g.h - pad.b); x.lineTo(g.w - pad.r, g.h - pad.b); x.stroke();
    x.fillStyle = C.dim; x.font = "13px 'Patrick Hand', sans-serif";
    [0, 250, 500, 750, 1000].forEach(function (ms, j) { x.textAlign = j === 0 ? "left" : j === 4 ? "right" : "center"; x.fillText(ms + (j === 4 ? " ms" : ""), X(ms), g.h - pad.b + 11); });
  });
  function budget() {
    var hz = S.hz, L = lookMs(), busy = hz * L / 1000, T = core.boardTemp(effHz()), thr = core.throttled(effHz());
    $("s0hzv").textContent = hz + (hz === 1 ? " look/s" : " looks/s") + (hz === 2 ? " (the robot's setting)" : "");
    $("s0busy").textContent = busy > 1 ? ">100%" : pct(busy); $("s0busy").className = "v " + (busy > 1 ? "bad" : busy > 0.5 ? "warn" : "good");
    $("s0gap").textContent = fmt(50 / hz, Number.isInteger(50 / hz) ? 0 : 1);
    $("s0tempv").textContent = fmt(T, 0) + " °C"; $("s0tempv").className = "v " + (thr ? "bad" : T > 75 ? "warn" : "good");
    var frac = core.clamp((T - core.THERMAL.idle) / (core.THERMAL.flatOut - core.THERMAL.idle), 0, 1), top = 110 - frac * 90;
    $("s0merc").setAttribute("y", top.toFixed(1)); $("s0merc").setAttribute("height", (124 - top).toFixed(1));
    $("s0tempt").textContent = fmt(T, 0) + " °C"; $("s0fan").style.transform = ""; $("s0fan").querySelector("circle").setAttribute("fill", thr ? "#F4B7A7" : "#B9BDC2");
    var nt = $("s0thermnote");
    if (thr) { nt.className = "callout co-r"; nt.innerHTML = "<b>Throttled.</b> The toy board is past " + core.THERMAL.throttleAt + " °C. " + fact("thermal") + "."; }
    else if (T > 75) { nt.className = "callout co-w"; nt.innerHTML = "<b>Running warm.</b> Each extra look is another ~" + L + " ms of work on the board the legs share. The robot's config stops at 2 for a reason: " + fact("work") + "."; }
    else { nt.className = "callout co-g"; nt.innerHTML = "<b>Comfortable.</b> " + hz + (hz === 1 ? " look" : " looks") + " a second leaves the board mostly to walking, which runs on its own senses: " + fact("controlHz") + "."; }
    $("s0oldbar").innerHTML = S.old
      ? '<i class="a" style="flex:' + OLD_PRE + '">convert + shrink · 345 ms</i><i class="b" style="flex:' + (OLD_TOTAL - OLD_PRE) + '">rest · 62 ms</i>'
      : '<i class="b" style="flex:' + LOOK_MS + '">≈ 60 ms</i><i class="c" style="flex:' + (OLD_TOTAL - LOOK_MS) + '">freed: ' + (OLD_TOTAL - LOOK_MS) + ' ms of every look</i>';
    $("s0ppnote").innerHTML = S.old ? "Old darkroom: a look takes <b>407 ms</b>, 345 of them converting pixels the model will never see. At " + hz + (hz === 1 ? " look/s" : " looks/s") + " that is " + (hz * OLD_TOTAL > 1000 ? "more than a second of work per second" : pct(hz * OLD_TOTAL / 1000) + " of every second") + "." : "New darkroom: fill only the model's 102,400 input pixels, sampled straight from the camera's format. A look is <b>≈ 60 ms</b>.";
    ui.redrawAll();
  }
  $("s0budgetrobot").innerHTML = '<b>On the robot.</b> ' + fact("controlHz") + ' · ' + fact("work") + ' · ' + fact("latency") + ' · ' + fact("oldPreproc") + ' · ' + fact("walking") + '. The walking side of this robot is <a href="https://bakulbadwal.github.io/policy-pond/" target="_blank" rel="noopener">Policy Pond</a>.';

  /* ---------- boot ---------- */
  $("s0x").value = S.x; $("s0z").value = S.z; labels();
  paintFrames(scene(7 + S.looks * 13)); resetStations();
  budget();
  DEV.onShow("s0", function () { ui.redrawAll(); });
});
