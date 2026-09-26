/* Duck's-Eye View — the page framework: nav, progress, predict-then-reveal, "say it out loud",
   glossary tooltips, controls, canvas helpers, the synthetic camera renderer, and the step registry.
   Adapted from Policy Pond's app.js. Step files register with DEV.step(id, init); this file boots them.
   Every number shown comes from DEV.core (core.js); this file only wires and draws. */
(function () {
  "use strict";
  var DEV = window.DEV = window.DEV || {};
  var core = DEV.core, GL = window.DEV_GLOSSARY = window.DEV_GLOSSARY || {}, IC = window.DEV_ICONS = window.DEV_ICONS || {};
  var $ = function (id) { return document.getElementById(id); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- formatting ---------------- */
  function fmt(n, d) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }); }
  function sgn(n, d) { return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d == null ? 2 : d); }
  function pct(p, d) { return fmt(p * 100, d || 0) + "%"; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  /* ---------------- persistence (never required) ---------------- */
  var KEY = "ducks-eye-view-v1";
  var store = { predicts: {}, touched: {}, said: {}, cap: {}, capAns: {}, ft: {}, s: {} };
  try { var raw = localStorage.getItem(KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

  /* ---------------- nav ---------------- */
  var NAV_ICON = {};   // section id → DEV_ICONS key; steps set it with DEV.navIcon(id, key)
  var sections = [];
  function buildNav() {
    var nav = $("nav"); nav.innerHTML = "";
    sections.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<span class="ic" aria-hidden="true">' + (IC[NAV_ICON[s.id]] || "") + "</span>" + s.dataset.title + (store.said[s.id] ? '<span class="chk">✓</span>' : "");
      b.onclick = function () { show(s.id); };
      b.dataset.for = s.id;
      nav.appendChild(b);
    });
  }
  var onShow = {};
  function show(id) {
    sections.forEach(function (s) { s.classList.toggle("on", s.id === id); });
    qa("#nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.for === id); });
    var active = document.querySelector("#nav button.on"), nav = $("nav");
    if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    window.scrollTo(0, 0);
    redrawAll();
    if (onShow[id]) onShow[id].forEach(function (f) { f(); });
  }
  function markNav() { var cur = sections.filter(function (s) { return s.classList.contains("on"); })[0]; if (cur) qa("#nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.for === cur.id); }); }

  /* ---------------- engagement: predict + say ---------------- */
  function touch(sec) { store.touched[sec] = (store.touched[sec] || 0) + 1; save(); checkSay(sec); }
  function checkSay(sec) {
    var s = $(sec); if (!s) return;
    var preds = qa(".predict", s), sayEls = qa(".say", s);
    if (!sayEls.length) return;
    var allAnswered = preds.every(function (p) { return store.predicts[p.dataset.p] != null; });
    var open = allAnswered && (store.touched[sec] || 0) >= 3;
    sayEls.forEach(function (sayEl) {
      if (open) sayEl.classList.add("open");
      var tag = sayEl.querySelector(".tag");
      if (tag) tag.textContent = open ? "Say it out loud" : "Say it out loud · unlocks after you answer the prediction" + (preds.length > 1 ? "s" : "") + " and play with the controls";
    });
    if (open && !store.said[sec]) { store.said[sec] = true; save(); buildNav(); markNav(); }
  }
  function initPredicts() {
    qa(".predict").forEach(function (p) {
      var key = p.dataset.p, sec = p.closest("section").id, btns = qa(".opts button", p);
      function reveal(idx) {
        btns.forEach(function (b, i) {
          b.disabled = true;
          if (b.hasAttribute("data-right")) b.classList.add("right");
          else if (i === idx) b.classList.add("wrong");
        });
        p.classList.add("done");
      }
      btns.forEach(function (b, i) { b.type = "button"; b.onclick = function () { store.predicts[key] = i; save(); reveal(i); checkSay(sec); }; });
      if (store.predicts[key] != null) reveal(store.predicts[key]);
    });
  }

  /* ---------------- glossary tooltip ---------------- */
  function bindTip(el) {
    if (el.dataset.bound) return; el.dataset.bound = "1";
    el.tabIndex = 0; el.setAttribute("role", "button");
    var tip = $("tip");
    function place() {
      var g = GL[el.dataset.g]; if (!g) return;
      tip.innerHTML = "<b>" + g[0] + "</b><br>" + g[1] + '<span class="kt">In the duck’s head: ' + g[2] + "</span>";
      tip.style.display = "block";
      var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8) + "px";
      var y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = r.top - h - 8;
      tip.style.top = Math.max(8, y) + "px";
    }
    el.addEventListener("mouseenter", place); el.addEventListener("focus", place);
    el.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    el.addEventListener("blur", function () { tip.style.display = "none"; });
    el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (tip.style.display === "block") tip.style.display = "none"; else place(); });
  }
  function initTips(root) { qa(".g", root).forEach(bindTip); }

  /* ---------------- controls ---------------- */
  function seg(el, opts, val, onChange) {
    if (typeof el === "string") el = $(el);
    el.innerHTML = "";
    var state = { value: val };
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = o.label; b.dataset.v = o.v;
      if (String(o.v) === String(val)) b.classList.add("on");
      b.onclick = function () {
        state.value = o.v;
        qa("button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
        onChange(o.v);
      };
      el.appendChild(b);
    });
    state.set = function (v) { state.value = v; qa("button", el).forEach(function (x) { x.classList.toggle("on", String(x.dataset.v) === String(v)); }); };
    return state;
  }
  function range(id, onInput) { var el = $(id); el.addEventListener("input", onInput); return el; }

  /* ---------------- canvas ---------------- */
  var drawers = {};
  // Register a drawer for a canvas id; it re-runs when its step is shown and on resize.
  function drawer(id, fn) { drawers[id] = fn; return fn; }
  function ctxFor(id) {
    var c = typeof id === "string" ? $(id) : id, dpr = window.devicePixelRatio || 1;
    // The markup's height attribute is the CSS height. Setting c.height below rewrites that attribute,
    // so remember what we wrote: an attribute that differs from it was set on purpose by a step.
    var attr = c.getAttribute("height");
    if (!c.dataset.h || attr !== c.dataset.wrote) c.dataset.h = attr;
    var w = c.clientWidth || c.parentNode.clientWidth || 600, h = +c.dataset.h;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + "px";
    c.dataset.wrote = String(c.height);
    var x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    x.font = "14px 'Patrick Hand', sans-serif"; x.textBaseline = "middle";
    return { x: x, w: w, h: h, c: c };
  }
  function redrawAll() { Object.keys(drawers).forEach(function (k) { var el = $(k), s = el && el.closest("section"); if (s && s.classList.contains("on")) drawers[k](); }); }
  var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(redrawAll, 120); });
  var C = { gold: "#C98A0B", acc: "#1F6F74", grn: "#3B7422", red: "#C8452F", dim: "#6E5040", line: "#E7DCC4", ink: "#4A2E1E", txt: "#3A2418", well: "#FFFDF6", glass: "#9FD3D6", duck: "#F9D95B", bill: "#E8923A", grey114: "rgb(114,114,114)", lilac: "#8E78C0" };
  function axes(g, pad, ylo, yhi, yl, xlo, xhi, xl) {
    var x = g.x; x.strokeStyle = C.line; x.lineWidth = 1; x.textBaseline = "middle";
    for (var i = 0; i <= 4; i++) { var y = pad.t + (g.h - pad.t - pad.b) * i / 4; x.beginPath(); x.moveTo(pad.l, y); x.lineTo(g.w - pad.r, y); x.stroke(); x.fillStyle = C.dim; x.textAlign = "right"; x.fillText(fmt(yhi - (yhi - ylo) * i / 4, yl == null ? 1 : yl), pad.l - 6, y); }
    if (xlo != null) { x.textAlign = "center"; for (var j = 0; j <= 4; j++) { var xx = pad.l + (g.w - pad.l - pad.r) * j / 4; x.fillStyle = C.dim; x.fillText(fmt(xlo + (xhi - xlo) * j / 4, xl == null ? 1 : xl), xx, g.h - pad.b + 13); } }
    x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, g.h - pad.b); x.lineTo(g.w - pad.r, g.h - pad.b); x.stroke();
  }
  function line(x, pts, color, width, dash) {
    x.strokeStyle = color; x.lineWidth = width || 2.5; x.setLineDash(dash || []); x.beginPath();
    pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); });
    x.stroke(); x.setLineDash([]);
  }
  function boxPath(x, b, color, width, dash) { x.strokeStyle = color; x.lineWidth = width || 2; x.setLineDash(dash || []); x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); x.setLineDash([]); }

  /* ---------------- the synthetic camera (teaching model) ----------------
     Paints the toy room as the head camera would see it: upright 720×1280 frame, pinhole projection
     with intrinsics K, objects from DEV.core.KINDS. Renders at `scale` (0.5 → 360×640) into a canvas.
     Returns the canvas and the ground-truth boxes in full-frame pixels. */
  function drawMicroduck(x, b) {   // a generic small biped robot duck, fitted to box b = [x0,y0,x1,y1]
    var w = b[2] - b[0], h = b[3] - b[1], X = function (t) { return b[0] + t * w; }, Y = function (t) { return b[1] + t * h; };
    var lw = Math.max(0.8, w * 0.035);
    x.lineJoin = "round"; x.lineCap = "round"; x.strokeStyle = C.ink; x.lineWidth = lw;
    // legs
    x.fillStyle = "#8C949A";
    x.beginPath(); x.rect(X(0.32), Y(0.70), w * 0.08, h * 0.26); x.rect(X(0.60), Y(0.70), w * 0.08, h * 0.26); x.fill(); x.stroke();
    x.fillStyle = C.bill; x.beginPath(); x.ellipse(X(0.33), Y(0.97), w * 0.13, h * 0.03, 0, 0, 7); x.ellipse(X(0.66), Y(0.97), w * 0.13, h * 0.03, 0, 0, 7); x.fill(); x.stroke();
    // body
    x.fillStyle = "#E9EEF0"; x.beginPath(); x.ellipse(X(0.5), Y(0.58), w * 0.44, h * 0.18, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = "#C9D2D7"; x.beginPath(); x.ellipse(X(0.5), Y(0.62), w * 0.30, h * 0.08, 0, 0, 7); x.fill();
    // neck + head
    x.fillStyle = "#E9EEF0"; x.beginPath(); x.rect(X(0.44), Y(0.30), w * 0.12, h * 0.16); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(X(0.5), Y(0.20), w * 0.24, h * 0.14, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.bill; x.beginPath(); x.moveTo(X(0.66), Y(0.20)); x.lineTo(X(0.98), Y(0.24)); x.lineTo(X(0.66), Y(0.29)); x.closePath(); x.fill(); x.stroke();
    // the camera eye
    x.fillStyle = "#1B2226"; x.beginPath(); x.arc(X(0.52), Y(0.18), Math.max(1, w * 0.07), 0, 7); x.fill();
    x.fillStyle = "#9FD3D6"; x.beginPath(); x.arc(X(0.54), Y(0.165), Math.max(0.5, w * 0.025), 0, 7); x.fill();
  }
  function drawRubber(x, b) {
    var w = b[2] - b[0], h = b[3] - b[1], X = function (t) { return b[0] + t * w; }, Y = function (t) { return b[1] + t * h; };
    x.strokeStyle = C.ink; x.lineWidth = Math.max(0.8, w * 0.05); x.lineJoin = "round";
    x.fillStyle = "#F4C430"; x.beginPath(); x.ellipse(X(0.45), Y(0.70), w * 0.44, h * 0.28, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(X(0.62), Y(0.32), w * 0.24, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.bill; x.beginPath(); x.ellipse(X(0.9), Y(0.38), w * 0.12, h * 0.07, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = C.ink; x.beginPath(); x.arc(X(0.66), Y(0.28), Math.max(0.6, w * 0.04), 0, 7); x.fill();
  }
  function drawPrint(x, b) {
    var w = b[2] - b[0], h = b[3] - b[1], X = function (t) { return b[0] + t * w; }, Y = function (t) { return b[1] + t * h; };
    x.fillStyle = "#FFFFFF"; x.strokeStyle = "#B7AE9C"; x.lineWidth = Math.max(0.8, w * 0.02); x.fillRect(b[0], b[1], w, h); x.strokeRect(b[0], b[1], w, h);
    x.fillStyle = "#D9D9D9"; x.beginPath(); x.ellipse(X(0.45), Y(0.62), w * 0.28, h * 0.16, 0, 0, 7); x.fill();
    x.beginPath(); x.arc(X(0.55), Y(0.35), w * 0.13, 0, 7); x.fill();
    x.beginPath(); x.moveTo(X(0.66), Y(0.36)); x.lineTo(X(0.84), Y(0.39)); x.lineTo(X(0.66), Y(0.43)); x.fill();
  }
  function renderRoom(canvas, scene, K, opts) {
    opts = opts || {};
    var s = opts.scale || 0.5, W = core.CAM.W, H = core.CAM.H;
    canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    var x = canvas.getContext("2d");
    x.setTransform(s, 0, 0, s, 0, 0);
    var hc = core.CAM.camHeight, wallV = K.cy + K.f * hc / core.WALL_Z;       // where the floor meets the back wall
    // wall
    var g = x.createLinearGradient(0, 0, 0, wallV); g.addColorStop(0, "#EFE3CB"); g.addColorStop(1, "#E3D2B1");
    x.fillStyle = g; x.fillRect(0, 0, W, wallV);
    // a window and a shelf on the wall, for texture
    var win = [K.cx + K.f * (-1.1) / core.WALL_Z, K.cy + K.f * (hc - 1.6) / core.WALL_Z, K.cx + K.f * (-0.3) / core.WALL_Z, K.cy + K.f * (hc - 0.9) / core.WALL_Z];
    x.fillStyle = "#BFE0EE"; x.fillRect(win[0], win[1], win[2] - win[0], win[3] - win[1]); x.strokeStyle = "#8A6A4A"; x.lineWidth = 6; x.strokeRect(win[0], win[1], win[2] - win[0], win[3] - win[1]);
    x.beginPath(); x.moveTo((win[0] + win[2]) / 2, win[1]); x.lineTo((win[0] + win[2]) / 2, win[3]); x.stroke();
    // floor
    var fg = x.createLinearGradient(0, wallV, 0, H); fg.addColorStop(0, "#C89B6A"); fg.addColorStop(1, "#A77A4C");
    x.fillStyle = fg; x.fillRect(0, wallV, W, H - wallV);
    x.fillStyle = "#8A6A4A"; x.fillRect(0, wallV - 6, W, 8);                  // skirting board
    // floorboards converge on the vanishing point (cx, cy)
    x.strokeStyle = "rgba(74,46,30,.22)"; x.lineWidth = 2;
    for (var i = -12; i <= 12; i++) { var X0 = i * 0.25; x.beginPath(); x.moveTo(K.cx + K.f * X0 / core.WALL_Z, wallV); x.lineTo(K.cx + K.f * X0 / 0.25, K.cy + K.f * hc / 0.25); x.stroke(); }
    // objects, far to near
    var objs = scene.objects.slice().sort(function (a, b) { return (core.KINDS[b.kind].onWall ? core.WALL_Z : b.z) - (core.KINDS[a.kind].onWall ? core.WALL_Z : a.z); });
    var gts = [];
    objs.forEach(function (o) {
      var b = core.objectBox(o, K), k = core.KINDS[o.kind];
      if (!k.onWall) { x.fillStyle = "rgba(60,35,20,.25)"; x.beginPath(); x.ellipse((b[0] + b[2]) / 2, b[3], (b[2] - b[0]) * 0.5, (b[2] - b[0]) * 0.09, 0, 0, 7); x.fill(); }
      if (o.kind === "microduck") drawMicroduck(x, b); else if (o.kind === "rubber") drawRubber(x, b); else drawPrint(x, b);
      gts.push({ kind: o.kind, box: b, isDuck: k.isDuck });
    });
    x.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: canvas, gts: gts, scale: s };
  }
  // Image data of the full-resolution frame, for the letterbox and convolution demos.
  function roomImage(scene, K, scale) {
    var c = document.createElement("canvas"); renderRoom(c, scene, K, { scale: scale || 0.5 });
    return c.getContext("2d").getImageData(0, 0, c.width, c.height);
  }
  function putImage(canvas, img) {
    canvas.width = img.width; canvas.height = img.height;
    var id = canvas.getContext("2d").createImageData(img.width, img.height); id.data.set(img.data); canvas.getContext("2d").putImageData(id, 0, 0);
  }

  /* ---------------- step registry + boot ---------------- */
  var steps = [];
  DEV.step = function (id, init) { steps.push({ id: id, init: init }); };
  DEV.navIcon = function (id, key) { NAV_ICON[id] = key; };
  DEV.onShow = function (id, fn) { (onShow[id] = onShow[id] || []).push(fn); };
  DEV.ui = {
    $: $, qa: qa, fmt: fmt, sgn: sgn, pct: pct, esc: esc,
    store: store, save: save, touch: touch, checkSay: checkSay, show: show,
    seg: seg, range: range, drawer: drawer, ctxFor: ctxFor, redrawAll: redrawAll, axes: axes, line: line, boxPath: boxPath, C: C,
    renderRoom: renderRoom, roomImage: roomImage, putImage: putImage, drawMicroduck: drawMicroduck, drawRubber: drawRubber, drawPrint: drawPrint,
    initTips: initTips, buildNav: function () { buildNav(); markNav(); }
  };

  function renderArt() {
    var A = window.DEV_ART || {};
    qa(".scene[data-art]").forEach(function (el) { var svg = A[el.dataset.art]; if (svg && !el.firstChild) el.innerHTML = svg; });
  }
  function boot() {
    sections = qa("section");
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
    renderArt();
    qa(".kmap .k[data-i]").forEach(function (el) { el.innerHTML = IC[el.dataset.i] || ""; });
    buildNav();
    steps.forEach(function (s) { try { s.init(DEV.ui, core); } catch (e) { console.error("step " + s.id + " failed to start", e); } });
    buildNav();   // again: steps may set their nav icon inside init
    initTips(document);
    initPredicts();
    sections.forEach(function (s) { checkSay(s.id); });
    document.addEventListener("click", function () { $("tip").style.display = "none"; });
    window.addEventListener("scroll", function () { $("tip").style.display = "none"; }, { passive: true });
    var reset = $("reset"); if (reset) reset.onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} location.hash = ""; location.reload(); };
    var start = (location.hash || "").replace("#", "");
    show($(start) && $(start).tagName === "SECTION" ? start : sections[0].id);
    window.addEventListener("load", function () { setTimeout(function () { window.scrollTo(0, 0); }, 0); });
    window.addEventListener("hashchange", function () {
      var id = (location.hash || "").replace("#", ""), el = $(id);
      if (el && el.tagName === "SECTION" && !el.classList.contains("on")) show(id);
    });
  }
  DEV.boot = boot;
})();
