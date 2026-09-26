/* Duck's-Eye View — art for step 2, the stencil room. Hand-built SVG, 960×400, Busytown cutaway.
   Built with a tiny helper so the cubby grids and sign boards stay small; the drawing is still flat gouache + one brown line. */
window.DEV_ART = window.DEV_ART || {};
window.DEV_ART["s2"] = (function () {
  var INK = "#4A2E1E", F = "font-family=\"Patrick Hand, sans-serif\"";
  function sign(cx, cy, lines, w) {   // white signboard, "object = meaning"
    var h = lines.length * 18 + 9, x = cx - w / 2, y = cy - h / 2, s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7" fill="#FFFDF6" stroke="' + INK + '" stroke-width="2"/>';
    lines.forEach(function (t, i) { s += '<text x="' + cx + '" y="' + (y + 18 + i * 18) + '" text-anchor="middle" ' + F + ' font-size="15" fill="' + INK + '" stroke="none">' + t + "</text>"; });
    return s;
  }
  function grid(x, y, w, h, cols, rows, sw) {   // pigeonholes
    var d = "", i;
    for (i = 0; i <= cols; i++) d += "M" + (x + i * w / cols).toFixed(1) + " " + y + "v" + h;
    for (i = 0; i <= rows; i++) d += "M" + x + " " + (y + i * h / rows).toFixed(1) + "h" + w;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#DDBB8A" stroke="none"/><path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + sw + '"/>';
  }
  function notes(x, y, w, h, cols, rows, seed) {   // a few sticky notes in the cubbies
    var s = "", cw = w / cols, ch = h / rows, r = seed;
    for (var i = 0; i < cols * rows; i++) { r = (r * 1103515245 + 12345) & 0x7fffffff; if (r % 7 === 0) { var c = i % cols, rr = Math.floor(i / cols); s += '<rect x="' + (x + c * cw + cw * 0.18).toFixed(1) + '" y="' + (y + rr * ch + ch * 0.18).toFixed(1) + '" width="' + (cw * 0.64).toFixed(1) + '" height="' + (ch * 0.64).toFixed(1) + '" fill="#FFE27A" stroke="' + INK + '" stroke-width="' + Math.min(1, cw / 12).toFixed(1) + '"/>'; } }
    return s;
  }
  var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="dev-s2-title">' +
    '<title id="dev-s2-title">The stencil room, a cutaway of the robot duck\'s head: ducklings in yellow hard hats slide a 3×3 stencil (a kernel) over a big letterboxed print of another duck and copy the result onto a new sheet (a feature map); a row of ever-smaller prints leans against the wall (stride 2, again and again); a tower on the right has three floors of pigeonholes labelled stride 32, 16 and 8; a hatch in the floor leads down to the 2,100 pigeonholes of the box desk; a small framed sound-print on the left wall is pet-detect.</title>' +
    '<defs><g id="dev-s2-dk">' +
      '<path d="M-6 0v-9M6 0v-9" stroke-width="3.5"/><path d="M-13 1h12M1 1h12" stroke-width="4"/><path d="M-13 1h12M1 1h12" stroke="#E8923A" stroke-width="1.8"/>' +
      '<ellipse cx="0" cy="-22" rx="17" ry="13" fill="#F9D95B"/><path d="M-9 -22q9 9 18 0" fill="none" stroke-width="2"/>' +
      '<circle cx="13" cy="-42" r="11" fill="#F9D95B"/><path d="M23 -43l12 3-12 4z" fill="#E8923A" stroke-width="2"/><circle cx="16" cy="-45" r="1.8" fill="' + INK + '" stroke="none"/>' +
      '<path d="M2 -49q11 -15 22 0z" fill="#F4C430" stroke-width="2"/><rect x="-2" y="-51" width="30" height="4.5" rx="2.2" fill="#F4C430" stroke-width="2"/>' +
    '</g></defs>' +
    // walls and floor
    '<rect x="0" y="0" width="960" height="400" fill="#FBF7EC"/>' +
    '<rect x="0" y="212" width="960" height="90" fill="#E9D8A6"/>' +
    '<path d="M0 212h960" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<rect x="0" y="300" width="960" height="100" fill="#B8793F"/>' +
    '<path d="M0 300h960M0 336h960M0 372h960" stroke="#8A5A2B" stroke-width="2"/><path d="M0 300h960" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<g stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">' +
    // ceiling lamp
    '<path d="M480 0v34" stroke-width="2"/><path d="M452 60q28-32 56 0z" fill="#1F6F74"/><ellipse cx="480" cy="61" rx="28" ry="5" fill="#FFE27A" stroke-width="2"/>' +
    // pet-detect on the left wall
    '<rect x="26" y="38" width="78" height="60" rx="3" fill="#FBF7EC"/>' +
    (function () { var t = "", shades = ["#9FD3D6", "#1F6F74", "#5FA8AC", "#1F6F74", "#9FD3D6", "#3A8A8E", "#1F6F74", "#9FD3D6"]; for (var i = 0; i < 8; i++) t += '<rect x="30" y="' + (42 + i * 6.5).toFixed(1) + '" width="' + (28 + ((i * 37) % 40)) + '" height="5" fill="' + shades[i] + '" stroke="none"/>'; return t; })() +
    '<rect x="56" y="56" width="21" height="21" fill="none" stroke="#E0A91E" stroke-width="3"/><path d="M63 56v21M70 56v21M56 63h21M56 70h21" stroke="' + INK + '" stroke-width="1"/>' +
    sign(66, 136, ["pet-detect =", "a stencil over", "a sound-print"], 118) +
    // table
    '<rect x="100" y="240" width="240" height="14" rx="3" fill="#B8793F"/><rect x="112" y="254" width="12" height="46" fill="#B8793F"/><rect x="316" y="254" width="12" height="46" fill="#B8793F"/>' +
    // the big print: grey letterbox bands + the picture
    '<rect x="140" y="100" width="160" height="140" fill="#FBF7EC"/><rect x="140" y="100" width="25" height="140" fill="#727272" stroke="none"/><rect x="275" y="100" width="25" height="140" fill="#727272" stroke="none"/>' +
    '<rect x="165" y="100" width="110" height="140" fill="#EFE3CB" stroke="none"/><rect x="165" y="186" width="110" height="54" fill="#C89B6A" stroke="none"/>' +
    '<ellipse cx="217" cy="200" rx="30" ry="4" fill="rgba(60,35,20,.25)" stroke="none"/>' +
    '<path d="M209 178v18M225 178v18" stroke-width="4"/><ellipse cx="217" cy="170" rx="26" ry="14" fill="#E9EEF0" stroke-width="2"/><rect x="214" y="140" width="8" height="18" fill="#E9EEF0" stroke-width="2"/><ellipse cx="220" cy="134" rx="15" ry="11" fill="#E9EEF0" stroke-width="2"/><path d="M234 132l16 4-16 4z" fill="#E8923A" stroke-width="2"/><circle cx="222" cy="131" r="3.5" fill="#1B2226" stroke="none"/><circle cx="223.5" cy="130" r="1.3" fill="#9FD3D6" stroke="none"/>' +
    '<rect x="140" y="100" width="160" height="140" fill="none"/>' +
    // the stencil over the print
    '<rect x="190" y="126" width="54" height="54" fill="rgba(255,226,122,.28)" stroke="#E0A91E" stroke-width="4"/><path d="M208 126v54M226 126v54M190 144h54M190 162h54" stroke="' + INK + '" stroke-width="1.5"/>' +
    '<text x="199" y="141" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">−1</text><text x="231" y="141" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">1</text><text x="199" y="159" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">−1</text><text x="231" y="159" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">1</text><text x="199" y="177" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">−1</text><text x="231" y="177" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">1</text>' +
    // duckling A on a stool, holding the stencil with a pole
    '<rect x="112" y="216" width="30" height="7" rx="2" fill="#B8793F"/><path d="M116 223v17M138 223v17" stroke-width="3"/>' +
    '<path d="M144 196L190 152" stroke-width="3"/><use href="#dev-s2-dk" transform="translate(127 216)"/>' +
    // duckling B holding the new sheet
    '<use href="#dev-s2-dk" transform="translate(356 300)"/>' +
    '<g transform="rotate(-6 412 220)"><rect x="372" y="180" width="80" height="80" fill="#FBF7EC"/>' +
    (function () { var t = "", cells = [0, 0, 2, 0, 1, 2, 0, 0, 2, 0, 0, 1, 0, 1, 2, 0], col = ["#FBF7EC", "#1F6F74", "#C8452F"]; for (var i = 0; i < 16; i++) t += '<rect x="' + (376 + (i % 4) * 18) + '" y="' + (184 + Math.floor(i / 4) * 18) + '" width="18" height="18" fill="' + col[cells[i]] + '" stroke="' + INK + '" stroke-width="1"/>'; return t; })() +
    '</g><path d="M380 262L372 270" stroke-width="2"/>' +
    // ever-smaller prints leaning on the wall
    (function () { var t = "", sz = [95, 48, 24, 12, 6], x = 470, lab = ["160", "80", "40", "20", "10"]; for (var i = 0; i < 5; i++) { var w = sz[i]; t += '<rect x="' + x + '" y="' + (300 - w) + '" width="' + w + '" height="' + w + '" fill="#FBF7EC" stroke-width="' + (w > 20 ? 2.5 : 1.5) + '"/>'; if (w >= 24) t += '<rect x="' + (x + w * 0.3) + '" y="' + (300 - w * 0.62) + '" width="' + (w * 0.42) + '" height="' + (w * 0.3) + '" fill="#C8452F" stroke="none"/><rect x="' + (x + w * 0.12) + '" y="' + (300 - w * 0.86) + '" width="' + (w * 0.24) + '" height="' + (w * 0.18) + '" fill="#1F6F74" stroke="none"/>'; t += '<text x="' + (x + w / 2) + '" y="' + (300 - w - 6) + '" text-anchor="middle" ' + F + ' font-size="13" fill="#6E5040" stroke="none">' + lab[i] + "</text>"; x += w + 10; } return t; })() +
    // the tower
    '<path d="M712 62L820 20L928 62Z" fill="#C9D2D7"/><rect x="720" y="62" width="200" height="238" fill="#E9EEF0"/>' +
    grid(735, 70, 170, 62, 5, 3, 1.6) + notes(735, 70, 170, 62, 5, 3, 11) +
    '<rect x="720" y="136" width="200" height="12" fill="#B8793F"/>' +
    grid(735, 152, 170, 62, 10, 5, 1.2) + notes(735, 152, 170, 62, 10, 5, 5) +
    '<rect x="720" y="218" width="200" height="12" fill="#B8793F"/>' +
    grid(735, 234, 170, 60, 20, 8, 0.8) + notes(735, 234, 170, 60, 20, 8, 3) +
    '<rect x="720" y="62" width="200" height="238" fill="none"/>' +
    sign(820, 142, ["stride 32 · 10×10 = 100"], 170) + sign(820, 224, ["stride 16 · 20×20 = 400"], 176) + sign(820, 300, ["stride 8 · 40×40 = 1,600"], 180) +
    // hatch to the box desk downstairs
    '<rect x="560" y="318" width="100" height="54" fill="#3B2A33"/><path d="M560 336h100M560 354h100" stroke="#6E5040" stroke-width="3"/><path d="M572 372v-54M648 372v-54" stroke="#8A5A2B" stroke-width="2"/>' +
    '<circle cx="612" cy="332" r="9" fill="#F9D95B" stroke-width="2"/><path d="M604 326q8-11 16 0z" fill="#F4C430" stroke-width="1.6"/><path d="M620 331l8 2-8 3z" fill="#E8923A" stroke-width="1.6"/><circle cx="615" cy="330" r="1.4" fill="' + INK + '" stroke="none"/>' +
    '</g>' +
    // sign boards
    sign(217, 76, ["stencil = a 3×3 kernel"], 172) + '<path d="M217 90v34" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(220, 320, ["big print = the 320×320 input"], 220) +
    sign(400, 108, ["new sheet = feature map"], 172) + '<path d="M400 122L412 178" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(566, 152, ["smaller prints = stride 2, again and again", "160 · 80 · 40 · 20 · 10"], 296) +
    sign(820, 44, ["tower floors = the three grids"], 220) +
    sign(760, 352, ["← 2,100 pigeonholes downstairs"], 220) +
    "</svg>";
  return s;
})();
window.DEV_ICONS = window.DEV_ICONS || {};
Object.assign(window.DEV_ICONS, {   // keys prefixed s2 so they never collide with another step's icons
  s2stencil: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="#FFFDF6" stroke="#E0A91E" stroke-width="2.6"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke="#4A2E1E" stroke-width="1.5"/><rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="none" stroke="#4A2E1E" stroke-width="1.2"/></svg>',
  s2sheet: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5" fill="#FFFDF6" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><rect x="7" y="6" width="4" height="4" fill="#1F6F74"/><rect x="13" y="6" width="4" height="4" fill="#C8452F"/><rect x="7" y="12" width="4" height="4" fill="#C8452F"/><rect x="13" y="12" width="4" height="4" fill="#FBF7EC" stroke="#4A2E1E" stroke-width=".8"/></svg>',
  s2prints: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="14" height="16" fill="#FFFDF6" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><rect x="16.5" y="12" width="5" height="9" fill="#FFFDF6" stroke="#4A2E1E" stroke-width="1.6" stroke-linejoin="round"/><rect x="21.6" y="17" width="2" height="4" fill="#FFFDF6" stroke="#4A2E1E" stroke-width="1.2"/><rect x="6" y="11" width="6" height="4" fill="#C8452F"/></svg>',
  s2tower: '<svg viewBox="0 0 24 24"><path d="M4 8l8-5 8 5z" fill="#C9D2D7" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><rect x="5" y="8" width="14" height="14" fill="#E9EEF0" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 12.5h14M5 17h14" stroke="#B8793F" stroke-width="2"/><path d="M9 8v4.5M15 8v4.5M8 12.5v4.5M12 12.5v4.5M16 12.5v4.5M7 17v5M9.5 17v5M12 17v5M14.5 17v5M17 17v5" stroke="#4A2E1E" stroke-width=".9"/></svg>'
});
