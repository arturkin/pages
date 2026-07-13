# Trips — project guide

A collection of trip itineraries, each as **a planning doc + a GitHub Pages map app**,
kept in sync automatically. One shared rendering engine drives every trip.

Currently: **westfjords** (Iceland, 15–19 Jul 2026) and **italy** (3–18 Oct 2026).

## Layout

```
/
├── index.html            GENERATED — redirects to the nearest-by-date trip (sync.js owns it)
├── <slug>.html           one thin page shell per trip (e.g. italy.html, westfjords.html)
├── assets/               SHARED engine — trip-agnostic, touched rarely
│   ├── app.js            renders header + day cards + Leaflet map from window.TRIP / window.ROUTES
│   ├── style.css         styling
│   └── sync.js           the generic build: discovers trips/*, merges each, writes trip.js + index.html
└── trips/
    └── <slug>/
        ├── itinerary.md  SOURCE OF TRUTH for content (you edit this)
        ├── meta.js       map-only metadata (coords, colours, pins, highlights, layers, leg modes)
        ├── trip.js       GENERATED window.TRIP (do not hand-edit)
        ├── routes.js     GENERATED route geometry (OSRM)
        └── routes.py     per-trip OSRM leg definitions → routes.js
```

## How a trip is built

**Content lives in `itinerary.md`; map-only data lives in `meta.js`.** The doc doesn't
carry coordinates, colours, pins, booking links, POI layers or per-leg travel modes,
so those are merged in from `meta.js`. Per trip:

```
trips/<slug>/itinerary.md ─┐
                           ├─(assets/sync.js)─▶ trips/<slug>/trip.js ─▶ <slug>.html (map + day cards)
trips/<slug>/meta.js ──────┘
```

`bases` in `meta.js` are matched to the doc's bases **by order** (counts must match or sync errors).

### itinerary.md format
- Header (first ~8 lines): title (line 1), a `… N nights` line (the **start date** is parsed
  from it — needs a `D Mon … YYYY`), an optional `Route:` line, an optional `Fly:` line
  (`… (out) · … (back)`; omit for a domestic trip — the header hides the flight row).
- Each base: a `━━━` rule then a banner line `emoji Name · Stay · N nights · dates`.
- Each day: `DAY N · date — title` (append ` ›› arrive & check in` to flag a check-in day),
  then indented lines:
  - `- item` — a bullet (shared across all weather variants)
  - `>> text` — the transfer leg (travel mode comes from `meta.js` `legMode[day]`)
  - `= text` — a one-line **weather** summary (rendered as a badge)
  - `~ Label · note` — starts a **weather variant**; bullets after it belong to that variant
    until the next `~`. The app shows the variants as toggle chips (☀️ Fair / ☁️ Grey /
    🌧️ Wet — matched on the label). A day with no `~` renders as a single plan.

### meta.js exports
`{ map, hubs, waypoints, bases, layers, legMode }`
- `map`: `{ page?, photoRegion?, legend?: { car, train, hub, sleep, sleepColor, hubColor } }`
  — `page` defaults to `<slug>.html`; `photoRegion` is appended to image searches;
  `legend` overrides the legend labels.
