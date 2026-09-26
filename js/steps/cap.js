/* Duck's-Eye View — the capstone "Bug Board": three real bugs from Microduck's vision stack.
   Every re-run calls the real pipeline in core.js: detect → (quantizeHead) → decode + NMS → prCurve → AP,
   on the held-out session makeSession(2026, 40), plus bearingToAngle for the head turn. */
DEV.step("cap", function (ui, core) {
  "use strict";
  Object.assign(window.DEV_GLOSSARY, {
    quietly: ["Quietly worse", "A pre-processing mismatch (channel order, fit, pad colour) that doesn't crash anything. The model still outputs boxes; they are just worse, and no log says why.", "The darkroom hands the stencil room a print in the wrong colours, and nobody notices."],
    sharedscale: ["Shared quantisation scale", "One INT8 scale and zero point for a whole tensor. When box coordinates (up to ~320) and scores (0–1) share it, one notch is ~1.26, so a score can only be 0 or one notch.", "One tiny ruler for both the room's width and a teaspoon."],
    placeholder: ["Placeholder intrinsics", "Focal length and principal point that were guessed, not calibrated. Every pixel-to-angle conversion downstream inherits the error.", "A map drawn with the wrong scale bar."]
  });
  DEV.navIcon("cap", "bug");
  var $ = ui.$, fmt = ui.fmt, pct = ui.pct, C = ui.C, MD = window.DEV_MICRODUCK;
  var K = core.modeIntrinsics("full"), CAM = core.CAM, SESSION = core.makeSession(2026, 40), EVIDENCE = SESSION[19];
  var st = ui.store.s.cap = ui.store.s.cap || {};
  var REDUCED = false; try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function cite(k) { return '<span class="muted">(' + MD.cite(k) + ')</span>'; }
  function touch() { ui.touch("cap"); }

  /* ---------- shared bits (Policy Pond's review-board pattern) ---------- */
  function capStars() {
    var n = ["cap1", "cap2", "cap3"].filter(function (k) { return ui.store.cap[k]; }).length;
    $("capstars").textContent = "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
    $("capscore").textContent = n + " of 3 cases closed";
    if (n === 3 && !ui.store.said.cap) { ui.store.said.cap = true; ui.save(); ui.buildNav(); }
  }
  function reasonHTML(id, opts) {
    return '<div class="lbl">Name the cause</div><div class="reason" id="' + id + 'why">' + opts.map(function (o, i) { return '<label><input type="radio" name="' + id + 'r" value="' + i + '"' + (ui.store.capAns[id] === i ? " checked" : "") + "> <span>" + o + "</span></label>"; }).join("") + "</div>";
  }
  // Once a case has been graded, changing the named cause re-grades it, so the checklist never goes stale.
  function regradeOnReason(id, rerun) { ui.qa('input[name="' + id + 'r"]').forEach(function (r) { r.addEventListener("change", function () { if ($(id + "c").innerHTML) rerun(); }); }); }
  function readReason(id) { var el = document.querySelector('input[name="' + id + 'r"]:checked'); return el ? +el.value : null; }
  function checksHTML(list, reasonOk) {
    return list.concat([["You named the right cause", reasonOk]]).map(function (c) { return '<div class="check ' + (c[1] ? "ok" : "no") + '"><span class="ic">' + (c[1] ? "✓" : "✗") + "</span><div>" + c[0] + (c[2] && !c[1] ? '<div class="why">' + c[2] + "</div>" : "") + "</div></div>"; }).join("");
  }
  function au(label, val, cls) { return '<div class="au' + (cls ? " " + cls : "") + '"><span>' + label + "</span><b>" + val + "</b></div>"; }
  function sessionStats(opts, thr) {
    var frames = core.evalSession(SESSION, K, opts), pr = core.prCurve(frames, 0.5), at = core.precisionRecallAt(frames, thr, 0.5);
    return { ap: core.apAllPoint(pr.pts), at: at, nGT: pr.nGT, frames: frames };
  }

  /* ================= Case 1 · Quietly worse ================= */
  var c1 = st.c1 = st.c1 || {};
  var C1_BROKEN = { channel: "BGR", fit: "letterbox", pad: 114, thr: 0.35 };
  if (c1.channel == null) Object.assign(c1, C1_BROKEN);
  (function () {
    var el = $("cap1");
    el.innerHTML = '<h3>Case 1 · Quietly worse</h3><div class="brief"><b>The ticket.</b> After a camera-driver update, the detector’s AP50 on the held-out session fell from <b>0.979</b> to about <b>0.73</b>. Nothing errored. No log line changed. The only clue is that the sample frame below, shown <i>as the model now receives it</i>, looks off. The source file warned about exactly this: ' + MD.facts.quietly.v + ' ' + cite("quietly") + '</div>' +
      '<div class="pg"><div class="panel">' +
      '<div class="lbl">Channel order the darkroom hands over</div><div class="seg" id="cap1ch" role="group" aria-label="Channel order"></div>' +
      '<div class="lbl">Fit into the 320 square</div><div class="seg" id="cap1fit" role="group" aria-label="Fit"></div>' +
      '<div class="lbl">Pad colour</div><div class="seg" id="cap1pad" role="group" aria-label="Pad colour"></div>' +
      '<div class="sl"><div class="sl-h"><span>Confidence threshold</span><b id="cap1thv"></b></div><input type="range" id="cap1th" min="0.05" max="0.9" step="0.05" value="' + c1.thr + '" aria-label="Confidence threshold"></div>' +
      '<div class="btnrow"><button class="act" id="cap1go">Re-run the session</button><button class="ghost" id="cap1rs">Back to the broken build</button></div>' +
      '<div class="audit" id="cap1a"></div>' +
      '</div><div>' +
      '<div class="ev"><div><div class="frame"><canvas id="cap1cam" width="180" height="320" aria-label="The evidence frame as the camera saw it"></canvas></div><div class="cap">the frame, as the camera saw it</div></div>' +
      '<div><div class="frame sq"><canvas id="cap1in" class="px" width="320" height="320" aria-label="The 320 by 320 model input with detections at the threshold"></canvas></div><div class="cap" id="cap1incap">what the model receives, with its boxes at your threshold</div></div></div>' +
      '<div class="grid g3"><div class="stat"><div class="v" id="cap1ap">–</div><div class="l">AP50, 40 frames</div></div><div class="stat"><div class="v" id="cap1p">–</div><div class="l">precision at your threshold</div></div><div class="stat"><div class="v" id="cap1r">–</div><div class="l">recall at your threshold</div></div></div>' +
      '</div></div>' +
      reasonHTML("cap1", ["Pre-processing no longer matches what the model was trained on (channel order, fit or pad colour)", "The confidence threshold is too high for the new driver’s exposure", "The INT8 export drifted on the NPU", "The model over-fit the old driver and needs retraining"]) +
      '<div class="checks" id="cap1c"></div>';
    var segs = {
      ch: ui.seg("cap1ch", [{ v: "RGB", label: "RGB" }, { v: "BGR", label: "BGR" }], c1.channel, function (v) { c1.channel = v; run(false); touch(); }),
      fit: ui.seg("cap1fit", [{ v: "letterbox", label: "letterbox (grey bars)" }, { v: "stretch", label: "stretch to fill" }], c1.fit, function (v) { c1.fit = v; run(false); touch(); }),
      pad: ui.seg("cap1pad", [{ v: 114, label: "114 grey" }, { v: 0, label: "0 black" }, { v: 255, label: "255 white" }], c1.pad, function (v) { c1.pad = +v; run(false); touch(); })
    };
    ui.range("cap1th", function () { c1.thr = +$("cap1th").value; run(false); touch(); });
    var camImg = null;
    function pre() { return { channel: c1.channel, fit: c1.fit, pad: c1.pad }; }
    function drawEvidence(stats) {
      if (!camImg) camImg = ui.roomImage(EVIDENCE, K, 0.5);
      var cam = $("cap1cam"); ui.renderRoom(cam, EVIDENCE, K, { scale: 0.25 });
      var inp = core.letterboxPixels(camImg, CAM.input, pre()); ui.putImage($("cap1in"), inp);
      var d = core.detect(EVIDENCE, K, { pre: pre() }), kept = core.decode(d.raw, d.lb, c1.thr, 0.5), x = $("cap1in").getContext("2d");
      var duckIn = d.gts.filter(function (g) { return g.isDuck; }).map(function (g) { return g.inBox; });
      x.font = "16px 'Patrick Hand', sans-serif"; x.textBaseline = "bottom"; x.lineJoin = "round";
      kept.forEach(function (k) {
        var tp = duckIn.some(function (b) { return core.iou(k.inBox, b) >= 0.5; }), col = tp ? "#3B7422" : "#C8452F";
        ui.boxPath(x, k.inBox, col, 2.5); x.fillStyle = col; x.textAlign = "left"; x.fillText((tp ? "duck " : "false alarm ") + fmt(k.score, 2), Math.min(k.inBox[0], 230), Math.max(k.inBox[1] - 3, 15));
      });
      var missed = duckIn.filter(function (b) { return !kept.some(function (k) { return core.iou(k.inBox, b) >= 0.5; }); });
      missed.forEach(function (b) { ui.boxPath(x, b, "#C8452F", 2.5, [5, 4]); x.fillStyle = "#C8452F"; x.textAlign = "left"; x.fillText("missed duck", Math.min(b[0], 230), Math.min(b[3] + 17, 318)); });
      var lowest = kept.length ? kept.map(function (k) { return k.score; }) : [];
      $("cap1incap").textContent = "frame 19 of the session: " + kept.length + " box" + (kept.length === 1 ? "" : "es") + " at ≥ " + fmt(c1.thr, 2) + (missed.length ? ", the duck missed" : "") + ".";
    }
    function run(grade) {
      $("cap1thv").textContent = fmt(c1.thr, 2);
      var s = sessionStats({ pre: pre() }, c1.thr);
      drawEvidence(s);
      var apBad = s.ap < 0.95;
      $("cap1ap").textContent = fmt(s.ap, 3); $("cap1ap").className = "v " + (apBad ? "bad" : "good");
      $("cap1p").textContent = pct(s.at.precision); $("cap1r").textContent = pct(s.at.recall); $("cap1r").className = "v " + (s.at.recall < 0.9 ? "bad" : "good");
      $("cap1a").innerHTML = au("Held-out session: " + s.nGT + " ducks in 40 frames · AP50 (threshold-independent)", fmt(s.ap, 3), apBad ? "red" : "grn") +
        au("At threshold " + fmt(c1.thr, 2) + ": found " + s.at.tp + " ducks, missed " + s.at.fn + ", false alarms " + s.at.fp, "P " + pct(s.at.precision) + " · R " + pct(s.at.recall)) +
        au("Darkroom: " + c1.channel + " · " + c1.fit + " · pad " + c1.pad + (c1.channel === "RGB" && c1.fit === "letterbox" && c1.pad === 114 ? " = as trained" : " ≠ as trained (RGB · letterbox · 114)"), c1.channel === "RGB" && c1.fit === "letterbox" && c1.pad === 114 ? "match" : "mismatch", c1.channel === "RGB" && c1.fit === "letterbox" && c1.pad === 114 ? "grn" : "red");
      if (!grade) { $("cap1c").innerHTML = ""; return; }
      var ans = readReason("cap1"); ui.store.capAns.cap1 = ans;
      var list = [
        ["AP50 is back on the report card (≥ 0.95): it is " + fmt(s.ap, 3), s.ap >= 0.95, "AP scores the <i>ranking</i> of every candidate, so the threshold cannot move it. With the darkroom wrong, the toy sits near 0.73 whatever you set: the true ducks now score below the rubber ducks (frame 19: the duck comes back at 0.32, under the rubber duck’s 0.67)."],
        ["Recall at your threshold ≥ 90%: it is " + pct(s.at.recall), s.at.recall >= 0.9, "Ducks are being missed at this threshold."],
        ["The threshold stayed a deployed value (0.25–0.50): the fix belongs in the darkroom, not the box desk", c1.thr >= 0.25 && c1.thr <= 0.5, "Lowering the threshold buys recall with false alarms (" + s.at.fp + " in 40 frames now) and leaves AP where it was. It treats a symptom."]
      ];
      var ok = ans === 0, pass = ok && list.every(function (x) { return x[1]; });
      $("cap1c").innerHTML = checksHTML(list, ok) + (pass ? '<div class="callout co-g verdict"><b>Case closed.</b> RGB, letterbox, 114: the darkroom matches training again and the report card is back to ' + fmt(s.ap, 3) + '. The lesson is in lib.rs itself: a pre-processing mismatch never throws; it just gets quietly worse. Guard it with a golden frame whose boxes you compare after every driver or dependency change.</div>' : "");
      ui.store.cap.cap1 = pass; ui.save(); capStars();
    }
    $("cap1go").onclick = function () { run(true); touch(); };
    regradeOnReason("cap1", function () { run(true); });
    $("cap1rs").onclick = function () { Object.assign(c1, C1_BROKEN); segs.ch.set(c1.channel); segs.fit.set(c1.fit); segs.pad.set(c1.pad); $("cap1th").value = c1.thr; run(false); touch(); };
    run(false);
    DEV.onShow("cap", function () { run(false); });
  })();

  /* ================= Case 2 · The threshold does nothing ================= */
  var c2 = st.c2 = st.c2 || {};
  var C2_BROKEN = { thr: 0.6, quant: "per-tensor", retrained: false, documented: false };
  if (c2.quant == null) Object.assign(c2, C2_BROKEN);
  var SESSION2 = core.makeSession(2027, 60);   // "more data": a different recording, same export path
  (function () {
    var el = $("cap2");
    el.innerHTML = '<h3>Case 2 · The threshold does nothing</h3><div class="brief"><b>The ticket.</b> After the INT8 export for the NPU, someone moved the confidence threshold from the deployed <b>0.35</b> ' + cite("threshold") + ' to <b>0.6</b> to cut false alarms. Nothing changed: the same boxes, frame after frame. The deploy file already knew: ' + MD.facts.score13.v + ' ' + cite("score13") + '</div>' +
      '<div class="pg"><div class="panel">' +
      '<div class="sl"><div class="sl-h"><span>Confidence threshold</span><b id="cap2thv"></b></div><input type="range" id="cap2th" min="0.01" max="1" step="0.01" value="' + c2.thr + '" aria-label="Confidence threshold"></div>' +
      '<div class="lbl">Output quantisation</div><div class="seg" id="cap2q" role="group" aria-label="Output quantisation"></div>' +
      '<div class="btnrow"><button class="ghost" id="cap2rt">Retrain on more data &amp; re-export</button></div>' +
      '<label class="tg"><input type="checkbox" id="cap2doc"' + (c2.documented ? " checked" : "") + '><span class="sw"></span><span>Document it: on this export the threshold is an on/off switch (any value in 0 &lt; t ≤ 1.25 keeps the same boxes)</span></label>' +
      '<div class="btnrow"><button class="act" id="cap2go">Re-run the session</button><button class="ghost" id="cap2rs">Back to the broken build</button></div>' +
      '<div class="audit" id="cap2a"></div>' +
      '</div><div>' +
      '<canvas id="cap2hist" height="200" aria-label="Histogram of every quantised score in the session"></canvas><div class="chartcap">Every score the head produced over the session (2,100 × frames), after quantisation. Bars are on a log count. The gold line is your threshold; grey ticks are the notches the scale allows.</div>' +
      '<div class="grid g3" style="margin-top:10px"><div class="stat"><div class="v" id="cap2n35">–</div><div class="l">boxes kept at 0.35</div></div><div class="stat"><div class="v" id="cap2nt">–</div><div class="l">boxes kept at your threshold</div></div><div class="stat"><div class="v" id="cap2ap">–</div><div class="l">AP50</div></div></div>' +
      '</div></div>' +
      reasonHTML("cap2", ["The output tensor shares one quantisation scale between the box coordinates (up to ~320) and the scores (0–1), so one notch is ~1.26 and a score can only be 0 or one notch", "The model is under-trained, so it is either certain or silent", "The threshold is applied after NMS, when only one box is left", "The NPU rounds every score to the nearest 0.5"]) +
      '<div class="checks" id="cap2c"></div>';
    var qseg = ui.seg("cap2q", [{ v: "per-tensor", label: "per-tensor: one scale for all five rows" }, { v: "per-channel", label: "per-channel: the score row gets its own scale" }], c2.quant, function (v) { c2.quant = v; run(false); touch(); });
    ui.range("cap2th", function () { c2.thr = +$("cap2th").value; run(false); touch(); });
    $("cap2doc").onchange = function () { c2.documented = this.checked; run(false); touch(); };
    $("cap2rt").onclick = function () { c2.retrained = !c2.retrained; run(false); touch(); };
    var hist = null;
    function countAt(thr, frames) { var n = 0; frames.forEach(function (f) { f.dets.forEach(function (d) { if (d.score >= thr) n++; }); }); return n; }
    // Every quantised score in a session, and its distinct non-zero values.
    function scoresOf(S, perCh) {
      var scores = [], distinct = {}, scale = null;
      S.forEach(function (sc) { var d = core.detect(sc, K, {}), q = core.quantizeHead(d.raw, perCh), N = d.N; if (scale == null) scale = perCh ? q.params[4].scale : q.params[0].scale; for (var i = 0; i < N; i++) { var v = q.raw[4 * N + i]; scores.push(v); if (v > 0.001) distinct[v.toFixed(2)] = true; } });
      return { scores: scores, scale: scale, keys: Object.keys(distinct).sort(function (a, b) { return a - b; }) };
    }
    function run(grade) {
      $("cap2thv").textContent = fmt(c2.thr, 2);
      $("cap2rt").textContent = c2.retrained ? "Retrained ✓ (click to undo)" : "Retrain on more data & re-export";
      // The report card always uses the same 40-frame held-out session: a new test set would move AP for reasons
      // that have nothing to do with the fix. The toy can't retrain, so "retrain" shows what the same export does
      // to a fresh 60-frame recording: the scale comes from the tensor's range, so the scores keep the same notches.
      var perCh = c2.quant === "per-channel";
      var frames = core.evalSession(SESSION, K, { quant: c2.quant }), pr = core.prCurve(frames, 0.5), ap = core.apAllPoint(pr.pts);
      var sq = scoresOf(SESSION, perCh), scale = sq.scale, keys = sq.keys, keys2 = c2.retrained ? scoresOf(SESSION2, perCh).keys : null;
      hist = { scores: sq.scores, scale: scale, perCh: perCh };
      var n35 = countAt(0.35, frames), n60 = countAt(0.6, frames), nt = countAt(c2.thr, frames), n01 = countAt(0.01, frames);
      var responsive = n35 !== n60;
      $("cap2n35").textContent = n35; $("cap2nt").textContent = nt; $("cap2nt").className = "v " + (nt === n35 && Math.abs(c2.thr - 0.35) > 0.02 ? "bad" : "acc");
      $("cap2ap").textContent = fmt(ap, 3); $("cap2ap").className = "v " + (ap >= 0.95 ? "good" : "bad");
      $("cap2a").innerHTML = au("Distinct non-zero scores in the held-out session" + (perCh ? "" : " (one notch; it wobbles because the toy measures each frame’s range, where a real export fixes one scale)"), perCh ? keys.length + " values (a real dial)" : "{ " + keys.join(", ") + " }", perCh ? "grn" : "red") +
        au("Score scale · one notch", (perCh ? "score row: " : "whole tensor: ") + fmt(scale, 4)) +
        au("Boxes kept at 0.01 · 0.35 · 0.60 · " + fmt(c2.thr, 2), n01 + " · " + n35 + " · " + n60 + " · " + nt, responsive ? "grn" : "red") +
        (c2.retrained ? au("Retrained, re-exported the same way, run on a fresh 60-frame recording: its scores", perCh ? keys2.length + " values (a real dial)" : "still { " + keys2.join(", ") + " }", perCh ? "grn" : "red") : "");
      ui.redrawAll();
      if (!grade) { $("cap2c").innerHTML = ""; return; }
      var ans = readReason("cap2"); ui.store.capAns.cap2 = ans;
      var list = perCh ? [
        ["The threshold responds again: 0.35 keeps " + n35 + " boxes, 0.6 keeps " + n60, responsive, ""],
        ["The scores are a fine scale again and AP50 ≥ 0.95: it is " + fmt(ap, 3), ap >= 0.95, ""],
        ["The score row has its own scale (per-channel), so the fix is in the export, not the config", true, ""]
      ] : [
        ["Either the threshold responds (0.35 → " + n35 + ", 0.6 → " + n60 + ")…", responsive, (c2.retrained ? "Retraining changed the weights, not the scale: the scale is the tensor’s range (~320 px ÷ 255 notches ≈ 1.26), so the scores are still { " + keys2.join(", ") + " }." : "Every non-zero score is one notch, ≈ 1.26. Any threshold in 0 < t ≤ 1.25 keeps exactly the same boxes" + (c2.thr <= 0.05 ? ", including your " + fmt(c2.thr, 2) : "") + ".")],
        ["…or the on/off behaviour is accepted and written down", c2.documented, "If you keep the shared scale, say so where the next person will look: the deploy file does."],
      ];
      var ok = ans === 0, pass = ok && (perCh ? list.every(function (x) { return x[1]; }) : c2.documented);
      $("cap2c").innerHTML = checksHTML(list, ok) + (pass ? '<div class="callout co-g verdict"><b>Case closed.</b> ' + (perCh ? "Give the score row its own scale (one notch ≈ 0.004) and the threshold is a dial again, with AP back at " + fmt(ap, 3) + ". That is an export-time fix: per-channel quantisation of the head’s output." : "You kept the shared scale and documented the consequence, which is exactly what robotd.toml does. Honest beats broken. The other right fix is a separate scale for the score row.") + " Neither retraining nor a lower threshold could touch a scale that comes from the tensor’s range.</div>" : "");
      ui.store.cap.cap2 = pass; ui.save(); capStars();
    }
    ui.drawer("cap2hist", function () {
      if (!hist) return;
      var g = ui.ctxFor("cap2hist"), x = g.x, pad = { l: 40, r: 12, t: 14, b: 26 }, W = g.w - pad.l - pad.r, H = g.h - pad.t - pad.b;
      var xmax = 1.4, nb = 70, bins = new Array(nb).fill(0);
      hist.scores.forEach(function (v) { var i = Math.min(nb - 1, Math.max(0, Math.floor(v / xmax * nb))); bins[i]++; });
      var top = Math.log10(Math.max.apply(null, bins) + 1);
      x.strokeStyle = C.line; x.lineWidth = 1; [1, 10, 100, 1000, 10000, 100000].forEach(function (c) { if (Math.log10(c + 1) > top) return; var y = pad.t + H * (1 - Math.log10(c + 1) / top); x.beginPath(); x.moveTo(pad.l, y); x.lineTo(g.w - pad.r, y); x.stroke(); x.fillStyle = C.dim; x.textAlign = "right"; x.font = "12px 'Patrick Hand', sans-serif"; x.fillText(c >= 1000 ? (c / 1000) + "k" : String(c), pad.l - 4, y); });
      // notches
      var step = hist.scale; if (step > 0.02) { x.strokeStyle = "rgba(74,46,30,.45)"; for (var v = 0; v <= xmax; v += step) { var xx = pad.l + W * v / xmax; x.beginPath(); x.moveTo(xx, g.h - pad.b); x.lineTo(xx, g.h - pad.b + 7); x.stroke(); } }
      bins.forEach(function (n, i) { if (!n) return; var h = H * Math.log10(n + 1) / top, xx = pad.l + W * i / nb; x.fillStyle = (i / nb * xmax) >= c2.thr ? "#3B7422" : "#B9BDC2"; x.fillRect(xx, pad.t + H - h, Math.max(2, W / nb - 1), h); });
      x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, g.h - pad.b); x.lineTo(g.w - pad.r, g.h - pad.b); x.stroke();
      x.fillStyle = C.dim; x.textAlign = "center"; x.font = "12px 'Patrick Hand', sans-serif"; [0, 0.35, 0.6, 1, 1.26].forEach(function (v) { x.fillText(fmt(v, 2), pad.l + W * v / xmax, g.h - 8); });
      var tx = pad.l + W * c2.thr / xmax; ui.line(x, [[tx, pad.t], [tx, g.h - pad.b]], C.gold, 3);
      x.fillStyle = C.txt; x.textAlign = "left"; x.font = "13px 'Patrick Hand', sans-serif"; x.fillText(hist.perCh ? "per-channel: notch " + fmt(hist.scale, 4) : "per-tensor: notch " + fmt(hist.scale, 3) + " → scores are 0 or " + fmt(hist.scale, 2), pad.l + 6, pad.t + 2);
    });
    $("cap2go").onclick = function () { run(true); touch(); };
    regradeOnReason("cap2", function () { run(true); });
    $("cap2rs").onclick = function () { Object.assign(c2, C2_BROKEN); qseg.set(c2.quant); $("cap2th").value = c2.thr; $("cap2doc").checked = false; run(false); touch(); };
    run(false);
  })();

  /* ================= Case 3 · The head over-turns ================= */
  var c3 = st.c3 = st.c3 || {};
  var C3_BROKEN = { intr: "placeholder", hz: 10 };
  if (c3.intr == null) Object.assign(c3, C3_BROKEN);
  (function () {
    var el = $("cap3"), TRUE_FOV = K.fovLR, PLACE_FOV = 62, RANGE = 3, RANGE2 = 2.2, B1 = 0.5, B2 = 0.9;
    function aim(b) { return c3.intr === "placeholder" ? core.bearingToAngle(b, PLACE_FOV) : c3.intr === "calibrated" ? core.bearingToAngle(b, TRUE_FOV) : b * 31; }
    function truth(b) { return core.bearingToAngle(b, TRUE_FOV); }
    function miss(b) { return (b === B2 ? RANGE2 : RANGE) * Math.abs(Math.tan(aim(b) * core.DEG) - Math.tan(truth(b) * core.DEG)); }
    el.innerHTML = '<h3>Case 3 · The head over-turns</h3><div class="brief"><b>The ticket.</b> A duck stands at bearing <b>+0.5</b>, 3 m away. The neck crank turns <b>16.7°</b>; the duck is at <b>9.6°</b>. At 3 m that is <b>0.39 m</b> to the side, more than the duck’s own 25 cm. In this ticket the gaze code turns bearing into angle by putting the sensor’s quoted ~62° field of view ' + cite("sensor") + ' across the frame’s width (our made-up placeholder; the repo doesn’t show the real values), and the design doc lists the open item: ' + MD.facts.intrinsics.v + ' ' + cite("intrinsics") + '. Meanwhile someone raised looks per second from 2 to <b>10</b> “to track better”.</div>' +
      '<div class="pg"><div class="panel">' +
      '<div class="lbl">Intrinsics used for bearing → angle</div><div class="seg" id="cap3i" role="group" aria-label="Intrinsics"></div>' +
      '<div class="sl"><div class="sl-h"><span>Looks per second</span><b id="cap3hzv"></b></div><input type="range" id="cap3hz" min="1" max="16" step="1" value="' + c3.hz + '" aria-label="Detector looks per second"></div>' +
      '<div class="thermo" aria-hidden="true"><i id="cap3tbar"></i><em style="left:87.5%" title="90 °C throttle"></em></div><div class="chartcap" id="cap3tcap"></div>' +
      '<div class="btnrow"><button class="act" id="cap3go">Re-run the head turn</button><button class="ghost" id="cap3rs">Back to the broken build</button></div>' +
      '<div class="mathbox" id="cap3m"></div>' +
      '</div><div>' +
      '<canvas id="cap3plan" height="300" aria-label="Plan view: where the head aims against where the ducks are"></canvas><div class="chartcap"><span class="sw" style="background:#C8452F"></span>where the crank turns the head · <span class="sw" style="background:#3B7422"></span>where the ducks are (this lab’s full-width 16:9 model) · dashed: the miss at 3 m</div>' +
      '<div class="grid g2" style="margin-top:10px"><div class="stat"><div class="v" id="cap3a1">–</div><div class="l">head at b = +0.5 (duck at 9.6°)</div></div><div class="stat"><div class="v" id="cap3m1">–</div><div class="l">miss at 3 m</div></div><div class="stat"><div class="v" id="cap3a2">–</div><div class="l">head at b = +0.9 (duck at 16.9°, 2.2 m)</div></div><div class="stat"><div class="v" id="cap3m2">–</div><div class="l">miss at 2.2 m</div></div></div>' +
      '</div></div>' +
      reasonHTML("cap3", ["The placeholder puts the sensor’s 62° across the 720-px width; on this mount the 62° runs along the 1280-px height, so f is ~1065 px, not 599, and left–right is only ~37°", "The neck servo’s zero is off by 7°", "The bearing formula has the wrong sign", "10 looks per second made the head overshoot"]) +
      '<div class="checks" id="cap3c"></div>';
    var iseg = ui.seg("cap3i", [{ v: "placeholder", label: "placeholder: 62° across the width (f 599 px)" }, { v: "calibrated", label: "calibrated: full-width 16:9 mode, 62° along the height (f 1065 px, LR 37.3°)" }, { v: "linear", label: "the hack: angle = b × 31°" }], c3.intr, function (v) { c3.intr = v; run(false); touch(); });
    ui.range("cap3hz", function () { c3.hz = +$("cap3hz").value; run(false); touch(); });
    var shown = { a1: aim(B1), a2: aim(B2) };
    function run(grade) {
      var a1 = aim(B1), a2 = aim(B2), t1 = truth(B1), t2 = truth(B2), m1 = miss(B1), m2 = miss(B2), temp = core.boardTemp(c3.hz), duty = c3.hz * 60 / 1000;
      $("cap3hzv").textContent = c3.hz + " /s";
      // bar runs idle (55 °C) → flat out (95 °C), so the 90 °C throttle mark sits at 87.5%
      $("cap3tbar").style.transform = "scaleX(" + Math.max(0, Math.min(1, (temp - core.THERMAL.idle) / (core.THERMAL.flatOut - core.THERMAL.idle))).toFixed(3) + ")";
      $("cap3tcap").innerHTML = "toy board temperature <b>" + fmt(temp, 0) + " °C</b> · detector busy " + pct(duty, 0) + " of the time (" + c3.hz + " × ~60 ms)" + (core.throttled(c3.hz) ? " · <b class='bad'>throttling</b>" : "") + (c3.hz > 2 ? " · over the deploy file’s 2/s limit" : " · within the 2/s limit");
      $("cap3a1").textContent = ui.sgn(a1, 1) + "°"; $("cap3a1").className = "v " + (Math.abs(a1 - t1) <= 1 ? "good" : "bad");
      $("cap3a2").textContent = ui.sgn(a2, 1) + "°"; $("cap3a2").className = "v " + (Math.abs(a2 - t2) <= 1 ? "good" : "bad");
      $("cap3m1").textContent = fmt(m1 * 100, 0) + " cm"; $("cap3m2").textContent = fmt(m2 * 100, 0) + " cm";
      var formula = c3.intr === "linear" ? "angle = b × 31°" : "angle = atan( b × tan(FOV<sub>LR</sub> ÷ 2) ), FOV<sub>LR</sub> = " + fmt(c3.intr === "placeholder" ? PLACE_FOV : TRUE_FOV, 2) + "°";
      var sub = c3.intr === "linear" ? "0.5 × 31 = <b>15.5°</b> · 0.9 × 31 = <b>27.9°</b>" : "atan(0.5 × " + fmt(Math.tan((c3.intr === "placeholder" ? PLACE_FOV : TRUE_FOV) / 2 * core.DEG), 4) + ") = <b>" + fmt(a1, 1) + "°</b> · atan(0.9 × " + fmt(Math.tan((c3.intr === "placeholder" ? PLACE_FOV : TRUE_FOV) / 2 * core.DEG), 4) + ") = <b>" + fmt(a2, 1) + "°</b>";
      $("cap3m").innerHTML = '<div class="eq">' + formula + '</div><div class="eqn">' + sub + '</div><div class="eqn">miss = range × |tan(head) − tan(duck)| = <b>' + fmt(m1, 2) + ' m</b> at b = 0.5 (3 m) · <b>' + fmt(m2, 2) + ' m</b> at b = 0.9 (2.2 m)</div>';
      if (!grade) { shown.a1 = a1; shown.a2 = a2; ui.redrawAll(); $("cap3c").innerHTML = ""; return; }
      animate(a1, a2, function () {
        var ans = readReason("cap3"); ui.store.capAns.cap3 = ans;
        var list = [
          ["At b = +0.5 the head lands within 1° of the duck: aim " + fmt(a1, 1) + "°, duck " + fmt(t1, 1) + "°, miss " + fmt(m1 * 100, 0) + " cm", Math.abs(a1 - t1) <= 1, c3.intr === "linear" ? "b × 31° is 15.5° here: a straight multiply by the wrong half-angle." : "The 62° belongs to the sensor’s long axis, which this mount turns vertical."],
          ["At the edge, b = +0.9, still within 1°: aim " + fmt(a2, 1) + "°, duck " + fmt(t2, 1) + "°, miss " + fmt(m2 * 100, 0) + " cm", Math.abs(a2 - t2) <= 1, c3.intr === "linear" ? "The linear hack reads 27.9° at the edge against 16.9°: " + fmt(m2 * 100, 0) + " cm off at 2.2 m (0.68 m at 3 m). Pixels are linear in tan(angle), not in angle, and 31° is the wrong half-width anyway." : ""],
          ["Looks per second back at ≤ 2 (yours: " + c3.hz + ")", c3.hz <= 2, "Not a preference: " + MD.facts.thermal.v + " " + cite("thermal") + " (Toy temperature " + fmt(temp, 0) + " °C; the toy only reaches the 90 °C throttle near flat-out, the real board’s limit is the deploy file’s word.)"]
        ];
        var ok = ans === 0, pass = ok && list.every(function (x) { return x[1]; });
        $("cap3c").innerHTML = checksHTML(list, ok) + (pass ? '<div class="callout co-g verdict"><b>Case closed.</b> With the mount respected, f is 1065 px and left–right is 37.3°, so bearing +0.5 is 9.6°, not 16.7°. The only honest number is a calibrated one, which is why the TODO exists. And 2 looks a second stays: a head that sees well while the legs stumble is not tracking better.</div>' : "");
        ui.store.cap.cap3 = pass; ui.save(); capStars();
      });
    }
    function animate(a1, a2, done) {
      var f1 = shown.a1, f2 = shown.a2, t0 = null, dur = REDUCED ? 0 : 550;
      if (!dur || document.hidden) { shown.a1 = a1; shown.a2 = a2; ui.redrawAll(); done(); return; }
      function frame(ts) { if (t0 == null) t0 = ts; var u = dur ? Math.min(1, (ts - t0) / dur) : 1, e = 1 - Math.pow(1 - u, 3); shown.a1 = f1 + (a1 - f1) * e; shown.a2 = f2 + (a2 - f2) * e; ui.redrawAll(); if (u < 1) requestAnimationFrame(frame); else done(); }
      requestAnimationFrame(frame);
    }
    ui.drawer("cap3plan", function () {
      var g = ui.ctxFor("cap3plan"), x = g.x, s = (g.h - 40) / 3.4, x0 = g.w / 2, y0 = g.h - 22, half = TRUE_FOV / 2 * core.DEG;
      var P = function (ang, r) { return [x0 + Math.sin(ang * core.DEG) * r * s, y0 - Math.cos(ang * core.DEG) * r * s]; };
      x.fillStyle = "#EAF4FB"; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 - Math.sin(half) * 3.3 * s, y0 - Math.cos(half) * 3.3 * s); x.arc(x0, y0, 3.3 * s, -Math.PI / 2 - half, -Math.PI / 2 + half); x.closePath(); x.fill();
      x.strokeStyle = C.line; x.lineWidth = 1; x.setLineDash([3, 4]); [1, 2, 3].forEach(function (m) { x.beginPath(); x.arc(x0, y0, m * s, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); x.stroke(); x.fillStyle = C.dim; x.textAlign = "left"; x.font = "12px 'Patrick Hand', sans-serif"; x.fillText(m + " m", x0 + Math.sin(0.9) * m * s + 3, y0 - Math.cos(0.9) * m * s); }); x.setLineDash([]);
      x.fillStyle = C.dim; x.textAlign = "center"; x.fillText("37.3° left–right view", x0, 14);
      [[B1, shown.a1, RANGE], [B2, shown.a2, RANGE2]].forEach(function (p, i) {
        var t = truth(p[0]), d = P(t, p[2]), a = P(p[1], p[2]), tip = P(p[1], 3.25);
        ui.line(x, [[x0, y0], tip], C.red, i ? 2 : 3);
        ui.line(x, [d, a], C.red, 1.5, [4, 4]);
        x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.ellipse(d[0], d[1], 9, 7, 0, 0, 7); x.fill(); x.stroke();
        x.fillStyle = C.grn; x.beginPath(); x.arc(d[0], d[1], 3.5, 0, 7); x.fill();
        var dl = "duck, b = +" + p[0] + " → " + fmt(t, 1) + "°"; x.fillStyle = C.txt; x.font = "13px 'Patrick Hand', sans-serif";
        var fits = d[0] + 12 + x.measureText(dl).width < g.w - 4; x.textAlign = fits ? "left" : "right"; x.fillText(dl, d[0] + (fits ? 12 : -12), d[1] + (i ? 14 : -4));
        x.fillStyle = C.red; x.fillText(fmt(p[1], 1) + "°", tip[0] + 6, tip[1]);
      });
      x.fillStyle = "#E9EEF0"; x.strokeStyle = C.ink; x.lineWidth = 2; x.beginPath(); x.arc(x0, y0, 14, 0, 7); x.fill(); x.stroke();
      x.save(); x.translate(x0, y0); x.rotate(shown.a1 * core.DEG); x.fillStyle = C.bill; x.beginPath(); x.moveTo(-6, -12); x.lineTo(0, -24); x.lineTo(6, -12); x.closePath(); x.fill(); x.stroke(); x.restore();
    });
    $("cap3go").onclick = function () { run(true); touch(); };
    regradeOnReason("cap3", function () { run(true); });
    $("cap3rs").onclick = function () { Object.assign(c3, C3_BROKEN); iseg.set(c3.intr); $("cap3hz").value = c3.hz; run(false); touch(); };
    run(false);
  })();

  capStars();
});
