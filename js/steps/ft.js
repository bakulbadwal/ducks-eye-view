/* Duck's-Eye View — the field test: eight questions, each answered by operating a named step's widget.
   Graded with numeric tolerances; six or more earns the check (store.said.ft). */
DEV.step("ft", function (ui, core) {
  "use strict";
  DEV.navIcon("ft", "pencil");
  var $ = ui.$, fmt = ui.fmt, store = ui.store;
  // Expected values, each checked against core.js in node before shipping (see the build report).
  var FT = [
    { step: "Step 1 · The Darkroom", q: "The 720 × 1280 frame is letterboxed into the 320 × 320 input. What fraction of the input is grey padding, in %?", ans: 43.75, tol: 0.3, alt: [{ ans: 0.4375, tol: 0.003 }], hint: "180 of 320 columns hold picture" },
    { step: "Step 1 · The Darkroom", q: "An input pixel at x = 110 came from which x in the 720-wide frame? (unpad, then divide by the scale)", ans: 160, tol: 0.6 },
    { step: "Step 2 · The Stencils", q: "A 3 × 3 stencil with stride 2 and padding 1 slides over 320 px. How wide is the output?", ans: 160, tol: 0.5 },
    { step: "Step 3 · The Box Desk", q: "At a 320 px input, how many candidate boxes come out of the head in total (all three grids)?", ans: 2100, tol: 0.5 },
    { step: "Step 3 · The Box Desk", q: "Two 10 × 10 boxes, one shifted 5 px to the right of the other. Their IoU?", ans: 0.3333, tol: 0.012, alt: [{ ans: 33.33, tol: 1.2 }] },
    { step: "Step 4 · The Tiny Ruler", q: "Quantising a range of [−1, 3] to uint8 (256 notches). What is the scale, per notch?", ans: 0.01569, tol: 0.0003 },
    { step: "Step 5 · The Map Room", q: "On this sideways mount, the widest left–right field of view any 16:9 mode can have, in degrees?", ans: 37.35, tol: 0.4 },
    { step: "Step 6 · How Far?", q: "In the stereo widget, double the distance Z. The depth error per pixel of disparity is multiplied by?", ans: 4, tol: 0.15 }
  ];
  function grade(f, raw) {
    var v = parseFloat(raw); if (raw === "" || isNaN(v)) return false;
    var ok = Math.abs(v - f.ans) <= f.tol;
    (f.alt || []).forEach(function (a) { if (Math.abs(v - a.ans) <= a.tol) ok = true; });
    return ok;
  }
  $("ftqs").innerHTML = FT.map(function (f, i) {
    return '<div class="fq"><div class="fqt"><b>' + (i + 1) + '.</b> <b class="stp">' + f.step + ':</b> ' + f.q + (f.hint ? ' <span class="muted">(' + f.hint + ')</span>' : '') + '</div><div class="row"><input type="number" step="any" id="ft' + i + '" aria-label="Answer to question ' + (i + 1) + '"' + (store.ft[i] != null && store.ft[i] !== "" ? ' value="' + ui.esc(store.ft[i]) + '"' : "") + '><span class="res" id="ftr' + i + '"></span></div></div>';
  }).join("");
  $("ftgo").onclick = function () {
    var score = 0;
    FT.forEach(function (f, i) {
      var raw = $("ft" + i).value, ok = grade(f, raw);
      store.ft[i] = raw; if (ok) score++;
      $("ftr" + i).innerHTML = ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span><span class="why">go operate the widget in ' + f.step.split(" · ")[1] + '</span>';
    });
    ui.save();
    $("ftscore").innerHTML = "<b>" + score + " / " + FT.length + "</b>" + (score === FT.length ? " · you can read duck-detect’s lib.rs." : score >= 6 ? " · check earned." : "");
    if (score >= 6 && !store.said.ft) { store.said.ft = true; ui.save(); ui.buildNav(); }
    ui.touch("ft");
  };
});
