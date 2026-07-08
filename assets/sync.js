#!/usr/bin/env node
/* =============================================================================
   SYNC HARNESS — itinerary.md  ➜  assets/trip.js   (source of truth = the .md)

   itinerary.md is the human-edited plan. This script parses it and writes
   assets/trip.js (the data the map app reads). The doc does NOT contain
   map-only data (coordinates, colours, map pins, highlight markers, booking
   links, leg travel-modes), so those live in META below and are merged in.

   Run manually:  node assets/sync.js
   Runs automatically via the PostToolUse hook whenever itinerary.md is edited.

   To change trip CONTENT (days, activities, dates, hotels, nights) → edit
   itinerary.md. To change a coordinate / colour / booking link / add a
   highlight → edit META here. Bases are matched to META by order.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MD = path.join(ROOT, "itinerary.md");
const OUT = path.join(__dirname, "trip.js");

// ---- map-only metadata (NOT in the doc), bases in travel order ----------
const HUBS = [
  { name: "Malpensa (MXP)",  coord: [45.630, 8.723], note: "arrive Day 1 · depart Day 16" }
];
const WAYPOINTS = [];
const AIRBNB = {
  sangimignano: "https://www.airbnb.com/s/San-Gimignano--Tuscany--Italy/homes?checkin=2026-10-04&checkout=2026-10-08&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7",
  argentario:   "https://www.airbnb.com/s/Monte-Argentario--Tuscany--Italy/homes?checkin=2026-10-12&checkout=2026-10-16&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7"
};
const HOTEL = {
  poderebrizio: "https://poderebrizio.it/en/"
};
const BOOKING = {
  florence:    "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0",
  sangimignano:"https://www.booking.com/searchresults.html?ss=San+Gimignano%2C+Italy&checkin=2026-10-04&checkout=2026-10-08&group_adults=2&no_rooms=1&group_children=0",
  valdorcia:   "https://www.booking.com/searchresults.html?ss=Montalcino%2C+Italy&checkin=2026-10-08&checkout=2026-10-13&group_adults=2&no_rooms=1&group_children=0",
  argentario:  "https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-13&checkout=2026-10-17&group_adults=2&no_rooms=1&group_children=0",
  florence2:   "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-17&checkout=2026-10-18&group_adults=2&no_rooms=1&group_children=0"
};
const META = [
  { key: "florence", name: "Florence", color: "#5b6b8c", pin: 1, coord: [43.776, 11.248],
    book: [{ site: "booking", url: BOOKING.florence }], highlights: [] },
  { key: "sangimignano", name: "San Gimignano", color: "#6d8c3f", pin: 2, coord: [43.4677, 11.0431],
    book: [{ site: "airbnb", url: AIRBNB.sangimignano }, { site: "booking", url: BOOKING.sangimignano }],
    highlights: [
      { name: "Volterra", coord: [43.4009, 10.8607], note: "Etruscan walls, alabaster, big views" },
      { name: "Monteriggioni", coord: [43.3906, 11.2231], note: "circular walled castle-village" },
      { name: "Colle di Val d'Elsa", coord: [43.4218, 11.1268], note: "ridge-top Colle Alta, crystal glass" },
      { name: "Castellina in Chianti", coord: [43.4700, 11.2870], note: "Chianti Classico, the Chiantigiana" },
      { name: "Fattoria Poggio Alloro", coord: [43.4622, 11.0083], note: "organic farm, Chianina, tower views" }
    ] },
  { key: "valdorcia", name: "Val d'Orcia", color: "#8e3b46", pin: 3, coord: [43.0272, 11.4506],
    book: [{ site: "hotel", url: HOTEL.poderebrizio }, { site: "booking", url: BOOKING.valdorcia }],
    highlights: [
      { name: "Montalcino", coord: [43.0570, 11.4890], note: "Brunello town, Fortezza, enoteca" },
      { name: "Pienza", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city'" },
      { name: "Montepulciano", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town" },
      { name: "Bagno Vignoni", coord: [43.0280, 11.6170], note: "thermal square + free pools" },
      { name: "Abbey of Sant'Antimo", coord: [43.0170, 11.5120], note: "Romanesque abbey" },
      { name: "Monte Oliveto Maggiore", coord: [43.1719, 11.5478], note: "abbey in the Crete Senesi moonscape" }
    ] },
  { key: "argentario", name: "Argentario / Maremma", color: "#2f8f8a", pin: 4, coord: [42.3924, 11.2064],
    book: [{ site: "airbnb", url: AIRBNB.argentario }, { site: "booking", url: BOOKING.argentario }],
    highlights: [
      { name: "Spiaggia della Feniglia", coord: [42.4080, 11.1850], note: "pine-backed sandy beach + dune reserve" },
      { name: "Parco della Maremma", coord: [42.6558, 11.1053], note: "wild coastal park, trails, cattle" },
      { name: "Orbetello lagoon", coord: [42.4510, 11.2050], note: "WWF reserve, flamingos" },
      { name: "Cala del Gesso", coord: [42.3620, 11.1320], note: "clear-water cove, footpath down" },
      { name: "Giardino dei Tarocchi", coord: [42.4028, 11.4308], note: "mosaic sculpture park (closes 15 Oct)" }
    ] },
  { key: "florence2", name: "Florence", color: "#7a6b9c", pin: 5, coord: [43.7696, 11.2558],
    book: [{ site: "booking", url: BOOKING.florence2 }],
    highlights: [
      { name: "Ponte Vecchio", coord: [43.7680, 11.2531], note: "goldsmiths' bridge" },
      { name: "Piazzale Michelangelo", coord: [43.7629, 11.2650], note: "the classic city view" }
    ] },
  { key: "home", name: "Home", color: "#9a9186", pin: "✈", coord: null, book: [], highlights: [] }
];
// travel-mode for each transfer day (doc's ">>" line gives the text, not the mode)
const LEG_MODE = { 2: "car", 6: "car", 11: "car", 15: "car", 16: "train" };

// ---- parse itinerary.md --------------------------------------------------
function parseBanner(t) {
  const parts = t.split(" · ").map(s => s.trim());
  const head = parts[0];
  const sp = head.indexOf(" ");
  const emoji = head.slice(0, sp);
  const name = head.slice(sp + 1).trim();
  let nights = 0, nightsIdx = -1, carFree = false;
  parts.forEach((p, i) => {
    const m = p.match(/^(\d+)\s+nights?$/);
    if (m) { nights = +m[1]; nightsIdx = i; }
    if (/^CAR-FREE$/i.test(p)) carFree = true;
  });
  let stay = "", dates = "";
  if (nightsIdx >= 0) {
    stay = parts.slice(1, nightsIdx).join(" · ");
    dates = parts[nightsIdx + 1] || "";
  } else {
    dates = parts.slice(1).filter(p => !/^CAR-FREE$/i.test(p)).pop() || "";
  }
  return { emoji, name, stay, nights, carFree, dates };
}

function parseMd(text) {
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, 8);
  const meta = {
    title: (lines[0] || "").trim(),
    dates: (head.find(l => /\d+\s+nights?/.test(l)) || "").trim(),
    route: (head.find(l => /^Route:/.test(l.trim())) || "").replace(/^\s*Route:\s*/, "").trim(),
    flyOut: "", flyBack: ""
  };
  const fly = head.find(l => /^Fly:/.test(l.trim()));
  if (fly) {
    fly.replace(/^\s*Fly:\s*/, "").split(" · ").forEach(seg => {
      if (/\(out\)/.test(seg))  meta.flyOut  = seg.replace(/\s*\(out\)\s*/, "").trim();
      if (/\(back\)/.test(seg)) meta.flyBack = seg.replace(/\s*\(back\)\s*/, "").trim();
    });
  }

  const bases = [];
  let cur = null, day = null, prevBar = false;
  const dayRe = /^DAY\s+(\d+)\s+·\s+(.+?)\s+—\s+(.+)$/;
  const flushDay = () => { if (cur && day) { cur.days.push(day); day = null; } };

  for (const ln of lines) {
    const t = ln.trim();
    if (/^━+$/.test(t)) { prevBar = true; continue; }
    if (prevBar && t !== "") {           // banner content line
      prevBar = false;
      flushDay(); if (cur) bases.push(cur);
      cur = Object.assign(parseBanner(t), { days: [] });
      continue;
    }
    prevBar = false;

    const dm = t.match(dayRe);
    if (dm) {
      flushDay();
      let title = dm[3], arrive = false;
      const am = title.match(/\s*››\s*arrive & check in\s*$/);
      if (am) { arrive = true; title = title.slice(0, am.index).trim(); }
      day = { d: +dm[1], date: dm[2].trim(), title, arrive, items: [], legText: null };
      continue;
    }
    if (day && /^\s+\S/.test(ln)) {      // indented -> belongs to current day
      if (/^\s*-\s+/.test(ln))       day.items.push(ln.replace(/^\s*-\s+/, "").trim());
      else if (/^\s*>>\s+/.test(ln)) day.legText = ln.replace(/^\s*>>\s+/, "").trim();
      else if (day.items.length)     day.items[day.items.length - 1] += " " + t;
      continue;
    }
    if (t !== "") flushDay();            // any column-0 prose ends the day
  }
  flushDay(); if (cur) bases.push(cur);
  return { meta, bases };
}

