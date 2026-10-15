/* Eye Exam — the pictures. Eight hand-built 960 × 400 scenes of a Busytown optician's shop, assembled from a small
   drawn cast (the duck in the exam chair, the optician, the checkerboard eye chart, the lens dial, the tracing card,
   the prescription card, the clue tally), plus the nav and cast icons. Flat gouache fills, one warm-brown outline,
   every object labelled with a hairline pointer. Exposed as window.EE_ART (scenes) and window.EE_ICONS (icons). */
(function (root) {
  "use strict";
  var L = "#4A2E1E", PAPER = "#FBF7EC", SHEET = "#FFFDF6", YEL = "#F4C430", BRICK = "#C8452F", GRASS = "#5FA03C", SKY = "#9CCBEA",
      SAND = "#DDBB8A", LILAC = "#B8A3DC", STEEL = "#B9BDC2", WOOD = "#B8793F", NOTE = "#FFF1A8", CHALK = "#2F4A3A",
      SHOP = "#1F7A7A", SHOPD = "#145B5B", MINT = "#CDEBE6", WALL = "#F3E7CF", WALL2 = "#EAD9B8", FLOOR = "#C99A62", BAD = "#A5321F",
      DUCK = "#F9D95B", BILL = "#E8923A", EYE = "#1F6F74", EYE2 = "#9FD3D6", EYE3 = "#0F4447", INK = "#2B2522", BLUE = "#246A9C",
      SKIN = "#F1C9A5", SKIN2 = "#D9A27A", SKIN3 = "#9C6B4A", CORK = "#D2A877";
  var HAND = "'Patrick Hand', 'Comic Sans MS', sans-serif", SIGN = "'Grandstander', 'Patrick Hand', sans-serif";

  /* ---------- primitives ---------- */
  function n(v) { return Math.round(v * 10) / 10; }
  function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function st(sw) { return sw === 0 ? "" : ' stroke="' + L + '" stroke-width="' + (sw || 2.5) + '"'; }
  function R(x, y, w, h, f, sw, rx, ex) { return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"' + (rx ? ' rx="' + rx + '"' : "") + ' fill="' + f + '"' + st(sw) + (ex || "") + "/>"; }
  function C(x, y, r, f, sw, ex) { return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + r + '" fill="' + f + '"' + st(sw === undefined ? 2 : sw) + (ex || "") + "/>"; }
  function E(x, y, rx, ry, f, sw, ex) { return '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"' + st(sw === undefined ? 2 : sw) + (ex || "") + "/>"; }
  function P(d, f, sw, ex) { return '<path d="' + d + '" fill="' + (f || "none") + '"' + st(sw === undefined ? 2 : sw) + (ex || "") + "/>"; }
  function K(d, col, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (ex || "") + "/>"; }
  function G(tf, inner, ex) { return '<g transform="' + tf + '"' + (ex || "") + ">" + inner + "</g>"; }
  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + n(x) + '" y="' + n(y) + '" font-family="' + (o.sign ? SIGN : HAND) + '" font-size="' + (o.size || 15) + '"' + (o.sign ? ' font-weight="800"' : "") +
      ' fill="' + (o.fill || L) + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") + (o.tf ? ' transform="' + o.tf + '"' : "") + (o.ls ? ' letter-spacing="' + o.ls + '"' : "") + ">" + s + "</text>";
  }
  function poly(pts, f, sw, ex) { return P("M" + pts.map(function (p) { return n(p[0]) + " " + n(p[1]); }).join(" L") + " Z", f, sw, ex); }
  function board(x, y, w, s, col) {
    return R(x, y, w, 36, col || SHOP, 3, 6) + '<g font-family="' + SIGN + '" font-weight="800" font-size="21" letter-spacing="1" text-anchor="middle">' +
      '<text x="' + (x + w / 2 + 2) + '" y="' + (y + 27) + '" fill="' + L + '">' + s + '</text><text x="' + (x + w / 2) + '" y="' + (y + 25) + '" fill="' + PAPER + '">' + s + "</text></g>";
  }
  // Patrick Hand advance widths (per 100px) for ASCII 32–126, so a tag fits its lettering.
  var GW = [23,25,30,46,51,64,53,16,33,36,40,48,20,40,21,42,45,36,47,45,37,42,40,49,43,37,23,23,40,57,40,37,55,49,51,55,47,44,37,48,47,23,37,52,37,59,53,56,48,65,45,46,47,55,56,62,60,44,51,30,42,30,37,57,22,39,41,39,39,40,36,44,42,22,23,41,27,68,45,40,43,46,38,38,34,40,40,46,45,42,43,34,18,33,53];
  function tw(s, z) { var w = 0; s.replace(/&[a-z#0-9]+;/g, "x").replace(/<[^>]+>/g, "").split("").forEach(function (c) { var k = c.charCodeAt(0); w += k >= 32 && k <= 126 ? GW[k - 32] : 50; }); return w * z / 100 * 1.12 + 3; }
  // A hand-lettered label joined to its object by a hairline pointer; t = [x, y] of the object.
  function label(x, y, lines, t, o) {
    o = o || {}; if (typeof lines === "string") lines = [lines];
    var z = o.size || 15, lh = Math.round(z * 1.22), an = o.anchor || "start", w = 0, s = "";
    lines.forEach(function (l) { w = Math.max(w, tw(l, z)); });
    var x0 = an === "middle" ? x - w / 2 : an === "end" ? x - w : x, pd = o.plate ? 7 : 3;
    var b = [x0 - pd, y - z * 0.8 - pd + 1, x0 + w + pd, y + (lines.length - 1) * lh + z * 0.25 + pd - 1];
    if (t) {
      var ax, ay;
      if (o.from) { ax = o.from[0]; ay = o.from[1]; }
      else if (t[1] > b[3]) { ax = cl(t[0], b[0] + 10, b[2] - 10); ay = b[3]; }
      else if (t[1] < b[1]) { ax = cl(t[0], b[0] + 10, b[2] - 10); ay = b[1]; }
      else { ax = t[0] < b[0] ? b[0] : b[2]; ay = cl(t[1], b[1] + 4, b[3] - 4); }
      s += K("M" + n(ax) + " " + n(ay) + " L" + t[0] + " " + t[1], L, 1.2) + C(t[0], t[1], 1.8, L, 0);
    }
    if (o.plate !== false) s += R(b[0], b[1], b[2] - b[0], b[3] - b[1], SHEET, 1.6, 6, ' fill-opacity="' + (o.plate ? 1 : 0.88) + '"');
    lines.forEach(function (l, i) { s += txt(x, y + i * lh, l, { size: z, anchor: an, fill: (o.fills && o.fills[i]) || o.fill }); });
    return s;
  }
  function note(x, y, w, h, lines, o) {
    o = o || {};
    var s = '<g transform="rotate(' + (o.rot || 0) + " " + (x + w / 2) + " " + (y + h / 2) + ')">' + R(x, y, w, h, o.fill || NOTE, 2, 3);
    if (o.tape) s += R(x + w / 2 - 16, y - 6, 32, 12, "rgba(156,203,234,.8)", 0, 0, ' stroke="rgba(74,46,30,.4)" stroke-width="1.2" transform="rotate(3 ' + (x + w / 2) + " " + y + ')"');
    lines.forEach(function (ln, i) { s += txt(x + 9, y + 20 + i * 18, ln, { size: o.size || 15, sign: i === 0 && o.head, fill: o.ink }); });
    return s + "</g>";
  }
  function bubble(x, y, w, h, tx, ty, o) {
    o = o || {};
    var s = R(x, y, w, h, SHEET, 2, 14), bx = cl(tx, x + 24, x + w - 24), by = ty > y + h ? y + h : y;
    if (o.thought) { for (var i = 1; i <= 3; i++) { var k = i / 4; s += C(bx + (tx - bx) * k, by + (ty - by) * k, 6 - i * 1.3, SHEET, 1.8); } }
    else s += P("M" + (bx - 9) + " " + (by + (ty > by ? -1.5 : 1.5)) + " L" + tx + " " + ty + " L" + (bx + 9) + " " + (by + (ty > by ? -1.5 : 1.5)), SHEET, 2);
    return s;
  }
  function wrap(id, title, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + title + '"><title>' + title + '</title><rect width="960" height="400" fill="' + WALL + '"/>' +
      '<g stroke-linejoin="round" stroke-linecap="round">' + inner + "</g></svg>";
  }

  /* ---------- the shop ---------- */
  // Back wall with a wainscot and a plank floor from y = fy down.
  function room(fy, o) {
    o = o || {};
    var s = R(-5, -5, 970, fy + 5, o.wall || WALL, 0) + R(-5, fy - 46, 970, 46, WALL2, 0) + K("M-5 " + (fy - 46) + " H965", L, 2) + K("M-5 " + (fy - 40) + " H965", "#D5C29C", 2);
    for (var x = 30; x < 960; x += 64) s += K("M" + x + " " + (fy - 44) + " v40", "#D5C29C", 1.5);
    s += R(-5, fy, 970, 410 - fy, FLOOR, 2.5);
    var d = ""; for (x = -40; x < 980; x += 92) d += "M" + x + " " + fy + " L" + (x - 30) + " 400 ";
    s += K(d + "M-5 " + (fy + (400 - fy) * 0.45) + " H965", "#B0844F", 1.6);
    return s;
  }
  function frameShelf(x, y, w) {   // a wall shelf of spectacle frames for sale
    var s = R(x, y, w, 8, WOOD, 2, 2) + K("M" + (x + 10) + " " + (y + 8) + " l6 12 M" + (x + w - 10) + " " + (y + 8) + " l-6 12", L, 2.5);
    var cols = [BRICK, BLUE, INK, GRASS, LILAC, SHOP];
    for (var i = 0; i < Math.floor((w - 10) / 44); i++) { var cx = x + 26 + i * 44, c = cols[i % cols.length]; s += C(cx - 9, y - 9, 8, MINT, 2.4, ' stroke="' + c + '"') + C(cx + 9, y - 9, 8, MINT, 2.4, ' stroke="' + c + '"') + K("M" + (cx - 1.5) + " " + (y - 10) + " h3", c, 2.4); }
    return s;
  }
  function snellen(x, y) {   // the old-fashioned letter chart, for colour
    var s = R(x, y, 64, 92, SHEET, 2, 3) + txt(x + 32, y + 30, "E", { size: 26, sign: true, anchor: "middle", fill: INK }) + txt(x + 32, y + 52, "F P", { size: 15, sign: true, anchor: "middle", fill: INK }) +
      txt(x + 32, y + 68, "T O Z", { size: 11, sign: true, anchor: "middle", fill: INK }) + txt(x + 32, y + 81, "L P E D", { size: 8, sign: true, anchor: "middle", fill: INK });
    return s + C(x + 32, y - 2, 2.5, BRICK, 1.2);
  }
  function lampDesk(x, y) { return K("M" + x + " " + y + " l-14 -36 l26 -20", L, 3.5) + P("M" + (x + 6) + " " + (y - 62) + " l22 -6 l6 16 l-22 10 z", SHOP, 2) + E(x, y, 14, 4, SHOPD, 2); }
  function plant(x, y) { return R(x - 14, y - 26, 28, 26, BRICK, 2, 3) + P("M" + x + " " + (y - 26) + " q-18 -28 -6 -46 M" + x + " " + (y - 26) + " q16 -24 8 -44 M" + x + " " + (y - 26) + " q2 -30 -2 -52", "none", 0, ' stroke="' + GRASS + '" stroke-width="5"'); }
  function desk(x, y, w, h) { return R(x, y, w, 12, WOOD, 2.5, 2) + R(x + 8, y + 12, 12, h - 12, WOOD, 2) + R(x + w - 20, y + 12, 12, h - 12, WOOD, 2) + R(x + w * 0.45, y + 12, w * 0.45 - 20, 34, "#A86C35", 2, 2) + C(x + w * 0.675, y + 29, 2.5, L, 0); }

  /* ---------- the cast ---------- */
  // Microduck: a small yellow robot duck with a camera for an eye. (x, y) = feet; faces right; o.sit hides the legs;
  // o.glasses adds a new pair of round spectacles; o.turn adds a head-turn arc.
  function duck(x, y, sc, o) {
    o = o || {}; sc = sc || 1;
    var s = "";
    if (!o.sit) s += K("M-6 -12 v12 M12 -12 v12", BILL, 4) + P("M-14 0 h14 l-2 -4 h-10 z M4 0 h16 l-2 -4 h-12 z", BILL, 1.6);
    s += P("M-34 -40 l-16 -16 l6 22 z", DUCK, 2);
    s += E(0, -30, 36, 24, DUCK, 2.5) + K("M-14 -32 q14 10 30 -2", L, 1.8) + C(-4, -16, 4.5, STEEL, 1.6) + C(14, -16, 4.5, STEEL, 1.6);
    s += R(12, -70, 20, 30, DUCK, 0) + K("M12 -66 v24 M32 -66 v20", L, 2.5);
    s += C(24, -80, 27, DUCK, 2.5) + K("M6 -96 q-6 -10 2 -16", L, 2);
    s += P("M46 -84 q16 2 24 8 q-10 6 -24 4 z", BILL, 2) + K("M50 -77 h16", L, 1.4);
    s += C(34, -86, 10, EYE, 2.2) + C(34, -86, 6.5, EYE2, 1.4) + C(34, -86, 3.2, EYE3, 0) + C(31.5, -88.5, 1.6, SHEET, 0);
    if (o.glasses) s += C(34, -86, 13, "none", 3, ' stroke="' + INK + '"') + K("M47 -88 q4 -2 6 0 M21 -88 l-12 -4", INK, 2.6) + C(34, -86, 13, MINT, 0, ' fill-opacity=".25"');
    if (o.cheek !== false) s += C(16, -70, 3.2, "#E79C86", 0, ' opacity=".6"');
    return G("translate(" + n(x) + " " + n(y) + ") scale(" + sc + ")", s + (o.extra || ""));
  }
  // A rounded Busytown person, about 75 tall at scale 1; (x, y) = feet centre. lh / rh = hand offsets from the hip.
  // o.coat: an optician's white coat; o.specs: round glasses; o.mirror: a head mirror on a band.
  function person(x, y, o) {
    o = o || {};
    var sk = o.skin || SKIN, sh = o.shirt || SKY, pc = o.pants || "#59606A", hip = y - (o.sit ? 12 : 22), s = "", top = hip - 28, hy = top - 12;
    if (!o.noLegs) s += R(x - 10, hip, 8, y - hip, pc, 2, 3) + R(x + 2, hip, 8, y - hip, pc, 2, 3) + E(x - 7, y, 6, 3, L, 0) + E(x + 7, y, 6, 3, L, 0);
    if (o.coat) s += P("M" + (x - 15) + " " + top + " h30 l3 " + (36 + (o.sit ? 0 : 10)) + " h-36 z", SHEET, 2) + K("M" + x + " " + (top + 4) + " v" + (32 + (o.sit ? 0 : 10)), L, 1.4) + R(x + 4, top + 16, 8, 6, MINT, 1.2, 1);
    else s += R(x - 14, top, 28, 32, sh, 2, 9);
    if (o.coat) s += P("M" + (x - 6) + " " + top + " L" + x + " " + (top + 11) + " L" + (x + 6) + " " + top + " z", sh, 1.5);
    var sy = top + 6, lh = [x + (o.lh ? o.lh[0] : -24), hip + (o.lh ? o.lh[1] : -10)], rh = [x + (o.rh ? o.rh[0] : 24), hip + (o.rh ? o.rh[1] : -10)], arm = o.coat ? SHEET : sh;
    [[x - 13, lh], [x + 13, rh]].forEach(function (a) { var d = "M" + a[0] + " " + sy + " L" + n(a[1][0]) + " " + n(a[1][1]); s += K(d, L, 7) + K(d, arm, 3.5); });
    s += C(lh[0], lh[1], 4, sk, 1.5) + C(rh[0], rh[1], 4, sk, 1.5);
    s += C(x, hy, 13, sk, 2) + C(x - 4, hy - 1, 1.6, L, 0) + C(x + 4, hy - 1, 1.6, L, 0) + C(x - 8, hy + 3, 2.4, "#E79C86", 0, ' opacity=".6"') + C(x + 8, hy + 3, 2.4, "#E79C86", 0, ' opacity=".6"');
    var m = o.mouth;
    s += m === "o" ? E(x, hy + 6, 2.2, 2.8, L, 0) : m === "flat" ? K("M" + (x - 3) + " " + (hy + 6) + " h6", L, 1.5) : K("M" + (x - 4) + " " + (hy + 4) + " q4 3.5 8 0", L, 1.5);
    if (o.stache) s += P("M" + (x - 6) + " " + (hy + 4) + " q3 -3 6 0 q3 -3 6 0 q-6 3 -12 0 z", L, 0);
    if (o.hair) s += P("M" + (x - 13) + " " + (hy - 2) + " a13 13 0 0 1 26 0 v-2 a13 13 0 0 0 -26 0 z", o.hair, 1.5);
    if (o.bun) s += C(x - 9, hy - 12, 6, o.hair || L, 1.5);
    if (o.specs) s += C(x - 4.5, hy - 1, 4, "none", 1.4) + C(x + 4.5, hy - 1, 4, "none", 1.4) + K("M" + (x - 0.5) + " " + (hy - 1) + " h1", L, 1.4);
    if (o.mirror) s += K("M" + (x - 13) + " " + (hy - 6) + " q13 -6 26 0", STEEL, 3) + C(x, hy - 11, 5.5, MINT, 1.6) + C(x, hy - 11, 1.6, L, 0);
    return s;
  }
  function scaleAt(x, y, sc, inner) { return G("translate(" + x + " " + y + ") scale(" + sc + ") translate(" + (-x) + " " + (-y) + ")", inner); }
  // The exam chair: a tall barber-style chair, upholstered, on a pole. (x, y) = floor under the pole; the seat top is at y − 70.
  function chair(x, y) {
    return R(x - 34, y - 8, 68, 8, STEEL, 2, 3) + R(x - 5, y - 58, 10, 50, STEEL, 2) + R(x - 50, y - 74, 100, 16, BRICK, 2.5, 6) +
      R(x - 62, y - 168, 18, 104, BRICK, 2.5, 7) + R(x - 66, y - 186, 26, 24, BRICK, 2.5, 8) + R(x + 34, y - 92, 26, 8, STEEL, 2, 3) + K("M" + (x + 40) + " " + (y - 84) + " v14", L, 3) +
      K("M" + (x + 46) + " " + (y - 58) + " l14 28 h22", L, 3.5);
  }
  // The lens dial (a phoropter): two lens windows in a teal body, knobs and a numbered wheel. (x, y) = its middle.
  function phoropter(x, y, sc, o) {
    o = o || {};
    var s = R(-66, -24, 132, 48, SHOP, 2.5, 18) + R(-8, -18, 16, 30, SHOPD, 2, 4);
    [-36, 36].forEach(function (cx) { s += C(cx, 0, 17, STEEL, 2.2) + C(cx, 0, 12, o.lit ? NOTE : MINT, 1.8); });
    s += C(0, -32, 13, SHEET, 2.2) + K("M0 -42 v4 M0 -26 v4 M-10 -32 h4 M6 -32 h4", L, 1.5) + K("M0 -32 l6 -6", BAD, 2.4) + C(0, -32, 2, L, 0);
    s += C(-58, -26, 5, SHEET, 1.8) + C(58, -26, 5, SHEET, 1.8) + R(-74, -6, 8, 12, SHOPD, 1.8, 2) + R(66, -6, 8, 12, SHOPD, 1.8, 2);
    if (o.labels) s += txt(-36, 4.5, "1", { size: 13, sign: true, anchor: "middle" }) + txt(36, 4.5, "2", { size: 13, sign: true, anchor: "middle" });
    return G("translate(" + n(x) + " " + n(y) + ") scale(" + (sc || 1) + ")", s);
  }
  // The eye chart: a checkerboard on a white board, drawn in the quad q = [TL, TR, BR, BL] (bilinear, close enough to
  // perspective for a picture). 10 × 7 squares, so 9 × 6 inner corners; o.dots marks the inner corners.
  function bil(q, u, v) { return [(1 - v) * ((1 - u) * q[0][0] + u * q[1][0]) + v * ((1 - u) * q[3][0] + u * q[2][0]), (1 - v) * ((1 - u) * q[0][1] + u * q[1][1]) + v * ((1 - u) * q[3][1] + u * q[2][1])]; }
  function checker(q, o) {
    o = o || {};
    var m = 0.07, s = poly(q, SHEET, 2.2), cols = 10, rows = 7, d = "";
    for (var a = 0; a < cols; a++) for (var b = 0; b < rows; b++) if ((a + b) % 2 === 0) {
      var u0 = m + (1 - 2 * m) * a / cols, u1 = m + (1 - 2 * m) * (a + 1) / cols, v0 = m + (1 - 2 * m) * b / rows, v1 = m + (1 - 2 * m) * (b + 1) / rows;
      var p = [bil(q, u0, v0), bil(q, u1, v0), bil(q, u1, v1), bil(q, u0, v1)];
      d += "M" + p.map(function (z) { return n(z[0]) + " " + n(z[1]); }).join(" L") + " Z ";
    }
    s += '<path d="' + d + '" fill="' + INK + '"/>';
    if (o.dots) for (a = 1; a < cols; a++) for (b = 1; b < rows; b++) { var pt = bil(q, m + (1 - 2 * m) * a / cols, m + (1 - 2 * m) * b / rows); s += C(pt[0], pt[1], o.dotR || 2.4, o.dotCol || BAD, 0); }
    if (o.grid) { var g = ""; for (a = 0; a <= cols; a++) { var p0 = bil(q, m + (1 - 2 * m) * a / cols, m), p1 = bil(q, m + (1 - 2 * m) * a / cols, 1 - m); g += "M" + n(p0[0]) + " " + n(p0[1]) + " L" + n(p1[0]) + " " + n(p1[1]) + " "; } for (b = 0; b <= rows; b++) { p0 = bil(q, m, m + (1 - 2 * m) * b / rows); p1 = bil(q, 1 - m, m + (1 - 2 * m) * b / rows); g += "M" + n(p0[0]) + " " + n(p0[1]) + " L" + n(p1[0]) + " " + n(p1[1]) + " "; } s += K(g, o.grid, 1.4, ' stroke-dasharray="4 3"'); }
    return s;
  }
  // The chart bent by a barrel lens: centred at (cx, cy), half-size (hw, hh), squares sampled along their edges.
  function bent(cx, cy, hw, hh, k, o) {
    o = o || {};
    var R0 = Math.hypot(hw, hh);
    function f(x, y) { var u = (x - cx) / R0, v = (y - cy) / R0, r2 = u * u + v * v, s = 1 + k * r2; return [cx + u * s * R0, cy + v * s * R0]; }
    function quad(x0, y0, x1, y1) { var pts = [], N = 6, i; for (i = 0; i <= N; i++) pts.push(f(x0 + (x1 - x0) * i / N, y0)); for (i = 1; i <= N; i++) pts.push(f(x1, y0 + (y1 - y0) * i / N)); for (i = 1; i <= N; i++) pts.push(f(x1 - (x1 - x0) * i / N, y1)); for (i = 1; i < N; i++) pts.push(f(x0, y1 - (y1 - y0) * i / N)); return "M" + pts.map(function (p) { return n(p[0]) + " " + n(p[1]); }).join(" L") + " Z "; }
    var s = P(quad(cx - hw, cy - hh, cx + hw, cy + hh), SHEET, 2), d = "", cols = 10, rows = 7, mx = hw * 0.07 * 2, my = hh * 0.07 * 2, x0 = cx - hw + mx, y0 = cy - hh + my, sw = (2 * hw - 2 * mx) / cols, sh = (2 * hh - 2 * my) / rows;
    for (var a = 0; a < cols; a++) for (var b = 0; b < rows; b++) if ((a + b) % 2 === 0) d += quad(x0 + a * sw, y0 + b * sh, x0 + (a + 1) * sw, y0 + (b + 1) * sh);
    s += '<path d="' + d + '" fill="' + INK + '"/>';
    if (o.straight) s += R(cx - hw, cy - hh, 2 * hw, 2 * hh, "none", 0, 0, ' stroke="' + BLUE + '" stroke-width="2" stroke-dasharray="5 4"');
    return s;
  }
  // A photo of the chart: a polaroid, rotated, with a small chart inside in quad shape `q` (given in 0..1 of the window).
  function polaroid(x, y, w, h, rot, q, o) {
    o = o || {};
    var iw = w - 10, ih = h - 22, s = R(x, y, w, h, SHEET, 2, 2) + R(x + 5, y + 5, iw, ih, "#E9E2D2", 1.4);
    s += checker(q.map(function (p) { return [x + 5 + p[0] * iw, y + 5 + p[1] * ih]; }));
    if (o.pin) s += C(x + w / 2, y + 2, 3.5, o.pin, 1.4);
    if (o.cap) s += txt(x + w / 2, y + h - 6, o.cap, { size: 11, anchor: "middle" });
    if (o.tick) s += txt(x + w - 6, y + h - 5, o.tick, { size: 13, sign: true, anchor: "end", fill: o.tickCol || GRASS });
    return G("rotate(" + rot + " " + (x + w / 2) + " " + (y + h / 2) + ")", s);
  }
  var QA = [[0.18, 0.2], [0.78, 0.12], [0.84, 0.86], [0.12, 0.8]], QB = [[0.12, 0.1], [0.86, 0.24], [0.8, 0.9], [0.2, 0.78]], QC = [[0.25, 0.14], [0.9, 0.18], [0.72, 0.88], [0.08, 0.82]], QF = [[0.2, 0.18], [0.8, 0.18], [0.8, 0.82], [0.2, 0.82]];
  // The prescription card. lines: [label, value] pairs (value "" for a blank).
  function rxcard(x, y, w, h, lines, o) {
    o = o || {};
    var s = R(x, y, w, h, SHEET, 2.4, 4) + R(x, y, w, 22, SHOP, 2.4, 4) + txt(x + 10, y + 16, "&#8478; PRESCRIPTION", { size: 12, sign: true, fill: PAPER, ls: 0.5 });
    lines.forEach(function (ln, i) {
      var yy = y + 40 + i * 17;
      s += txt(x + 10, yy, ln[0], { size: 14, sign: true }) + K("M" + (x + 38) + " " + (yy + 2) + " H" + (x + w - 10), "#9CB8C9", 1.2);
      if (ln[1]) s += txt(x + w - 12, yy - 1, ln[1], { size: 14, anchor: "end", fill: BLUE });
    });
    return o.rot ? G("rotate(" + o.rot + " " + (x + w / 2) + " " + (y + h / 2) + ")", s) : s;
  }
  function magnifier(x, y, r, ang) { return G("rotate(" + (ang || 0) + " " + x + " " + y + ")", R(x - 4, y + r - 2, 8, r * 1.4, WOOD, 2, 3) + C(x, y, r, MINT, 3, ' fill-opacity=".55"') + K("M" + (x - r * 0.5) + " " + (y - r * 0.3) + " q" + r * 0.3 + " " + -r * 0.4 + " " + r * 0.6 + " " + -r * 0.35, SHEET, 2.5)); }
  function chalkboard(x, y, w, h) { return R(x - 7, y - 7, w + 14, h + 14, WOOD, 2.5, 6) + R(x, y, w, h, CHALK, 2, 2) + R(x + w * 0.3, y + h + 5, w * 0.3, 6, WOOD, 1.8, 2); }
  function chalkTxt(x, y, s, size, o) { o = o || {}; return txt(x, y, s, { size: size || 15, fill: o.fill || "#F3F1E6", anchor: o.anchor, sign: o.sign }); }
  function envelope(x, y, w, h, rot, col) { return G("rotate(" + rot + " " + (x + w / 2) + " " + (y + h / 2) + ")", R(x, y, w, h, col || SAND, 2.2, 2) + P("M" + x + " " + y + " L" + (x + w / 2) + " " + (y + h * 0.55) + " L" + (x + w) + " " + y, "none", 2) + C(x + w / 2, y + h * 0.55, 6, BRICK, 1.6)); }
  function door(x, y, w, h) { return R(x, y, w, h, SHOP, 2.5, 3) + R(x + 10, y + 12, w - 20, h * 0.45, SKY, 2, 2) + K("M" + (x + w / 2) + " " + (y + 12) + " v" + h * 0.45, L, 1.6) + C(x + w - 14, y + h * 0.6, 3.5, YEL, 1.5); }

  /* ---------- scenes ---------- */
  var scenes = {};
  scenes.s0 = function () {
    var s = room(352);
    s += snellen(872, 70) + frameShelf(618, 112, 200) + plant(930, 360);
    // the views pinned up
    s += polaroid(392, 92, 50, 58, -6, QA, { pin: BRICK }) + polaroid(452, 86, 50, 58, 4, QB, { pin: BLUE }) + polaroid(512, 94, 50, 58, -3, QC, { pin: GRASS });
    // the lens dial, swung up on its arm
    s += K("M150 392 V122 H246", L, 6) + K("M150 392 V122 H246", STEEL, 3) + R(130, 384, 40, 10, STEEL, 2, 3) + K("M246 122 v12", L, 4) + phoropter(262, 150, 0.62);
    // the chair and the duck
    s += chair(272, 392) + duck(262, 330, 1.05, { sit: true });
    // sight lines to the chart
    s += K("M298 241 L506 252 M298 241 L504 349", BLUE, 1.6, ' stroke-dasharray="3 5"');
    // the chart, held up by the optician
    s += checker([[506, 248], [604, 262], [602, 344], [504, 352]]);
    s += scaleAt(652, 392, 1.72, person(652, 392, { coat: true, specs: true, mirror: true, shirt: SKY, hair: "#7A5A48", lh: [-27, -50], rh: [-27, -14], mouth: "o", pants: "#4F5560" }));
    // the desk and the blank prescription card
    s += desk(752, 300, 190, 92) + lampDesk(900, 300) + rxcard(770, 214, 118, 84, [["fx", ""], ["cx", ""], ["k1", ""]]);
    s += board(330, 8, 300, "THE EXAM ROOM");
    s += label(18, 196, ["the duck = the camera", "being calibrated"], [250, 230]);
    s += label(18, 96, ["the lens dial", "= distortion (k1, k2)"], [222, 150]);
    s += label(477, 72, "each photo = one view", [477, 88], { anchor: "middle" });
    s += label(470, 222, ["the eye chart = a checkerboard,", "9 × 6 corners, 25 mm squares"], [548, 262], { anchor: "middle" });
    s += label(718, 200, ["the prescription card", "= K, still blank"], [790, 230], { anchor: "end" });
    s += label(330, 384, "the optician = Zhang's method", [624, 368]);
    return wrap("s0", "Inside a Busytown optician's shop. Microduck, a small yellow robot duck with a camera for an eye, sits in a red exam chair. The optician, in a white coat with round glasses and a head mirror, holds up a black-and-white checkerboard eye chart at an angle while the duck looks at it. A lens dial on an arm is swung up out of the way. Three photos of the chart at different angles are pinned on the wall, and on the desk a prescription card stands blank.", s);
  };
  scenes.s1 = function () {
    var s = room(352);
    s += frameShelf(40, 96, 150) + snellen(866, 66);
    // the big desk with the photo and the tracing card over it
    s += R(150, 214, 640, 14, WOOD, 2.5, 3) + R(170, 228, 16, 164, WOOD, 2) + R(754, 228, 16, 164, WOOD, 2);
    s += polaroid(214, 98, 190, 150, -3, [[0.16, 0.22], [0.82, 0.1], [0.88, 0.88], [0.1, 0.8]], {});
    // the tracing card: the same grid traced onto a translucent sheet, slid to the right
    s += G("rotate(2 520 160)", R(430, 96, 190, 140, "#FFFFFF", 1.8, 2, ' fill-opacity=".72"') + checker([[460, 122], [592, 112], [600, 214], [452, 202]], { grid: BLUE }).replace(/fill="#2B2522"/, 'fill="none"').replace(/fill="#FFFDF6"/, 'fill="none"'));
    s += txt(528, 230, "H = K [r1 r2 t]", { size: 14, sign: true, anchor: "middle", fill: BLUE });
    s += K("M412 170 q14 -12 30 0", L, 2) + P("M440 166 l6 5 -8 2 z", L, 0);
    // the assistant with the magnifier over the corners
    s += R(286, 340, 92, 14, WOOD, 2.5, 3) + K("M296 354 l-6 38 M368 354 l6 38 M292 374 h80", L, 4);
    s += scaleAt(332, 340, 1.6, person(332, 340, { shirt: LILAC, skin: SKIN3, hair: L, bun: true, lh: [-28, -62], rh: [24, -66], mouth: "o" }));
    s += magnifier(306, 170, 22, 30);
    // a ruler and the corner list
    s += R(640, 240, 120, 12, NOTE, 2, 2) + K("M650 240 v5 M662 240 v3 M674 240 v5 M686 240 v3 M698 240 v5 M710 240 v3 M722 240 v5 M734 240 v3 M746 240 v5", L, 1.4);
    s += note(800, 150, 140, 118, ["corners (mm)", "(0, 0)", "(25, 0)", "(50, 0) …", "54 in all"], { rot: 3, tape: true, size: 14, head: true });
    s += R(630, 288, 120, 46, SHEET, 2, 4) + phoropter(690, 318, 0.32) + txt(690, 346, "DIAL AT 0", { size: 11, sign: true, anchor: "middle", fill: BAD });
    s += board(330, 8, 300, "ONE PHOTO");
    s += label(30, 196, ["the magnifier = the", "corner detector"], [288, 176]);
    s += label(520, 72, ["the tracing card = a homography H,", "8 numbers for this one photo"], [520, 112], { anchor: "middle" });
    s += label(870, 302, ["the chart's corners,", "known in mm"], [868, 262], { anchor: "middle" });
    s += label(612, 300, ["steps 1–3: the lens", "dial set to 0"], [632, 312], { anchor: "end" });
    return wrap("s1", "At the optician's desk. A photo of the tilted checkerboard lies on the desk; beside it a sheet of tracing paper carries the same grid, traced, labelled H = K [r1 r2 t]. An assistant leans in with a magnifying glass over the photo's corners. A sticky note lists the chart's corners in millimetres, and a small sign shows the lens dial set to zero.", s);
  };
  scenes.s2 = function () {
    var s = room(352);
    // the clue tally on a chalkboard
    s += chalkboard(250, 66, 380, 200);
    s += chalkTxt(268, 96, "unknowns in B: 6 − 1 (scale) = 5", 17, { sign: true });
    s += chalkTxt(268, 126, "each photo: r1 ⊥ r2, |r1| = |r2|", 15) + chalkTxt(268, 146, "= 2 clues", 15, { fill: YEL });
    var ys = [180, 206, 232];
    [["1 photo", "| |", "2 < 5"], ["2 photos", "| | | |", "4 < 5"], ["3 photos", "| | | | | |", "6 ≥ 5 ✓"]].forEach(function (r, i) { s += chalkTxt(270, ys[i], r[0], 15) + chalkTxt(372, ys[i], r[1], 17, { fill: YEL }) + chalkTxt(612, ys[i], r[2], 15, { anchor: "end", fill: i === 2 ? "#BFE3A6" : "#F4B7A7" }); });
    // three tilted photos pinned on the left, each with its two clue ticks
    s += polaroid(40, 80, 64, 74, -5, QA, { pin: BRICK, tick: "✓✓" }) + polaroid(122, 96, 64, 74, 4, QB, { pin: BLUE, tick: "✓✓" }) + polaroid(64, 178, 64, 74, 2, QC, { pin: GRASS, tick: "✓✓" });
    // the pile of square-on photos on the right: all the same clues
    for (var i = 0; i < 4; i++) s += polaroid(704 + i * 8, 98 + i * 10, 64, 74, -6 + i * 4, QF, { tick: i === 3 ? "✓✓" : "", tickCol: BAD });
    // the duck waiting, the optician at the board
    s += chair(842, 392) + duck(832, 330, 0.95, { sit: true });
    s += scaleAt(470, 392, 1.6, person(470, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", rh: [28, -66], lh: [-18, -6], pants: "#4F5560" })) + R(510, 270, 14, 6, SHEET, 1.4, 2);
    s += board(330, 8, 300, "TWO CLUES PER PHOTO");
    s += label(30, 296, ["tilted every which way:", "2 new clues each"], [96, 250]);
    s += label(650, 300, ["square-on photos repeat", "the same 2 clues"], [738, 210], { anchor: "end" });
    return wrap("s2", "The optician stands at a chalkboard tallying clues: B has five unknowns after removing scale; each photo gives two clues because a rotation's first two columns are perpendicular and equally long; one photo gives 2, two photos 4, three photos 6, which is enough. Three tilted photos are pinned on the left, each ticked twice. On the right a pile of square-on photos is marked: the same two clues again. The duck waits in its chair.", s);
  };
  scenes.s3 = function () {
    var s = room(352);
    // the floor plan: where each chart was, seen from above
    s += R(40, 70, 260, 200, SHEET, 2.4, 4) + txt(54, 92, "WHERE THE CHART WAS", { size: 12, sign: true, fill: SHOPD }) + txt(54, 108, "(seen from above)", { size: 13 });
    s += P("M170 252 L80 130 M170 252 L260 130", "none", 0, ' stroke="' + SHOP + '" stroke-width="1.6" stroke-dasharray="4 4"') + R(158, 248, 24, 14, SHOP, 2, 3);
    [[96, 150, 140, 136], [150, 132, 196, 150], [206, 166, 248, 152], [124, 190, 168, 206]].forEach(function (c, i) { s += K("M" + c[0] + " " + c[1] + " L" + c[2] + " " + c[3], [BRICK, BLUE, GRASS, LILAC][i], 5) + K("M170 252 L" + n((c[0] + c[2]) / 2) + " " + n((c[1] + c[3]) / 2), "#B9A58E", 1.2, ' stroke-dasharray="2 3"'); });
    // the desk with the optician writing the card
    s += desk(360, 290, 380, 102);
    s += rxcard(452, 168, 190, 120, [["fx", "1061.8"], ["fy", "1062.2"], ["cx", "596.8"], ["cy", "474.5"]], { rot: -2 });
    s += scaleAt(700, 392, 1.65, person(700, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", lh: [-44, -36], rh: [-10, -30], pants: "#4F5560", mouth: "flat" }));
    s += K("M598 276 l32 24", L, 5) + K("M598 276 l32 24", BLUE, 2.5) + P("M594 273 l6 1 -2 4 z", L, 0);
    // the clue page it's reading from
    s += note(372, 196, 70, 86, ["V b = 0", "→ B", "→ K"], { rot: -6, size: 15, head: true });
    s += chair(866, 392) + duck(858, 330, 0.9, { sit: true });
    s += board(330, 8, 300, "THE PRESCRIPTION");
    s += label(170, 300, ["each photo's pose from K⁻¹H", "= the extrinsics"], [170, 262], { anchor: "middle" });
    s += label(548, 84, ["K straight out of B: the", "closed form, no guessing"], [548, 166], { anchor: "middle" });
    s += label(470, 384, "the clue page: V b = 0, solved by SVD", [404, 280], { anchor: "middle" });
    return wrap("s3", "The optician writes the prescription card at the desk, reading from a page of clues that says V b = 0, then B, then K. The card shows fx, fy, cx and cy filled in. On the wall, a floor plan seen from above shows the camera at the bottom and four short coloured lines where the chart stood in each photo: the extrinsics.", s);
  };
  scenes.s4 = function () {
    var s = room(352);
    // the duck in the chair with the lens dial swung down in front of its eye
    s += K("M120 392 V112 H256", L, 6) + K("M120 392 V112 H256", STEEL, 3) + R(100, 384, 40, 10, STEEL, 2, 3) + K("M256 112 v80", L, 4) + K("M256 112 v80", STEEL, 1.6);
    s += chair(232, 392) + duck(222, 330, 1.05, { sit: true }) + phoropter(270, 236, 0.7, { lit: true });
    // what the duck sees through the dial: the chart, bent
    s += bubble(394, 64, 300, 214, 300, 210, { thought: true });
    s += bent(544, 170, 118, 78, -0.32, { straight: true });
    s += txt(544, 270, "straight edges, bowed out: barrel", { size: 14, anchor: "middle" });
    // the optician turning the k1 knob
    s += scaleAt(780, 392, 1.65, person(780, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", lh: [-40, -42], rh: [20, -12], pants: "#4F5560" }));
    s += C(700, 300, 26, SHEET, 2.5) + K("M700 278 v6 M722 300 h-6 M678 300 h6 M700 322 v-6", L, 1.6) + K("M700 300 l-14 -12", BAD, 3) + C(700, 300, 3, L, 0) + txt(700, 342, "k1", { size: 16, sign: true, anchor: "middle" }) + txt(666, 288, "−", { size: 18, sign: true, anchor: "middle", fill: BAD }) + txt(734, 288, "+", { size: 16, sign: true, anchor: "middle" });
    s += board(330, 8, 300, "THE LENS DIAL");
    s += label(18, 76, ["the lens dial", "= the distortion model"], [244, 222]);
    s += label(544, 300, "k1 < 0 = barrel: the edges pulled in", [612, 282], { anchor: "middle" });
    s += label(870, 84, ["dashed: where a", "pinhole would", "put the edges"], [664, 108], { anchor: "middle" });
    return wrap("s4", "The duck sits in the exam chair with the lens dial swung down in front of its camera eye. A thought bubble shows what it sees: the checkerboard chart with its straight edges bowed outwards like a barrel, with a dashed rectangle where a pinhole would put the edges. The optician turns a knob marked k1 towards minus.", s);
  };
  scenes.s5 = function () {
    var s = room(352);
    s += chair(232, 392) + duck(222, 330, 1.05, { sit: true }) + K("M120 392 V112 H256", L, 6) + K("M120 392 V112 H256", STEEL, 3) + R(100, 384, 40, 10, STEEL, 2, 3) + K("M256 112 v80", L, 4) + phoropter(270, 236, 0.7, { labels: true });
    s += bubble(300, 74, 196, 62, 286, 196, {}) + txt(398, 100, "Better one…", { size: 18, anchor: "middle" }) + txt(398, 124, "or two?", { size: 18, anchor: "middle" });
    s += scaleAt(410, 392, 1.6, person(410, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", lh: [-44, -40], rh: [20, -14], pants: "#4F5560", mouth: "o" }));
    // the scoreboard: RMS falling
    s += chalkboard(560, 72, 196, 150) + chalkTxt(658, 98, "RMS, px", 15, { anchor: "middle", sign: true });
    var pts = [[580, 120], [602, 158], [624, 186], [646, 196], [668, 200], [690, 203], [712, 204], [734, 204]];
    s += K("M" + pts.map(function (p) { return p[0] + " " + p[1]; }).join(" L"), YEL, 3) + pts.map(function (p) { return C(p[0], p[1], 3, YEL, 0); }).join("");
    s += chalkTxt(586, 214, "18.9", 13) + chalkTxt(744, 196, "0.35", 13, { anchor: "end", fill: "#BFE3A6" });
    // the second opinion and the sealed answer key
    s += polaroid(800, 96, 56, 66, -4, QB, { pin: BRICK }) + polaroid(866, 104, 56, 66, 5, QC, { pin: BLUE });
    s += envelope(806, 252, 104, 64, -4, SAND) + txt(858, 304, "ANSWER KEY", { size: 11, sign: true, anchor: "middle", fill: BAD });
    s += board(300, 8, 360, "BETTER ONE, OR TWO?");
    s += label(456, 300, ["each flip = one", "Levenberg–Marquardt step"], [300, 236]);
    s += label(658, 260, ["the score = the", "reprojection RMS"], [658, 228], { anchor: "middle" });
    s += label(862, 206, ["second opinion:", "photos it never saw"], [862, 172], { anchor: "middle" });
    s += label(720, 362, ["sealed: only a lab", "has the answer key"], [810, 300], { anchor: "end" });
    return wrap("s5", "The optician flips the lens dial between two lenses, numbered 1 and 2, and asks: better one, or two? On a chalkboard a falling line shows the reprojection RMS dropping from 18.9 to 0.35 pixels. On the right, two extra photos pinned to the wall are the second opinion, photos the calibration never saw, and a sealed envelope marked answer key sits below them.", s);
  };
  scenes.s6 = function () {
    var s = room(352);
    s += door(816, 150, 104, 202) + K("M806 352 h124", L, 3);
    // the checklist
    s += R(40, 70, 230, 176, NOTE, 2.2, 4) + txt(56, 96, "A GOOD SESSION", { size: 13, sign: true, fill: SHOPD });
    ["10 or more photos", "tilted 20–50°", "chart in every corner", "sharp, sub-pixel corners", "checked on new photos"].forEach(function (t, i) { s += txt(58, 124 + i * 26, "✓", { size: 16, sign: true, fill: GRASS }) + txt(80, 124 + i * 26, t, { size: 16 }); });
    // the duck in its new glasses, turning to another duck
    s += duck(470, 352, 1.15, { glasses: true });
    s += duck(742, 352, 0.75, { cheek: true, extra: "" }).replace("translate(742 352) scale(0.75)", "translate(742 352) scale(-0.75 0.75)");
    s += K("M520 262 L708 300", BLUE, 2, ' stroke-dasharray="5 4"') + K("M520 262 L716 252", BAD, 2, ' stroke-dasharray="5 4"');
    s += P("M580 274 a62 62 0 0 0 -2 -16", "none", 0, ' stroke="' + BAD + '" stroke-width="2.5"') + txt(600, 236, "6°", { size: 18, sign: true, fill: BAD });
    // the receipt
    s += G("rotate(4 330 200)", R(286, 112, 120, 150, SHEET, 2, 3) + txt(346, 134, "THE BILL", { size: 12, sign: true, anchor: "middle", fill: SHOPD }) + txt(298, 160, "bad card:", { size: 14 }) + txt(394, 178, "6.2°", { size: 16, sign: true, anchor: "end", fill: BAD }) + txt(298, 204, "good card:", { size: 14 }) + txt(394, 222, "0.05°", { size: 16, sign: true, anchor: "end", fill: GRASS }) + txt(346, 248, "of head turn", { size: 13, anchor: "middle" }));
    s += scaleAt(170, 392, 1.5, person(170, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", rh: [26, -40], lh: [-22, -6], pants: "#4F5560" }));
    s += board(330, 8, 300, "THE FITTING");
    s += label(560, 382, "the bill: degrees of head turn", [600, 270], { anchor: "middle" });
    s += label(700, 72, ["a centred pinhole aims 6° off", "Microduck's real axis"], [700, 254], { anchor: "middle" });
    s += label(380, 290, ["new glasses = a", "calibrated camera"], [500, 266], { anchor: "end" });
    return wrap("s6", "Microduck, now wearing round glasses, stands in the shop and turns its head toward another duck by the door. A blue dashed sight line goes to the other duck and a red one goes about six degrees off. A receipt reads: the bill, bad card 6.2 degrees, good card 0.05 degrees of head turn. A checklist on the wall lists a good session: ten or more photos, tilted 20 to 50 degrees, the chart in every corner, sharp sub-pixel corners, checked on new photos.", s);
  };
  scenes.cap = function () {
    var s = room(352);
    s += R(34, 50, 892, 210, WOOD, 2.5, 6) + R(44, 60, 872, 190, CORK, 1.5);
    var d = ""; for (var i = 0; i < 120; i++) { var a = (i * 97.3) % 860, b = (i * 53.1) % 176; d += "M" + n(50 + a) + " " + n(66 + b) + " h2 "; } s += K(d, "#B98D5B", 2);
    function folder(x, title, sub, stamp, art) {
      return R(x, 72, 268, 166, NOTE, 2.2, 4) + C(x + 134, 75, 5, BRICK, 1.8) + txt(x + 14, 94, title, { size: 15, sign: true }) + R(x + 12, 102, 244, 98, "#E9E2D2", 2) + art(x + 12, 102) + txt(x + 14, 220, sub, { size: 14 }) +
        G("rotate(-7 " + (x + 212) + " 214)", R(x + 156, 202, 108, 24, NOTE, 0, 3, ' stroke="' + BAD + '" stroke-width="2"') + txt(x + 210, 219, stamp, { size: 13, sign: true, fill: BAD, anchor: "middle" }));
    }
    s += folder(58, "CASE 1 · THE FLAT-LANDER", "every photo square-on", "FLAT", function (x, y) {
      var q = function (dx, dy) { return [[x + dx, y + dy], [x + dx + 60, y + dy], [x + dx + 60, y + dy + 42], [x + dx, y + dy + 42]]; };
      return checker(q(16, 10)) + checker(q(96, 30)) + checker(q(170, 14)) + checker(q(60, 48));
    });
    s += folder(346, "CASE 2 · THE CORNER-BLIND", "it stayed in the middle", "CORNERS?", function (x, y) {
      return K("M" + (x + 6) + " " + (y + 6) + " h22 M" + (x + 6) + " " + (y + 6) + " v16 M" + (x + 238) + " " + (y + 6) + " h-22 M" + (x + 238) + " " + (y + 6) + " v16 M" + (x + 6) + " " + (y + 92) + " h22 M" + (x + 6) + " " + (y + 92) + " v-16 M" + (x + 238) + " " + (y + 92) + " h-22 M" + (x + 238) + " " + (y + 92) + " v-16", BAD, 3) +
        checker([[x + 100, y + 32], [x + 146, y + 30], [x + 148, y + 64], [x + 98, y + 66]]) + txt(x + 30, y + 52, "?", { size: 22, sign: true, fill: BAD }) + txt(x + 214, y + 52, "?", { size: 22, sign: true, fill: BAD });
    });
    s += folder(634, "CASE 3 · THE STRAIGHT-LINER", "the lens dial was left at 0", "NO LENS", function (x, y) {
      return bent(x + 122, y + 49, 70, 40, -0.38, { straight: true });
    });
    s += R(150, 300, 660, 10, WOOD, 0) + R(160, 310, 640, 36, SHOP, 2.2) + txt(480, 334, "diagnose · re-take or re-model · judge on new photos", { size: 18, sign: true, fill: PAPER, anchor: "middle" });
    s += duck(86, 392, 0.85, { glasses: true });
    s += scaleAt(880, 392, 1.25, person(880, 392, { coat: true, specs: true, mirror: true, hair: "#7A5A48", lh: [-26, -36], mouth: "flat", pants: "#4F5560" }));
    s += board(290, 8, 380, "THE REVIEW BOARD");
    return wrap("cap", "A cork board pins three case folders. The flat-lander: four photos of the chart, all square-on, stamped flat. The corner-blind: a small chart in the middle of an empty frame with question marks in the corners, stamped corners. The straight-liner: a bent checkerboard with a straight dashed outline where the lens model should have been, stamped no lens. Below, a sign reads diagnose, re-take or re-model, judge on new photos; the duck in glasses and the optician study the board.", s);
  };

  /* ---------- icons: 64 × 64, flat fills, 3.5px line ---------- */
  var sk = ' stroke="' + L + '" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
  function ic(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + inner + "</svg>"; }
  function f(c) { return ' fill="' + c + '"' + sk; }
  function ln(c, w) { return ' fill="none" stroke="' + (c || L) + '" stroke-width="' + (w || 3.5) + '" stroke-linecap="round" stroke-linejoin="round"'; }
  var chk = '<rect x="6" y="12" width="52" height="40" rx="3"' + f(SHEET) + '/><path d="M12 18h10v9H12zM32 18h10v9H32zM22 27h10v9H22zM42 27h10v9H42zM12 36h10v9H12zM32 36h10v9H32z" fill="' + INK + '"/>';
  var icons = {
    eye: ic('<circle cx="32" cy="32" r="24"' + f(EYE) + '/><circle cx="32" cy="32" r="15"' + f(EYE2) + '/><circle cx="32" cy="32" r="7" fill="' + EYE3 + '"/><circle cx="27" cy="27" r="3.5" fill="' + SHEET + '"/>'),
    chart: ic(chk),
    trace: ic('<rect x="4" y="14" width="40" height="40" rx="3"' + f(SHEET) + '/><path d="M10 22h9v8h-9zM28 22h9v8h-9zM19 30h9v8h-9zM10 38h9v8h-9zM28 38h9v8h-9z" fill="' + INK + '"/><rect x="20" y="6" width="40" height="40" rx="3" fill="#FFFFFF" fill-opacity=".7"' + sk + '/><path d="M26 14 L54 12 M26 24 L55 22 M27 34 L55 33 M33 12 L34 42 M44 11 L45 42"' + ln(BLUE, 2.4) + "/>"),
    tally: ic('<rect x="4" y="8" width="56" height="42" rx="3"' + f(CHALK) + '/><path d="M14 18v20M21 18v20M30 18v20M37 18v20"' + ln("#F3F1E6", 3.5) + '/><path d="M46 34l5 5 8-12"' + ln(YEL, 3.5) + '/><path d="M24 50v8M40 50v8"' + ln(L, 3.5) + "/>"),
    card: ic('<rect x="8" y="6" width="48" height="52" rx="4"' + f(SHEET) + '/><rect x="8" y="6" width="48" height="13" rx="4"' + f(SHOP) + '/><path d="M16 30h32M16 39h32M16 48h22"' + ln("#9CB8C9", 3) + '/><text x="47" y="17" font-family="Grandstander, sans-serif" font-weight="800" font-size="11" fill="' + PAPER + '" text-anchor="middle">&#8478;</text>'),
    dial: ic('<rect x="4" y="20" width="56" height="28" rx="12"' + f(SHOP) + '/><circle cx="19" cy="34" r="9"' + f(MINT) + '/><circle cx="45" cy="34" r="9"' + f(MINT) + '/><circle cx="32" cy="14" r="8"' + f(SHEET) + '/><path d="M32 14l4-4"' + ln(BAD, 3) + "/>"),
    onetwo: ic('<circle cx="18" cy="34" r="14"' + f(MINT) + '/><circle cx="46" cy="34" r="14"' + f(NOTE) + '/><text x="18" y="40" font-family="Grandstander, sans-serif" font-weight="800" font-size="17" fill="' + L + '" text-anchor="middle">1</text><text x="46" y="40" font-family="Grandstander, sans-serif" font-weight="800" font-size="17" fill="' + L + '" text-anchor="middle">2</text><path d="M18 14 q14 -10 28 0 m-4 -5 l4 5 -6 2"' + ln(BAD, 3) + "/>"),
    glasses: ic('<circle cx="18" cy="34" r="12"' + f(MINT) + '/><circle cx="46" cy="34" r="12"' + f(MINT) + '/><path d="M30 32q2-4 4 0M6 30l-3-8M58 30l3-8"' + ln(L, 3.5) + '/><path d="M12 30q4-5 9-3"' + ln(SHEET, 2.5) + "/>"),
    star: ic('<path d="M32 6 l7.2 16 16.8 1.6 -12.8 11.5 3.7 16.5 -14.9 -8.8 -14.9 8.8 3.7 -16.5 -12.8 -11.5 16.8 -1.6z"' + f(YEL) + "/>"),
    pencil: ic('<path d="M10 54 l5 -16 27 -27 11 11 -27 27 z"' + f(YEL) + '/><path d="M37 16 l11 11 M10 54 l5 -16 11 11 z"' + ln() + '/><path d="M42 11 l6 -6 11 11 -6 6"' + f(BRICK) + "/>"),
    duck: ic('<path d="M8 30 l-4 -10 10 6z"' + f(DUCK) + '/><ellipse cx="26" cy="44" rx="20" ry="13"' + f(DUCK) + '/><circle cx="38" cy="22" r="14"' + f(DUCK) + '/><path d="M50 22 q8 1 12 4 q-5 3 -12 2z"' + f(BILL) + '/><circle cx="43" cy="19" r="6"' + f(EYE) + '/><circle cx="43" cy="19" r="2.5" fill="' + EYE3 + '"/>'),
    photo: ic('<g transform="rotate(-6 32 32)"><rect x="10" y="6" width="44" height="52" rx="2"' + f(SHEET) + '/><rect x="15" y="11" width="34" height="32" fill="#E9E2D2"' + sk + '/><path d="M21 18 L41 15 L43 37 L19 39 Z"' + f(SHEET) + '/><path d="M23 20h6v6h-6zM35 18h5v6h-5zM29 26h6v6h-6z" fill="' + INK + '"/></g>'),
    magnifier: ic('<circle cx="26" cy="26" r="17"' + f(MINT) + '/><path d="M38 38 l16 16"' + ln(WOOD, 8) + '/><path d="M38 38 l16 16"' + ln(L, 2) + '/><path d="M17 21 q4 -6 11 -6"' + ln(SHEET, 3) + "/>")
  };

  var out = {};
  Object.keys(scenes).forEach(function (k) { out[k] = scenes[k](); });
  root.EE_ART = out; root.EE_ICONS = icons;
})(typeof window !== "undefined" ? window : this);
