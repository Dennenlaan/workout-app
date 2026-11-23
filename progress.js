'use strict';
/* =========================================================
   Voortgang: grafiek per oefening, lichaamsgewicht (weekgemiddelden) en cm-metingen.
   Alles staat in de db van het gekozen profiel (Mama/Senna) — zie CLAUDE.md.
   Laadt NA app.js (gebruikt db, esc, fmtNum, fmtDate, exById, …).
   ========================================================= */

/* ---------- Grafiek (inline SVG, één y-as, hover-crosshair + tooltip) ----------
   Kleuren: roze = hoofdreeks, groen = tweede reeks. Gevalideerd (dataviz-validator, light):
   CVD ΔE 7,9 → daarom altijd óók een vormverschil (stippen vs. lijn) + legenda/label. */
const CHART_COLORS = ['#b64a7d', '#2f9e5b'];
const CHARTS = {};
let chartSeq = 0;

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || pow * 10;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

const shortDate = (t) => new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

/**
 * series: [{ name, points: [{ t: ms, v: number }], style: 'line' | 'dots' }]
 * Eén reeks → geen legenda (de titel noemt hem); ≥ 2 reeksen → legenda + direct label.
 */
function lineChart({ series, unit = '', title = '' }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return '<p class="muted chart-empty">Nog te weinig gegevens voor een grafiek — vanaf 2 keer zie je hier je lijn.</p>';
  const id = `ch${++chartSeq}`;
  const W = 340; const H = 200;
  const m = { l: 38, r: 16, t: 14, b: 28 };
  let t0 = Math.min(...all.map((p) => p.t)); let t1 = Math.max(...all.map((p) => p.t));
  if (t0 === t1) { t0 -= 86400000; t1 += 86400000; }
  let vMin = Math.min(...all.map((p) => p.v)); let vMax = Math.max(...all.map((p) => p.v));
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const padV = (vMax - vMin) * 0.12;
  const { lo, hi, ticks } = niceTicks(vMin - padV, vMax + padV);
  const x = (t) => m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r);
  const y = (v) => H - m.b - ((v - lo) / (hi - lo || 1)) * (H - m.t - m.b);

  const grid = ticks.map((v) => `
    <line class="ch-grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="ch-tick" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`).join('');
  const midT = t0 + (t1 - t0) / 2;
  const xLabels = [t0, midT, t1].map((t, i) => `<text class="ch-tick" x="${x(t)}" y="${H - 8}" text-anchor="${['start', 'middle', 'end'][i]}">${shortDate(t)}</text>`).join('');

  const marks = series.map((s, si) => {
    const color = CHART_COLORS[si % CHART_COLORS.length];
    const pts = [...s.points].sort((a, b) => a.t - b.t);
    const path = s.style !== 'dots' && pts.length > 1
      ? `<polyline class="ch-line" stroke="${color}" points="${pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}"/>` : '';
    const dots = pts.map((p) => `<circle class="ch-dot" cx="${x(p.t)}" cy="${y(p.v)}" r="${s.style === 'dots' ? 4 : 4}" fill="${color}"/>`).join('');
    const last = pts[pts.length - 1];
    // Selectief direct labelen: alleen de eerste lijn-reeks (de legenda benoemt de rest) → geen overlap
    const firstLine = series.findIndex((x2) => x2.style !== 'dots');
    const label = series.length > 1 && last && si === firstLine
      ? `<text class="ch-label" x="${Math.min(x(last.t) + 6, W - m.r)}" y="${y(last.v) - 10}" text-anchor="end">${esc(s.name)}</text>` : '';
    return path + dots + label;
  }).join('');

  CHARTS[id] = { unit, m, W, H, series: series.map((s) => ({ name: s.name, pts: s.points.map((p) => ({ ...p, px: x(p.t), py: y(p.v) })) })) };
  const legend = series.length > 1 ? `<div class="ch-legend">${series.map((s, si) => `
    <span><i class="sw ${s.style === 'dots' ? 'dot' : 'line'}" style="--c:${CHART_COLORS[si % CHART_COLORS.length]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `
    <figure class="chart" data-chart="${id}">
      ${title ? `<figcaption>${esc(title)}</figcaption>` : ''}
      ${legend}
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || 'Grafiek')}">
        ${grid}${xLabels}
        <line class="ch-cross" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>
        ${marks}
        <rect class="ch-hit" x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}"/>
      </svg>
      <div class="chart-tip" hidden></div>
    </figure>`;
}

/* Hover/tik: dichtstbijzijnde datum → crosshair + tooltip met alle reeksen op die datum. */
function chartPointer(e) {
  const fig = e.target.closest?.('.chart');
  if (!fig) return;
  const c = CHARTS[fig.dataset.chart];
  const svg = fig.querySelector('svg');
  if (!c || !svg) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  const allPts = c.series.flatMap((s) => s.pts);
  const near = allPts.reduce((a, b) => (Math.abs(b.px - loc.x) < Math.abs(a.px - loc.x) ? b : a));
  const cross = svg.querySelector('.ch-cross');
  cross.setAttribute('x1', near.px); cross.setAttribute('x2', near.px); cross.setAttribute('visibility', 'visible');
  const rows = c.series.map((s) => {
    const p = s.pts.reduce((a, b) => (Math.abs(b.t - near.t) < Math.abs(a.t - near.t) ? b : a), s.pts[0]);
    return p && Math.abs(p.t - near.t) < 4 * 86400000 ? `<div>${c.series.length > 1 ? `${esc(s.name)}: ` : ''}<strong>${fmtNum(p.v)} ${esc(c.unit)}</strong></div>` : '';
  }).join('');
  const tip = fig.querySelector('.chart-tip');
  tip.innerHTML = `<div class="muted">${fmtDate(new Date(near.t).toISOString())}</div>${rows}`;
  tip.hidden = false;
  const box = fig.getBoundingClientRect();
  const left = (near.px / c.W) * svg.getBoundingClientRect().width;
  tip.style.left = `${Math.max(4, Math.min(left - 60, box.width - 128))}px`;
}
function chartLeave(e) {
  const fig = e.target.closest?.('.chart');
  if (!fig) return;
  fig.querySelector('.ch-cross')?.setAttribute('visibility', 'hidden');
  const tip = fig.querySelector('.chart-tip');
  if (tip) tip.hidden = true;
}
document.addEventListener('pointermove', chartPointer, { passive: true });
document.addEventListener('pointerdown', chartPointer, { passive: true });
document.addEventListener('pointerout', (e) => { if (e.target.classList?.contains('ch-hit')) chartLeave(e); }, { passive: true });

/* ---------- Voortgang per oefening ---------- */
let progressTab = 'ex';      // 'ex' | 'weight' | 'measure'
let progressEx = null;       // gekozen oefening-id
let progressMetric = 'top';  // 'top' (zwaarste set) | 'volume'
let measureChartKey = 'taille';

/** Alle oefeningen uit de geschiedenis met hoe vaak ze gedaan zijn (meest recent eerst). */
function exerciseHistoryIndex() {
  const map = new Map();
  for (const s of db.history) {
    for (const e of s.exercises) {
      if (!e.sets.some((x) => x.done)) continue;
      const cur = map.get(e.exerciseId) || { id: e.exerciseId, name: e.name, kind: e.kind, uni: e.uni, count: 0, last: s.startedAt };
      cur.count += 1;
      map.set(e.exerciseId, cur);
    }
  }
  return [...map.values()];
}
const timesDone = (exerciseId) => exerciseHistoryIndex().find((x) => x.id === exerciseId)?.count || 0;

/** Waarde per sessie: zwaarste set / volume (kg), max reps, max sec of minuten — per kant bij L/R. */
function exerciseSeries(exerciseId, metric) {
  const sessions = [...db.history].reverse();
  const bySide = { all: [], L: [], R: [] };
  for (const s of sessions) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    if (!e) continue;
    const done = e.sets.filter((x) => x.done);
    if (!done.length) continue;
    const t = new Date(s.startedAt).getTime();
    const val = (sets) => {
      if (!sets.length) return null;
      if (e.kind === 'cardio') return metric === 'volume' ? Math.max(...sets.map((x) => x.lvl ?? 0)) : sets.reduce((n, x) => n + (x.min || 0), 0);
      if (e.kind === 'time') return Math.max(...sets.map((x) => x.sec || 0));
      if (e.kind === 'reps' || sets.every((x) => x.kg == null)) return metric === 'volume' ? sets.reduce((n, x) => n + (x.reps || 0), 0) : Math.max(...sets.map((x) => x.reps || 0));
      return metric === 'volume' ? sets.reduce((n, x) => n + (x.kg || 0) * (x.reps || 0), 0) : Math.max(...sets.map((x) => x.kg || 0));
    };
    if (done.some((x) => x.side)) {
      for (const side of ['L', 'R']) { const v = val(done.filter((x) => x.side === side)); if (v != null) bySide[side].push({ t, v }); }
    } else {
      const v = val(done); if (v != null) bySide.all.push({ t, v });
    }
  }
  return bySide;
}

function metricInfo(kind, metric) {
  if (kind === 'cardio') return metric === 'volume' ? { label: 'Niveau / helling', unit: '' } : { label: 'Minuten', unit: 'min' };
  if (kind === 'time') return { label: 'Langste set', unit: 'sec' };
  if (kind === 'reps') return metric === 'volume' ? { label: 'Totaal reps', unit: 'reps' } : { label: 'Meeste reps in één set', unit: 'reps' };
  return metric === 'volume' ? { label: 'Volume (kg × reps)', unit: 'kg' } : { label: 'Zwaarste set', unit: 'kg' };
}

function trendText(pointsIn, unit) {
  if (pointsIn.length < 2) return '';
  const points = [...pointsIn].sort((a, b) => a.t - b.t); // altijd oud → nieuw
  const first = points[0].v; const last = points[points.length - 1].v;
  const d = Math.round((last - first) * 10) / 10;
  if (d === 0) return `Gelijk gebleven (${fmtNum(last)} ${unit})`;
  return `${signed(d)} ${unit} sinds de eerste keer (${fmtNum(first)} → ${fmtNum(last)})`;
}
/** "▲ +1,5" / "▼ −1,5" / "= 0" — pijl + teken, nooit een dubbel minteken. */
const signed = (d) => (d > 0 ? `▲ +${fmtNum(d)}` : d < 0 ? `▼ −${fmtNum(Math.abs(d))}` : '= 0');

function renderExerciseProgress() {
  const idx = exerciseHistoryIndex().sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
  if (!idx.length) return '<p class="muted">Nog geen trainingen opgeslagen. Rond een workout af, dan verschijnt hier per oefening een grafiek.</p>';
  if (!progressEx || !idx.some((x) => x.id === progressEx)) progressEx = idx.find((x) => x.count >= 2)?.id || idx[0].id;
  const cur = idx.find((x) => x.id === progressEx);
  const kind = cur.kind || exById(cur.id)?.kind || 'weights';
  const canVolume = kind === 'weights' || kind === 'reps' || kind === 'cardio';
  const info = metricInfo(kind, progressMetric);
  const data = exerciseSeries(cur.id, canVolume ? progressMetric : 'top');
  const sided = data.L.length || data.R.length;
  const series = sided
    ? [{ name: 'Links', points: data.L, style: 'line' }, { name: 'Rechts', points: data.R, style: 'dots' }].filter((s) => s.points.length)
    : [{ name: info.label, points: data.all, style: 'line' }];
  // let op: kopie maken — sort() werkt in-place en zou de reeks (en dus de trendtekst) omdraaien
  const rows = (sided ? [...data.L.map((p) => ({ ...p, side: 'Links' })), ...data.R.map((p) => ({ ...p, side: 'Rechts' }))] : [...data.all])
    .sort((a, b) => b.t - a.t).slice(0, 12);
  return `
    <label class="label">Oefening
      <select id="progress-ex" class="input">
        ${idx.map((x) => `<option value="${esc(x.id)}" ${x.id === cur.id ? 'selected' : ''}>${esc(x.name)} (${x.count}×)</option>`).join('')}
      </select>
    </label>
    ${canVolume ? `<div class="chips seg">
      <button class="chip ${progressMetric === 'top' ? 'on' : ''}" data-action="progress-metric" data-metric="top">${esc(metricInfo(kind, 'top').label)}</button>
      <button class="chip ${progressMetric === 'volume' ? 'on' : ''}" data-action="progress-metric" data-metric="volume">${esc(metricInfo(kind, 'volume').label)}</button>
    </div>` : ''}
    <section class="card chart-card">
      ${lineChart({ series, unit: info.unit, title: `${cur.name} — ${info.label}${info.unit ? ` (${info.unit})` : ''}` })}
      ${series.map((s) => (s.points.length >= 2 ? `<p class="trend">${sided ? `<strong>${s.name}:</strong> ` : ''}${trendText(s.points, info.unit)}</p>` : '')).join('')}
    </section>
    <details class="card table-card">
      <summary>Tabel (${rows.length} laatste)</summary>
      <table class="data-table"><thead><tr><th>Datum</th>${sided ? '<th>Kant</th>' : ''}<th>${esc(info.label)}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${fmtDate(new Date(r.t).toISOString())}</td>${sided ? `<td>${r.side}</td>` : ''}<td>${fmtNum(r.v)} ${esc(info.unit)}</td></tr>`).join('')}</tbody></table>
    </details>`;
}

