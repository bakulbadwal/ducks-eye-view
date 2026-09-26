/* Duck's-Eye View — step 2 · The Stencils.
   Unit 2: convolution by hand, stride and padding, receptive fields and YOLO's three grids, MobileNet's
   cheap stencils. Every number comes from DEV.core (exact); the room the stencils slide over is the
   synthetic camera's teaching model. */
Object.assign(window.DEV_GLOSSARY, {
  stride: ["Stride", "How far the kernel jumps between positions. Stride 1 visits every pixel; stride 2 skips every other one and roughly halves the output.", "How far the duckling slides the stencil each time."],
  padding: ["Padding", "A border of extra pixels (usually zeros) around the input so the kernel's centre can reach the edge pixels. Padding 1 with a 3×3 kernel keeps the size.", "A blank margin taped around the print so the stencil can hang over the edge."],
  featmap: ["Feature map", "The grid of sums one kernel writes as it slides: large where the kernel's pattern is present, near zero where it isn't.", "The new sheet the duckling fills in as it slides the stencil."],
  receptive: ["Receptive field", "The patch of the original input that one cell of a deep feature map can see. It grows with every layer, and faster with stride.", "How much of the big print one cell on a small print stands for."],
  depthwise: ["Depthwise-separable convolution", "MobileNet's trick: one k×k filter per input channel (space only), then a 1×1 filter that mixes channels. About 1/k² + 1/C_out of a standard convolution's cost.", "Stencil each colour of ink on its own, then mix the inks once per spot."],
  skip: ["Skip connection (ResNet)", "A wire that adds a block's input to its output, y = F(x) + x, so the block only learns the edit and the gradient keeps a direct path back.", "A copy of the print handed past the stencil table untouched."],
  transfer: ["Transfer learning", "Start from a network already trained on a big dataset; its early filters (edges, textures) carry over, and only the task-specific layers need your data.", "Ducklings who already know how to cut edge stencils, retrained to find ducks."],
  tops: ["TOPS", "Trillions of operations per second. Microduck's NPU is rated 0.8 TOPS in INT8, on one core.", "How many stencil strokes the little calculator manages in a second."]
});
DEV.navIcon("s2", "s2stencil");

