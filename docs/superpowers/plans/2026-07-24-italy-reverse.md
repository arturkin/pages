# Italy Reversed Itinerary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse the Italy trip: beach first (longest drive Day 2), gradually back north, last day shopping in Florence with a 07:00 MXP flight next morning and no final hotel night.

**Architecture:** Content lives in `trips/italy/itinerary.md`; map-only data in `trips/italy/meta.js`; route geometry from `trips/italy/routes.py` → `routes.js`. `assets/sync.js` merges doc+meta into `trip.js` (bases matched BY ORDER). A PostToolUse hook auto-runs sync on itinerary/meta edits.

**Tech Stack:** Plain Node (sync), Python + OSRM public API (routes). No deps.

## Global Constraints

- Commit directly to `main` — no branches.
- Do NOT hand-edit `trip.js`, `routes.js`, `index.html` — generated.
- Do NOT launch/screenshot the page — trust `node assets/sync.js` output.
- `bases` in `meta.js` must match the doc's bases by order and count (6 incl. HOME).
- After regenerating `routes.js`, run `node assets/sync.js` again (cache-buster hash).
- New nights: Florence 1 (Oct 3) · Argentario 4 (4–8) · Crete Senesi 5 (8–13) · Val d'Orcia 4 (13–17) · Florence day-visit 0 (17) · fly 07:00 MXP Oct 18.
- Car: Florence round-trip — pick up Firenze SMN Day 2 (Oct 4), drop Florence Day 15 (Oct 17). Florence→MXP by evening train + late airport connection, overnight in the terminal.

---

### Task 1: Rewrite `itinerary.md` + matching `meta.js`

**Files:**
- Modify: `trips/italy/itinerary.md` (full rewrite, content below)
- Modify: `trips/italy/meta.js` (link dates, base order, highlight moves, legMode)

**Interfaces:**
- Produces: doc base order Florence → Argentario → Crete Senesi → Val d'Orcia → Florence(0 nt) → Home, which Task 2's route legs and `legMode` day numbers (2, 6, 11, 15) rely on.

- [ ] **Step 1: Write the new `itinerary.md`** — replace the whole file with:

