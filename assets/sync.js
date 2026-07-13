#!/usr/bin/env node
/* =============================================================================
   SYNC HARNESS (multi-trip) — trips/<slug>/itinerary.md ➜ trips/<slug>/trip.js

   Each trip lives in trips/<slug>/ with:
     itinerary.md   the human-edited plan (source of truth for CONTENT)
     meta.js        map-only metadata (coords, colours, pins, highlights,
                    booking links, POI layers, per-leg travel modes)
     trip.js        GENERATED — window.TRIP for that trip's page (<slug>.html)
     routes.js      GENERATED route geometry (see routes.py)

   This script parses every trip's doc, merges its meta.js, and writes trip.js.
   It also rewrites the ?v=<hash> cache-buster on each trip page's asset URLs,
   and regenerates the root index.html, which redirects to the nearest-by-date
   trip.

   Run manually:  node assets/sync.js            (build every trip)
                  node assets/sync.js westfjords  (build one trip)
   Runs automatically via the PostToolUse hook when an itinerary.md or meta.js
   is edited.
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const TRIPS_DIR = path.join(ROOT, "trips");
// shared engine assets — a change here re-busts every trip's cache
const SHARED_ASSETS = ["assets/app.js", "assets/style.css"];

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8,
                 oct:9, nov:10, dec:11 };

/* ---- banner (base header) ------------------------------------------------ */
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

/* ---- ISO start date from the "N nights" header line ---------------------- */
function parseStartDate(line) {
  if (!line) return null;
  const ym = line.match(/\b(20\d{2})\b/);
  const dm = line.match(/(\d{1,2})\s+([A-Za-z]{3,9})/);
  if (!ym || !dm) return null;
  const mi = MONTHS[dm[2].slice(0, 3).toLowerCase()];
  if (mi == null) return null;
  const day = String(+dm[1]).padStart(2, "0");
  return `${ym[1]}-${String(mi + 1).padStart(2, "0")}-${day}`;
}

/* ---- parse one itinerary.md --------------------------------------------- */
function parseMd(text) {
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, 8);
  const meta = {
    title: (lines[0] || "").trim(),
    dates: (head.find(l => /\d+\s+nights?/.test(l)) || "").trim(),
    route: (head.find(l => /^Route:/.test(l.trim())) || "").replace(/^\s*Route:\s*/, "").trim(),
    flyOut: "", flyBack: ""
  };
  meta.start = parseStartDate(meta.dates);
  const fly = head.find(l => /^Fly:/.test(l.trim()));
  if (fly) {
    fly.replace(/^\s*Fly:\s*/, "").split(" · ").forEach(seg => {
      if (/\(out\)/.test(seg))  meta.flyOut  = seg.replace(/\s*\(out\)\s*/, "").trim();
      if (/\(back\)/.test(seg)) meta.flyBack = seg.replace(/\s*\(back\)\s*/, "").trim();
    });
  }

  const bases = [];
  let cur = null, day = null, prevBar = false, curItems = null;
  const dayRe = /^DAY\s+(\d+)\s+·\s+(.+?)\s+—\s+(.+)$/;
  const flushDay = () => { if (cur && day) { cur.days.push(day); day = null; curItems = null; } };

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
      day = { d: +dm[1], date: dm[2].trim(), title, arrive, items: [], weather: null, leg: null, variants: [] };
      curItems = day.items;            // items go to the shared list until a "~" variant opens
      continue;
    }
    if (day && /^\s+\S/.test(ln)) {      // indented -> belongs to current day
      if (/^\s*>>\s+/.test(ln))       { day.leg = { text: ln.replace(/^\s*>>\s+/, "").trim() }; }
      else if (/^\s*=\s+/.test(ln))   { day.weather = ln.replace(/^\s*=\s+/, "").trim(); }
      else if (/^\s*~\s+/.test(ln))   {                       // "~ Label · note" -> new variant
        const body = ln.replace(/^\s*~\s+/, "").trim();
        const sep = body.search(/\s+[·—]\s+/);
        const label = sep >= 0 ? body.slice(0, sep).trim() : body;
        const note = sep >= 0 ? body.slice(sep).replace(/^\s*[·—]\s+/, "").trim() : "";
        const v = { label, note, items: [] };
        day.variants.push(v);
        curItems = v.items;
      }
      else if (/^\s*-\s+/.test(ln))   { curItems.push(ln.replace(/^\s*-\s+/, "").trim()); }
      else if (curItems && curItems.length) { curItems[curItems.length - 1] += " " + t; }
      continue;
    }
    if (t !== "") flushDay();            // any column-0 prose ends the day
  }
  flushDay(); if (cur) bases.push(cur);
  return { meta, bases };
}