/* ---------- Lichaamsgewicht ---------- */
const bodyData = () => {
  if (!db.body) db.body = { weights: [], measures: [] };
  return db.body;
};

function weeklyAverages() {
  const groups = new Map();
  for (const w of bodyData().weights) {
    const d = new Date(`${w.date}T12:00:00`);
    const ws = weekStart(d);
    const key = dateKey(ws);
    const g = groups.get(key) || { start: ws, vals: [], ts: [] };
    g.vals.push(w.kg);
    g.ts.push(d.getTime());
    groups.set(key, g);
  }
  const weeks = [...groups.values()].sort((a, b) => a.start - b.start).map((g) => ({
    start: g.start, avg: Math.round((g.vals.reduce((n, v) => n + v, 0) / g.vals.length) * 10) / 10, n: g.vals.length,
    t: g.ts.reduce((n, v) => n + v, 0) / g.ts.length, // punt op de gemiddelde meetdatum (nooit in de toekomst)
  }));
  weeks.forEach((w, i) => { w.diff = i ? Math.round((w.avg - weeks[i - 1].avg) * 10) / 10 : null; });
  return weeks;
}

function renderWeight() {
  const ws = [...bodyData().weights].sort((a, b) => (a.date < b.date ? 1 : -1));
  const weeks = weeklyAverages();
  const daily = ws.map((w) => ({ t: new Date(`${w.date}T12:00:00`).getTime(), v: w.kg }));
  const weekly = weeks.map((w) => ({ t: w.t, v: w.avg }));
  const range = (d) => { const e = new Date(d); e.setDate(e.getDate() + 6); return `${shortDate(d)} – ${shortDate(e)}`; };
  return `
    <section class="card">
      <p class="label" style="margin-top:0">Gewicht invullen</p>
      <div class="row weigh-row">
        <input id="weight-date" class="input" type="date" value="${dateKey()}" max="${dateKey()}" aria-label="Datum">
        <input id="weight-kg" class="input" inputmode="decimal" placeholder="${ws[0] ? fmtNum(ws[0].kg) : 'kg'}" aria-label="Gewicht in kg">
        <button class="btn primary" data-action="weight-save">Opslaan</button>
      </div>
      <p class="muted small note">Tip: weeg je op vaste momenten (bijv. 's ochtends na het opstaan). Het <strong>weekgemiddelde</strong> zegt meer dan één dag.</p>
    </section>
    ${weeks.length ? `
      <section class="card week-hero">
        <div><span class="muted small">Weekgemiddelde deze week</span><br>
        <strong class="hero-num">${(() => { const cw = weeks.find((w) => dateKey(w.start) === dateKey(weekStart())); return cw ? `${fmtNum(cw.avg)} kg` : '–'; })()}</strong></div>
        ${weeks.length > 1 && weeks[weeks.length - 1].diff != null ? `<div class="hero-diff">${signed(weeks[weeks.length - 1].diff)} kg<br><span class="muted small">t.o.v. vorige week</span></div>` : ''}
      </section>` : ''}
    <section class="card chart-card">
      ${lineChart({ unit: 'kg', title: 'Lichaamsgewicht (kg)', series: [
        { name: 'Weekgemiddelde', points: weekly, style: 'line' },
        { name: 'Per dag', points: daily, style: 'dots' },
      ].filter((s) => s.points.length) })}
    </section>
    ${weeks.length ? `
      <section class="card">
        <p class="label" style="margin-top:0">Weekgemiddelden</p>
        <table class="data-table"><thead><tr><th>Week</th><th>Gem.</th><th>Verschil</th></tr></thead>
        <tbody>${[...weeks].reverse().slice(0, 12).map((w) => `<tr><td>${range(w.start)}<br><span class="muted small">${plural(w.n, 'meting', 'metingen')}</span></td>
          <td><strong>${fmtNum(w.avg)} kg</strong></td>
          <td>${w.diff == null ? '–' : signed(w.diff)}</td></tr>`).join('')}</tbody></table>
      </section>` : ''}
    ${ws.length ? `
      <details class="card table-card">
        <summary>Alle metingen (${ws.length})</summary>
        <div class="list compact">${ws.slice(0, 60).map((w) => `
          <div class="weigh-item"><span>${fmtDate(`${w.date}T12:00:00`)}</span><strong>${fmtNum(w.kg)} kg</strong>
          <button class="icon-btn" data-action="weight-del" data-date="${w.date}" aria-label="Verwijder ${w.date}">✕</button></div>`).join('')}</div>
      </details>` : ''}`;
}

