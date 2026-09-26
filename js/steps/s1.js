/* Step 1 · The Darkroom: what a camera hands you, and the mat it goes on. */
Object.assign(window.DEV_GLOSSARY, {
  hwc: ["H × W × C array", "How a colour image is stored: height first, then width, then the three colour channels. Microduck's upright frame is (1280, 720, 3), indexed [row, column].", "The print, counted rows first."],
  uint8: ["uint8", "An unsigned 8-bit integer: a whole number from 0 to 255, one byte. Camera frames arrive as uint8; models usually want float32 scaled to 0–1 (÷ 255).", "One notch on the darkroom's 256-step grey scale."],
  quarterturn: ["Quarter turn", "The camera is mounted on its side, so the 1280×720 stream is rotated 90° clockwise to the upright 720×1280 frame the model was trained on.", "The duckling turning the print."],
  pad114: ["Grey 114", "The flat grey (R = G = B = 114) that ultralytics fills a letterbox with. Training and INT8 calibration both saw it, so deployment must use it too.", "The grey card the print is mounted on."],
  rgbbgr: ["RGB vs BGR", "Which byte is red. OpenCV loads images blue-first (BGR); most models train red-first (RGB). Swap them and nothing errors: the picture just has the wrong colours.", "The wall sign: RGB, not BGR."],
  stretchfit: ["Stretch", "Resizing each axis by its own factor so the frame fills the square with no padding. Shapes distort: Microduck's frame would come out 1.78× too wide.", "The guillotine: forbidden."],
  nearest: ["Nearest-neighbour", "Resizing by copying the single closest source pixel for each output pixel. One read per pixel, blocky, fast.", "Picking one square out of each 4×4 block."],
  bilinear: ["Bilinear", "Resizing by blending the four source pixels around each sample point, weighted by distance. Smoother, about three times the work.", "Mixing four squares into one."]
});
DEV.navIcon("s1", "film");
DEV.step("s1", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, sgn = ui.sgn, pct = ui.pct, C = ui.C, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), W = core.CAM.W, H = core.CAM.H, IN = core.CAM.input, PAD = core.CAM.pad;
  var LB = core.letterboxFit(W, H, IN), ST = core.stretchFit(W, H, IN);
  var S = ui.store.s.s1 = Object.assign({ x: 0.3, z: 2, ch: "colour", pad: PAD, channel: "RGB", fit: "letterbox", probe: [360, 640], crop: null, mb: { i: 0, solved: {}, tries: 0 } }, ui.store.s.s1 || {});
  function fact(key, text) { return (text || MD.facts[key].v) + " " + MD.cite(key); }
  function scene() { return { seed: 5, objects: [{ kind: "microduck", x: S.x, z: S.z }] }; }

  /* ---------- the frame, at full resolution ---------- */
  var full = document.createElement("canvas"), img = null, gt = null;
  function renderScene() {
    var sc = scene();
    ui.renderRoom(full, sc, K, { scale: 1 });
    img = full.getContext("2d").getImageData(0, 0, W, H);
    gt = core.sceneGTs(sc, K).filter(function (g) { return g.isDuck; })[0] || null;
  }

  /* ---------- pixels are numbers ---------- */
  var chSeg = ui.seg("s1ch", [{ v: "colour", label: "colour" }, { v: 0, label: "R only" }, { v: 1, label: "G only" }, { v: 2, label: "B only" }], S.ch, function (v) { S.ch = v; ui.save(); drawFrame(); probe(); ui.touch("s1"); });
  function channelImage(src, c) {
    var out = new Uint8ClampedArray(src.data.length), d = src.data;
    for (var i = 0; i < d.length; i += 4) { var v = d[i + c]; out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255; }
    return { data: out, width: src.width, height: src.height };
  }
  function drawFrame() {
    var c = $("s1f");
    if (S.ch === "colour") { c.width = 360; c.height = 640; c.getContext("2d").drawImage(full, 0, 0, 360, 640); }
    else ui.putImage(c, channelImage(img, +S.ch));
  }
  function pixelAt(u, v) { var i = (v * W + u) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; }
  function probe() {
    var u = core.clamp(Math.round(S.probe[0]), 0, W - 1), v = core.clamp(Math.round(S.probe[1]), 0, H - 1), p = pixelAt(u, v);
    // crosshair
    var o = $("s1fo").getContext("2d"); o.clearRect(0, 0, 360, 640);
    o.strokeStyle = C.red; o.lineWidth = 2; o.strokeRect(u / 2 - 6, v / 2 - 6, 12, 12);
    o.strokeStyle = "rgba(200,69,47,.5)"; o.lineWidth = 1; o.beginPath(); o.moveTo(u / 2, 0); o.lineTo(u / 2, 640); o.moveTo(0, v / 2); o.lineTo(360, v / 2); o.stroke();
    // loupe: 11×11 around (u, v), 8 px each
    var L = $("s1lp").getContext("2d");
    for (var dy = -5; dy <= 5; dy++) for (var dx = -5; dx <= 5; dx++) {
      var uu = u + dx, vv = v + dy, q = (uu < 0 || vv < 0 || uu >= W || vv >= H) ? null : pixelAt(uu, vv);
      if (q && S.ch !== "colour") { var g = q[+S.ch]; q = [g, g, g]; }
      L.fillStyle = q ? "rgb(" + q.join(",") + ")" : "#DDD"; L.fillRect((dx + 5) * 8, (dy + 5) * 8, 8, 8);
    }
    L.strokeStyle = C.red; L.lineWidth = 2; L.strokeRect(41, 41, 8, 8);
    // readout
    var off = (v * W + u) * 3;
    $("s1read").innerHTML = 'row <b>' + v + '</b>, column <b>' + u + '</b> → <code>img[' + v + '][' + u + ']</code> = [<b style="color:#A5321F">' + p[0] + '</b>, <b style="color:#3B7422">' + p[1] + '</b>, <b style="color:#246A9C">' + p[2] + '</b>]' + (S.ch !== "colour" ? ' · showing channel ' + "RGB"[+S.ch] + ' only' : '');
    ui.qa("#s1bars div").forEach(function (b, i) { b.style.height = Math.max(3, p[i] / 255 * 92) + "px"; b.firstChild.textContent = p[i]; });
    $("s1pxmath").innerHTML = '<div class="eq">byte offset = (row · W + column) · 3</div><div class="eqn">(' + v + ' · 720 + ' + u + ') · 3 = <b>' + fmt(off) + '</b> of 2,764,800 · as float32 after ÷ 255: [' + p.map(function (x) { return fmt(x / 255, 3); }).join(", ") + ']</div>';
  }
  (function bindProbe() {
    var el = $("s1pf");
    function at(e) { var r = el.getBoundingClientRect(); S.probe = [Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H)]; probe(); }
    el.addEventListener("pointermove", at);
    el.addEventListener("pointerdown", function (e) { at(e); ui.save(); ui.touch("s1"); e.preventDefault(); });
    el.addEventListener("keydown", function (e) {
      var k = e.key, s = e.shiftKey ? 10 : 1, dx = k === "ArrowLeft" ? -s : k === "ArrowRight" ? s : 0, dy = k === "ArrowUp" ? -s : k === "ArrowDown" ? s : 0;
      if (dx || dy) { S.probe = [core.clamp(S.probe[0] + dx, 0, W - 1), core.clamp(S.probe[1] + dy, 0, H - 1)]; probe(); ui.save(); ui.touch("s1"); e.preventDefault(); }
    });
  })();
  $("s1pxrobot").innerHTML = '<b>On the robot.</b> ' + fact("stream") + ', ' + fact("turn") + '. Upright, as an array, that is (1280, 720, 3): 2,764,800 uint8 values, 2.76 MB per frame, from "a 30 fps camera" <a class="src" href="' + MD.repo + '/blob/' + MD.commit + '/duck-detect/src/lib.rs#L107" target="_blank" rel="noopener">duck-detect/src/lib.rs:107</a>.';

  /* ---------- the mount ---------- */
  var shade = $("s1shade");
  shade.addEventListener("change", function () { drawMount(); ui.touch("s1"); });
  function drawStreamed(canvas) { var x = canvas.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 640, 360); x.save(); x.translate(0, 360); x.rotate(-Math.PI / 2); x.drawImage(full, 0, 0, 360, 640); x.restore(); }
  var lbImg = null;
  function drawMount() {
    drawStreamed($("s1m0"));
    $("s1m1").getContext("2d").drawImage(full, 0, 0, 360, 640);
    lbImg = core.letterboxPixels(img, IN, {});
    ui.putImage($("s1m2"), lbImg);
    ui.putImage($("s1m3"), core.letterboxPixels(img, IN, { fit: "stretch" }));
    var o2 = $("s1m2o").getContext("2d"), o3 = $("s1m3o").getContext("2d"); o2.clearRect(0, 0, IN, IN); o3.clearRect(0, 0, IN, IN);
    var bl = gt ? core.boxToInput(gt.box, LB) : null, bs = gt ? core.boxToInput(gt.box, ST) : null;
    if (shade.checked) {
      o2.fillStyle = "rgba(200,69,47,.28)"; o2.fillRect(0, 0, LB.padX, IN); o2.fillRect(IN - LB.padX, 0, LB.padX, IN);
      o2.fillStyle = "#FFFDF6"; o2.font = "bold 15px Grandstander, sans-serif"; o2.textAlign = "center"; o2.textBaseline = "middle"; o2.fillText("70", LB.padX / 2, 20); o2.fillText("70", IN - LB.padX / 2, 20);
      if (bl) { ui.boxPath(o2, bl, C.grn, 2.5); ui.boxPath(o3, bs, C.red, 2.5); }
    }
    var lbw = bl ? bl[2] - bl[0] : 0, lbh = bl ? bl[3] - bl[1] : 0;
    $("s1lbfit").textContent = "×" + LB.scale + " → " + LB.fw + "×" + LB.fh + " · " + LB.padX + " | " + LB.padX;
    $("s1grey").textContent = pct(1 - LB.fw * LB.fh / (IN * IN), 2);
    $("s1stretch").textContent = fmt(ST.sx / ST.sy, 2) + "× too wide";
    $("s1boxlb").textContent = bl ? fmt(lbw, 1) + " × " + fmt(lbh, 1) : "out of frame"; $("s1boxst").textContent = bs ? fmt(bs[2] - bs[0], 1) + " × " + fmt(bs[3] - bs[1], 1) : "out of frame";
    $("s1lbmath").innerHTML = '<div class="eq">s = min(320 ÷ W, 320 ÷ H) · fitted = (W·s, H·s) · pad<sub>x</sub> = (320 − W·s) ÷ 2</div><div class="eqn">s = min(320 ÷ 720, 320 ÷ 1280) = min(0.444, 0.25) = <b>0.25</b> → fitted <b>180 × 320</b> → pad<sub>x</sub> = (320 − 180) ÷ 2 = <b>70</b>, pad<sub>y</sub> = 0 → grey = 2 · 70 · 320 ÷ 102,400 = <b>43.75%</b><br>stretch instead: s<sub>x</sub> = 320 ÷ 720 = <b>0.444</b>, s<sub>y</sub> = 320 ÷ 1280 = <b>0.25</b> → s<sub>x</sub> ÷ s<sub>y</sub> = <b>1.78</b>' + (bl ? '<br>this duck: frame box ' + fmt(gt.box[2] - gt.box[0], 0) + ' × ' + fmt(gt.box[3] - gt.box[1], 0) + ' px → letterboxed ' + fmt(lbw, 1) + ' × ' + fmt(lbh, 1) + ' (shape kept) vs stretched ' + fmt(bs[2] - bs[0], 1) + ' × ' + fmt(bs[3] - bs[1], 1) : '') + '</div>';
  }
  $("s1mountrobot").innerHTML = '<b>On the robot.</b> ' + fact("pad") + ' · ' + fact("rgb") + ' · ' + fact("turn") + '. The 180-of-320 number is ours, computed from the robot\'s letterbox on its 720×1280 frame.';

  /* ---------- quietly worse ---------- */
  var session = null, apCache = {}, apTimer = null;
  var chanSeg = ui.seg("s1chan", [{ v: "RGB", label: "RGB (trained on)" }, { v: "BGR", label: "BGR" }], S.channel, function (v) { S.channel = v; ui.save(); quiet(); ui.touch("s1"); });
  var fitSeg = ui.seg("s1fit", [{ v: "letterbox", label: "letterbox (trained on)" }, { v: "stretch", label: "stretch" }], S.fit, function (v) { S.fit = v; ui.save(); quiet(); ui.touch("s1"); });
  $("s1pad").value = S.pad;
  ui.range("s1pad", function () { S.pad = +$("s1pad").value; ui.save(); quiet(); ui.touch("s1"); });
  $("s1reset").onclick = function () { S.pad = PAD; S.channel = "RGB"; S.fit = "letterbox"; $("s1pad").value = PAD; chanSeg.set("RGB"); fitSeg.set("letterbox"); ui.save(); quiet(); ui.touch("s1"); };
  // A stretch fills the whole square, so there is no card and the pad colour can't matter.
  function pre() { return { pad: S.fit === "stretch" ? PAD : S.pad, channel: S.channel, fit: S.fit }; }
  var CLEAN_KEY = "114|RGB|letterbox";
  function apKey(p) { return (p.pad === PAD ? "114" : "x") + "|" + p.channel + "|" + p.fit; }
  function apCompute(p) {
    var key = apKey(p);
    if (apCache[key] == null) {
      session = session || core.makeSession(2026, 40);
      apCache[key] = core.apAllPoint(core.prCurve(core.evalSession(session, K, { pre: p }), 0.5).pts);
    }
    return apCache[key];
  }
  function apFor(p, cb) {
    if (apCache[apKey(p)] != null && apCache[CLEAN_KEY] != null) return cb(apCache[apKey(p)]);
    clearTimeout(apTimer);
    apTimer = setTimeout(function () { apCompute({ pad: PAD, channel: "RGB", fit: "letterbox" }); cb(apCompute(p)); }, 20);
  }
  function quiet() {
    var p = pre();
    $("s1padv").textContent = S.pad + (S.fit === "stretch" ? " (unused: a stretch has no card)" : S.pad === PAD ? " (the contract)" : "");
    ui.putImage($("s1q"), core.letterboxPixels(img, IN, p));
    var d = core.detect(scene(), K, { pre: p }), kept = core.decode(d.raw, d.lb, 0.01, 0.5), best = 0;
    if (gt) kept.forEach(function (k) { if (core.iou(k.box, gt.box) >= 0.5 && k.score > best) best = k.score; });
    $("s1best").textContent = gt ? fmt(best, 2) : "no duck"; $("s1best").className = "v " + (best >= 0.5 ? "good" : best >= 0.35 ? "warn" : "bad");
    $("s1ap").textContent = "…"; $("s1drop").textContent = "measuring on 40 frames…"; $("s1drop").className = "chip";
    apFor(p, function (ap) {
      if (JSON.stringify(pre()) !== JSON.stringify(p)) return;
      var clean = apCache[CLEAN_KEY];
      $("s1ap").textContent = fmt(ap, 3); $("s1ap").className = "v " + (ap >= 0.95 ? "good" : ap >= 0.85 ? "warn" : "bad");
      var broken = [];
      if (p.pad !== PAD) broken.push("pad " + p.pad + " instead of 114"); if (p.channel === "BGR") broken.push("BGR"); if (p.fit === "stretch") broken.push("stretched");
      $("s1drop").textContent = clean == null ? "" : (broken.length ? sgn(ap - clean, 3) + " AP50 vs the contract's " + fmt(clean, 3) : "this is the contract: " + fmt(clean, 3));
      $("s1drop").className = "chip " + (broken.length ? (ap < 0.85 ? "bad" : "warn") : "good");
      var v = $("s1verdict");
      if (!broken.length) { v.className = "callout co-g"; v.innerHTML = "<b>Contract kept.</b> Grey 114, RGB, letterbox: what training and INT8 calibration saw. The held-out AP50 is the best this toy detector does."; }
      else { v.className = "callout co-r"; v.innerHTML = "<b>Broken: " + broken.join(", ") + ".</b> No exception, no warning, boxes still come out, and " + pct(1 - ap / clean, 0) + " of the held-out performance is gone. Nobody would notice without a held-out set and a number to compare against."; }
    });
  }
  $("s1quiet").innerHTML = '<b>On the robot.</b> ' + fact("quietly") + ' ' + fact("pad") + ' · ' + fact("rgb") + '.';

  /* ---------- nearest vs bilinear ---------- */
  function bilinearLetterbox(src, size, lb, pad) {
    var w = src.width, h = src.height, out = new Uint8ClampedArray(size * size * 4), i;
    for (i = 0; i < size * size; i++) { out[i * 4] = pad; out[i * 4 + 1] = pad; out[i * 4 + 2] = pad; out[i * 4 + 3] = 255; }
    for (var y = 0; y < lb.fh; y++) {
      var sy = core.clamp((y + 0.5) * h / lb.fh - 0.5, 0, h - 1), y0 = Math.floor(sy), y1 = Math.min(y0 + 1, h - 1), fy = sy - y0;
      for (var x = 0; x < lb.fw; x++) {
        var sx = core.clamp((x + 0.5) * w / lb.fw - 0.5, 0, w - 1), x0 = Math.floor(sx), x1 = Math.min(x0 + 1, w - 1), fx = sx - x0;
        var a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4, t = ((y + lb.padY) * size + (x + lb.padX)) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var top = src.data[a + ch] + (src.data[b + ch] - src.data[a + ch]) * fx, bot = src.data[c + ch] + (src.data[d + ch] - src.data[c + ch]) * fx;
          out[t + ch] = Math.round(top + (bot - top) * fy);
        }
        out[t + 3] = 255;
      }
    }
    return { data: out, width: size, height: size };
  }
  var biImg = null, CROP = 40;
  function cropOf(src, cx, cy) {
    var o = new Uint8ClampedArray(CROP * CROP * 4);
    for (var y = 0; y < CROP; y++) for (var x = 0; x < CROP; x++) { var s = ((cy + y) * src.width + cx + x) * 4, t = (y * CROP + x) * 4; o[t] = src.data[s]; o[t + 1] = src.data[s + 1]; o[t + 2] = src.data[s + 2]; o[t + 3] = 255; }
    return { data: o, width: CROP, height: CROP };
  }
  function cropDefault() { if (!gt) return [140, 140]; var b = core.boxToInput(gt.box, LB); return [(b[0] + b[2]) / 2 - CROP / 2, (b[1] + b[3]) / 2 - CROP / 2]; }
  function drawCrops() {
    var c = S.crop || cropDefault(), cx = Math.round(core.clamp(c[0], 0, IN - CROP)), cy = Math.round(core.clamp(c[1], 0, IN - CROP));
    ui.putImage($("s1t"), lbImg);
    var o = $("s1to").getContext("2d"); o.clearRect(0, 0, IN, IN); o.strokeStyle = C.gold; o.lineWidth = 3; o.strokeRect(cx, cy, CROP, CROP); o.strokeStyle = "rgba(255,253,246,.9)"; o.lineWidth = 1; o.strokeRect(cx - 2, cy - 2, CROP + 4, CROP + 4);
    var n = cropOf(lbImg, cx, cy), b = cropOf(biImg, cx, cy), sum = 0;
    ui.putImage($("s1cn"), n); ui.putImage($("s1cb"), b);
    for (var i = 0; i < n.data.length; i += 4) sum += Math.abs(n.data[i] - b.data[i]) + Math.abs(n.data[i + 1] - b.data[i + 1]) + Math.abs(n.data[i + 2] - b.data[i + 2]);
    $("s1diff").textContent = fmt(sum / (CROP * CROP * 3), 1) + " levels";
  }
  (function bindThumb() {
    var el = $("s1tf"), drag = false;
    function at(e) { var r = el.getBoundingClientRect(); S.crop = [(e.clientX - r.left) / r.width * IN - CROP / 2, (e.clientY - r.top) / r.height * IN - CROP / 2]; drawCrops(); }
    el.addEventListener("pointerdown", function (e) { drag = true; el.setPointerCapture(e.pointerId); at(e); ui.save(); ui.touch("s1"); e.preventDefault(); });
    el.addEventListener("pointermove", function (e) { if (drag) at(e); });
    el.addEventListener("pointerup", function () { drag = false; ui.save(); }); el.addEventListener("pointercancel", function () { drag = false; });
  })();
  $("s1nnrobot").innerHTML = '<b>On the robot.</b> ' + fact("nearest") + '. The same file\'s one-pass sampler adds why it can afford to: the input is a blurred photograph of a room being downscaled by four, and it fills only the model\'s 102,400 input pixels (' + fact("oldPreproc", "the change that took 345 ms out of a 407 ms look") + ').';

  /* ---------- challenge: map it back ---------- */
  var BOXES = [[110, 150, 132, 172], [80, 40, 120, 90], [200, 200, 236, 248], [130, 260, 170, 300], [95, 100, 140, 160], [180, 20, 210, 60], [70, 300, 120, 320], [150, 180, 190, 220], [100, 10, 126, 42], [214, 120, 246, 168]];
  var ORDER = (function () { var R = core.rng(2026), a = BOXES.map(function (_, i) { return i; }); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; })();
  function mbBox() { return BOXES[ORDER[S.mb.i % ORDER.length]]; }
  function mbExpected() { return core.boxFromInput(mbBox(), LB); }
  function drawChallenge(answer) {
    var b = mbBox();
    ui.putImage($("s1mbc"), lbImg);
    var o = $("s1mbo").getContext("2d"); o.clearRect(0, 0, IN, IN);
    o.fillStyle = "rgba(0,0,0,.25)"; o.fillRect(0, 0, IN, IN); o.clearRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    o.strokeStyle = C.gold; o.lineWidth = 3; o.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    o.fillStyle = "#FFFDF6"; o.font = "bold 13px Grandstander, sans-serif"; o.textAlign = b[0] < 200 ? "left" : "right";
    var lx = b[0] < 200 ? b[0] : b[2], topIn = b[1] < 16, botIn = b[3] > IN - 16;   // keep the labels on the canvas
    o.textBaseline = topIn ? "top" : "bottom"; o.fillText("(" + b[0] + ", " + b[1] + ")", lx, topIn ? b[1] + 3 : b[1] - 3);
    o.textBaseline = botIn ? "bottom" : "top"; o.fillText("(" + b[2] + ", " + b[3] + ")", lx, botIn ? b[3] - 3 : b[3] + 3);
    if (answer) { o.strokeStyle = C.grn; o.lineWidth = 2; o.setLineDash([5, 4]); var ab = core.boxToInput(answer, LB); o.strokeRect(ab[0], ab[1], ab[2] - ab[0], ab[3] - ab[1]); o.setLineDash([]); }
    $("s1mbcap").textContent = "input box [" + b.join(", ") + "] · x0, y0, x1, y1 in the 320 square";
    var solved = Object.keys(S.mb.solved).length;
    $("s1mbprog").textContent = "solved " + solved + " of " + BOXES.length + (S.mb.tries ? " · " + S.mb.tries + (S.mb.tries === 1 ? " try" : " tries") : "");
  }
  function mbMath(exp, b) {
    return '<div class="eq">x = (x<sub>in</sub> − 70) ÷ 0.25 · y = (y<sub>in</sub> − 0) ÷ 0.25</div><div class="eqn">x0 = (' + b[0] + ' − 70) ÷ 0.25 = <b>' + fmt(exp[0]) + '</b> · y0 = ' + b[1] + ' ÷ 0.25 = <b>' + fmt(exp[1]) + '</b><br>x1 = (' + b[2] + ' − 70) ÷ 0.25 = <b>' + fmt(exp[2]) + '</b> · y1 = ' + b[3] + ' ÷ 0.25 = <b>' + fmt(exp[3]) + '</b> → frame box [' + exp.map(function (v) { return fmt(v); }).join(", ") + ']<br>centre x = ' + fmt((exp[0] + exp[2]) / 2) + ' → bearing = (' + fmt((exp[0] + exp[2]) / 2) + ' ÷ 720) · 2 − 1 = <b>' + sgn(core.bearing(exp, W), 2) + '</b></div>';
  }
  function readAns() { return ["s1mx0", "s1my0", "s1mx1", "s1my1"].map(function (id) { var v = $(id).value.trim(); return v === "" ? NaN : +v; }); }
  $("s1mbgo").onclick = function () {
    var a = readAns(), exp = mbExpected(), b = mbBox(), names = ["x0", "y0", "x1", "y1"];
    if (a.some(isNaN)) { $("s1mbfb").innerHTML = '<span class="bad">Fill in all four numbers.</span>'; return; }
    S.mb.tries++; ui.touch("s1");
    var marks = a.map(function (v, i) { return Math.abs(v - exp[i]) <= 1; }), all = marks.every(Boolean);
    if (all) S.mb.solved[ORDER[S.mb.i % ORDER.length]] = true; ui.save();
    $("s1mbfb").innerHTML = (all ? '<span class="ok">✓ Right.</span> ' : '<span class="bad">Not yet.</span> ') + names.map(function (n, i) { return n + " " + (marks[i] ? '<span class="ok">' + fmt(a[i]) + ' ✓</span>' : '<span class="bad">' + fmt(a[i]) + ' ✗</span>'); }).join(" · ") + (all ? " · that box sits at bearing " + sgn(core.bearing(exp, W), 2) + "." : " · remember: only x has a pad to subtract, and both axes divide by 0.25 (multiply by 4).");
    $("s1mbmath").style.display = all ? "block" : "none"; if (all) $("s1mbmath").innerHTML = mbMath(exp, b);
    drawChallenge(all ? exp : null);
  };
  $("s1mbshow").onclick = function () { var exp = mbExpected(), b = mbBox(); S.mb.tries++; ui.save(); ["s1mx0", "s1my0", "s1mx1", "s1my1"].forEach(function (id, i) { $(id).value = fmt(exp[i]).replace(/,/g, ""); }); $("s1mbfb").innerHTML = '<span class="ok">Shown.</span> Now try the next one on your own.'; $("s1mbmath").style.display = "block"; $("s1mbmath").innerHTML = mbMath(exp, b); drawChallenge(exp); ui.touch("s1"); };
  $("s1mbnext").onclick = function () { S.mb.i++; ui.save(); ["s1mx0", "s1my0", "s1mx1", "s1my1"].forEach(function (id) { $(id).value = ""; }); $("s1mbfb").innerHTML = ""; $("s1mbmath").style.display = "none"; drawChallenge(null); ui.touch("s1"); };

  /* ---------- scene sliders + boot ---------- */
  var rq = null;
  function renderAll() {
    renderScene(); drawFrame(); probe(); drawMount();
    biImg = bilinearLetterbox(img, IN, LB, PAD);
    drawCrops(); quiet(); drawChallenge(null);
  }
  function queue() { if (rq) return; rq = requestAnimationFrame(function () { rq = null; renderAll(); }); }
  function labels() { $("s1xv").textContent = sgn(S.x, 2) + " m"; $("s1zv").textContent = fmt(S.z, 2) + " m"; }
  $("s1x").value = S.x; $("s1z").value = S.z; labels();
  ui.range("s1x", function () { S.x = +$("s1x").value; ui.save(); labels(); queue(); ui.touch("s1"); });
  ui.range("s1z", function () { S.z = +$("s1z").value; ui.save(); labels(); queue(); ui.touch("s1"); });
  renderAll();
});