```markdown
ITALY — TWO WEEKS: TUSCANY, DEEP
Sat 3 Oct – Sun 18 Oct 2026 · 14 nights
Route: Florence → Argentario (Maremma) → Crete Senesi (Asciano) → Val d'Orcia (Montalcino) → Florence
Fly: Icelandair KEF 09:00 → MXP 15:10 (out) · MXP 07:00 → KEF (back, dawn — overnight at the airport)

WHAT CHANGED IN THIS VERSION
 - The whole route is REVERSED: the coast comes first (while the sea is warmest), then the
   farmhouse, then the vineyard hotel — ending next to Florence for the shopping finale.
 - The return flight is now the 07:00 from Malpensa. No hotel on the last night: evening
   train north after the Florence shopping day, overnight at the airport, fly at dawn.
 - Day 2 is the trip's longest drive — Florence down the Etruscan coast (Bolgheri's cypress
   avenue, Castiglione della Pescaia) to Porto Ercole. Every later hop gets shorter.
 - Crete Senesi grows to 5 nights (the freed hotel night) and gains a San Gimignano day-trip
   — it no longer sits on any drive route.
 - One car, a simple round-trip from Florence (pick up Day 2, drop Day 15) — no one-way fee.

WHERE YOU SLEEP
 Florence .............. 1 night (arrival only)
 Argentario ............ coast hotel near Porto Ercole (4 nights) — beach first
 Crete Senesi .......... isolated farmhouse w/ pool via Airbnb, near Asciano (5 nights) — full immersion
 Val d'Orcia ........... vineyard hotel w/ pool + bar: Podere Brizio, Montalcino (4 nights) — book early
 (last night) .......... none — evening train to Malpensa, 07:00 flight

----------------------------------------------------------------

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 FLORENCE · arrival hotel · 1 night · Sat 3 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 1 · Sat 3 Oct — Fly in, train to Florence
 - 09:00 KEF → 15:10 MXP; Malpensa Express to Milano Centrale (~50 min)
 - Frecciarossa Milan → Florence (~2 h, direct; book in advance). Arrive ~19:30
 - Check in near Santa Maria Novella; easy dinner, early night

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏖️ ARGENTARIO / MAREMMA · coast hotel · 4 nights · Sun 4 – Thu 8 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 2 · Sun 4 Oct — Pick up the car, the long coast road south  ›› arrive & check in
 - Collect the rental at Firenze SMN; follow the signed ZTL exit route, do NOT drive into the centre
 - Confirm the drop is back at FLORENCE on the contract (round-trip, no one-way fee)
 - Take the scenic way down the SS1 Aurelia: Bolgheri — the cypress avenue (Viale dei Cipressi)
   and a Super Tuscan stop (Sassicaia / Ornellaia country; you're driving — taste light or just buy)
 - Late lunch at Castiglione della Pescaia (medieval seaside town)
 - On to Porto Ercole; check in, first beach evening, seafood in the harbour
 >> Florence → Bolgheri → Castiglione della Pescaia → Porto Ercole · ~3 h 15 driving + stops (the trip's longest drive)

DAY 3 · Mon 5 Oct — Feniglia beach + the Tarocchi
 - Spiaggia della Feniglia: long pine-backed beach; walk or bike the Duna Feniglia reserve
 - Giardino dei Tarocchi at Capalbio (Niki de Saint Phalle's mosaic park) — afternoons only;
   the season runs to 15 Oct, so early October is comfortably inside it
 - Aperitivo on the Argentario

DAY 4 · Tue 6 Oct — Parco della Maremma
 - Parco della Maremma (Alberese): coastal trails to the towers and the wild beach, Maremmana cattle
 - Lagoon seafood and Orbetello bottarga for dinner

DAY 5 · Wed 7 Oct — Boat, coves, or the lagoon
 - Boat around the Argentario coves, or the footpath down to Cala del Gesso
 - OR Orbetello lagoon WWF reserve (flamingos) + the Spanish Fortress viewpoint at Porto Santo Stefano
 - OR go inland (~1 h) to Massa Marittima: an underrated medieval town in the Colline Metallifere,
   dramatic cathedral, few tourists
 - Last Maremma swim; pack (into the hills tomorrow)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌾 CRETE SENESI · isolated farmhouse (Airbnb) · 5 nights · Thu 8 – Tue 13 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 6 · Thu 8 Oct — Argentario → Crete Senesi, through the wild interior  ›› arrive & check in
 - Take the scenic inland route up and cut through the middle of the loop:
 - Bagni di Petriolo: a soak in the wild free sulphur springs in the river gorge under the old bridge
   (no facilities — bring water shoes; skip it if you'd rather push on to the hills)
 - Abbazia di San Galgano: the roofless Gothic abbey open to the sky, + the sword in the stone up at
   the Montesiepi chapel (abbey ~€6, open ~09:00–19:00; the chapel is free)
 - On to the isolated farmhouse near Asciano; groceries in Asciano or Buonconvento
 - Settle in: the clay-hill silence, big skies, sunset over the crete
 >> Porto Ercole → Petriolo → San Galgano → Crete Senesi · ~3 h driving + stops (a full scenic day)

DAY 7 · Fri 9 Oct — Asciano & Monte Oliveto Maggiore
 - Slow morning at the farmhouse, then the classic crete drive on the back-roads (the biancane badlands)
 - Monte Oliveto Maggiore: the great abbey in its cypress wood, Signorelli & Sodoma frescoes
 - Asciano: the Museo Cassioli, a quiet lunch; home for sunset over the clay

DAY 8 · Sat 10 Oct — Truffle villages & Buonconvento
 - The tiny Crete hilltops: Trequanda, Montisi, Castelmuzio, Petroio — Etruscan-quiet, almost empty
 - Buonconvento (little walled town, good market): produce, pecorino, new-harvest oil; white-truffle
   fairs if they're on
 - Aperitivo back at the farmhouse

DAY 9 · Sun 11 Oct — Siena
 - Into Siena (~35 min): Piazza del Campo, the Duomo, the contrade lanes — a city, but a glorious walkable one
 - Early evening back to the quiet; aperitivo at the farmhouse
 - (Skip it entirely if you'd rather just do nothing in the hills — no obligation)

DAY 10 · Mon 12 Oct — San Gimignano day-trip
 - Out west (~1 h 15) to San Gimignano (park outside the walls): the towers, a Vernaccia, lunch
 - Monteriggioni on the way back if you're in no hurry — the circular walled castle-village
 - Last farmhouse dinner; pack for the move to the vineyard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍷 VAL D'ORCIA · vineyard hotel (Podere Brizio) · 4 nights · Tue 13 – Sat 17 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 11 · Tue 13 Oct — Crete Senesi → Val d'Orcia  ›› arrive & check in
 - ~40 min south to Montalcino; check in at Podere Brizio (pool, vineyard, on-site restaurant)
 - Settle in: pool, sunset over the Val d'Orcia; first dinner at the estate or in Montalcino town
 - Pre-book a Brunello tasting (the estate's own cellar, or a town enoteca)
 >> Crete Senesi → Montalcino · ~40 min / 35 km

DAY 12 · Wed 14 Oct — Pienza & the pecorino
 - Pienza (~30 min): cheese shops, the "ideal city" streets, Piccolomini palace
 - Cypress viewpoints en route (Cappella di Vitaleta, the "Gladiator" road) at late light
 - Bagno Vignoni thermal square + free Parco dei Mulini pools

DAY 13 · Thu 15 Oct — Montepulciano (Vino Nobile)
 - Montepulciano (~45 min): Piazza Grande; Vino Nobile cellars carved under the town-centre palazzi
 - Lunch in town; wine shopping
 - Dinner back at the estate

DAY 14 · Fri 16 Oct — Montalcino, market day + Sant'Antimo
 - Slow estate morning: pool, spa, the vineyard
 - Into Montalcino (~10 min): the Friday market (produce, cheese, new-harvest oil), Fortezza,
   town enoteca for a Brunello flight
 - Afternoon: the Romanesque Abbey of Sant'Antimo + the Bagni San Filippo white travertine
   springs ("Fosso Bianco")
 - Last countryside dinner; buy/ship wine + oil TODAY (you fly at dawn on Sunday); pack

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ FLORENCE · shopping day, no hotel · 0 nights · Sat 17 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 15 · Sat 17 Oct — Montalcino → Florence, shopping, night run to Malpensa
 - Leave after breakfast (~1 h 50 to Florence); drop the rental at Firenze SMN (round-trip, no
   one-way fee); leave the bags at the station deposit
 - Shopping: San Lorenzo Market + the leather quarter, Ponte Vecchio goldsmiths, Oltrarno artisans
 - Evening passeggiata + an early last big dinner
 - Frecciarossa Firenze SMN → Milano Centrale (~20:30–21:30 departure, ~2 h)
 - Late Malpensa Express / night bus Milano Centrale → MXP; NO hotel — overnight in the terminal
 >> Montalcino → Florence · ~1 h 50 / 110 km (then the evening train north)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛫 HOME · Sun 18 Oct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAY 16 · Sun 18 Oct — Fly home at dawn
 - 07:00 MXP → KEF; you're already at the terminal — bag drop by ~05:30
 - Land in Reykjavik with the whole day ahead

----------------------------------------------------------------

NOTES
 - Car: pick up Firenze SMN (Day 2) and drop back in FLORENCE (Day 15 morning) — a plain
   round-trip, no one-way fee. Book via a consolidator (AutoEurope etc.). FLORENCE ZTL: depots
   sit at the restricted-zone edge — follow the signed exit route out, do NOT cut through the
   centre or you'll get camera fines by post. Park OUTSIDE the walls at San Gimignano, Siena,
   Montepulciano, Buonconvento.
 - The LAST NIGHT is a transit night, not a hotel night: after the Florence shopping day take
   an evening Frecciarossa to Milano Centrale (~2 h; the ~20:30–21:30 departures are the sweet
   spot), then a late Malpensa Express or night bus to MXP (airport buses run through the
   night). Terminal 1/2 stay open — aim to be at the airport by ~05:00 for the 07:00 flight.
 - Trains: two train moments — Day 1 (Milan → Florence on arrival) and Day 15 evening
   (Florence → Milano Centrale → Malpensa). Fares open ~90–120 days out; grab cheap
   "Super Economy" fares early (€15–20 vs €70–80 last-minute). Florence → Milano C.le is
   direct ~2 h, ~hourly.
 - Lodging strategy: book the two countryside stays FIRST — a genuinely isolated farmhouse near
   Asciano / Trequanda (Crete Senesi) and Podere Brizio in Montalcino both go early for October.
   Vet reviews + Superhost; check the drive in (some are 15+ min down a gravel strada bianca).
 - POOLS: by mid-October most Crete Senesi farmhouse pools have closed or gone cold and are rarely
   heated — confirm the pool is open (and heated) for your dates before booking, and treat it as a
   bonus, not a swim guarantee. Podere Brizio's pool IS confirmed open to 30 Nov.
 - Podere Brizio: romantic Brunello wine resort ~10 min from Montalcino; on-site La Bottaia
   restaurant + small spa, their own Brunello Riserva tastings. Stretch upgrades if wanted: Villa
   Le Prata (adults-only) or Mastrojanni Relais (infinity pool).
 - Seasonal: the Giardino dei Tarocchi closes for the season 15 Oct — with the beach first
   (Day 3) you're comfortably inside the window. The Argentario fishing harbours stay open
   year-round.
 - Baggage: the dawn budget flight is strict — ship a case of wine home (arrange it Day 14 in
   Montalcino) or pre-book a checked bag.

TO BOOK — actionable links (dates & 2 guests pre-filled)
 [ ] Florence, arrival (1 nt, Oct 3–4):
     https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0
 [ ] Coast hotel, Monte Argentario / Porto Ercole (4 nts, Oct 4–8):
     https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-04&checkout=2026-10-08&group_adults=2&no_rooms=1&group_children=0
 [ ] Isolated farmhouse, Crete Senesi / Asciano (5 nts, Oct 8–13, entire home + pool):
     https://www.airbnb.com/s/Asciano--Tuscany--Italy/homes?checkin=2026-10-08&checkout=2026-10-13&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7
 [ ] Podere Brizio, Montalcino (4 nts, Oct 13–17):
     https://poderebrizio.it/en/   (or Booking: Montalcino, Oct 13–17)
 [ ] Trains (BOOKABLE ~90–120 days out): Milano C.le → Firenze SMN (Day 1) · Firenze SMN →
     Milano C.le → Malpensa (Day 15, evening)
 [ ] Rental car: pick up Firenze SMN (Day 2, Oct 4), drop Firenze (Day 15, Oct 17) — round-trip
```