function saveWeight() {
  const date = $('#weight-date').value || dateKey();
  const kg = parseNum($('#weight-kg').value);
  if (!kg || kg < 25 || kg > 300) { toast('Vul een geldig gewicht in (kg)'); return; }
  const b = bodyData();
  b.weights = b.weights.filter((w) => w.date !== date);
  b.weights.push({ date, kg: Math.round(kg * 10) / 10 });
  b.weights.sort((a, c) => (a.date < c.date ? -1 : 1));
  saveNow(); render();
  toast(`${fmtNum(kg)} kg opgeslagen ✓`);
}

/* ---------- Metingen in cm met lichaamsomtrek ---------- */
// Vooraanzicht: haar LINKERkant staat op het plaatje RECHTS.
const MEASURES = [
  { key: 'borst', label: 'Borst', hint: 'over het breedste punt', line: [61, 104, 139, 104] },
  { key: 'arm', label: 'Bovenarm', hint: 'dikste punt, ontspannen', line: [44, 132, 62, 132] },
  { key: 'taille', label: 'Taille', hint: 'smalste punt', line: [72, 156, 128, 156] },
  { key: 'buik', label: 'Buik', hint: 'ter hoogte van de navel', line: [66, 176, 134, 176] },
  { key: 'heupen', label: 'Heupen / billen', hint: 'breedste punt van de billen', line: [55, 202, 145, 202] },
  { key: 'bovenbeenR', label: 'Bovenbeen rechts', hint: 'dikste punt', line: [62, 250, 96, 250] },
  { key: 'bovenbeenL', label: 'Bovenbeen links', hint: 'dikste punt', line: [104, 250, 138, 250] },
];

