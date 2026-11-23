'use strict';

/* =========================================================
   Workout Tracker — zie CLAUDE.md voor architectuur & datastructuur.
   Vaste inhoud (schema's, oefeningen, animaties) staat in data.js.
   ========================================================= */

/* ---------- Constants ---------- */
const APP_VERSION = 'v12';                          // houd gelijk met CACHE in sw.js (staat in feedbackberichten)
const STORAGE_KEY = 'workout-tracker:v1';          // legacy (vóór profielen) + prefix
const TIMER_KEY = 'workout-tracker:timer';
const PERSON_KEY = 'workout-tracker:person';       // laatst gekozen persoon
const PEOPLE = [
  { id: 'mama', name: 'Mama', emoji: '🌷' },
  { id: 'senna', name: 'Senna', emoji: '🌸' },
];
const dataKey = (pid) => `${STORAGE_KEY}:${pid}`;  // per persoon: workout-tracker:v1:<id>
const personById = (pid) => PEOPLE.find((p) => p.id === pid);
const SCHEMA_VERSION = 3;
const BUILTIN_TEMPLATE_IDS = ['bf-arms', 'bf-full', 'bf-bil1', 'bf-bil2', 'bf-bil3'];
const DEFAULT_SETS = 3;
const BACKUP_WARN_DAYS = 14;
const RUN_GOAL = 3;
const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DAY_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const PROGRAMS = {
  run: { emoji: '🏃‍♀️', label: 'Hardlopen' },
  pilates: { emoji: '🧘‍♀️', label: 'Thuis trainen' },
  gym: { emoji: '🏋️‍♀️', label: 'Basic-Fit' },
  dumbbell: { emoji: '💪', label: 'Thuis met dumbbell' },
  kettlebell: { emoji: '🔔', label: 'Thuis met kettlebell' },
};
const SESSION_PROGRAMS = Object.keys(PROGRAMS);
/** Soorten oefeningen: kg+reps, alleen reps, tijd (sec), cardio (minuten + niveau). */
const KINDS = ['weights', 'reps', 'time', 'cardio'];
const SIDE_WORD = { L: 'Links', R: 'Rechts' };
/** "Linkerbeen", "Rechterarm", "Linkerkant" … */
const sideLabel = (side, limb = 'kant') => `${side === 'L' ? 'Linker' : 'Rechter'}${limb}`;
const SEG_LABEL = { warmup: 'Warming-up · wandelen', run: 'Hardlopen', walk: 'Wandelen', cooldown: 'Cooling-down · wandelen' };
const V1_DEFAULT_IDS = ['ex-bench-press', 'ex-shoulder-press', 'ex-lat-pulldown', 'ex-seated-row', 'ex-biceps-curl',
  'ex-triceps-pushdown', 'ex-lateral-raise', 'ex-squat', 'ex-romanian-deadlift', 'ex-hip-thrust', 'ex-leg-press',
  'ex-leg-curl', 'ex-leg-extension', 'ex-walking-lunge', 'ex-calf-raise', 'ex-abduction', 'ex-deadlift',
  'ex-goblet-squat', 'ex-dumbbell-row', 'ex-push-up'];
const V1_TO_V2 = {
  'ex-shoulder-press': 'bf-shoulder-press-machine', 'ex-lat-pulldown': 'bf-lat-pulldown', 'ex-seated-row': 'bf-seated-row',
  'ex-biceps-curl': 'bf-db-curl', 'ex-triceps-pushdown': 'bf-pushdown', 'ex-lateral-raise': 'bf-lateral-raise',
  'ex-romanian-deadlift': 'bf-bb-rdl', 'ex-hip-thrust': 'bf-hip-thrust',
  'ex-leg-press': 'bf-leg-press', 'ex-leg-curl': 'bf-leg-curl', 'ex-walking-lunge': 'bf-walking-lunge',
  'ex-abduction': 'bf-abduction', 'ex-bench-press': 'bf-chest-press',
};

/* ---------- Small helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byName = (a, b) => a.name.localeCompare(b.name, 'nl');
const fmtNum = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseNum(v) {
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function fmtSet(s, kind) {
  const side = s.side ? `${s.side} ` : '';
  if (kind === 'cardio') return `${s.min ?? '–'} min${s.lvl != null ? ` · niveau ${fmtNum(s.lvl)}` : ''}`;
  if (kind === 'time' || (s.sec != null && s.reps == null)) return `${side}${s.sec ?? '–'} sec`;
  if (s.kg == null) return `${side}${s.reps ?? '–'} reps`;
  return `${side}${fmtNum(s.kg)} kg × ${s.reps ?? '–'}`;
}
function fmtSetShort(s, kind) {
  if (kind === 'cardio') return `${s.min ?? '–'}′${s.lvl != null ? `/${fmtNum(s.lvl)}` : ''}`;
  if (kind === 'time') return `${s.sec ?? '–'}s`;
  if (s.kg == null) return `${s.reps ?? '–'}`;
  return `${fmtNum(s.kg)}×${s.reps ?? '–'}`;
}
function fmtClock(totalSec) {
  totalSec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
const fmtDate = (iso) => new Date(iso).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDateTiny = (iso) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' });
function fmtDuration(startIso, endIso) {
  const min = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)}u ${min % 60}m` : `${min} min`;
}
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
function relDays(iso) {
  const d = daysAgo(iso);
  return d === 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`;
}
const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = maandag
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekStart(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - dayIdx(d));
  return s;
}
const firstNum = (t) => { const m = String(t ?? '').match(/\d+/); return m ? Number(m[0]) : null; };

/* ---------- Storage ---------- */
function defaultDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exercises: [],
    templates: clone(GYM_TEMPLATES),
    history: [],
    active: null,
    settings: { restSeconds: 90 },
    run: { reminder: { days: [0, 2, 5], time: '19:00', notify: false, lastNotified: null } },
    profile: { age: null, restHr: null, maxHr: null },
    notes: {},           // vaste notitie per oefening-id (bv. "stoel op stand 4")
    body: { weights: [], measures: [] }, // lichaamsgewicht per dag + cm-metingen
    lastBackupAt: null,
  };
}

function normSession(s, fallbackProgram = 'gym') {
  const hr = s.hr && (numOrNull(s.hr.avg) || numOrNull(s.hr.max)) ? { avg: numOrNull(s.hr.avg), max: numOrNull(s.hr.max) } : null;
  const out = {
    id: String(s.id || uid()),
    program: SESSION_PROGRAMS.includes(s.program) ? s.program : fallbackProgram,
    templateId: s.templateId ?? null,
    name: String(s.name || 'Workout'),
    startedAt: s.startedAt || new Date().toISOString(),
    finishedAt: s.finishedAt ?? null,
    hr,
    exercises: (Array.isArray(s.exercises) ? s.exercises : []).map((e) => ({
      id: String(e.id || uid()),
      exerciseId: String(e.exerciseId || ''),
      name: String(e.name || ''),
      kind: KINDS.includes(e.kind) ? e.kind : 'weights',
      target: String(e.target ?? ''),
      targetSec: numOrNull(e.targetSec),
      alts: Array.isArray(e.alts) ? e.alts.map(String) : null,
      uni: ['been', 'arm', 'kant'].includes(e.uni) ? e.uni : null,
      sets: (Array.isArray(e.sets) ? e.sets : []).map((x) => ({
        kg: numOrNull(x.kg), reps: numOrNull(x.reps), sec: numOrNull(x.sec), done: !!x.done,
        ...(numOrNull(x.min) != null ? { min: x.min } : {}), ...(numOrNull(x.lvl) != null ? { lvl: x.lvl } : {}),
        ...(x.side === 'L' || x.side === 'R' ? { side: x.side } : {}),
      })),
    })),
  };
  if (s.runKey) out.runKey = String(s.runKey);
  if (numOrNull(s.restSec)) out.restSec = s.restSec;
  if (s.run && Array.isArray(s.run.segs)) out.run = s.run;
  return out;
}

/** Valideert, vult aan en migreert (v1 → v2). Gooit een Error bij ongeldige data. */
function normalizeDb(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('geen geldig backup-bestand');
  if (!Array.isArray(raw.exercises) || !Array.isArray(raw.templates) || !Array.isArray(raw.history)) {
    throw new Error('bestand mist oefeningen/workouts/geschiedenis');
  }
  const base = defaultDb();
  const version = raw.schemaVersion || 1;
  const catalogIds = new Set(CATALOG.map((e) => e.id));

  let exercises = raw.exercises.filter((e) => e && e.id && e.name && !catalogIds.has(e.id));
  if (version < 2) exercises = exercises.filter((e) => !V1_DEFAULT_IDS.includes(e.id));
  const known = new Set([...catalogIds, ...exercises.map((e) => e.id)]);
  let templates;
  if (version < 2) {
    const custom = raw.templates
      .filter((t) => t && t.id && t.name && !['tpl-upper', 'tpl-lower', 'tpl-full'].includes(t.id))
      .map((t) => ({ id: t.id, name: t.name, program: 'gym',
        items: (t.exerciseIds || []).map((id) => V1_TO_V2[id] || id)
          .map((id) => ({ exerciseId: id, sets: DEFAULT_SETS, target: '10' })) }));
    templates = [...clone(GYM_TEMPLATES), ...custom];
  } else if (version < 3) {
    // v3: ingebouwde schema's opnieuw (nieuwe inhoud), eigen schema's behouden
    const custom = raw.templates.filter((t) => t && t.id && t.name && !BUILTIN_TEMPLATE_IDS.includes(t.id));
    templates = [...clone(GYM_TEMPLATES), ...custom];
  } else {
    templates = raw.templates.filter((t) => t && t.id && t.name);
  }
  exercises = exercises.map((e) => ({
    id: String(e.id), name: String(e.name),
    kind: KINDS.includes(e.kind) ? e.kind : 'weights',
    program: ['pilates', 'mat', 'gym', 'dumbbell', 'kettlebell'].includes(e.program) ? e.program : 'gym',
    ...(e.muscle ? { muscle: String(e.muscle).slice(0, 60) } : {}),
    ...(['been', 'arm', 'kant'].includes(e.uni) ? { uni: e.uni } : {}),
    ...(e.toestel ? { toestel: String(e.toestel).slice(0, 80) } : {}),
    ...(e.tip ? { tip: String(e.tip).slice(0, 300) } : {}),
  }));
  templates = templates.map((t) => ({
    id: String(t.id), name: String(t.name), program: 'gym', note: t.note ? String(t.note) : '',
    focus: GLUTE_INFO[t.focus] ? t.focus : null,
    items: (Array.isArray(t.items) ? t.items : []).filter((i) => i && known.has(String(i.exerciseId))).map((i) => ({
      exerciseId: String(i.exerciseId),
      sets: Math.min(10, Math.max(1, Number(i.sets) || DEFAULT_SETS)),
      target: String(i.target ?? ''),
    })),
  }));

  const rem = raw.run?.reminder || {};
  const db = {
    schemaVersion: SCHEMA_VERSION,
    exercises,
    templates,
    history: raw.history.filter((s) => s && Array.isArray(s.exercises)).map((s) => normSession(s))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)),
    active: raw.active && Array.isArray(raw.active.exercises) ? normSession(raw.active) : null,
    settings: { ...base.settings, ...(raw.settings || {}) },
    run: { reminder: {
      days: Array.isArray(rem.days) ? rem.days.filter((d) => d >= 0 && d <= 6) : base.run.reminder.days,
      time: /^\d{2}:\d{2}$/.test(rem.time || '') ? rem.time : base.run.reminder.time,
      notify: !!rem.notify,
      lastNotified: rem.lastNotified || null,
    } },
    profile: { ...base.profile, ...(raw.profile || {}) },
    body: {
      weights: (Array.isArray(raw.body?.weights) ? raw.body.weights : [])
        .filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w?.date) && numOrNull(w.kg)).map((w) => ({ date: w.date, kg: w.kg })),
      measures: (Array.isArray(raw.body?.measures) ? raw.body.measures : [])
        .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m?.date) && m.values && typeof m.values === 'object')
        .map((m) => ({ date: m.date, values: Object.fromEntries(Object.entries(m.values).filter(([, v]) => numOrNull(v) != null)) })),
    },
    notes: raw.notes && typeof raw.notes === 'object'
      ? Object.fromEntries(Object.entries(raw.notes).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.slice(0, 300)]))
      : {},
    lastBackupAt: raw.lastBackupAt || null,
  };
  for (const s of [...db.history, ...(db.active ? [db.active] : [])]) {
    for (const e of s.exercises) if (!e.name) e.name = exById(e.exerciseId, db)?.name || 'Oefening';
  }
  return db;
}

function load(pid) {
  let rawStr = null;
  try {
    rawStr = localStorage.getItem(dataKey(pid));
    if (!rawStr) return defaultDb();
    return normalizeDb(JSON.parse(rawStr));
  } catch (err) {
    console.error('Kon data niet laden', err);
    try { if (rawStr) localStorage.setItem(`${dataKey(pid)}:corrupt-${Date.now()}`, rawStr); } catch (_) { /* vol */ }
    return defaultDb();
  }
}

/** Korte samenvatting van een profiel voor de profielkeuze (zonder het te activeren). */
function personSummary(pid) {
  try {
    const raw = JSON.parse(localStorage.getItem(dataKey(pid)) || 'null');
    if (!raw) return { count: 0, last: null, active: null };
    const hist = Array.isArray(raw.history) ? raw.history : [];
    const last = hist.map((s) => s.startedAt).sort().pop() || null;
    return { count: hist.length, last, active: raw.active?.name || null };
  } catch (_) { return { count: 0, last: null, active: null }; }
}

/** Gegevens van vóór de profielen (één gedeelde opslag). Alleen relevant als er echt iets in staat. */
function legacyData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const meaningful = (d.history?.length || 0) > 0 || !!d.active || (d.exercises?.length || 0) > 0
      || (d.templates || []).some((t) => !BUILTIN_TEMPLATE_IDS.includes(t.id) && !['tpl-upper', 'tpl-lower', 'tpl-full'].includes(t.id));
    if (!meaningful) { // lege testdata: opruimen
      localStorage.setItem(`${STORAGE_KEY}:legacy-backup`, raw);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { raw, count: d.history?.length || 0 };
  } catch (_) { return null; }
}
function assignLegacy(pid) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw || localStorage.getItem(dataKey(pid))) return false;
  localStorage.setItem(dataKey(pid), raw);
  localStorage.setItem(`${STORAGE_KEY}:legacy-backup`, raw);
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!personId) return;
  try {
    localStorage.setItem(dataKey(personId), JSON.stringify(db));
  } catch (err) {
    console.error(err);
    toast('⚠️ Opslaan mislukt — maak een backup!');
  }
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
const flushSave = () => { if (saveTimer) saveNow(); };
window.addEventListener('pagehide', flushSave);

/* ---------- Catalogus-toegang ---------- */
function exById(id, source) {
  return CATALOG.find((e) => e.id === id) || (source || db).exercises.find((e) => e.id === id);
}
const exName = (id) => exById(id)?.name ?? 'Onbekende oefening';
const exercisesFor = (program) => [...CATALOG, ...db.exercises].filter((e) => e.program === program);

/* ---------- State ---------- */
let personId = null;  // wie traint er nu (Mama / Senna)
let db = defaultDb(); // data van de gekozen persoon (leeg tot er gekozen is)
let view = 'who';     // begint altijd op de profielkeuze
let editing = null;   // template-editor state
let historyLimit = 10;

function selectPerson(pid, { quiet = false } = {}) {
  if (!personById(pid)) return;
  flushSave();
  if (personId && personId !== pid) stopTimer();
  personId = pid;
  try { localStorage.setItem(PERSON_KEY, pid); } catch (_) { /* ignore */ }
  db = load(pid);
  historyLimit = 10;
  view = db.active ? 'workout' : 'home';
  render();
  window.scrollTo(0, 0);
  if (!quiet) toast(`Hoi ${personById(pid).name}! ${personById(pid).emoji}`);
}

/** Laatste afgeronde prestatie op een oefening: { date, sets } of null. */
function findPrevious(exerciseId) {
  for (const s of db.history) {
    const entry = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done));
    if (entry) return { date: s.startedAt, sets: entry.sets.filter((x) => x.done) };
  }
  return null;
}

/** Vorige prestatie voor rij i — bij eenzijdige oefeningen de zelfde kant (n-de linker/rechter set). */
function prevSetFor(entry, i, prev) {
  if (!prev) return null;
  const side = entry.sets[i]?.side;
  if (side && prev.sets.some((s) => s.side)) {
    // strikt per kant: nooit het gewicht van links tonen bij rechts (of andersom)
    const nth = entry.sets.slice(0, i).filter((s) => s.side === side).length;
    const same = prev.sets.filter((s) => s.side === side);
    return same.length ? (same[nth] ?? same[same.length - 1]) : null;
  }
  return prev.sets[i] ?? prev.sets[prev.sets.length - 1] ?? null;
}

function placeholderFor(entry, i, prev = findPrevious(entry.exerciseId)) {
  const p = prevSetFor(entry, i, prev);
  const side = entry.sets[i]?.side;
  // vorige rij van dezelfde kant (bij L/R-paren is dat 2 rijen terug)
  const above = side ? entry.sets.slice(0, i).reverse().find((s) => s.side === side) : entry.sets[i - 1];
  return {
    kg: above?.kg ?? p?.kg ?? null,
    reps: above?.reps ?? p?.reps ?? firstNum(entry.target),
    min: above?.min ?? p?.min ?? (entry.kind === 'cardio' ? firstNum(entry.target) : null),
    lvl: above?.lvl ?? p?.lvl ?? null,
    sec: above?.sec ?? p?.sec ?? entry.targetSec ?? null,
  };
}

const emptySet = (side) => ({ kg: null, reps: null, sec: null, done: false, ...(side ? { side } : {}) });

function newEntry(exerciseId, item = {}) {
  const ex = exById(exerciseId);
  const prev = findPrevious(exerciseId);
  const uni = ex?.uni || null;
  // aantal sets per kant; bij eenzijdig worden het L/R-paren
  const prevCount = prev ? (uni ? Math.ceil(prev.sets.length / 2) : prev.sets.length) : null;
  const n = item.sets ?? prevCount ?? (ex?.kind === 'cardio' ? 1 : DEFAULT_SETS);
  return {
    id: uid(),
    exerciseId,
    name: ex?.name ?? 'Oefening',
    kind: ex?.kind ?? 'weights',
    target: item.target ?? '',
    targetSec: item.sec ?? null,
    alts: ex?.alts?.length ? [exerciseId, ...ex.alts] : null,
    uni,
    sets: uni
      ? Array.from({ length: n }, () => [emptySet('L'), emptySet('R')]).flat()
      : Array.from({ length: n }, () => emptySet()),
  };
}