- [ ] **Step 2: Update `meta.js`** — apply ALL of these edits:

1. Link builders (new dates; drop the shopping-night link):

```js
const AIRBNB = {
  cretesenesi: "https://www.airbnb.com/s/Asciano--Tuscany--Italy/homes?checkin=2026-10-08&checkout=2026-10-13&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7",
  argentario:  "https://www.airbnb.com/s/Monte-Argentario--Tuscany--Italy/homes?checkin=2026-10-04&checkout=2026-10-08&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7"
};
const HOTEL = {
  poderebrizio: "https://poderebrizio.it/en/"
};
const BOOKING = {
  florence:    "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0",
  cretesenesi: "https://www.booking.com/searchresults.html?ss=Asciano%2C+Tuscany%2C+Italy&checkin=2026-10-08&checkout=2026-10-13&group_adults=2&no_rooms=1&group_children=0",
  valdorcia:   "https://www.booking.com/searchresults.html?ss=Montalcino%2C+Italy&checkin=2026-10-13&checkout=2026-10-17&group_adults=2&no_rooms=1&group_children=0",
  argentario:  "https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-04&checkout=2026-10-08&group_adults=2&no_rooms=1&group_children=0"
};
```

2. Reorder `bases` to florence → argentario → cretesenesi → valdorcia → florence2 → home, renumbering pins 1–5 in that order. Keep each base's existing `key`, `color`, `coord`, `book` (florence2's `book` becomes `[]`), and highlights, EXCEPT the highlight moves/note edits in point 3.