function bodySVG() {
  const shape = `
    <circle cx="100" cy="32" r="18"/>
    <rect x="93" y="46" width="14" height="16" rx="5"/>
    <path d="M70,64 Q100,56 130,64 Q142,68 143,82 L139,118 Q134,140 128,156 Q140,176 144,198 Q146,214 138,226 L62,226 Q54,214 56,198 Q60,176 72,156 Q66,140 61,118 L57,82 Q58,68 70,64 Z"/>
    <path d="M57,82 Q46,112 44,150 Q42,186 46,214 Q48,222 54,220 Q56,190 58,156 Q61,128 64,108 Z"/>
    <path d="M143,82 Q154,112 156,150 Q158,186 154,214 Q152,222 146,220 Q144,190 142,156 Q139,128 136,108 Z"/>
    <path d="M62,226 Q58,270 66,330 Q68,346 80,346 Q86,346 86,334 Q90,286 98,230 Z"/>
    <path d="M138,226 Q142,270 134,330 Q132,346 120,346 Q114,346 114,334 Q110,286 102,230 Z"/>`;
  const lines = MEASURES.map((mz, i) => {
    const [x1, y1, x2, y2] = mz.line;
    const leftSide = x2 <= 100 || mz.key === 'bovenbeenR';
    const bx = leftSide ? x1 - 12 : x2 + 12;
    return `<g class="bm" data-m="${mz.key}">
      <line class="bm-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <circle class="bm-badge" cx="${bx}" cy="${y1}" r="9"/>
      <text class="bm-num" x="${bx}" y="${y1 + 4}" text-anchor="middle">${i + 1}</text>
    </g>`;
  }).join('');
  return `<svg class="body-svg" viewBox="10 0 180 362" role="img" aria-label="Lichaamsomtrek met meetpunten">
    <g class="body-shape">${shape}</g>
    ${lines}
    <text class="bm-side" x="74" y="360" text-anchor="middle">R</text>
    <text class="bm-side" x="126" y="360" text-anchor="middle">L</text>
  </svg>`;
}

