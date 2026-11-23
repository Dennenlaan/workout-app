'use strict';
/* =========================================================
   Vaste inhoud (catalogus). GEEN gebruikersdata — die staat in localStorage (zie CLAUDE.md).
   ========================================================= */

/* ---------- Optionele eigen plaatjes ----------
   Zet een bestand in images/ en registreer het hier: 'oefening-id': 'images/bestand.jpg'.
   Laadt het niet, dan blijft de ingebouwde SVG-illustratie zichtbaar. */
const LOCAL_IMAGES = {
  // 'bf-hip-thrust': 'images/hip-thrust.jpg',
};

/* ---------- Teken-helpers ---------- */
/** Bouw een frame: punten als [x,y]. Ontbrekende 2e arm/been = 3px verschoven kopie (achtergrond). */
function fr(o) {
  const sh = (pt) => [pt[0] - 3, pt[1]];
  return [...o.h, ...o.n, ...o.p, ...o.e, ...o.w, ...o.k, ...o.f,
    ...(o.e2 || sh(o.e)), ...(o.w2 || sh(o.w)), ...(o.k2 || sh(o.k)), ...(o.f2 || sh(o.f))];
}
/** Verschuif alle y-waarden van een frame-array. */
const shiftY = (frame, dy) => frame.map((v, i) => (i % 2 ? v + dy : v));

// Basishoudingen (zijaanzicht, kijkt naar rechts)
const ST = { h: [100, 22], n: [100, 36], p: [100, 72], k: [101, 98], f: [100, 124] };          // staand
const SE = { h: [90, 46], n: [88, 60], p: [86, 96], k: [112, 96], f: [112, 122] };             // zittend
const HINGE = { h: [132, 54], n: [120, 60], p: [88, 74], k: [98, 99], f: [100, 124] };         // voorovergebogen
const QUAD = { h: [136, 84], n: [124, 92], p: [88, 92], e: [124, 107], w: [124, 122], k: [88, 118], f: [66, 122],
  e2: [124, 107], w2: [124, 122], k2: [88, 118], f2: [66, 122] };                                 // handen & knieën
// Vooraanzicht
const FR = { h: [100, 22], n: [100, 36], p: [100, 72], k: [93, 98], f: [91, 124], k2: [107, 98], f2: [109, 124] };
const ARMS_DOWN_FR = { e: [90, 52], w: [88, 67], e2: [110, 52], w2: [112, 67] };

/* Toestellen (statische SVG). Klassen: eq (toestel), eq-dark (metaal/plaat), eq-line (frame). */
const EQ = {
  tower: (x, py) => `<rect class="eq" x="${x}" y="6" width="10" height="118" rx="3"/><circle class="eq-dark" cx="${x + 5}" cy="${py}" r="4"/>`,
  bench: (x0, x1, y) => `<rect class="eq-line" x="${x0 + 6}" y="${y}" width="4" height="${124 - y}"/><rect class="eq-line" x="${x1 - 10}" y="${y}" width="4" height="${124 - y}"/><rect class="eq" x="${x0}" y="${y}" width="${x1 - x0}" height="8" rx="3"/>`,
  seat: (x, y, back = true) => `<rect class="eq-line" x="${x - 2}" y="${y + 6}" width="5" height="${124 - y - 6}"/><rect class="eq" x="${x - 16}" y="${y}" width="32" height="7" rx="3"/>${back ? `<rect class="eq" x="${x - 20}" y="${y - 44}" width="8" height="46" rx="3"/>` : ''}`,
  box: (x0, x1, top) => `<rect class="eq" x="${x0}" y="${top}" width="${x1 - x0}" height="${124 - top}" rx="3"/>`,
  beam: (x0, x1, y) => `<rect class="eq" x="${x0}" y="${y}" width="${x1 - x0}" height="5" rx="2"/>`,
  pad: (x, y, w, h) => `<rect class="eq" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`,
};