/* ---- merge doc content + meta.js → TRIP for one trip -------------------- */
function buildTrip(slug) {
  const dir = path.join(TRIPS_DIR, slug);
  const mdPath = path.join(dir, "itinerary.md");
  const metaPath = path.join(dir, "meta.js");
  const outPath = path.join(dir, "trip.js");

  const md = fs.readFileSync(mdPath, "utf8");
  const { meta, bases } = parseMd(md);
  delete require.cache[require.resolve(metaPath)];
  const M = require(metaPath);
  const MB = M.bases || [];
  const legMode = M.legMode || {};

  if (bases.length !== MB.length) {
    throw new Error(`[${slug}] base count mismatch: doc has ${bases.length} ` +
      `(${bases.map(b => b.name).join(", ")}), meta.js has ${MB.length} ` +
      `(${MB.map(m => m.key).join(", ")}). Add/remove the matching entry in trips/${slug}/meta.js.`);
  }

  const outBases = bases.map((b, i) => {
    const m = MB[i];
    return {
      key: m.key, pin: m.pin, emoji: b.emoji, name: m.name,
      stay: b.stay, nights: b.nights, dates: b.dates,
      color: m.color, coord: m.coord, carFree: b.carFree,
      book: m.book, highlights: m.highlights,
      days: b.days.map(d => {
        const day = { d: d.d, date: d.date, title: d.title };
        if (d.arrive) day.arrive = true;
        if (d.weather) day.weather = d.weather;
        day.items = d.items;
        if (d.variants && d.variants.length) day.variants = d.variants;
        if (d.leg) day.leg = { mode: legMode[d.d] || "train", text: d.leg.text };
        return day;
      })
    };
  });

  const TRIP = {
    meta,
    map: M.map || {},
    hubs: M.hubs || [],
    waypoints: M.waypoints || [],
    bases: outBases,
    layers: M.layers || []
  };
  const banner = "// AUTO-GENERATED from itinerary.md by assets/sync.js — DO NOT EDIT BY HAND.\n" +
                 "// Edit the trip in trips/" + slug + "/itinerary.md; map-only metadata lives in trips/" + slug + "/meta.js.\n";
  fs.writeFileSync(outPath, banner + "window.TRIP = " + JSON.stringify(TRIP, null, 2) + ";\n");

  const days = outBases.reduce((n, b) => n + b.days.length, 0);
  const page = (M.map && M.map.page) || (slug + ".html");
  return { slug, page, title: meta.title, start: meta.start, nBases: outBases.length, nDays: days };
}

/* ---- cache-bust a trip's page ------------------------------------------- */
function cacheBust(info) {
  const idxPath = path.join(ROOT, info.page);
  if (!fs.existsSync(idxPath)) return null;
  const assetFiles = SHARED_ASSETS.concat([
    `trips/${info.slug}/trip.js`, `trips/${info.slug}/routes.js`
  ]);
  const hashInput = assetFiles.map(f => {
    try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return ""; }
  }).join("");
  const ver = crypto.createHash("md5").update(hashInput).digest("hex").slice(0, 8);
  const re = new RegExp(
    "(\\.\\/(?:assets\\/(?:app\\.js|style\\.css)|trips\\/" + info.slug + "\\/(?:trip\\.js|routes\\.js)))(?:\\?v=[^\"']*)?",
    "g");
  const idx = fs.readFileSync(idxPath, "utf8").replace(re, `$1?v=${ver}`);
  fs.writeFileSync(idxPath, idx);
  return ver;
}