// ---- merge doc content + metadata → TRIP --------------------------------
function build() {
  const md = fs.readFileSync(MD, "utf8");
  const { meta, bases } = parseMd(md);

  if (bases.length !== META.length) {
    throw new Error(`base count mismatch: doc has ${bases.length} (${bases.map(b => b.name).join(", ")}), ` +
      `META has ${META.length} (${META.map(m => m.key).join(", ")}). ` +
      `If you added/removed a base, add/remove its entry in assets/sync.js META.`);
  }

  const outBases = bases.map((b, i) => {
    const m = META[i];
    return {
      key: m.key, pin: m.pin, emoji: b.emoji, name: m.name,
      stay: b.stay, nights: b.nights, dates: b.dates,
      color: m.color, coord: m.coord, carFree: b.carFree,
      book: m.book, highlights: m.highlights,
      days: b.days.map(d => {
        const day = { d: d.d, date: d.date, title: d.title };
        if (d.arrive) day.arrive = true;
        day.items = d.items;
        if (d.legText) {
          const mode = LEG_MODE[d.d] || "train";
          day.leg = { mode, text: d.legText };
        }
        return day;
      })
    };
  });

  const TRIP = { meta, hubs: HUBS, waypoints: WAYPOINTS, bases: outBases };
  const banner = "// AUTO-GENERATED from itinerary.md by assets/sync.js — DO NOT EDIT BY HAND.\n" +
                 "// Edit the trip in itinerary.md; map-only metadata lives in assets/sync.js.\n";
  fs.writeFileSync(OUT, banner + "window.TRIP = " + JSON.stringify(TRIP, null, 2) + ";\n");

  const days = outBases.reduce((n, b) => n + b.days.length, 0);
  return `${outBases.length} bases, ${days} days → assets/trip.js`;
}

try {
  console.log(build());
} catch (e) {
  console.error("sync.js: " + e.message);
  process.exit(1);
}
