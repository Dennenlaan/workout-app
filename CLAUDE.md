# Workout Tracker (PWA) — projectcontext voor Claude

Mobielvriendelijke workout-tracker voor één gebruiker. Draait volledig
in de browser, geen backend, geen build-stap. UI-taal: **Nederlands**. Thema: **licht wit-roze
(altijd light mode, geen dark mode)**.

> **Houd dit bestand actueel** bij elke nieuwe feature, wijziging in de datastructuur of nieuwe
> ontwerpkeuze. Werk ook de "Changelog" onderaan bij.

## Productoverzicht
**Beginpagina = profielkeuze** (`view: 'who'`): "Mama" 🌷 of "Senna" 🌸 (`PEOPLE` in app.js). Alle
voortgang (history, gewichten, eigen schema's, actieve sessie, instellingen, hartslagprofiel) staat
**per persoon apart**. Wisselen via de chip "⇄ wisselen" onder de begroeting. Bij een cold start
verschijnt altijd de profielkeuze, behalve als de laatst gekozen persoon nog een lopende training
heeft (dan direct daarheen, zodat een timer niet "verdwijnt").

**Startscherm (bewust rustig)**: alleen begroeting, evt. "Ga verder", korte loop-herinnering en de
3 grote keuzes. Geschiedenis + backup zitten achter het kleine 🗂-icoon rechtsboven (`view: 'log'`,
met stip als backup > 14 dagen oud). **Hartslag staat níet op het startscherm/hoofdmenu** — alleen
een kleine link onderaan het hardloopschema + HR-invoer bij het afronden.
1. **Hardloopschema** (`view: 'run'`): 10 weken × 3 trainingen (start-to-run naar 5 km).
   Afvinkkalender (week × training), "volgende training", begeleide intervaltimer met
   geluid/spraak/trilling, 3×/week-herinnering (banner, browsermelding, agenda-.ics).
2. **Thuis trainen – Pilatesbord** (`view: 'pilates'`): niveaus Licht/Medium/Zwaar. Afgestemd op
   haar **Action-pilatesbord**: langwerpig bord met **glijplaat/slede in het midden**, **handgrepen** aan
   de uiteinden en **koorden met handvatten**. Oefeningen: koord-oefeningen staand/zittend,
   slede-oefeningen (glij-lunge, knee tuck, pike, rollout, hamstring-glij, kickback) + matwerk.
   **Een niveau kiezen opent de volledig-scherm speler** (`renderPlayer`): klaarmaken (10 s) →
   per set een werk-interval → rust (`level.rest`) → … schakelt **automatisch** door, met spraak,
   piepjes, pauze/hervat en ⏮/⏭ als back-up. Werktijd voor herhalingsoefeningen instelbaar
   (30/40/50/60 s, `settings.pilatesWork`); tijd-oefeningen gebruiken hun eigen `sec`.
   Probeert de Fullscreen API (Android); op iPhone vult de speler het scherm (`position: fixed`).
3. **Basic-Fit** (`view: 'gym'`): Armen (zonder bankje, ⇄ alternatieven), Full Body, Bil 1/2/3
   (elk 7 oefeningen), kg + reps per set, sets bewerkbaar. **Bil-schema's per bilspier** met
   spier-badge (`template.focus`, groene markering via `gluteSVG()`):
   Bil 1 = gluteus **maximus**, Bil 2 = gluteus **medius** (zijkant), Bil 3 = gluteus **minimus** (diep).
   **"✨ Mijn eigen schema's"**: apart kopje met groene "Maak je eigen schema"-kaart; editor met
   zoeken op naam óf spiergroep, ↑/↓, 🗑, sets en doel. Eigen = id niet in `BUILTIN_TEMPLATE_IDS`.
   **Spiergroep**: elke oefening heeft `muscle` (`GYM_MUSCLES` / `PILATES_MUSCLES` in data.js), getoond
   als groen label in de oefeningkaart, keuzelijsten, editor, info en speler. Het ⇄-wisselscherm toont
   "Nu: … 💪 spiergroep" en per alternatief de spiergroep + "✓ zelfde spiergroep" / "↺ andere focus".
   Nieuwe oefeningen (v5): `bf-sl-kb-rdl` (single-leg kettlebell RDL, één hand), `bf-sl-leg-press`
   (leg press met linkerbeen), `bf-seated-leg-curl` (zittend beenbuig-apparaat, hamstrings). Bereikbaar
   via ⇄ (alt van single-leg RDL / leg press / leg curl) en via eigen schema's.
4. **Hartslag** (`view: 'heart'`): uitleg (geen live smartwatch-data in een PWA), profiel, zones, HR per sessie.

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
| `styles.css` | Styling + tokens. |
| `sw.js` | Service worker (stale-while-revalidate) + `notificationclick`. **Verhoog de versie in `CACHE` (`workout-tracker-vN`) bij elke release** en zet nieuwe bestanden in `ASSETS`. Ruimt alleen caches met prefix `workout-tracker-` op (gedeeld github.io-domein!). |
| `.nojekyll` | Leeg bestand: GitHub Pages serveert alles letterlijk (geen Jekyll-verwerking). |
| `manifest.webmanifest`, `icons/` | PWA. Iconen via `python tools/make_icons.py` (kleur bovenin script). |
| `images/` | Optionele eigen oefening-plaatjes (zie `images/README.md` + `LOCAL_IMAGES` in data.js). |

## Architectuur `app.js`
- Globaal `db` (gebruikersdata) + UI-state (`view`, `editing`, `historyLimit`, `timer`).
- `render()` kiest view: `who | home | run | pilates | gym | heart | log | workout`. Bij `workout`
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
- **Oefening-soorten (`kind`)**: `weights` (kg + reps), `reps` (alleen reps), `time` (seconden, met ▶ die de
  timer als werk-timer start). Set-rij-layout hangt af van `kind`.
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
  "settings": { "restSeconds": 90, "pilatesWork": 40 },
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
- **Release-checklist**: (1) wijzig code, (2) verhoog `CACHE`-versie in `sw.js`, (3) upload gewijzigde
  bestanden, (4) op de telefoon: app openen, sluiten, opnieuw openen (stale-while-revalidate → 2e start is nieuw).
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
