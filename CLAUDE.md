# Italy itinerary — project guide

A two-week Italy trip (3–18 Oct 2026) as **a planning doc + a GitHub Pages map app**,
kept in sync automatically.

## How this itinerary is built

**Source of truth: [itinerary.md](itinerary.md).** You edit the plan there — bases,
days, activities, dates, hotels, nights. It's grouped by where you sleep, with a
banner per base and a `DAY N · date — title` block + bullet activities under each.

**The web app renders from data, not from the doc.** The map needs things the doc
doesn't carry (coordinates, colours, map pins, highlight markers, booking links,
travel-mode per leg). So the pipeline is:

```
itinerary.md  ──(assets/sync.js)──▶  assets/trip.js  ──▶  index.html (map + day cards)
     ▲                                     ▲
 you edit this                    map-only metadata merged in
                                  from META in assets/sync.js
```

### The sync harness
- **[assets/sync.js](assets/sync.js)** parses `itinerary.md` and writes `assets/trip.js`
  (`window.TRIP`). Trip **content** comes from the doc; **map-only metadata**
  (coords, colours, pins, highlights, booking URLs, leg modes) lives in the `META`
  block at the top of `sync.js`. Bases are matched to `META` **by order**.
- **[assets/sync-hook.sh](assets/sync-hook.sh)** + a `PostToolUse` hook in
  [.claude/settings.json](.claude/settings.json) run `sync.js` automatically whenever
  `itinerary.md` is edited. (After changing the hook config you must open `/hooks`
  once or restart so Claude Code reloads it.)
- Run it by hand anytime: `node assets/sync.js`

### What to edit where
| Want to change… | Edit |
|---|---|
| Days, activities, dates, hotel names, nights, car-free flag | `itinerary.md` |
| A coordinate, colour, map pin, highlight marker, booking link, leg mode | `META` in `assets/sync.js` |
| Add/remove a whole base (stop) | banner + days in `itinerary.md` **and** a `META` entry in `sync.js` (counts must match, or sync errors) |
| Map rendering / styling | `assets/app.js` / `assets/style.css` |
| Driving/train route geometry | `assets/routes.js` — regenerate with `python3 assets/fetchroutes.py` (OSRM) |

### Photo galleries — every place must be browsable
The app shows an in-page **photo gallery modal** (📷) for every town and attraction:
on the base bands, on the map pins/★ popups, and on any place name that appears in a
day bullet. Photos are fetched live from **two sources merged** (no API key,
neighbours preloaded, each source's own thumbnail URL used for grid + lightbox):
- **Openverse** — searched by place *name* (aggregates Flickr, museums, Wikimedia);
  gives scenic, relevant shots. This is the primary source.
- **Wikimedia Commons** — geosearch by the place's *coordinate*; on-location shots.

Never rewrite a Commons thumbnail URL to a different width — unrendered sizes 400.

**Requirement: any new place you add MUST carry a coordinate so it gets a gallery.**
- **New base (stop):** its `META` entry needs `coord: [lat, lon]` (same coord that
  places its map pin).
- **New attraction:** add it to that base's `highlights: [{ name, coord, note }]` in
  `META` — the name then also auto-links wherever it appears in the day text.
- The 📷 trigger itself (band chip, map pin/★ popup, linkified day-text name) only
  appears for places that have a coordinate — so a coordinate-less place gets no
  gallery entry point at all. Don't ship one without coords.

No `assets/app.js` change is needed to make a new place browsable — the gallery is
driven entirely by the name + coordinate in `META`.

## The web app (GitHub Pages)
Served from the **repo root** (Pages → main branch → `/`). Self-contained except
Leaflet (CDN) + OpenStreetMap tiles (need internet).
- `index.html` — thin shell
- `assets/trip.js` — **generated** trip data (do not hand-edit)
- `assets/routes.js` — generated route geometry (OSRM)
- `assets/app.js` — renders map + day cards from `TRIP`/`ROUTES`
- `assets/style.css` — styling

Preview locally: `python3 -m http.server` then open `http://localhost:8000`
(or just open `index.html`).

## Conventions
- **Commit directly to `main`** — no feature branches for this project.
- **Don't launch/screenshot the page to verify.** After editing, just run `node assets/sync.js`
  (or let the hook run it) and confirm it prints without error. No need to start a server or
  open the page in a browser — trust the sync output.
- `.claude/skills/airbnb-search/` is a bundled 3rd-party skill (MIT) used to search stays.

## Original brief
> Build an itinerary for a 2-week vacation in Italy, starting from Milan. A couple,
> not interested in cities — Milan is just a hub to rent a car and get out to Umbria
> or Tuscany. Stay in 2–3 places, from 3 October. Want a chic vineyard hotel and
> other chill places, with farmers markets, nature, and top sights within reach.
> Happy to stay on/near a beach for a few days. Must return through Milan to Reykjavik.