3. Highlight edits while reordering:
   - MOVE `Abbazia di San Galgano` and `Bagni di Petriolo` from `valdorcia.highlights` to `cretesenesi.highlights`; note suffix becomes "— on the Day-6 drive up from the coast".
   - `San Gimignano` (cretesenesi): note → `"the towers — Day-10 day-trip (~1 h 15)"`.
   - argentario: `Castiglione della Pescaia` note → `"medieval seaside town (Day-2 coast drive down)"`; `Bolgheri` note → `"cypress avenue + Super Tuscan wine (Day-2 coast drive down)"`; `Golfo di Baratti` note → `"Etruscan bay + Populonia (Day-2 coast drive down)"`.

4. `legMode` → `{ 2: "car", 6: "car", 11: "car", 15: "car" }` (Day 15's `>>` leg is the drive; Day 16 has no `>>` line).

5. FOOD comment `— Maremma & Etruscan coast (the drive home) —` → `— Maremma & Etruscan coast (the Day-2 drive down) —`.

- [ ] **Step 3: Verify sync**

Run: `node assets/sync.js italy`
Expected: prints the italy build lines without error (base count 6 matches; Florence day-visit parses as `0 nights`). The PostToolUse hook may have already run it — still run once explicitly and read the output.

- [ ] **Step 4: Commit**

```bash
git add trips/italy/itinerary.md trips/italy/meta.js trips/italy/trip.js italy.html index.html
git commit -m "Reverse the Italy trip: beach first, Florence shopping finale, dawn flight"
```

### Task 2: Regenerate route geometry

**Files:**
- Modify: `trips/italy/routes.py:11-15` (coords + legs)
- Generated: `trips/italy/routes.js`

**Interfaces:**
- Consumes: the new base order from Task 1.
- Produces: `window.ROUTES` legs in the reversed travel order.

- [ ] **Step 1: Rewrite the coord/leg lines in `routes.py`** — replace lines 11–15 with:

```python
MXP=(8.723,45.630);MIL=(9.204,45.487);FLO=(11.248,43.776)
CRE=(11.5606,43.2340);MON=(11.4506,43.0272);PE=(11.2064,42.3924);BOL=(10.6018,43.2287)
CDP=(10.8760,42.7620)                        # Castiglione della Pescaia (Day-2 coast stop)
SG=(11.1553,43.1494);PET=(11.2995,43.0803)   # San Galgano, Bagni di Petriolo (Day-6 interior stops)
legs=[("train",MXP,MIL),("train",MIL,FLO),
 ("car",FLO,BOL),("car",BOL,CDP),("car",CDP,PE),
 ("car",PE,PET),("car",PET,SG),("car",SG,CRE),
 ("car",CRE,MON),("car",MON,FLO),
 ("train",FLO,MIL),("train",MIL,MXP)]
```

- [ ] **Step 2: Regenerate + re-sync**

Run: `python3 trips/italy/routes.py && node assets/sync.js`
Expected: 12 `leg N mode: … OSRM` lines (a `STRAIGHT` fallback means OSRM timed out — re-run), `wrote …routes.js`, then sync prints all trips without error.

- [ ] **Step 3: Commit**

```bash
git add trips/italy/routes.py trips/italy/routes.js trips/italy/trip.js italy.html index.html
git commit -m "Regenerate Italy route geometry for the reversed order"
```
