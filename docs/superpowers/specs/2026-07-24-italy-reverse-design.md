# Italy trip — reversed itinerary design

Date: 2026-07-24 · Status: approved in conversation

## Goal

Reverse the Italy trip (3–18 Oct 2026): beach first with the longest drive on
the first driving day, then gradually back north; last day is shopping in
Florence with a 07:00 flight from Malpensa the next morning — **no final hotel
night**.

## New structure (14 hotel nights)

| Base | Nights | Dates |
|---|---|---|
| 📍 Florence (arrival) | 1 | Sat 3 Oct |
| 🏖️ Argentario / Maremma | 4 | Sun 4 – Thu 8 Oct |
| 🌾 Crete Senesi farmhouse | 5 | Thu 8 – Tue 13 Oct |
| 🍷 Val d'Orcia · Podere Brizio | 4 | Tue 13 – Sat 17 Oct |
| 🛍️ Florence (day visit, no hotel) | 0 | Sat 17 Oct |

## Day-by-day

- **Day 1 · Sat 3** — unchanged: KEF→MXP, train Milan → Florence, arrival night.
- **Day 2 · Sun 4** — pick up car at Firenze SMN; longest drive **down the
  coast** via Bolgheri (cypress avenue, Super Tuscan stop) + Castiglione della
  Pescaia → Porto Ercole (~3 h 15 + stops). The old Day-15 coast road, reversed.
- **Days 3–5** — beach: Feniglia + Giardino dei Tarocchi (open until 15 Oct —
  comfortably inside the window now), Parco della Maremma, boat/coves/lagoon.
- **Day 6 · Thu 8** — Argentario → Crete Senesi via Bagni di Petriolo + San
  Galgano (old Day-11 interior leg, reversed).
- **Days 7–10** — Crete: Monte Oliveto + Asciano · Siena · truffle villages +
  Buonconvento · **new 5th-night day: San Gimignano day-trip** (no longer on
  any drive route).
- **Day 11 · Tue 13** — ~40 min south to Podere Brizio; settle, Brunello tasting.
- **Days 12–14** — Pienza + Bagno Vignoni · Montepulciano · Fri 16 = Montalcino
  Friday market + Sant'Antimo + Bagni San Filippo + estate pool morning.
  (The dedicated do-nothing estate day is the trimmed day of the trip.)
- **Day 15 · Sat 17** — morning drive to Florence (~1 h 50), **drop the car in
  Florence (round-trip, no one-way fee)**, shopping day; evening Frecciarossa →
  Milano Centrale (~20:30–21:30), late Malpensa Express / night bus to MXP.
  No hotel — overnight at the terminal.
- **Day 16 · Sun 18** — 07:00 MXP → KEF.

## Decisions taken

- Return flight: 07:00 from **MXP** (replaces the Wizz 16:00 assumption).
- Car: **Florence round-trip** (pick up Day 2 at Firenze SMN, drop Day 15 in
  Florence). Florence → MXP covered by evening train + late airport connection.
- Nights split fixed by the user: 1 / 4 / 5 / 4 / 0.
- Order beach → Crete → Val d'Orcia accepted (the Crete→Montalcino backtrack is
  ~35 km, negligible).

## Files to change

1. **`trips/italy/itinerary.md`** — full rewrite: day order, dates, banners,
   header, notes (drop the Tarocchi-urgency note, add last-night logistics),
   booking checklist with new dates.
2. **`trips/italy/meta.js`** — reorder `bases` (florence → argentario →
   cretesenesi → valdorcia → florence2) to keep doc-order matching; update
   booking-link dates; update highlight notes that reference day numbers
   (San Galgano / Petriolo are now on the Day-6 drive); fix `legMode`
   (2 car, 6 car, 11 car, 15 car — Day 15's `>>` leg is the morning drive to
   Florence; the evening train to Milan is a bullet, not the leg).
3. **`trips/italy/routes.py`** — rewrite legs in the new direction/order,
   re-run OSRM → `routes.js`.
4. **`node assets/sync.js`** — rebuild. Open risk: the final Florence is a
   0-night day visit — verify how sync parses that banner and adapt (worst
   case fold it into the HOME section).

## Error handling / verification

- Trust `sync.js` output per project conventions (no page screenshots).
- Counts of doc bases vs `meta.js` bases must match or sync errors — that is
  the built-in check.
- Re-run `sync.js` after regenerating `routes.js` so the cache-buster hash
  covers it.