/* ---- root index.html: redirect to the nearest-by-date trip -------------- */
function writeIndex(infos) {
  const manifest = infos.map(i => ({ slug: i.slug, title: i.title, page: i.page, start: i.start }));
  const links = manifest.map(t =>
    `      <li><a href="${t.page}">${(t.title || t.slug).replace(/</g, "&lt;")}</a>` +
    (t.start ? ` <span class="d">${t.start}</span>` : "") + `</li>`).join("\n");
  const html =
`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Trips</title>
<meta name="robots" content="noindex" />
<style>
  body{font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;
       min-height:100vh;display:grid;place-items:center;background:#f4f1ec;color:#3a352f}
  .box{text-align:center;padding:2rem}
  h1{font-weight:600;margin:0 0 .5rem}
  ul{list-style:none;padding:0;margin:1rem 0 0}
  li{margin:.4rem 0}
  a{color:#8e3b46;text-decoration:none;font-weight:600}
  a:hover{text-decoration:underline}
  .d{color:#9a9186;font-weight:400;font-size:.85em;margin-left:.4rem}
</style>
</head>
<body>
  <div class="box">
    <h1>Trips</h1>
    <p>Taking you to the nearest trip…</p>
    <ul>
${links}
    </ul>
  </div>
<script>
  var TRIPS = ${JSON.stringify(manifest)};
  (function () {
    var now = Date.now(), best = null, bestScore = Infinity;
    TRIPS.forEach(function (t) {
      if (!t.start) return;
      var d = new Date(t.start + "T00:00:00").getTime();
      var diff = d - now;
      var score = diff >= 0 ? diff : (-diff + 1e13); // prefer soonest upcoming, else most recent past
      if (score < bestScore) { bestScore = score; best = t; }
    });
    if (!best && TRIPS.length) best = TRIPS[0];
    if (best) location.replace(best.page);
  })();
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
}

/* ---- driver -------------------------------------------------------------- */
function discoverTrips() {
  if (!fs.existsSync(TRIPS_DIR)) return [];
  return fs.readdirSync(TRIPS_DIR).filter(slug => {
    const d = path.join(TRIPS_DIR, slug);
    return fs.statSync(d).isDirectory() &&
      fs.existsSync(path.join(d, "itinerary.md")) &&
      fs.existsSync(path.join(d, "meta.js"));
  });
}

function main() {
  const only = process.argv[2];
  let slugs = discoverTrips();
  if (only) {
    if (!slugs.includes(only)) throw new Error(`no such trip: trips/${only}/ (need itinerary.md + meta.js)`);
    slugs = [only];
  }
  if (!slugs.length) { console.log("sync.js: no trips found under trips/"); return; }

  const infos = [];
  const out = [];
  for (const slug of slugs) {
    const info = buildTrip(slug);
    const ver = cacheBust(info);
    infos.push(info);
    out.push(`  ${slug}: ${info.nBases} bases, ${info.nDays} days → trips/${slug}/trip.js ` +
      `(${info.page}${ver ? " ?v=" + ver : " — page missing"})`);
  }
  // rebuild the index over ALL trips (even when only one was rebuilt)
  writeIndex(only ? discoverTrips().map(s => {
    // for the index we need start/title/page of every trip; rebuild lightly
    try { return buildTripInfoOnly(s); } catch (e) { return null; }
  }).filter(Boolean) : infos);

  console.log(`synced ${slugs.length} trip(s):\n` + out.join("\n"));
}

// lightweight info (title/start/page) without rewriting trip.js — for the index
function buildTripInfoOnly(slug) {
  const md = fs.readFileSync(path.join(TRIPS_DIR, slug, "itinerary.md"), "utf8");
  const { meta } = parseMd(md);
  const metaPath = path.join(TRIPS_DIR, slug, "meta.js");
  delete require.cache[require.resolve(metaPath)];
  const M = require(metaPath);
  return { slug, page: (M.map && M.map.page) || (slug + ".html"), title: meta.title, start: meta.start };
}

try {
  main();
} catch (e) {
  console.error("sync.js: " + e.message);
  process.exit(1);
}
