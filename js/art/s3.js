/* Duck's-Eye View — art for step 3, the box desk. Hand-built SVG, 960×400, Busytown cutaway.
   A tiny helper keeps the pigeonhole grids, the note pile and the sign boards small. */
window.DEV_ART = window.DEV_ART || {};
window.DEV_ART["s3"] = (function () {
  var INK = "#4A2E1E", F = "font-family=\"Patrick Hand, sans-serif\"";
  function sign(cx, cy, lines, w) {
    var h = lines.length * 18 + 9, x = cx - w / 2, y = cy - h / 2, s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7" fill="#FFFDF6" stroke="' + INK + '" stroke-width="2"/>';
    lines.forEach(function (t, i) { s += '<text x="' + cx + '" y="' + (y + 18 + i * 18) + '" text-anchor="middle" ' + F + ' font-size="15" fill="' + INK + '" stroke="none">' + t + "</text>"; });
    return s;
  }
  function grid(x, y, w, h, cols, rows, sw) {
    var d = "", i;
    for (i = 0; i <= cols; i++) d += "M" + (x + i * w / cols).toFixed(1) + " " + y + "v" + h;
    for (i = 0; i <= rows; i++) d += "M" + x + " " + (y + i * h / rows).toFixed(1) + "h" + w;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#DDBB8A" stroke="none"/><path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + sw + '"/>';
  }
  function notes(x, y, w, h, cols, rows, seed, every) {
    var s = "", cw = w / cols, ch = h / rows, r = seed;
    for (var i = 0; i < cols * rows; i++) { r = (r * 1103515245 + 12345) & 0x7fffffff; if (r % every === 0) { var c = i % cols, rr = Math.floor(i / cols); s += '<rect x="' + (x + c * cw + cw * 0.17).toFixed(1) + '" y="' + (y + rr * ch + ch * 0.17).toFixed(1) + '" width="' + (cw * 0.66).toFixed(1) + '" height="' + (ch * 0.66).toFixed(1) + '" fill="#FFE27A" stroke="' + INK + '" stroke-width="' + Math.min(1, cw / 12).toFixed(1) + '"/>'; } }
    return s;
  }
  function pile(cx, cy, n, seed) {   // twenty sticky notes fanned over one photo
    var s = "", r = seed;
    for (var i = 0; i < n; i++) {
      r = (r * 1103515245 + 12345) & 0x7fffffff; var dx = (r % 61) - 30; r = (r * 1103515245 + 12345) & 0x7fffffff; var dy = (r % 41) - 20; r = (r * 1103515245 + 12345) & 0x7fffffff; var rot = (r % 50) - 25;
      s += '<g transform="translate(' + (cx + dx) + " " + (cy + dy) + ") rotate(" + rot + ')"><rect x="-11" y="-11" width="22" height="22" fill="#FFE27A" stroke="' + INK + '" stroke-width="1.4"/><rect x="-6" y="-6" width="12" height="12" fill="none" stroke="#1F6F74" stroke-width="1.4"/></g>';
    }
    return s;
  }
  var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="dev-s3-title">' +
    '<title id="dev-s3-title">The box desk, a cutaway of the robot duck\'s head: a wall of pigeonholes in three sizes (2,100 candidate boxes) with a duckling on a ladder posting sticky notes; a desk where twenty notes are piled on one photo of a duck; a gate marked score ≥ 0.35 (the threshold); the shredder clerk feeding notes into a shredder marked IoU ≥ 0.5 → shred (non-maximum suppression); and an inspector duckling with a clipboard reading mAP50.</title>' +
    '<defs><g id="dev-s3-dk">' +
      '<path d="M-6 0v-9M6 0v-9" stroke-width="3.5"/><path d="M-13 1h12M1 1h12" stroke-width="4"/><path d="M-13 1h12M1 1h12" stroke="#E8923A" stroke-width="1.8"/>' +
      '<ellipse cx="0" cy="-22" rx="17" ry="13" fill="#F9D95B"/><path d="M-9 -22q9 9 18 0" fill="none" stroke-width="2"/>' +
      '<circle cx="13" cy="-42" r="11" fill="#F9D95B"/><path d="M23 -43l12 3-12 4z" fill="#E8923A" stroke-width="2"/><circle cx="16" cy="-45" r="1.8" fill="' + INK + '" stroke="none"/>' +
      '<path d="M2 -49q11 -15 22 0z" fill="#F4C430" stroke-width="2"/><rect x="-2" y="-51" width="30" height="4.5" rx="2.2" fill="#F4C430" stroke-width="2"/>' +
    '</g></defs>' +
    '<rect x="0" y="0" width="960" height="400" fill="#F7F0E2"/>' +
    '<rect x="0" y="212" width="960" height="90" fill="#E9D8A6"/><path d="M0 212h960" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<rect x="0" y="300" width="960" height="100" fill="#B8793F"/><path d="M0 336h960M0 372h960" stroke="#8A5A2B" stroke-width="2"/><path d="M0 300h960" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<g stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">' +
    // the pigeonhole wall: three panels, three sizes
    '<rect x="24" y="36" width="392" height="264" fill="#C9A06A"/>' +
    grid(30, 42, 200, 248, 20, 25, 0.7) + notes(30, 42, 200, 248, 20, 25, 9, 9) +
    grid(240, 42, 100, 248, 5, 12, 1.1) + notes(240, 42, 100, 248, 5, 12, 4, 6) +
    grid(350, 42, 60, 248, 2, 6, 1.6) + notes(350, 42, 60, 248, 2, 6, 7, 4) +
    '<rect x="24" y="36" width="392" height="264" fill="none"/>' +
    sign(126, 306, ["stride 8 · 1,600 small holes"], 190) + sign(284, 306, ["stride 16 · 400"], 108) + sign(398, 306, ["stride 32 · 100"], 108) +
    // ladder + duckling posting a note
    '<path d="M196 300V112M226 300V112" stroke-width="4"/><path d="M196 130h30M196 152h30M196 174h30M196 196h30M196 218h30M196 240h30M196 262h30M196 284h30" stroke-width="2.5"/>' +
    '<use href="#dev-s3-dk" transform="translate(211 196) scale(-1 1)"/>' +
    '<g transform="translate(180 158) rotate(-10)"><rect x="-9" y="-9" width="18" height="18" fill="#FFE27A" stroke-width="1.6"/><rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#1F6F74" stroke-width="1.4"/></g>' +
    // the desk with one duck photo and twenty notes
    '<rect x="440" y="222" width="200" height="14" rx="3" fill="#B8793F"/><rect x="452" y="236" width="12" height="64" fill="#B8793F"/><rect x="616" y="236" width="12" height="64" fill="#B8793F"/>' +
    '<rect x="478" y="146" width="124" height="80" fill="#FBF7EC"/><rect x="478" y="146" width="18" height="80" fill="#727272" stroke="none"/><rect x="584" y="146" width="18" height="80" fill="#727272" stroke="none"/><rect x="496" y="146" width="88" height="80" fill="#EFE3CB" stroke="none"/><rect x="496" y="196" width="88" height="30" fill="#C89B6A" stroke="none"/>' +
    '<ellipse cx="540" cy="200" rx="18" ry="9" fill="#E9EEF0" stroke-width="2"/><rect x="537" y="176" width="6" height="14" fill="#E9EEF0" stroke-width="1.6"/><ellipse cx="542" cy="171" rx="10" ry="8" fill="#E9EEF0" stroke-width="2"/><path d="M551 169l11 3-11 3z" fill="#E8923A" stroke-width="1.6"/><circle cx="543" cy="169" r="2.4" fill="#1B2226" stroke="none"/>' +
    '<rect x="478" y="146" width="124" height="80" fill="none"/>' +
    pile(540, 194, 20, 21) +
    '<use href="#dev-s3-dk" transform="translate(456 300)"/>' +
    // the gate = threshold
    '<rect x="652" y="240" width="8" height="60" fill="#B8793F"/><rect x="684" y="240" width="8" height="60" fill="#B8793F"/><path d="M656 252h32" stroke-width="4"/><path d="M656 262h32M656 272h32" stroke="#8A5A2B" stroke-width="2.5"/>' +
    '<rect x="641" y="226" width="62" height="16" rx="3" fill="#FFFDF6" stroke-width="1.6"/><text x="672" y="238" text-anchor="middle" ' + F + ' font-size="11" fill="' + INK + '" stroke="none">score ≥ 0.35</text>' +
    // the shredder
    '<rect x="705" y="190" width="90" height="80" rx="4" fill="#C9D2D7"/><rect x="720" y="196" width="60" height="7" rx="2" fill="#1B2226" stroke-width="1.5"/>' +
    '<g transform="translate(748 182) rotate(12)"><rect x="-10" y="-10" width="20" height="20" fill="#FFE27A" stroke-width="1.6"/><rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#1F6F74" stroke-width="1.4"/></g>' +
    '<rect x="713" y="222" width="74" height="32" rx="4" fill="#FFFDF6" stroke-width="1.8"/><text x="750" y="236" text-anchor="middle" ' + F + ' font-size="13" fill="' + INK + '" stroke="none">IoU ≥ 0.5</text><text x="750" y="250" text-anchor="middle" ' + F + ' font-size="13" fill="#A5321F" stroke="none">→ shred</text>' +
    '<path d="M722 270v14M730 270v18M738 270v12M746 270v20M754 270v14M762 270v19M770 270v12M778 270v16" stroke="#FFE27A" stroke-width="3"/>' +
    '<rect x="712" y="278" width="76" height="22" rx="3" fill="#5E6B73"/>' +
    // the shredder clerk on a stool
    '<rect x="800" y="262" width="30" height="7" rx="2" fill="#B8793F"/><path d="M804 269v31M826 269v31" stroke-width="3"/>' +
    '<use href="#dev-s3-dk" transform="translate(815 262) scale(-1 1)"/><path d="M792 226l-28 -22" stroke-width="3"/>' +
    // the inspector with clipboard and glasses
    '<use href="#dev-s3-dk" transform="translate(900 300) scale(-1 1)"/>' +
    '<circle cx="885" cy="257" r="5" fill="#9FD3D6" stroke-width="1.6"/><circle cx="873" cy="257" r="5" fill="#9FD3D6" stroke-width="1.6"/><path d="M878 257h2" stroke-width="1.6"/>' +
    '<g transform="rotate(-8 872 262)"><rect x="854" y="238" width="36" height="46" rx="3" fill="#FFFDF6" stroke-width="2"/><rect x="866" y="234" width="12" height="7" rx="2" fill="#5E6B73" stroke-width="1.5"/><text x="872" y="257" text-anchor="middle" ' + F + ' font-size="10" fill="' + INK + '" stroke="none">mAP50</text><text x="872" y="270" text-anchor="middle" font-family="Grandstander, Patrick Hand, sans-serif" font-weight="800" font-size="11" fill="#3B7422" stroke="none">0.976</text><path d="M859 276h26" stroke-width="1" stroke-dasharray="2 2"/></g>' +
    '</g>' +
    // sign boards
    sign(220, 22, ["pigeonholes = 2,100 candidate boxes"], 250) +
    sign(110, 168, ["sticky note = box + score"], 176) + '<path d="M170 172l12 -6" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(540, 118, ["twenty notes, one duck"], 166) + '<path d="M540 132v14" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(672, 200, ["gate = threshold"], 122) + '<path d="M672 214v12" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(760, 156, ["shredder clerk = NMS"], 160) + '<path d="M760 170v20" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(886, 196, ["inspector = mAP50"], 136) + '<path d="M886 210v24" stroke="' + INK + '" stroke-width="1.2"/>' +
    sign(560, 356, ["one note survives → the tiny ruler, next door"], 300) +
    "</svg>";
  return s;
})();
window.DEV_ICONS = window.DEV_ICONS || {};
Object.assign(window.DEV_ICONS, {   // keys prefixed s3 so they never collide with another step's icons
  s3note: '<svg viewBox="0 0 24 24"><path d="M4 4h16v11l-5 5H4z" fill="#FFE27A" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 20v-5h5" fill="#F4C430" stroke="#4A2E1E" stroke-width="1.6" stroke-linejoin="round"/><rect x="7.5" y="7.5" width="7" height="6" fill="none" stroke="#1F6F74" stroke-width="1.8"/></svg>',
  s3cubbies: '<svg viewBox="0 0 24 24"><rect x="2.5" y="3.5" width="19" height="17" fill="#DDBB8A" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 3.5v17M14.5 3.5v17M2.5 9.2h19M2.5 14.8h19" stroke="#4A2E1E" stroke-width="1.2"/><rect x="4" y="5" width="3" height="3" fill="#FFE27A"/><rect x="16" y="10.5" width="3.5" height="3" fill="#FFE27A"/><rect x="10" y="16.2" width="3.2" height="3" fill="#FFE27A"/></svg>',
  s3shredder: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2" fill="#C9D2D7" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><rect x="7" y="9" width="10" height="2" fill="#1B2226"/><path d="M9 3h6v5H9z" fill="#FFE27A" stroke="#4A2E1E" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 17v4M10 17v3M13 17v4.5M16 17v3" stroke="#FFE27A" stroke-width="1.8" stroke-linecap="round"/></svg>',
  s3inspector: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" fill="#FFFDF6" stroke="#4A2E1E" stroke-width="1.8" stroke-linejoin="round"/><rect x="9" y="2.5" width="6" height="3.5" rx="1" fill="#5E6B73" stroke="#4A2E1E" stroke-width="1.4"/><path d="M8 10h8M8 13.5h8M8 17h5" stroke="#4A2E1E" stroke-width="1.4" stroke-linecap="round"/><path d="M14.5 16.5l1.5 1.5 3-3" fill="none" stroke="#3B7422" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
});
