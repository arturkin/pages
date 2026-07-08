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
// Food & wine POIs (>4★, review-verified Oct 2025–26). Toggleable layer in the app.
// cat: winery | wineshop | restaurant | bar
const FOOD = [
  // — Crete Senesi / Siena —
  { name: "Fattoria del Colle", cat: "winery", coord: [43.1816, 11.6547], rating: 4.6, note: "Trequanda · all-women Brunello/Orcia estate, tour + tasting-lunch" },
  { name: "Bindi Sergardi – Tenuta I Colli", cat: "winery", coord: [43.4209, 11.3277], rating: 4.9, note: "Monteriggioni · 23-generation Sangiovese on the Via Francigena, by appt" },
  { name: "Il Barrino – l'Ombelico del Mondo", cat: "restaurant", coord: [43.1577, 11.6536], rating: 4.7, note: "Montisi · warm trattoria, sommelier owner, pici al ragù" },
  { name: "Locanda di Casal Mustia", cat: "restaurant", coord: [43.1409, 11.6646], rating: 4.6, note: "Castelmuzio · ristorante in a tiny medieval hamlet, Chianina + valley views" },
  { name: "Fondo Ristorante", cat: "restaurant", coord: [43.1621, 11.7048], rating: 4.6, note: "Trequanda · refined alfresco dining in a former Templar abbey" },
  { name: "Enoteca I Terzi", cat: "wineshop", coord: [43.3194, 11.3308], rating: 4.4, note: "Siena · enoteca-con-cucina off Piazza del Campo, deep Tuscan list" },
  { name: "Antico Travaglio", cat: "bar", coord: [43.3897, 11.2238], rating: 4.6, note: "Monteriggioni · osteria-bar on the walled square, garden aperitivo" },
  // — Val d'Orcia —
  { name: "Casato Prime Donne", cat: "winery", coord: [43.0882, 11.4643], rating: 4.7, note: "Montalcino · first all-women winery, Brunello tasting in an art-filled cellar" },
  { name: "Ciacci Piccolomini d'Aragona", cat: "winery", coord: [42.9896, 11.5111], rating: 4.6, note: "Castelnuovo dell'Abate · organic Brunello by Sant'Antimo, small tours + terrace" },
  { name: "Salcheto", cat: "winery", coord: [43.0811, 11.7950], rating: 4.4, note: "Montepulciano · off-grid organic Vino Nobile + farm restaurant" },
  { name: "Enoteca Osticcio", cat: "wineshop", coord: [43.0579, 11.4905], rating: 4.3, note: "Montalcino · deep Brunello list + panoramic terrace" },
  { name: "Intralci Wine Bar", cat: "bar", coord: [43.0594, 11.6044], rating: 4.6, note: "San Quirico d'Orcia · tiny natural-wine bar + tapas" },
  { name: "Osteria Acquacheta", cat: "restaurant", coord: [43.0914, 11.7813], rating: 4.8, note: "Montepulciano · legendary bistecca alla fiorentina, shared tables — reserve" },
  { name: "Osteria La Porta", cat: "restaurant", coord: [43.0682, 11.7245], rating: 4.5, note: "Monticchiello · cucina povera + valley-view terrace, book the sunset tables" },
  { name: "Trattoria Toscana al Vecchio Forno", cat: "restaurant", coord: [43.0598, 11.6047], rating: 4.4, note: "San Quirico d'Orcia · pici + steak in a 16th-c. bakery courtyard" },
  // — Maremma & Etruscan coast (the drive home) —
  { name: "Ornellaia", cat: "winery", coord: [43.2118, 10.6119], rating: 4.5, note: "Bolgheri · iconic Super Tuscan, visits by appointment only — book well ahead" },
  { name: "Michele Satta", cat: "winery", coord: [43.2100, 10.6070], rating: 4.6, note: "Castagneto Carducci · walk-in-friendly Bolgheri estate, sea-facing terrace" },
  { name: "Podere Grattamacco", cat: "winery", coord: [43.1864, 10.6279], rating: 4.7, note: "Castagneto Carducci · hilltop tasting room w/ coast views, reserve" },
  { name: "Enoteca Tognoni", cat: "wineshop", coord: [43.2342, 10.6177], rating: 4.4, note: "Bolgheri · village enoteca + wine bar, big Bolgheri red selection" },
  { name: "L'Oste Dispensa", cat: "restaurant", coord: [42.4394, 11.1687], rating: 4.3, note: "Orbetello (Giannella) · Michelin Bib seafood osteria, lagoon views" },
  { name: "Osteria del Mare (già Vòtapentole)", cat: "restaurant", coord: [42.7641, 10.8822], rating: 4.3, note: "Castiglione della Pescaia · lively seafood, cacciucco + raw fish" },
  { name: "Ristorante Il Moletto", cat: "restaurant", coord: [42.4420, 11.1157], rating: 4.3, note: "Porto Santo Stefano · harbourfront seafood institution on the pier" },
  { name: "Bar Il Buco", cat: "bar", coord: [42.4396, 11.1174], rating: 4.5, note: "Porto Santo Stefano · terrace aperitivo over the harbour" },
  // — Florence —
  { name: "Enoteca Pitti Gola e Cantina", cat: "wineshop", coord: [43.7655, 11.2498], rating: 4.7, note: "Oltrarno · small-production Italian wines opposite Pitti Palace" },
  { name: "Le Volpi e l'Uva", cat: "wineshop", coord: [43.7670, 11.2528], rating: 4.6, note: "near Ponte Vecchio · enoteca by the glass, top charcuterie + cheese" },
  { name: "Enoteca Spontanea", cat: "wineshop", coord: [43.7656, 11.2483], rating: 4.9, note: "Oltrarno · new-wave natural-wine bistro, in-house pasta" },
  { name: "Il Santino", cat: "bar", coord: [43.7690, 11.2470], rating: 4.5, note: "Oltrarno · cave-like wine bar + Tuscan small plates (tiny, go early)" },
  { name: "Il Santo Bevitore", cat: "restaurant", coord: [43.7690, 11.2468], rating: 4.4, note: "Oltrarno · refined Tuscan, Michelin-listed — the nicer last-night dinner" },
  { name: "Trattoria Mario", cat: "restaurant", coord: [43.7766, 11.2545], rating: 4.5, note: "San Lorenzo · family-run since 1953, bistecca — lunch only, cash" },
  { name: "Mad – Souls & Spirits", cat: "bar", coord: [43.7699, 11.2431], rating: 4.5, note: "Borgo San Frediano · inventive cocktail bar, laid-back local crowd" }
];
const AIRBNB = {
  cretesenesi: "https://www.airbnb.com/s/Asciano--Tuscany--Italy/homes?checkin=2026-10-04&checkout=2026-10-08&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7",
  argentario:  "https://www.airbnb.com/s/Monte-Argentario--Tuscany--Italy/homes?checkin=2026-10-13&checkout=2026-10-17&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7"
};
const HOTEL = {
  poderebrizio: "https://poderebrizio.it/en/"
};
const BOOKING = {
  florence:    "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0",
  cretesenesi: "https://www.booking.com/searchresults.html?ss=Asciano%2C+Tuscany%2C+Italy&checkin=2026-10-04&checkout=2026-10-08&group_adults=2&no_rooms=1&group_children=0",
  valdorcia:   "https://www.booking.com/searchresults.html?ss=Montalcino%2C+Italy&checkin=2026-10-08&checkout=2026-10-13&group_adults=2&no_rooms=1&group_children=0",
  argentario:  "https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-13&checkout=2026-10-17&group_adults=2&no_rooms=1&group_children=0",
  florence2:   "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-17&checkout=2026-10-18&group_adults=2&no_rooms=1&group_children=0"
};
const META = [
  { key: "florence", name: "Florence", color: "#5b6b8c", pin: 1, coord: [43.776, 11.248],
    book: [{ site: "booking", url: BOOKING.florence }], highlights: [] },
  { key: "cretesenesi", name: "Crete Senesi", color: "#b07a33", pin: 2, coord: [43.2340, 11.5606],
    book: [{ site: "airbnb", url: AIRBNB.cretesenesi }, { site: "booking", url: BOOKING.cretesenesi }],
    highlights: [
      { name: "San Gimignano", type: "town", coord: [43.4677, 11.0431], note: "the towers — stop on the drive in" },
      { name: "Monte Oliveto Maggiore", type: "church", coord: [43.1719, 11.5478], note: "great abbey in a cypress wood" },
      { name: "Siena", type: "town", coord: [43.3188, 11.3308], note: "Piazza del Campo, Duomo — ~35 min" },
      { name: "Buonconvento", type: "town", coord: [43.1381, 11.4817], note: "walled town, good market" },
      { name: "Trequanda", type: "town", coord: [43.1817, 11.6486], note: "quiet Crete hilltop village" },
      { name: "Monteriggioni", type: "town", coord: [43.3906, 11.2231], note: "circular walled castle-village" },
      { name: "Montisi", type: "town", coord: [43.1607, 11.6318], note: "tiny Crete hamlet, medieval feel" },
      { name: "Asciano", type: "town", coord: [43.2340, 11.5606], note: "market town, Museo Cassioli" }
    ] },
  { key: "valdorcia", name: "Val d'Orcia", color: "#8e3b46", pin: 3, coord: [43.0272, 11.4506],
    book: [{ site: "hotel", url: HOTEL.poderebrizio }, { site: "booking", url: BOOKING.valdorcia }],
    highlights: [
      { name: "Montalcino", type: "wine", coord: [43.0570, 11.4890], note: "Brunello town, Fortezza, enoteca" },
      { name: "Pienza", type: "town", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city'" },
      { name: "Montepulciano", type: "wine", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town" },
      { name: "Bagno Vignoni", type: "thermal", coord: [43.0280, 11.6170], note: "thermal square + free pools" },
      { name: "Abbey of Sant'Antimo", type: "church", coord: [43.0170, 11.5120], note: "Romanesque abbey" },
      { name: "Bagni San Filippo", type: "thermal", coord: [42.9260, 11.6180], note: "white travertine hot springs" },
      { name: "San Quirico d'Orcia", type: "town", coord: [43.0592, 11.6039], note: "Horti Leonini gardens, walled town" },
      { name: "Cappella di Vitaleta", type: "church", coord: [43.0668, 11.6355], note: "the iconic cypress-framed chapel" },
      { name: "Monticchiello", type: "town", coord: [43.0699, 11.7007], note: "quiet walled hilltop village" }
    ] },
  { key: "argentario", name: "Argentario / Maremma", color: "#2f8f8a", pin: 4, coord: [42.3924, 11.2064],
    book: [{ site: "airbnb", url: AIRBNB.argentario }, { site: "booking", url: BOOKING.argentario }],
    highlights: [
      { name: "Spiaggia della Feniglia", type: "beach", coord: [42.4080, 11.1850], note: "pine-backed sandy beach + dune reserve" },
      { name: "Parco della Maremma", type: "nature", coord: [42.6558, 11.1053], note: "wild coastal park, trails, cattle" },
      { name: "Orbetello lagoon", type: "nature", coord: [42.4510, 11.2050], note: "WWF reserve, flamingos" },
      { name: "Cala del Gesso", type: "beach", coord: [42.3620, 11.1320], note: "clear-water cove, footpath down" },
      { name: "Giardino dei Tarocchi", type: "art", coord: [42.4028, 11.4308], note: "mosaic sculpture park (closes 15 Oct)" },
      { name: "Castiglione della Pescaia", type: "town", coord: [42.7620, 10.8760], note: "medieval seaside town (coast drive home)" },
      { name: "Bolgheri", type: "wine", coord: [43.2287, 10.6018], note: "cypress avenue + Super Tuscan wine (coast drive home)" },
      { name: "Porto Santo Stefano", type: "town", coord: [42.4356, 11.1178], note: "harbour town, Spanish Fortress views" },
      { name: "Isola del Giglio", type: "beach", coord: [42.3630, 10.9010], note: "island ferry day-trip" },
      { name: "Golfo di Baratti", type: "nature", coord: [42.9959, 10.4980], note: "Etruscan bay + Populonia (coast drive home)" }
    ] },
  { key: "florence2", name: "Florence", color: "#7a6b9c", pin: 5, coord: [43.7696, 11.2558],
    book: [{ site: "booking", url: BOOKING.florence2 }],
    highlights: [
      { name: "Ponte Vecchio", type: "town", coord: [43.7680, 11.2531], note: "goldsmiths' bridge" },
      { name: "Piazzale Michelangelo", type: "town", coord: [43.7629, 11.2650], note: "the classic city view" },
      { name: "Duomo di Firenze", type: "church", coord: [43.7731, 11.2560], note: "Brunelleschi's dome" },
      { name: "Uffizi Gallery", type: "art", coord: [43.7678, 11.2553], note: "Renaissance masterpieces" },
      { name: "San Lorenzo Market", type: "market", coord: [43.7766, 11.2536], note: "leather + the food hall" },
      { name: "Boboli Gardens", type: "nature", coord: [43.7629, 11.2486], note: "Pitti palace gardens" }
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

  const TRIP = { meta, hubs: HUBS, waypoints: WAYPOINTS, bases: outBases, food: FOOD };
  const banner = "// AUTO-GENERATED from itinerary.md by assets/sync.js — DO NOT EDIT BY HAND.\n" +
                 "// Edit the trip in itinerary.md; map-only metadata lives in assets/sync.js.\n";
  fs.writeFileSync(OUT, banner + "window.TRIP = " + JSON.stringify(TRIP, null, 2) + ";\n");

  // Cache-busting: rewrite ?v=… on the asset URLs in index.html to a hash of the
  // generated + logic assets, so browsers and the GitHub Pages CDN always fetch
  // the fresh build instead of a stale cached copy.
  const crypto = require("crypto");
  const assetFiles = ["assets/trip.js", "assets/routes.js", "assets/app.js", "assets/style.css"];
  const hashInput = assetFiles.map(f => {
    try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return ""; }
  }).join("");
  const ver = crypto.createHash("md5").update(hashInput).digest("hex").slice(0, 8);
  const idxPath = path.join(ROOT, "index.html");
  const idx = fs.readFileSync(idxPath, "utf8")
    .replace(/(\.\/assets\/(?:trip\.js|routes\.js|app\.js|style\.css))(?:\?v=[^"']*)?/g, `$1?v=${ver}`);
  fs.writeFileSync(idxPath, idx);

  const days = outBases.reduce((n, b) => n + b.days.length, 0);
  return `${outBases.length} bases, ${days} days → assets/trip.js (assets ?v=${ver})`;
}

try {
  console.log(build());
} catch (e) {
  console.error("sync.js: " + e.message);
  process.exit(1);
}