- `bases[]`: `{ key, name, color, pin, coord:[lat,lon], book:[{site,url}], highlights:[{name,type,coord,note}] }`
- `layers[]`: toggleable POI layers — `{ key, label, icon, on?, photos?, cats?, points:[{name,coord,note,cat?,rating?,url?}] }`.
  `on:true` shows the layer by default; `photos:false` suppresses the 📷 gallery (e.g. EV chargers);
  `cats` gives per-category icons/labels (like Italy's food layer).
- `legMode`: `{ dayNumber: "car" | "train" }` for the `>>` legs.

### The sync harness
- **`assets/sync.js`** builds every `trips/*/` that has both `itinerary.md` + `meta.js`.
  Run all: `node assets/sync.js` · one trip: `node assets/sync.js <slug>`. It writes each
  `trip.js`, rewrites the `?v=<hash>` cache-buster on that trip's `<slug>.html`
  (md5 of its trip.js + routes.js + the shared app.js + style.css — so an engine edit
  re-busts every trip), and regenerates root **`index.html`**, which redirects to the trip
  whose start date is nearest today (soonest upcoming, else most recent past).
  If you regenerate a `routes.js`, run `node assets/sync.js` again so the hash covers it.
- **`assets/sync-hook.sh`** + a `PostToolUse` hook in `.claude/settings.json` run `sync.js`
  automatically whenever any `itinerary.md` or `meta.js` is edited. (After changing the hook
  config, open `/hooks` once or restart so Claude Code reloads it.)

### What to edit where
| Want to change… | Edit |
|---|---|
| Days, activities, dates, hotel names, nights, weather text, weather variants | `trips/<slug>/itinerary.md` |
| A coordinate, colour, map pin, highlight, booking link, POI layer, leg mode, legend label | `trips/<slug>/meta.js` |
| Add/remove a base (stop) | banner + days in `itinerary.md` **and** a `bases` entry in `meta.js` (counts must match) |
| Map rendering / styling (all trips) | `assets/app.js` / `assets/style.css` |
| Route geometry / per-day driving | `trips/<slug>/routes.py` → `python3 trips/<slug>/routes.py`, then `node assets/sync.js` |

### Route geometry (`routes.py` → `routes.js`)
Each leg is `{ mode, coords, day?, km? }`. If legs carry a `day`, the app groups them
into **per-day driving routes** — one coloured, toggleable layer per day in the legend
(all on by default), each labelled with its OSRM road distance (`km`). Without `day`
tags the whole route draws as one line (Italy). To split a trip's driving by day, tag
each leg with its day number in `routes.py` (see `trips/westfjords/routes.py`); `km`
comes straight from the OSRM response. Loop/day-trip legs (not just base-to-base) can be
included so a day's real driving shows on the map.

The photo modal also offers **🗺️ Maps / 🚗 Waze** navigation links for any place with a
coordinate — engine-level, so every trip gets them for free.

### Adding a whole new trip
1. `mkdir trips/<slug>`; write `itinerary.md`, `meta.js`, `routes.py` (copy an existing trip as a template).
2. `python3 trips/<slug>/routes.py` to generate `routes.js`.
3. Create `<slug>.html` (copy an existing page shell; retitle; point the two data `<script>`s at `./trips/<slug>/…`).
4. `node assets/sync.js` — builds the trip and auto-adds it to the index.

### Photo galleries — every place must be browsable
The app shows an in-page **photo gallery modal** (📷) for base bands, map pins/★ popups,
POI-layer popups (unless `photos:false`), and any place name that appears in a day bullet.
Photos are fetched live from **two sources merged** (no API key, neighbours preloaded, each
source's own thumbnail URL used for grid + lightbox):
- **Openverse** — searched by place *name* + `map.photoRegion` (Flickr, museums, Wikimedia). Primary.
- **Wikimedia Commons** — geosearch by the place's *coordinate*; on-location shots.

Never rewrite a Commons thumbnail URL to a different width — unrendered sizes 404.

**Any new place MUST carry a `coord: [lat, lon]`** or it gets no map pin and no gallery entry point.
Day-text names auto-link only for bases/highlights/waypoints/hubs (not layer points).
No `assets/app.js` change is needed to make a new place browsable — it's driven by name + coord in `meta.js`.

## Conventions
- **Commit directly to `main`** — no feature branches for this project.
- **Don't launch/screenshot the page to verify.** After editing, run `node assets/sync.js`
  (or let the hook run it) and confirm it prints without error — trust the sync output.
- `.claude/skills/airbnb-search/` is a bundled 3rd-party skill (MIT) used to search stays.

## Original brief (Italy)
> Build an itinerary for a 2-week vacation in Italy, starting from Milan. A couple,
> not interested in cities — Milan is just a hub to rent a car and get out to Umbria
> or Tuscany. Stay in 2–3 places, from 3 October. Want a chic vineyard hotel and
> other chill places, with farmers markets, nature, and top sights within reach.
> Happy to stay on/near a beach for a few days. Must return through Milan to Reykjavik.