/* ---------- Poses ---------- */
const POSES = {
  /* ===== Pilatesbord (bovenkant bord y=120, slede y=114–120) ===== */
  'p-squat': { board: { x0: 40, x1: 160 }, cords: [{ from: [100, 120], to: 'w2' }, { from: [100, 120], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.8, frames: [
    shiftY([100, 22, 100, 36, 100, 72, 110, 48, 106, 38, 101, 98, 100, 124], -4),
    shiftY([101, 43, 96, 56, 82, 92, 110, 62, 110, 48, 108, 100, 100, 124], -4)] },
  'p-curl': { board: { x0: 40, x1: 160 }, cords: [{ from: [100, 120], to: 'w2' }, { from: [100, 120], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    shiftY([100, 22, 100, 36, 100, 72, 101, 54, 108, 68, 101, 98, 100, 124], -4),
    shiftY([100, 22, 100, 36, 100, 72, 101, 54, 106, 40, 101, 98, 100, 124], -4)] },
  'p-press': { board: { x0: 40, x1: 160 }, cords: [{ from: [100, 120], to: 'w2' }, { from: [100, 120], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 3, frames: [
    shiftY([101, 43, 96, 56, 82, 92, 108, 64, 106, 50, 108, 100, 100, 124], -4),
    shiftY([100, 24, 100, 38, 100, 74, 101, 24, 102, 10, 101, 98, 100, 124], -4)] },
  'p-deadlift': { board: { x0: 40, x1: 160 }, cords: [{ from: [100, 120], to: 'w2' }, { from: [100, 120], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 3, frames: [
    shiftY([100, 22, 100, 36, 100, 72, 102, 54, 103, 70, 101, 98, 100, 124], -4),
    shiftY([130, 50, 118, 58, 86, 74, 118, 73, 118, 88, 98, 99, 100, 124], -4)] },
  'p-row': { board: { x0: 40, x1: 160 }, cords: [{ from: [154, 108], to: 'w2' }, { from: [154, 108], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.6, frames: [
    fr({ h: [82, 66], n: [78, 80], p: [70, 114], e: [92, 84], w: [106, 88], k: [96, 108], f: [122, 114] }),
    fr({ h: [66, 66], n: [68, 80], p: [70, 114], e: [58, 91], w: [72, 96], k: [96, 108], f: [122, 114] })] },
  'p-slide-lunge': { board: { x0: 30, x1: 150 }, slider: 'f2', dur: 3, frames: [
    fr({ h: [100, 18], n: [100, 32], p: [100, 68], e: [104, 46], w: [116, 50], k: [106, 94], f: [112, 120], k2: [96, 94], f2: [92, 114] }),
    fr({ h: [99, 38], n: [98, 52], p: [96, 88], e: [102, 66], w: [114, 70], k: [118, 96], f: [112, 120], k2: [80, 112], f2: [56, 114] })] },
  'p-side-slide': { front: true, board: { x0: 30, x1: 170 }, slider: 'f', dur: 3, frames: [
    fr({ h: [110, 18], n: [110, 32], p: [110, 68], e: [102, 46], w: [110, 54], e2: [118, 46], w2: [110, 54], k: [104, 94], f: [100, 114], k2: [116, 94], f2: [120, 120] }),
    fr({ h: [110, 40], n: [112, 54], p: [116, 88], e: [104, 68], w: [112, 76], e2: [120, 68], w2: [112, 76], k: [92, 100], f: [66, 114], k2: [124, 104], f2: [120, 120] })] },
  'p-knee-tuck': { board: { x0: 30, x1: 150 }, slider: 'f', holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ h: [146, 86], n: [134, 92], p: [98, 100], e: [136, 106], w: [138, 120], k: [72, 106], f: [48, 113] }),
    fr({ h: [146, 86], n: [134, 92], p: [100, 94], e: [136, 106], w: [138, 120], k: [118, 104], f: [96, 113] })] },
  'p-pike': { board: { x0: 30, x1: 150 }, slider: 'f', holds: [{ at: 'w', t: 'grip' }], dur: 3, frames: [
    fr({ h: [146, 86], n: [134, 92], p: [98, 100], e: [136, 106], w: [138, 120], k: [72, 106], f: [48, 113] }),
    fr({ h: [143, 101], n: [134, 92], p: [104, 66], e: [136, 106], w: [138, 120], k: [88, 88], f: [74, 113] })] },
  'p-rollout': { board: { x0: 30, x1: 160 }, slider: 'w', dur: 3.2, frames: [
    fr({ h: [108, 78], n: [96, 84], p: [66, 94], e: [98, 99], w: [100, 114], k: [62, 119], f: [40, 120] }),
    fr({ h: [124, 92], n: [112, 98], p: [78, 104], e: [124, 106], w: [136, 114], k: [62, 119], f: [40, 120] })] },
  'p-ham-slide': { board: { x0: 76, x1: 180 }, slider: 'f', dur: 2.8, frames: [
    fr({ h: [18, 116], n: [30, 120], p: [64, 108], e: [44, 122], w: [58, 123], k: [90, 107], f: [116, 112] }),
    fr({ h: [18, 116], n: [30, 120], p: [66, 98], e: [44, 122], w: [58, 123], k: [90, 92], f: [100, 112] })] },
  'p-slide-kick': { board: { x0: 26, x1: 150 }, slider: 'f', dur: 2.6, frames: [
    fr({ ...QUAD, w: [124, 120], w2: [124, 120], k: [88, 113], f: [66, 113], f2: [66, 120] }),
    fr({ ...QUAD, w: [124, 120], w2: [124, 120], k: [64, 102], f: [40, 113], f2: [66, 120] })] },
  'p-pushup': { board: { x0: 112, x1: 172 }, holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ h: [146, 76], n: [134, 82], p: [101, 97], e: [136, 96], w: [136, 110], k: [77, 108], f: [52, 122] }),
    fr({ h: [146, 100], n: [134, 104], p: [99, 112], e: [121, 106], w: [136, 110], k: [75, 117], f: [52, 122] })] },
  'p-plank': { board: { x0: 110, x1: 180 }, dur: 3.5, frames: [
    fr({ h: [139, 100], n: [126, 104], p: [90, 111], e: [126, 118], w: [142, 118], k: [65, 116], f: [40, 122] }),
    fr({ h: [139, 99], n: [126, 103], p: [90, 108], e: [126, 118], w: [142, 118], k: [65, 114], f: [40, 122] })] },
  /* Mat */
  bridge: { dur: 2.6, frames: [
    [40, 116, 53, 118, 89, 120, 68, 121, 83, 122, 108, 98, 124, 122],
    [40, 116, 53, 118, 86, 98, 68, 121, 83, 122, 112, 96, 124, 122]] },
  birddog: { dur: 3.2, frames: [fr(QUAD), fr({ ...QUAD, e: [138, 90], w: [153, 88], k: [64, 91], f: [40, 90] })] },
  deadbug: { dur: 3.2, frames: [
    [40, 112, 54, 116, 90, 118, 56, 101, 58, 86, 92, 92, 116, 92, 56, 101, 58, 86, 92, 92, 116, 92],
    [40, 112, 54, 116, 90, 118, 40, 110, 25, 105, 114, 108, 140, 114, 56, 101, 58, 86, 92, 92, 116, 92]] },
  hundred: { dur: 0.9, frames: [
    [46, 100, 56, 108, 90, 118, 70, 112, 85, 112, 110, 100, 130, 82],
    [46, 100, 56, 108, 90, 118, 70, 108, 85, 105, 110, 100, 130, 82]] },

  /* ===== Basic-Fit (vloer y=124) ===== */
  'g-dbcurl': { holds: [{ at: 'w', t: 'db' }], dur: 2.4, frames: [
    fr({ ...ST, e: [101, 54], w: [106, 69] }), fr({ ...ST, e: [101, 54], w: [108, 40] })] },
  'g-cablecurl': { props: EQ.tower(140, 118), cables: [{ from: [145, 118], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ ...ST, e: [101, 54], w: [106, 69] }), fr({ ...ST, e: [101, 54], w: [108, 40] })] },
  'g-bbcurl': { holds: [{ at: 'w', t: 'smallplate' }], dur: 2.4, frames: [
    fr({ ...ST, e: [101, 54], w: [106, 69] }), fr({ ...ST, e: [101, 54], w: [108, 40] })] },
  'g-pushdown': { props: EQ.tower(134, 12), cables: [{ from: [139, 12], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.2, frames: [
    fr({ ...ST, h: [105, 22], n: [103, 36], e: [104, 54], w: [116, 47] }),
    fr({ ...ST, h: [105, 22], n: [103, 36], e: [104, 54], w: [108, 69] })] },
  'g-ohcable': { props: EQ.tower(42, 30), cables: [{ from: [47, 30], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ h: [113, 27], n: [108, 40], p: [100, 72], e: [111, 25], w: [98, 30], k: [106, 98], f: [110, 124], k2: [92, 98], f2: [86, 124] }),
    fr({ h: [113, 27], n: [108, 40], p: [100, 72], e: [111, 25], w: [123, 16], k: [106, 98], f: [110, 124], k2: [92, 98], f2: [86, 124] })] },
  'g-ohdb': { holds: [{ at: 'w', t: 'db' }], dur: 2.4, frames: [
    fr({ ...ST, e: [103, 21], w: [93, 29] }), fr({ ...ST, e: [103, 21], w: [104, 6] })] },
  'g-tricepkick': { holds: [{ at: 'w', t: 'db' }], dur: 2.2, frames: [
    fr({ ...HINGE, e: [107, 66], w: [108, 81] }), fr({ ...HINGE, e: [107, 66], w: [92, 63] })] },
  'g-dipmachine': { props: EQ.seat(86, 98), holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ ...SE, e: [75, 66], w: [88, 72] }), fr({ ...SE, e: [87, 75], w: [87, 90] })] },
  'g-dbpress': { holds: [{ at: 'w', t: 'db' }], dur: 2.6, frames: [
    fr({ ...ST, e: [110, 46], w: [108, 32] }), fr({ ...ST, e: [101, 21], w: [102, 6] })] },
  'g-seatpress': { props: EQ.seat(86, 98), holds: [{ at: 'w', t: 'grip' }], dur: 2.6, frames: [
    fr({ ...SE, e: [98, 68], w: [97, 54] }), fr({ ...SE, e: [89, 45], w: [90, 30] })] },
  'g-lateral': { front: true, holds: [{ at: 'w', t: 'db' }, { at: 'w2', t: 'db' }], dur: 2.6, frames: [
    fr({ ...FR, ...ARMS_DOWN_FR }),
    fr({ ...FR, e: [86, 40], w: [72, 38], e2: [114, 40], w2: [128, 38] })] },
  'g-cablelateral': { front: true, props: EQ.tower(150, 118), cables: [{ from: [155, 118], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.6, frames: [
    fr({ ...FR, e: [92, 52], w: [90, 67], e2: [114, 46], w2: [128, 48] }),
    fr({ ...FR, e: [86, 40], w: [72, 38], e2: [114, 46], w2: [128, 48] })] },
  'g-facepull': { props: EQ.tower(146, 32), cables: [{ from: [151, 32], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ ...ST, h: [98, 22], n: [99, 36], e: [113, 36], w: [128, 33] }),
    fr({ ...ST, h: [98, 22], n: [99, 36], e: [87, 30], w: [99, 23] })] },
  'g-revfly': { front: true, props: EQ.pad(90, 46, 20, 36) + EQ.pad(84, 84, 32, 7), holds: [{ at: 'w', t: 'grip' }, { at: 'w2', t: 'grip' }], dur: 2.6, frames: [
    fr({ h: [100, 34], n: [100, 48], p: [100, 84], e: [91, 50], w: [97, 44], e2: [109, 50], w2: [103, 44], k: [93, 92], f: [93, 118], k2: [107, 92], f2: [107, 118] }),
    fr({ h: [100, 34], n: [100, 48], p: [100, 84], e: [86, 47], w: [71, 47], e2: [114, 47], w2: [129, 47], k: [93, 92], f: [93, 118], k2: [107, 92], f2: [107, 118] })] },
  'g-legpress': { props: '<rect class="eq" x="36" y="114" width="130" height="7" rx="3"/><polygon class="eq" points="30,70 38,64 66,102 58,108"/><rect class="eq" x="56" y="102" width="36" height="8" rx="3"/>',
    holds: [{ at: 'f', t: 'footplate' }], dur: 3, frames: [
    fr({ h: [42, 63], n: [50, 74], p: [74, 100], e: [60, 90], w: [72, 100], k: [94, 80], f: [118, 92] }),
    fr({ h: [42, 63], n: [50, 74], p: [74, 100], e: [60, 90], w: [72, 100], k: [100, 94], f: [126, 92] })] },
  'g-pulldown': { props: EQ.seat(86, 98, false) + EQ.pad(104, 84, 14, 8) + EQ.beam(60, 140, 2), cables: [{ from: [96, 6], to: 'w' }], holds: [{ at: 'w', t: 'bar' }], dur: 2.6, frames: [
    fr({ ...SE, e: [92, 45], w: [96, 30] }), fr({ ...SE, e: [80, 72], w: [94, 62] })] },
  'g-chestpress': { props: EQ.seat(86, 98), holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ ...SE, e: [77, 68], w: [91, 66] }), fr({ ...SE, e: [102, 62], w: [117, 62] })] },
  'g-cablechest': { props: EQ.tower(40, 38), cables: [{ from: [45, 38], to: 'w2' }, { from: [45, 38], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.4, frames: [
    fr({ h: [105, 23], n: [102, 36], p: [98, 72], e: [90, 44], w: [104, 46], k: [106, 98], f: [110, 124], k2: [92, 98], f2: [86, 124] }),
    fr({ h: [105, 23], n: [102, 36], p: [98, 72], e: [116, 38], w: [131, 38], k: [106, 98], f: [110, 124], k2: [92, 98], f2: [86, 124] })] },
  'g-seatedrow': { props: '<rect class="eq" x="44" y="106" width="56" height="8" rx="3"/><rect class="eq-line" x="66" y="114" width="5" height="10"/>' + EQ.tower(132, 86) + '<rect class="eq-dark" x="121" y="92" width="5" height="24" rx="2"/>',
    cables: [{ from: [137, 86], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.6, frames: [
    fr({ h: [86, 57], n: [80, 70], p: [70, 104], e: [93, 76], w: [107, 80], k: [94, 96], f: [118, 104] }),
    fr({ h: [70, 54], n: [72, 68], p: [70, 104], e: [60, 77], w: [75, 84], k: [94, 96], f: [118, 104] })] },
  'g-rdl-db': { holds: [{ at: 'w', t: 'db' }], dur: 3, frames: [
    [100, 22, 100, 36, 100, 72, 102, 54, 103, 70, 101, 98, 100, 124],
    [130, 50, 118, 58, 86, 74, 118, 73, 118, 88, 98, 99, 100, 124]] },
  'g-rdl-bb': { holds: [{ at: 'w', t: 'plate' }], dur: 3, frames: [
    [100, 22, 100, 36, 100, 72, 102, 54, 103, 76, 101, 98, 100, 124],
    [130, 50, 118, 58, 86, 74, 118, 73, 118, 92, 98, 99, 100, 124]] },
  'g-abcrunch': { props: EQ.seat(86, 98), dur: 2.4, frames: [
    fr({ ...SE, e: [98, 64], w: [97, 50] }), fr({ ...SE, h: [112, 60], n: [102, 70], e: [110, 80], w: [112, 66] })] },
  'g-cablecrunch': { props: EQ.tower(146, 10), cables: [{ from: [151, 10], to: 'w' }], holds: [{ at: 'w', t: 'grip' }], dur: 2.6, frames: [
    fr({ h: [112, 49], n: [106, 62], p: [96, 96], e: [115, 72], w: [110, 58], k: [96, 122], f: [72, 123] }),
    fr({ h: [134, 76], n: [122, 82], p: [96, 96], e: [128, 95], w: [134, 84], k: [96, 122], f: [72, 123] })] },
  'g-hipthrust': { props: EQ.bench(14, 52, 92), holds: [{ at: 'p', t: 'plate', dy: -11 }], dur: 2.6, frames: [
    fr({ h: [40, 82], n: [50, 90], p: [82, 112], e: [64, 100], w: [78, 104], k: [104, 96], f: [110, 124] }),
    fr({ h: [40, 82], n: [50, 90], p: [86, 90], e: [66, 84], w: [82, 82], k: [108, 96], f: [110, 124] })] },
  'g-slhipthrust': { props: EQ.bench(14, 52, 92), dur: 2.6, frames: [
    fr({ h: [40, 82], n: [50, 90], p: [82, 112], e: [62, 100], w: [74, 104], k: [104, 104], f: [128, 98], k2: [104, 96], f2: [110, 124] }),
    fr({ h: [40, 82], n: [50, 90], p: [86, 90], e: [64, 88], w: [78, 90], k: [110, 82], f: [134, 74], k2: [108, 96], f2: [110, 124] })] },
  'g-bulgarian': { props: EQ.bench(36, 74, 96), holds: [{ at: 'w', t: 'db' }], dur: 3, frames: [
    fr({ h: [104, 20], n: [102, 34], p: [100, 70], e: [103, 52], w: [104, 68], k: [110, 96], f: [112, 124], k2: [84, 92], f2: [62, 94] }),
    fr({ h: [102, 42], n: [100, 56], p: [96, 92], e: [101, 74], w: [102, 90], k: [120, 100], f: [112, 124], k2: [82, 116], f2: [62, 96] })] },
  'g-cablekick': { props: EQ.tower(142, 120), cables: [{ from: [147, 120], to: 'f' }], holds: [{ at: 'f', t: 'pad' }], dur: 2.4, frames: [
    fr({ h: [114, 26], n: [108, 38], p: [98, 72], e: [118, 48], w: [132, 52], k: [97, 98], f: [94, 122], k2: [101, 98], f2: [100, 124] }),
    fr({ h: [114, 26], n: [108, 38], p: [98, 72], e: [118, 48], w: [132, 52], k: [78, 88], f: [54, 82], k2: [101, 98], f2: [100, 124] })] },
  'g-abduction': { front: true, props: EQ.pad(88, 44, 24, 44) + EQ.pad(82, 88, 36, 7), holds: [{ at: 'k', t: 'pad', dx: -6 }, { at: 'k2', t: 'pad', dx: 6 }], dur: 2.6, frames: [
    fr({ h: [100, 38], n: [100, 52], p: [100, 88], e: [90, 64], w: [88, 80], e2: [110, 64], w2: [112, 80], k: [95, 96], f: [93, 120], k2: [105, 96], f2: [107, 120] }),
    fr({ h: [100, 38], n: [100, 52], p: [100, 88], e: [90, 64], w: [88, 80], e2: [110, 64], w2: [112, 80], k: [80, 94], f: [82, 120], k2: [120, 94], f2: [118, 120] })] },
  'g-abduction-lean': { front: true, props: EQ.pad(88, 44, 24, 44) + EQ.pad(82, 88, 36, 7), holds: [{ at: 'k', t: 'pad', dx: -6 }, { at: 'k2', t: 'pad', dx: 6 }], dur: 2.6, frames: [
    fr({ h: [100, 50], n: [100, 62], p: [100, 88], e: [90, 72], w: [88, 86], e2: [110, 72], w2: [112, 86], k: [95, 96], f: [93, 120], k2: [105, 96], f2: [107, 120] }),
    fr({ h: [100, 50], n: [100, 62], p: [100, 88], e: [90, 72], w: [88, 86], e2: [110, 72], w2: [112, 86], k: [80, 94], f: [82, 120], k2: [120, 94], f2: [118, 120] })] },
  'g-cableabd': { front: true, props: EQ.tower(146, 120), cables: [{ from: [151, 120], to: 'f' }], holds: [{ at: 'f', t: 'pad' }], dur: 2.4, frames: [
    fr({ ...FR, e: [92, 52], w: [90, 66], e2: [114, 46], w2: [128, 48], k: [94, 98], f: [92, 122] }),
    fr({ ...FR, e: [92, 52], w: [90, 66], e2: [114, 46], w2: [128, 48], k: [86, 96], f: [72, 117] })] },
  'g-legcurl': { props: EQ.bench(28, 132, 100), holds: [{ at: 'f', t: 'pad', dy: -5 }], dur: 2.4, frames: [
    fr({ h: [38, 90], n: [50, 94], p: [86, 96], e: [46, 107], w: [40, 114], k: [112, 96], f: [137, 96] }),
    fr({ h: [38, 90], n: [50, 94], p: [86, 96], e: [46, 107], w: [40, 114], k: [112, 96], f: [120, 72] })] },
  'g-lunge-db': { holds: [{ at: 'w', t: 'db' }], dur: 3, frames: [
    fr({ ...ST, e: [101, 54], w: [102, 70], k2: [99, 98], f2: [98, 124] }),
    fr({ h: [100, 40], n: [100, 54], p: [100, 90], e: [101, 72], w: [102, 88], k: [124, 96], f: [126, 124], k2: [90, 116], f2: [68, 122] })] },
  'g-curtsy': { front: true, holds: [{ at: 'w', t: 'db' }, { at: 'w2', t: 'db' }], dur: 3, frames: [
    fr({ ...FR, ...ARMS_DOWN_FR }),
    fr({ h: [100, 38], n: [100, 52], p: [100, 88], e: [90, 68], w: [88, 83], e2: [110, 68], w2: [112, 83], k: [91, 106], f: [91, 124], k2: [94, 112], f2: [76, 122] })] },
  'g-slrdl': { holds: [{ at: 'w', t: 'db' }], dur: 3.2, frames: [
    fr({ h: [100, 22], n: [100, 36], p: [100, 72], e: [102, 54], w: [103, 70], k: [97, 98], f: [93, 121], k2: [101, 98], f2: [100, 124] }),
    fr({ h: [141, 55], n: [128, 60], p: [96, 72], e: [128, 75], w: [128, 90], k: [72, 72], f: [47, 70], k2: [101, 98], f2: [100, 124] })] },
  'g-bandwalk': { front: true, links: [['k', 'k2']], dur: 1.8, frames: [
    fr({ h: [100, 26], n: [100, 40], p: [100, 76], e: [92, 52], w: [100, 58], e2: [108, 52], w2: [100, 58], k: [92, 100], f: [88, 124], k2: [108, 100], f2: [112, 124] }),
    fr({ h: [100, 26], n: [100, 40], p: [100, 76], e: [92, 52], w: [100, 58], e2: [108, 52], w2: [100, 58], k: [84, 100], f: [74, 124], k2: [108, 100], f2: [112, 124] })] },
  'g-latstep': { front: true, props: EQ.box(110, 146, 104), dur: 3, frames: [
    fr({ h: [96, 24], n: [96, 38], p: [96, 74], e: [88, 54], w: [86, 70], e2: [104, 54], w2: [106, 70], k: [92, 99], f: [90, 124], k2: [110, 90], f2: [118, 104] }),
    fr({ h: [116, 12], n: [116, 26], p: [116, 60], e: [108, 42], w: [106, 58], e2: [124, 42], w2: [126, 58], k: [106, 84], f: [100, 104], k2: [120, 84], f2: [120, 104] })] },
  'g-sideplank': { front: true, dur: 2.6, frames: [
    fr({ h: [40, 90], n: [50, 100], p: [85, 108], e: [50, 121], w: [66, 122], e2: [64, 98], w2: [78, 104], k: [110, 114], f: [136, 120], k2: [110, 112], f2: [136, 117] }),
    fr({ h: [40, 90], n: [50, 100], p: [85, 108], e: [50, 121], w: [66, 122], e2: [64, 98], w2: [78, 104], k: [110, 114], f: [136, 120], k2: [109, 96], f2: [133, 86] })] },
  'g-hydrant': { dur: 2.4, frames: [fr(QUAD), fr({ ...QUAD, k: [92, 98], f: [70, 100] })] },
  'g-clamshell': { front: true, links: [['k', 'k2']], dur: 2.4, frames: [
    fr({ h: [34, 104], n: [48, 110], p: [86, 114], e: [56, 120], w: [70, 122], e2: [42, 118], w2: [34, 110], k: [106, 119], f: [128, 118], k2: [106, 122], f2: [128, 121] }),
    fr({ h: [34, 104], n: [48, 110], p: [86, 114], e: [56, 120], w: [70, 122], e2: [42, 118], w2: [34, 110], k: [102, 98], f: [128, 116], k2: [106, 122], f2: [128, 121] })] },
  'g-sumo': { front: true, holds: [{ at: 'w', t: 'kb', dx: 1 }], dur: 3, frames: [
    fr({ h: [100, 40], n: [100, 54], p: [100, 88], e: [96, 72], w: [99, 88], e2: [104, 72], w2: [101, 88], k: [80, 100], f: [78, 124], k2: [120, 100], f2: [122, 124] }),
    fr({ h: [100, 22], n: [100, 36], p: [100, 72], e: [97, 54], w: [99, 70], e2: [103, 54], w2: [101, 70], k: [88, 98], f: [78, 124], k2: [112, 98], f2: [122, 124] })] },
  'g-backext': { props: '<polyline class="eq-frame" points="56,124 92,96 108,124"/><polygon class="eq" points="86,82 106,98 100,106 80,90"/><circle class="eq" cx="64" cy="117" r="5"/>', dur: 3, frames: [
    fr({ h: [129, 122], n: [120, 112], p: [96, 88], e: [112, 104], w: [122, 102], k: [78, 104], f: [60, 120] }),
    fr({ h: [133, 55], n: [123, 64], p: [96, 88], e: [116, 74], w: [126, 73], k: [78, 104], f: [60, 120] })] },
};

/* ---------- Thuis trainen: Action-pilatesbord ----------
   Langwerpig bord met glijplaat (slede) in het midden, handgrepen aan de uiteinden en koorden met handvatten. */
const CORD_START = 'Haak de koorden aan het bord en ga in het midden op het bord staan, handvatten in je handen.';
const PILATES_EXERCISES = [
  { id: 'pb-squat', name: 'Squat met koorden', kind: 'reps', pose: 'p-squat', equipment: 'Bord + koorden', steps: [
    CORD_START, 'Handvatten op schouderhoogte, ellebogen naar voren.',
    'Zak met je billen naar achteren alsof je gaat zitten; knieën in lijn met je tenen.',
    'Duw via je hielen omhoog en span bovenin je billen aan.'] },
  { id: 'pb-curl', name: 'Biceps curl met koorden', kind: 'reps', pose: 'p-curl', equipment: 'Bord + koorden', steps: [
    CORD_START, 'Armen gestrekt, handpalmen naar voren, ellebogen tegen je zij.',
    'Krul de handvatten omhoog richting je schouders.', 'Laat in 2–3 tellen langzaam zakken.'] },
  { id: 'pb-press', name: 'Squat to press met koorden', kind: 'reps', pose: 'p-press', equipment: 'Bord + koorden', steps: [
    CORD_START, 'Zak in een squat met de handvatten op schouderhoogte.',
    'Kom krachtig omhoog en druk tegelijk de handvatten boven je hoofd.',
    'Laat de armen gecontroleerd zakken terwijl je weer squat.'] },
  { id: 'pb-deadlift', name: 'Romanian deadlift met koorden', kind: 'reps', pose: 'p-deadlift', equipment: 'Bord + koorden', steps: [
    CORD_START, 'Knieën licht gebogen, handvatten voor je bovenbenen.',
    'Duw je billen naar achteren en buig voorover met een rechte rug.',
    'Kom omhoog door je heupen naar voren te duwen en je billen aan te spannen.'] },
  { id: 'pb-row', name: 'Zittende row met koorden', kind: 'reps', pose: 'p-row', equipment: 'Bord + koorden', steps: [
    'Ga op het bord zitten, benen gestrekt richting het uiteinde met de koorden.',
    'Pak de handvatten vast, armen gestrekt, rug lang.',
    'Trek de handvatten naar je onderbuik, ellebogen langs je lichaam.',
    'Knijp je schouderbladen samen en laat gecontroleerd terug.'] },
  { id: 'pb-slide-lunge', name: 'Glij-lunge naar achteren', kind: 'reps', pose: 'p-slide-lunge', equipment: 'Bord + glijplaat', steps: [
    'Zet je voorste voet stevig op het vaste deel van het bord.',
    'Zet je achterste voet op de glijplaat (slede).',
    'Schuif de slede naar achteren en zak tot je voorste knie ± 90° is.',
    'Trek de slede terug met je voorste been en bil. Wissel na de set.'] },
  { id: 'pb-side-slide', name: 'Zijwaartse glij-lunge', kind: 'reps', pose: 'p-side-slide', equipment: 'Bord + glijplaat', steps: [
    'Sta met één voet op het vaste deel, de andere voet op de slede.',
    'Buig je standbeen en schuif de slede zijwaarts weg.',
    'Borst omhoog, knie boven je tenen.',
    'Trek de slede terug met de binnenkant van je been en je bil. Wissel na de set.'] },
  { id: 'pb-knee-tuck', name: 'Knee tuck op de slede', kind: 'reps', pose: 'p-knee-tuck', equipment: 'Handgrepen + glijplaat', steps: [
    'Handen op de handgrepen onder je schouders, voeten op de slede.',
    'Kom in een rechte plank.',
    'Trek je knieën naar je borst; de slede schuift mee.',
    'Schuif rustig terug naar de plank. Buik blijft aan.'] },
  { id: 'pb-pike', name: 'Pike op de slede', kind: 'reps', pose: 'p-pike', equipment: 'Handgrepen + glijplaat', steps: [
    'Start in plank: handen op de handgrepen, voeten op de slede.',
    'Duw je heupen omhoog richting het plafond; benen blijven gestrekt.',
    'De slede schuift naar je handen toe.',
    'Rol gecontroleerd terug naar de plank.'] },
  { id: 'pb-rollout', name: 'Rollout knielend', kind: 'reps', pose: 'p-rollout', equipment: 'Bord + glijplaat', steps: [
    'Kniel op het bord, handen op de slede onder je schouders.',
    'Span je buik aan en houd je rug recht.',
    'Schuif de slede langzaam naar voren tot je je buik voelt werken.',
    'Trek de slede terug met je buik (niet met je rug).'] },
  { id: 'pb-ham-slide', name: 'Bridge + hamstring-glij', kind: 'reps', pose: 'p-ham-slide', equipment: 'Mat + glijplaat', steps: [
    'Lig op je rug op de mat, hielen op de slede.',
    'Duw je heupen omhoog in een bridge.',
    'Trek je hielen naar je billen; de slede schuift mee.',
    'Schuif je benen weer uit zonder je heupen te laten zakken.'] },
  { id: 'pb-slide-kick', name: 'Glijdende kickback', kind: 'reps', pose: 'p-slide-kick', equipment: 'Bord + glijplaat', steps: [
    'Kom op handen en knieën op het bord, één knie/voet op de slede.',
    'Rug recht, buik aan.',
    'Schuif je been naar achteren tot het gestrekt is; knijp je bil aan.',
    'Trek de slede rustig terug. Wissel na de set.'] },
  { id: 'pb-pushup', name: 'Push-ups op de handgrepen', kind: 'reps', pose: 'p-pushup', equipment: 'Handgrepen', steps: [
    'Pak de handgrepen vast, iets breder dan je schouders.',
    'Kom in een plank (op je knieën = lichter).',
    'Zak met je borst richting het bord, ellebogen schuin naar achteren.',
    'Duw jezelf weer omhoog.'] },
  { id: 'pb-plank', name: 'Plank op het bord', kind: 'time', pose: 'p-plank', equipment: 'Bord', steps: [
    'Onderarmen op het bord, ellebogen onder je schouders.',
    'Benen gestrekt, op je tenen (op je knieën = lichter).',
    'Rechte lijn van hoofd tot hielen; buik en billen aan.',
    'Blijf rustig doorademen tot de tijd om is.'] },
  { id: 'pb-bridge', name: 'Glute bridge', kind: 'reps', pose: 'bridge', equipment: 'Mat', steps: [
    'Lig op je rug, knieën gebogen, voeten plat.', 'Armen naast je lichaam.',
    'Duw je heupen omhoog tot er een rechte lijn is van knieën tot schouders.',
    'Knijp je billen 1 tel aan en laat langzaam zakken.'] },
  { id: 'pb-birddog', name: 'Bird-dog', kind: 'reps', pose: 'birddog', equipment: 'Mat', steps: [
    'Begin op handen en knieën met een neutrale rug.',
    'Strek tegelijk je ene arm naar voren en je andere been naar achteren.',
    'Houd 2 tellen vast zonder te kantelen.', 'Terug naar het midden en wissel van kant.'] },
  { id: 'pb-deadbug', name: 'Dead bug', kind: 'reps', pose: 'deadbug', equipment: 'Mat', steps: [
    'Lig op je rug, armen recht omhoog, knieën 90° boven je heupen.', 'Druk je onderrug tegen de vloer.',
    'Strek tegelijk één arm naar achteren en het andere been naar voren.', 'Terug naar het midden en wissel van kant.'] },
  { id: 'pb-hundred', name: 'The Hundred', kind: 'time', pose: 'hundred', equipment: 'Mat', steps: [
    'Lig op je rug, krul hoofd en schouders op; benen schuin omhoog (knieën gebogen = lichter).',
    'Armen gestrekt naast je lichaam, net boven de grond.',
    'Pomp je armen klein en snel op en neer.', 'Adem 5 pompen in en 5 pompen uit.'] },
].map((e) => ({ ...e, program: 'pilates' }));

const PILATES_LEVELS = [
  { id: 'light', name: 'Licht', emoji: '🌸', rest: 45, desc: 'Rustig opbouwen, 2 sets, veel rust.', items: [
    { exerciseId: 'pb-squat', sets: 2, reps: 12 },
    { exerciseId: 'pb-curl', sets: 2, reps: 12 },
    { exerciseId: 'pb-row', sets: 2, reps: 12 },
    { exerciseId: 'pb-bridge', sets: 2, reps: 12 },
    { exerciseId: 'pb-ham-slide', sets: 2, reps: 8 },
    { exerciseId: 'pb-birddog', sets: 2, reps: 8, perSide: true },
    { exerciseId: 'pb-deadbug', sets: 2, reps: 8, perSide: true },
  ] },
  { id: 'medium', name: 'Medium', emoji: '🌷', rest: 40, desc: '3 sets, koorden + glijplaat.', items: [
    { exerciseId: 'pb-press', sets: 3, reps: 12 },
    { exerciseId: 'pb-slide-lunge', sets: 3, reps: 10, perSide: true },
    { exerciseId: 'pb-row', sets: 3, reps: 12 },
    { exerciseId: 'pb-deadlift', sets: 3, reps: 12 },
    { exerciseId: 'pb-knee-tuck', sets: 3, reps: 10 },
    { exerciseId: 'pb-ham-slide', sets: 3, reps: 10 },
    { exerciseId: 'pb-plank', sets: 3, sec: 30 },
  ] },
  { id: 'heavy', name: 'Zwaar', emoji: '🔥', rest: 30, desc: '3–4 sets, korte rust, volle body.', items: [
    { exerciseId: 'pb-press', sets: 4, reps: 15 },
    { exerciseId: 'pb-slide-lunge', sets: 4, reps: 12, perSide: true },
    { exerciseId: 'pb-side-slide', sets: 3, reps: 10, perSide: true },
    { exerciseId: 'pb-pike', sets: 3, reps: 10 },
    { exerciseId: 'pb-rollout', sets: 3, reps: 10 },
    { exerciseId: 'pb-slide-kick', sets: 3, reps: 12, perSide: true },
    { exerciseId: 'pb-pushup', sets: 3, reps: 10 },
    { exerciseId: 'pb-ham-slide', sets: 3, reps: 12 },
    { exerciseId: 'pb-hundred', sets: 3, sec: 60 },
  ] },
];

/* ---------- Basic-Fit ---------- */
const GYM_EXERCISES = [
  // Armen (alles staand / zonder bankje)
  { id: 'bf-cable-curl', name: 'Biceps curl aan de kabel (staand)', pose: 'g-cablecurl', tip: 'Ellebogen tegen je zij, niet zwaaien met je rug.', alts: ['bf-db-curl', 'bf-ez-curl', 'bf-hammer-curl'] },
  { id: 'bf-db-curl', name: 'Dumbbell curl (staand)', pose: 'g-dbcurl', tip: 'Draai je handpalmen naar boven tijdens het omhoog komen.', alts: ['bf-cable-curl', 'bf-ez-curl'] },
  { id: 'bf-ez-curl', name: 'EZ-bar curl (staand)', pose: 'g-bbcurl', tip: 'Schouders laag, ellebogen stil.', alts: ['bf-cable-curl', 'bf-db-curl'] },
  { id: 'bf-hammer-curl', name: 'Hammer curl (dumbbells, staand)', pose: 'g-dbcurl', tip: 'Duimen naar boven, rustig laten zakken.', alts: ['bf-rope-hammer', 'bf-db-curl'] },
  { id: 'bf-rope-hammer', name: 'Hammer curl met touw (kabel)', pose: 'g-cablecurl', tip: 'Touw laag aan de kabel, ellebogen langs je lichaam.', alts: ['bf-hammer-curl'] },
  { id: 'bf-pushdown', name: 'Triceps pushdown (kabel, touw)', pose: 'g-pushdown', tip: 'Ellebogen vast naast je lichaam, onderin het touw uit elkaar trekken.', alts: ['bf-pushdown-bar', 'bf-db-kickback', 'bf-dip-machine'] },
  { id: 'bf-pushdown-bar', name: 'Triceps pushdown (kabel, stang)', pose: 'g-pushdown', tip: 'Polsen recht, alleen je onderarmen bewegen.', alts: ['bf-pushdown', 'bf-db-kickback'] },
  { id: 'bf-oh-cable-ext', name: 'Overhead triceps extension (kabel, staand)', pose: 'g-ohcable', tip: 'Met je rug naar de kabel, ellebogen naast je hoofd.', alts: ['bf-db-oh-ext', 'bf-dip-machine', 'bf-db-kickback'] },
  { id: 'bf-db-oh-ext', name: 'Overhead triceps extension (dumbbell, staand)', pose: 'g-ohdb', tip: 'Eén dumbbell met twee handen achter je hoofd; buik aan.', alts: ['bf-oh-cable-ext'] },
  { id: 'bf-db-kickback', name: 'Triceps kickback (dumbbell, voorovergebogen)', pose: 'g-tricepkick', tip: 'Bovenarm langs je lichaam, strek je arm naar achteren.', alts: ['bf-pushdown'] },
  { id: 'bf-dip-machine', name: 'Dip machine', pose: 'g-dipmachine', tip: 'Schouders omlaag, druk de handgrepen naar beneden.', alts: ['bf-pushdown'] },
  { id: 'bf-db-shoulder-press', name: 'Shoulder press (dumbbells, staand)', pose: 'g-dbpress', tip: 'Buik en billen aan, niet hol trekken.', alts: ['bf-shoulder-press-machine', 'bf-arnold'] },
  { id: 'bf-arnold', name: 'Arnold press (staand)', pose: 'g-dbpress', tip: 'Start met handpalmen naar je toe en draai tijdens het drukken.', alts: ['bf-db-shoulder-press'] },
  { id: 'bf-shoulder-press-machine', name: 'Shoulder press machine', pose: 'g-seatpress', tip: 'Handgrepen op schouderhoogte, rug tegen het kussen.', alts: ['bf-db-shoulder-press'] },
  { id: 'bf-lateral-raise', name: 'Lateral raise (dumbbells)', pose: 'g-lateral', tip: 'Til tot schouderhoogte, ellebogen licht gebogen, licht gewicht.', alts: ['bf-cable-lateral'] },
  { id: 'bf-cable-lateral', name: 'Lateral raise (kabel)', pose: 'g-cablelateral', tip: 'Kabel laag, trek zijwaarts op tot schouderhoogte.', alts: ['bf-lateral-raise'] },
  { id: 'bf-face-pull', name: 'Face pull (kabel)', pose: 'g-facepull', tip: 'Touw op ooghoogte, trek naar je gezicht, ellebogen hoog.', alts: ['bf-reverse-fly'] },
  { id: 'bf-reverse-fly', name: 'Reverse fly machine', pose: 'g-revfly', tip: 'Borst tegen het kussen, armen wijd naar achteren.', alts: ['bf-face-pull'] },
  // Full body
  { id: 'bf-leg-press', name: 'Leg press', pose: 'g-legpress', tip: 'Onderrug blijft tegen het kussen; knieën niet op slot.' },
  { id: 'bf-lat-pulldown', name: 'Lat pulldown', pose: 'g-pulldown', tip: 'Trek de stang naar je bovenborst, borst omhoog.', alts: ['bf-assisted-pullup'] },
  { id: 'bf-assisted-pullup', name: 'Assisted pull-up machine', pose: 'g-pulldown', tip: 'Meer gewicht = meer hulp.', alts: ['bf-lat-pulldown'] },
  { id: 'bf-chest-press', name: 'Chest press machine', pose: 'g-chestpress', tip: 'Handgrepen op borsthoogte, schouderbladen naar achteren.', alts: ['bf-cable-chest-press'] },
  { id: 'bf-cable-chest-press', name: 'Chest press aan de kabel (staand)', pose: 'g-cablechest', tip: 'Stap naar voren, druk de handvatten voor je borst uit.', alts: ['bf-chest-press'] },
  { id: 'bf-seated-row', name: 'Seated row (kabel)', pose: 'g-seatedrow', tip: 'Rechte rug, trek naar je navel, schouderbladen samen.' },
  { id: 'bf-db-rdl', name: 'Romanian deadlift (dumbbells)', pose: 'g-rdl-db', tip: 'Billen naar achteren, rug recht, dumbbells langs je benen.', alts: ['bf-bb-rdl'] },
  { id: 'bf-ab-crunch', name: 'Abdominal crunch machine', pose: 'g-abcrunch', tip: 'Rol je bovenlichaam in, uitademen bij het aanspannen.', alts: ['bf-cable-crunch'] },
  { id: 'bf-cable-crunch', name: 'Cable crunch (knielend)', pose: 'g-cablecrunch', tip: 'Touw bij je hoofd, krul je naar beneden vanuit je buik.', alts: ['bf-ab-crunch'] },
  // Bil 1 — gluteus maximus
  { id: 'bf-hip-thrust', name: 'Hip thrust (halterstang)', pose: 'g-hipthrust', tip: 'Kin naar je borst, duw via je hielen, bovenin 1 tel knijpen.', alts: ['bf-hip-thrust-machine', 'bf-smith-hip-thrust'] },
  { id: 'bf-hip-thrust-machine', name: 'Hip thrust machine', pose: 'g-hipthrust', tip: 'Voeten zo dat je scheenbenen bovenin verticaal staan.', alts: ['bf-hip-thrust', 'bf-smith-hip-thrust'] },
  { id: 'bf-smith-hip-thrust', name: 'Hip thrust (Smith machine)', pose: 'g-hipthrust', tip: 'Gebruik een kussen voor de stang op je heupen.', alts: ['bf-hip-thrust', 'bf-hip-thrust-machine'] },
  { id: 'bf-bb-rdl', name: 'Romanian deadlift (halterstang)', pose: 'g-rdl-bb', tip: 'Stang langs je benen, heupen naar achteren, rug recht.', alts: ['bf-db-rdl'] },
  { id: 'bf-bulgarian', name: 'Bulgarian split squat (dumbbells)', pose: 'g-bulgarian', tip: 'Iets voorover leunen = meer bil. Achterste voet op een verhoging.', alts: ['bf-walking-lunge'] },
  { id: 'bf-glute-kickback-machine', name: 'Glute kickback machine', pose: 'g-cablekick', tip: 'Rustig terug, niet doorzwaaien met je onderrug.', alts: ['bf-cable-kickback'] },
  { id: 'bf-cable-kickback', name: 'Cable kickback', pose: 'g-cablekick', tip: 'Enkelband aan de kabel, been recht naar achteren, bil aanspannen.', alts: ['bf-glute-kickback-machine'] },
  { id: 'bf-back-ext', name: 'Back extension (bil-focus)', pose: 'g-backext', tip: 'Ronde bovenrug, voeten naar buiten, knijp je billen om omhoog te komen.' },
  { id: 'bf-walking-lunge', name: 'Walking lunges (dumbbells)', pose: 'g-lunge-db', tip: 'Grote stappen, voorste knie boven je enkel.', alts: ['bf-bulgarian'] },
  { id: 'bf-leg-curl', name: 'Leg curl (liggend)', pose: 'g-legcurl', tip: 'Langzaam terug laten komen (3 tellen).' },
  // Bil 2 — gluteus medius (zijkant)
  { id: 'bf-abduction', name: 'Hip abduction machine (rechtop)', pose: 'g-abduction', tip: 'Rechtop zitten, knieën rustig naar buiten duwen, langzaam terug.', alts: ['bf-cable-abduction'] },
  { id: 'bf-cable-abduction', name: 'Cable abduction (staand)', pose: 'g-cableabd', tip: 'Enkelband, been zijwaarts weg, bovenlichaam stil.', alts: ['bf-abduction'] },
  { id: 'bf-band-walk', name: 'Lateral band walk (mini-band)', pose: 'g-bandwalk', tip: 'Kleine squat, band boven je knieën, zijwaartse stappen zonder de band te laten verslappen.', alts: ['bf-cable-abduction'] },
  { id: 'bf-curtsy', name: 'Curtsy lunge (dumbbells)', pose: 'g-curtsy', tip: 'Stap schuin achter je standbeen langs, heupen recht naar voren.', alts: ['bf-walking-lunge'] },
  { id: 'bf-sl-rdl', name: 'Single-leg RDL (dumbbell)', pose: 'g-slrdl', tip: 'Heupen recht houden, standbeen licht gebogen.', alts: ['bf-db-rdl'] },
  { id: 'bf-lateral-stepup', name: 'Laterale step-up (box)', pose: 'g-latstep', tip: 'Zijwaarts op de box stappen, duw via de hiel van je bovenste been.' },
  { id: 'bf-side-plank-raise', name: 'Zijplank met beenheffing', pose: 'g-sideplank', tip: 'Heupen hoog, til je bovenste been rustig op en neer.' },
  // Bil 3 — gluteus minimus (diep)
  { id: 'bf-abduction-lean', name: 'Hip abduction machine (voorover leunend)', pose: 'g-abduction-lean', tip: 'Leun naar voren (heupflexie) — zo werk je dieper in de kleine bilspier.', alts: ['bf-abduction'] },
  { id: 'bf-diag-kickback', name: 'Diagonale cable kickback (45° naar buiten)', pose: 'g-cablekick', tip: 'Kick schuin naar achteren-buiten, tenen licht naar binnen.', alts: ['bf-cable-kickback'] },
  { id: 'bf-fire-hydrant', name: 'Fire hydrant (mini-band)', pose: 'g-hydrant', tip: 'Op handen en knieën, knie zijwaarts optillen, bekken stil.', alts: ['bf-clamshell'] },
  { id: 'bf-clamshell', name: 'Clamshell (mini-band)', pose: 'g-clamshell', tip: 'Op je zij, voeten tegen elkaar, bovenste knie openen. Niet wegdraaien met je heup.', alts: ['bf-fire-hydrant'] },
  { id: 'bf-sl-hip-thrust', name: 'Single-leg hip thrust', pose: 'g-slhipthrust', tip: 'Bekken recht houden, duw via je hiel.', alts: ['bf-hip-thrust-machine'] },
  { id: 'bf-sumo-dl', name: 'Sumo deadlift (kettlebell)', pose: 'g-sumo', tip: 'Brede stand, tenen naar buiten, knieën naar buiten duwen.' },
].map((e) => ({ ...e, program: 'gym', kind: 'weights' }));

const GYM_TEMPLATES = [
  { id: 'bf-arms', name: 'Armen', note: 'Zonder bankje · ⇄ = alternatieven', items: [
    { exerciseId: 'bf-cable-curl', sets: 3, target: '10-12' },
    { exerciseId: 'bf-pushdown', sets: 3, target: '10-12' },
    { exerciseId: 'bf-db-shoulder-press', sets: 3, target: '10' },
    { exerciseId: 'bf-lateral-raise', sets: 3, target: '12-15' },
    { exerciseId: 'bf-hammer-curl', sets: 3, target: '10-12' },
    { exerciseId: 'bf-oh-cable-ext', sets: 3, target: '10-12' },
    { exerciseId: 'bf-face-pull', sets: 3, target: '12-15' },
  ] },
  { id: 'bf-full', name: 'Full Body', note: 'Alle grote spiergroepen', items: [
    { exerciseId: 'bf-leg-press', sets: 3, target: '10-12' },
    { exerciseId: 'bf-lat-pulldown', sets: 3, target: '10-12' },
    { exerciseId: 'bf-chest-press', sets: 3, target: '10-12' },
    { exerciseId: 'bf-seated-row', sets: 3, target: '10-12' },
    { exerciseId: 'bf-db-rdl', sets: 3, target: '10' },
    { exerciseId: 'bf-shoulder-press-machine', sets: 3, target: '10-12' },
    { exerciseId: 'bf-ab-crunch', sets: 3, target: '12-15' },
  ] },
  { id: 'bf-bil1', name: 'Bil 1', focus: 'maximus', note: 'Gluteus maximus · de grote bilspier', items: [
    { exerciseId: 'bf-hip-thrust', sets: 4, target: '8-10' },
    { exerciseId: 'bf-bb-rdl', sets: 3, target: '10' },
    { exerciseId: 'bf-bulgarian', sets: 3, target: '10 per been' },
    { exerciseId: 'bf-glute-kickback-machine', sets: 3, target: '12 per been' },
    { exerciseId: 'bf-back-ext', sets: 3, target: '12' },
    { exerciseId: 'bf-walking-lunge', sets: 2, target: '20 stappen' },
    { exerciseId: 'bf-leg-press', sets: 3, target: '12 (voeten hoog & breed)' },
  ] },
  { id: 'bf-bil2', name: 'Bil 2', focus: 'medius', note: 'Gluteus medius · zijkant van de bil', items: [
    { exerciseId: 'bf-abduction', sets: 4, target: '15' },
    { exerciseId: 'bf-cable-abduction', sets: 3, target: '12 per been' },
    { exerciseId: 'bf-band-walk', sets: 3, target: '12 stappen per kant' },
    { exerciseId: 'bf-curtsy', sets: 3, target: '10 per been' },
    { exerciseId: 'bf-sl-rdl', sets: 3, target: '10 per been' },
    { exerciseId: 'bf-lateral-stepup', sets: 3, target: '10 per been' },
    { exerciseId: 'bf-side-plank-raise', sets: 3, target: '10 per kant' },
  ] },
  { id: 'bf-bil3', name: 'Bil 3', focus: 'minimus', note: 'Gluteus minimus · de diepe, kleine bilspier', items: [
    { exerciseId: 'bf-abduction-lean', sets: 4, target: '15' },
    { exerciseId: 'bf-diag-kickback', sets: 3, target: '12 per been' },
    { exerciseId: 'bf-fire-hydrant', sets: 3, target: '12 per kant' },
    { exerciseId: 'bf-clamshell', sets: 3, target: '15 per kant' },
    { exerciseId: 'bf-sl-hip-thrust', sets: 3, target: '10 per been' },
    { exerciseId: 'bf-sumo-dl', sets: 3, target: '10' },
    { exerciseId: 'bf-hip-thrust-machine', sets: 3, target: '12 (brede stand)' },
  ] },
].map((t) => ({ ...t, program: 'gym' }));

const GLUTE_INFO = {
  maximus: { name: 'Gluteus maximus', short: 'grote bilspier' },
  medius: { name: 'Gluteus medius', short: 'zijkant van de bil' },
  minimus: { name: 'Gluteus minimus', short: 'diepe kleine bilspier' },
};

/* ---------- Hardloopschema: 10 weken × 3 trainingen ----------
   Elke training: 5 min warming-up wandelen + segmenten + 5 min cooling-down wandelen.
   seg = [type, minuten | null, label?]  (null = op afstand, bv. 5 km) */
const iv = (run, walk, n) => Array.from({ length: n }, () => [['run', run], ['walk', walk]]).flat();
const tr = (desc, total, segs) => ({ desc, total, segs });
const RUN_PLAN = [
  [tr('1 min hardlopen, 1 min wandelen — 5×', '20 min', iv(1, 1, 5)),
    tr('1 min hardlopen, 1 min wandelen — 6×', '22 min', iv(1, 1, 6)),
    tr('1 min hardlopen, 1 min wandelen — 7×', '24 min', iv(1, 1, 7))],
  [tr('2 min hardlopen, 1 min wandelen — 4×', '22 min', iv(2, 1, 4)),
    tr('2 min hardlopen, 1 min wandelen — 5×', '25 min', iv(2, 1, 5)),
    tr('2 min hardlopen, 1 min wandelen — 6×', '28 min', iv(2, 1, 6))],
  [tr('3 min hardlopen, 1 min wandelen — 4×', '26 min', iv(3, 1, 4)),
    tr('2 min hardlopen, 1 min wandelen — 4×', '26 min', iv(2, 1, 4)),
    tr('2 min hardlopen, 2 min wandelen — 5×', '30 min', iv(2, 2, 5))],
  [tr('4 min hardlopen, 1 min wandelen — 4×', '30 min', iv(4, 1, 4)),
    tr('4 min hardlopen, 1 min wandelen — 4×', '30 min', iv(4, 1, 4)),
    tr('3 min hardlopen, 2 min wandelen — 4×', '30 min', iv(3, 2, 4))],
  [tr('5 min hardlopen, 1 min wandelen — 3×', '28 min', iv(5, 1, 3)),
    tr('5 min hardlopen, 1 min wandelen — 3×', '28 min', iv(5, 1, 3)),
    tr('4 min hardlopen, 2 min wandelen — 5×', '40 min', iv(4, 2, 5))],
  [tr('7 min hardlopen, 1 min wandelen — 2×', '26 min', iv(7, 1, 2)),
    tr('7 min hardlopen, 1 min wandelen — 2×', '26 min', iv(7, 1, 2)),
    tr('6 min hardlopen, 2 min wandelen — 3×', '34 min', iv(6, 2, 3))],
  [tr('10 min hardlopen, 1 min wandelen — 2×', '32 min', iv(10, 1, 2)),
    tr('10 min hardlopen, 1 min wandelen — 2×', '32 min', iv(10, 1, 2)),
    tr('8 min hardlopen, 2 min wandelen — 3×', '34 min', iv(8, 2, 3))],
  [tr('15 min hardlopen, 1 min wandelen, 5 min hardlopen', '31 min', [['run', 15], ['walk', 1], ['run', 5]]),
    tr('10 min hardlopen, 1 min wandelen, 15 min hardlopen', '36 min', [['run', 10], ['walk', 1], ['run', 15]]),
    tr('15 min hardlopen, 1 min wandelen, 10 min hardlopen', '36 min', [['run', 15], ['walk', 1], ['run', 10]])],
  [tr('15 min hardlopen, 1 min wandelen, 5 min hardlopen', '36 min', [['run', 15], ['walk', 1], ['run', 5]]),
    tr('15 min hardlopen, 1 min wandelen, 10 min hardlopen', '36 min', [['run', 15], ['walk', 1], ['run', 10]]),
    tr('20 min hardlopen, 1 min wandelen, 10 min hardlopen', '41 min', [['run', 20], ['walk', 1], ['run', 10]])],
  [tr('25 min hardlopen', '35 min', [['run', 25]]),
    tr('25 min hardlopen, 1 min wandelen, 4 min hardlopen', '40 min', [['run', 25], ['walk', 1], ['run', 4]]),
    tr('5 km hardlopen 🎉', '5 km + 10 min', [['run', null, '5 km']])],
];

/* ---------- Hartslagzones (% van max-HR of van HR-reserve) ---------- */
const HR_ZONES = [
  { from: 50, to: 60, name: 'Zone 1 · Herstel', feel: 'Heel rustig, wandelen / warming-up' },
  { from: 60, to: 70, name: 'Zone 2 · Basis', feel: 'Rustig hardlopen, je kunt nog praten' },
  { from: 70, to: 80, name: 'Zone 3 · Aeroob', feel: 'Stevig, korte zinnen' },
  { from: 80, to: 90, name: 'Zone 4 · Drempel', feel: 'Zwaar, nog maar een paar woorden' },
  { from: 90, to: 100, name: 'Zone 5 · Maximaal', feel: 'Sprint, kort vol te houden' },
];

const CATALOG = [...PILATES_EXERCISES, ...GYM_EXERCISES];