function findOrCreateExercise(name, program) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const existing = exercisesFor(program).find((e) => e.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const ex = { id: `ex-${uid()}`, name: clean, kind: program === 'pilates' ? 'reps' : 'weights', program };
  db.exercises.push(ex);
  return ex;
}

/* ---------- Hardloop-helpers ---------- */
const runKey = (w, t) => `w${w + 1}t${t + 1}`;
function parseRunKey(key) {
  const m = /^w(\d+)t(\d)$/.exec(key || '');
  return m ? { w: Number(m[1]) - 1, t: Number(m[2]) - 1 } : null;
}
const runTitle = (key) => { const k = parseRunKey(key); return k ? `Week ${k.w + 1} · Training ${k.t + 1}` : 'Hardlopen'; };
const runPlanFor = (key) => { const k = parseRunKey(key); return k ? RUN_PLAN[k.w]?.[k.t] : null; };

/** Map runKey → nieuwste history-item. */
function runDoneMap() {
  const map = {};
  for (const s of db.history) if (s.program === 'run' && s.runKey && !map[s.runKey]) map[s.runKey] = s;
  return map;
}
function nextRunKey(done = runDoneMap()) {
  for (let w = 0; w < RUN_PLAN.length; w++) for (let t = 0; t < 3; t++) if (!done[runKey(w, t)]) return runKey(w, t);
  return null;
}
function runsThisWeek() {
  const start = weekStart();
  return db.history.filter((s) => s.program === 'run' && new Date(s.startedAt) >= start).length;
}
const ranToday = () => db.history.some((s) => s.program === 'run' && dateKey(new Date(s.startedAt)) === dateKey());
const isPlannedToday = () => db.run.reminder.days.includes(dayIdx());
function nextPlannedDay() {
  const days = db.run.reminder.days;
  for (let d = 1; d <= 7; d++) {
    const idx = (dayIdx() + d) % 7;
    if (days.includes(idx)) return DAY_LONG[idx];
  }
  return null;
}
function expandSegments(plan) {
  const segs = [{ type: 'warmup', sec: 300 }];
  for (const [type, min, label] of plan.segs) segs.push({ type, sec: min == null ? null : min * 60, label: label || null });
  segs.push({ type: 'cooldown', sec: 300 });
  return segs;
}
const segLabel = (s) => (s.label ? `${SEG_LABEL[s.type]} · ${s.label}` : SEG_LABEL[s.type]);
const segShort = (s) => (s.sec == null ? s.label : `${s.sec / 60}′`);

/* ---------- Hartslag ---------- */
function effectiveMaxHr() {
  const p = db.profile;
  if (p.maxHr) return p.maxHr;
  if (p.age) return Math.round(208 - 0.7 * p.age);
  return null;
}
function zoneBpm(pct) {
  const max = effectiveMaxHr();
  if (!max) return null;
  const rest = db.profile.restHr;
  return rest ? Math.round(rest + (max - rest) * pct / 100) : Math.round(max * pct / 100);
}
function zoneOf(bpm) {
  if (!bpm || !effectiveMaxHr()) return -1;
  for (let i = HR_ZONES.length - 1; i >= 0; i--) if (bpm >= zoneBpm(HR_ZONES[i].from)) return i;
  return -1;
}

/* ---------- Rendering ---------- */
const app = $('#app');
const timerEl = $('#timer');

function render() {
  if (!personId) view = 'who';
  if (view === 'workout' && !db.active) view = 'home';
  const timed = view === 'workout' && !!db.active?.run;          // run-sessie of pilates-speler
  const isPlayer = timed && db.active.program === 'pilates';
  const renderers = {
    who: renderWho, home: renderHome, run: renderRun, thuis: renderThuis, pilates: renderPilates, mat: renderPilates,
    dumbbell: renderHomeWeights, kettlebell: renderHomeWeights, gym: renderGym, heart: renderHeart, log: renderLog,
    progress: () => renderProgress(), // staat in progress.js (laadt na app.js)
  };
  app.innerHTML = view === 'workout'
    ? (timed ? (isPlayer ? renderPlayer() : renderRunSession()) : renderWorkout())
    : renderers[view]();
  document.body.classList.toggle('player-open', isPlayer);
  if (!isPlayer) exitFullscreen();
  // Basic-Fit: geen rustbalk (bewuste keuze); thuis met dumbbell/kettlebell wel
  const showTimer = view === 'workout' && !timed && db.active?.program !== 'gym';
  timerEl.hidden = !showTimer;
  document.body.classList.toggle('has-timer', showTimer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    app.querySelectorAll('svg.fig').forEach((s) => s.pauseAnimations?.());
  }
  updateTimerUI();
  updateLive();
  updateWakeLock();
}

function go(v) {
  flushSave();
  view = v;
  render();
  window.scrollTo(0, 0);
}

/** Profielknop rechtsboven op elke pagina: snel wisselen tussen Mama en Senna. */
const personButton = () => {
  const p = personById(personId);
  return p ? `<button class="person-mini" data-action="go" data-view="who" aria-label="Profiel: ${esc(p.name)} — wisselen">
    <span>${p.emoji}</span><span class="person-mini-name">${esc(p.name)}</span></button>` : '';
};

const backHeader = (title, sub = '', back = 'home') => `
  <header class="page-top">
    <button class="icon-btn back" data-action="go" data-view="${back}" aria-label="Terug">‹</button>
    <div class="grow"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    ${personButton()}
  </header>`;

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
}

/* ----- Profielkeuze (beginpagina) ----- */
function renderWho() {
  const legacy = legacyData();
  const freeForLegacy = PEOPLE.filter((p) => !localStorage.getItem(dataKey(p.id)));
  const last = localStorage.getItem(PERSON_KEY);
  return `
    ${personId ? `<button class="icon-btn back who-back" data-action="go" data-view="home" aria-label="Terug">‹</button>` : ''}
    <header class="who-top">
      <span class="who-logo">💗</span>
      <h1>Wie gaat er trainen?</h1>
      <p class="sub">Iedereen heeft haar eigen schema's, gewichten en voortgang.</p>
    </header>

    ${legacy && freeForLegacy.length ? `
      <section class="card legacy">
        <p><strong>Er staan al ${plural(legacy.count, 'training', 'trainingen')} op dit toestel</strong> (van vóór de profielen).
        Van wie zijn die?</p>
        <div class="row">
          ${freeForLegacy.map((p) => `<button class="btn" data-action="legacy-assign" data-person="${p.id}">${p.emoji} Van ${esc(p.name)}</button>`).join('')}
        </div>
      </section>` : ''}

    <div class="people">
      ${PEOPLE.map((p) => {
        const s = personSummary(p.id);
        const sub = s.active ? `⏱ ${esc(s.active)} is nog bezig`
          : s.count ? `${plural(s.count, 'training', 'trainingen')} · laatst ${relDays(s.last)}` : 'Nog geen trainingen';
        return `
          <button class="person-card ${p.id === last ? 'last' : ''}" data-action="pick-person" data-person="${p.id}">
            <span class="person-emoji">${p.emoji}</span>
            <span class="person-name">${esc(p.name)}</span>
            <span class="person-sub">${sub}</span>
          </button>`;
      }).join('')}
    </div>`;
}

/* ----- Home ----- */
function renderHome() {
  const a = db.active;
  const done = runDoneMap();
  const doneCount = Object.keys(done).length;
  const next = nextRunKey(done);
  const lastHome = db.history.find((s) => ['pilates', 'dumbbell', 'kettlebell'].includes(s.program));
  const lastGym = db.history.find((s) => s.program === 'gym');
  const backupDue = !db.lastBackupAt ? db.history.length > 0 : daysAgo(db.lastBackupAt) >= BACKUP_WARN_DAYS && db.history.length > 0;
  return `
    <header class="home-top">
      <div class="grow">
        <h1>${greeting()}, ${esc(personById(personId).name)} ${personById(personId).emoji}</h1>
        <p class="sub">Wat gaan we vandaag doen?</p>
        <button class="person-chip" data-action="go" data-view="who" aria-label="Wissel van profiel">
          ${personById(personId).emoji} ${esc(personById(personId).name)} <span class="muted">· wisselen ⇄</span>
        </button>
      </div>
      <button class="icon-btn log-btn" data-action="feedback" aria-label="Feedback of vraag sturen"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg></button>
      <button class="icon-btn log-btn" data-action="go" data-view="log" aria-label="Geschiedenis & backup"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4.5v4h4"/><path d="M12 7.5V12l3 2"/></svg>${backupDue ? '<span class="icon-dot"></span>' : ''}</button>
    </header>

    ${a ? `
      <section class="card resume">
        <div><strong>${PROGRAMS[a.program].emoji} ${esc(a.name)}</strong><br><span class="muted small">is nog bezig</span></div>
        <button class="btn primary" data-action="resume">Ga verder</button>
      </section>` : ''}

    ${renderRunBanner()}

    <div class="programs">
      ${programCard('run', 'Hardloopschema', next ? `${doneCount}/30 · volgende: ${runTitle(next)}` : 'Schema afgerond! 🎉', doneCount / 30)}
      ${programCard('thuis', 'Thuis trainen', lastHome ? `Laatst: ${esc(lastHome.name)} · ${relDays(lastHome.startedAt)}` : 'Pilates (bord/matje) · dumbbell · kettlebell')}
      ${programCard('gym', 'Basic-Fit', lastGym ? `Laatst: ${esc(lastGym.name)} · ${relDays(lastGym.startedAt)}` : 'Armen · Full Body · Bil 1–3')}
    </div>

    <div class="home-actions">
      <button class="action-card add" data-action="add-own">
        <span class="action-icon">➕</span>
        <span><strong>Apparaat of oefening toevoegen</strong><span class="small">Zelf toevoegen of laten toevoegen met foto</span></span>
      </button>
      <button class="action-card progress" data-action="go" data-view="progress">
        <span class="action-icon">📈</span>
        <span><strong>Voortgang</strong><span class="small">Grafieken, gewicht &amp; metingen</span></span>
      </button>
    </div>`;
}

function renderLog() {
  return `
    ${backHeader('Geschiedenis', `${plural(db.history.length, 'training', 'trainingen')} opgeslagen`)}
    ${renderHistory()}
    <section class="card backup">
      <h2>Backup van ${esc(personById(personId).name)}</h2>
      ${backupNotice()}
      <div class="row">
        <button class="btn" data-action="export">⬇︎ Exporteer backup (JSON)</button>
        <button class="btn" data-action="import">⬆︎ Importeer backup</button>
      </div>
    </section>
    <section class="card reset-card">
      <h2>Profiel opnieuw beginnen</h2>
      <p class="muted small">Wist alleen de gegevens van ${esc(personById(personId).name)} (trainingen, gewichten, notities,
      eigen schema's). Het andere profiel blijft ongemoeid. Je krijgt eerst de kans een backup te downloaden.</p>
      <button class="btn ghost danger block" data-action="reset-person">Reset ${esc(personById(personId).name)}</button>
    </section>
    <section class="card version-card">
      <p><strong>App-versie ${APP_VERSION}</strong><br><span class="muted small">Updates worden automatisch geladen als je online bent.</span></p>
      <button class="btn small" data-action="check-update">🔄 Controleer op updates</button>
    </section>`;
}

function programCard(program, title, sub, progress = null) {
  return `
    <button class="program-card p-${program}" data-action="go" data-view="${program}">
      <span class="pc-emoji">${(PROGRAMS[program] || { emoji: '🏡' }).emoji}</span>
      <span class="pc-text">
        <span class="pc-title">${title}</span>
        <span class="pc-sub">${sub}</span>
        ${progress != null ? `<span class="mini-progress"><span style="width:${Math.round(progress * 100)}%"></span></span>` : ''}
      </span>
      <span class="chev">›</span>
    </button>`;
}

function renderRunBanner() {
  if (!nextRunKey()) return '';
  const n = runsThisWeek();
  const left = Math.max(0, RUN_GOAL - n);
  const daysLeft = 7 - dayIdx(); // incl. vandaag
  const dots = Array.from({ length: RUN_GOAL }, (_, i) => `<span class="dot ${i < n ? 'on' : ''}"></span>`).join('');
  let msg; let tone = '';
  if (left === 0) { msg = `Top! ${n}× gelopen deze week 🎉`; tone = 'good'; }
  else if (ranToday()) msg = `Lekker gelopen vandaag! Nog ${plural(left, 'run', 'runs')} deze week.`;
  else if (left > daysLeft) { msg = `Nog ${plural(left, 'run', 'runs')} en maar ${plural(daysLeft, 'dag', 'dagen')} over — één extra run lukt vast ook 💪`; tone = 'warn'; }
  else if (isPlannedToday()) { msg = `Vandaag staat er een run gepland 🏃‍♀️ (${db.run.reminder.time})`; tone = 'today'; }
  else msg = `Nog ${plural(left, 'run', 'runs')} deze week.${nextPlannedDay() ? ` Volgende loopdag: ${nextPlannedDay()}.` : ''}`;
  return `
    <button class="banner ${tone}" data-action="go" data-view="run">
      <span class="dots" aria-label="${n} van ${RUN_GOAL} runs deze week">${dots}</span>
      <span class="grow">${msg}</span>
    </button>`;
}

function backupNotice() {
  if (!db.lastBackupAt) {
    return db.history.length
      ? `<p class="warn">Nog nooit een backup gemaakt. Doe dit regelmatig, dan raak je nooit iets kwijt.</p>`
      : `<p class="muted">Je data staat alleen op deze telefoon. Exporteer af en toe een backup.</p>`;
  }
  const old = daysAgo(db.lastBackupAt) >= BACKUP_WARN_DAYS && db.history.length;
  return `<p class="${old ? 'warn' : 'muted'}">Laatste backup: ${relDays(db.lastBackupAt)}.</p>`;
}

function hrText(hr) {
  if (!hr) return '';
  const parts = [];
  if (hr.avg) parts.push(`gem. ${hr.avg}`);
  if (hr.max) parts.push(`max ${hr.max}`);
  return `❤️ ${parts.join(' · ')} bpm`;
}

function renderHistory() {
  if (!db.history.length) return `<p class="muted">Nog geen trainingen afgerond. Je eerste verschijnt hier!</p>`;
  const items = db.history.slice(0, historyLimit).map((s) => {
    const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
    const meta = s.program === 'run'
      ? (runPlanFor(s.runKey)?.desc ?? '')
      : `${plural(s.exercises.length, 'oefening', 'oefeningen')} · ${plural(sets, 'set', 'sets')}`;
    const dur = s.finishedAt && s.finishedAt !== s.startedAt ? ` · ${fmtDuration(s.startedAt, s.finishedAt)}` : '';
    return `
      <details class="card hist">
        <summary>
          <span>${PROGRAMS[s.program].emoji} <strong>${esc(s.name)}</strong> <span class="muted">· ${esc(fmtDate(s.startedAt))}</span></span>
          <span class="muted small">${esc(meta)}${dur}${s.hr ? ` · ${hrText(s.hr)}` : ''}</span>
        </summary>
        <div class="hist-body">
          ${s.exercises.map((e) => `
            <div class="hist-ex"><strong>${esc(e.name)}</strong><span class="muted">${esc(e.sets.map((x) => fmtSet(x, e.kind)).join(' · '))}</span></div>`).join('')}
          <div class="row">
            <button class="btn small" data-action="hr-edit" data-id="${esc(s.id)}">❤️ Hartslag</button>
            <button class="btn small ghost danger" data-action="delete-session" data-id="${esc(s.id)}">Verwijder</button>
          </div>
        </div>
      </details>`;
  }).join('');
  const more = db.history.length > historyLimit
    ? `<button class="btn ghost block" data-action="more-history">Meer tonen</button>` : '';
  return `<div class="list">${items}</div>${more}`;
}

/* ----- Hardloopschema ----- */
function renderRun() {
  const done = runDoneMap();
  const next = nextRunKey(done);
  const nextPlan = runPlanFor(next);
  const count = Object.keys(done).length;
  const r = db.run.reminder;
  return `
    ${backHeader('Hardloopschema', `${count}/30 trainingen · 10 weken naar 5 km`)}
    ${renderRunBanner()}

    ${next ? `
      <section class="card next-run">
        <p class="eyebrow">Volgende training</p>
        <h3>${runTitle(next)}</h3>
        <p>${esc(nextPlan.desc)}</p>
        <p class="muted small">5 min wandelen · training · 5 min wandelen — ${esc(nextPlan.total)}</p>
        ${segStrip(expandSegments(nextPlan))}
        <div class="row">
          <button class="btn primary" data-action="run-start" data-key="${next}">▶ Start training</button>
          <button class="btn" data-action="run-detail" data-key="${next}">✓ Afvinken</button>
        </div>
      </section>` : `
      <section class="card next-run"><h3>Je hebt het hele schema afgerond! 🎉</h3><p>Je loopt nu 5 km. Super trots!</p></section>`}

    <h2>Afvinkkalender</h2>
    <div class="cal">
      <div class="cal-row cal-head"><span></span><span>Tr 1</span><span>Tr 2</span><span>Tr 3</span></div>
      ${RUN_PLAN.map((week, w) => `
        <div class="cal-row">
          <span class="cal-week">Wk ${w + 1}</span>
          ${week.map((_, t) => {
            const key = runKey(w, t);
            const d = done[key];
            return `<button class="cal-cell ${d ? 'done' : ''} ${key === next ? 'next' : ''}" data-action="run-detail" data-key="${key}"
              aria-label="${runTitle(key)}${d ? ', gedaan' : ''}">
              ${d ? `<span class="cal-check">✓</span><span class="cal-date">${fmtDateTiny(d.startedAt)}</span>` : key === next ? '<span>Volgende</span>' : `<span class="muted">${esc(RUN_PLAN[w][t].total)}</span>`}
            </button>`;
          }).join('')}
        </div>`).join('')}
    </div>

    <section class="card reminder">
      <h3>🔔 Herinnering: 3× per week</h3>
      <p class="muted small">Kies je vaste loopdagen en tijd.</p>
      <div class="chips">
        ${DAY_NAMES.map((d, i) => `<button class="chip ${r.days.includes(i) ? 'on' : ''}" data-action="rem-day" data-day="${i}" aria-pressed="${r.days.includes(i)}">${d}</button>`).join('')}
      </div>
      <label class="label">Tijd <input id="rem-time" class="input" type="time" value="${esc(r.time)}"></label>
      <div class="row">
        <button class="btn" data-action="rem-ics">📅 Zet in agenda</button>
        <button class="btn ${r.notify ? 'primary' : ''}" data-action="rem-notify">🔔 Meldingen ${r.notify ? 'aan' : 'uit'}</button>
      </div>
      <p class="muted small note">📅 <strong>Agenda</strong> = betrouwbaarste herinnering: herhaalt op je loopdagen, 30 min vooraf, ook als de app dicht is.
      🔔 <strong>Meldingen</strong> komen alleen als de app open staat of op de achtergrond draait (op iPhone alleen als de app op je beginscherm staat).</p>
    </section>

    <button class="btn ghost block subtle-link" data-action="go" data-view="heart">❤️ Hartslagzones bekijken</button>`;
}

