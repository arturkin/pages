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
  { name: "Malpensa (MXP)",  coord: [45.630, 8.723], note: "arrive Day 1 · depart Day 16" },
  { name: "Milano Centrale", coord: [45.487, 9.204], note: "train hub" }
];
const WAYPOINTS = [
  { name: "La Spezia", coord: [44.107, 9.828], note: "drop rental car (Day 12)" }
];
const AIRBNB = {
  valdorcia:  "https://www.airbnb.com/s/Montalcino--Tuscany--Italy/homes?checkin=2026-10-04&checkout=2026-10-10&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7",
  argentario: "https://www.airbnb.com/s/Monte-Argentario--Tuscany--Italy/homes?checkin=2026-10-10&checkout=2026-10-14&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7",
  cinqueterre:"https://www.airbnb.com/s/Monterosso-al-Mare--Italy/homes?checkin=2026-10-14&checkout=2026-10-16&adults=2",
  santamargherita:"https://www.airbnb.com/s/Santa-Margherita-Ligure--Italy/homes?checkin=2026-10-16&checkout=2026-10-18&adults=2"
};
const BOOKING = {
  florence:   "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0",
  valdorcia:  "https://www.booking.com/searchresults.html?ss=Montalcino%2C+Italy&checkin=2026-10-04&checkout=2026-10-10&group_adults=2&no_rooms=1&group_children=0",
  argentario: "https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-10&checkout=2026-10-14&group_adults=2&no_rooms=1&group_children=0",
  cinqueterre:"https://www.booking.com/searchresults.html?ss=Monterosso+al+Mare%2C+Italy&checkin=2026-10-14&checkout=2026-10-16&group_adults=2&no_rooms=1&group_children=0",
  santamargherita:"https://www.booking.com/searchresults.html?ss=Santa+Margherita+Ligure%2C+Italy&checkin=2026-10-16&checkout=2026-10-18&group_adults=2&no_rooms=1&group_children=0"
};
const META = [
  { key: "florence", name: "Florence", color: "#5b6b8c", pin: 1, coord: [43.776, 11.248],
    book: [{ site: "booking", url: BOOKING.florence }], highlights: [] },
  { key: "valdorcia", name: "Val d'Orcia", color: "#8e3b46", pin: 2, coord: [43.057, 11.489],
    book: [{ site: "airbnb", url: AIRBNB.valdorcia }, { site: "booking", url: BOOKING.valdorcia }],
    highlights: [
      { name: "Pienza", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city'" },
      { name: "Montepulciano", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town" },
      { name: "Bagno Vignoni", coord: [43.0280, 11.6170], note: "thermal square + free pools" },
      { name: "Abbey of Sant'Antimo", coord: [43.0170, 11.5120], note: "Romanesque abbey" }
    ] },
  { key: "argentario", name: "Argentario / Maremma", color: "#2f8f8a", pin: 3, coord: [42.393, 11.207],
    book: [{ site: "airbnb", url: AIRBNB.argentario }, { site: "booking", url: BOOKING.argentario }],
    highlights: [
      { name: "Spiaggia della Feniglia", coord: [42.409, 11.190], note: "pine-backed sandy beach" },
      { name: "Orbetello lagoon", coord: [42.441, 11.216], note: "WWF reserve, flamingos" },
      { name: "Isola del Giglio", coord: [42.363, 10.901], note: "ferry day-trip" }
    ] },
  { key: "cinqueterre", name: "Cinque Terre", color: "#d2683f", pin: 4, coord: [44.146, 9.654],
    book: [{ site: "airbnb", url: AIRBNB.cinqueterre }, { site: "booking", url: BOOKING.cinqueterre }],
    highlights: [
      { name: "Vernazza", coord: [44.135, 9.684], note: "harbour + castle" },
      { name: "Manarola", coord: [44.107, 9.729], note: "sunset icon" },
      { name: "Portovenere", coord: [44.048, 9.837], note: "boat trip, just south" }
    ] },
  { key: "santamargherita", name: "Santa Margherita Ligure", color: "#2b5f8c", pin: 5, coord: [44.335, 9.210],
    book: [{ site: "airbnb", url: AIRBNB.santamargherita }, { site: "booking", url: BOOKING.santamargherita }],
    highlights: [
      { name: "Portofino", coord: [44.303, 9.210], note: "piazzetta, Castello Brown, lighthouse" },
      { name: "San Fruttuoso", coord: [44.318, 9.174], note: "abbey in a hidden cove" },
      { name: "Camogli", coord: [44.349, 9.155], note: "quiet fishing village" }
    ] },
  { key: "home", name: "Home", color: "#9a9186", pin: "✈", coord: null, book: [], highlights: [] }
];
// travel-mode for each transfer day (doc's ">>" line gives the text, not the mode)
const LEG_MODE = { 2: "car", 8: "car", 12: "car", 14: "train", 16: "train" };

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
