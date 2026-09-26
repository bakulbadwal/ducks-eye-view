/* Duck's-Eye View — deterministic checks on the math in js/core.js.
   Run: node tests/core.test.js   (no dependencies)
   Every expected value is either worked by hand in the study pack, or read from
   pollen-robotics/microduck @ 590b986 (cited next to the check). */
"use strict";
const C = require("../js/core.js");
let pass = 0, fail = 0;
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function check(name, ok, got) { if (ok) pass++; else { fail++; console.log("FAIL  " + name + (got !== undefined ? "   got " + JSON.stringify(got) : "")); } }

// ---------- camera and mount ----------
const K = C.modeIntrinsics("full"), K2 = C.modeIntrinsics("crop1080");
check("full-width 16:9 mode: left-right FOV 37.35°", near(K.fovLR, 37.349, 0.01), K.fovLR);
check("full-width 16:9 mode: vertical FOV = the sensor's 62°", near(K.fovV, 62, 1e-9), K.fovV);
check("full-width 16:9 mode: f = 640 / tan 31° = 1065.1 px", near(K.f, 1065.14, 0.05), K.f);
check("1920×1080 centre crop: left-right FOV 22.38°", near(K2.fovLR, 22.38, 0.01), K2.fovLR);
check("no 16:9 mode sees wider than 37.35° left-right", near(C.maxLrFov(), K.fovLR, 1e-9));
check("placeholder '62° across 720 px' → f = 599.1", near(C.focalFromFov(720, 62), 599.1, 0.05));
check("bearing 0.5 → 9.6° with the full-width mode", near(C.bearingToAngle(0.5, K.fovLR), 9.59, 0.01), C.bearingToAngle(0.5, K.fovLR));
check("bearing 0.5 → 16.7° with the placeholder", near(C.bearingToAngle(0.5, 62), 16.72, 0.01));
check("bearing of a box centred at 360 in a 720 frame is 0", C.bearing([300, 0, 420, 10], 720) === 0);
check("bearing of 400–520 is +0.278", near(C.bearing([400, 0, 520, 10], 720), 0.2778, 1e-4));
const p1 = C.project(0.5, -0.2, 3, K), p2 = C.project(1, -0.4, 6, K);
check("(0.5,−0.2,3) and (1,−0.4,6) land on the same pixel", near(p1.u, p2.u) && near(p1.v, p2.v));

// ---------- letterbox (lib.rs:67-110) ----------
const lb = C.letterboxFit(720, 1280, 320);
check("letterbox 720×1280 → scale 0.25, 180×320, pad 70/0", lb.scale === 0.25 && lb.fw === 180 && lb.fh === 320 && lb.padX === 70 && lb.padY === 0, lb);
check("43.75% of the input is grey", near(1 - 180 * 320 / (320 * 320), 0.4375));
const back = C.boxFromInput([110, 150, 132, 172], lb);
check("input box [110,150,132,172] → frame [160,600,248,688]", back.every((v, i) => near(v, [160, 600, 248, 688][i])), back);
const st = C.stretchFit(720, 1280, 320);
check("stretching draws the duck 1.78× too wide", near(st.sx / st.sy, 1280 / 720, 1e-12));

// ---------- the duck at 3 m ----------
const duck = C.sceneGTs({ objects: [{ kind: "microduck", x: 0, z: 3 }] }, K)[0].box;
check("25 cm duck at 3 m: 88.8 px tall in the frame", near(duck[3] - duck[1], 88.76, 0.05), duck[3] - duck[1]);
check("… 22.2 px tall in the 320 input", near((duck[3] - duck[1]) * lb.scale, 22.19, 0.02));
check("pixels-per-degree shortcut: 24.6 px", near(320 * (2 * Math.atan(0.125 / 3) / C.DEG) / 62, 24.63, 0.01));

// ---------- convolution ----------
check("5×5 * 3×3, stride 1, pad 0 → 3×3", C.convOutSize(5, 3, 0, 1) === 3);
check("320, 3×3, stride 2, pad 1 → 160", C.convOutSize(320, 3, 1, 2) === 160);
const img = new Float32Array(25).map((_, i) => i), id = C.conv2d(img, 5, 5, [0, 0, 0, 0, 1, 0, 0, 0, 0], 3, 1, 0);
check("identity kernel returns the centre pixels", id.w === 3 && id.out[0] === 6 && id.out[8] === 18);
check("32→64, 3×3 standard conv: 18,496 params with bias", C.convParams(32, 64, 3, true) === 18496);
check("… depthwise-separable: 2,432 with bias (7.6×)", C.separableParams(32, 64, 3, true) === 2432 && near(18496 / 2432, 7.605, 0.001));
check("… without bias: 18,432 vs 2,336 (7.89×)", C.convParams(32, 64, 3, false) === 18432 && C.separableParams(32, 64, 3, false) === 2336);
check("YOLO grids at 320: 40² + 20² + 10² = 2100 (lib.rs:4)", C.yoloGrids(320).total === 2100);
check("cell 1600 is the first stride-16 cell", C.cellInfo(1600, 320).stride === 16 && C.cellInfo(1600, 320).row === 0);