function segStrip(segs) {
  const total = segs.reduce((n, s) => n + (s.sec ?? 1800), 0);
  return `<div class="seg-strip" aria-hidden="true">${segs.map((s) =>
    `<span class="seg s-${s.type}" style="flex:${(s.sec ?? 1800) / total}"></span>`).join('')}</div>
    <div class="seg-legend small"><span><i class="s-run"></i>hardlopen</span><span><i class="s-walk"></i>wandelen</span></div>`;
}

function renderRunSession() {
  const a = db.active;
  const r = a.run;
  const finished = r.i >= r.segs.length;
  const seg = r.segs[r.i];
  const nextSeg = r.segs[r.i + 1];
  const plan = runPlanFor(a.runKey);
  return `
    <header class="page-top">
      <button class="icon-btn back" data-action="go" data-view="home" aria-label="Naar start (training loopt door)">‹</button>
      <div class="grow"><h1>${esc(a.name)}</h1><p class="sub small">${esc(plan?.desc ?? '')}</p></div>
    </header>

    ${finished ? `
      <section class="run-now phase-done">
        <p class="run-phase">Klaar! 🎉</p>
        <p class="run-time">${fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</p>
        <p class="run-next">Super gedaan. Sla je training op.</p>
      </section>
      <button class="btn primary block big" data-action="run-finish">Opslaan</button>` : `
      <section class="run-now phase-${seg.type} ${r.paused ? 'paused' : ''}">
        <p class="run-phase">${esc(segLabel(seg))}</p>
        <p class="run-time" id="run-time">–:–</p>
        <div class="run-progress"><div id="run-bar"></div></div>
        <p class="run-next">${r.paused ? '⏸ Gepauzeerd' : seg.sec == null ? 'Tik op "Klaar" als je de afstand hebt gelopen' : nextSeg ? `Hierna: ${esc(segLabel(nextSeg))} ${nextSeg.sec ? `(${nextSeg.sec / 60} min)` : ''}` : 'Laatste stuk!'}</p>
      </section>
      <div class="row">
        ${seg.sec == null ? '' : `<button class="btn big" data-action="run-pause">${r.paused ? '▶ Hervat' : '⏸ Pauze'}</button>`}
        <button class="btn big ${seg.sec == null ? 'primary' : ''}" data-action="run-skip">${seg.sec == null ? '✓ Klaar' : 'Volgende ⏭'}</button>
      </div>`}

    <p class="muted small center" id="run-total"></p>
    <ol class="seg-list">
      ${r.segs.map((s, i) => `<li class="${i < r.i ? 'past' : i === r.i ? 'current' : ''} s-${s.type}">
        <span>${esc(segLabel(s))}</span><span>${s.sec == null ? esc(s.label) : `${s.sec / 60} min`}</span></li>`).join('')}
    </ol>
    ${finished ? '' : `<button class="btn ghost danger block" data-action="run-stop">Training stoppen</button>`}`;
}

/* ----- Pilates ----- */
/* ----- Thuis trainen: keuzescherm ----- */
const THUIS_OPTIONS = [
  { view: 'pilates', emoji: '🧘‍♀️', title: 'Pilates met bord', sub: 'Glijplaat, handgrepen & koorden · volledig scherm' },
  { view: 'mat', emoji: '🌿', title: 'Pilates op matje', sub: 'Alleen een matje · volledig scherm' },
  { view: 'dumbbell', emoji: '💪', title: 'Thuis met dumbbell', sub: 'Billen, full body of armen · kg per set' },
  { view: 'kettlebell', emoji: '🔔', title: 'Thuis met kettlebell', sub: 'Swings, squats & meer · kg per set' },
];
function renderThuis() {
  return `
    ${backHeader('Thuis trainen', 'Waarmee train je vandaag?')}
    <div class="programs">
      ${THUIS_OPTIONS.map((o) => `
        <button class="program-card" data-action="go" data-view="${o.view}">
          <span class="pc-emoji">${o.emoji}</span>
          <span class="pc-text"><span class="pc-title">${o.title}</span><span class="pc-sub">${o.sub}</span></span>
          <span class="chev">›</span>
        </button>`).join('')}
    </div>`;
}

const exGrid = (list) => `
  <div class="ex-grid">
    ${list.map((e) => `
      <button class="card ex-tile" data-action="ex-info" data-id="${e.id}">
        ${thumb(e.id, { animate: false })}
        <span>${esc(e.name)}</span>
        ${e.muscle ? `<span class="muscle-pill">${esc(e.muscle)}</span>` : ''}
      </button>`).join('')}
  </div>`;

/* ----- Pilates met bord / op matje (volledig-scherm speler) ----- */
function renderPilates() {
  const prog = PLAYER_PROGRAMS[view];
  const minutes = pilatesMinutes();
  const custom = minutes && ![10, 15, 20, 30].includes(minutes);
  return `
    ${backHeader(prog.title, prog.sub, 'thuis')}
    <section class="card setting duration-card">
      <p class="label">1. Hoelang wil je trainen?</p>
      <div class="chips duration-chips">
        ${[10, 15, 20, 30].map((mn) => `<button class="chip big-chip ${minutes === mn ? 'on' : ''}" data-action="pilates-minutes" data-min="${mn}" aria-pressed="${minutes === mn}">${mn} min</button>`).join('')}
        <button class="chip big-chip ${!minutes ? 'on' : ''}" data-action="pilates-minutes" data-min="full" aria-pressed="${!minutes}">Volledig</button>
      </div>
      <label class="custom-min">Eigen tijd
        <input id="pilates-custom-min" class="input" type="number" inputmode="numeric" min="5" max="90" step="1"
          value="${custom ? minutes : ''}" placeholder="bv. 25"> min
      </label>
      <p class="muted small note">${minutes
        ? `De app stelt zelf een schema van <strong>${minutes} minuten</strong> samen (oefeningen, sets en werktijd), inclusief rust en wisselmomenten.`
        : 'Volledig = het complete niveau-schema, zonder tijdslimiet.'}</p>
    </section>
    <p class="label">2. Kies je niveau <span class="muted small">— start op volledig scherm, schakelt vanzelf door</span></p>
    <div class="list">
      ${prog.levels.map((base) => {
        const l = minutes ? buildTimedLevel(view, base.id, minutes) : base;
        const entries = l.items.map((it) => newEntry(it.exerciseId, it));
        const total = segsTotal(buildPlayerSegs(l, entries));
        const sets = Math.max(...l.items.map((i) => i.sets));
        return `
        <button class="card level" data-action="start-pilates" data-program="${view}" data-id="${base.id}">
          <span class="level-head"><span class="pc-emoji">${base.emoji}</span><span class="grow"><span class="pc-title">${base.name}</span>
          <span class="pc-sub">${minutes ? `${fmtClock(total)} min · ${plural(l.items.length, 'oefening', 'oefeningen')} · ${plural(sets, 'set', 'sets')} · ${l.workSec || pilatesWork()} s per set`
            : `${esc(base.desc)} ± ${Math.round(total / 60)} min`} · rust ${base.rest} s</span></span><span class="chev">▶</span></span>
          <span class="level-ex">${l.items.map((it) => esc(exName(it.exerciseId))).join(' · ')}</span>
        </button>`;
      }).join('')}
    </div>
    <details class="card setting">
      <summary class="label" style="margin:0">⚙️ Instellingen: werktijd & wisseltijd</summary>
      <p class="label">Tijd per set <span class="muted small">(bij "Volledig"; bij een gekozen tijd rekent de app zelf)</span></p>
      <div class="chips">
        ${[30, 40, 50, 60].map((s) => `<button class="chip ${pilatesWork() === s ? 'on' : ''}" data-action="pilates-work" data-sec="${s}" aria-pressed="${pilatesWork() === s}">${s} sec</button>`).join('')}
      </div>
      <p class="label">Wisseltijd tussen oefeningen</p>
      <div class="chips">
        ${[10, 15, 20, 30].map((s) => `<button class="chip ${pilatesSwitch() === s ? 'on' : ''}" data-action="pilates-switch" data-sec="${s}" aria-pressed="${pilatesSwitch() === s}">${s} sec</button>`).join('')}
      </div>
    </details>
    <h2>Alle oefeningen</h2>
    ${exGrid(prog.exercises)}`;
}

/* ----- Thuis met dumbbell / kettlebell (set-tracker met kg) ----- */
function renderHomeWeights() {
  const kind = view;
  const opt = THUIS_OPTIONS.find((o) => o.view === kind);
  return `
    ${backHeader(opt.title, 'Kies een schema · kg en reps per set', 'thuis')}
    <div class="list">
      ${HOME_TEMPLATES[kind].map((t) => `
        <div class="card tpl">
          <button class="tpl-main" data-action="start-home" data-kind="${kind}" data-id="${t.id}">
            <span class="tpl-name">${esc(t.name)}</span>
            <span class="tpl-note">${esc(t.note)}</span>
            <span class="tpl-ex">${esc(t.items.map((i) => exName(i.exerciseId)).join(' · '))}</span>
          </button>
          <span class="chev" style="margin-right:16px">▶</span>
        </div>`).join('')}
    </div>
    <button class="btn ghost block" data-action="start-home-empty" data-kind="${kind}">Of start een lege workout</button>
    <h2>Alle oefeningen</h2>
    ${exGrid(HOME_EXERCISES.filter((e) => e.program === kind))}`;
}

/* ----- Basic-Fit ----- */
const isOwnTemplate = (t) => !BUILTIN_TEMPLATE_IDS.includes(t.id);

/** Vaste zones + (als die er zijn) een zone met zelf toegevoegde Basic-Fit-apparaten van dit profiel. */
function gymZones() {
  const own = db.exercises.filter((e) => e.program === 'gym');
  if (!own.length) return GYM_EQUIPMENT;
  const items = {};
  for (const e of own) (items[e.toestel || 'Overig'] ||= []).push(e.id);
  return [...GYM_EQUIPMENT, { zone: 'Zelf toegevoegd', emoji: '⭐', items }];
}

function tplCard(t) {
  const own = isOwnTemplate(t);
  return `
    <div class="card tpl ${own ? 'own' : ''}">
      ${t.focus ? `<span class="glute-badge" title="${esc(GLUTE_INFO[t.focus].name)}">${gluteSVG(t.focus)}</span>` : ''}
      <button class="tpl-main" data-action="start-gym" data-id="${esc(t.id)}">
        <span class="tpl-name">${esc(t.name)}</span>
        ${own ? `<span class="tpl-note muscle">Eigen schema · ${plural(t.items.length, 'oefening', 'oefeningen')}</span>`
          : t.note ? `<span class="tpl-note ${t.focus ? 'muscle' : ''}">${esc(t.note)}</span>` : ''}
        <span class="tpl-ex">${esc(t.items.map((i) => exName(i.exerciseId)).join(' · ') || 'Nog geen oefeningen')}</span>
      </button>
      <button class="icon-btn" data-action="edit-template" data-id="${esc(t.id)}" aria-label="${esc(t.name)} bewerken">✎</button>
    </div>`;
}

function renderGym() {
  const builtin = db.templates.filter((t) => !isOwnTemplate(t));
  const own = db.templates.filter(isOwnTemplate);
  return `
    ${backHeader('Basic-Fit', 'Kies je schema')}
    <div class="list">${builtin.map(tplCard).join('')}</div>
    ${GYM_TEMPLATES.some((g) => !db.templates.find((t) => t.id === g.id))
      ? `<button class="btn ghost block" data-action="restore-templates">Standaardschema's terugzetten</button>` : ''}

    <h2 class="own-head">✨ Mijn eigen schema's</h2>
    <div class="list">
      ${own.map(tplCard).join('')}
      <button class="create-card" data-action="new-template">
        <span class="create-plus">＋</span>
        <span><strong>Maak je eigen schema</strong><br>
        <span class="small">Kies oefeningen, zet ze in je eigen volgorde en sla op om later te gebruiken.</span></span>
      </button>
    </div>
    <button class="btn ghost block" data-action="start-empty">Of start een lege workout</button>

    <h2>🏋️ Toestellen & zones</h2>
    <p class="muted small">Alle Basic-Fit toestellen met de oefeningen die je erop kunt doen. Tik op een oefening voor uitleg.
    Is een toestel bezet? Gebruik ⇄ Wissel in je workout.</p>
    <div class="list">
      ${gymZones().map((z) => `
        <details class="card zone-card">
          <summary><span class="zone-emoji">${z.emoji}</span><span class="grow"><strong>${esc(z.zone)}</strong><br>
            <span class="muted small">${plural(Object.keys(z.items).length, 'toestel', 'toestellen')} · ${Object.values(z.items).flat().length} oefeningen</span></span><span class="chev">›</span></summary>
          ${Object.entries(z.items).map(([toestel, ids]) => `
            <div class="toestel">
              <p class="toestel-name">${esc(toestel)}</p>
              <div class="toestel-ex">
                ${ids.map((id) => {
                  const e = exById(id);
                  return `<button class="toestel-pick" data-action="ex-info" data-id="${id}">
                    ${thumb(id, { animate: false })}
                    <span class="grow"><span class="pick-name">${esc(e.name)}</span>
                    ${e.muscle ? `<span class="muscle-pill">${esc(e.muscle)}</span>` : ''}
                    ${e.uni ? '<span class="uni-tag">↔ L/R</span>' : ''}</span>
                  </button>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </details>`).join('')}
    </div>
    <button class="create-card feedback-card" data-action="feedback" data-type="apparaat">
      <span class="create-plus">📸</span>
      <span><strong>Apparaat of oefening mist?</strong><br>
      <span class="small">Stuur de naam (en een foto van het apparaat of het bordje erop), dan wordt het toegevoegd.</span></span>
    </button>`;
}

/* ----- Hartslag ----- */
function renderHeart() {
  const p = db.profile;
  const max = effectiveMaxHr();
  const withHr = db.history.filter((s) => s.hr);
  return `
    ${backHeader('Hartslag', 'Zones & hartslag per training', 'run')}

    <section class="card info">
      <h3>⌚ Smartwatch & live hartslag</h3>
      <p class="small">Deze app draait in je browser. Browsers kunnen <strong>niet</strong> direct de live hartslag van een
      smartwatch (Apple Watch, Garmin, Fitbit, Samsung…) uitlezen — die gegevens blijven in de app van je horloge.
      Kijk daarom na je training in je horloge-app en vul hier je <strong>gemiddelde</strong> en <strong>maximale</strong>
      hartslag in. Zo zie je in welke zone je trainde.</p>
    </section>

    <h2>Jouw gegevens</h2>
    <section class="card">
      <div class="form-grid">
        <label class="label">Leeftijd<input class="input" data-profile="age" inputmode="numeric" value="${p.age ?? ''}" placeholder="bv. 28"></label>
        <label class="label">Rusthartslag<input class="input" data-profile="restHr" inputmode="numeric" value="${p.restHr ?? ''}" placeholder="bv. 62"></label>
        <label class="label">Max-HR<input class="input" data-profile="maxHr" inputmode="numeric" value="${p.maxHr ?? ''}" placeholder="${p.age ? `± ${Math.round(208 - 0.7 * p.age)}` : 'bv. 188'}"></label>
      </div>
      <p class="muted small note">Max-HR is optioneel en wordt anders geschat met 208 − 0,7 × leeftijd. Weet je je echte max (uit je horloge)? Vul die in.
      Met rusthartslag gebruiken we de nauwkeurigere Karvonen-methode.</p>
    </section>

    <h2>Hartslagzones</h2>
    ${max ? `
      <div class="zones">
        ${HR_ZONES.map((z, i) => `
          <div class="zone z${i + 1}">
            <span class="zone-bar"></span>
            <span class="grow"><strong>${z.name}</strong><br><span class="muted small">${z.feel}</span></span>
            <span class="zone-bpm">${zoneBpm(z.from)}–${zoneBpm(z.to)}</span>
          </div>`).join('')}
      </div>
      <p class="muted small note">💡 Voor het hardloopschema is zone 2–3 ideaal: rustig genoeg om te kunnen praten.</p>`
    : `<p class="muted">Vul je leeftijd (of max-HR) in om je zones te zien.</p>`}

    <h2>Hartslag per training</h2>
    ${withHr.length ? `<div class="list">${withHr.slice(0, 20).map((s) => {
      const z = zoneOf(s.hr.avg);
      return `
        <button class="card hr-row" data-action="hr-edit" data-id="${esc(s.id)}">
          <span class="grow">${PROGRAMS[s.program].emoji} <strong>${esc(s.name)}</strong><br><span class="muted small">${esc(fmtDate(s.startedAt))}</span></span>
          <span class="hr-vals">${s.hr.avg ? `<strong>${s.hr.avg}</strong> gem.` : ''}${s.hr.max ? `<br><span class="muted small">max ${s.hr.max}</span>` : ''}</span>
          ${z >= 0 ? `<span class="zone-pill z${z + 1}">Z${z + 1}</span>` : ''}
        </button>`;
    }).join('')}</div>` : `<p class="muted">Nog geen hartslag ingevuld. Dat kan na het afronden van een training, of via de geschiedenis (❤️ Hartslag).</p>`}`;
}

/* ----- Sessie (gym + pilates) ----- */
function renderWorkout() {
  const a = db.active;
  const focus = a.program === 'gym' ? db.templates.find((t) => t.id === a.templateId)?.focus : null;
  return `
    <header class="page-top">
      <button class="icon-btn back" data-action="go" data-view="home" aria-label="Terug naar start">‹</button>
      <div class="grow">
        <h1>${PROGRAMS[a.program].emoji} ${esc(a.name)}</h1>
        <p class="sub small" id="elapsed"></p>
      </div>
      <button class="btn primary small" data-action="finish">Afronden</button>
    </header>
    ${focus ? `
      <div class="focus-banner">
        <span class="glute-badge">${gluteSVG(focus)}</span>
        <span><strong>Focus: ${esc(GLUTE_INFO[focus].name)}</strong><br><span class="muted small">${esc(GLUTE_INFO[focus].short)} — groen gemarkeerd</span></span>
      </div>` : ''}

    ${a.exercises.length ? a.exercises.map(renderEntry).join('') : `<p class="empty">Nog geen oefeningen — voeg er een toe.</p>`}

    <button class="btn block" data-action="add-exercise">+ Oefening toevoegen</button>
    <button class="btn ghost danger block" data-action="discard">Workout annuleren</button>`;
}

function renderEntry(entry) {
  const ex = exById(entry.exerciseId);
  const prev = findPrevious(entry.exerciseId);
  const summary = prev
    ? `Vorige keer (${fmtDate(prev.date)}): ${prev.sets.map((s) => fmtSet(s, entry.kind)).join(' · ')}`
    : 'Eerste keer — succes! 💪';
  const kindCols = {
    weights: '<span>kg</span><span>reps</span><span></span>',
    cardio: '<span>min</span><span>niveau</span><span></span>',
    reps: '<span>reps</span><span></span>',
    time: '<span>sec</span><span></span><span></span>',
  }[entry.kind];
  return `
    <article class="card exercise" data-entry="${esc(entry.id)}">
      <div class="ex-top">
        <button class="ex-thumb" data-action="ex-info" data-id="${esc(entry.exerciseId)}" aria-label="Uitleg ${esc(entry.name)}">
          ${thumb(entry.exerciseId)}
        </button>
        <div class="ex-info">
          <div class="ex-head">
            <h3>${esc(entry.name)}</h3>
            <button class="icon-btn" data-action="remove-exercise" aria-label="${esc(entry.name)} verwijderen">✕</button>
          </div>
          ${ex?.muscle ? `<p class="muscle-line"><span class="muscle-pill">💪 ${esc(ex.muscle)}</span></p>` : ''}
          ${ex?.side ? `<p class="side-line"><span class="side-pill side-${ex.side}">${ex.side === 'L' ? '⬅ Linkerbeen' : 'Rechterbeen ➡'}</span></p>` : ''}
          ${entry.target ? `<p class="target">🎯 ${setsPerSide(entry)} × ${esc(entry.target)}</p>` : ''}
          <div class="ex-actions">
            <button class="chip small-chip" data-action="ex-info" data-id="${esc(entry.exerciseId)}">ⓘ Uitleg</button>
            ${timesDone(entry.exerciseId) >= 2 ? `<button class="chip small-chip" data-action="progress-ex" data-id="${esc(entry.exerciseId)}">📈 Voortgang</button>` : ''}
            ${swapOptions(entry).all.length ? `<button class="chip small-chip" data-action="swap">⇄ Wissel</button>` : ''}
          </div>
        </div>
      </div>
      ${ex?.tip ? `<p class="tip">💡 ${esc(ex.tip)}</p>` : ''}
      <label class="note-wrap">📝
        <input class="note-input" data-note="${esc(entry.exerciseId)}" value="${esc(db.notes?.[entry.exerciseId] ?? '')}"
          placeholder="Notitie (bv. stoel op stand 4, band rood)" maxlength="300" autocomplete="off" enterkeyhint="done">
      </label>
      <p class="prev">${esc(summary)}</p>
      ${entry.uni ? `<p class="uni-hint">↔ Eenzijdig: doe per set eerst <strong>${sideLabel('L', entry.uni)}</strong>, dan <strong>${sideLabel('R', entry.uni)}</strong>.</p>` : ''}
      <div class="sets">
        <div class="set-row k-${entry.kind} ${entry.uni ? 'uni' : ''} head"><span>Set</span><span>Vorige</span>${kindCols}</div>
        ${entry.sets.map((s, i) => renderSet(entry, s, i, prev)).join('')}
      </div>
      <div class="row">
        <button class="btn small" data-action="add-set">+ Set${entry.uni ? ' (L + R)' : ''}</button>
        ${setsPerSide(entry) > 1 ? `<button class="btn small ghost" data-action="remove-set">− Laatste set</button>` : ''}
      </div>
    </article>`;
}

const setsPerSide = (entry) => (entry.uni ? Math.ceil(entry.sets.length / 2) : entry.sets.length);

function renderSet(entry, s, i, prev) {
  const ph = placeholderFor(entry, i, prev);
  const p = prevSetFor(entry, i, prev);
  const setNo = entry.uni ? Math.floor(i / 2) + 1 : i + 1;
  const numCell = s.side
    ? `<span class="set-num uni-num side-${s.side}">${setNo}<small>${sideLabel(s.side, entry.uni || 'kant')}</small></span>`
    : `<span class="set-num">${setNo}</span>`;
  const kgInput = `<input class="num" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next"
      data-field="kg" aria-label="Set ${i + 1} kg" value="${fmtNum(s.kg)}" placeholder="${fmtNum(ph.kg)}">`;
  const repsInput = `<input class="num" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done"
      data-field="reps" aria-label="Set ${i + 1} reps" value="${s.reps ?? ''}" placeholder="${ph.reps ?? ''}">`;
  const secInput = `<input class="num" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done"
      data-field="sec" aria-label="Set ${i + 1} seconden" value="${s.sec ?? ''}" placeholder="${ph.sec ?? ''}">`;
  const inputs = {
    weights: kgInput + repsInput,
    reps: repsInput,
    time: `${secInput}<button class="play" data-action="work-timer" aria-label="Start ${ph.sec ?? ''} seconden">▶</button>`,
    cardio: `<input class="num" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next"
      data-field="min" aria-label="Minuten" value="${s.min ?? ''}" placeholder="${ph.min ?? ''}">
      <input class="num" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
      data-field="lvl" aria-label="Niveau of helling" value="${fmtNum(s.lvl)}" placeholder="${fmtNum(ph.lvl)}">`,
  }[entry.kind];
  return `
    <div class="set-row k-${entry.kind} ${s.side ? `uni side-${s.side}` : ''} ${s.done ? 'done' : ''}" data-set="${i}">
      ${numCell}
      <span class="set-prev">${p ? esc(fmtSetShort(p, entry.kind)) : '–'}</span>
      ${inputs}
      <button class="check" data-action="toggle-set" aria-pressed="${s.done}" aria-label="Set ${i + 1} afronden">✓</button>
    </div>`;
}

/* ---------- Illustraties (ingebouwde SVG, zie CLAUDE.md) ---------- */
const PT = { h: 0, n: 2, p: 4, e: 6, w: 8, k: 10, f: 12, e2: 14, w2: 16, k2: 18, f2: 20 };
const HOLD_SHAPES = {
  db: '<rect class="w-bar" x="-7" y="-1.6" width="14" height="3.2" rx="1"/><rect class="w-plate" x="-10" y="-5.5" width="4.5" height="11" rx="1.5"/><rect class="w-plate" x="5.5" y="-5.5" width="4.5" height="11" rx="1.5"/>',
  plate: '<circle class="w-plate" r="11"/><circle class="w-hub" r="3"/>',
  smallplate: '<circle class="w-plate" r="6.5"/><circle class="w-hub" r="2"/>',
  kb: '<path class="w-handle" d="M-4.5,4 C-4.5,-3 4.5,-3 4.5,4"/><circle class="w-plate" cx="0" cy="9" r="7"/>',
  grip: '<rect class="w-grip" x="-3.5" y="-5" width="7" height="10" rx="3"/>',
  pad: '<rect class="w-pad" x="-5" y="-5" width="10" height="10" rx="4"/>',
  bar: '<rect class="w-bar" x="-12" y="-2" width="24" height="4" rx="2"/>',
  footplate: '<rect class="w-plate" x="2" y="-22" width="6" height="44" rx="2"/>',
  footplate45: '<rect class="w-plate" x="2" y="-22" width="6" height="44" rx="2" transform="rotate(-45)"/>',
  ball: '<circle class="w-plate" r="8"/><path class="w-hub" d="M-8,0 H8" stroke-width="1.5"/>',
  wheel: '<circle class="w-plate" r="6"/><circle class="w-hub" r="2"/>',
  roller: '<circle class="eq" r="8"/><circle class="w-hub" r="2.5"/>',
};

/** Toestel + zone bij een Basic-Fit-oefening (uit GYM_EQUIPMENT). */
const EQUIPMENT_OF = {};
for (const z of GYM_EQUIPMENT) {
  for (const [toestel, ids] of Object.entries(z.items)) for (const id of ids) EQUIPMENT_OF[id] ??= { toestel, zone: z.zone, emoji: z.emoji };
}

function expandFrame(f) {
  if (f.length >= 22) return f;
  const back = f.slice(6, 14).map((v, i) => (i % 2 === 0 ? v - 3 : v));
  return [...f, ...back];
}

/** Tekent een oefening-illustratie. animate=false → statisch (eindpositie). */
function figureSVG(key, { animate = true } = {}) {
  const pose = POSES[key];
  if (!pose) return fallbackSVG();
  let [A, B] = pose.frames.map(expandFrame);
  if (!animate) A = B;
  const dur = pose.dur || 2.6;
  const at = (f, name) => [f[PT[name]], f[PT[name] + 1]];
  const pts = (f, names) => names.map((nm) => at(f, nm).join(',')).join(' ');
  const anim = (attr, a, b) => (!animate || a === b ? '' : `<animate attributeName="${attr}" values="${a};${b};${a}" keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur}s" repeatCount="indefinite"/>`);
  const poly = (names, cls) => { const a = pts(A, names); const b = pts(B, names); return `<polyline class="${cls}" points="${a}">${anim('points', a, b)}</polyline>`; };
  const movingXY = (a, b, inner) => `<g transform="translate(${a})">${animate && a !== b ? `<animateTransform attributeName="transform" type="translate" values="${a};${b};${a}" keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur}s" repeatCount="indefinite"/>` : ''}${inner}</g>`;
  const moving = (name, inner, dx = 0, dy = 0) => {
    const [ax, ay] = at(A, name); const [bx, by] = at(B, name);
    return movingXY(`${ax + dx},${ay + dy}`, `${bx + dx},${by + dy}`, inner);
  };
  const line = (from, to, cls) => {
    const a = `${from.join(',')} ${at(A, to).join(',')}`; const b = `${from.join(',')} ${at(B, to).join(',')}`;
    return `<polyline class="${cls}" points="${a}">${anim('points', a, b)}</polyline>`;
  };

  let ground = '';
  if (pose.board) {
    const { x0, x1 } = pose.board;
    ground = `<rect class="fig-floor" x="6" y="126" width="188" height="3" rx="1.5"/>
      <rect class="pb-board" x="${x0}" y="120" width="${x1 - x0}" height="6" rx="3"/>
      <rect class="pb-rail" x="${x0 + 14}" y="121.5" width="${x1 - x0 - 28}" height="1.6" rx=".8"/>
      <rect class="pb-post" x="${x0 + 1}" y="109" width="7" height="12" rx="3"/>
      <rect class="pb-post" x="${x1 - 8}" y="109" width="7" height="12" rx="3"/>`;
    if (pose.slider) {
      // slede schuift alleen horizontaal mee met het lichaamspunt dat erop staat
      ground += movingXY(`${at(A, pose.slider)[0]},114`, `${at(B, pose.slider)[0]},114`,
        '<rect class="pb-car" x="-15" y="0" width="30" height="6" rx="2"/><rect class="pb-car-line" x="-11" y="2.2" width="22" height="1.5" rx=".7"/>');
    }
  } else {
    ground = '<rect class="fig-floor" x="6" y="124" width="188" height="4" rx="2"/>';
  }

  const cords = (pose.cords || []).map((c) => line(c.from, c.to, 'fig-band')).join('');
  const cables = (pose.cables || []).map((c) => line(c.from, c.to, c.bar ? 'fig-barline' : 'fig-cable')).join('');
  const links = (pose.links || []).map(([p1, p2]) => {
    const a = `${at(A, p1).join(',')} ${at(A, p2).join(',')}`; const b = `${at(B, p1).join(',')} ${at(B, p2).join(',')}`;
    return `<polyline class="fig-band thick" points="${a}">${anim('points', a, b)}</polyline>`;
  }).join('');
  const holds = (pose.holds || []).map((h) => moving(h.at, HOLD_SHAPES[h.t] || '', h.dx || 0, h.dy || 0)).join('');
  const back = pose.front ? 'fig-side' : 'fig-back';

  return `<svg class="fig" viewBox="${poseViewBox(key)}" role="img" aria-label="Illustratie van de oefening">
    ${pose.props || ''}
    ${ground}
    ${cables}${cords}
    <g class="${back}">${poly(['n', 'e2', 'w2'], 'limb')}${poly(['p', 'k2', 'f2'], 'limb')}</g>
    ${poly(['n', 'p'], 'torso')}
    ${poly(['p', 'k', 'f'], 'limb')}
    ${poly(['n', 'e', 'w'], 'limb')}
    ${links}${holds}
    <circle class="fig-head" cx="${A[0]}" cy="${A[1]}" r="9">${anim('cx', A[0], B[0])}${anim('cy', A[1], B[1])}</circle>
  </svg>`;
}

/** Zoomt in op poppetje + toestel (zelfde beeldverhouding 200:135, vloer blijft onderin). */
const viewBoxCache = {};
function poseViewBox(key) {
  if (viewBoxCache[key]) return viewBoxCache[key];
  const pose = POSES[key];
  const xs = []; const ys = [];
  for (const f of pose.frames.map(expandFrame)) {
    f.forEach((v, i) => (i % 2 ? ys : xs).push(v));
    ys.push(f[1] - 10); // hoofd-radius
  }
  for (const c of [...(pose.cords || []), ...(pose.cables || [])]) { xs.push(c.from[0]); ys.push(c.from[1]); }
  if (pose.board) xs.push(pose.board.x0, pose.board.x1);
  for (const h of pose.holds || []) {
    const i = PT[h.at];
    for (const f of pose.frames.map(expandFrame)) { xs.push(f[i] + (h.dx || 0) - 12, f[i] + (h.dx || 0) + 12); ys.push(f[i + 1] + (h.dy || 0) - 12); }
  }
  for (const m of (pose.props || '').matchAll(/<rect[^>]*?x="([\d.-]+)"[^>]*?y="([\d.-]+)"[^>]*?width="([\d.-]+)"/g)) {
    xs.push(+m[1], +m[1] + +m[3]); ys.push(+m[2]);
  }
  for (const m of (pose.props || '').matchAll(/points="([^"]+)"/g)) {
    m[1].trim().split(/\s+/).forEach((p) => { const [x, y] = p.split(',').map(Number); xs.push(x); ys.push(y); });
  }
  const minX = Math.min(...xs) - 8; const maxX = Math.max(...xs) + 8;
  const minY = Math.min(...ys) - 6; const maxY = 130;
  let w = maxX - minX; let h = maxY - minY;
  const ratio = 200 / 135;
  let x = minX; let y = minY;
  if (w / h < ratio) { const nw = h * ratio; x -= (nw - w) / 2; w = nw; } else { const nh = w / ratio; y = maxY - nh; h = nh; }
  const MIN_W = 150; // niet te ver inzoomen, anders worden lijnen te dik
  if (w < MIN_W) { x -= (MIN_W - w) / 2; w = MIN_W; h = w / ratio; y = maxY - h; }
  viewBoxCache[key] = [x, y, w, h].map((v) => Math.round(v * 10) / 10).join(' ');
  return viewBoxCache[key];
}

/** Vaste illustratie voor eigen oefeningen zonder pose (nooit een leeg plaatje). */
function fallbackSVG() {
  return `<svg class="fig" viewBox="0 0 200 135" role="img" aria-label="Oefening">
    <rect class="fig-floor" x="6" y="124" width="188" height="4" rx="2"/>
    <g transform="translate(100,68) rotate(-20)">
      <rect class="w-bar" x="-46" y="-5" width="92" height="10" rx="4"/>
      <rect class="w-plate" x="-62" y="-26" width="14" height="52" rx="5"/><rect class="w-plate" x="-76" y="-18" width="12" height="36" rx="5"/>
      <rect class="w-plate" x="48" y="-26" width="14" height="52" rx="5"/><rect class="w-plate" x="64" y="-18" width="12" height="36" rx="5"/>
    </g></svg>`;
}

/** Plaatje links van een oefening: eigen bestand (LOCAL_IMAGES) over de ingebouwde SVG heen. */
function thumb(exerciseId, { animate = true } = {}) {
  const ex = exById(exerciseId);
  const img = LOCAL_IMAGES[exerciseId];
  return `<span class="thumb">${figureSVG(ex?.pose, { animate })}${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

/** Bilspier-badge (achteraanzicht). De gekozen spier wordt groen gemarkeerd. */
function gluteSVG(focus) {
  const cls = (m) => (m === focus ? 'gl-hl' : 'gl-m');
  const half = `
    <path class="${cls('medius')}" d="M16 22 C26 14 46 16 56 26 C50 34 36 40 20 44 C16 36 15 28 16 22 Z"/>
    <path class="${cls('maximus')}" d="M20 44 C36 40 52 34 58 30 C62 46 62 66 58 82 C44 86 26 84 16 74 C14 62 16 52 20 44 Z"/>
    <path class="${cls('minimus')} gl-deep" d="M23 27 C31 22 42 23 48 28 C42 33 32 36 25 38 C22 34 21 30 23 27 Z"/>`;
  return `<svg class="glute" viewBox="0 0 120 92" role="img" aria-label="${esc(GLUTE_INFO[focus]?.name || '')}">
    <path class="gl-body" d="M14 4 C10 30 6 52 10 90 L57 90 L60 60 L63 90 L110 90 C114 52 110 30 106 4 Z"/>
    ${half}
    <g transform="translate(120,0) scale(-1,1)">${half}</g>
  </svg>`;
}

function updateLive() {
  const a = db.active;
  if (view !== 'workout' || !a) return;
  const el = $('#elapsed');
  if (el) el.textContent = `⏱ ${fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}`;
  if (a.run) {
    const r = a.run;
    const seg = r.segs[r.i];
    const t = $('#run-time');
    const bar = $('#run-bar');
    if (seg && t) {
      if (seg.sec == null) {
        t.textContent = fmtClock((Date.now() - r.segStart) / 1000);
        if (bar) bar.style.width = '100%';
      } else {
        const left = r.paused ? r.pausedLeft : r.endAt - Date.now();
        const secsLeft = Math.ceil(left / 1000 - 0.001);
        t.textContent = fmtClock(secsLeft);
        if (bar) bar.style.width = `${Math.min(100, (1 - left / (seg.sec * 1000)) * 100)}%`;
        // laatste 3 seconden: zichtbaar aftellen + korte piepjes (één per seconde)
        const counting = !r.paused && secsLeft >= 1 && secsLeft <= 3;
        app.querySelector('.player, .run-now')?.classList.toggle('countdown', counting);
        const key = `${r.i}:${secsLeft}`;
        if (counting && lastCountKey !== key) { lastCountKey = key; tick(); }
      }
    }
    const tot = $('#run-total');
    if (tot) tot.textContent = `Totaal ${fmtClock((Date.now() - new Date(a.startedAt)) / 1000)} · segment ${Math.min(r.i + 1, r.segs.length)}/${r.segs.length}`;
  }
}

/* ---------- Sheets, dialogs, toast ---------- */
const sheet = $('#sheet');
const confirmEl = $('#confirm');

function openSheet(html) {
  sheet.innerHTML = html;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }
for (const d of [sheet, confirmEl]) {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}
const sheetHead = (title) => `
  <div class="sheet-head"><h2>${title}</h2>
  <button class="icon-btn" data-action="close-sheet" aria-label="Sluiten">✕</button></div>`;

/** choices: [{ value, label, cls }] → Promise<value | ''> */
function choiceDialog(message, choices, extraHtml = '') {
  return new Promise((resolve) => {
    confirmEl.innerHTML = `
      <form method="dialog" class="sheet-inner">
        <p class="confirm-text">${esc(message)}</p>
        ${extraHtml}
        <div class="row">
          ${choices.map((c) => `<button class="btn ${c.cls || ''}" value="${c.value}">${esc(c.label)}</button>`).join('')}
        </div>
      </form>`;
    confirmEl.returnValue = '';
    confirmEl.addEventListener('close', () => resolve(confirmEl.returnValue), { once: true });
    confirmEl.showModal();
  });
}
async function confirmDialog(message, okText = 'OK', danger = false) {
  return (await choiceDialog(message, [
    { value: 'cancel', label: 'Annuleer' },
    { value: 'ok', label: okText, cls: danger ? 'danger-fill' : 'primary' },
  ])) === 'ok';
}
/** Vraagt (optioneel) gemiddelde/max hartslag. → null bij annuleren, anders { hr } */
async function hrDialog(message, okText = 'Opslaan', current = null) {
  const extra = `
    <div class="form-grid two">
      <label class="label">Gem. hartslag<input id="hr-avg" class="input" inputmode="numeric" placeholder="bv. 145" value="${current?.avg ?? ''}"></label>
      <label class="label">Max. hartslag<input id="hr-max" class="input" inputmode="numeric" placeholder="bv. 172" value="${current?.max ?? ''}"></label>
    </div>
    <p class="muted small">❤️ Optioneel — overnemen uit je smartwatch-app.</p>`;
  const p = choiceDialog(message, [
    { value: 'cancel', label: 'Annuleer' },
    { value: 'ok', label: okText, cls: 'primary' },
  ], extra);
  const avgEl = $('#hr-avg');
  const maxEl = $('#hr-max');
  const res = await p;
  if (res !== 'ok') return null;
  const avg = parseNum(avgEl.value);
  const max = parseNum(maxEl.value);
  return { hr: avg || max ? { avg: avg ? Math.round(avg) : null, max: max ? Math.round(max) : null } : null };
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- Oefening-info (illustratie + stappen) ---------- */
function openExerciseInfo(id) {
  const ex = exById(id);
  if (!ex) return;
  openSheet(`
    <div class="sheet-inner">
      ${sheetHead(esc(ex.name))}
      <div class="fig-big">${thumb(id)}</div>
      ${ex.muscle ? `<p class="center"><span class="muscle-pill">💪 Traint vooral: ${esc(ex.muscle)}</span></p>` : ''}
      ${ex.side ? `<p class="center"><span class="side-pill side-${ex.side}">${ex.side === 'L' ? '⬅ Linkerbeen' : 'Rechterbeen ➡'}</span></p>` : ''}
      ${ex.uni ? `<p class="muted small center">↔ Eenzijdig: per set eerst ${sideLabel('L', ex.uni)}, dan ${sideLabel('R', ex.uni)}</p>` : ''}
      ${EQUIPMENT_OF[id] ? `<p class="muted small center">📍 ${esc(EQUIPMENT_OF[id].toestel)} · ${esc(EQUIPMENT_OF[id].zone)}</p>`
        : ex.toestel ? `<p class="muted small center">📍 ${esc(ex.toestel)} · zelf toegevoegd</p>` : ''}
      ${timesDone(id) >= 2 ? `<button class="btn ghost block" data-action="progress-ex" data-id="${esc(id)}">📈 Bekijk je voortgang</button>` : ''}
      ${ex.equipment ? `<p class="muted small center">🧰 ${esc(ex.equipment)}</p>` : ''}
      ${ex.steps ? `<ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${ex.tip ? `<p class="tip big-tip">💡 ${esc(ex.tip)}</p>` : ''}
      ${!ex.steps && !ex.tip ? '<p class="muted">Eigen oefening.</p>' : ''}
      <button class="btn ghost block" data-action="feedback" data-type="vraag" data-subject="${esc(ex.name)}">💬 Vraag of opmerking over deze oefening</button>
    </div>`);
}

/* ---------- Zelf een apparaat/oefening toevoegen (per profiel, in db.exercises) ---------- */
const OWN_PROGRAMS = { gym: 'Basic-Fit', dumbbell: 'Thuis met dumbbell', kettlebell: 'Thuis met kettlebell' };
const OWN_KINDS = { weights: 'kg + reps', reps: 'alleen reps', time: 'tijd (sec)', cardio: 'cardio (min)' };
const OWN_MUSCLES = ['Bil (gluteus maximus)', 'Bil (gluteus medius)', 'Bil (gluteus minimus)', 'Hamstrings', 'Voorkant bovenbeen',
  'Binnenkant bovenbeen', 'Kuiten', 'Rug', 'Borst', 'Schouders', 'Biceps', 'Triceps', 'Buik', 'Core', 'Conditie'];
let ownDraft = null;

function openAddOwn() {
  ownDraft = { program: 'gym', kind: 'weights', uni: false };
  renderAddOwn();
}
function renderAddOwn() {
  const mine = db.exercises.filter((e) => OWN_PROGRAMS[e.program]);
  openSheet(`
    <div class="sheet-inner add-own">
      ${sheetHead('➕ Apparaat of oefening toevoegen')}
      <button class="create-card feedback-card" data-action="feedback" data-type="apparaat">
        <span class="create-plus">📸</span>
        <span><strong>Laten toevoegen (met foto)</strong><br><span class="small">Stuur naam + foto; dan komt er een tekening, tip en spiergroep bij.</span></span>
      </button>
      <p class="label">Of zelf direct toevoegen</p>
      <label class="label">Naam van de oefening
        <input id="own-name" class="input" maxlength="80" placeholder="bv. Glute drive" autocomplete="off" value="${esc(ownDraft.name || '')}">
      </label>
      <p class="label">Waar?</p>
      <div class="chips">${Object.entries(OWN_PROGRAMS).map(([k, v]) => `<button class="chip ${ownDraft.program === k ? 'on' : ''}" data-action="own-prog" data-v="${k}">${v}</button>`).join('')}</div>
      ${ownDraft.program === 'gym' ? `<label class="label">Toestel <span class="muted small">(optioneel)</span>
        <input id="own-toestel" class="input" maxlength="80" placeholder="bv. Hammer Strength glute drive" autocomplete="off" value="${esc(ownDraft.toestel || '')}">
      </label>` : ''}
      <label class="label">Spiergroep
        <select id="own-muscle" class="input">${OWN_MUSCLES.map((mu) => `<option ${ownDraft.muscle === mu ? 'selected' : ''}>${mu}</option>`).join('')}</select>
      </label>
      <p class="label">Wat vul je in?</p>
      <div class="chips">${Object.entries(OWN_KINDS).map(([k, v]) => `<button class="chip ${ownDraft.kind === k ? 'on' : ''}" data-action="own-kind" data-v="${k}">${v}</button>`).join('')}</div>
      <label class="check-line"><input id="own-uni" type="checkbox" ${ownDraft.uni ? 'checked' : ''}> Eenzijdig (per set Linkerbeen en Rechterbeen)</label>
      <label class="label">Tip <span class="muted small">(optioneel)</span>
        <input id="own-tip" class="input" maxlength="300" placeholder="bv. stoel op stand 4, voeten hoog" autocomplete="off" value="${esc(ownDraft.tip || '')}">
      </label>
      <div class="sheet-actions"><button class="btn primary grow" data-action="own-save">Toevoegen</button></div>
      ${mine.length ? `<p class="label">Zelf toegevoegd (${mine.length})</p>
        <div class="list compact">${mine.map((e) => `
          <div class="own-item"><span class="grow"><strong>${esc(e.name)}</strong><br><span class="muted tiny">${esc(OWN_PROGRAMS[e.program])}${e.toestel ? ` · ${esc(e.toestel)}` : ''}${e.muscle ? ` · ${esc(e.muscle)}` : ''}</span></span>
          <button class="icon-btn" data-action="own-del" data-id="${esc(e.id)}" aria-label="Verwijder ${esc(e.name)}">🗑</button></div>`).join('')}</div>` : ''}
    </div>`);
}
function captureOwnDraft() {
  if (!ownDraft) return;
  ownDraft.name = $('#own-name')?.value ?? ownDraft.name;
  ownDraft.toestel = $('#own-toestel')?.value ?? ownDraft.toestel;
  ownDraft.muscle = $('#own-muscle')?.value ?? ownDraft.muscle;
  ownDraft.uni = $('#own-uni')?.checked ?? ownDraft.uni;
  ownDraft.tip = $('#own-tip')?.value ?? ownDraft.tip;
}
function saveOwnExercise() {
  captureOwnDraft();
  const name = (ownDraft.name || '').trim().replace(/\s+/g, ' ');
  if (!name) { toast('Geef de oefening een naam'); $('#own-name')?.focus(); return; }
  if (exercisesFor(ownDraft.program).some((e) => e.name.toLowerCase() === name.toLowerCase())) { toast('Die bestaat al — zoek hem op bij "Oefening toevoegen"'); return; }
  const ex = { id: `ex-${uid()}`, name, kind: ownDraft.kind, program: ownDraft.program, muscle: ownDraft.muscle };
  if (ownDraft.uni) ex.uni = 'been';
  if (ownDraft.program === 'gym' && ownDraft.toestel?.trim()) ex.toestel = ownDraft.toestel.trim();
  if (ownDraft.tip?.trim()) ex.tip = ownDraft.tip.trim();
  db.exercises.push(ex);
  saveNow();
  ownDraft = { program: ownDraft.program, kind: 'weights', uni: false };
  renderAddOwn();
  toast(`"${name}" toegevoegd ✓ — kies hem bij een workout of in je eigen schema`);
}

/* ---------- Feedback / vragen (via het deelmenu van de telefoon) ----------
   Geen server: het bericht gaat via WhatsApp/iMessage/mail naar wie de app onderhoudt.
   Er staat bewust géén telefoonnummer of e-mailadres in de (openbare) code. */
const FEEDBACK_TYPES = {
  apparaat: { label: '🏋️ Apparaat/oefening toevoegen', ask: 'Naam van het apparaat of de oefening' },
  vraag: { label: '❓ Vraag', ask: 'Over welke oefening/onderdeel?' },
  probleem: { label: '🐞 Iets werkt niet', ask: 'Waar ging het mis?' },
  idee: { label: '💡 Idee', ask: 'Onderwerp' },
};
let feedback = { type: 'apparaat', subject: '', text: '', photo: null, photoUrl: null };

function openFeedback({ type = 'apparaat', subject = '' } = {}) {
  if (feedback.photoUrl) URL.revokeObjectURL(feedback.photoUrl);
  feedback = { type: FEEDBACK_TYPES[type] ? type : 'apparaat', subject, text: '', photo: null, photoUrl: null };
  renderFeedbackSheet();
}

function renderFeedbackSheet() {
  const t = FEEDBACK_TYPES[feedback.type];
  openSheet(`
    <div class="sheet-inner feedback">
      ${sheetHead('💬 Feedback of vraag')}
      <p class="muted small">Je bericht gaat via WhatsApp, iMessage of mail naar wie de app bijhoudt.
      Een apparaat dat mist wordt dan toegevoegd.</p>
      <div class="chips">
        ${Object.entries(FEEDBACK_TYPES).map(([k, v]) => `<button class="chip ${k === feedback.type ? 'on' : ''}" data-action="fb-type" data-type="${k}" aria-pressed="${k === feedback.type}">${v.label}</button>`).join('')}
      </div>
      <label class="label">${t.ask}
        <input id="fb-subject" class="input" value="${esc(feedback.subject)}" maxlength="120" autocomplete="off"
          placeholder="${feedback.type === 'apparaat' ? 'bv. Glute drive, Hammer Strength hip thrust…' : ''}">
      </label>
      <label class="label">Bericht
        <textarea id="fb-text" class="input textarea" rows="4" maxlength="1000"
          placeholder="${feedback.type === 'apparaat' ? 'Waar staat het, wat doe je erop? (mag kort)' : 'Typ je vraag of opmerking…'}">${esc(feedback.text)}</textarea>
      </label>
      <p class="label">Foto <span class="muted small">(optioneel, bv. van het apparaat of het bordje)</span></p>
      ${feedback.photoUrl
        ? `<div class="fb-photo"><img src="${feedback.photoUrl}" alt="Gekozen foto"><button class="btn small ghost danger" data-action="fb-remove-photo">Foto weghalen</button></div>`
        : `<label class="btn block fb-photo-btn">📷 Foto maken of kiezen<input id="fb-photo" type="file" accept="image/*" hidden></label>`}
      <div class="sheet-actions">
        <button class="btn primary grow" data-action="fb-send">Versturen</button>
      </div>
      <div class="row fb-alt">
        <button class="btn small ghost" data-action="fb-whatsapp">WhatsApp</button>
        <button class="btn small ghost" data-action="fb-copy">Tekst kopiëren</button>
      </div>
    </div>`);
}

function feedbackMessage() {
  const p = personById(personId);
  const where = view === 'workout' && db.active ? `tijdens "${db.active.name}"` : `scherm: ${view}`;
  return [
    '💬 Workout-app feedback',
    `Soort: ${FEEDBACK_TYPES[feedback.type].label.replace(/^\S+\s/, '')}`,
    p ? `Van: ${p.name}` : null,
    feedback.subject.trim() ? `${feedback.type === 'apparaat' ? 'Apparaat/oefening' : 'Over'}: ${feedback.subject.trim()}` : null,
    feedback.text.trim() ? `Bericht: ${feedback.text.trim()}` : null,
    feedback.photo ? '📷 Foto bijgevoegd' : null,
    `(app ${APP_VERSION} · ${where} · ${new Date().toLocaleDateString('nl-NL')})`,
  ].filter(Boolean).join('\n');
}

async function sendFeedback(channel) {
  if (!feedback.subject.trim() && !feedback.text.trim()) { toast('Vul eerst iets in'); return; }
  const text = feedbackMessage();
  try {
    if (channel === 'share' && navigator.share) {
      const data = { title: 'Workout-app feedback', text };
      if (feedback.photo && navigator.canShare?.({ files: [feedback.photo] })) data.files = [feedback.photo];
      await navigator.share(data);
      closeSheet();
      toast(data.files || !feedback.photo ? 'Verstuurd 💗' : 'Verstuurd (stuur de foto er even los achteraan)');
      return;
    }
    if (channel === 'whatsapp' || (channel === 'share' && !navigator.share)) {
      // wa.me zonder nummer: WhatsApp vraagt zelf aan wie je het stuurt
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      if (feedback.photo) toast('Stuur de foto er in WhatsApp even los achteraan');
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Gekopieerd — plak het in een bericht');
  } catch (err) {
    if (err?.name === 'AbortError') return; // gebruiker sloot het deelmenu
    console.warn(err);
    try { await navigator.clipboard.writeText(text); toast('Gekopieerd — plak het in een bericht'); } catch (_) { toast('Versturen lukte niet'); }
  }
}

/* ---------- Oefening kiezen / wisselen ---------- */
function openExercisePicker() {
  openSheet(`
    <div class="sheet-inner">
      ${sheetHead('Oefening toevoegen')}
      <input id="ex-search" class="input" type="search" placeholder="Zoek of typ een nieuwe oefening" autocomplete="off" enterkeyhint="done">
      <div id="ex-results" class="pick-list"></div>
    </div>`);
  renderPickResults('');
}
function renderPickResults(q) {
  const program = db.active?.program ?? 'gym';
  const query = q.trim();
  const ql = query.toLowerCase();
  const pool = exercisesFor(program);
  const inWorkout = new Set(db.active?.exercises.map((e) => e.exerciseId));
  const list = pool.filter((e) => e.name.toLowerCase().includes(ql)).sort(byName);
  const exact = pool.some((e) => e.name.toLowerCase() === ql);
  $('#ex-results').innerHTML =
    (query && !exact ? `<button class="pick new" data-action="create-and-add">+ Nieuwe oefening “${esc(query)}”</button>` : '') +
    list.map((e) => `
      <button class="pick" data-action="pick-exercise" data-id="${esc(e.id)}">
        ${thumb(e.id, { animate: false })}
        <span class="grow"><span class="pick-name">${esc(e.name)}${inWorkout.has(e.id) ? ' <span class="muted small">(al toegevoegd)</span>' : ''}</span>
        ${e.muscle ? `<span class="muscle-pill">${esc(e.muscle)}</span>` : ''}</span>
      </button>`).join('');
}
function addExerciseToWorkout(exerciseId) {
  db.active.exercises.push(newEntry(exerciseId));
  saveNow();
  closeSheet();
  render();
  requestAnimationFrame(() => [...app.querySelectorAll('.exercise')].pop()?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}
/** Hoofdspiergroep ("familie") uit het spier-label, bv. "Biceps & onderarm" → "Biceps". */
const MUSCLE_FAMILIES = ['Achterkant schouders', 'Voorkant bovenbeen', 'Binnenkant bovenbeen', 'Heupbuigers',
  'Conditie', 'Trapezius', 'Onderrug', 'Herstel',
  'Biceps', 'Triceps', 'Schouders', 'Rug', 'Borst', 'Bil', 'Hamstrings', 'Buik', 'Kuiten', 'Core', 'Zij-buik'];
function muscleFamily(m) {
  if (!m) return null;
  const s = m.toLowerCase();
  return MUSCLE_FAMILIES.find((f) => s.startsWith(f.toLowerCase())) || null;
}

/**
 * Wisselopties voor een oefening in de lopende sessie:
 * - "best": vaste alternatieven (`alts`) van de oorspronkelijke en de huidige oefening;
 * - "more": alle andere oefeningen (zelfde programma) met dezelfde hoofdspiergroep.
 * Oefeningen die al in het schema staan worden NIET getoond (geen dubbele oefeningen).
 */
function swapOptions(entry) {
  const a = db.active;
  if (!a || !['gym', 'dumbbell', 'kettlebell'].includes(a.program)) return { best: [], more: [], all: [] };
  const cur = exById(entry.exerciseId);
  const inSession = new Set(a.exercises.map((e) => e.exerciseId));
  const ok = (id) => id !== entry.exerciseId && !inSession.has(id) && exById(id)?.program === a.program;
  const best = [...new Set([...(entry.alts || []), ...(cur?.alts || [])])].filter(ok);
  const fam = muscleFamily(cur?.muscle);
  const more = fam
    ? exercisesFor(a.program).filter((e) => muscleFamily(e.muscle) === fam && ok(e.id) && !best.includes(e.id))
      .sort((x, y) => (x.muscle === cur.muscle ? -1 : 0) - (y.muscle === cur.muscle ? -1 : 0) || byName(x, y)).map((e) => e.id)
    : [];
  return { best, more, all: [...best, ...more] };
}

function openSwap(entry) {
  const cur = exById(entry.exerciseId);
  const { best, more } = swapOptions(entry);
  const fam = muscleFamily(cur?.muscle);
  const opt = (id) => {
    const ex = exById(id);
    const same = ex?.muscle && ex.muscle === cur?.muscle;
    const sameFam = !same && fam && muscleFamily(ex?.muscle) === fam;
    return `
      <button class="pick swap-opt" data-action="swap-to" data-entry-id="${esc(entry.id)}" data-id="${esc(id)}">
        ${thumb(id, { animate: false })}
        <span class="grow">
          <span class="pick-name">${esc(ex?.name ?? id)}</span>
          ${ex?.muscle ? `<span class="muscle-pill">💪 ${esc(ex.muscle)}</span>` : ''}
          <span class="swap-tag ${same || sameFam ? 'same' : 'diff'}">${same ? '✓ zelfde spiergroep' : sameFam ? `✓ ook ${esc(fam.toLowerCase())}` : '↺ andere focus'}</span>
        </span>
      </button>`;
  };
  openSheet(`
    <div class="sheet-inner">
      ${sheetHead('Wissel oefening')}
      <div class="swap-now">
        <span class="small muted">Nu</span>
        <strong>${esc(cur?.name ?? entry.name)}</strong>
        ${cur?.muscle ? `<span class="muscle-pill">💪 ${esc(cur.muscle)}</span>` : ''}
      </div>
      <p class="muted small">Apparaat bezet? Kies een vervanger. Oefeningen die al in je schema staan zie je hier niet.
      Je ingevulde sets blijven staan.</p>
      ${best.length ? `<p class="label">Beste alternatieven</p><div class="pick-list">${best.map(opt).join('')}</div>` : ''}
      ${more.length ? `<p class="label">Meer voor ${esc((fam || '').toLowerCase())}</p><div class="pick-list">${more.map(opt).join('')}</div>` : ''}
      ${!best.length && !more.length ? '<p class="muted">Geen vrije alternatieven meer: alles voor deze spiergroep staat al in je schema.</p>' : ''}
    </div>`);
}

/** Bij wisselen tussen eenzijdig (L/R) en tweezijdig de set-structuur omzetten. */
function convertSets(entry, newUni) {
  if (!!entry.uni === !!newUni) return;
  if (newUni) {
    entry.sets = entry.sets.flatMap((s) => [{ ...s, side: 'L' }, emptySet('R')]);
  } else {
    entry.sets = entry.sets.filter((s) => s.side !== 'R').map(({ side, ...rest }) => rest);
  }
}

/* ---------- Schema-editor (Basic-Fit) ---------- */
function openTemplateEditor(id) {
  const t = id ? db.templates.find((x) => x.id === id) : null;
  editing = { id: t?.id ?? null, name: t?.name ?? '', note: t?.note ?? '', items: clone(t?.items ?? []), q: '' };
  const own = !t || isOwnTemplate(t);
  openSheet(`
    <div class="sheet-inner editor ${own ? 'own' : ''}">
      ${sheetHead(t ? (own ? '✨ Eigen schema bewerken' : 'Schema bewerken') : '✨ Eigen schema maken')}
      <label class="label">Naam
        <input id="tpl-name" class="input" value="${esc(editing.name)}" placeholder="Bijv. Billen & benen" autocomplete="off">
      </label>
      <p class="label">1. Jouw oefeningen <span class="muted small">— volgorde met ↑ ↓</span></p>
      <div id="tpl-items" class="list"></div>
      <p class="label">2. Oefening toevoegen</p>
      <input id="tpl-search" class="input" type="search" placeholder="Zoek op naam of spiergroep (bv. bil, triceps)…" autocomplete="off" enterkeyhint="done">
      <div id="tpl-pick" class="pick-list"></div>
      <div class="sheet-actions">
        ${t ? `<button class="btn ghost danger" data-action="tpl-delete">Verwijder</button>` : ''}
        <button class="btn primary grow" data-action="tpl-save">Opslaan</button>
      </div>
    </div>`);
  renderTplItems();
  renderTplPick();
}
function renderTplItems() {
  $('#tpl-items').innerHTML = editing.items.length ? editing.items.map((it, i) => `
    <div class="tpl-item" data-idx="${i}">
      <div class="tpl-item-head">
        <span class="badge on">${i + 1}</span>
        ${thumb(it.exerciseId, { animate: false })}
        <span class="grow"><strong class="pick-name">${esc(exName(it.exerciseId))}</strong>
          ${exById(it.exerciseId)?.muscle ? `<span class="muscle-pill">${esc(exById(it.exerciseId).muscle)}</span>` : ''}</span>
      </div>
      <div class="tpl-item-order">
        <button class="icon-btn" data-action="tpl-up" aria-label="Omhoog" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-action="tpl-down" aria-label="Omlaag" ${i === editing.items.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn danger-icon" data-action="tpl-remove" aria-label="Verwijder">🗑</button>
      </div>
      <div class="tpl-item-controls">
        <div class="stepper">
          <button class="tbtn" data-action="tpl-sets" data-delta="-1" aria-label="Minder sets">−</button>
          <span>${it.sets} sets</span>
          <button class="tbtn" data-action="tpl-sets" data-delta="1" aria-label="Meer sets">+</button>
        </div>
        <input class="input" data-tplfield="target" value="${esc(it.target)}" placeholder="reps, bv. 10-12" aria-label="Doel reps">
      </div>
    </div>`).join('') : '<p class="muted">Nog geen oefeningen. Voeg ze hieronder toe.</p>';
}
function renderTplPick() {
  const q = editing.q.trim();
  const ql = q.toLowerCase();
  const pool = exercisesFor('gym');
  const used = new Set(editing.items.map((i) => i.exerciseId));
  const list = pool.filter((e) => !used.has(e.id)
    && (e.name.toLowerCase().includes(ql) || (e.muscle || '').toLowerCase().includes(ql))).sort(byName);
  const exact = pool.some((e) => e.name.toLowerCase() === ql);
  $('#tpl-pick').innerHTML =
    (q && !exact ? `<button class="pick new" data-action="tpl-create">+ Nieuwe oefening “${esc(q)}”</button>` : '') +
    list.map((e) => `<button class="pick" data-action="tpl-add" data-id="${esc(e.id)}">${thumb(e.id, { animate: false })}
      <span class="grow"><span class="pick-name">${esc(e.name)}</span>${e.muscle ? `<span class="muscle-pill">${esc(e.muscle)}</span>` : ''}</span>
      <span class="badge add">+</span></button>`).join('');
}

/* ---------- Sessies starten / afronden ---------- */
async function confirmReplaceActive() {
  if (!db.active) return true;
  return confirmDialog(`Je hebt nog een training bezig (${db.active.name}). Die weggooien en een nieuwe starten?`, 'Nieuwe starten', true);
}

async function startSession({ program, name, templateId = null, items = [], restSec = null }) {
  if (!(await confirmReplaceActive())) return;
  db.active = {
    id: uid(), program, templateId, name,
    startedAt: new Date().toISOString(), finishedAt: null, hr: null,
    exercises: items.filter((i) => exById(i.exerciseId)).map((i) => newEntry(i.exerciseId, i)),
  };
  if (restSec) db.active.restSec = restSec;
  stopTimer();
  saveNow();
  go('workout');
}

const pilatesWork = () => db.settings.pilatesWork || 40;
const pilatesSwitch = () => db.settings.pilatesSwitch || 15;
const PREP_SEC = 10;
const SIDE_SEC = 5;

/**
 * Tijdlijn van de speler: klaarmaken → oefening 1 (set, rust, set…) → WISSEL → oefening 2 …
 * Eenzijdig: per set eerst links, korte kant-wissel, dan rechts.
 */
function buildPlayerSegs(level, exercises) {
  const segs = [{ type: 'prep', sec: PREP_SEC }];
  exercises.forEach((e, ei) => {
    if (ei > 0) segs.push({ type: 'switch', e: ei, sec: pilatesSwitch() });
    e.sets.forEach((set, si) => {
      if (si > 0) segs.push(set.side === 'R' ? { type: 'side', e: ei, s: si, sec: SIDE_SEC } : { type: 'rest', e: ei, s: si, sec: level.rest });
      segs.push({ type: 'work', e: ei, s: si, side: set.side || null, sec: e.kind === 'time' ? (e.targetSec || 30) : (level.workSec || pilatesWork()) });
    });
  });
  return segs;
}

/** Start een niveau (pilates met bord of op matje) als volledig-scherm speler die automatisch doorschakelt. */
const pilatesMinutes = () => db.settings.pilatesMinutes ?? null; // null = volledig niveau
const segsTotal = (segs) => segs.reduce((n, s) => n + s.sec, 0);

/**
 * Stel een schema samen dat op de gekozen tijd uitkomt.
 * Intensiteit (rust, oefeningvolgorde) komt van het niveau; bij langere tijd worden extra oefeningen
 * uit hetzelfde programma aangevuld. Daarna wordt de werktijd per set (20–75 s) bijgesteld zodat het
 * totaal (incl. klaarmaken, rust, kant- en houdingwissels) zo dicht mogelijk bij de doeltijd komt.
 */
function buildTimedLevel(programKey, levelId, minutes) {
  const prog = PLAYER_PROGRAMS[programKey];
  const base = prog.levels.find((l) => l.id === levelId);
  const T = Math.max(5, Math.min(90, minutes)) * 60;
  const itemOf = new Map(base.items.map((i) => [i.exerciseId, i]));
  const pool = [...base.items.map((i) => i.exerciseId), ...prog.exercises.map((e) => e.id).filter((id) => !itemOf.has(id))];
  const mkItem = (id, sets) => {
    const it = itemOf.get(id); const ex = exById(id);
    return ex.kind === 'time'
      ? { exerciseId: id, sets, sec: it?.sec ?? 30 }
      : { exerciseId: id, sets, reps: it?.reps ?? 10, perSide: !!(it?.perSide || ex.uni) };
  };
  const measure = (items, work) => segsTotal(buildPlayerSegs({ rest: base.rest, workSec: work }, items.map((i) => newEntry(i.exerciseId, i))));
  const baseWork = pilatesWork();
  let sets = minutes <= 12 ? 1 : minutes <= 22 ? 2 : 3;
  let chosen = [];
  for (;;) {
    chosen = [];
    for (const id of pool) {
      const cand = [...chosen, mkItem(id, sets)];
      if (measure(cand, baseWork) <= T) chosen = cand;
    }
    // alle oefeningen gebruikt en nog tijd over (lange training)? → een set erbij
    if (chosen.length === pool.length && sets < 5 && measure(chosen, 75) < T) { sets += 1; continue; }
    if (chosen.length >= 3 || sets === 1) break;
    sets -= 1;
  }
  if (!chosen.length) chosen = [mkItem(pool[0], 1)];
  // werktijd bijstellen zodat het precies uitkomt
  const entries = chosen.map((i) => newEntry(i.exerciseId, i));
  const repWorkSegs = buildPlayerSegs({ rest: base.rest, workSec: baseWork }, entries)
    .filter((s) => s.type === 'work' && entries[s.e].kind !== 'time').length;
  let work = baseWork;
  if (repWorkSegs) {
    // probeer werktijden 20–75 s (stappen van 5) en kies de waarde die het dichtst bij de doeltijd uitkomt
    let best = Infinity;
    for (let w = 20; w <= 75; w += 5) {
      const diff = Math.abs(measure(chosen, w) - T);
      if (diff < best) { best = diff; work = w; }
    }
  }
  return { ...base, id: `${base.id}-${minutes}m`, workSec: work, items: chosen, minutes };
}

async function startPilates(levelId, programKey = 'pilates') {
  const prog = PLAYER_PROGRAMS[programKey] || PLAYER_PROGRAMS.pilates;
  const minutes = pilatesMinutes();
  const l = minutes ? buildTimedLevel(programKey, levelId, minutes) : prog.levels.find((x) => x.id === levelId);
  if (!l || !(await confirmReplaceActive())) return;
  enterFullscreen(); // zo vroeg mogelijk: moet binnen de tik van de gebruiker
  const exercises = l.items.map((it) => {
    const uni = exById(it.exerciseId)?.uni;
    return newEntry(it.exerciseId, {
      sets: it.sets, sec: it.sec ?? null,
      target: it.sec ? `${it.sec} sec` : `${it.reps}${it.perSide && !uni ? ' per kant' : ''}`,
    });
  });
  const segs = buildPlayerSegs(l, exercises);
  const now = Date.now();
  db.active = {
    id: uid(), program: 'pilates', templateId: l.id, name: `${prog.short} · ${l.name}${l.minutes ? ` · ${l.minutes} min` : ''}`,
    startedAt: new Date(now).toISOString(), finishedAt: null, hr: null, restSec: l.rest, exercises,
    run: { segs, i: 0, segStart: now, endAt: now + PREP_SEC * 1000, paused: false, pausedLeft: null },
  };
  stopTimer();
  saveNow();
  cue(segs[0]);
  go('workout');
}

/** Een work-segment dat voorbij is telt als afgeronde set (voor "vorige keer" en geschiedenis). */
function completeSeg(a, seg) {
  if (a.program !== 'pilates' || seg?.type !== 'work') return;
  const entry = a.exercises[seg.e];
  const set = entry?.sets[seg.s];
  if (!set) return;
  set.done = true;
  if (entry.kind === 'time') set.sec = seg.sec;
  else set.reps = set.reps ?? firstNum(entry.target);
}

function enterFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch (_) { /* niet ondersteund (bv. iPhone-browser) — de speler vult dan gewoon het scherm */ }
}
function exitFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (_) { /* ignore */ }
}

function renderPlayer() {
  const a = db.active;
  const r = a.run;
  const finished = r.i >= r.segs.length;
  const seg = r.segs[r.i];
  const works = r.segs.filter((s) => s.type === 'work');
  const doneWork = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const pct = Math.round((Math.min(r.i, r.segs.length) / r.segs.length) * 100);
  const shown = finished ? null : seg.type === 'work' ? seg : r.segs.slice(r.i + 1).find((s) => s.type === 'work');
  const entry = shown ? a.exercises[shown.e] : null;
  const ex = entry ? exById(entry.exerciseId) : null;
  const PHASES = {
    work: 'Oefenen', rest: 'Rust — volgende set', side: '↔ Wissel van kant',
    switch: '🔄 Wissel van houding — volgende oefening', prep: 'Maak je klaar — eerst',
  };
  const phase = finished ? '' : PHASES[seg.type];
  const setNo = shown ? (entry.uni ? Math.floor(shown.s / 2) + 1 : shown.s + 1) : 0;
  const note = entry ? db.notes?.[entry.exerciseId] : '';
  return `
    <div class="player phase-${finished ? 'done' : seg.type} ${r.paused ? 'paused' : ''}" role="region" aria-label="Pilates-speler">
      <div class="player-top">
        <button class="icon-btn" data-action="run-stop" aria-label="Training stoppen">✕</button>
        <div class="grow center"><strong>${esc(a.name)}</strong><br><span class="small muted">${doneWork}/${works.length} sets klaar</span></div>
        <button class="icon-btn" data-action="player-fullscreen" aria-label="Volledig scherm">⛶</button>
      </div>
      <div class="player-progress"><div style="width:${pct}%"></div></div>
      ${finished ? `
        <div class="player-done">
          <p class="player-phase">Klaar! 🎉</p>
          <p class="player-name">Super gedaan</p>
          <p class="muted">${doneWork} sets in ${fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</p>
          <button class="btn primary block big" data-action="run-finish">Opslaan</button>
          <button class="btn ghost block" data-action="run-prev">⏮ Terug naar laatste oefening</button>
        </div>` : `
        <p class="player-phase">${phase}</p>
        <button class="player-fig" data-action="ex-info" data-id="${esc(entry.exerciseId)}" aria-label="Uitleg ${esc(entry.name)}">${thumb(entry.exerciseId)}</button>
        <p class="player-name">${esc(entry.name)}</p>
        ${shown.side ? `<p class="center"><span class="side-pill big side-${shown.side}">${shown.side === 'L' ? '⬅ ' : ''}${sideLabel(shown.side, entry.uni || 'kant')}${shown.side === 'R' ? ' ➡' : ''}</span></p>` : ''}
        <p class="player-meta">Set ${setNo}/${setsPerSide(entry)} · 🎯 ${esc(entry.target)}</p>
        ${ex?.muscle ? `<p class="center"><span class="muscle-pill">💪 ${esc(ex.muscle)}</span></p>` : ''}
        ${note ? `<p class="player-note">📝 ${esc(note)}</p>` : ''}
        <p class="player-time" id="run-time">–:–</p>
        <div class="run-progress"><div id="run-bar"></div></div>
        <p class="center small muted">${r.paused ? '⏸ Gepauzeerd' : seg.type === 'work' ? 'Schakelt vanzelf door' : ''}</p>
        <div class="player-controls">
          <button class="pbtn" data-action="run-prev" aria-label="Vorige">⏮</button>
          <button class="pbtn main" data-action="run-pause" aria-label="${r.paused ? 'Hervatten' : 'Pauzeren'}">${r.paused ? '▶' : '⏸'}</button>
          <button class="pbtn" data-action="run-skip" aria-label="Volgende">⏭</button>
        </div>
        ${ex?.steps ? `<details class="player-steps"><summary>Stap-voor-stap uitleg</summary><ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}`}
    </div>`;
}

async function finishWorkout() {
  flushSave();
  const a = db.active;
  const doneExercises = a.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length);
  if (!doneExercises.length) {
    if (await confirmDialog('Je hebt nog geen sets afgevinkt. Workout weggooien?', 'Weggooien', true)) endSession();
    return;
  }
  const open = a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  const msg = open
    ? `Workout afronden? ${plural(open, 'niet-afgevinkte set wordt', 'niet-afgevinkte sets worden')} niet opgeslagen.`
    : 'Workout afronden en opslaan?';
  const res = await hrDialog(msg, 'Afronden');
  if (!res) return;
  const { run, ...rest } = a;
  db.history.unshift({ ...rest, exercises: doneExercises, hr: res.hr, finishedAt: new Date().toISOString() });
  endSession();
  toast('Workout opgeslagen. Lekker bezig! 💪');
}

function endSession() {
  exitFullscreen();
  db.active = null;
  saveNow();
  stopTimer();
  go('home');
}

function toggleSet(entry, i) {
  const s = entry.sets[i];
  if (!s.done) {
    const ph = placeholderFor(entry, i);
    if (entry.kind === 'cardio') {
      if (s.min == null) s.min = ph.min;
      if (s.lvl == null) s.lvl = ph.lvl;
      if (s.min == null) { toast('Vul eerst het aantal minuten in'); return; }
    } else if (entry.kind === 'time') {
      if (s.sec == null) s.sec = ph.sec;
      if (s.sec == null) { toast('Vul eerst het aantal seconden in'); return; }
    } else {
      if (entry.kind === 'weights' && s.kg == null) s.kg = ph.kg;
      if (s.reps == null) s.reps = ph.reps;
      if (s.reps == null) {
        toast('Vul eerst het aantal reps in');
        app.querySelector(`[data-entry="${CSS.escape(entry.id)}"] [data-set="${i}"] [data-field="reps"]`)?.focus();
        return;
      }
    }
    s.done = true;
    if (db.active.program !== 'gym') startTimer(restFor(), 'Rust');
    navigator.vibrate?.(30);
  } else {
    s.done = false;
  }
  saveNow();
  render();
}

/* ---------- Hardlopen: begeleide training ---------- */
async function startRun(key) {
  const plan = runPlanFor(key);
  if (!plan || !(await confirmReplaceActive())) return;
  const segs = expandSegments(plan);
  const now = Date.now();
  db.active = {
    id: uid(), program: 'run', runKey: key, templateId: null, name: runTitle(key),
    startedAt: new Date(now).toISOString(), finishedAt: null, hr: null, exercises: [],
    run: { segs, i: 0, segStart: now, endAt: now + segs[0].sec * 1000, paused: false, pausedLeft: null },
  };
  stopTimer();
  saveNow();
  closeSheet();
  cue(segs[0]);
  go('workout');
}

function setSegment(r, i, start) {
  r.i = i;
  r.segStart = start;
  r.paused = false;
  r.pausedLeft = null;
  const seg = r.segs[i];
  r.endAt = seg && seg.sec != null ? start + seg.sec * 1000 : null;
}

/** Getimede sessies (hardlopen én pilates-speler) delen deze motor. Haalt gemiste segmenten in. */
function tickRun() {
  const a = db.active;
  if (!a || !a.run) return;
  const r = a.run;
  if (r.paused || r.i >= r.segs.length) return;
  let changed = false;
  while (r.endAt && Date.now() >= r.endAt) {
    completeSeg(a, r.segs[r.i]);
    setSegment(r, r.i + 1, r.endAt);
    changed = true;
  }
  if (changed) afterSegmentChange();
}

function afterSegmentChange() {
  const r = db.active.run;
  saveNow();
  cue(r.segs[r.i]);
  if (view === 'workout') render();
  if (r.i >= r.segs.length) finishRun();
}

function cueText(seg) {
  const a = db.active;
  if (!seg) return 'Klaar! Goed gedaan!';
  if (a?.program === 'pilates') {
    const nextWork = seg.type === 'work' ? seg : a.run.segs.slice(a.run.i + 1).find((s) => s.type === 'work');
    const e = nextWork ? a.exercises[nextWork.e] : null;
    const sideTxt = nextWork?.side ? ` ${sideLabel(nextWork.side, e?.uni || 'kant')}.` : '';
    if (seg.type === 'work') return `${e.name}.${sideTxt}`;
    if (seg.type === 'rest') return 'Rust. Volgende set komt eraan.';
    if (seg.type === 'side') return `Wissel van kant.${sideTxt}`;
    if (seg.type === 'switch') return `Wissel van houding. Hierna: ${e?.name ?? ''}.`;
    return `Maak je klaar. Eerste oefening: ${e?.name ?? ''}.`;
  }
  return seg.type === 'run' ? 'Hardlopen!' : seg.type === 'walk' ? 'Wandelen' : seg.type === 'cooldown' ? 'Cooling-down. Rustig uitwandelen.' : 'Warming-up. Rustig wandelen.';
}

function cue(seg) {
  alarm();
  const text = cueText(seg);
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'nl-NL';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  } catch (_) { /* geen spraak */ }
}

/** Afronden van een getimede sessie (hardlopen of pilates-speler). */
async function finishRun() {
  if (confirmEl.open || !db.active?.run) return;
  const a = db.active;
  if (a.program === 'pilates') {
    const done = a.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length);
    if (!done.length) {
      if (await confirmDialog('Er is nog geen set afgerond. Training weggooien?', 'Weggooien', true)) endSession();
      return;
    }
    const res = await hrDialog(`${a.name} opslaan? (${plural(done.reduce((n, e) => n + e.sets.length, 0), 'set', 'sets')}) 🎉`, 'Opslaan');
    if (!res || !db.active) return;
    const { run, ...rest } = a;
    db.history.unshift({ ...rest, exercises: done, hr: res.hr, finishedAt: new Date().toISOString() });
    endSession();
    toast('Pilates opgeslagen. Lekker bezig! 🧘‍♀️💗');
    return;
  }
  const res = await hrDialog(`${a.name} opslaan als gedaan? 🎉`, 'Opslaan');
  if (!res || !db.active) return;
  const { run, ...rest } = a;
  db.history.unshift({ ...rest, hr: res.hr, finishedAt: new Date().toISOString() });
  endSession();
  toast('Training afgevinkt! 🏃‍♀️💗');
}

function openRunDetail(key) {
  const plan = runPlanFor(key);
  const done = db.history.filter((s) => s.program === 'run' && s.runKey === key);
  openSheet(`
    <div class="sheet-inner">
      ${sheetHead(runTitle(key))}
      <p class="lead">${esc(plan.desc)}</p>
      <p class="muted small">5 min warming-up wandelen · training · 5 min cooling-down — ${esc(plan.total)}</p>
      ${segStrip(expandSegments(plan))}
      ${done.length ? `
        <div class="done-box">✓ Gedaan op ${done.map((d) => `${esc(fmtDate(d.startedAt))}${d.hr ? ` (${hrText(d.hr)})` : ''}`).join(', ')}</div>` : ''}
      <button class="btn primary block" data-action="run-start" data-key="${key}">▶ Start begeleide training</button>
      <p class="label">Of zonder timer afvinken</p>
      <div class="row">
        <input id="run-date" class="input" type="date" value="${dateKey()}" max="${dateKey()}" aria-label="Datum">
        <button class="btn" data-action="run-mark" data-key="${key}">✓ Afvinken</button>
      </div>
      ${done.length ? `<button class="btn ghost danger block" data-action="run-unmark" data-key="${key}">Vinkje weghalen</button>` : ''}
    </div>`);
}

async function markRunDone(key) {
  const dateVal = $('#run-date')?.value || dateKey();
  const now = new Date();
  const [y, m, d] = dateVal.split('-').map(Number);
  const when = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
  closeSheet();
  const res = await hrDialog(`${runTitle(key)} afvinken?`, 'Afvinken');
  if (!res) return;
  db.history.push({
    id: uid(), program: 'run', runKey: key, templateId: null, name: runTitle(key),
    startedAt: when.toISOString(), finishedAt: when.toISOString(), hr: res.hr, exercises: [],
  });
  db.history.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  saveNow();
  render();
  toast('Afgevinkt ✓');
}

/* ---------- Herinneringen ---------- */
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function buildIcs() {
  const r = db.run.reminder;
  const days = [...r.days].sort();
  if (!days.length) return null;
  const [hh, mm] = r.time.split(':').map(Number);
  const now = new Date();
  let first = null;
  for (let d = 0; d < 8 && !first; d++) {
    const c = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hh, mm);
    if (days.includes(dayIdx(c)) && c > now) first = c;
  }
  const p2 = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const byday = days.map((d) => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][d]).join(',');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Workout Tracker//NL', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:run-reminder-${uid()}@workout-tracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(first)}`,
    'DURATION:PT45M',
    `RRULE:FREQ=WEEKLY;BYDAY=${byday};COUNT=30`,
    'SUMMARY:🏃‍♀️ Hardlopen (schema)',
    'DESCRIPTION:Tijd voor je hardlooptraining! Open de Workout-app voor de begeleide training.',
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Over 30 minuten hardlopen 🏃‍♀️', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

async function toggleNotifications() {
  const r = db.run.reminder;
  if (r.notify) { r.notify = false; saveNow(); render(); toast('Meldingen uit'); return; }
  if (!('Notification' in window)) { toast('Meldingen worden in deze browser niet ondersteund — gebruik de agenda'); return; }
  const perm = await Notification.requestPermission();
  r.notify = perm === 'granted';
  saveNow();
  render();
  toast(r.notify ? 'Meldingen aan 🔔' : 'Geen toestemming voor meldingen');
}

async function showNotification(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'run-reminder' });
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch (err) { console.warn(err); }
}

let lastReminderCheck = 0;
function checkRunReminder() {
  if (Date.now() - lastReminderCheck < 30000) return;
  lastReminderCheck = Date.now();
  const r = db.run.reminder;
  if (!r.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (r.lastNotified === dateKey() || !nextRunKey() || ranToday() || runsThisWeek() >= RUN_GOAL || !isPlannedToday()) return;
  const [hh, mm] = r.time.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm - 30) return;
  r.lastNotified = dateKey();
  saveNow();
  showNotification('Tijd om te hardlopen 🏃‍♀️', `${runTitle(nextRunKey())} staat klaar. (${runsThisWeek()}/${RUN_GOAL} deze week)`);
}

/* ---------- Backup ---------- */
function exportBackup() {
  flushSave();
  db.lastBackupAt = new Date().toISOString();
  saveNow();
  const payload = { app: 'workout-tracker', person: personId, exportedAt: db.lastBackupAt, ...db };
  downloadFile(`workout-backup-${personId}-${db.lastBackupAt.slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  render();
  toast('Backup opgeslagen ✓');
}

const importInput = $('#import-file');
importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  importInput.value = '';
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const next = normalizeDb(raw);
    const me = personById(personId);
    const from = personById(raw.person);
    const warn = from && from.id !== personId ? ` ⚠️ Let op: deze backup is van ${from.name}!` : '';
    const ok = await confirmDialog(
      `Backup laden in het profiel van ${me.name} met ${plural(next.history.length, 'training', 'trainingen')}? De huidige gegevens van ${me.name} worden vervangen.${warn}`,
      'Importeren', true);
    if (!ok) return;
    try { localStorage.setItem(`${dataKey(personId)}:before-import`, JSON.stringify(db)); } catch (_) { /* vol */ }
    db = next;
    saveNow();
    go(db.active ? 'workout' : 'home');
    toast('Backup geïmporteerd ✓');
  } catch (err) {
    console.error(err);
    toast(`Importeren mislukt: ${err.message}`);
  }
});

/* ---------- Rusttimer (onderbalk) ---------- */
let timer = loadTimer(); // { endAt, duration, label }
let finishedFlashTimer;
const restFor = () => db.active?.restSec ?? db.settings.restSeconds;

function loadTimer() {
  try {
    const t = JSON.parse(localStorage.getItem(TIMER_KEY));
    if (t && typeof t.endAt === 'number' && t.endAt > Date.now()) return t;
  } catch (_) { /* ignore */ }
  return { endAt: null, duration: 0, label: 'Rust' };
}
function persistTimer() {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (_) { /* ignore */ }
}
function startTimer(sec, label = 'Rust') {
  timer = { endAt: Date.now() + sec * 1000, duration: sec, label };
  timerEl.classList.remove('finished');
  persistTimer();
  updateTimerUI();
}
function stopTimer() {
  timer = { endAt: null, duration: 0, label: 'Rust' };
  persistTimer();
  updateTimerUI();
}
function adjustTimer(delta) {
  if (timer.endAt) {
    timer.endAt += delta * 1000;
    timer.duration = Math.max(1, timer.duration + delta);
    if (timer.endAt <= Date.now()) stopTimer();
    else persistTimer();
  } else {
    const next = Math.min(600, Math.max(15, restFor() + delta));
    db.settings.restSeconds = next;
    if (db.active?.restSec) db.active.restSec = next;
    saveSoon();
  }
  updateTimerUI();
}
function timerFinished() {
  const wasWork = timer.label !== 'Rust';
  timer = { endAt: null, duration: 0, label: 'Rust' };
  persistTimer();
  alarm();
  timerEl.classList.remove('finished');
  void timerEl.offsetWidth;
  timerEl.classList.add('finished');
  clearTimeout(finishedFlashTimer);
  finishedFlashTimer = setTimeout(() => timerEl.classList.remove('finished'), 4200);
  updateTimerUI(wasWork ? 'Tijd! Vink je set af ✓' : 'Volgende set 💪');
}
function updateTimerUI(finishedMsg = null) {
  const running = !!timer.endAt;
  const remaining = running ? Math.max(0, (timer.endAt - Date.now()) / 1000) : restFor();
  $('#timer-time').textContent = finishedMsg ? 'Klaar!' : fmtClock(Math.ceil(remaining - 0.001));
  $('#timer-label').textContent = running ? `${timer.label} · tik om te stoppen` : finishedMsg || 'Rust · tik om te starten';
  $('#timer-bar').style.width = running ? `${Math.min(100, (1 - remaining / timer.duration) * 100)}%` : '0%';
  timerEl.classList.toggle('running', running);
  timerEl.classList.toggle('work', running && timer.label !== 'Rust');
  for (const b of timerEl.querySelectorAll('.preset')) {
    b.classList.toggle('active', Number(b.dataset.seconds) === restFor());
  }
}

/* Geluid: AudioContext moet door een tik "ontgrendeld" worden (autoplay-regels). */
let audioCtx = null;
function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('pointerdown', unlockAudio, { passive: true });

/** Kort tikje voor het aftellen (3-2-1). */
let lastCountKey = '';
function tick() {
  navigator.vibrate?.(35);
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + 0.01;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}

function alarm() {
  navigator.vibrate?.([250, 120, 250, 120, 450]);
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + 0.02;
  [0, 0.28, 0.56].forEach((off, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, t0 + off);
    gain.gain.exponentialRampToValueAtTime(0.5, t0 + off + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + off + (i === 2 ? 0.45 : 0.2));
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + off);
    osc.stop(t0 + off + 0.5);
  });
}

setInterval(() => {
  if (timer.endAt && Date.now() >= timer.endAt) timerFinished();
  else if (timer.endAt) updateTimerUI();
  tickRun();
  updateLive();
  checkRunReminder();
}, 250);

/* ---------- Screen wake lock ---------- */
let wakeLock = null;
async function updateWakeLock() {
  try {
    const want = !!db.active && document.visibilityState === 'visible';
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (_) { /* niet ondersteund */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
  updateWakeLock();
  if (document.visibilityState === 'visible') { updateTimerUI(); tickRun(); updateLive(); }
});

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  handleAction(btn.dataset.action, btn);
});

async function handleAction(action, btn) {
  const entryEl = btn.closest('[data-entry]');
  const entry = entryEl ? db.active?.exercises.find((x) => x.id === entryEl.dataset.entry) : null;
  const setIdx = btn.closest('[data-set]') ? Number(btn.closest('[data-set]').dataset.set) : -1;
  const itemIdx = btn.closest('[data-idx]') ? Number(btn.closest('[data-idx]').dataset.idx) : -1;

  switch (action) {
    /* Navigatie */
    case 'go': go(btn.dataset.view); break;
    case 'resume': go('workout'); break;
    case 'more-history': historyLimit += 10; render(); break;

    /* Starten */
    case 'start-pilates': startPilates(btn.dataset.id, btn.dataset.program); break;
    case 'start-home': {
      const t = HOME_TEMPLATES[btn.dataset.kind]?.find((x) => x.id === btn.dataset.id);
      const tool = btn.dataset.kind === 'dumbbell' ? 'Dumbbell' : 'Kettlebell';
      if (t) startSession({ program: btn.dataset.kind, name: `${tool} · ${t.name}`, templateId: t.id, items: t.items });
      break;
    }
    case 'start-home-empty': startSession({ program: btn.dataset.kind, name: PROGRAMS[btn.dataset.kind].label }); break;
    case 'start-gym': {
      const t = db.templates.find((x) => x.id === btn.dataset.id);
      if (t) startSession({ program: 'gym', name: t.name, templateId: t.id, items: t.items });
      break;
    }
    case 'start-empty': startSession({ program: 'gym', name: 'Workout' }); break;
    case 'restore-templates':
      for (const g of GYM_TEMPLATES) if (!db.templates.find((t) => t.id === g.id)) db.templates.push(clone(g));
      saveNow(); render(); toast('Standaardschema\'s teruggezet');
      break;

    /* Sessie */
    case 'finish': finishWorkout(); break;
    case 'discard':
      if (await confirmDialog('Deze workout annuleren? Niets van deze sessie wordt opgeslagen.', 'Annuleer workout', true)) endSession();
      break;
    case 'add-exercise': openExercisePicker(); break;
    case 'pick-exercise': addExerciseToWorkout(btn.dataset.id); break;
    case 'create-and-add': {
      const ex = findOrCreateExercise($('#ex-search').value, db.active.program);
      if (ex) addExerciseToWorkout(ex.id);
      break;
    }
    case 'remove-exercise':
      if (!entry) break;
      if (entry.sets.some((s) => s.done) &&
        !(await confirmDialog(`${entry.name} verwijderen uit deze workout?`, 'Verwijderen', true))) break;
      db.active.exercises = db.active.exercises.filter((x) => x !== entry);
      saveNow(); render();
      break;
    case 'add-set':
      if (!entry) break;
      if (entry.uni) entry.sets.push(emptySet('L'), emptySet('R'));
      else entry.sets.push(emptySet());
      saveNow(); render();
      break;
    case 'remove-set':
      if (!entry || setsPerSide(entry) <= 1) break;
      entry.sets.splice(entry.uni ? -2 : -1);
      saveNow(); render();
      break;
    case 'toggle-set': if (entry && setIdx >= 0) toggleSet(entry, setIdx); break;
    case 'work-timer': {
      if (!entry || setIdx < 0) break;
      const sec = entry.sets[setIdx].sec ?? placeholderFor(entry, setIdx).sec;
      if (sec) startTimer(sec, entry.name); else toast('Vul eerst het aantal seconden in');
      break;
    }
    case 'swap': if (entry) openSwap(entry); break;
    case 'swap-to': {
      const target = db.active?.exercises.find((x) => x.id === btn.dataset.entryId);
      const ex = exById(btn.dataset.id);
      if (target && ex) {
        convertSets(target, ex.uni);
        target.exerciseId = ex.id; target.name = ex.name; target.kind = ex.kind || 'weights'; target.uni = ex.uni || null;
        saveNow();
      }
      closeSheet(); render();
      if (ex) toast(`Gewisseld${ex.muscle ? ` · traint nu: ${ex.muscle}` : ''}`);
      break;
    }
    case 'ex-info': openExerciseInfo(btn.dataset.id); break;

    /* Rusttimer */
    case 'timer-start': {
      const sec = Number(btn.dataset.seconds);
      db.settings.restSeconds = sec;
      if (db.active?.restSec) db.active.restSec = sec;
      saveSoon();
      startTimer(sec, 'Rust');
      break;
    }
    case 'timer-adjust': adjustTimer(Number(btn.dataset.delta)); break;
    case 'timer-toggle': if (timer.endAt) stopTimer(); else startTimer(restFor(), 'Rust'); break;

    /* Hardlopen */
    case 'run-detail': openRunDetail(btn.dataset.key); break;
    case 'run-start': startRun(btn.dataset.key); break;
    case 'run-mark': markRunDone(btn.dataset.key); break;
    case 'run-unmark':
      if (!(await confirmDialog(`Vinkje bij ${runTitle(btn.dataset.key)} weghalen?`, 'Weghalen', true))) break;
      db.history = db.history.filter((s) => !(s.program === 'run' && s.runKey === btn.dataset.key));
      saveNow(); closeSheet(); render();
      break;
    case 'run-pause': {
      const r = db.active.run;
      if (r.paused) { r.endAt = Date.now() + r.pausedLeft; r.paused = false; r.pausedLeft = null; }
      else { r.pausedLeft = r.endAt - Date.now(); r.endAt = null; r.paused = true; }
      saveNow(); render();
      break;
    }
    case 'run-skip': {
      const r = db.active.run;
      if (r.i >= r.segs.length) break;
      completeSeg(db.active, r.segs[r.i]); // handmatig vooruit = set gedaan
      setSegment(r, r.i + 1, Date.now());
      afterSegmentChange();
      break;
    }
    case 'run-prev': {
      const r = db.active.run;
      if (r.i <= 0) break;
      setSegment(r, Math.min(r.i, r.segs.length) - 1, Date.now());
      afterSegmentChange();
      break;
    }
    case 'run-finish': finishRun(); break;
    case 'player-fullscreen':
      if (document.fullscreenElement) exitFullscreen(); else enterFullscreen();
      if (!document.documentElement.requestFullscreen) toast('Tip: zet de app op je beginscherm voor volledig scherm');
      break;
    case 'pilates-work':
      db.settings.pilatesWork = Number(btn.dataset.sec);
      saveNow(); render();
      break;
    case 'pilates-switch':
      db.settings.pilatesSwitch = Number(btn.dataset.sec);
      saveNow(); render();
      break;
    case 'pilates-minutes':
      db.settings.pilatesMinutes = btn.dataset.min === 'full' ? null : Number(btn.dataset.min);
      saveNow(); render();
      break;

    /* Zelf toevoegen */
    case 'add-own': openAddOwn(); break;
    case 'own-prog': captureOwnDraft(); ownDraft.program = btn.dataset.v; renderAddOwn(); break;
    case 'own-kind': captureOwnDraft(); ownDraft.kind = btn.dataset.v; renderAddOwn(); break;
    case 'own-save': saveOwnExercise(); break;
    case 'own-del': {
      const ex = db.exercises.find((e) => e.id === btn.dataset.id);
      if (!ex || !(await confirmDialog(`"${ex.name}" verwijderen? Al gedane trainingen blijven bewaard.`, 'Verwijderen', true))) break;
      captureOwnDraft();
      db.exercises = db.exercises.filter((e) => e !== ex);
      for (const t of db.templates) t.items = t.items.filter((i) => i.exerciseId !== ex.id);
      saveNow(); renderAddOwn();
      break;
    }

    /* Voortgang */
    case 'progress-tab': progressTab = btn.dataset.tab; render(); break;
    case 'progress-ex': progressTab = 'ex'; progressEx = btn.dataset.id; closeSheet(); go('progress'); break;
    case 'progress-metric': progressMetric = btn.dataset.metric; render(); break;
    case 'weight-save': saveWeight(); break;
    case 'weight-del':
      bodyData().weights = bodyData().weights.filter((w) => w.date !== btn.dataset.date);
      saveNow(); render();
      break;
    case 'measure-save': saveMeasures(); break;
    case 'measure-chart': measureChartKey = btn.dataset.key; render(); break;
    case 'measure-del':
      if (!(await confirmDialog('Deze meting verwijderen?', 'Verwijderen', true))) break;
      bodyData().measures = bodyData().measures.filter((m) => m.date !== btn.dataset.date);
      saveNow(); render();
      break;
    case 'reset-person': {
      const me = personById(personId);
      const choice = await choiceDialog(`Alle gegevens van ${me.name} wissen? Dit kan niet ongedaan worden (behalve met een backup).`, [
        { value: 'cancel', label: 'Annuleer' },
        { value: 'backup', label: 'Eerst backup, dan resetten', cls: 'primary' },
        { value: 'reset', label: 'Alleen resetten', cls: 'danger-fill' },
      ]);
      if (choice !== 'backup' && choice !== 'reset') break;
      if (choice === 'backup') exportBackup();
      try { localStorage.setItem(`${dataKey(personId)}:before-reset`, JSON.stringify(db)); } catch (_) { /* vol */ }
      stopTimer();
      db = defaultDb();
      saveNow();
      go('home');
      toast(`${me.name} begint opnieuw ✨`);
      break;
    }
    case 'pick-person': selectPerson(btn.dataset.person); break;
    case 'legacy-assign': {
      const p = personById(btn.dataset.person);
      if (!p || !(await confirmDialog(`De bestaande trainingen toewijzen aan ${p.name}?`, `Ja, van ${p.name}`))) break;
      if (assignLegacy(p.id)) { selectPerson(p.id, { quiet: true }); toast(`Gegevens staan nu bij ${p.name} ✓`); }
      break;
    }
    case 'run-stop': {
      const isPilates = db.active.program === 'pilates';
      const choice = await choiceDialog('Training stoppen?', [
        { value: 'cancel', label: 'Doorgaan' },
        { value: 'discard', label: 'Weggooien', cls: 'ghost danger' },
        { value: 'save', label: isPilates ? 'Opslaan wat klaar is' : 'Opslaan als gedaan', cls: 'primary' },
      ]);
      if (choice === 'discard') endSession();
      if (choice === 'save') { db.active.run.i = db.active.run.segs.length; db.active.run.endAt = null; saveNow(); render(); finishRun(); }
      break;
    }
    case 'rem-day': {
      const d = Number(btn.dataset.day);
      const days = db.run.reminder.days;
      db.run.reminder.days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
      saveNow(); render();
      if (db.run.reminder.days.length !== RUN_GOAL) toast(`${db.run.reminder.days.length} dagen gekozen (advies: 3)`);
      break;
    }
    case 'rem-ics': {
      const ics = buildIcs();
      if (!ics) { toast('Kies eerst je loopdagen'); break; }
      downloadFile('hardloop-herinnering.ics', ics, 'text/calendar');
      toast('Open het bestand om het in je agenda te zetten 📅');
      break;
    }
    case 'rem-notify': toggleNotifications(); break;

    /* Hartslag */
    case 'hr-edit': {
      const s = db.history.find((x) => x.id === btn.dataset.id);
      if (!s) break;
      const res = await hrDialog(`Hartslag voor ${s.name} (${fmtDate(s.startedAt)})`, 'Opslaan', s.hr);
      if (!res) break;
      s.hr = res.hr;
      saveNow(); render();
      break;
    }

    /* Schema-editor */
    case 'new-template': openTemplateEditor(null); break;
    case 'edit-template': openTemplateEditor(btn.dataset.id); break;
    case 'tpl-add':
      editing.items.push({ exerciseId: btn.dataset.id, sets: DEFAULT_SETS, target: '10-12' });
      renderTplItems(); renderTplPick();
      toast(`${exName(btn.dataset.id)} toegevoegd`);
      break;
    case 'tpl-create': {
      const ex = findOrCreateExercise(editing.q, 'gym');
      if (!ex) break;
      editing.items.push({ exerciseId: ex.id, sets: DEFAULT_SETS, target: '10-12' });
      editing.q = ''; $('#tpl-search').value = '';
      saveNow(); renderTplItems(); renderTplPick();
      break;
    }
    case 'tpl-sets': {
      const it = editing.items[itemIdx];
      it.sets = Math.min(10, Math.max(1, it.sets + Number(btn.dataset.delta)));
      renderTplItems();
      break;
    }
    case 'tpl-up':
      if (itemIdx > 0) [editing.items[itemIdx - 1], editing.items[itemIdx]] = [editing.items[itemIdx], editing.items[itemIdx - 1]];
      renderTplItems();
      break;
    case 'tpl-down':
      if (itemIdx >= 0 && itemIdx < editing.items.length - 1) [editing.items[itemIdx + 1], editing.items[itemIdx]] = [editing.items[itemIdx], editing.items[itemIdx + 1]];
      renderTplItems();
      break;
    case 'tpl-remove': editing.items.splice(itemIdx, 1); renderTplItems(); renderTplPick(); break;
    case 'tpl-save': {
      const name = $('#tpl-name').value.trim();
      if (!name) { toast('Geef het schema een naam'); $('#tpl-name').focus(); break; }
      if (!editing.items.length) { toast('Voeg minstens één oefening toe'); break; }
      const data = { name, items: clone(editing.items) };
      if (editing.id) Object.assign(db.templates.find((t) => t.id === editing.id), data);
      else db.templates.push({ id: `tpl-${uid()}`, program: 'gym', note: '', ...data });
      saveNow(); closeSheet(); render();
      toast('Schema opgeslagen ✓');
      break;
    }
    case 'tpl-delete': {
      const t = db.templates.find((x) => x.id === editing.id);
      if (!t || !(await confirmDialog(`Schema "${t.name}" verwijderen? Je geschiedenis blijft bewaard.`, 'Verwijderen', true))) break;
      db.templates = db.templates.filter((x) => x !== t);
      saveNow(); closeSheet(); render();
      break;
    }
    case 'close-sheet': closeSheet(); break;

    case 'check-update': checkForUpdate({ manual: true }); break;

    /* Feedback */
    case 'feedback': openFeedback({ type: btn.dataset.type, subject: btn.dataset.subject || '' }); break;
    case 'fb-type': feedback.type = btn.dataset.type; renderFeedbackSheet(); break;
    case 'fb-remove-photo':
      if (feedback.photoUrl) URL.revokeObjectURL(feedback.photoUrl);
      feedback.photo = null; feedback.photoUrl = null; renderFeedbackSheet();
      break;
    case 'fb-send': sendFeedback('share'); break;
    case 'fb-whatsapp': sendFeedback('whatsapp'); break;
    case 'fb-copy': sendFeedback('copy'); break;

    /* Geschiedenis & backup */
    case 'delete-session':
      if (!(await confirmDialog('Deze training uit je geschiedenis verwijderen?', 'Verwijderen', true))) break;
      db.history = db.history.filter((s) => s.id !== btn.dataset.id);
      saveNow(); render();
      break;
    case 'export': exportBackup(); break;
    case 'import': importInput.click(); break;
  }
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'ex-search') { renderPickResults(el.value); return; }
  if (el.id === 'fb-subject') { feedback.subject = el.value; return; }
  if (el.id === 'fb-text') { feedback.text = el.value; return; }
  if (el.id === 'tpl-name') { editing.name = el.value; return; }
  if (el.id === 'tpl-search') { editing.q = el.value; renderTplPick(); return; }
  if (el.dataset.tplfield) {
    const idx = Number(el.closest('[data-idx]')?.dataset.idx);
    if (editing.items[idx]) editing.items[idx][el.dataset.tplfield] = el.value;
    return;
  }
  if (el.dataset.note) { // vaste notitie per oefening, per profiel
    const v = el.value.slice(0, 300);
    if (!db.notes) db.notes = {};
    if (v.trim()) db.notes[el.dataset.note] = v; else delete db.notes[el.dataset.note];
    saveSoon();
    return;
  }
  if (el.dataset.profile) {
    const n = parseNum(el.value);
    db.profile[el.dataset.profile] = n ? Math.round(n) : null;
    saveSoon();
    return;
  }
  const field = el.dataset.field;
  if (!field || !db.active) return;
  const entryEl = el.closest('[data-entry]');
  const entry = db.active.exercises.find((x) => x.id === entryEl?.dataset.entry);
  const i = Number(el.closest('[data-set]')?.dataset.set);
  if (!entry || !entry.sets[i]) return;
  const n = parseNum(el.value);
  // kg en niveau mogen decimalen hebben; reps, seconden en minuten worden hele getallen
  entry.sets[i][field] = ['reps', 'sec', 'min'].includes(field) && n != null ? Math.round(n) : n;
  saveSoon();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'pilates-custom-min') {
    const mn = Math.round(Number(el.value));
    if (mn >= 5 && mn <= 90) { db.settings.pilatesMinutes = mn; saveNow(); render(); } else if (el.value) toast('Kies tussen 5 en 90 minuten');
    return;
  }
  if (el.id === 'progress-ex') { progressEx = el.value; render(); return; }
  if (el.id === 'fb-photo' && el.files?.[0]) {
    feedback.photo = el.files[0];
    feedback.photoUrl = URL.createObjectURL(el.files[0]);
    renderFeedbackSheet();
    return;
  }
  if (el.id === 'rem-time' && /^\d{2}:\d{2}$/.test(el.value)) {
    db.run.reminder.time = el.value;
    db.run.reminder.lastNotified = null;
    saveNow(); render();
  }
  if (el.dataset.profile) { flushSave(); render(); } // zones herberekenen na verlaten veld
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'tpl-search') { e.preventDefault(); $('#tpl-pick .pick')?.click(); }
  if (id === 'ex-search') { e.preventDefault(); $('#ex-results .pick')?.click(); }
  if (e.target.dataset?.field || e.target.dataset?.profile || e.target.dataset?.note) e.target.blur();
});

/* ---------- Init ---------- */
// Beginpagina = profielkeuze. Uitzondering: loopt er nog een training van de laatste persoon,
// dan gaan we daar direct naartoe (anders zou een lopende timer "verdwijnen" achter de keuze).
(() => {
  const last = localStorage.getItem(PERSON_KEY);
  if (last && personById(last) && personSummary(last).active) {
    selectPerson(last, { quiet: true });
    tickRun();
  } else {
    render();
  }
})();

/* ---------- Updates ----------
   - sw.js zonder HTTP-cache controleren (updateViaCache: 'none');
   - bij terugkeren naar de app (iPhone-apps op het beginscherm herstarten vaak niet) opnieuw controleren;
   - neemt een nieuwe service worker het over, dan laden we één keer opnieuw — maar niet midden in een
     training (dan krijgt de gebruiker de nieuwe versie bij de volgende keer openen). */
let swReg = null;
let reloadPending = false;
const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

function reloadForUpdate() {
  if (db.active || sheet.open || confirmEl.open) { reloadPending = true; return; }
  location.reload();
}

async function checkForUpdate({ manual = false } = {}) {
  if (!swReg) { if (manual) toast('Updates controleren kan alleen in de geïnstalleerde/online app'); return; }
  try {
    await swReg.update();
    if (manual && !swReg.installing && !swReg.waiting) toast(`Je hebt de nieuwste versie (${APP_VERSION}) ✓`);
  } catch (_) {
    if (manual) toast('Geen internet — probeer het later nog eens');
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    } catch (err) { console.warn('SW', err); }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // eerste installatie: niets te verversen
    toast('Nieuwe versie geladen ✨');
    setTimeout(reloadForUpdate, 900);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  // Uitgestelde herlaad (na een training) zodra het kan
  setInterval(() => { if (reloadPending && !db.active && !sheet.open && !confirmEl.open && view === 'home') location.reload(); }, 2000);
}