function lastMeasure(key) {
  const list = bodyData().measures.filter((m) => m.values[key] != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  return { first: list[0], last: list[list.length - 1], count: list.length };
}

function renderMeasures() {
  const ms = bodyData().measures;
  const chartPts = ms.filter((m) => m.values[measureChartKey] != null)
    .map((m) => ({ t: new Date(`${m.date}T12:00:00`).getTime(), v: m.values[measureChartKey] }));
  const mInfo = MEASURES.find((x) => x.key === measureChartKey);
  return `
    <section class="card measure-card">
      <div class="measure-grid">
        <div class="body-wrap">${bodySVG()}<p class="muted tiny center">Vooraanzicht · L = links, R = rechts</p></div>
        <div class="measure-inputs">
          ${MEASURES.map((mz, i) => {
            const { first, last } = lastMeasure(mz.key);
            const diff = first && last && first !== last ? Math.round((last.values[mz.key] - first.values[mz.key]) * 10) / 10 : null;
            return `
            <label class="m-row" data-m="${mz.key}">
              <span class="m-num">${i + 1}</span>
              <span class="m-text"><strong>${mz.label}</strong><span class="muted tiny">${mz.hint}${last ? ` · vorige ${fmtNum(last.values[mz.key])}${diff != null ? ` (${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))})` : ''}` : ''}</span></span>
              <input class="m-input" data-measure="${mz.key}" inputmode="decimal" placeholder="${last ? fmtNum(last.values[mz.key]) : 'cm'}" aria-label="${mz.label} in cm">
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="row">
        <input id="measure-date" class="input" type="date" value="${dateKey()}" max="${dateKey()}" aria-label="Datum">
        <button class="btn primary" data-action="measure-save">Meting opslaan</button>
      </div>
      <p class="muted small note">Meet steeds op hetzelfde moment, met het meetlint strak maar niet insnoerend. Lege velden worden overgeslagen.</p>
    </section>
    <div class="chips seg">${MEASURES.map((mz) => `<button class="chip ${mz.key === measureChartKey ? 'on' : ''}" data-action="measure-chart" data-key="${mz.key}">${mz.label}</button>`).join('')}</div>
    <section class="card chart-card">
      ${lineChart({ unit: 'cm', title: `${mInfo.label} (cm)`, series: [{ name: mInfo.label, points: chartPts, style: 'line' }] })}
      ${chartPts.length >= 2 ? `<p class="trend">${trendText(chartPts, 'cm')}</p>` : ''}
    </section>
    ${ms.length ? `
      <details class="card table-card">
        <summary>Alle metingen (${ms.length})</summary>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>Datum</th>${MEASURES.map((mz, i) => `<th title="${mz.label}">${i + 1}</th>`).join('')}<th></th></tr></thead>
        <tbody>${[...ms].sort((a, b) => (a.date < b.date ? 1 : -1)).map((m) => `<tr><td>${shortDate(new Date(`${m.date}T12:00:00`))}</td>
          ${MEASURES.map((mz) => `<td>${m.values[mz.key] != null ? fmtNum(m.values[mz.key]) : '–'}</td>`).join('')}
          <td><button class="icon-btn" data-action="measure-del" data-date="${m.date}" aria-label="Verwijder meting">✕</button></td></tr>`).join('')}</tbody></table></div>
      </details>` : ''}`;
}

function saveMeasures() {
  const date = $('#measure-date').value || dateKey();
  const values = {};
  for (const inp of document.querySelectorAll('[data-measure]')) {
    const v = parseNum(inp.value);
    if (v && v >= 10 && v <= 250) values[inp.dataset.measure] = Math.round(v * 10) / 10;
  }
  if (!Object.keys(values).length) { toast('Vul minstens één meting in (cm)'); return; }
  const b = bodyData();
  const existing = b.measures.find((m) => m.date === date);
  if (existing) Object.assign(existing.values, values);
  else b.measures.push({ date, values });
  b.measures.sort((a, c) => (a.date < c.date ? -1 : 1));
  saveNow(); render();
  toast(`${plural(Object.keys(values).length, 'meting', 'metingen')} opgeslagen ✓`);
}

// Focus op een invoerveld → bijbehorende lijn op het lichaam oplichten (en andersom).
document.addEventListener('focusin', (e) => {
  const key = e.target.dataset?.measure;
  if (!key) return;
  document.querySelectorAll('.bm, .m-row').forEach((el) => el.classList.toggle('active', el.dataset.m === key));
});
document.addEventListener('click', (e) => {
  const g = e.target.closest?.('.bm');
  if (g) document.querySelector(`[data-measure="${g.dataset.m}"]`)?.focus();
});

/* ---------- Pagina ---------- */
function renderProgress() {
  const tabs = [['ex', '🏋️ Oefeningen'], ['weight', '⚖️ Gewicht'], ['measure', '📏 Metingen']];
  const body = progressTab === 'weight' ? renderWeight() : progressTab === 'measure' ? renderMeasures() : renderExerciseProgress();
  return `
    ${backHeader('Voortgang', `${esc(personById(personId).name)} · zie of het omhoog gaat`)}
    <div class="tabs" role="tablist">
      ${tabs.map(([k, l]) => `<button class="tab ${progressTab === k ? 'on' : ''}" role="tab" aria-selected="${progressTab === k}" data-action="progress-tab" data-tab="${k}">${l}</button>`).join('')}
    </div>
    ${body}`;
}