// ---------- IoU, decode, NMS ----------
check("IoU of two 10×10 boxes offset by 5 = 1/3", near(C.iou([0, 0, 10, 10], [5, 0, 15, 10]), 1 / 3));
check("IoU of disjoint boxes = 0", C.iou([0, 0, 1, 1], [2, 2, 3, 3]) === 0);
// Planar [5, N] tensor with 3 candidates: two overlapping, one far away.
const N = 3, raw = new Float32Array(5 * N);
[[100, 100, 20, 20, 0.9], [102, 101, 20, 20, 0.8], [250, 250, 20, 20, 0.7]].forEach((b, i) => b.forEach((v, r) => raw[r * N + i] = v));
const kept = C.decode(raw, lb, 0.35, 0.5);
check("decode + NMS: the duplicate is shredded, 2 survive", kept.length === 2 && near(kept[0].score, 0.9, 1e-6) && near(kept[1].score, 0.7, 1e-6), kept.map(k => k.score));
check("decode maps boxes out of the letterbox", near(kept[0].box[0], (90 - 70) / 0.25) && near(kept[0].box[1], 90 / 0.25));
check("a threshold above every score keeps nothing", C.decode(raw, lb, 0.95, 0.5).length === 0);

// ---------- AP ----------
const pts = [{ recall: 0.5, precision: 1 }, { recall: 0.5, precision: 0.5 }, { recall: 1, precision: 0.667 }];
check("all-point AP of a small curve = 0.8333", near(C.apAllPoint(pts), 0.5 * 1 + 0.5 * 0.667, 1e-9), C.apAllPoint(pts));

// ---------- INT8 ----------
const qp = C.qParams(-1, 3, 8, false);
check("[−1, 3] → uint8: scale 0.015686, zero point 64", near(qp.scale, 4 / 255) && qp.zeroPoint === 64);
check("0.5 → 96 → 0.50196", C.quantize(0.5, qp) === 96 && near(C.dequantize(96, qp), 0.50196, 1e-5));
check("2.2 → 204 → 2.19608", C.quantize(2.2, qp) === 204 && near(C.dequantize(204, qp), 2.19608, 1e-5));
check("−0.7 → 19 → −0.70588", C.quantize(-0.7, qp) === 19 && near(C.dequantize(19, qp), -0.70588, 1e-5));
check("in-range error never exceeds half a step (0.00784)", [0.1, 0.33, 1.7, 2.99, -0.99].every(x => Math.abs(C.fakeQuant(x, qp) - x) <= qp.scale / 2 + 1e-12));
check("real model files: 10,477,940 / 3,851,471 = 2.72×", near(10477940 / 3851471, 2.72, 0.005));

// ---------- stereo ----------
check("Z = f·B/d round-trips", near(C.stereoDepth(700, 0.06, C.stereoDisparity(700, 0.06, 2.5)), 2.5, 1e-12));
check("doubling distance quadruples stereo depth error", near(C.stereoError(700, 0.06, 4) / C.stereoError(700, 0.06, 2), 4));

// ---------- the teaching detector (toy; seeded, so these are regression checks) ----------
const scene = { seed: 11, objects: [{ kind: "microduck", x: 0.3, z: 3 }] };
const d = C.detect(scene, K);
let over = 0; for (let i = 0; i < d.N; i++) if (d.raw[4 * d.N + i] >= 0.35) over++;
check("toy: the head fills all 2100 slots", d.N === 2100 && d.raw.length === 10500);
check("toy: ~20 candidates ≥ 0.35 on one duck at 3 m, NMS keeps 1", over >= 15 && over <= 30 && C.decode(d.raw, d.lb, 0.35, 0.5).length === 1, over);
const q = C.quantizeHead(d.raw, false), vals = new Set();
for (let i = 0; i < 2100; i++) vals.add(q.raw[4 * 2100 + i].toFixed(3));
check("per-tensor INT8: every score becomes 0 or one step (≈1.26)", vals.size === 2 && vals.has("0.000") && near(q.params[0].scale, 1.26, 0.03), [...vals]);
const S = C.makeSession(2026, 40, K), ap = o => C.apAllPoint(C.prCurve(C.evalSession(S, K, o), 0.5).pts);
const clean = ap({}), bgr = ap({ pre: { channel: "BGR" } }), pt = ap({ quant: "per-tensor" }), pc = ap({ quant: "per-channel" });
check("toy: clean AP50 ≈ 0.98 on the held-out session", near(clean, 0.979, 0.005), clean);
check("toy: BGR is quietly worse (AP50 < 0.8, no error)", bgr < 0.8, bgr);
check("toy: per-tensor INT8 loses ranking; per-channel restores it", pt < clean - 0.1 && near(pc, clean, 0.005), [pt, pc]);

// ---------- thermal toy ----------
check("toy thermal: flat out (16.7 looks/s) = 95 °C, throttled", near(C.boardTemp(1000 / 60), 95) && C.throttled(1000 / 60));
check("toy thermal: 2 looks/s is not throttled", !C.throttled(2));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
