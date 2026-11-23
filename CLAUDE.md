# Workout Tracker (PWA) — projectcontext voor Claude

Mobielvriendelijke workout-tracker voor één gebruiker. Draait volledig
in de browser, geen backend, geen build-stap. UI-taal: **Nederlands**. Thema: **licht wit-roze
(altijd light mode, geen dark mode)**.

> **Houd dit bestand actueel** bij elke nieuwe feature, wijziging in de datastructuur of nieuwe
> ontwerpkeuze. Werk ook de "Changelog" onderaan bij.

## Productoverzicht
**Profielen beheren (v14)**: `PEOPLE` is niet meer vast maar staat in `localStorage['workout-tracker:people']`
(standaard Mama `mama` + Senna `senna`; hun id's — en dus `dataKey` — blijven ongewijzigd). Per profiel:
`{ id, name, emoji, heightCm, sex: 'vrouw'|'man'|'anders'|null, fatPct }` (`normPerson`). Beginpagina:
✎ per kaart (`openPersonEditor`) en kaart "＋ Profiel toevoegen" (nieuw id `p-<uid>`, lege data). Verwijderen
(alleen als er >1 profiel is) bewaart een kopie in `…:<id>:deleted-<ts>`. Ook bewerken via de geschiedenispagina
("✎ Profiel bewerken"). Lengte → BMI bij Voortgang → Gewicht; vet% per weging (`weights[].fat`) → grafiek,
weekgemiddelde vet%, vetvrije massa; de laatste vet% wordt ook in het profiel gezet.

**Beginpagina = profielkeuze** (`view: 'who'`): standaard "Mama" 🌷 of "Senna" 🌸, uitbreidbaar. Alle
voortgang (history, gewichten, **notities per oefening** (`db.notes`), eigen schema's, actieve sessie,
instellingen, hartslagprofiel) staat **per persoon apart**. Wisselen via de chip "⇄ wisselen" onder de
begroeting én via de profielknop rechtsboven op elke pagina (`personButton()` in `backHeader`).
Per profiel: backup export/import en **"Reset <naam>"** (geschiedenis-pagina; optioneel eerst backup,
veiligheidskopie in `…:<id>:before-reset`). Bij een cold start
verschijnt altijd de profielkeuze, behalve als de laatst gekozen persoon nog een lopende training
heeft (dan direct daarheen, zodat een timer niet "verdwijnt").

**Startscherm (bewust rustig)**: alleen begroeting, evt. "Ga verder", korte loop-herinnering en de
3 grote keuzes. Geschiedenis + backup zitten achter het kleine 🗂-icoon rechtsboven (`view: 'log'`,
met stip als backup > 14 dagen oud). **Hartslag staat níet op het startscherm/hoofdmenu** — alleen
een kleine link onderaan het hardloopschema + HR-invoer bij het afronden.
1. **Hardloopschema** (`view: 'run'`): 10 weken × 3 trainingen (start-to-run naar 5 km).
   Afvinkkalender (week × training), "volgende training", begeleide intervaltimer met
   geluid/spraak/trilling, 3×/week-herinnering (banner, browsermelding, agenda-.ics).
2. **Thuis trainen** (`view: 'thuis'`) = keuzescherm met 4 opties (`THUIS_OPTIONS`):
   **Pilates met bord** (`pilates`), **Pilates op matje** (`mat`) — beide volledig-scherm speler via
   `PLAYER_PROGRAMS` (levels + exercises) — en **Thuis met dumbbell** / **Thuis met kettlebell**
   (`dumbbell` / `kettlebell`: vaste schema's `HOME_TEMPLATES`, set-tracker met kg + rusttimer,
   sessie-`program` = `dumbbell`/`kettlebell`).
   **Pilates met bord**: niveaus Licht/Medium/Zwaar. Afgestemd op
   haar **Action-pilatesbord**: langwerpig bord met **glijplaat/slede in het midden**, **handgrepen** aan
   de uiteinden en **koorden met handvatten**. Oefeningen: koord-oefeningen staand/zittend,
   slede-oefeningen (glij-lunge, knee tuck, pike, rollout, hamstring-glij, kickback) + matwerk.
   **Een niveau kiezen opent de volledig-scherm speler** (`renderPlayer`, tijdlijn `buildPlayerSegs`):
   `prep` (10 s) → per oefening: `work` (set) / `rest` (`level.rest`) tussen sets / `side` (5 s)
   tussen links en rechts → `switch` (**wisseltijd tussen oefeningen**, `settings.pilatesSwitch`
   10/15/20/30 s, groen scherm "Wissel van houding" + volgende oefening). Laatste 3 s van elk segment:
   visueel aftellen (`.countdown`, roze pulserende klok) + `tick()`-piepjes; segmentwissel = `alarm()` +
   spraak. Pauze/hervat, ⏮/⏭, ✕ stoppen. Werktijd herhalingsoefeningen 30/40/50/60 s
   (`settings.pilatesWork`); tijd-oefeningen gebruiken hun eigen `sec`.
   Probeert de Fullscreen API (Android); op iPhone vult de speler het scherm (`position: fixed`).
3. **Basic-Fit** (`view: 'gym'`): **geen rustbalk/rusttimer** in Basic-Fit-sessies (bewuste keuze:
   `showTimer` en `toggleSet` slaan `program === 'gym'` over; thuis met dumbbell/kettlebell heeft hem wél).
   **Slim wisselen** (`swapOptions(entry)`): "Beste alternatieven" (`alts` van oorspronkelijke + huidige
   oefening) en "Meer voor <spiergroep>" (zelfde `muscleFamily()`), **nooit oefeningen die al in de sessie
   staan**. Wisselen tussen eenzijdig en tweezijdig zet de sets om (`convertSets`). Werkt ook voor
   dumbbell/kettlebell-sessies.
   Leg press-varianten: 2 voeten hoog; 1 been voet middelhoog L/R (`bf-sl-leg-press`/`-r`); 1 been voet
   hoog L/R (`bf-lp-sl-high-L/R`); schuin zittend (45°) 1 been bilspier L/R (`bf-lp45-sl-L/R`).
   Schema's: Armen (zonder bankje, ⇄ alternatieven), Full Body, Bil 1/2/3
   (elk 7 oefeningen), kg + reps per set, sets bewerkbaar. **Bil-schema's per bilspier** met
   spier-badge (`template.focus`, groene markering via `gluteSVG()`):
   Bil 1 = gluteus **maximus**, Bil 2 = gluteus **medius** (zijkant), Bil 3 = gluteus **minimus** (diep).
   **"✨ Mijn eigen schema's"**: apart kopje met groene "Maak je eigen schema"-kaart; editor met
   zoeken op naam óf spiergroep, ↑/↓, 🗑, sets en doel. Eigen = id niet in `BUILTIN_TEMPLATE_IDS`.
   **Spiergroep**: elke oefening heeft `muscle` (`GYM_MUSCLES` / `PILATES_MUSCLES` in data.js), getoond
   als groen label in de oefeningkaart, keuzelijsten, editor, info en speler. Het ⇄-wisselscherm toont
   "Nu: … 💪 spiergroep" en per alternatief de spiergroep + "✓ zelfde spiergroep" / "↺ andere focus".
   Oefeningen: `bf-sl-kb-rdl` (single-leg kettlebell RDL, één hand, L/R), `bf-sl-leg-press`
   (**Linkerbeen**) en `bf-sl-leg-press-r` (**Rechterbeen**) met `side: 'L'|'R'`-badge,
   `bf-seated-leg-curl` (hamstrings, beenbuig-apparaat). v6 voegde ±13 extra (vooral bil-)oefeningen
   toe; `GYM_EXTRA_ALTS` koppelt ze als ⇄-alternatief aan de schema-oefeningen (apparaat bezet → wisselen).
   **Toestellen & zones** (`GYM_EQUIPMENT` in data.js): 4 zones (krachtapparaten met gewichtsblok,
   plate-loaded, racks/bankjes/kabels, losse gewichten & functionele zone) met 37 toestellen; **elke
   gym-oefening hoort bij een toestel** (controle: geen gym-id buiten `GYM_EQUIPMENT`). Getoond als
   uitklapbaar overzicht onderaan Basic-Fit en als "📍 toestel · zone" in het ⓘ-infoscherm
   (`EQUIPMENT_OF`). Nieuwe gym-oefening toevoegen ⇒ óók in `GYM_EQUIPMENT` zetten.
   TikTok-bilfavorieten: Kas glute bridge, frog pumps, B-stance RDL, curtsy lunge, cable glute kickback,
   cable abduction/side kick — eenzijdige varianten via L/R-rijen (één oefening, per set Linker- en
   Rechterbeen), leg press-varianten als aparte L/R-oefeningen (zo gevraagd).
   Catalogus v9: **210 oefeningen, waarvan 143 Basic-Fit over 55 toestellen in 5 zones** (+ zone
   **Cardio**: loopband (incl. 12-3-30 incline walk), crosstrainer, hometrainer/spinning, ligfiets,
   roeitrainer, traploper, airbike). Cardio-oefeningen hebben `kind: 'cardio'`: set-velden `min` en `lvl`
   (niveau/helling), standaard 1 set, kolommen "min | niveau", "vorige keer" = "30 min · niveau 12".
   Cables met `bar: true` tekenen een dikke stang (landmine, battle ropes; klasse `fig-barline`).
   Catalogus v8: 165 oefeningen (gym 98). Catalogus v7 was: 147 oefeningen (gym 80 incl. apparaten voor armen/borst/rug/benen en ±32 bil; pilatesbord
   18; mat 13; dumbbell 28; kettlebell 8). De dumbbell-lijst van de gebruiker (sumo/goblet/Bulgarian squat,
   walking lunges, RDL, step-ups, (single-leg) hip thrust, crunches, weighted marches, plank drags, glute
   bridge met overhead stretch, alternating glute bridge, bicycle crunches, bent-over/single-arm/renegade
   row, pullover, bicep/hammer curl, shoulder press, lateral raises, dumbbell press, overhead triceps,
   triceps met bankje) staat volledig onder `program: 'dumbbell'` (5 schema's incl. "Buik & core").

**Eenzijdige oefeningen** (`UNI` in data.js → `exercise.uni = 'been'|'arm'|'kant'`): in de set-tracker
krijgt elke set een L- én R-rij (`set.side`), gelabeld "Linkerbeen"/"Rechterbeen" (blauw/oranje), met
uitleg "eerst links, dan rechts". "Vorige keer"/placeholders zijn **strikt per kant** (`prevSetFor`):
nooit het gewicht van de andere kant tonen. `+ Set` voegt een L+R-paar toe. In de speler: work L →
`side`-wissel → work R, met grote kant-badge.
4. **Hartslag** (`view: 'heart'`): uitleg (geen live smartwatch-data in een PWA), profiel, zones, HR per sessie.

## Voortgang (`view: 'progress'`, code in `progress.js`)
- Ingang: kaart "📈 Voortgang" op het startscherm, chip "📈 Voortgang" bij een oefening (vanaf 2× gedaan) en
  knop in het ⓘ-infoscherm. 3 tabs (`progressTab`):
  - **Oefeningen**: kies oefening (select), metric "zwaarste set" of "volume (kg × reps)" (reps: max/totaal,
    tijd: langste set, cardio: minuten/niveau). Eenzijdige oefeningen → 2 reeksen Links/Rechts. Trendtekst
    "▲ +x sinds de eerste keer" + tabel. Data uit `db.history` (`exerciseSeries`).
  - **Gewicht**: `db.body.weights = [{date:'YYYY-MM-DD', kg}]` (1 per dag, overschrijft). Weekgemiddelden per
    week (ma–zo, `weeklyAverages`), verschil t.o.v. vorige week, grafiek: dagwaarden = stippen, weekgemiddelde =
    lijn (punt op de gemiddelde meetdatum, nooit in de toekomst).
  - **Metingen**: `db.body.measures = [{date, values:{borst, arm, taille, buik, heupen, bovenbeenR, bovenbeenL}}]`
    (cm, per datum samengevoegd). SVG-lichaamsomtrek (vooraanzicht: haar LINKS staat rechts op het plaatje,
    gelabeld R/L) met genummerde stippellijnen; focus op een veld ↔ lijn licht groen op (`MEASURES`, `bodySVG`).
- **Grafiek** `lineChart({series, unit, title})`: inline SVG, één y-as, 2px lijnen, ≥8px markers met
  2px ring, recessief grid, hover/tik-crosshair + tooltip (`CHARTS`), legenda bij ≥2 reeksen, alleen de
  eerste lijn direct gelabeld. Kleuren `CHART_COLORS` roze/groen — gevalideerd met de dataviz-validator
  (CVD ΔE 7,9 → daarom altijd vormverschil stippen vs. lijn + legenda). `signed()` voor ▲ +x / ▼ −x.
- Let op: `sort()` werkt in-place — maak eerst een kopie voordat je reeksen sorteert (bug gevonden in v12).

## Pilates op tijd
- Keuze 10/15/20/30 min, "Volledig" of eigen tijd (5–90) → `db.settings.pilatesMinutes` (per profiel; null = volledig).
- `buildTimedLevel(program, levelId, minutes)`: neemt rust/volgorde van het niveau, vult aan met andere
  oefeningen uit hetzelfde programma, kiest sets (≤12 min: 1, ≤22: 2, anders 3; meer als alle oefeningen
  op zijn) en daarna de werktijd 20–75 s die het dichtst bij de doeltijd uitkomt (`level.workSec`).
  Getest: 54/66 combinaties binnen 1 min van de doeltijd.

## Zelf apparaat/oefening toevoegen
- Kaart "➕ Apparaat of oefening toevoegen" op het startscherm → `openAddOwn()`: bovenaan "Laten toevoegen
  (met foto)" (= feedback), daaronder formulier: naam, waar (Basic-Fit / dumbbell / kettlebell), toestel,
  spiergroep (`OWN_MUSCLES`), soort (`KINDS`), eenzijdig, tip. Opslag in `db.exercises` (per profiel) met
  `muscle`, `uni`, `toestel`, `tip`; verwijderen haalt hem ook uit eigen schema's. Eigen Basic-Fit-oefeningen
  verschijnen als zone "⭐ Zelf toegevoegd" (`gymZones()`), in pickers en bij ⇄ (via spiergroep-familie).

## Feedback & vragen (geen server)
- Ingangen: 💬-knop op het startscherm, kaart "📸 Apparaat of oefening mist?" onderaan Basic-Fit,
  en "💬 Vraag of opmerking over deze oefening" in elk ⓘ-infoscherm (`data-action="feedback"`).
- Formulier (`openFeedback` / `renderFeedbackSheet`): soort (apparaat toevoegen / vraag / iets werkt niet /
  idee), onderwerp, bericht, optionele foto. "Versturen" = `navigator.share` (met foto als `files` waar
  ondersteund) → WhatsApp/iMessage/mail; fallback `wa.me/?text=` (zonder nummer) of klembord.
- **Bewust géén telefoonnummer/e-mailadres in de code** (repo is publiek). Het bericht komt bij de
  beheerder binnen, die het in Claude Code plakt. Format van een binnengekomen bericht:
  `💬 Workout-app feedback / Soort: … / Van: Mama|Senna / Apparaat/oefening: … / Bericht: … / (app vN · scherm · datum)`.
  Bij "Apparaat/oefening toevoegen": oefening(en) met pose, `muscle`, tip, evt. `UNI` toevoegen én in `GYM_EQUIPMENT` zetten.
- `APP_VERSION` in app.js staat in elk feedbackbericht: **gelijk houden met `CACHE` in sw.js**.

## Illustraties (100% offline, nooit leeg)
- **Geen video-/gif-links meer** (verwijderd in v3). Elke catalogus-oefening heeft `pose` → ingebouwde
  SVG via `figureSVG()`; staat **links** van de oefening (`thumb()`), groot in het ⓘ-infoscherm.
  Eigen oefeningen zonder pose krijgen een vast dumbbell-icoon (`fallbackSVG()`).
- Optioneel eigen plaatje: zet het in `images/` en registreer het in `LOCAL_IMAGES` (data.js),
  bv. `'bf-hip-thrust': 'images/hip-thrust.jpg'`. Het `<img>` ligt over de SVG; laadt het niet,
  dan wordt het verwijderd en blijft de SVG zichtbaar. Geen 404-scans: alleen geregistreerde paden.

## Stack & principes
- **Vanilla HTML + CSS + JS**, geen framework/bundler/npm. Klassieke `<script>`s delen globals.
- **Mobile-first**: tap-targets ≥ 44–52px, inputs ≥ 16px (geen iOS-zoom), `env(safe-area-inset-*)`,
  max contentbreedte 640px.
- **Thema**: design tokens als CSS-variabelen in `:root`, **alleen light** (`color-scheme: light`,
  geen dark-mode media query — bewuste keuze, app moet wit-roze openen). Witte kaarten, zachtroze
  achtergrond, accent `#b64a7d` (wit erop ≈ 4.9:1). Spiermarkering groen `--muscle` (#2f9e5b).
  Kleuren nooit hardcoden in componenten (uitzondering: SVG-tokens staan ook als CSS-variabelen).
- **Offline-first PWA**: `sw.js` cachet de app-shell; data in `localStorage`. Geen externe requests.

## Bestanden
| Bestand | Rol |
|---|---|
| `index.html` | Shell: `#app`, `#timer` (rusttimer), `<dialog id="sheet">`, `<dialog id="confirm">`, `#toast`, file-input. Laadt `data.js` vóór `app.js`. |
| `data.js` | **Vaste inhoud (catalogus), geen gebruikersdata**: `POSES`, `PILATES_EXERCISES`, `PILATES_LEVELS`, `GYM_EXERCISES`, `GYM_TEMPLATES`, `RUN_PLAN`, `HR_ZONES`, `CATALOG`. Inhoud aanpassen = hier. |
| `app.js` | Alle logica: opslag/migratie, rendering per view, events, rusttimer, run-timer, herinneringen, backup. |
| `progress.js` | Voortgang: grafieken (`lineChart`), oefening-progressie, lichaamsgewicht + weekgemiddelden, cm-metingen met lichaamsomtrek. Laadt ná app.js (gebruikt diens globals); `render()` roept `renderProgress` lui aan. |
| `styles.css` | Styling + tokens. |
| `sw.js` | Service worker **network-first** (`cache: 'no-cache'` → ETag/304; na 4 s of offline → cache) + `notificationclick`. Install haalt bestanden op met `cache: 'reload'`. **Verhoog bij elke release `CACHE` (`workout-tracker-vN`) én `APP_VERSION` in app.js (zelfde N)** en zet nieuwe bestanden in `ASSETS`. Ruimt alleen caches met prefix `workout-tracker-` op (gedeeld github.io-domein!). |
| `.nojekyll` | Leeg bestand: GitHub Pages serveert alles letterlijk (geen Jekyll-verwerking). |
| `manifest.webmanifest`, `icons/` | PWA. Iconen via `python tools/make_icons.py` (kleur bovenin script). |
| `images/` | Optionele eigen oefening-plaatjes (zie `images/README.md` + `LOCAL_IMAGES` in data.js). |

## Architectuur `app.js`
- Globaal `db` (gebruikersdata) + UI-state (`view`, `editing`, `historyLimit`, `timer`).
- `render()` kiest view: `who | home | run | thuis | pilates | mat | dumbbell | kettlebell | gym | heart | log | workout`. Bij `workout`
  met `db.active.run`: hardlopen → `renderRunSession()`, pilates → `renderPlayer()`; anders set-tracker.
- Profielen: globale `personId` + `db` (= data van die persoon). `selectPerson(pid)` laadt via
  `load(pid)`; `saveNow()` schrijft naar `dataKey(personId)` en doet niets zolang er niemand gekozen is. Terugknop via
  `backHeader(title, sub, back)` (hartslag gaat terug naar `run`). Bij `view === 'workout'`
  en `db.active.program === 'run'` wordt de **run-sessie** getoond, anders de set-tracker.
- Render = template strings → `innerHTML`. Typen in invoervelden re-rendert niet (focus behouden):
  `input`-handler schrijft naar `db` + `saveSoon()`.
- Events via delegation: `data-action` → `handleAction()` (switch). Context: `[data-entry]`
  (oefening in sessie), `[data-set]` (set-index), `[data-idx]` (item in template-editor).
- Dialogs: `openSheet(html)`, `choiceDialog(msg, choices)`, `confirmDialog()`, `hrDialog()` (gem./max HR, optioneel).
- **Catalogus vs. db**: ingebouwde oefeningen staan in `CATALOG` (code), eigen oefeningen in
  `db.exercises`. Altijd opzoeken via `exById()` / `exercisesFor(program)`.
- **Oefening-soorten (`kind`, lijst `KINDS`)**: `weights` (kg + reps), `reps` (alleen reps), `time`
  (seconden, met ▶ die de timer als werk-timer start), `cardio` (minuten + niveau). Set-rij-layout hangt af van `kind`.
- **Illustratie-engine** `figureSVG(poseKey, { animate })`: poppetje uit `POSES[key].frames`
  (2 keyframes; geanimeerd = SMIL heen-en-weer, statisch = frame B). Frames bouw je in data.js met
  `fr({ h, n, p, e, w, k, f, e2?, w2?, k2?, f2? })` (punten = [x,y]; ontbrekende 2e ledematen = 3px
  verschoven kopie). viewBox 200×135, vloer y=124 (bord: bovenkant y=120, slede y=114–120).
  Pose-opties: `front` (vooraanzicht, beide ledematen vol), `props` (statische toestel-SVG, helpers
  in `EQ`), `cables` / `cords` (`{from:[x,y], to:'w'}` staalkabel / roze koord), `links`
  (elastiek tussen 2 lichaamspunten), `holds` (`{at:'w', t:'db'|'plate'|'kb'|'grip'|'pad'|'bar'|'footplate'|'smallplate', dx, dy}`
  beweegt mee), `board: {x0, x1}` + `slider: 'f'|'w'|…` (pilatesbord met meebewegende slede).
  Animatie in de oefeningkaart; statisch in lijsten (pickers, editor).
- **Rusttimer** (onderbalk, alleen bij gym/pilates-sessie): absolute `endAt`, key `workout-tracker:timer`.
  Start bij afvinken met `restFor()` (= `db.active.restSec` of `settings.restSeconds`).
- **Run-timer**: staat in `db.active.run` (`segs`, `i`, `endAt`, `segStart`, `paused`, `pausedLeft`).
  `tickRun()` loopt in het 250ms-interval en haalt gemiste segmenten in (achtergrond). Segment met
  `sec: null` (5 km) telt op en wacht op "Volgende". Per segmentwissel: piepjes + trilling + spraak (nl-NL).
- **Herinneringen**: banner = `runsThisWeek()` (ma–zo) vs. doel 3 + geplande dagen. Browsermelding via
  `serviceWorker.showNotification` wordt alleen gecheckt terwijl de app open/achtergrond is (geen push-server).
  Betrouwbare herinnering = `.ics` met `RRULE:FREQ=WEEKLY;BYDAY=..;COUNT=30` + `VALARM` 30 min vooraf.
- **Hartslagzones**: max-HR = eigen invoer of `208 − 0,7 × leeftijd` (Tanaka); met rust-HR Karvonen
  (HR-reserve), anders % van max. Zones in `HR_ZONES`.
- Wake Lock aan tijdens elke actieve sessie.

## Opslagsleutels (localStorage)
| Sleutel | Inhoud |
|---|---|
| `workout-tracker:v1:mama`, `workout-tracker:v1:senna` | Volledige `db` per persoon (vorm hieronder). |
| `workout-tracker:person` | Laatst gekozen persoon-id. |
| `workout-tracker:people` | Lijst profielen met naam, emoji, lengte, geslacht, vet% (v14). |
| `workout-tracker:timer` | Lopende rusttimer (gedeeld, wordt gestopt bij profielwissel). |
| `workout-tracker:v1` | **Legacy** (vóór profielen). Bij data erin vraagt de profielkeuze eenmalig "Van wie zijn die?" en verplaatst het (`assignLegacy`); lege legacy wordt opgeruimd. Kopie blijft in `workout-tracker:v1:legacy-backup`. |
| `…:<id>:before-import`, `…:<id>:corrupt-<ts>` | Veiligheidskopieën per persoon. |

Backup-export = data van de huidige persoon (`workout-backup-<persoon>-<datum>.json`, met veld
`person`); import gaat in de huidige persoon en waarschuwt als de backup van de ander is.

## Datastructuur per persoon (`schemaVersion: 3`)
```jsonc
{
  "schemaVersion": 2,
  "exercises": [ { "id": "ex-<uid>", "name": "Cable kickback", "kind": "weights", "program": "gym" } ], // alleen EIGEN oefeningen
  "templates": [  // Basic-Fit schema's (eerst gevuld vanuit GYM_TEMPLATES, daarna bewerkbaar)
    { "id": "bf-bil2", "name": "Bil 2", "program": "gym", "note": "Gluteus medius · zijkant van de bil",
      "focus": "maximus" | "medius" | "minimus" | null,   // spier-badge
      "items": [ { "exerciseId": "bf-abduction", "sets": 4, "target": "15" } ] }
  ],
  "history": [  // afgeronde sessies, NIEUWSTE EERST (alle programma's)
    { "id": "…", "program": "gym" | "pilates" | "run", "templateId": "bf-arms" | "medium" | null,
      "name": "Armen", "startedAt": "ISO", "finishedAt": "ISO",
      "hr": { "avg": 142, "max": 171 } | null,
      "runKey": "w3t2",               // alleen bij run: week 3, training 2
      "restSec": 40,                  // optioneel (pilates-niveau)
      "exercises": [ { "id": "…", "exerciseId": "bf-cable-curl", "name": "…", "kind": "weights",
                       "target": "10-12", "targetSec": null, "alts": ["…"] | null,
                       "sets": [ { "kg": 12.5, "reps": 10, "sec": null, "done": true } ] } ] }
  ],
  "active": null,   // lopende sessie (zelfde vorm, finishedAt null). Getimede sessies hebben extra
                    // "run": {segs,i,endAt,segStart,paused,pausedLeft}. Hardlopen: segs {type:'warmup'|'run'|'walk'|'cooldown', sec}.
                    // Pilates-speler: segs {type:'prep'|'work'|'rest', e (oefening-index), s (set-index), sec};
                    // een voorbij (of overgeslagen ⏭) work-segment zet die set op done (completeSeg).
  "settings": { "restSeconds": 90, "pilatesWork": 40, "pilatesSwitch": 15, "pilatesMinutes": 15 | null },
  "body": { "weights": [ { "date": "2026-11-23", "kg": 65.8, "fat": 24.5 /* optioneel */ } ],
            "measures": [ { "date": "2026-11-23", "values": { "taille": 70.5, "heupen": 99.5 } } ] },
  "notes": { "bf-bulgarian": "Bank op stand 3" },   // vaste notitie per oefening-id (per profiel)
  // sets kunnen een "side": "L" | "R" hebben (eenzijdige oefeningen); entries een "uni": "been"|"arm"|"kant"
  // sessie-program: "gym" | "pilates" (bord én matje) | "run" | "dumbbell" | "kettlebell"
  "run": { "reminder": { "days": [0, 2, 5], "time": "19:00", "notify": false, "lastNotified": "YYYY-MM-DD" | null } }, // days: 0 = maandag
  "profile": { "age": null, "restHr": null, "maxHr": null },
  "lastBackupAt": null
}
```
- Hardloop-voortgang wordt **afgeleid uit `history`** (entries met `runKey`); geen aparte vinkjes-opslag.
  Handmatig afvinken maakt een history-item zonder oefeningen; uitvinken verwijdert die items.
- `kg`, `reps`, `sec` zijn `number | null`; komma als decimaalteken wordt geaccepteerd.
- Laden via `normalizeDb()` (valideert, vult aan, migreert):
  **v1 → v2**: v1-standaardoefeningen en Upper/Lower/Full vervallen, eigen v1-templates → gym-templates.
  **v2 → v3**: ingebouwde schema's (`bf-arms`, `bf-full`, `bf-bil1..3`) worden vervangen door de nieuwe
  versie, eigen schema's blijven; `media` vervalt; items met onbekende oefening-id's worden weggefilterd.
  Corrupte JSON wordt bewaard onder `workout-tracker:v1:corrupt-<ts>`.
- **Schemawijziging?** `SCHEMA_VERSION` ophogen, migratie in `normalizeDb()`, hier documenteren.

## Backup
Export `workout-backup-YYYY-MM-DD.json` (= volledige `db`). Import valideert/migreert via
`normalizeDb()`, vraagt bevestiging, bewaart vorige data in `workout-tracker:v1:before-import`.
Waarschuwing op home na 14 dagen zonder backup.

## Lokaal testen
`python -m http.server 8000` → **http://127.0.0.1:8000** (`localhost` kan via IPv6 falen).
Telefoon op zelfde wifi: `python -m http.server 8000 --bind 0.0.0.0` → `http://<pc-ip>:8000`
(firewallregel voor python.exe bestaat al; geen service worker/installatie/wake lock/meldingen zonder HTTPS).
Submap-test zoals GitHub Pages: kopie in `<map>/workout-app/` en serveer `<map>` → `/workout-app/`.

## Hosting: GitHub Pages (productie, HTTPS)
- URL-vorm: `https://<gebruiker>.github.io/<repo>/` → app draait in een **submap**.
- **Alle paden moeten relatief blijven** (geen leidende `/`): `index.html` (`href="styles.css"`),
  manifest (`start_url`/`scope` = `"./"`, iconen `icons/…`), `sw.js` (`ASSETS` met `./…`,
  `openWindow('./')`), `register('sw.js')`. Geverifieerd 2026-11-23: SW-scope = `/<repo>/`, alles 200,
  volledig offline bruikbaar.
- Publiceren: repo (public, verplicht voor gratis Pages) → Settings → Pages → *Deploy from a branch*,
  branch `main`, map `/ (root)`.
- **Live**: https://dennenlaan.github.io/workout-app/ (repo `Dennenlaan/workout-app`, public, Pages vanaf `main` / root).
- **Git op deze pc**: alleen via GitHub Desktop (niet in PATH). Gebundelde git:
  `$env:LOCALAPPDATA\GitHubDesktop\app-<versie>\resources\app\git\cmd\git.exe` (versiemap verandert
  bij Desktop-updates → zoek opnieuw). Repo-identiteit staat lokaal op het GitHub **no-reply**-adres;
  commit nooit met het privé-mailadres (repo is publiek).
- **Pushen vanuit Claude Code werkt**: login staat in Windows Referentiebeheer via Git Credential Manager
  (`credential.helper=manager`). De chat-shell blokkeert inlogvensters (`GIT_TERMINAL_PROMPT=0`,
  `GCM_INTERACTIVE=never`); verloopt de login, laat de gebruiker in een gewoon PowerShell-venster
  `…\git\ucrt64\bin\git-credential-manager.exe github login` draaien. Alternatief: *Push origin* in GitHub Desktop.
- **Release-checklist**: (1) wijzig code, (2) verhoog `CACHE` in `sw.js` en `APP_VERSION` in app.js,
  (3) **opstart-rooktest** (verplicht, zie hieronder), (4) commit + push, (5) wacht tot `sw.js` live de nieuwe
  versie toont (GitHub Pages ± 1 min).
- **Opstart-rooktest** (les uit v12 → wit scherm): herlaad de app écht (`location.reload()`) met een
  openstaande training van elk type (gym, pilates-speler, run, dumbbell, kettlebell) en controleer dat `#app`
  gevuld is zonder console-errors; open daarna elk view voor beide profielen (incl. de 3 progress-tabs).
  Testen zonder reload missen fouten in de laadvolgorde van scripts.
- **Wit scherm voorkomen**: `boot()` start pas na `DOMContentLoaded` (alle scripts geladen; progress.js komt
  ná app.js). `render()` is een vangnet rond `renderUnsafe()`: bij een fout verschijnt `showRecovery()` met
  "Opnieuw proberen / Naar startscherm / Lopende training sluiten (geparkeerd in `…:<id>:parked-<ts>`) /
  Profielkeuze" + de foutmelding (om door te sturen). Functies uit progress.js in app.js altijd met
  `typeof fn === 'function'` aanroepen.
- **Waarom updates soms niet zichtbaar waren (opgelost in v11)**: GitHub Pages stuurt
  `Cache-Control: max-age=600` en de oude SW was stale-while-revalidate → eerst oude versie, soms
  meerdere keren openen nodig. Nu: network-first, `register(…, { updateViaCache: 'none' })`, update-check
  bij terugkeren in de app (`visibilitychange`), en bij `controllerchange` één automatische herlaad
  (`reloadForUpdate`, niet tijdens een training/open dialoog → uitgesteld tot het startscherm).
  Versie + knop "🔄 Controleer op updates" staan op de geschiedenispagina. Getest: v11 → v12 → v13
  automatisch opgepakt, offline opent de app uit de cache.
- **Telefoon met een héél oude versie (≤ v10)**: die draait nog de oude SW. Eén keer de app openen
  (nieuwe SW installeert), app volledig afsluiten (wegvegen) en opnieuw openen → vanaf dan automatisch.
- `localStorage` en Cache Storage zijn per origin (`<gebruiker>.github.io`), dus gedeeld met andere
  Pages-sites van dezelfde gebruiker: houd keys/caches geprefixt (`workout-tracker…`).
- Data van de LAN-test (`http://<pc-ip>:8000`) staat op een andere origin → overzetten via backup export/import.
- Repo is publiek: zet nooit persoonlijke gegevens in code of CLAUDE.md. Trainingsdata staat alleen op de telefoon.

## Bekende beperkingen / ideeën
- Geen live smartwatch-hartslag (geen API voor Apple Watch/Garmin/Fitbit in de browser). Idee: Web
  Bluetooth voor BLE-hartslagbanden (alleen Chrome/Android, niet iOS).
- Browsermeldingen alleen terwijl de app draait; iOS alleen als PWA op beginscherm. Agenda-.ics is de betrouwbare route.
- iPhone op stil = geen piepjes; `vibrate` werkt niet op iOS. Spraak (`speechSynthesis`) meestal wel.
- RUN_PLAN-totalen zijn letterlijk overgenomen; week 9 tr1 zegt 36 min maar segmenten tellen op tot 31 min.
- Pilatesniveaus zijn (nog) niet bewerkbaar; eigen oefeningen kunnen nog niet hernoemd/verwijderd worden.
- Ideeën: progressiegrafieken, PR-detectie, Web Bluetooth-hartslag, push-meldingen via server.

## Changelog
- **v14 (2026-11-23)**: profielen toevoegen/bewerken/verwijderen (naam, icoon, lengte, geslacht, vet%);
  vetpercentage per weging + BMI + vetvrije massa bij Voortgang; nieuwe oefening "Assisted pull-up machine –
  bil-kickback (1 voet op kniepad)" (L/R, bij toestel Assisted pull-up/dip en als ⇄ bij kickbacks). Wensenlijst
  (34 punten) automatisch geverifieerd; opstart-rooktest incl. derde profiel. Cache v14.
- **v13 (2026-11-23)**: fix wit scherm bij openen met een openstaande training (v12: `timesDone` uit
  progress.js werd aangeroepen vóór dat bestand geladen was). Start nu na DOMContentLoaded, herstelscherm
  i.p.v. wit scherm bij elke render-fout, opstart-rooktest toegevoegd aan de release-checklist.
- **v12 (2026-11-23)**: pilates op tijd (10/15/20/30/eigen → automatisch passend schema); startscherm-kaarten
  "➕ Apparaat of oefening toevoegen" (zelf toevoegen of via foto) en "📈 Voortgang"; voortgang met grafiek
  per oefening (L/R apart), lichaamsgewicht met weekgemiddelden en cm-metingen met SVG-lichaamsomtrek;
  nieuw bestand `progress.js`. Alles per profiel. Cache v12.
- **v11 (2026-11-23)**: updates komen nu direct door: service worker network-first (met offline-
  fallback), automatische herlaad bij een nieuwe versie, update-check bij terugkeren in de app,
  versie + "Controleer op updates" op de geschiedenispagina.
- **v10 (2026-11-23)**: feedback/vragen vanuit de app via het deelmenu (WhatsApp/iMessage/mail), met
  soort, onderwerp, bericht en foto; ingangen op startscherm, Basic-Fit en oefening-uitleg; `APP_VERSION`. Cache v10.
- **v9 (2026-11-23)**: Basic-Fit compleet gemaakt: +45 oefeningen / +18 toestellen — machines (torso
  rotation, multi-hip, pullover, decline press, staande leg curl, seated calf), plate-loaded (iso-lateral,
  belt squat), rack/bank/optrekstang (bench press, front squat, overhead press, good morning, preacher,
  decline sit-up, GHD, reverse hyper, pull-ups, dips, hanging leg raise), kabels & landmine (cable fly,
  straight-arm pulldown, woodchopper, upright row, landmine squat/row/press), functioneel (deadlift,
  barbell row, shrugs, farmer's walk, push-ups, ab wheel, Russian twist, wall balls, battle ropes) en
  nieuwe zone Cardio (8 oefeningen, kind `cardio`). Cache v9.
- **v8 (2026-11-23)**: Basic-Fit toestellen- & zonelijst (37 toestellen, alle gym-oefeningen gekoppeld,
  overzicht + "📍 toestel" in uitleg); 18 nieuwe gym-oefeningen: Kas glute bridge, lateral raise machine,
  lower back machine, plate-loaded chest/shoulder press, T-bar/high row, pendulum squat, back squat (rack),
  dumbbell bench/incline press, knee raise (captain's chair), kettlebell swing, slam balls, slee, TRX row,
  plyobox, foamrollen; hernoemd: "Cable glute kickback", "Cable abduction / side kick". Cache v8.
- **v7 (2026-11-23)**: Basic-Fit zonder rustbalk; slim wisselen (geen dubbele oefeningen, alternatieven
  per spiergroep, L/R-omzetting); 7 leg press-varianten (voet hoog/middelhoog, 1 of 2 benen, schuin
  zittend, Linker-/Rechterbeen); apparaten biceps/triceps-machine, pec deck, incline press, low row,
  smalle pulldown, hack squat, calf raise, kneeling cable kickback; dumbbell-lijst aangevuld (16 nieuw,
  "Lunge" → "Walking lunges"), dumbbell-schema's uitgebreid naar 5. Cache v7.
- **v6 (2026-11-23)**: Thuis trainen in 4 keuzes (pilates met bord, **pilates op matje** (13 oef., 3
  niveaus), **dumbbell** (12 oef., 3 schema's), **kettlebell** (8 oef., 2 schema's)); speler met
  wisseltijd tussen oefeningen, kant-wissel en 3-2-1-aftellen met piepjes; L/R-rijen voor eenzijdige
  oefeningen (strikt per kant); single-leg press Links én Rechts; ±13 extra Basic-Fit-oefeningen (vooral
  bil) als ⇄-alternatief; notities per oefening; profielknop op elke pagina; reset per profiel. Cache v6.
- **v5 (2026-11-23)**: profielkeuze Mama/Senna als beginpagina met gescheiden opslag per persoon
  (+ eenmalige toewijzing van oude gegevens); pilates als volledig-scherm speler die automatisch
  doorschakelt (pauze, ⏮/⏭, instelbare tijd per set); Basic-Fit "Mijn eigen schema's" + verbeterde
  editor (↑↓, zoeken op spiergroep); groene spiergroep-labels overal en in het ⇄-wisselscherm;
  nieuwe oefeningen single-leg kettlebell RDL, single-leg press (linkerbeen), zittende leg curl. Cache v5.
- **v4 (2026-11-23)**: klaar voor GitHub Pages: `.nojekyll`, cache-prefix `workout-tracker-` (ruimt
  geen caches van andere github.io-sites meer op), submap- en offline-werking geverifieerd.
- **v3 (2026-11-23)**: licht wit-roze thema (dark mode verwijderd); rustig startscherm (alleen 3
  keuzes + herinnering; geschiedenis/backup achter 🗂, hartslag van startscherm af); ingebouwde
  SVG-illustraties met toestellen links van elke oefening (video-links verwijderd, optionele
  `images/` + `LOCAL_IMAGES`); pilatesbord herzien (glijplaat/slede, handgrepen, koorden; nieuwe
  slede-oefeningen); bil-schema's per spier (maximus/medius/minimus) met groene spier-badge; schema v3.
- **v2 (2026-11-23)**: roze thema; startscherm met 3 programma's; hardloopschema (10 wk) met
  afvinkkalender, begeleide intervaltimer en 3×/week-herinnering (banner/melding/.ics); pilatesbord
  Licht/Medium/Zwaar met SVG-animaties, uitleg en eigen video-links; Basic-Fit-schema's
  (Armen zonder bankje + alternatieven, Full Body, Bil 1–3) met bewerkbare sets/doelen;
  hartslagsectie met zones en HR per sessie; schema v2 + migratie; `data.js` toegevoegd.
- **v1 (2026-11-23)**: templates, sets met kg/reps/afvinken, vorige prestatie, rusttimer,
  localStorage + JSON export/import, geschiedenis, PWA, dark mode.