DEV.step("s2", function (ui, core) {
  "use strict";
  var $ = ui.$, fmt = ui.fmt, C = ui.C, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), SIZE = core.CAM.input;
  var st = ui.store.s.s2 = ui.store.s.s2 || {};
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function touch() { ui.touch("s2"); }
  function fm(n, d) { return fmt(n, d).replace(/^-/, "−"); }   // fmt with a true minus sign
  // ui.ctxFor overwrites the height attribute with the device-pixel height; restore the CSS height first.
  function ctx(id, h) { $(id).setAttribute("height", h); return ui.ctxFor(id); }
  function ramp(t) {   // diverging: teal (−1) → paper (0) → brick (+1)
    var a = t < 0 ? [31, 111, 116] : [200, 69, 47], p = [251, 247, 236], u = Math.min(1, Math.abs(t));
    return [Math.round(p[0] + (a[0] - p[0]) * u), Math.round(p[1] + (a[1] - p[1]) * u), Math.round(p[2] + (a[2] - p[2]) * u)];
  }
  // The letterboxed 320×320 model input of a scene (RGB), exactly as the darkroom would hand it over.
  var inputCache = {};
  function inputOf(key, scene) {
    if (!inputCache[key]) inputCache[key] = core.letterboxPixels(ui.roomImage(scene, K, 0.5), SIZE, {});
    return inputCache[key];
  }

  /* ================= Widget 1 · Slide the stencil ================= */
  var SCENES = {
    near: { seed: 15, objects: [{ kind: "microduck", x: -0.12, z: 1.2 }] },
    far: { seed: 15, objects: [{ kind: "microduck", x: 0, z: 3 }] },
    mix: { seed: 15, objects: [{ kind: "microduck", x: 0.35, z: 2.2 }, { kind: "rubber", x: -0.32, z: 1.25 }, { kind: "print", x: 0.55, z: 5 }] }
  };
  var PRESETS = {
    identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    blur: [0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11],
    sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
    vedge: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
    hedge: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
    bill: [0, 1, 2, -1, 0, 1, -2, -1, 0]
  };
  var PRESET_NOTE = {
    identity: "Identity: a 1 in the middle copies the print. The feature map is the input.",
    blur: "Blur: every weight ≈ 1/9 averages the patch. Edges soften, noise fades.",
    sharpen: "Sharpen: 5 in the middle minus the four neighbours. Flat areas stay put, edges jump.",
    vedge: "Vertical edge (the course's Prewitt stencil): right column minus left column. It fires where dark meets bright left-to-right, and ignores horizontal edges.",
    hedge: "Horizontal edge: bottom row minus top row. The duck's shoulders and the skirting board light up; vertical edges vanish.",
    bill: "Bill finder: a diagonal edge. A learned kernel in a real CNN looks like this, tuned by backpropagation rather than typed in."
  };
  var w1 = { scene: st.scene || "far", stride: 1, gray: null, fm: null, cell: null, note: "vedge" };
  function kernel() { return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { var v = parseFloat($("s2k" + i).value); return isNaN(v) ? 0 : v; }); }
  function setKernel(k) { k.forEach(function (v, i) { $("s2k" + i).value = v; }); }
  function w1input() {
    var img = inputOf(w1.scene, SCENES[w1.scene]), g = core.toGray(img), n = SIZE * SIZE, g255 = new Float32Array(n), rgba = new Uint8ClampedArray(n * 4);
    for (var i = 0; i < n; i++) { var v = Math.round(g[i] * 255); g255[i] = v; rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
    w1.gray = g255; w1.cell = null;
    var gt = core.sceneGTs(SCENES[w1.scene], K)[0], ib = core.boxToInput(gt.box, core.letterboxFit(core.CAM.W, core.CAM.H, SIZE));
    w1.def = [ib[0], (ib[1] + ib[3]) / 2];   // the duck's left edge: a real edge for the first mathbox
    ui.putImage($("s2in"), { data: rgba, width: SIZE, height: SIZE });
    $("s2inov").width = SIZE; $("s2inov").height = SIZE;
  }
  function w1conv() {
    var k = kernel(), r = core.conv2d(w1.gray, SIZE, SIZE, k, 3, w1.stride, 1), m = 1;
    for (var i = 0; i < r.out.length; i++) if (Math.abs(r.out[i]) > m) m = Math.abs(r.out[i]);
    var rgba = new Uint8ClampedArray(r.w * r.h * 4);
    for (var j = 0; j < r.out.length; j++) { var c = ramp(r.out[j] / m); rgba[j * 4] = c[0]; rgba[j * 4 + 1] = c[1]; rgba[j * 4 + 2] = c[2]; rgba[j * 4 + 3] = 255; }
    ui.putImage($("s2fm"), { data: rgba, width: r.w, height: r.h });
    $("s2fmov").width = r.w; $("s2fmov").height = r.h;
    w1.fm = r; w1.max = m;
    $("s2fmsize").textContent = r.w + "×" + r.h;
    $("s2fmmax").textContent = fmt(m, 0);
    $("s2fmmul").textContent = fmt(r.w * r.h * 9);
    $("s2fmnote").textContent = PRESET_NOTE[w1.note] || "Your own stencil. Positive and negative weights that sum to zero make an edge finder; weights that sum to one make a smoother.";
    var out = core.convOutSize(SIZE, 3, 1, w1.stride);
    $("s2fmform").textContent = out + "×" + out;
    if (w1.cell) showCell(w1.cell[0], w1.cell[1]); else showCell(Math.round(w1.def[0] / w1.stride), Math.round(w1.def[1] / w1.stride));
  }
  function showCell(ox, oy) {
    var r = w1.fm; if (!r) return;
    ox = core.clamp(ox, 0, r.w - 1); oy = core.clamp(oy, 0, r.h - 1); w1.cell = [ox, oy];
    var k = kernel(), s = w1.stride, rows = [], total = 0, patch = [];
    for (var ky = 0; ky < 3; ky++) {
      var terms = [], sum = 0;
      for (var kx = 0; kx < 3; kx++) {
        var iy = oy * s + ky - 1, ix = ox * s + kx - 1, inside = iy >= 0 && iy < SIZE && ix >= 0 && ix < SIZE;
        var p = inside ? w1.gray[iy * SIZE + ix] : 0, w = k[ky * 3 + kx], prod = p * w;
        patch.push(inside ? p : null); sum += prod;
        terms.push((inside ? fmt(p) : '<span class="pad">0</span>') + "·" + (w < 0 ? "(" + fm(w, Number.isInteger(w) ? 0 : 2) + ")" : fm(w, Number.isInteger(w) ? 0 : 2)));
      }
      total += sum; rows.push(terms.join(" + ") + " = " + fm(sum, 1));
    }
    var v = r.out[oy * r.w + ox];
    $("s2math").innerHTML = '<div class="eq">out[' + oy + "][" + ox + "] = Σ patch × stencil</div><div class=\"eqn\">" +
      '<span class="s2patch">' + patch.map(function (p) { return "<i" + (p == null ? ' class="pad"' : "") + ' style="background:rgb(' + (p == null ? "114,114,114" : p + "," + p + "," + p) + ');color:' + ((p == null ? 114 : p) > 140 ? "#3A2418" : "#FFFDF6") + '">' + (p == null ? "pad" : p) + "</i>"; }).join("") + "</span>" +
      rows.join("<br>") + "<br>sum = <b>" + fm(v, 1) + "</b>" + (Math.abs(v) < 0.05 * w1.max ? ' <span class="muted">(flat patch: nothing to report)</span>' : v > 0 ? ' <span class="ok">(strong, positive → brick)</span>' : ' <span class="bad">(strong, negative → teal)</span>') + "</div>";
    // overlays
    var a = $("s2inov").getContext("2d"); a.clearRect(0, 0, SIZE, SIZE);
    a.strokeStyle = "#F4C430"; a.lineWidth = 2; a.strokeRect(ox * s - 1.5, oy * s - 1.5, 4, 4);
    a.strokeStyle = "rgba(244,196,48,.85)"; a.lineWidth = 3; a.beginPath(); a.arc(ox * s + 0.5, oy * s + 0.5, 16, 0, 7); a.stroke();
    a.strokeStyle = "#4A2E1E"; a.lineWidth = 1; a.beginPath(); a.arc(ox * s + 0.5, oy * s + 0.5, 18, 0, 7); a.stroke();
    var b = $("s2fmov").getContext("2d"); b.clearRect(0, 0, r.w, r.h);
    var R = Math.max(4, 16 / s);
    b.strokeStyle = "#F4C430"; b.lineWidth = Math.max(1, 3 / s); b.beginPath(); b.arc(ox + 0.5, oy + 0.5, R, 0, 7); b.stroke();
    b.strokeStyle = "#4A2E1E"; b.lineWidth = Math.max(0.5, 1 / s); b.beginPath(); b.arc(ox + 0.5, oy + 0.5, R + 1.2 / s, 0, 7); b.stroke();
  }
  function bindHover(frameId, canvasId, fn) {
    var f = $(frameId), cv = $(canvasId), down = false;
    function at(e) { var rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width, (e.clientY - rc.top) / rc.height]; }
    f.addEventListener("pointerdown", function (e) { down = true; var p = at(e); fn(p[0], p[1], true); e.preventDefault(); });
    f.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || down) { var p = at(e); fn(p[0], p[1], false); } });
    window.addEventListener("pointerup", function () { down = false; });
  }
  function initW1() {
    ui.seg("s2scene", [{ v: "near", label: "duck at 1.2 m" }, { v: "far", label: "duck at 3 m" }, { v: "mix", label: "duck, rubber duck, print" }], w1.scene, function (v) { w1.scene = v; st.scene = v; ui.save(); w1input(); w1conv(); touch(); });
    ui.seg("s2pre", [{ v: "identity", label: "identity" }, { v: "blur", label: "blur" }, { v: "sharpen", label: "sharpen" }, { v: "vedge", label: "vertical edge" }, { v: "hedge", label: "horizontal edge" }, { v: "bill", label: "bill finder" }], "vedge", function (v) { w1.note = v; setKernel(PRESETS[v]); w1conv(); touch(); });
    ui.seg("s2cs", [{ v: 1, label: "stride 1" }, { v: 2, label: "stride 2" }, { v: 4, label: "stride 4" }], 1, function (v) { w1.stride = +v; w1.cell = null; w1conv(); touch(); });
    var grid = $("s2kgrid"); grid.innerHTML = "";
    for (var i = 0; i < 9; i++) { var inp = document.createElement("input"); inp.type = "number"; inp.step = "any"; inp.id = "s2k" + i; inp.setAttribute("aria-label", "stencil weight row " + (Math.floor(i / 3) + 1) + " column " + (i % 3 + 1)); inp.addEventListener("input", function () { w1.note = null; ui.qa("#s2pre button").forEach(function (b) { b.classList.remove("on"); }); w1conv(); touch(); }); grid.appendChild(inp); }
    setKernel(PRESETS.vedge);
    bindHover("s2fmf", "s2fm", function (u, v) { showCell(Math.floor(u * w1.fm.w), Math.floor(v * w1.fm.h)); touch(); });
    bindHover("s2inf", "s2in", function (u, v) { showCell(Math.floor(u * SIZE / w1.stride), Math.floor(v * SIZE / w1.stride)); touch(); });
  }

  /* ================= Widget 2 · Stride and padding ================= */
  var EX5 = [0, 1, 5, 6, 5, 0, 0, 4, 5, 6, 1, 0, 5, 5, 5, 0, 1, 6, 4, 5, 0, 0, 5, 5, 6];   // the study guide's worked 5×5 (U2-cnns.md)
  var w2 = { pos: 0, anim: null };
  function prewitt(k) { var out = []; for (var r = 0; r < k; r++) for (var c = 0; c < k; c++) out.push(k === 1 ? 1 : c === 0 ? -1 : c === k - 1 ? 1 : 0); return out; }
  function w2vals(W) { if (W === 5) return EX5.slice(); var R = core.rng(W * 31 + 7), v = []; for (var i = 0; i < W * W; i++) v.push(Math.floor(R() * 10)); return v; }
  function w2read() { return { W: +$("s2W").value, Kk: +$("s2K").value, P: +$("s2P").value, S: +$("s2S").value }; }
  function w2render() {
    var q = w2read(), W = q.W, Kk = q.Kk, P = q.P, S = q.S;
    $("s2Wv").textContent = W + "×" + W; $("s2Kv").textContent = Kk + "×" + Kk; $("s2Pv").textContent = P; $("s2Sv").textContent = S;
    var out = core.convOutSize(W, Kk, P, S), num = W - Kk + 2 * P, rem = num >= 0 ? num % S : 0;
    var vals = w2vals(W), ker = prewitt(Kk), conv = out >= 1 ? core.conv2d(vals, W, W, ker, Kk, S, P) : null;
    var n = out >= 1 ? out * out : 0;
    $("s2pos").max = Math.max(0, n - 1); w2.pos = core.clamp(w2.pos, 0, Math.max(0, n - 1)); $("s2pos").value = w2.pos;
    $("s2fmath").innerHTML = '<div class="eq">out = ⌊(W − K + 2P) ÷ S⌋ + 1</div><div class="eqn">= ⌊(' + W + " − " + Kk + " + 2·" + P + ") ÷ " + S + "⌋ + 1 = ⌊" + fm(num) + " ÷ " + S + "⌋ + 1 = <b>" + (out >= 1 ? out : "0") + "</b>" +
      (out >= 1 ? " → " + out + "×" + out + " = " + n + " window" + (n === 1 ? "" : "s") : ' <span class="bad">the stencil is bigger than the padded print: nothing comes out</span>') +
      (rem ? '<br><span class="muted">' + rem + " leftover px at the far edge never get a full window: the ⌊ ⌋ drops them.</span>" : "") +
      (W === 5 && Kk === 3 && P === 0 && S === 1 ? '<br><span class="ok">The study guide\'s worked example: the course\'s Prewitt stencil on a 5×5, stride 1, no padding → 3×3, top-left cell 13.</span>' : "") + "</div>";
    $("s2kk").innerHTML = '<div class="kgrid ro" style="grid-template-columns:repeat(' + Kk + ',1fr)">' + ker.map(function (v) { return "<span>" + (v < 0 ? "−1" : v) + "</span>"; }).join("") + "</div>";
    $("s2gridstat").innerHTML = '<div class="stat"><div class="v">' + (out >= 1 ? out + "×" + out : "—") + '</div><div class="l">feature map</div></div><div class="stat"><div class="v acc">' + fmt(n) + '</div><div class="l">windows (positions)</div></div><div class="stat"><div class="v gold">' + fmt(n * Kk * Kk) + '</div><div class="l">multiply-adds</div></div>';
    // the picture
    var T = W + 2 * P, cs = Math.min(30, Math.floor(300 / Math.max(T, 6))), gap = 46, cs2 = cs;
    var wpx = T * cs + gap + Math.max(out, 1) * cs2 + 8, hpx = Math.max(T, Math.max(out, 1)) * cs + 34;
    var s = '<svg viewBox="0 0 ' + wpx + " " + hpx + '" width="100%" style="max-width:' + wpx + 'px;display:block" role="img" aria-label="The kernel window sliding over the input and filling the output">';
    var pr = Math.floor(w2.pos / Math.max(out, 1)), pc = w2.pos % Math.max(out, 1);
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      var isPad = y < P || y >= T - P || x < P || x >= T - P, val = isPad ? 0 : vals[(y - P) * W + (x - P)];
      var inWin = out >= 1 && y >= pr * S && y < pr * S + Kk && x >= pc * S && x < pc * S + Kk;
      s += '<rect x="' + (x * cs) + '" y="' + (y * cs + 22) + '" width="' + cs + '" height="' + cs + '" fill="' + (isPad ? "#727272" : inWin ? "#FFE27A" : "#FFFDF6") + '" stroke="#4A2E1E" stroke-width="1"/>';
      if (cs >= 16) s += '<text x="' + (x * cs + cs / 2) + '" y="' + (y * cs + 22 + cs / 2 + 1) + '" text-anchor="middle" dominant-baseline="middle" font-family="Patrick Hand, sans-serif" font-size="' + (cs * 0.55) + '" fill="' + (isPad ? "#FFFDF6" : "#3A2418") + '">' + val + "</text>";
    }
    if (out >= 1) s += '<rect x="' + (pc * S * cs) + '" y="' + (pr * S * cs + 22) + '" width="' + (Kk * cs) + '" height="' + (Kk * cs) + '" fill="none" stroke="#C8452F" stroke-width="3.5" rx="2"/>';
    s += '<text x="' + (T * cs / 2) + '" y="12" text-anchor="middle" font-family="Patrick Hand, sans-serif" font-size="14" fill="#6E5040">input ' + W + "×" + W + (P ? " + padding " + P : "") + "</text>";
    var ax = T * cs + 8, ay = 22 + (T * cs) / 2;
    s += '<path d="M' + ax + " " + ay + " h" + (gap - 18) + " m-6 -5 l6 5 -6 5\" fill=\"none\" stroke=\"#4A2E1E\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>";
    var ox0 = T * cs + gap;
    if (out >= 1) {
      for (var oy = 0; oy < out; oy++) for (var ox = 0; ox < out; ox++) {
        var idx = oy * out + ox, done = idx <= w2.pos, cur = idx === w2.pos;
        s += '<rect x="' + (ox0 + ox * cs2) + '" y="' + (oy * cs2 + 22) + '" width="' + cs2 + '" height="' + cs2 + '" fill="' + (cur ? "#FFE27A" : done ? "#CFE6F3" : "#F3EBDD") + '" stroke="#4A2E1E" stroke-width="' + (cur ? 2.5 : 1) + '"/>';
        if (done && cs2 >= 16) s += '<text x="' + (ox0 + ox * cs2 + cs2 / 2) + '" y="' + (oy * cs2 + 22 + cs2 / 2 + 1) + '" text-anchor="middle" dominant-baseline="middle" font-family="Patrick Hand, sans-serif" font-size="' + (cs2 * 0.5) + '" fill="#3A2418">' + fm(conv.out[idx]) + "</text>";
      }
      s += '<text x="' + (ox0 + out * cs2 / 2) + '" y="12" text-anchor="middle" font-family="Patrick Hand, sans-serif" font-size="14" fill="#6E5040">feature map ' + out + "×" + out + "</text>";
    } else s += '<text x="' + (ox0 + 20) + '" y="' + ay + '" font-family="Patrick Hand, sans-serif" font-size="15" fill="#A5321F">nothing</text>';
    s += "</svg>";
    $("s2slide").innerHTML = s;
    $("s2posv").textContent = out >= 1 ? "window " + (w2.pos + 1) + " of " + n + " · row " + pr + ", col " + pc + (conv ? " → " + fm(conv.out[w2.pos]) : "") : "—";
  }
  function w2play() {
    var n = +$("s2pos").max + 1; cancelAnimationFrame(w2.anim);
    if (reduced || n <= 1) { w2.pos = n - 1; w2render(); return; }
    var t0 = performance.now(), dur = 600;
    w2.pos = 0;
    (function tick(t) { var p = Math.min(1, (t - t0) / dur); w2.pos = Math.min(n - 1, Math.floor(p * n)); w2render(); if (p < 1) w2.anim = requestAnimationFrame(tick); })(t0);
  }
  function initW2() {
    ["s2W", "s2K", "s2P", "s2S"].forEach(function (id) { ui.range(id, function () { w2.pos = 0; w2render(); touch(); }); });
    ui.range("s2pos", function () { w2.pos = +$("s2pos").value; w2render(); touch(); });
    $("s2step").onclick = function () { var n = +$("s2pos").max + 1; w2.pos = (w2.pos + 1) % n; w2render(); touch(); };
    $("s2play").onclick = function () { w2play(); touch(); };
    $("s2ex").onclick = function () { $("s2W").value = 5; $("s2K").value = 3; $("s2P").value = 0; $("s2S").value = 1; w2.pos = 0; w2render(); touch(); };
    w2render();
  }

  /* ================= Widget 3 · Why three grids ================= */
  var w3 = { n: 5, grid: 8, z: 3 };
  function w3render() {
    var n = w3.n, layers = [], sizes = [SIZE];
    for (var i = 0; i < n; i++) { layers.push({ k: 3, s: 2 }); sizes.push(core.convOutSize(sizes[i], 3, 1, 2)); }
    var rf = core.receptiveField(layers), yg = core.yoloGrids(SIZE);
    $("s2lv").textContent = n;
    $("s2pipe").innerHTML = sizes.map(function (sz, j) {
      var keep = yg.grids.filter(function (g) { return g.n === sz; })[0];
      return '<div class="st' + (j === n ? " on" : "") + (keep && j <= n ? " hot" : "") + '"><b>' + sz + "×" + sz + "</b>" + (j === 0 ? "the input" : "after layer " + j + " · stride " + Math.pow(2, j)) + (keep && j <= n ? '<br><span class="ok">kept: the stride-' + keep.stride + " floor</span>" : "") + "</div>";
    }).join("");
    $("s2rf").innerHTML = '<div class="stat"><div class="v">' + sizes[n] + "×" + sizes[n] + '</div><div class="l">feature map after ' + n + " layer" + (n > 1 ? "s" : "") + '</div></div><div class="stat"><div class="v acc">' + rf.jump + ' px</div><div class="l">jump: one cell = this many input px</div></div><div class="stat"><div class="v gold">' + rf.r + ' px</div><div class="l">receptive field of one cell</div></div>';
    var terms = [], r = 1, j = 1;
    for (var t = 0; t < n; t++) { terms.push("2·" + j); r += 2 * j; j *= 2; }
    $("s2rfmath").innerHTML = '<div class="eq">r = 1 + Σ (k − 1)·jump,&nbsp; jump doubles each stride-2 layer</div><div class="eqn">r = 1 + ' + terms.join(" + ") + " = <b>" + r + " px</b> · jump = 2<sup>" + n + "</sup> = <b>" + rf.jump + " px</b><br>" +
      "the three floors: " + yg.grids.map(function (g) { return g.n + "² = " + fmt(g.cells); }).join(" + ") + " = <b>" + fmt(yg.total) + " pigeonholes</b></div>";
  }
  function w3grid() {
    var z = w3.z, s = w3.grid, scene = { seed: 15, objects: [{ kind: "microduck", x: 0, z: z }] }, key = "g" + z;
    $("s2zv").textContent = fmt(z, 2) + " m";
    var img = inputOf(key, scene);
    ui.putImage($("s2gin"), img);
    var ov = $("s2gov"); ov.width = SIZE; ov.height = SIZE;
    var x = ov.getContext("2d"); x.clearRect(0, 0, SIZE, SIZE);
    x.strokeStyle = "rgba(255,253,246,.75)"; x.lineWidth = s >= 32 ? 1.5 : 1;
    for (var g = 0; g <= SIZE; g += s) { x.beginPath(); x.moveTo(g + 0.5, 0); x.lineTo(g + 0.5, SIZE); x.stroke(); x.beginPath(); x.moveTo(0, g + 0.5); x.lineTo(SIZE, g + 0.5); x.stroke(); }
    var gt = core.sceneGTs(scene, K)[0], ib = core.boxToInput(gt.box, core.letterboxFit(core.CAM.W, core.CAM.H, SIZE));
    var h = ib[3] - ib[1], w = ib[2] - ib[0], cx = (ib[0] + ib[2]) / 2, cy = (ib[1] + ib[3]) / 2;
    // the cell under the duck's centre, and its receptive field in this toy stack
    var n = Math.round(Math.log(s) / Math.LN2), layers = []; for (var i = 0; i < n; i++) layers.push({ k: 3, s: 2 });
    var rf = core.receptiveField(layers), cc = Math.floor(cx / s), cr = Math.floor(cy / s);
    x.fillStyle = "rgba(244,196,48,.35)"; x.fillRect(cc * s, cr * s, s, s);
    x.setLineDash([4, 3]); x.strokeStyle = "#F4C430"; x.lineWidth = 2; x.strokeRect((cc + 0.5) * s - rf.r / 2, (cr + 0.5) * s - rf.r / 2, rf.r, rf.r); x.setLineDash([]);
    x.strokeStyle = "#C8452F"; x.lineWidth = 2; x.strokeRect(ib[0], ib[1], w, h);
    var size = Math.sqrt(w * h), ratio = Math.log(size / (3 * s)) / Math.LN2, fit = Math.abs(ratio) < 0.5 ? "good" : Math.abs(ratio) < 1 ? "warn" : "bad";
    var best = [8, 16, 32].map(function (q) { return { s: q, d: Math.abs(Math.log(size / (3 * q)) / Math.LN2) }; }).sort(function (a, b) { return a.d - b.d; })[0].s;
    $("s2gstat").innerHTML = '<div class="stat"><div class="v">' + fmt(h, 1) + ' px</div><div class="l">duck height in the 320 input (' + fmt(gt.box[3] - gt.box[1], 1) + ' px in the frame)</div></div>' +
      '<div class="stat"><div class="v acc">' + s + ' px</div><div class="l">one cell on the ' + (SIZE / s) + "×" + (SIZE / s) + ' floor</div></div>' +
      '<div class="stat"><div class="v gold">' + fmt(h / s, 1) + '</div><div class="l">cells the duck spans</div></div>' +
      '<div class="stat"><div class="v ' + fit + '">' + (fit === "good" ? "good fit" : fit === "warn" ? "so-so" : "poor fit") + '</div><div class="l">best floor for this duck: stride ' + best + "</div></div>";
    $("s2gnote").innerHTML = "Dashed gold square: the <span class=\"g\" data-g=\"receptive\">receptive field</span> of the cell under the duck in this toy stack (" + rf.r + " px). The real backbone stacks several stencils per floor, so its cells see much further; the rule of thumb here (an object suits the floor whose cells are about a third of its size) is this page's teaching detector's, not Ultralytics' exact assigner.";
    ui.initTips($("s2gnote"));
  }
  function initW3() {
    ui.range("s2layers", function () { w3.n = +$("s2layers").value; w3render(); touch(); });
    ui.seg("s2grid", [{ v: 8, label: "40×40 · stride 8" }, { v: 16, label: "20×20 · stride 16" }, { v: 32, label: "10×10 · stride 32" }], 8, function (v) { w3.grid = +v; w3grid(); touch(); });
    ui.range("s2z", function () { w3.z = +$("s2z").value; w3grid(); touch(); });
    $("s2gcite").innerHTML = "<b>On the robot.</b> The design note reckons " + MD.facts.rangeMath.v + " (" + MD.cite("rangeMath") + "); the pinhole model with this lab's full-width sensor mode gives 22 px tall in the 320 input, 89 px in the frame (our inference, see the map room). And the head really does post " + MD.facts.candidates.v + " (" + MD.cite("candidates") + ").";
    w3render();
  }

  /* ================= Widget 4 · Cheap stencils ================= */
  var w4 = { k: 3 };
  function w4read() { var cin = core.clamp(Math.round(+$("s2cin").value) || 1, 1, 1024), cout = core.clamp(Math.round(+$("s2cout").value) || 1, 1, 1024); return { cin: cin, cout: cout, k: w4.k, o: +$("s2osz").value, bias: $("s2bias").checked }; }
  function w4render() {
    var q = w4read(), sp = core.convParams(q.cin, q.cout, q.k, q.bias), pp = core.separableParams(q.cin, q.cout, q.k, q.bias);
    var sm = core.convMults(q.cin, q.cout, q.k, q.o, q.o), pm = core.separableMults(q.cin, q.cout, q.k, q.o, q.o);
    var tops = 0.8e12, tS = 2 * sm / tops, tP = 2 * pm / tops;   // a multiply-add counted as two ops
    $("s2oszv").textContent = q.o + "×" + q.o;
    function us(t) { return t < 1e-3 ? fmt(t * 1e6, 0) + " µs" : fmt(t * 1e3, 2) + " ms"; }
    $("s2cstat").innerHTML = '<div class="stat"><div class="v bad">' + fmt(sp) + '</div><div class="l">standard weights' + (q.bias ? " (+bias)" : "") + '</div></div><div class="stat"><div class="v good">' + fmt(pp) + '</div><div class="l">separable weights' + (q.bias ? " (+bias)" : "") + '</div></div><div class="stat big"><div class="v gold">' + fmt(sp / pp, 2) + '×</div><div class="l">fewer weights</div></div>' +
      '<div class="stat"><div class="v bad">' + fmt(sm / 1e6, 1) + ' M</div><div class="l">standard multiply-adds per look</div></div><div class="stat"><div class="v good">' + fmt(pm / 1e6, 2) + ' M</div><div class="l">separable multiply-adds per look</div></div><div class="stat"><div class="v acc">' + us(tS) + " → " + us(tP) + '</div><div class="l">at 0.8 TOPS, this layer alone (our arithmetic)</div></div>';
    $("s2cmath").innerHTML = '<div class="eq">standard = k²·C<sub>in</sub>·C<sub>out</sub>' + (q.bias ? " + C<sub>out</sub>" : "") + ' &nbsp;·&nbsp; separable = k²·C<sub>in</sub>' + (q.bias ? " + C<sub>in</sub>" : "") + " + C<sub>in</sub>·C<sub>out</sub>" + (q.bias ? " + C<sub>out</sub>" : "") + '</div><div class="eqn">standard = ' + q.k + "²·" + q.cin + "·" + q.cout + (q.bias ? " + " + q.cout : "") + " = <b>" + fmt(sp) + "</b><br>separable = " + fmt(q.k * q.k * q.cin) + (q.bias ? " + " + q.cin : "") + " + " + fmt(q.cin * q.cout) + (q.bias ? " + " + q.cout : "") + " = <b>" + fmt(pp) + "</b><br>ratio ≈ 1/C<sub>out</sub> + 1/k² = 1/" + q.cout + " + 1/" + (q.k * q.k) + " = <b>" + fmt(1 / q.cout + 1 / (q.k * q.k), 3) + "</b> of the cost (" + fmt(pp / sp, 3) + " exactly" + (q.bias ? ", with biases" : "") + ")</div>";
    ui.redrawAll();
  }
  ui.drawer("s2cost", function () {
    var g = ctx("s2cost", 110), x = g.x, q = w4read(), sm = core.convMults(q.cin, q.cout, q.k, q.o, q.o), pm = core.separableMults(q.cin, q.cout, q.k, q.o, q.o);
    var pad = { l: 118, r: 70, t: 14, b: 10 }, bw = (g.h - pad.t - pad.b - 12) / 2, W = g.w - pad.l - pad.r;
    [["standard", sm, C.red], ["separable", pm, C.grn]].forEach(function (row, i) {
      var y = pad.t + i * (bw + 12), w = Math.max(3, W * row[1] / sm);
      x.fillStyle = row[2]; x.strokeStyle = C.ink; x.lineWidth = 2; x.fillRect(pad.l, y, w, bw); x.strokeRect(pad.l, y, w, bw);
      x.fillStyle = C.txt; x.textAlign = "right"; x.font = "16px 'Patrick Hand', sans-serif"; x.fillText(row[0], pad.l - 8, y + bw / 2);
      x.textAlign = "left"; x.fillStyle = C.dim; x.fillText(fmt(row[1] / 1e6, row[1] < 1e6 ? 2 : 1) + " M", pad.l + w + 6, y + bw / 2);
    });
  });
  function initW4() {
    ["s2cin", "s2cout"].forEach(function (id) { $(id).addEventListener("input", function () { w4render(); touch(); }); });
    ui.seg("s2ck", [{ v: 1, label: "1×1" }, { v: 3, label: "3×3" }, { v: 5, label: "5×5" }, { v: 7, label: "7×7" }], 3, function (v) { w4.k = +v; w4render(); touch(); });
    ui.range("s2osz", function () { w4render(); touch(); });
    $("s2bias").onchange = function () { w4render(); touch(); };
    $("s2c3264").onclick = function () { $("s2cin").value = 32; $("s2cout").value = 64; w4.k = 3; ui.qa("#s2ck button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === "3"); }); $("s2osz").value = 80; w4render(); touch(); };
    $("s2npu").innerHTML = "<b>On the robot.</b> The detector runs on an " + MD.facts.npu.v + " (" + MD.cite("npu") + "), budgeted at " + MD.facts.work.v + " (" + MD.cite("work") + "). Every multiply you skip is heat you don't make next to a walking controller. yolo11n is mostly ordinary small convolutions, not a MobileNet (our reading of the Ultralytics family, not a repo fact); the lesson still sets the price of a look.";
  }

  /* ================= boot ================= */
  initW1(); initW2(); initW3(); initW4();
  var first = true;
  DEV.onShow("s2", function () {
    if (first) { first = false; w1input(); w1conv(); w3grid(); w4render(); }
  });
});
