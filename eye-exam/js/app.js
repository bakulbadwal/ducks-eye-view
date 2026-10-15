/* Eye Exam — UI. Every number shown is computed by window.EE (core.js) from seeded photos of a toy chart; nothing is
   hard-coded except the paper and repository figures quoted in the prose. */
(function () {
  "use strict";
  var EE = window.EE, GL = window.EE_GLOSSARY, IC = window.EE_ICONS || {}, ART = window.EE_ART || {};
  var $ = function (id) { return document.getElementById(id); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- formatting ---------------- */
  function fmt(n, d) { if (n == null || !isFinite(n)) return "–"; d = d == null ? 0 : d; if (Math.abs(n) < 0.5 * Math.pow(10, -d)) n = 0; return Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function sgn(n, d) { var p = Math.pow(10, d == null ? 0 : d), r = Math.round(n * p) / p; return (r > 0 ? "+" : r < 0 ? "−" : "") + fmt(Math.abs(r), d); }
  function pct(p, d) { return fmt(p * 100, d == null ? 0 : d) + "%"; }
  function spct(p, d) { return sgn(p * 100, d == null ? 2 : d) + "%"; }
  function px(v, d) { return fmt(v, d == null ? 2 : d) + " px"; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function minus(s) { return String(s).replace(/-/g, "−"); }

  /* ---------------- progress ---------------- */
  var KEY = "eye-exam-v1";
  var store = { predicts: {}, touched: {}, said: {}, cap: {}, ft: {} };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) store = Object.assign(store, saved); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  var REDUCED = false; try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ---------------- colours (match css tokens) ---------------- */
  var COL = { ink: "#3A2418", line: "#4A2E1E", soft: "#6E5040", sheet: "#FFFDF6", paper: "#FBF7EC", rule: "#E7DCC4", wall: "#EDE7DA",
    model: "#246A9C", truth: "#3B7422", err: "#A5321F", yellow: "#F4C430", yellowD: "#8A6300", lilac: "#5E4A94", shop: "#1F7A7A", grass: "#5FA03C", brick: "#C8452F", sky: "#9CCBEA", sand: "#DDBB8A" };

  /* ---------------- nav ---------------- */
  var NAV_ICON = { s0: "eye", s1: "trace", s2: "tally", s3: "card", s4: "dial", s5: "onetwo", s6: "glasses", cap: "star", ft: "pencil" };
  var sections = qa("section");
  function buildNav() {
    var nav = $("nav"); nav.innerHTML = "";
    sections.forEach(function (s) {
      var b = document.createElement("button"); b.type = "button"; b.dataset.for = s.id;
      b.innerHTML = '<span class="ic" aria-hidden="true">' + (IC[NAV_ICON[s.id]] || "") + "</span>" + s.dataset.n + " · " + s.dataset.title + (store.said[s.id] ? '<span class="chk">✓</span>' : "");
      b.onclick = function () { show(s.id); };
      nav.appendChild(b);
    });
  }
  function show(id) {
    sections.forEach(function (s) { s.classList.toggle("on", s.id === id); });
    qa("#nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.for === id); });
    if (location.hash !== "#/" + id) history.replaceState(null, "", "#/" + id);
    window.scrollTo(0, 0);
    setTimeout(redrawAll, 0);
  }
  function markNav() { var cur = sections.filter(function (s) { return s.classList.contains("on"); })[0]; if (cur) qa("#nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.for === cur.id); }); }
  var redraws = [];
  function redrawAll() { redraws.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn(e); } }); }
  function onStep(id) { return $(id).classList.contains("on"); }

  /* ---------------- predictions & say-it ---------------- */
  function touch(sec) { store.touched[sec] = (store.touched[sec] || 0) + 1; save(); checkSay(sec); }
  function checkSay(sec) {
    var el = $(sec); if (!el) return;
    var say = el.querySelector(".say"); if (!say) return;
    var preds = qa(".predict", el);
    var allAnswered = preds.every(function (p) { return store.predicts[p.dataset.p] != null; });
    if (allAnswered && (store.touched[sec] || 0) > 0) {
      say.classList.add("open");
      if (!store.said[sec]) { store.said[sec] = true; save(); buildNav(); markNav(); }
    }
  }
  function initPredicts() {
    qa(".predict").forEach(function (p) {
      var key = p.dataset.p, btns = qa(".opts button", p), sec = p.closest("section").id;
      function reveal(idx) {
        btns.forEach(function (b, i) { b.disabled = true; if (b.hasAttribute("data-right")) b.classList.add("right"); else if (i === idx) b.classList.add("wrong"); });
        p.classList.add("done");
      }
      btns.forEach(function (b, i) { b.onclick = function () { store.predicts[key] = i; save(); reveal(i); checkSay(sec); }; });
      if (store.predicts[key] != null) reveal(store.predicts[key]);
    });
  }

  /* ---------------- glossary tips ---------------- */
  function bindTip(el) {
    var g = GL[el.dataset.g]; if (!g) return;
    el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
    var tip = $("tip");
    function place() {
      tip.innerHTML = "<b>" + g[0] + "</b><br>" + g[1] + '<span class="kt">At the optician\'s: ' + g[2] + "</span>";
      tip.style.display = "block";
      var r = el.getBoundingClientRect(), tw = Math.min(320, window.innerWidth - 24);
      tip.style.width = tw + "px";
      var left = Math.max(12, Math.min(window.innerWidth - tw - 12, r.left + r.width / 2 - tw / 2));
      var top = r.bottom + 8; if (top + tip.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - tip.offsetHeight - 8);
      tip.style.left = left + "px"; tip.style.top = top + "px";
    }
    el.addEventListener("mouseenter", place); el.addEventListener("focus", place);
    el.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    el.addEventListener("blur", function () { tip.style.display = "none"; });
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (tip.style.display === "block") tip.style.display = "none"; else place(); });
  }
  document.addEventListener("click", function () { $("tip").style.display = "none"; });
  window.addEventListener("scroll", function () { $("tip").style.display = "none"; }, { passive: true });

  /* ---------------- small widgets ---------------- */
  function seg(el, opts, val, onChange) {
    el.innerHTML = "";
    opts.forEach(function (o) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = o.label;
      if (o.v === val) b.classList.add("on");
      b.onclick = function () { qa("button", el).forEach(function (x) { x.classList.toggle("on", x === b); }); onChange(o.v); };
      el.appendChild(b);
    });
  }
  function anim(msDur, onFrame, onDone) {
    var h = { stopped: false, stop: function () { h.stopped = true; } }, t0 = null;
    if (REDUCED) { onFrame(1); if (onDone) onDone(); return h; }
    (function loop(ts) {
      if (h.stopped) return;
      if (t0 == null) t0 = ts;
      var u = Math.max(0, Math.min(1, (ts - t0) / msDur));
      onFrame(u);
      if (u < 1) requestAnimationFrame(loop); else if (onDone) onDone();
    })(performance.now());
    return h;
  }
  // Runs job(k) for k = 0 … n−1 in slices of ~25 ms so the page stays responsive.
  function slices(n, job, onProgress, onDone) {
    var k = 0, h = { stopped: false, stop: function () { h.stopped = true; } };
    (function chunk() {
      if (h.stopped) return;
      var t0 = performance.now();
      while (k < n && performance.now() - t0 < 25) { job(k); k++; }
      if (onProgress) onProgress(k, n);
      if (k < n) setTimeout(chunk, 0); else if (onDone) onDone();
    })();
    return h;
  }
  function busy(ids, on) { ids.forEach(function (b) { if ($(b)) $(b).disabled = on; }); }
  function later(fn) { setTimeout(fn, 30); }

  /* ---------------- canvas basics ---------------- */
  function prep(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 600, h = cv.clientHeight || Math.round(w * 9 / 16);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g: g, W: w, H: h };
  }
  var HAND = "'Patrick Hand', 'Comic Sans MS', sans-serif", SIGN = "'Grandstander', 'Patrick Hand', sans-serif";

  /* ================= THE FRAME: what the duck's camera sees (1280 × 720) ================= */
  // o: { cam, pose } to paint the chart · seen: corners found (dots) · model: predicted corners (rings) ·
  //    arrows: { from, to, k } error arrows k times longer · hlines: H to draw the chart's grid through ·
  //    heat: a mapError grid · dots: many small corner dots · marks: true to show the principal point and the middle.
  function drawFrame(id, o) {
    var c = prep($(id)), g = c.g, Wc = c.W, Hc = c.H, sx = Wc / EE.W, sy = Hc / EE.H;
    var X = function (u) { return (u + 0.5) * sx; }, Y = function (v) { return (v + 0.5) * sy; };
    g.fillStyle = COL.wall; g.fillRect(0, 0, Wc, Hc);
    if (o.heat) heat(g, o.heat, Wc, Hc);
    if (o.cam && o.pose) paintChart(g, o.cam, o.pose, X, Y, o.faint);
    if (o.hlines) {
      g.strokeStyle = COL.model; g.lineWidth = 1.3; g.setLineDash([4, 3]);
      for (var i = 0; i < EE.CHART.cols; i++) { g.beginPath(); for (var j = 0; j < EE.CHART.rows; j++) { var p = EE.applyH(o.hlines, i * 25, j * 25); if (j) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); } g.stroke(); }
      for (j = 0; j < EE.CHART.rows; j++) { g.beginPath(); for (i = 0; i < EE.CHART.cols; i++) { p = EE.applyH(o.hlines, i * 25, j * 25); if (i) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); } g.stroke(); }
      g.setLineDash([]);
    }
    if (o.dots) { g.fillStyle = "rgba(58,36,24,.55)"; o.dots.forEach(function (p) { g.fillRect(X(p[0]) - 1, Y(p[1]) - 1, 2, 2); }); }
    var r = Math.max(2.2, Math.min(4, Wc / 260));
    if (o.model) { g.strokeStyle = COL.model; g.lineWidth = 1.8; o.model.forEach(function (p) { if (!p) return; g.beginPath(); g.arc(X(p[0]), Y(p[1]), r + 2.2, 0, 7); g.stroke(); }); }
    if (o.arrows) {
      g.strokeStyle = COL.err; g.fillStyle = COL.err; g.lineWidth = 1.6;
      o.arrows.from.forEach(function (a, k) {
        var b = o.arrows.to[k]; if (!a || !b) return;
        var x0 = X(a[0]), y0 = Y(a[1]), x1 = x0 + (b[0] - a[0]) * o.arrows.k * sx, y1 = y0 + (b[1] - a[1]) * o.arrows.k * sy, L = Math.hypot(x1 - x0, y1 - y0);
        if (L < 0.8) return;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        var ang = Math.atan2(y1 - y0, x1 - x0), hd = Math.min(6, L * 0.5);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - hd * Math.cos(ang - 0.45), y1 - hd * Math.sin(ang - 0.45)); g.lineTo(x1 - hd * Math.cos(ang + 0.45), y1 - hd * Math.sin(ang + 0.45)); g.closePath(); g.fill();
      });
    }
    if (o.seen) { g.fillStyle = COL.yellow; g.strokeStyle = COL.ink; g.lineWidth = 1.2; o.seen.forEach(function (p) { if (!p) return; g.beginPath(); g.arc(X(p[0]), Y(p[1]), r * 0.8, 0, 7); g.fill(); g.stroke(); }); }
    if (o.marks !== false) {
      cross(g, X(639.5), Y(359.5), 7, COL.soft, 1.6);
      cross(g, X(EE.TRUE_LENS.cx), Y(EE.TRUE_LENS.cy), 9, COL.err, 2.4);
    }
    // the frame's border and its pixel scale
    g.strokeStyle = COL.line; g.lineWidth = 2; g.strokeRect(1, 1, Wc - 2, Hc - 2);
    if (Wc > 480) { g.font = "12px " + HAND; g.fillStyle = COL.soft; g.textAlign = "right"; g.fillText(o.label || "1280 × 720, as the camera sends it", Wc - 8, Hc - 8); }
  }
  function cross(g, x, y, s, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke(); }
  // The checkerboard: a white board with a margin, 10 × 7 squares of 25 mm, every edge sampled so the lens can bend it.
  function paintChart(g, cam, pose, X, Y, faint) {
    function poly(x0, y0, x1, y1) {
      var pts = [], n = 6, k, p;
      for (k = 0; k <= n; k++) pts.push([x0 + (x1 - x0) * k / n, y0]);
      for (k = 1; k <= n; k++) pts.push([x1, y0 + (y1 - y0) * k / n]);
      for (k = 1; k <= n; k++) pts.push([x1 - (x1 - x0) * k / n, y1]);
      for (k = 1; k < n; k++) pts.push([x0, y1 - (y1 - y0) * k / n]);
      g.beginPath();
      for (k = 0; k < pts.length; k++) { p = EE.project(cam, pose, pts[k][0], pts[k][1]); if (!p) return false; if (k) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); }
      g.closePath(); return true;
    }
    g.globalAlpha = faint ? 0.35 : 1;
    g.fillStyle = "#FFFDF6"; g.strokeStyle = COL.line; g.lineWidth = 1.6;
    if (poly(-45, -45, 245, 170)) { g.fill(); g.stroke(); }
    g.fillStyle = "#2B2522";
    for (var a = 0; a < 10; a++) for (var b = 0; b < 7; b++) if ((a + b) % 2 === 0) { if (poly(-25 + 25 * a, -25 + 25 * b, 25 * a, 25 * b)) g.fill(); }
    g.globalAlpha = 1;
  }
  function heatColour(e) { var t = Math.min(1, Math.log10(1 + e) / Math.log10(51)); return "rgb(" + Math.round(253 - 88 * t) + "," + Math.round(246 - 196 * t) + "," + Math.round(228 - 197 * t) + ")"; }
  // a key for the error map: swatches at 0, 1, 5, 20 and 50 px, bottom right
  function heatKey(id) {
    var cv = $(id), g = cv.getContext("2d"), W = cv.clientWidth, H = cv.clientHeight, vals = [0, 1, 5, 20, 50], sw = W < 500 ? 22 : 34, x0 = W - vals.length * sw - 14, y0 = H - 34;
    g.fillStyle = "rgba(255,253,246,.92)"; g.strokeStyle = COL.line; g.lineWidth = 1.2; g.fillRect(x0 - 8, y0 - 20, vals.length * sw + 16, 48); g.strokeRect(x0 - 8, y0 - 20, vals.length * sw + 16, 48);
    g.font = (W < 500 ? "10px " : "12px ") + HAND; g.textAlign = "center"; g.fillStyle = COL.soft; g.fillText("px off", x0 + vals.length * sw / 2, y0 - 7);
    vals.forEach(function (v, i) { g.fillStyle = heatColour(v); g.fillRect(x0 + i * sw, y0, sw - 4, 12); g.strokeRect(x0 + i * sw, y0, sw - 4, 12); g.fillStyle = COL.ink; g.fillText(String(v), x0 + i * sw + (sw - 4) / 2, y0 + 25); });
  }
  function heat(g, m, Wc, Hc) {
    var ny = m.grid.length, nx = m.grid[0].length, cw = Wc / nx, ch = Hc / ny;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      g.fillStyle = heatColour(m.grid[j][i]); g.fillRect(i * cw, j * ch, cw + 0.6, ch + 0.6);   // 0 px pale, 50 px and more dark
    }
  }

  /* ---------------- charts ---------------- */
  function axes(g, W, H, pad, xs, ylo, yhi, o) {
    var X = function (v) { return pad.l + (v - xs[0]) / (xs[1] - xs[0] || 1) * (W - pad.l - pad.r); };
    var Y = o.logy ? function (v) { return H - pad.b - (Math.log10(Math.max(v, 1e-30)) - ylo) / (yhi - ylo) * (H - pad.t - pad.b); } : function (v) { return H - pad.b - (v - ylo) / (yhi - ylo || 1) * (H - pad.t - pad.b); };
    g.fillStyle = COL.sheet; g.fillRect(0, 0, W, H);
    g.strokeStyle = COL.rule; g.lineWidth = 1; g.fillStyle = COL.soft; g.font = "13px " + HAND;
    var ticks = o.yticks || (function () { var t = [], k; for (k = 0; k <= 4; k++) t.push(ylo + (yhi - ylo) * k / 4); return t; })();
    ticks.forEach(function (yv) { var yy = o.logy ? Y(Math.pow(10, yv)) : Y(yv); g.beginPath(); g.moveTo(pad.l, yy); g.lineTo(W - pad.r, yy); g.stroke(); g.textAlign = "right"; g.fillText(o.yfmt ? o.yfmt(yv) : minus(fmt(yv, Math.abs(yv - Math.round(yv)) > 1e-9 ? 1 : 0)), pad.l - 6, yy + 4); });
    if (!o.logy && ylo < 0 && yhi > 0) { g.strokeStyle = COL.soft; g.beginPath(); g.moveTo(pad.l, Y(0)); g.lineTo(W - pad.r, Y(0)); g.stroke(); }
    g.textAlign = "center"; (o.xticks || []).forEach(function (v) { g.fillText(o.xfmt ? o.xfmt(v) : String(v), X(v), H - pad.b + 16); });
    if (o.xlab) g.fillText(o.xlab, (pad.l + W - pad.r) / 2, H - 3);
    if (o.ylab) { g.save(); g.translate(12, (pad.t + H - pad.b) / 2); g.rotate(-Math.PI / 2); g.fillText(o.ylab, 0, 0); g.restore(); }
    return { X: X, Y: Y };
  }
  // A line chart. o: { xs: [min, max], xticks, ylo, yhi, logy, series: [{ name, col, pts: [[x, y]], dash, width, dots }] }
  function lineChart(id, o) {
    var c = prep($(id)), g = c.g, W = c.W, H = c.H, pad = { l: 50, r: 14, t: 16, b: 36 };
    var A = axes(g, W, H, pad, o.xs, o.ylo, o.yhi, o);
    (o.vlines || []).forEach(function (v) { g.strokeStyle = v.col || COL.soft; g.setLineDash([3, 4]); g.lineWidth = 1.4; g.beginPath(); g.moveTo(A.X(v.x), pad.t); g.lineTo(A.X(v.x), H - pad.b); g.stroke(); g.setLineDash([]); if (v.label) { g.fillStyle = v.col || COL.soft; g.textAlign = v.align || "left"; g.fillText(v.label, A.X(v.x) + (v.align === "right" ? -4 : 4), pad.t + 12); } });
    o.series.forEach(function (s) {
      g.strokeStyle = s.col; g.lineWidth = s.width || 2.5; g.setLineDash(s.dash || []);
      g.beginPath(); var started = false;
      s.pts.forEach(function (p) { if (p[1] == null || !isFinite(p[1])) { started = false; return; } var x = A.X(p[0]), y = A.Y(p[1]); y = Math.max(pad.t - 4, Math.min(H - pad.b + 4, y)); if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; } });
      g.stroke(); g.setLineDash([]);
      if (s.dots) s.pts.forEach(function (p) { if (p[1] == null || !isFinite(p[1])) return; g.fillStyle = s.col; g.beginPath(); g.arc(A.X(p[0]), Math.max(pad.t - 4, Math.min(H - pad.b + 4, A.Y(p[1]))), 3.5, 0, 7); g.fill(); });
    });
    var lx = pad.l + 8, ly = pad.t + 6; g.textAlign = "left"; g.font = "13px " + HAND;
    if (o.legendRight) { lx = W - pad.r - 8 - Math.max.apply(null, o.series.map(function (s) { return s.name ? g.measureText(s.name).width + 28 : 0; })); }
    o.series.forEach(function (s) { if (!s.name) return; g.fillStyle = "rgba(255,253,246,.85)"; g.fillRect(lx - 3, ly - 4, g.measureText(s.name).width + 32, 16); g.strokeStyle = s.col; g.lineWidth = 2.5; g.setLineDash(s.dash || []); g.beginPath(); g.moveTo(lx, ly + 4); g.lineTo(lx + 20, ly + 4); g.stroke(); g.setLineDash([]); g.fillStyle = COL.ink; g.fillText(s.name, lx + 26, ly + 8); ly += 17; });
    return A;
  }
  // Singular values as bars on a log scale, relative to the largest.
  function svBars(id, S, o) {
    o = o || {};
    var c = prep($(id)), g = c.g, W = c.W, H = c.H, pad = { l: 50, r: 12, t: 14, b: 30 }, n = S.length, lo = o.lo || -16;
    var A = axes(g, W, H, pad, [0, n], lo, 0, { logy: true, yticks: [lo, lo * 3 / 4, lo / 2, lo / 4, 0].map(Math.round), yfmt: function (v) { return v === 0 ? "1" : "10" + sup(v); } });
    var bw = (W - pad.l - pad.r) / n;
    S.forEach(function (s, i) {
      var rel = Math.max(s / S[0], Math.pow(10, lo)), y = A.Y(rel), zero = s / S[0] < (o.zero || 1e-9);
      g.fillStyle = zero ? COL.err : (o.col || COL.model); g.strokeStyle = COL.line; g.lineWidth = 1.2;
      g.fillRect(pad.l + i * bw + bw * 0.18, y, bw * 0.64, H - pad.b - y); g.strokeRect(pad.l + i * bw + bw * 0.18, y, bw * 0.64, H - pad.b - y);
      g.fillStyle = COL.soft; g.textAlign = "center"; g.fillText("σ" + sub(i + 1), pad.l + (i + 0.5) * bw, H - pad.b + 15);
      if (zero) { g.fillStyle = COL.err; g.fillText("≈ 0", pad.l + (i + 0.5) * bw, y - 4); }
    });
  }
  function sup(v) { var m = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }; return String(v).split("").map(function (ch) { return m[ch] || ch; }).join(""); }
  function sub(v) { var m = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" }; return String(v).split("").map(function (ch) { return m[ch] || ch; }).join(""); }

  /* ---------------- the prescription card ---------------- */
  // est: a camera estimate (or null); truth: the answer key. Each row: the estimate, the key, and how far off.
  function rxCard(id, title, est, truth, o) {
    o = o || {};
    var rows = [["fx", "px", "rel"], ["fy", "px", "rel"], ["cx", "px", "abs"], ["cy", "px", "abs"], ["skew", "px", "abs"], ["k1", "", "k"], ["k2", "", "k"]];
    if (o.noLens) rows = rows.slice(0, 5);
    var h = '<h4>' + title + '</h4>' + (o.sub ? '<div class="rxsub">' + o.sub + "</div>" : "") + '<div class="rxwrap"><table' + (est ? "" : ' class="solo"') + '><tr><th></th>' + (est ? "<th>this card</th>" : "") + "<th>answer key</th>" + (est ? "<th>off by</th>" : "") + "</tr>";
    rows.forEach(function (r) {
      var k = r[0], t = truth[k] || 0, e = est ? (est[k] || 0) : null, off = "", cls = "";
      if (est) {
        if (r[2] === "rel") { var rel = (e - t) / t; off = spct(rel); cls = Math.abs(rel) < 0.005 ? "e-ok" : Math.abs(rel) < 0.03 ? "e-mid" : "e-bad"; }
        else if (r[2] === "abs") { var d = e - t; off = sgn(d, 2) + " px"; cls = Math.abs(d) < 3 ? "e-ok" : Math.abs(d) < 15 ? "e-mid" : "e-bad"; }
        else { var dk = e - t; off = sgn(dk, 3); cls = Math.abs(dk) < 0.01 ? "e-ok" : Math.abs(dk) < 0.05 ? "e-mid" : "e-bad"; }
      }
      var dg = r[2] === "k" ? 3 : 2;
      h += "<tr><td>" + k + "</td>" + (est ? "<td>" + minus(fmt(e, dg)) + "</td>" : "") + "<td>" + minus(fmt(t, dg)) + "</td>" + (est ? '<td class="' + cls + '">' + off + "</td>" : "") + "</tr>";
    });
    h += "</table></div>" + (o.foot ? '<div class="verdict">' + o.foot + "</div>" : "");
    $(id).innerHTML = h;
  }
  function rxFail(id, title, reason) { $(id).innerHTML = "<h4>" + title + '</h4><div class="callout co-r"><b>No prescription.</b> ' + esc(reason) + "</div>"; }
  function matHTML(M, d) { return '<div class="mat">' + M.map(function (r) { return r.map(function (v) { return "<span>" + minus(Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : fmt(v, d == null ? 4 : d)) + "</span>"; }).join(""); }).join("") + "</div>"; }

  /* ---------------- shared data ---------------- */
  var EXAM = EE.session(EE.SESSIONS.exam), CAL = null, CALF = null;
  // the exam photo whose chart sits nearest the frame's middle, for the error pictures
  var SHOWN = (function () { var best = 0, bd = 1e9; EXAM.forEach(function (v, i) { var m = v.pts[22], d = Math.hypot(m[0] - 640, m[1] - 400); if (d < bd) { bd = d; best = i; } }); return best; })();
  function cal() { if (!CAL) CAL = EE.calibrate(EXAM); return CAL; }
  function calFree() { if (!CALF) CALF = EE.calibrate(EXAM, { fixSkew: false }); return CALF; }
  var YOURS = null;   // the latest calibration the reader made in step 6 (falls back to the exam)

  /* ================= STEP 0 ================= */
  function initS0() {
    var o = { t: 30, a: 30, d: 450, lens: true, pin: true };
    function draw() {
      var spec = { tilt: o.t, axis: o.a, spin: 0, at: [EE.TRUE_LENS.cx, EE.TRUE_LENS.cy], dist: o.d }, pose = EE.makePose(spec, EE.TRUE_LENS);
      if (!pose) { $("s0w").textContent = "–"; return; }
      var lensP = EE.observe(EE.TRUE_LENS, pose, 0), pinP = EE.observe(EE.TRUE_PIN, pose, 0), seen = o.lens ? lensP : pinP, cam = o.lens ? EE.TRUE_LENS : EE.TRUE_PIN;
      drawFrame("s0c", { cam: cam, pose: pose, seen: seen, model: o.pin ? pinP : null });
      var shift = 0; lensP.forEach(function (p, i) { shift = Math.max(shift, Math.hypot(p[0] - pinP[i][0], p[1] - pinP[i][1])); });
      $("s0w").textContent = px(Math.hypot(seen[8][0] - seen[0][0], seen[8][1] - seen[0][1]), 1);
      $("s0shift").textContent = o.lens ? px(shift, 1) : "0 px (lens off)";
      $("s0bend").textContent = px(EE.rowBend(seen, 0), 1);
      $("s0z").textContent = fmt(pose.dist, 0) + " mm";
      // the worked projection of the chart's middle corner, (100, 50) mm
      var Xc = EE.toCam(pose.R, pose.t, 100, 50), x = Xc[0] / Xc[2], y = Xc[1] / Xc[2], r2 = x * x + y * y, fct = o.lens ? 1 + EE.MICRODUCK.k1 * r2 + EE.MICRODUCK.k2 * r2 * r2 : 1, q = seen[22];
      $("s0m").innerHTML = '<div class="eq">the corner at (100, 50) mm → camera (' + minus(fmt(Xc[0], 1)) + ", " + minus(fmt(Xc[1], 1)) + ", " + fmt(Xc[2], 1) + ") mm → x = X/Z = " + minus(fmt(x, 4)) + ", y = Y/Z = " + minus(fmt(y, 4)) + "</div>" +
        '<div class="eqn">' + (o.lens ? "lens: × (1 + k1·r² + k2·r⁴) = × <b>" + fmt(fct, 4) + "</b> (r² = " + fmt(r2, 4) + ") · " : "no lens: × 1 · ") + "u = fx·x + cx = <b>" + fmt(q[0], 1) + "</b>, v = fy·y + cy = <b>" + fmt(q[1], 1) + "</b></div>";
    }
    function bind(id, key, unit) { $(id).addEventListener("input", function () { o[key] = +this.value; $(id + "v").textContent = this.value + unit; draw(); touch("s0"); }); }
    bind("s0t", "t", "°"); bind("s0a", "a", "°"); bind("s0d", "d", " mm");
    $("s0lens").addEventListener("change", function () { o.lens = this.checked; draw(); touch("s0"); });
    $("s0pin").addEventListener("change", function () { o.pin = this.checked; draw(); });
    rxCard("s0card", "Microduck's prescription card (the answer key)", null, EE.TRUE_LENS, { sub: "1280 × 720 frame · K = [[fx, skew, cx], [0, fy, cy], [0, 0, 1]] · lens: k1, k2" });
    draw();
    redraws.push(function () { if (onStep("s0")) draw(); });
  }

  /* ================= STEP 1 ================= */
  var S1PH = [
    { label: "photo 1", spec: { tilt: 35, axis: 30, spin: 10, at: [600, 400], dist: 450 } },
    { label: "photo 2", spec: { tilt: 50, axis: 120, spin: -15, at: [380, 260], dist: 520 } },
    { label: "photo 3", spec: { tilt: 22, axis: 250, spin: 20, at: [930, 500], dist: 430 } },
    { label: "far away (2.5 m)", spec: { tilt: 10, axis: 0, spin: 0, at: [640, 360], dist: 2500 } }
  ];
  function initS1() {
    var o = { ph: 0, sigma: 0.5, norm: true }, last = null;
    seg($("s1ph"), S1PH.map(function (p, i) { return { v: i, label: p.label }; }), 0, function (v) { o.ph = v; run(); });
    $("s1s").addEventListener("input", function () { o.sigma = +this.value; $("s1sv").textContent = fmt(o.sigma, 1) + " px"; });
    $("s1n").addEventListener("change", function () { o.norm = this.checked; if (last) run(); });
    function run() {
      var ph = EE.photo(S1PH[o.ph].spec, { lens: false, sigma: o.sigma, seed: 1 });
      var h = EE.homography(EE.PTS, ph.pts, { normalize: o.norm }), Ht = EE.trueH(EE.TRUE_PIN, ph.pose);
      var model = EE.PTS.map(function (P) { return EE.applyH(h.H, P[0], P[1]); });
      last = { ph: ph, h: h, Ht: Ht, model: model };
      render(); touch("s1");
    }
    function render() {
      if (!last) { drawFrame("s1c", { cam: EE.TRUE_PIN, pose: EE.makePose(S1PH[o.ph].spec, EE.TRUE_PIN), faint: true, marks: false, label: "press Find H" }); svBars("s1sv9", [1, 1, 1, 1, 1, 1, 1, 1, 1e-17]); return; }
      var L = last;
      drawFrame("s1c", { cam: EE.TRUE_PIN, pose: L.ph.pose, faint: true, seen: L.ph.pts, model: L.model, hlines: L.h.H, marks: false, label: "1280 × 720 · lens dial at 0" });
      $("s1rs").textContent = px(EE.transferRms(L.h.H, EE.PTS, L.ph.pts), 3);
      $("s1rt").textContent = px(EE.transferRms(L.h.H, EE.PTS, L.ph.ideal), 3);
      $("s1cond").textContent = L.h.cond >= 1000 ? L.h.cond.toExponential(1).replace("e+", " × 10^") : fmt(L.h.cond, 2);
      $("s1L").textContent = EE.dltMatrix(EE.PTS, L.ph.pts).length;
      $("s1H").innerHTML = '<span class="ml">H found' + (o.norm ? " (normalised)" : "") + ", scaled so h₃₃ = 1</span>" + matHTML(L.h.H) + '<span class="ml">the true H = K[r1 r2 t]</span>' + matHTML(L.Ht);
      svBars("s1sv9", L.h.S, { zero: 1e-12, lo: -16 });
      $("s1st").innerHTML = "54 corners → <b>108 equations</b> for H's 8 free numbers. With σ = " + fmt(o.sigma, 1) + " px, no H passes through every corner; the best one is " + px(EE.transferRms(L.h.H, EE.PTS, L.ph.ideal), 3) + " from the true corners on average" + (o.sigma === 0 ? ", which is exact to rounding." : ", closer than the noisy corners themselves.");
    }
    $("s1go").onclick = run;
    // where is the chart's zero?
    var t = { far: true, off: 1000 }, sweep = null, h = null;
    seg($("s1dist"), [{ v: false, label: "450 mm" }, { v: true, label: "2.5 m" }], true, function (v) { t.far = v; sweep = null; drawSweep(); });
    $("s1o").addEventListener("input", function () { t.off = +this.value; $("s1ov").textContent = fmt(t.off) + " mm"; });
    function spec() { return t.far ? S1PH[3].spec : S1PH[0].spec; }
    $("s1trial").onclick = function () {
      busy(["s1trial", "s1sweep"], true); $("s1st2").textContent = "photographing 100 times…";
      later(function () {
        var r = EE.dltTrial(spec(), t.off, 0.5, 100);
        $("s1um").textContent = px(r.un.med, 3); $("s1uw").textContent = px(r.un.worst, r.un.worst > 100 ? 0 : 2);
        $("s1zm").textContent = px(r.nz.med, 3); $("s1zw").textContent = px(r.nz.worst, 2);
        $("s1um").className = "v " + (r.un.med > 2 * r.nz.med ? "bad" : "good"); $("s1uw").className = "v " + (r.un.worst > 2 * r.nz.worst ? "bad" : "good");
        $("s1st2").innerHTML = "Chart at " + (t.far ? "2.5 m" : "450 mm") + ", corners numbered from " + fmt(t.off) + " mm off, σ = 0.5 px. Conditioning of L: <b>" + r.condUn.toExponential(1) + "</b> un-normalised, <b>" + fmt(r.condNz, 1) + "</b> normalised.";
        busy(["s1trial", "s1sweep"], false); touch("s1");
      });
    };
    $("s1sweep").onclick = function () {
      if (h) return; busy(["s1trial", "s1sweep"], true);
      var offs = []; for (var k = 0; k <= 3000; k += 200) offs.push(k);
      var res = [];
      h = slices(offs.length, function (k) { res.push([offs[k], EE.dltTrial(spec(), offs[k], 0.5, 100)]); }, function (k, n) { $("s1st2").textContent = "offset " + k + " of " + n + "…"; }, function () {
        h = null; sweep = res; drawSweep(); busy(["s1trial", "s1sweep"], false);
        $("s1st2").textContent = "Median of 100 photos at each offset, σ = 0.5 px, chart at " + (t.far ? "2.5 m" : "450 mm") + ". The normalised line doesn't move: it can't tell where the origin is.";
        touch("s1");
      });
    };
    function drawSweep() {
      var pts = sweep || [];
      var yhi = 1; pts.forEach(function (p) { yhi = Math.max(yhi, p[1].un.med); });
      lineChart("s1chart", { xs: [0, 3000], xticks: [0, 500, 1000, 1500, 2000, 2500, 3000], xlab: "where the corners are numbered from (mm off the chart)", ylab: "median px off", ylo: -2, yhi: 1, logy: true, yticks: [-1, 0, 1], yfmt: function (v) { return v === 0 ? "1" : v < 0 ? "0.1" : "10"; },
        series: [{ name: "un-normalised", col: COL.err, dots: true, pts: pts.map(function (p) { return [p[0], p[1].un.med]; }) }, { name: "normalised (Hartley)", col: COL.truth, dots: true, pts: pts.map(function (p) { return [p[0], p[1].nz.med]; }) }] });
    }
    render(); drawSweep();
    redraws.push(function () { if (onStep("s1")) { render(); drawSweep(); } });
  }

  /* ================= STEP 2 ================= */
  var GOOD = [{ tilt: 40, axis: 0, spin: 0, at: [400, 300], dist: 450 }, { tilt: 40, axis: 90, spin: 15, at: [900, 400], dist: 500 }, { tilt: 35, axis: 45, spin: -10, at: [640, 360], dist: 450 }, { tilt: 30, axis: 135, spin: 5, at: [500, 450], dist: 520 }, { tilt: 45, axis: 200, spin: 20, at: [800, 300], dist: 480 }];
  var FRONTAL = [0, 1, 2, 3, 4].map(function (i) { return { tilt: 0, spin: i * 20 - 40, at: [300 + i * 150, 200 + i * 80], dist: 400 + i * 60 }; });
  var MOVED = [0, 1, 2, 3, 4].map(function (i) { return { tilt: 35, axis: 30, spin: 10, at: [300 + i * 150, 200 + i * 80], dist: 400 + i * 60 }; });
  function initS2() {
    var all = [], sel = [], o = { skew: false };
    [["s2g", GOOD, "tilted"], ["s2f", FRONTAL, "square-on"], ["s2m", MOVED, "slid"]].forEach(function (grp, gi) {
      var host = $(grp[0]);
      grp[1].forEach(function (spec, i) {
        var ph = EE.photo(spec, { lens: false, sigma: 0, seed: i + 1 }), idx = all.length;
        all.push(ph);
        var b = document.createElement("button"); b.type = "button"; b.dataset.i = idx;
        b.innerHTML = '<canvas aria-hidden="true"></canvas>' + grp[2] + " " + (i + 1);
        b.setAttribute("aria-pressed", "false");
        b.onclick = function () { var k = sel.indexOf(idx); if (k >= 0) sel.splice(k, 1); else sel.push(idx); update(); touch("s2"); };
        host.appendChild(b);
      });
    });
    function thumbs() { qa(".tray button").forEach(function (b) { var ph = all[+b.dataset.i], cv = b.querySelector("canvas"), c = prep(cv), g = c.g, sx = c.W / EE.W, sy = c.H / EE.H; g.fillStyle = COL.wall; g.fillRect(0, 0, c.W, c.H); paintChart(g, EE.TRUE_PIN, ph.pose, function (u) { return u * sx; }, function (v) { return v * sy; }); }); }
    function update() {
      qa(".tray button").forEach(function (b) { var on = sel.indexOf(+b.dataset.i) >= 0; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
      $("s2n").textContent = sel.length;
      if (!sel.length) { $("s2rows").textContent = 0; $("s2z").textContent = "–"; $("s2ok").textContent = "–"; $("s2card").innerHTML = '<div class="callout co-i">Put photos in the set to start counting.</div>'; svBars("s2sv", [1, 1, 1, 1, 1, 1].map(function () { return 1e-30; })); return; }
      var z = EE.zhangClosed(sel.map(function (i) { return all[i]; }), { skewZero: o.skew });
      $("s2rows").textContent = z.rows; $("s2z").textContent = z.nullDim; $("s2z").className = "v " + (z.nullDim === 1 ? "good" : "bad");
      $("s2ok").textContent = z.ok ? "yes" : "no"; $("s2ok").className = "v " + (z.ok ? "good" : "bad");
      svBars("s2sv", z.S, { zero: 1e-9, lo: -16 });
      if (z.ok) rxCard("s2card", "The camera these photos pin down", z.cam, EE.TRUE_PIN, { noLens: true, sub: sel.length + " photo" + (sel.length > 1 ? "s" : "") + (o.skew ? " + the skew assumed 0" : "") + " · no noise · lens dial at 0" });
      else rxFail("s2card", "The camera these photos pin down", z.reason + ". " + (sel.length < 3 && !o.skew ? "Add photos, or assume the skew is 0." : "These photos repeat each other's equations."));
    }
    function preset(list) { sel = list.slice(); update(); touch("s2"); }
    $("s2p1").onclick = function () { preset([0]); };
    $("s2p2").onclick = function () { preset([0, 1]); };
    $("s2p3").onclick = function () { preset([0, 1, 2]); };
    $("s2pf").onclick = function () { preset([5, 6, 7, 8, 9]); };
    $("s2pm").onclick = function () { preset([10, 11, 12, 13, 14]); };
    $("s2clr").onclick = function () { preset([]); };
    $("s2skew").addEventListener("change", function () { o.skew = this.checked; update(); touch("s2"); });
    // how flat is too flat
    var TILTS = [2, 5, 10, 20, 45], flat = null, h = null;
    $("s2flat").onclick = function () {
      if (h) return; busy(["s2flat"], true);
      var acc = TILTS.map(function (t) { return { tilt: t, fail: 0, ok: 0, ef: 0 }; }), jobs = [];
      TILTS.forEach(function (t, i) { for (var s = 1; s <= 200; s += 20) jobs.push([i, s]); });
      h = slices(jobs.length, function (k) { var j = jobs[k], r = EE.flatTrial(TILTS[j[0]], 20, 0.5, j[1]); acc[j[0]].fail += r.fail; acc[j[0]].ok += r.ok; acc[j[0]].ef += r.efSum; },
        function (k, n) { $("s2st").textContent = "session " + k * 20 + " of " + n * 20 + "…"; },
        function () { h = null; flat = acc; busy(["s2flat"], false); drawFlat(); $("s2st").textContent = "200 sessions of 3 photos at each tilt, σ = 0.5 px, the same seeds every time."; touch("s2"); });
    };
    function drawFlat() {
      var pts = flat || [];
      lineChart("s2chart", { xs: [0, 50], xticks: [0, 10, 20, 30, 40, 50], xfmt: function (v) { return v + "°"; }, xlab: "how far each photo is tilted", ylab: "sessions of 200 that fail", ylo: 0, yhi: 200,
        series: [{ name: "no usable camera", col: COL.err, dots: true, pts: pts.map(function (a) { return [a.tilt, a.fail]; }) }] });
      $("s2tab").innerHTML = pts.length ? "<tr><th>tilt</th><th>sessions failed</th><th>|fx error| of the rest</th></tr>" + pts.map(function (a) { return "<tr><td>" + a.tilt + '°</td><td class="n">' + a.fail + " / 200</td><td>" + pct(a.ef / Math.max(1, a.ok), 2) + "</td></tr>"; }).join("") : "";
    }
    thumbs(); update(); drawFlat();
    redraws.push(function () { if (onStep("s2")) { thumbs(); update(); drawFlat(); } });
  }

  /* ================= STEP 3 ================= */
  function initS3() {
    var o = { n: 3, sigma: 0.5 }, last = null, sweep = null, h = null;
    $("s3n").addEventListener("input", function () { o.n = +this.value; $("s3nv").textContent = o.n; });
    $("s3s").addEventListener("input", function () { o.sigma = +this.value; $("s3sv").textContent = fmt(o.sigma, 1) + " px"; });
    $("s3go").onclick = function () {
      var views = EE.session(Object.assign({}, EE.SESSIONS.trial, { sigma: o.sigma })).slice(0, o.n), z = EE.zhangClosed(views, { skewZero: o.n < 3 });
      last = { views: views, z: z };
      if (z.ok) {
        var rms = EE.reprojection(z.cam, z.poses, views).rms;
        rxCard("s3card", "The closed-form prescription", z.cam, EE.TRUE_PIN, { noLens: true, sub: o.n + " photos" + (o.n < 3 ? " + the skew assumed 0" : "") + " · σ = " + fmt(o.sigma, 1) + " px · lens dial at 0", foot: "Reprojection RMS with this card and these poses: <b>" + px(rms, 3) + "</b>" + (o.sigma > 0 ? " (the noise alone would give about " + px(o.sigma * Math.SQRT2, 2) + ")." : ".") });
      } else rxFail("s3card", "The closed-form prescription", z.reason);
      drawTop(); touch("s3");
      $("s3st").innerHTML = z.ok ? "Every chart's position comes out of K⁻¹H once K is known. " + (o.sigma === 0 ? "No noise: they sit exactly on the true ones." : "With noise, the blue charts drift off the green ones, most of all along the line of sight.") : "";
    };
    function drawTop() {
      var c = prep($("s3top")), g = c.g, W = c.W, H = c.H;
      g.fillStyle = COL.sheet; g.fillRect(0, 0, W, H);
      var zmax = 900, xmax = 600, cx0 = W / 2, base = H - 26, kz = (H - 50) / zmax, kx = Math.min(kz, (W / 2 - 20) / xmax);
      var P = function (x, z) { return [cx0 + x * kx, base - z * kz]; };
      g.strokeStyle = COL.rule; g.lineWidth = 1; g.fillStyle = COL.soft; g.font = "12px " + HAND; g.textAlign = "left";
      [300, 600, 900].forEach(function (z) { var p = P(-xmax, z), q = P(xmax, z); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.fillText(z + " mm", 6, p[1] - 3); });
      // the camera and its field of view (62° across)
      var a = 31 * Math.PI / 180, fl = P(-Math.tan(a) * zmax, zmax), fr = P(Math.tan(a) * zmax, zmax), c0 = P(0, 0);
      g.strokeStyle = "rgba(31,122,122,.4)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(fl[0], fl[1]); g.lineTo(c0[0], c0[1]); g.lineTo(fr[0], fr[1]); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.shop; g.strokeStyle = COL.line; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(c0[0] - 14, c0[1] - 4, 28, 18, 4) : g.rect(c0[0] - 14, c0[1] - 4, 28, 18); g.fill(); g.stroke();
      g.fillStyle = COL.soft; g.textAlign = "center"; g.fillText("the duck's camera", c0[0], H - 4);
      if (!last) return;
      function chart(pose, col, w) {
        var corners = [[-25, -25], [225, -25], [225, 150], [-25, 150]].map(function (m) { var X = EE.toCam(pose.R, pose.t, m[0], m[1]); return P(X[0], X[2]); });
        // seen from above, the chart's outline collapses to a band: draw its four corners joined
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); corners.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.stroke();
      }
      last.views.forEach(function (v) { chart(v.pose, COL.truth, 3.5); });
      if (last.z.ok) last.z.poses.forEach(function (p) { chart(p, COL.model, 1.8); });
    }
    $("s3sweep").onclick = function () {
      if (h) return; busy(["s3sweep"], true);
      var ns = [2, 3, 4, 6, 8, 12, 20], res = [];
      h = slices(ns.length, function (k) { res.push(EE.closedTrial(ns[k], 0.5, 20)); }, function (k, n) { $("s3st2").textContent = "count " + k + " of " + n + "…"; }, function () {
        h = null; sweep = res; busy(["s3sweep"], false); drawSweep(); $("s3st2").textContent = "Mean over 20 independent sessions at each count, σ = 0.5 px, lens dial at 0. Two photos need the skew assumed 0."; touch("s3");
      });
    };
    function drawSweep() {
      var s = sweep || [];
      var s3 = s.filter(function (r) { return r.n >= 3; });
      lineChart("s3chart", { xs: [3, 20], xticks: [3, 4, 6, 8, 12, 16, 20], xlab: "photos (2 photos, off the chart: 5.1% and 49 px)", ylab: "error", ylo: 0, yhi: 10, yticks: [0, 2, 4, 6, 8, 10], legendRight: true,
        series: [{ name: "principal point, px", col: COL.err, dots: true, pts: s3.map(function (r) { return [r.n, r.ppErr]; }) }, { name: "|fx error|, %", col: COL.model, dots: true, pts: s3.map(function (r) { return [r.n, r.fxErr * 100]; }) }] });
      $("s3tab").innerHTML = s.length ? "<tr><th>photos</th><th>|fx error|</th><th>principal point off by</th></tr>" + s.map(function (r) { return "<tr><td>" + r.n + (r.n < 3 ? " (+ skew 0)" : "") + "</td><td>" + pct(r.fxErr, 2) + '</td><td class="n">' + px(r.ppErr, 1) + "</td></tr>"; }).join("") : "";
    }
    $("s3card").innerHTML = '<div class="callout co-i">Pick a number of photos and some noise, then write the prescription.</div>';
    drawTop(); drawSweep();
    redraws.push(function () { if (onStep("s3")) { drawTop(); drawSweep(); } });
  }

  /* ================= STEP 4 ================= */
  var S4WHERE = { middle: { tilt: 25, axis: 60, spin: 5, at: [640, 360], dist: 420 }, corner: { tilt: 25, axis: 60, spin: 5, at: [250, 160], dist: 420 }, br: { tilt: 30, axis: 300, spin: -10, at: [1040, 590], dist: 420 } };
  function initS4() {
    var o = { k1: EE.MICRODUCK.k1, k2: EE.MICRODUCK.k2, where: "corner" }, stage = 0;
    function draw() {
      var spec = S4WHERE[o.where], pose = EE.makePose(spec, EE.TRUE_LENS), cam = EE.camera({ k1: o.k1, k2: o.k2 });
      var lens = EE.observe(cam, pose, 0), pin = EE.observe(EE.TRUE_PIN, pose, 0);
      drawFrame("s4c", { cam: cam, pose: pose, seen: lens, model: pin, label: "k1 = " + minus(fmt(o.k1, 3)) + ", k2 = " + minus(fmt(o.k2, 3)) });
      var mv = 0; lens.forEach(function (p, i) { mv = Math.max(mv, Math.hypot(p[0] - pin[i][0], p[1] - pin[i][1])); });
      $("s4bend").textContent = px(EE.rowBend(lens, 0), 1); $("s4move").textContent = px(mv, 1);
      var ray = EE.pixelToRay(EE.TRUE_PIN, 1279, 0), q = EE.projectCam(cam, [ray[0], ray[1], 1]);
      $("s4corner").textContent = q ? px(Math.hypot(q[0] - 1279, q[1]), 1) : "–";
      var rmax = Math.hypot(ray[0], ray[1]), pts = [];
      for (var r = 0; r <= 1.0001; r += 0.02) pts.push([r, r * (1 + o.k1 * r * r + o.k2 * r * r * r * r)]);
      lineChart("s4curve", { xs: [0, 1], xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], xfmt: function (v) { return fmt(v, 1); }, xlab: "pinhole radius r (in focal lengths)", ylab: "lens radius", ylo: 0, yhi: 1.2,
        vlines: [{ x: rmax, label: "frame corner", col: COL.soft }],
        series: [{ name: "no lens", col: COL.soft, dash: [5, 4], width: 1.6, pts: [[0, 0], [1, 1]] }, { name: "this dial", col: COL.lilac, pts: pts }] });
    }
    function setK(k1, k2) { o.k1 = k1; o.k2 = k2; $("s4k1").value = k1; $("s4k2").value = k2; $("s4k1v").textContent = minus(fmt(k1, 3)); $("s4k2v").textContent = minus(fmt(k2, 3)); draw(); }
    $("s4k1").addEventListener("input", function () { o.k1 = +this.value; $("s4k1v").textContent = minus(fmt(o.k1, 3)); draw(); touch("s4"); });
    $("s4k2").addEventListener("input", function () { o.k2 = +this.value; $("s4k2v").textContent = minus(fmt(o.k2, 3)); draw(); touch("s4"); });
    $("s4reset").onclick = function () { setK(EE.MICRODUCK.k1, EE.MICRODUCK.k2); touch("s4"); };
    $("s4zero").onclick = function () { setK(0, 0); touch("s4"); };
    seg($("s4where"), [{ v: "middle", label: "middle" }, { v: "corner", label: "top-left" }, { v: "br", label: "bottom-right" }], o.where, function (v) { o.where = v; draw(); });
    // the exam, lens-blind
    function resid(camE, poses, i) { var v = EXAM[i], model = EE.PTS.map(function (P) { return EE.project(camE, poses[i], P[0], P[1]); }); return { v: v, model: model }; }
    function exam() {
      if (stage === 0) { drawFrame("s4res", { cam: EE.TRUE_LENS, pose: EXAM[SHOWN].pose, faint: true, seen: EXAM[SHOWN].pts, label: "exam photo " + (SHOWN + 1) + " of 12 · press a button" }); $("s4card").innerHTML = '<div class="callout co-i">The exam\'s 12 photos are ready. Run the closed form first.</div>'; return; }
      var C = cal(), camE = stage === 1 ? C.closed.cam : C.linear.cam, rms = stage === 1 ? C.closedRms : C.linear.rms, R = resid(camE, C.closed.poses, SHOWN);
      rxCard("s4card", stage === 1 ? "Closed form, pretending the lens is a pinhole" : "… plus k1, k2 by linear least squares", camE, EE.TRUE_LENS, { sub: "12 photos through Microduck's lens · σ = 0.25 px", foot: "Reprojection RMS: <b>" + px(rms, 2) + "</b>, against about 0.35 px for a right card." });
      drawFrame("s4res", { cam: EE.TRUE_LENS, pose: EXAM[SHOWN].pose, faint: true, seen: R.v.pts, model: R.model, arrows: { from: R.v.pts, to: R.model, k: 5 }, label: "exam photo " + (SHOWN + 1) + " of 12 · errors × 5" });
    }
    $("s4cf").onclick = function () { busy(["s4cf", "s4lin"], true); later(function () { stage = 1; exam(); busy(["s4cf", "s4lin"], false); $("s4st").innerHTML = "Look at the card: fx is 7% short, cy is 237 instead of 475, and the skew, which should be 0, is −39 px. A pinhole is the wrong model for this eye, and the closed form has nowhere to put the bend but into K."; touch("s4"); }); };
    $("s4lin").onclick = function () { busy(["s4cf", "s4lin"], true); later(function () { stage = 2; exam(); busy(["s4cf", "s4lin"], false); $("s4st").innerHTML = "k1 comes out <b>positive</b>: pincushion, for a lens that's barrel. With K already wrong, the best straight-line fit for k1 and k2 points the wrong way. Step 5 fixes all of it at once."; touch("s4"); }); };
    draw(); exam();
    redraws.push(function () { if (onStep("s4")) { draw(); exam(); } });
  }

  /* ================= STEP 5 ================= */
  function initS5() {
    var o = { free: false }, k = -1, running = null, view = SHOWN;
    function C() { return o.free ? calFree() : cal(); }
    function render() {
      var c = C(), hist = c.refined.hist, kk = k < 0 ? hist.length - 1 : Math.min(k, hist.length - 1);
      lineChart("s5chart", { xs: [0, Math.max(4, hist.length - 1)], xticks: hist.map(function (x, i) { return i; }).filter(function (i) { return i % 2 === 0 || i === hist.length - 1; }), xlab: "refinement step", ylab: "RMS (px, log)", ylo: -1, yhi: 1.5, logy: true, yticks: [-1, 0, 1], yfmt: function (v) { return v === 0 ? "1" : v < 0 ? "0.1" : "10"; },
        vlines: [{ x: kk, col: COL.ink }],
        series: [{ name: "reprojection RMS", col: COL.err, dots: true, pts: hist.slice(0, kk + 1).map(function (x, i) { return [i, x.rms]; }) }, { name: "the noise floor σ√2", col: COL.truth, dash: [5, 4], width: 1.6, pts: [[0, 0.25 * Math.SQRT2], [Math.max(4, hist.length - 1), 0.25 * Math.SQRT2]] }] });
      var camK = hist[kk].cam;
      rxCard("s5card", kk === hist.length - 1 ? "After refinement" : "Refinement, step " + kk + " of " + (hist.length - 1), camK, EE.TRUE_LENS, { sub: "12 photos · skew " + (o.free ? "free (Zhang)" : "held at 0 (OpenCV)"), foot: "RMS <b>" + px(hist[kk].rms, 3) + "</b> after " + kk + " step" + (kk === 1 ? "" : "s") + (kk === hist.length - 1 ? " · it stopped when a step no longer helped" : "") });
      var ps = EE.posesOf(hist[kk].p, EXAM.length), model = EE.PTS.map(function (P) { return EE.project(camK, ps[view], P[0], P[1]); });
      var scale = [40, 20, 10, 5, 2, 1].filter(function (m) { return m * hist[kk].rms <= 15; })[0] || 1;
      drawFrame("s5res", { cam: EE.TRUE_LENS, pose: EXAM[view].pose, faint: true, seen: EXAM[view].pts, model: model, arrows: { from: EXAM[view].pts, to: model, k: scale }, label: "exam photo " + (view + 1) + " · errors × " + scale });
    }
    $("s5go").onclick = function () {
      if (running) running.stop();
      busy(["s5go", "s5step"], true);
      later(function () {
        var n = C().refined.hist.length; k = 0;
        running = anim(Math.max(1800, n * 260), function (u) { var kk = Math.min(n - 1, Math.floor(u * n)); if (kk !== k) { k = kk; render(); } }, function () { running = null; k = -1; render(); busy(["s5go", "s5step"], false); $("s5st").innerHTML = "From RMS <b>" + px(C().refined.hist[0].rms, 2) + "</b> to <b>" + px(C().rms, 3) + "</b> in " + C().refined.iters + " steps. k1 is now " + minus(fmt(C().cam.k1, 3)) + " (the key: −0.347), fx is " + spct(EE.relErr(C().cam.fx, EE.TRUE_LENS.fx)) + " off, and the principal point is within " + px(Math.hypot(C().cam.cx - EE.TRUE_LENS.cx, C().cam.cy - EE.TRUE_LENS.cy), 1) + "."; touch("s5"); });
        render();
      });
    };
    $("s5step").onclick = function () { busy(["s5step"], true); later(function () { var n = C().refined.hist.length; k = k < 0 || k >= n - 1 ? 0 : k + 1; render(); busy(["s5step"], false); $("s5st").textContent = "Step " + k + ": " + (k === 0 ? "the closed form plus the linear k1, k2, with the skew set to 0." : "λ = " + C().refined.hist[k].lambda.toExponential(0) + " after this step (smaller means bolder, Gauss–Newton-like steps)."); touch("s5"); }); };
    $("s5skew").addEventListener("change", function () { o.free = this.checked; k = -1; busy(["s5go", "s5step"], true); later(function () { render(); busy(["s5go", "s5step"], false); $("s5st").innerHTML = o.free ? "Skew free: it settles at " + fmt(C().cam.skew, 3) + " px (the truth is 0), and the RMS barely moves (" + px(C().rms, 4) + "). That's why OpenCV doesn't estimate it." : "Skew held at 0, as OpenCV does: RMS " + px(C().rms, 4) + "."; touch("s5"); }); });
    // judge five sessions
    var JUDGE = [
      { name: "the exam: 12 photos, lens free", run: function () { return cal(); } },
      { name: "corner-blind: 12 small charts in the middle", run: function () { return EE.calibrate(EE.session(EE.SESSIONS.blind)); } },
      { name: "flat-lander: 12 photos tilted 5–15°", run: function () { return EE.calibrate(EE.session(EE.SESSIONS.flat)); } },
      { name: "lens dial held at 0", run: function () { return EE.calibrate(EE.session(EE.SESSIONS.straight), { model: "pinhole" }); } },
      { name: "… and its worst 6 photos dropped", run: function () { return EE.dropWorstHalf(EE.session(EE.SESSIONS.straight), { model: "pinhole" }); } }
    ], jres = [], jh = null;
    $("s5judge").onclick = function () {
      if (jh) return; busy(["s5judge"], true); jres = [];
      jh = slices(JUDGE.length, function (i) { jres.push(EE.evaluate(JUDGE[i].run())); }, function (k, n) { $("s5st2").textContent = "judging session " + k + " of " + n + "…"; renderJ(); }, function () {
        jh = null; busy(["s5judge"], false); renderJ(); $("s5st2").innerHTML = "Sort by RMS and the corner-blind session ties the real exam; sort by the answer key and it's 58 px off in places. The second opinion (its photos fill the frame) flags all three bad sessions here, but a pose can soak up some errors: in step 6, fuzzy corners leave a card 14 px off on average while its second opinion barely moves (0.368 px). Only the answer key sees everything, and a real optician doesn't have one, which is why the session's design (step 6) matters."; touch("s5");
      });
    };
    function renderJ() {
      $("s5tab").innerHTML = "<tr><th>session</th><th>RMS</th><th>second opinion</th><th>worst px off (key)</th><th>fx off (key)</th><th>worst head turn (key)</th></tr>" + jres.map(function (e, i) {
        var bad = function (c) { return c ? ' style="color:' + COL.err + ';font-weight:700"' : ""; };
        return "<tr><td>" + JUDGE[i].name + '</td><td class="n">' + px(e.rms, 3) + "</td><td" + bad(e.hold > 0.4) + ">" + px(e.hold, 3) + "</td><td" + bad(e.mapMax > 5) + ">" + px(e.mapMax, 1) + "</td><td" + bad(Math.abs(e.fxErr) > 0.01) + ">" + spct(e.fxErr) + "</td><td" + bad(Math.abs(e.turn) > 0.5) + ">" + sgn(e.turn, 2) + "°</td></tr>";
      }).join("");
    }
    renderJ();
    var drawn = false;
    function firstDraw() { if (drawn || !onStep("s5")) return; drawn = true; busy(["s5go", "s5step"], true); later(function () { k = 0; render(); busy(["s5go", "s5step"], false); }); }
    redraws.push(function () { if (!onStep("s5")) return; if (!drawn) firstDraw(); else if (!running) render(); });
  }

  /* ================= STEP 6 ================= */
  function initS6() {
    var o = { n: 12, tilt: "good", cover: "fill", sigma: 0.25 }, last = null;
    $("s6n").addEventListener("input", function () { o.n = +this.value; $("s6nv").textContent = o.n; });
    seg($("s6tilt"), [{ v: "flat", label: "0–5°" }, { v: "low", label: "5–15°" }, { v: "mid", label: "10–20°" }, { v: "good", label: "20–50°" }, { v: "steep", label: "50–70°" }], o.tilt, function (v) { o.tilt = v; });
    seg($("s6cover"), [{ v: "fill", label: "fills the frame" }, { v: "centre", label: "centre only, small and far" }], o.cover, function (v) { o.cover = v; });
    seg($("s6sig"), [0.1, 0.25, 0.5, 1, 2].map(function (s) { return { v: s, label: fmt(s, s < 1 ? 2 : 0).replace(/0$/, "") + " px" }; }), o.sigma, function (v) { o.sigma = v; });
    $("s6go").onclick = function () {
      busy(["s6go"], true); $("s6st").textContent = "photographing and calibrating…";
      later(function () {
        var views = EE.session(EE.planSession(o)), c = EE.calibrate(views), e = EE.evaluate(c);
        last = { views: views, c: c, e: e }; busy(["s6go"], false);
        if (!e.ok) {
          ["s6rms", "s6hold", "s6map", "s6turn"].forEach(function (id) { $(id).textContent = "–"; });
          rxFail("s6card", "Your session's prescription", e.reason + ". Zhang's closed form ignores the lens; with photos this flat or this few, Microduck's strong barrel distortion can leave it no real camera to find.");
          $("s6st").textContent = ""; drawHeat(); touch("s6"); return;
        }
        YOURS = c.cam;
        $("s6rms").textContent = px(e.rms, 3); $("s6hold").textContent = px(e.hold, 3); $("s6hold").className = "v " + (e.hold > 0.4 ? "bad" : "good");
        $("s6map").textContent = fmt(e.mapMean, 1) + " / " + fmt(e.mapMax, 1) + " px"; $("s6map").className = "v " + (e.mapMax > 5 ? "bad" : "good");
        $("s6turn").textContent = sgn(e.turn, 2) + "°"; $("s6turn").className = "v " + (Math.abs(e.turn) > 0.5 ? "bad" : "good");
        rxCard("s6card", "Your session's prescription", c.cam, EE.TRUE_LENS, { sub: views.length + " photos · tilt " + EE.TILTS[o.tilt].join("–") + "° · " + (o.cover === "centre" ? "centre only, small and far" : "fills the frame") + " · σ = " + o.sigma + " px" });
        $("s6st").innerHTML = "Your card now drives the purple line in the head-turn chart below.";
        drawHeat(); drawTurn(); touch("s6");
      });
    };
    function drawHeat() {
      if (!last || !last.e.ok) { drawFrame("s6heat", { marks: true, label: last ? "no prescription" : "book a session" }); return; }
      var dots = []; last.views.forEach(function (v) { v.pts.forEach(function (p) { dots.push(p); }); });
      drawFrame("s6heat", { heat: last.e.map, dots: dots, label: " " });
      heatKey("s6heat");
    }
    var b = 0.5;
    $("s6b").addEventListener("input", function () { b = +this.value; $("s6bv").textContent = minus(fmt(b, 2)); drawTurn(); touch("s6"); });
    function drawTurn() {
      var yours = YOURS || cal().cam, MODELS = [["centred pinhole, f 1065 (Duck's-Eye View)", EE.NOMINAL, COL.model], ["placeholder: 62° across 720", EE.PLACEHOLDER, COL.err], [YOURS ? "your session's card" : "the exam's card (step 5)", yours, COL.lilac]];
      var series = MODELS.map(function (m) { var pts = []; for (var bb = -1; bb <= 1.0001; bb += 0.05) pts.push([bb, EE.bearingAngle(m[1], bb) - EE.bearingAngle(EE.TRUE_LENS, bb)]); return { name: m[0], col: m[2], pts: pts, width: m[1] === yours ? 3.2 : 2.4 }; });
      lineChart("s6turnc", { xs: [-1, 1], xticks: [-1, -0.5, 0, 0.5, 1], xfmt: function (v) { return minus(fmt(v, 1)); }, xlab: "bearing b (−1 hard left · +1 hard right)", ylab: "head-turn error (°)", ylo: -20, yhi: 10, yticks: [-20, -15, -10, -5, 0, 5, 10], yfmt: function (v) { return minus(String(v)); },
        vlines: [{ x: b, col: COL.ink }], series: series, legendRight: true });
      var tr = EE.bearingAngle(EE.TRUE_LENS, b);
      $("s6ttab").innerHTML = "<tr><th>card, at b = " + minus(fmt(b, 2)) + "</th><th>turns the head</th><th>error</th><th>miss at 3 m</th></tr>" +
        "<tr><td>Microduck's own calibration (the key)</td><td class=\"n\">" + sgn(tr, 2) + "°</td><td>–</td><td>–</td></tr>" +
        MODELS.map(function (m) { var a = EE.bearingAngle(m[1], b), e = a - tr; return "<tr><td>" + m[0] + '</td><td class="n">' + sgn(a, 2) + "°</td><td" + (Math.abs(e) > 0.5 ? ' style="color:' + COL.err + ';font-weight:700"' : "") + ">" + sgn(e, 2) + "°</td><td>" + fmt(EE.missAt(e, 3) * 100, 0) + " cm</td></tr>"; }).join("");
    }
    rxCard("s6card", "Your session's prescription", null, EE.TRUE_LENS, { sub: "book a session to fill in this card" });
    drawHeat(); drawTurn();
    redraws.push(function () { if (onStep("s6")) { drawHeat(); drawTurn(); } });
  }

  /* ================= REVIEW BOARD ================= */
  function sess(key) { return EE.session(EE.SESSIONS[key]); }
  var CASES = [
    { id: "c1", title: "Case 1 · the flat-lander", brief: "<b>The complaint:</b> since its new prescription, the duck swings its head far past any duck near the edge of its view. The shop's calibrator was happy: RMS 0.66 px, under a pixel. <b>As booked:</b> 12 photos, the chart tilted only 5–15° (it was easier to hold it square to the camera), Microduck's lens free, σ = 0.25 px.",
      broken: function () { return EE.calibrate(sess("flat")); },
      fixes: [
        { label: "Take 30 photos the same way: more data", run: function () { return EE.calibrate(sess("flat30")); }, why: "More nearly-parallel photos repeat nearly the same two equations; here the closed form can't even find a real camera." },
        { label: "Find the corners more sharply (σ 0.1 px)", run: function () { return EE.calibrate(sess("flatSharp")); }, why: "Sharper corners don't add the missing tilt: the problem is the geometry of the photos, not the noise." },
        { label: "Re-take the 12 photos tilted 20–50°", run: function () { return EE.calibrate(sess("flatFixed")); }, right: true, why: "Tilted photos give independent equations on B, so the focal length is pinned down." }
      ],
      causes: [{ label: "Near-parallel photos: they nearly repeat each other's two equations, so the solve is nearly degenerate and can land on a wrong focal length that still fits", right: true }, { label: "Too few photos" }, { label: "The corner detector was too noisy" }],
      checks: [{ label: "fx within 1% of the answer key", test: function (e) { return e.ok && Math.abs(e.fxErr) < 0.01; }, why: function (e) { return e.ok ? "fx " + spct(e.fxErr) + " off" : "no prescription"; } }, { label: "worst head-turn error under 0.5°", test: function (e) { return e.ok && Math.abs(e.turn) < 0.5; }, why: function (e) { return e.ok ? sgn(e.turn, 2) + "° at b = " + minus(String(e.turnAt)) : "no prescription"; } }] },
    { id: "c2", title: "Case 2 · the corner-blind", brief: "<b>The complaint:</b> straight door frames come out curved near the corners of the duck's undistorted photos. RMS 0.35 px, as good as it gets. <b>As booked:</b> 12 photos, the chart small and far away (1.2–1.6 m) and always near the middle of the frame, tilt 20–50°, σ = 0.25 px.",
      broken: function () { return EE.calibrate(sess("blind")); },
      fixes: [
        { label: "Take 30 photos the same way", run: function () { return EE.calibrate(sess("blind30")); }, why: "Thirty photos of the middle still say nothing about the corners: k1 and k2 are extrapolated there." },
        { label: "Find the corners more sharply (σ 0.1 px)", run: function () { return EE.calibrate(sess("blindSharp")); }, why: "Sharper corners in the middle tighten the middle; the corners of the frame are still a guess." },
        { label: "Re-take 12 photos with the chart near, filling every part of the frame", run: function () { return EE.calibrate(sess("blindFixed")); }, right: true, why: "Chart corners in the frame's corners measure the lens where it bends most." }
      ],
      causes: [{ label: "No chart corner ever reached the frame's corners, so the lens terms are extrapolated there", right: true }, { label: "Too few photos" }, { label: "The chart was tilted too much" }],
      checks: [{ label: "under 5 px off everywhere in the frame (answer key)", test: function (e) { return e.ok && e.mapMax < 5; }, why: function (e) { return e.ok ? "worst " + px(e.mapMax, 1) + ", mean " + px(e.mapMean, 1) : "no prescription"; } }, { label: "second opinion under 0.40 px", test: function (e) { return e.ok && e.hold < 0.4; }, why: function (e) { return e.ok ? px(e.hold, 3) : "no prescription"; } }] },
    { id: "c3", title: "Case 3 · the straight-liner", brief: "<b>The complaint:</b> the duck misjudges where other ducks are by up to 10° near the edges of its view. Someone set the calibrator to a pinhole model, \"to keep it simple\": RMS 4.36 px. <b>As booked:</b> 12 good photos, tilt 20–50°, filling the frame, σ = 0.25 px, the lens dial held at 0.",
      broken: function () { return EE.calibrate(sess("straight"), { model: "pinhole" }); },
      fixes: [
        { label: "Drop the 6 photos with the worst error and solve again", run: function () { return EE.dropWorstHalf(sess("straight"), { model: "pinhole" }); }, why: "The RMS halves, but only because the photos that showed the bend are gone." },
        { label: "Take 30 photos, dial still at 0", run: function () { return EE.calibrate(sess("straight30"), { model: "pinhole" }); }, why: "A model that can't bend stays wrong with any number of photos." },
        { label: "Free the lens dial: estimate k1 and k2", run: function () { return EE.calibrate(sess("straight")); }, right: true, why: "The model can now bend like the lens." }
      ],
      causes: [{ label: "The model has no lens: a pinhole can't bend straight lines, and this lens does", right: true }, { label: "Some photos were bad and should be thrown out" }, { label: "Too few photos" }],
      checks: [{ label: "worst head-turn error under 0.5°", test: function (e) { return e.ok && Math.abs(e.turn) < 0.5; }, why: function (e) { return e.ok ? sgn(e.turn, 2) + "° at b = " + minus(String(e.turnAt)) : "no prescription"; } }, { label: "second opinion under 0.40 px", test: function (e) { return e.ok && e.hold < 0.4; }, why: function (e) { return e.ok ? px(e.hold, 3) : "no prescription"; } }] }
  ];
  function describe(e) { return e.ok ? "RMS " + px(e.rms, 3) + " · second opinion " + px(e.hold, 3) + " · worst " + px(e.mapMax, 1) + " off · fx " + spct(e.fxErr) + " · worst head turn " + sgn(e.turn, 2) + "°" : "no prescription: " + esc(e.reason); }
  function initCap() {
    var host = $("capcases");
    host.innerHTML = CASES.map(function (c) {
      return '<div class="card" style="margin-top:14px"><h3>' + c.title + '</h3><div class="brief">' + c.brief + "</div>" +
        '<div class="btnrow"><button class="ghost" id="' + c.id + 'run">Run it as booked</button></div><div class="verdict" id="' + c.id + 'v"></div>' +
        '<div class="lbl">The fix</div><div class="reason">' + c.fixes.map(function (f, i) { return '<label><input type="radio" name="' + c.id + 'fix" value="' + i + '"><span>' + esc(f.label) + "</span></label>"; }).join("") + "</div>" +
        '<div class="lbl">The cause</div><div class="reason">' + c.causes.map(function (f, i) { return '<label><input type="radio" name="' + c.id + 'cause" value="' + i + '"><span>' + esc(f.label) + "</span></label>"; }).join("") + "</div>" +
        '<div class="btnrow"><button class="act" id="' + c.id + 'go">Re-run with the fix</button></div><div class="checks" id="' + c.id + 'ch"></div></div>';
    }).join("");
    function grade() { var n = CASES.filter(function (c) { return store.cap[c.id]; }).length; $("capstars").textContent = "★".repeat(n) + "☆".repeat(3 - n); $("capverdict").innerHTML = n === 3 ? "<b>Three for three.</b> You can sign off a prescription." : n ? "<b>" + n + " of 3</b> fixed and explained." : ""; if (n === 3 && !store.said.cap) { store.said.cap = true; save(); buildNav(); markNav(); } }
    CASES.forEach(function (c) {
      $(c.id + "run").onclick = function () { $(c.id + "v").textContent = "running…"; busy([c.id + "run"], true); later(function () { $(c.id + "v").innerHTML = "<b>As booked:</b> " + describe(EE.evaluate(c.broken())); busy([c.id + "run"], false); }); };
      $(c.id + "go").onclick = function () {
        var fi = document.querySelector('input[name="' + c.id + 'fix"]:checked'), ci = document.querySelector('input[name="' + c.id + 'cause"]:checked');
        if (!fi || !ci) { $(c.id + "ch").innerHTML = '<div class="callout co-w">Pick a fix and a cause first.</div>'; return; }
        var fix = c.fixes[+fi.value], cause = c.causes[+ci.value];
        $(c.id + "ch").innerHTML = '<div class="status">re-running…</div>'; busy([c.id + "go"], true);
        later(function () {
          var e = EE.evaluate(fix.run());
          var rows = c.checks.map(function (k) { return { ok: k.test(e), label: k.label, why: k.why(e) }; });
          rows.push({ ok: !!cause.right, label: "the cause is named", why: cause.right ? "yes" : "that's not what the re-run shows" });
          var pass = rows.every(function (r) { return r.ok; });
          $(c.id + "ch").innerHTML = '<div class="status small">' + describe(e) + "</div>" + rows.map(function (r) { return '<div class="check ' + (r.ok ? "ok" : "no") + '"><span class="ic">' + (r.ok ? "✓" : "✗") + "</span><div>" + r.label + '<div class="why">' + r.why + "</div></div></div>"; }).join("") +
            '<div class="callout ' + (pass ? "co-g" : "co-r") + '"><b>' + (pass ? "Fixed." : "Not fixed.") + "</b> " + esc(fix.why) + "</div>";
          store.cap[c.id] = store.cap[c.id] || pass; save(); grade(); busy([c.id + "go"], false);
        });
      };
    });
    grade();
  }

  /* ================= FIELD TEST ================= */
  var FT = [
    { q: "Lens off, chart square-on at 400 mm: how many pixels long is its top row of corners?", hint: "step 0, px", ans: 530.9, tol: 0.5 },
    { q: "Chart 2.5 m away, corners numbered from 1000 mm off: the un-normalised DLT's median error over 100 photos?", hint: "step 1, px", ans: 5.41, tol: 0.1 },
    { q: "Five square-on photos: how many zero singular values does V have?", hint: "step 2", ans: 4, tol: 0 },
    { q: "Three photos tilted 5°, σ 0.5 px: how many of 200 sessions give no usable camera?", hint: "step 2", ans: 45, tol: 0 },
    { q: "Closed form alone, 12 photos, σ 0.5 px, mean over 20 sessions: how far off is the principal point?", hint: "step 3, px", ans: 3.2, tol: 0.2 },
    { q: "The exam: what k1 does the linear least-squares fit give, starting from the lens-blind closed form?", hint: "step 4, three decimals", ans: 0.097, tol: 0.002 },
    { q: "The exam after Levenberg–Marquardt, skew held at 0: the reprojection RMS?", hint: "step 5, px", ans: 0.350, tol: 0.002 },
    { q: "The flat-lander session: by what percentage is its fx too small? (a positive number)", hint: "step 5, judge five sessions", ans: 53.75, tol: 0.6, abs: true },
    { q: "With Microduck's own calibration, how far right does a duck at bearing b = 0 sit from the optical axis?", hint: "step 6, degrees", ans: 6.21, tol: 0.02 },
    { q: "Book 12 photos, tilt 20–50°, centre only (small and far), σ 0.25 px: the worst px off across the frame?", hint: "step 6, px", ans: 112.5, tol: 1 }
  ];
  function initFT() {
    $("ftqs").innerHTML = FT.map(function (f, i) { return '<div class="fq"><div class="fqt"><b>' + (i + 1) + ".</b> " + f.q + ' <span class="muted">(' + f.hint + ')</span></div><div class="row"><input type="number" id="ft' + i + '" step="any" value="' + (store.ft[i] != null ? esc(store.ft[i]) : "") + '" aria-label="Answer ' + (i + 1) + '"><span class="res" id="ftr' + i + '"></span></div></div>'; }).join("");
    $("ftgo").onclick = function () {
      var score = 0;
      FT.forEach(function (f, i) { var raw = $("ft" + i).value, v = parseFloat(raw); if (f.abs) v = Math.abs(v); var ok = raw !== "" && !isNaN(v) && Math.abs(v - f.ans) <= f.tol + 1e-9; store.ft[i] = raw; if (ok) score++; $("ftr" + i).innerHTML = ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'; });
      save();
      $("ftscore").innerHTML = "<b>" + score + " / " + FT.length + "</b>" + (score === FT.length ? " · you can read Zhang's paper." : "");
      if (score >= 8 && !store.said.ft) { store.said.ft = true; save(); buildNav(); markNav(); }
    };
    $("reset").onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} history.replaceState(null, "", location.pathname); location.reload(); };
  }

  /* ---------------- art & boot ---------------- */
  function renderArt() { qa(".scene[data-art]").forEach(function (el) { var svg = ART[el.dataset.art]; if (svg && !el.firstChild) el.innerHTML = svg; }); }
  function buildNext() {
    sections.forEach(function (s, i) {
      var n = sections[i + 1]; if (!n) return;
      var row = document.createElement("div"); row.className = "nextrow";
      var b = document.createElement("button"); b.type = "button"; b.className = "act"; b.textContent = "Next: " + n.dataset.n + " · " + n.dataset.title + " →";
      b.onclick = function () { show(n.id); };
      row.appendChild(b); s.appendChild(row);
    });
  }
  if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  renderArt();
  qa(".kmap .k[data-i]").forEach(function (el) { el.innerHTML = IC[el.dataset.i] || ""; });
  qa(".mast .mi").forEach(function (el) { el.innerHTML = IC.eye || ""; });
  buildNav(); buildNext();
  function hashId() { var m = /^#\/?(s[0-6]|cap|ft)$/.exec(location.hash || ""); return m ? m[1] : null; }
  window.addEventListener("hashchange", function () { var id = hashId(); if (id && !$(id).classList.contains("on")) show(id); });
  initS0(); initS1(); initS2(); initS3(); initS4(); initS5(); initS6(); initCap(); initFT();
  qa(".g").forEach(bindTip); initPredicts();
  sections.forEach(function (s) { checkSay(s.id); });
  show(hashId() || "s0");
  window.addEventListener("load", function () { setTimeout(function () { window.scrollTo(0, 0); redrawAll(); }, 0); });
  var rt = null; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(redrawAll, 80); });
  window.EEApp = { show: show, store: function () { return store; } };
})();
