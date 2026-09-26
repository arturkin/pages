/* =============================================================================
   LOGIC — renders the header, day cards, and Leaflet map from window.TRIP
   (content) + window.ROUTES (geometry). No trip content lives here.
   ========================================================================== */
(function () {
  var TRIP = window.TRIP, ROUTES = window.ROUTES || [];
  if (!TRIP) { console.error("trip.js not loaded"); return; }

  var MODE = { car: { color: "#c07a2b" }, train: { color: "#2b5f8c" } };

  // booking sites -> chip label + icon (add more here to support new sites)
  var SITES = {
    airbnb:  { label: "Airbnb",      icon: "🔎" },
    booking: { label: "Booking.com", icon: "🏨" },
    hotel:   { label: "Hotel site",  icon: "🛎️" }
  };

  var MAP = TRIP.map || {};
  var LEGEND = MAP.legend || {};
  var PHOTO_REGION = MAP.photoRegion || "";
  var LAYERS = TRIP.layers || [];

  // highlight place types -> map icon + legend label (order = legend order).
  // Set a highlight's `type` in the trip's meta.js; unknown/absent falls back to ★.
  var TYPES = {
    town:      { icon: "🏰", label: "Town / village" },
    wine:      { icon: "🍷", label: "Wine" },
    church:    { icon: "⛪", label: "Church / abbey" },
    thermal:   { icon: "♨️", label: "Hot spring / pool" },
    nature:    { icon: "🌿", label: "Nature / park" },
    beach:     { icon: "🏖️", label: "Beach / coast" },
    art:       { icon: "🎨", label: "Art / museum" },
    market:    { icon: "🛍️", label: "Market" },
    waterfall: { icon: "💧", label: "Waterfall" },
    viewpoint: { icon: "🔭", label: "Viewpoint" },
    wildlife:  { icon: "🦭", label: "Wildlife" },
    museum:    { icon: "🏛️", label: "Museum" },
    fossil:    { icon: "🦴", label: "Fossils / geology" }
  };
  function typeIcon(t) { return (TYPES[t] && TYPES[t].icon) || "★"; }

  // weather-variant labels -> chip emoji (matched case-insensitively on the label)
  var WX = { fair: "☀️", sun: "☀️", grey: "☁️", gray: "☁️", cloud: "☁️", overcast: "☁️",
             wet: "🌧️", rain: "🌧️", wind: "🌬️", windy: "🌬️", storm: "⛈️" };
  function wxEmoji(label) {
    var k = String(label || "").toLowerCase();
    for (var w in WX) { if (k.indexOf(w) >= 0) return WX[w]; }
    return "•";
  }

  /* ---------- place lookup: linkify town/attraction names in day text -------- */
  // Any name that carries a coordinate (bases, highlights, waypoints, hubs)
  // becomes a clickable photo trigger wherever it appears in a day bullet.
  var PLACES = (function () {
    var out = [], seen = {};
    function add(name, coord, pin) {
      if (!name || !coord) return;
      var k = name.toLowerCase();
      if (seen[k]) return; seen[k] = 1;
      out.push({ name: name, coord: coord, pin: pin });
    }
    (TRIP.bases || []).forEach(function (b) {
      add(b.name, b.coord);
      (b.highlights || []).forEach(function (h) { add(h.name, h.coord); });
    });
    (TRIP.waypoints || []).forEach(function (w) { add(w.name, w.coord); });
    (TRIP.hubs || []).forEach(function (h) { add(h.name, h.coord); });
    // layers with `linkify:true` (e.g. markets) also link their names in day text, with a 📍 maps link
    LAYERS.forEach(function (l) {
      if (l.linkify) (l.points || []).forEach(function (p) { add(p.name, p.coord, true); });
    });
    out.sort(function (a, b) { return b.name.length - a.name.length; }); // longest-match first
    return out;
  })();
  var placeByName = {};
  PLACES.forEach(function (p) { placeByName[p.name.toLowerCase()] = p; });
  var placeRe = PLACES.length
    ? new RegExp("\\b(" + PLACES.map(function (p) { return reEsc(esc(p.name)); }).join("|") + ")\\b", "gi")
    : null;

  function linkifyItem(text) {
    var s = esc(text);
    if (!placeRe) return s;
    return s.replace(placeRe, function (match) {
      var p = placeByName[match.toLowerCase()];
      if (!p) return match;
      var u = p.pin && navUrls(p.coord);
      return '<a class="pl" href="#" ' + photoAttrs(match, p.coord) + '>' + match + '</a>' +
        (u ? '<a class="plmap" href="' + u.gmaps + '" target="_blank" rel="noopener" title="Directions in Google Maps">📍</a>' : '');
    });
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* ---------- header ---------- */
  var m = TRIP.meta;
  var sub = esc(m.dates) + (m.route ? ' · ' + esc(m.route) : '');
  function travelRow(icon, out, back) {
    if (!out && !back) return '';
    return '<div class="fly"><span class="ficon">' + icon + '</span><span><b>Out</b> ' + esc(out) +
      '</span><span><b>Back</b> ' + esc(back) + '</span></div>';
  }
  var flyHTML = travelRow("✈︎", m.flyOut, m.flyBack) + travelRow("🚆", m.trainOut, m.trainBack);
  document.getElementById("top").innerHTML =
    '<h1>' + esc(m.title) + '</h1>' +
    '<div class="sub">' + sub + '</div>' + flyHTML;

  /* ---------- itinerary cards ---------- */
  var itin = document.getElementById("itin");
  TRIP.bases.forEach(function (b) {
    var stay = b.stay ? esc(b.stay) : "";
    var nights = b.nights ? (b.nights + " night" + (b.nights > 1 ? "s" : "")) : (stay ? "" : "fly out");
    var tag = b.carFree ? '<span class="tag">Car-free</span>' : '';
    var book = (b.book || []).map(function (x) {
      var s = SITES[x.site] || { label: x.site, icon: "🔗" };
      return '<a class="book ' + x.site + '" href="' + esc(x.url) + '" target="_blank" rel="noopener">' +
        s.icon + ' ' + esc(s.label) + '</a>';
    }).join("");
    var photos = b.coord
      ? '<a class="book photos" href="#" ' + photoAttrs(b.name, b.coord) + '>📷 Photos</a>'
      : '';
    var nav = navChips(b.coord, "book");
    var right = (photos || nav || book || tag)
      ? '<span class="bandright">' + photos + nav + book + tag + '</span>' : '';
    var metaBits = [stay, nights, esc(b.dates)].filter(Boolean).join(" · ");
    var card = document.createElement("div");
    card.className = "basecard";
    card.innerHTML =
      '<div class="baseband" style="background:' + b.color + '">' +
        '<span class="name">' + b.emoji + ' ' + esc(b.name) + '</span>' +
        '<span class="meta">· ' + metaBits + '</span>' +
        right +
      '</div>' +
      '<div class="days">' + b.days.map(function (d) { return dayHTML(d, b.color); }).join("") + '</div>';
    itin.appendChild(card);
  });

  var vgroup = 0;   // unique id per variant block, for wiring the toggle chips
  function liList(items, slots) {
    items = items || []; slots = slots || {};
    return '<ul>' + items.map(function (i, n) {
      return (slots[n] ? hopLi(slots[n]) : '') + '<li>' + linkifyItem(i) + '</li>';
    }).join("") + (slots[items.length] ? hopLi(slots[items.length]) : '') + '</ul>';
  }
  function variantsHTML(day) {
    var vs = day.variants;
    var g = "vg" + (++vgroup);
    var chips = vs.map(function (v, i) {
      return '<button type="button" class="vchip' + (i === 0 ? ' active' : '') + '" data-vg="' + g +
        '" data-vi="' + i + '">' + wxEmoji(v.label) + ' ' + esc(v.label) + '</button>';
    }).join("");
    var panes = vs.map(function (v, i) {
      return '<div class="vpane' + (i === 0 ? '' : ' off') + '" data-vg="' + g + '" data-vi="' + i + '">' +
        (v.note ? '<div class="vnote">' + linkifyItem(v.note) + '</div>' : '') +
        liList(v.items) + '</div>';
    }).join("");
    return '<div class="variants" data-vg="' + g + '"><div class="vchips">' + chips + '</div>' + panes + '</div>';
  }
  function fmtMin(m) {
    m = Math.max(5, Math.round(m / 5) * 5);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60 < 10 ? '0' : '') + m % 60 : '');
  }
  // drive-time rows slotted before the bullet each car leg leads to (routes.js from/to/min/match);
  // consecutive legs landing on the same bullet are merged, unmatched ones trail the list
  function hopItems(d, items) {
    var ls = ROUTES.filter(function (l) { return l.day === d && l.mode === "car" && l.to && l.min != null; });
    var slots = {}, cur = 0;
    ls.forEach(function (l) {
      var key = (l.match || l.to).toLowerCase(), at = items.length;
      for (var i = cur; i < items.length; i++) if (items[i].toLowerCase().indexOf(key) >= 0) { at = i; break; }
      if (at < items.length) cur = at;
      var s = slots[at];
      if (s) { s.min += l.min; s.to = l.to; } else slots[at] = { min: l.min, to: l.to };
    });
    return slots;
  }
  function hopLi(h) {
    return '<li class="hop"><span>' + fmtMin(h.min) + ' drive · ' + esc(h.to) + '</span></li>';
  }
  function dayHTML(day, color) {
    var leg = day.leg
      ? '<div class="leg"><span class="mode ' + day.leg.mode + '">' + day.leg.mode + '</span> ' + esc(day.leg.text) + '</div>'
      : '';
    var arrive = day.arrive ? ' <span class="arrivetag">›› arrive &amp; check in</span>' : '';
    var wx = day.weather ? '<div class="wx">' + esc(day.weather) + '</div>' : '';
    var shared = (day.items && day.items.length) ? liList(day.items, hopItems(day.d, day.items)) : '';
    var variants = (day.variants && day.variants.length) ? variantsHTML(day) : '';
    var off = /^off\b/i.test(day.title);
    return '<div class="day' + (off ? ' off' : '') + '" style="--dot:' + color + '">' +
      '<div class="dhead" role="button" tabindex="0" data-day="' + day.d + '" title="Show on map">' +
        '<span class="dno" style="color:' + color + '">' + day.d + '</span>' +
        '<span class="ddate">Day ' + day.d + ' · ' + esc(day.date) + '</span>' +
        '<span class="dtitle">' + esc(day.title) + arrive + '<span class="dmap" aria-hidden="true">map</span></span>' +
      '</div>' +
      wx + shared + variants + leg + '</div>';
  }

  /* ---------- map ---------- */
  var map = L.map("map", { scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);

  // full-screen toggle (mobile; CSS pseudo-fullscreen so it works everywhere incl. iOS)
  var fsScroll = 0, fsBtn = null;
  var mobileQ = window.matchMedia("(max-width:900px)");
  function isFs() { return document.querySelector(".mapwrap").classList.contains("fs-on"); }
  function setFs(on, then) {
    var el = document.querySelector(".mapwrap");
    if (on === isFs()) { if (then) then(); return; }
    el.classList.toggle("fs-on", on);
    // freeze the page behind the map so iOS can't scroll/bounce it (restore position on exit)
    if (on) { fsScroll = window.scrollY; document.body.style.top = -fsScroll + "px"; }
    document.body.classList.toggle("fs-lock", on);
    if (!on) { document.body.style.top = ""; window.scrollTo(0, fsScroll); clearDayFocus(); }
    if (fsBtn) { fsBtn.innerHTML = on ? "✕" : "⛶"; fsBtn.title = on ? "Exit full screen" : "Full screen"; }
    setTimeout(function () { map.invalidateSize(); if (then) then(); }, 150);
  }
  var FsCtrl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      var c = L.DomUtil.create("div", "leaflet-bar fs-ctrl");
      var a = fsBtn = L.DomUtil.create("a", "fs-btn", c);
      a.href = "#"; a.title = "Full screen"; a.setAttribute("role", "button"); a.innerHTML = "⛶";
      L.DomEvent.on(a, "click", function (e) { L.DomEvent.stop(e); setFs(!isFs()); });
      return c;
    }
  });
  map.addControl(new FsCtrl());

  // floating "Map" button (phones: the map scrolls away above the itinerary)
  var fab = document.createElement("button");
  fab.type = "button"; fab.className = "mapfab"; fab.innerHTML = "🗺️ Map";
  fab.addEventListener("click", function () { setFs(true); });
  document.body.appendChild(fab);

  // "Day N" chip shown while the map is focused on one day
  var dayChip = L.DomUtil.create("div", "daychip");
  dayChip.setAttribute("hidden", "");
  document.querySelector(".mapwrap").appendChild(dayChip);
  L.DomEvent.disableClickPropagation(dayChip);
  dayChip.addEventListener("click", function (e) {
    if (e.target.closest(".dc-x")) { clearDayFocus(); fitAll(); }
  });

  var bounds = [];
  // toggleable POI layers (food/pools/chargers/tips…) — one Leaflet group each
  var layerGroups = LAYERS.map(function () { return L.layerGroup(); });

  // route legs (real road/rail-corridor geometry). If legs carry a `day`, group
  // them into per-day toggleable layers (coloured by day) so each day's driving
  // can be shown/hidden; otherwise draw them straight onto the map (one route).
  var ROUTE_PALETTE = ["#c0533b", "#2f8f8a", "#8e6b3a", "#5b6b8c", "#7a4b6b", "#4a8c5a", "#b07a33", "#3a5a8c"];
  var routeHasDays = ROUTES.some(function (l) { return l.day != null; });
  var routeDays = [], routeGroups = {}, routeColor = {}, routeKm = {};
  function legKm(coords) {   // great-circle length along a polyline (km)
    var R = 6371, s = 0;
    for (var i = 1; i < coords.length; i++) {
      var a = coords[i - 1], b = coords[i], rad = Math.PI / 180;
      var dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      s += 2 * R * Math.asin(Math.sqrt(h));
    }
    return s;
  }
  ROUTES.forEach(function (leg) {
    if (leg.day != null) routeKm[leg.day] = (routeKm[leg.day] || 0) + (leg.km != null ? leg.km : legKm(leg.coords));
    if (leg.day != null && routeDays.indexOf(leg.day) < 0) {
      routeColor[leg.day] = ROUTE_PALETTE[routeDays.length % ROUTE_PALETTE.length];
      routeGroups[leg.day] = L.layerGroup();
      routeDays.push(leg.day);
    }
    var color = routeHasDays ? routeColor[leg.day] : (leg.mode === "car" ? MODE.car.color : MODE.train.color);
    var style = leg.mode === "car"
      ? { color: color, weight: 4, opacity: .9 }
      : { color: color, weight: 3, opacity: .85, dashArray: "2,9", lineCap: "round" };
    var pl = L.polyline(leg.coords, style);
    if (routeHasDays) pl.addTo(routeGroups[leg.day]); else pl.addTo(map);
    leg.coords.forEach(function (c) { bounds.push(c); });
  });
  if (routeHasDays) routeDays.forEach(function (d) { routeGroups[d].addTo(map); });

  // hubs (Milan / airport)
  (TRIP.hubs || []).forEach(function (h) {
    marker(h.coord, divIcon('<div class="pin hub"></div>', 16, 16, 8, 8),
      "<b>" + esc(h.name) + "</b><br>" + esc(h.note || ""));
  });

  // waypoints (car drop, etc.)
  (TRIP.waypoints || []).forEach(function (w) {
    marker(w.coord, divIcon('<div class="pin way"></div>', 14, 14, 7, 7),
      "<b>" + esc(w.name) + "</b><br>" + esc(w.note || ""));
  });

  // per-base: numbered stay pin + highlight stars
  TRIP.bases.forEach(function (b) {
    if (b.coord) {
      marker(b.coord,
        divIcon('<div class="pin" style="background:' + b.color + '"><span>' + b.pin + '</span></div>', 26, 26, 13, 26, [0, -24]),
        "<b>" + b.emoji + " " + esc(b.name) + "</b><br>" + (b.stay ? esc(b.stay) + "<br>" : "") +
        (b.nights ? b.nights + " night" + (b.nights > 1 ? "s" : "") + " · " : "") + esc(b.dates) +
        popupPhotos(b.name, b.coord));
      bounds.push(b.coord);
    }
    (b.highlights || []).forEach(function (hl) {
      marker(hl.coord, divIcon('<div class="hl">' + typeIcon(hl.type) + '</div>', 20, 20, 10, 10),
        "<b>" + esc(hl.name) + "</b>" + (hl.note ? "<br>" + esc(hl.note) : "") +
        '<br><span style="color:#7a7167">near ' + esc(b.name) + "</span>" +
        popupPhotos(hl.name, hl.coord));
      bounds.push(hl.coord);
    });
  });

  // POI layers (food/pools/chargers/tips…) — populate each toggleable group
  // points whose note starts "Day 6 ·" / "Days 2–5 ·" / "Days 6/10 ·" are tagged so a day focus can filter them
  var dayMarkers = [];
  function dayTags(note) {
    var mt = /^Days?\s+([\d\s,\/–-]+)/.exec(note || "");
    if (!mt) return null;
    var out = [];
    mt[1].split(/[,\/]/).forEach(function (part) {
      var r = part.trim().split(/[–-]/).map(Number);
      if (!r[0]) return;
      for (var d = r[0]; d <= (r[1] || r[0]); d++) out.push(d);
    });
    return out.length ? out : null;
  }
  LAYERS.forEach(function (layer, li) {
    var cats = layer.cats || {};
    (layer.points || []).forEach(function (p) {
      var ct = cats[p.cat] || { icon: layer.icon || "📍", label: layer.label };
      var showPhotos = layer.photos !== false && p.coord;
      var pop = "<b>" + esc(p.name) + "</b><br>" +
        '<span style="color:#7a7167">' + esc(ct.label || layer.label) +
          (p.rating ? " · ★ " + esc(String(p.rating)) : "") + "</span>" +
        (p.note ? "<br>" + esc(p.note) : "") +
        (p.url ? '<br><a href="' + esc(p.url) + '" target="_blank" rel="noopener">Open ↗</a>' : "") +
        (p.coord ? '<br><span class="popnav">' + navChips(p.coord, "popchip") + '</span>' : "") +
        (showPhotos ? popupPhotos(p.name, p.coord) : "");
      var m = L.marker(p.coord, { icon: divIcon('<div class="poipin">' + (ct.icon || layer.icon || "📍") + "</div>", 22, 22, 11, 11) })
        .bindPopup(pop).addTo(layerGroups[li]);
      var days = dayTags(p.note);
      if (days) dayMarkers.push({ m: m, li: li, days: days, coord: p.coord });
      bounds.push(p.coord);
    });
  });

  function fitAll() { if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.12)); }
  fitAll();

  /* ---------- focus the map on one day (day-title click) ---------- */
  var dayById = {}, baseOfDay = {};
  TRIP.bases.forEach(function (b) {
    b.days.forEach(function (d) { dayById[d.d] = d; baseOfDay[d.d] = b; });
  });
  // day focus: only that day's route and its day-tagged markers; untagged markers stay
  var savedRoutes = null;   // legend route-checkbox state from before the focus
  function routeCb(d) { return document.querySelector('.routeToggle[data-day="' + d + '"]'); }
  function showRoute(d, on) {
    var cb = routeCb(d);
    if (cb) cb.checked = on;
    if (on) routeGroups[d].addTo(map); else map.removeLayer(routeGroups[d]);
  }
  function clearDayFocus() {
    if (savedRoutes) routeDays.forEach(function (d) { showRoute(d, savedRoutes[d]); });
    savedRoutes = null;
    dayMarkers.forEach(function (t) { t.m.addTo(layerGroups[t.li]); });
    dayChip.setAttribute("hidden", "");
  }
  function focusDay(n) {
    var day = dayById[n], pts = [];
    if (!day) return;
    if (!savedRoutes) {
      savedRoutes = {};
      routeDays.forEach(function (d) { var cb = routeCb(d); savedRoutes[d] = !cb || cb.checked; });
    }
    routeDays.forEach(function (d) { showRoute(d, d === n); });
    ROUTES.forEach(function (l) { if (l.day === n) pts = pts.concat(l.coords); });
    var hasRoute = pts.length > 0;
    dayMarkers.forEach(function (t) {
      if (t.days.indexOf(n) < 0) { layerGroups[t.li].removeLayer(t.m); return; }
      t.m.addTo(layerGroups[t.li]);
      var cb = document.querySelector('.layerToggle[data-li="' + t.li + '"]');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
      pts.push(t.coord);
    });
    dayChip.innerHTML = '<b>Day ' + n + '</b> <span>' + esc(day.title) + '</span>' +
      '<button type="button" class="dc-x" aria-label="Show whole trip">×</button>';
    dayChip.removeAttribute("hidden");
    var go = function () {
      var base = baseOfDay[n];
      // keep the route clear of the day chip (top) and, in full screen, the legend (bottom)
      var lg = isFs() ? document.getElementById("legend").offsetHeight : 0;
      var fit = { paddingTopLeft: [30, 70], paddingBottomRight: [30, lg + 30], maxZoom: 14 };
      if (hasRoute || pts.length > 1) map.fitBounds(L.latLngBounds(pts), fit);
      else if (base && base.coord) map.setView(base.coord, 12);   // off day: stay near the house
      else fitAll();
    };
    if (mobileQ.matches) setFs(true, go); else go();
  }
  function onDayHead(e) {
    var h = e.target.closest ? e.target.closest(".dhead[data-day]") : null;
    if (!h || e.target.closest("a")) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    focusDay(+h.getAttribute("data-day"));
  }
  document.addEventListener("click", onDayHead);
  document.addEventListener("keydown", onDayHead);

  /* ---------- legend (built from what's in the data) ---------- */
  var modes = {};
  ROUTES.forEach(function (l) { modes[l.mode] = 1; });
  var usedTypes = {};
  TRIP.bases.forEach(function (b) {
    (b.highlights || []).forEach(function (hl) { if (TYPES[hl.type]) usedTypes[hl.type] = 1; });
  });
  var typeRows = Object.keys(TYPES).filter(function (t) { return usedTypes[t]; })
    .map(function (t) {
      return '<div class="lrow"><span class="lic">' + TYPES[t].icon + '</span>' + esc(TYPES[t].label) + '</div>';
    }).join("");
  var sleepColor = LEGEND.sleepColor || (TRIP.bases[0] && TRIP.bases[0].color) || "#8e3b46";
  // LEFT column: driving (per-day toggles for day-tagged trips, else mode key) — always visible
  var drivingRows = routeHasDays
    ? routeDays.slice().sort(function (a, b) { return a - b; }).map(function (d) {
        var km = Math.round(routeKm[d] / 5) * 5;   // nearest 5 km (OSRM road distance)
        return '<label class="ltog rtog"><input type="checkbox" class="routeToggle" data-day="' + d + '" checked> ' +
          '<span class="seg" style="border-color:' + routeColor[d] + '"></span> Day ' + d +
          ' <span class="rkm">· ' + km + ' km</span></label>';
      }).join("")
    : (modes.train ? '<div class="row"><span class="seg train"></span> ' + esc(LEGEND.train || "Train") + '</div>' : '') +
      (modes.car ? '<div class="row"><span class="seg car"></span> ' + esc(LEGEND.car || "Car") + '</div>' : '');

  // RIGHT column: collapsible sections (only title + checkbox + arrow shown by default)
  function section(head, body, headToggles) {
    return '<div class="lsec"><div class="lsec-head' + (headToggles ? ' lsec-toggle' : '') + '">' + head +
      '<span class="lsec-arrow' + (headToggles ? '' : ' lsec-toggle') + '" role="button" aria-label="Expand">▸</span>' +
      '</div><div class="lsec-body">' + body + '</div></div>';
  }
  var mapKeyBody =
    (TRIP.hubs && TRIP.hubs.length
      ? '<div class="lrow"><span class="dot" style="background:' + (LEGEND.hubColor || "#9a9186") + '"></span>' +
        esc(LEGEND.hub || TRIP.hubs[0].name) + '</div>' : '') +
    '<div class="lrow"><span class="dot" style="background:' + sleepColor + '"></span>' +
      esc(LEGEND.sleep || "Where you sleep") + '</div>' +
    (typeRows ? '<div class="lg-subt">Sights &amp; day-trips</div><div class="ltypes">' + typeRows + '</div>' : '');
  var mapKeySection = section('<span class="lsec-title">Map key</span>', mapKeyBody, true);
  var layerSections = LAYERS.map(function (layer, li) {
    var catRows = layer.cats
      ? Object.keys(layer.cats)
          .filter(function (c) { return (layer.points || []).some(function (p) { return p.cat === c; }); })
          .map(function (c) {
            return '<div class="lrow"><span class="lic">' + layer.cats[c].icon + '</span>' + esc(layer.cats[c].label) + '</div>';
          }).join("")
      : '';
    var body = catRows ||
      '<div class="lrow"><span class="lic">' + (layer.icon || "📍") + '</span>' + esc(layer.label) + '</div>';
    var head = '<label class="ltog"><input type="checkbox" class="layerToggle" data-li="' + li + '"' +
      (layer.on ? ' checked' : '') + '> ' + esc(layer.label) + '</label>';
    return '<div class="lsec"><div class="lsec-head">' + head +
      '<span class="lsec-arrow lsec-toggle" role="button" aria-label="Expand">▸</span>' +
      '</div><div class="lsec-body ltypes' + (layer.on ? '' : ' dim') + '" id="layerKey-' + li + '">' + body + '</div></div>';
  }).join("");

  document.getElementById("legend").innerHTML =
    '<div class="lg-cols">' +
      '<div class="lg-left"><div class="ltitle">' + (routeHasDays ? 'Driving — by day' : 'Route') + '</div>' + drivingRows + '</div>' +
      '<div class="lg-right">' + mapKeySection + layerSections + '</div>' +
    '</div>';

  // wire each POI layer's show/hide toggle (default visibility from layer.on)
  LAYERS.forEach(function (layer, li) { if (layer.on) layerGroups[li].addTo(map); });
  Array.prototype.forEach.call(document.querySelectorAll(".layerToggle"), function (cb) {
    cb.addEventListener("change", function () {
      var li = +this.getAttribute("data-li");
      var key = document.getElementById("layerKey-" + li);
      if (this.checked) { layerGroups[li].addTo(map); if (key) key.classList.remove("dim"); }
      else { map.removeLayer(layerGroups[li]); if (key) key.classList.add("dim"); }
    });
  });

  // wire collapsible right-column sections (expand/collapse; collapsed by default)
  Array.prototype.forEach.call(document.querySelectorAll(".lsec-toggle"), function (t) {
    t.addEventListener("click", function () {
      var sec = this.closest(".lsec");
      if (sec) sec.classList.toggle("open");
    });
  });

  // wire per-day driving-route toggles (default all checked / visible)
  Array.prototype.forEach.call(document.querySelectorAll(".routeToggle"), function (cb) {
    cb.addEventListener("change", function () {
      var d = this.getAttribute("data-day");
      if (this.checked) routeGroups[d].addTo(map);
      else map.removeLayer(routeGroups[d]);
    });
  });

  // wire weather-variant chips (toggle which variant pane shows inside a day)
  document.addEventListener("click", function (e) {
    var chip = e.target.closest ? e.target.closest(".vchip") : null;
    if (!chip) return;
    var box = chip.closest(".variants");
    if (!box) return;
    var vi = chip.getAttribute("data-vi");
    Array.prototype.forEach.call(box.querySelectorAll(".vchip"), function (c) {
      c.classList.toggle("active", c.getAttribute("data-vi") === vi);
    });
    Array.prototype.forEach.call(box.querySelectorAll(".vpane"), function (p) {
      p.classList.toggle("off", p.getAttribute("data-vi") !== vi);
    });
  });

  /* ---------- helpers ---------- */
  function marker(coord, icon, popup) {
    return L.marker(coord, { icon: icon }).bindPopup(popup).addTo(map);
  }
  function divIcon(html, w, h, ax, ay, popupAnchor) {
    return L.divIcon({
      className: "", html: html, iconSize: [w, h], iconAnchor: [ax, ay],
      popupAnchor: popupAnchor || [0, -h / 2]
    });
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- photo browser (in-page modal, images from Wikimedia Commons) --- */
  // trigger markup: a link carrying the place name + coord; clicks are delegated.
  // driving links for any place carrying a coordinate (band chips + photo modal)
  function navUrls(coord) {
    var lat = coord && coord[0], lon = coord && coord[1];
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;
    return {
      gmaps: "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon,
      waze:  "https://waze.com/ul?ll=" + lat + "," + lon + "&navigate=yes"
    };
  }
  function navChips(coord, cls) {
    var u = navUrls(coord);
    if (!u) return "";
    return '<a class="' + cls + ' nav gmaps" href="' + u.gmaps + '" target="_blank" rel="noopener">\u{1F5FA}\uFE0F Maps</a>' +
           '<a class="' + cls + ' nav waze" href="' + u.waze + '" target="_blank" rel="noopener">\u{1F697} Waze</a>';
  }
  function photoAttrs(name, coord) {
    var lat = coord ? coord[0] : "", lon = coord ? coord[1] : "";
    return 'data-photos="1" data-name="' + esc(name) + '" data-lat="' + lat + '" data-lon="' + lon + '"';
  }
  function popupPhotos(name, coord) {
    return '<br><a class="popup-photos" href="#" ' + photoAttrs(name, coord) + '>📷 Browse photos</a>';
  }

  var modal = buildModal(), reqId = 0, gallery = [], lightIdx = 0;

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-photos]") : null;
    if (!t) return;
    e.preventDefault();
    openPhotos(t.getAttribute("data-name"),
      parseFloat(t.getAttribute("data-lat")),
      parseFloat(t.getAttribute("data-lon")));
  });
  document.addEventListener("keydown", function (e) {
    if (modal.hasAttribute("hidden")) return;
    var lightOpen = !modal.querySelector(".pm-light").hasAttribute("hidden");
    if (e.key === "Escape") { lightOpen ? hideLight() : closePhotos(); }
    else if (lightOpen && e.key === "ArrowLeft") stepLight(-1);
    else if (lightOpen && e.key === "ArrowRight") stepLight(1);
  });

  function buildModal() {
    var el = document.createElement("div");
    el.className = "photomodal";
    el.setAttribute("hidden", "");
    el.innerHTML =
      '<div class="pm-backdrop"></div>' +
      '<div class="pm-panel" role="dialog" aria-modal="true" aria-label="Photos">' +
        '<div class="pm-head">' +
          '<span class="pm-title"></span>' +
          '<span class="pm-links">' +
            '<a class="pm-map pm-gmaps" target="_blank" rel="noopener" hidden>🗺️ Maps</a>' +
            '<a class="pm-map pm-waze" target="_blank" rel="noopener" hidden>🚗 Waze</a>' +
            '<a class="pm-ext" target="_blank" rel="noopener">More images ↗</a>' +
          '</span>' +
          '<button class="pm-close" type="button" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="pm-body"></div>' +
      '</div>' +
      '<div class="pm-light" hidden>' +
        '<div class="pm-track"></div>' +
        '<button type="button" class="pm-nav pm-prev" aria-label="Previous photo">‹</button>' +
        '<button type="button" class="pm-nav pm-next" aria-label="Next photo">›</button>' +
        '<button type="button" class="pm-lclose" aria-label="Back to grid">×</button>' +
        '<span class="pm-count"></span>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector(".pm-backdrop").addEventListener("click", closePhotos);
    el.querySelector(".pm-close").addEventListener("click", closePhotos);
    // tap the dark area around the photo closes the lightbox
    el.querySelector(".pm-light").addEventListener("click", function (e) {
      if (e.target === this || e.target.classList.contains("pm-slide")) hideLight();
    });
    el.querySelector(".pm-lclose").addEventListener("click", hideLight);
    el.querySelector(".pm-prev").addEventListener("click", function (e) { e.stopPropagation(); stepLight(-1); });
    el.querySelector(".pm-next").addEventListener("click", function (e) { e.stopPropagation(); stepLight(1); });
    // the track is a native scroll-snap carousel: swipe moves between photos
    var track = el.querySelector(".pm-track"), sy = null, sx = 0;
    track.addEventListener("scroll", function () {
      var i = Math.round(track.scrollLeft / (track.clientWidth || 1));
      if (i !== lightIdx && gallery[i]) { lightIdx = i; syncLight(); }
    }, { passive: true });
    // swipe down to go back to the grid
    track.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) { sy = e.touches[0].clientY; sx = e.touches[0].clientX; }
    }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (sy == null) return;
      var t = e.changedTouches[0], dy = t.clientY - sy, dx = Math.abs(t.clientX - sx);
      sy = null;
      if (dy > 90 && dx < 50) hideLight();
    }, { passive: true });
    el.querySelector(".pm-body").addEventListener("click", function (e) {
      var th = e.target.closest ? e.target.closest(".pm-thumb") : null;
      if (!th) return;
      showLight(+th.getAttribute("data-idx"));
    });
    return el;
  }

  function buildTrack() {
    modal.querySelector(".pm-track").innerHTML = gallery.map(function (g) {
      return '<div class="pm-slide"><img alt="' + esc(g.title || "") + '" decoding="async" data-src="' + esc(g.url) + '"></div>';
    }).join("");
  }
  function loadAround(i) {   // current photo + neighbours, so a swipe never lands on a blank
    var imgs = modal.querySelectorAll(".pm-slide img");
    for (var j = i - 1; j <= i + 1; j++) {
      var im = imgs[j];
      if (im && !im.getAttribute("src")) im.src = im.getAttribute("data-src");
    }
  }
  function syncLight() {
    var src = gallery[lightIdx] && gallery[lightIdx].source;
    modal.querySelector(".pm-count").textContent =
      (lightIdx + 1) + " / " + gallery.length + (src ? " · " + src : "");
    loadAround(lightIdx);
  }
  function showLight(i) {
    if (!gallery.length) return;
    lightIdx = Math.max(0, Math.min(gallery.length - 1, i));
    var light = modal.querySelector(".pm-light"), track = light.querySelector(".pm-track");
    var multi = gallery.length > 1;
    light.querySelector(".pm-prev").style.display = multi ? "" : "none";
    light.querySelector(".pm-next").style.display = multi ? "" : "none";
    light.removeAttribute("hidden");
    track.scrollTo({ left: lightIdx * track.clientWidth, behavior: "instant" });
    syncLight();
  }
  function stepLight(delta) {
    if (!gallery.length) return;
    var n = gallery.length, i = lightIdx + delta, track = modal.querySelector(".pm-track");
    if (i < 0 || i >= n) return showLight((i + n) % n);   // wrap without a long scroll
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }
  function hideLight() { modal.querySelector(".pm-light").setAttribute("hidden", ""); }

  function openPhotos(name, lat, lon) {
    var id = ++reqId;
    gallery = [];
    modal.removeAttribute("hidden");
    modal.querySelector(".pm-light").setAttribute("hidden", "");
    document.body.classList.add("pm-open");
    modal.querySelector(".pm-title").textContent = name;
    modal.querySelector(".pm-ext").href =
      "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(photoQ(name));

    // driving links — only when the place carries a coordinate
    var gm = modal.querySelector(".pm-gmaps"), wz = modal.querySelector(".pm-waze");
    var nav = navUrls([lat, lon]);
    if (nav) {
      gm.href = nav.gmaps; wz.href = nav.waze;
      gm.removeAttribute("hidden"); wz.removeAttribute("hidden");
    } else { gm.setAttribute("hidden", ""); wz.setAttribute("hidden", ""); }
    var body = modal.querySelector(".pm-body");
    body.innerHTML = '<div class="pm-note">Loading photos…</div>';
    modal.querySelector(".pm-track").innerHTML = "";

    // Pull from several sources in parallel: Openverse (Flickr/museums/Wikimedia,
    // searched by name → scenic) + Wikimedia Commons geosearch (on-location shots).
    // Each source returns {thumb, large, title, source}; a source that fails → [].
    var tasks = [fetchOpenverse(name)];
    if (!isNaN(lat) && !isNaN(lon)) tasks.push(fetchCommons(lat, lon));

    Promise.all(tasks.map(function (p) { return p.catch(function () { return []; }); }))
      .then(function (lists) {
        if (id !== reqId) return;
        var imgs = [], seen = {};
        lists.forEach(function (list) {
          (list || []).forEach(function (im) {
            if (!im || !im.thumb || seen[im.thumb]) return;
            seen[im.thumb] = 1; imgs.push(im);
          });
        });
        if (!imgs.length) { body.innerHTML = fallbackHTML(name); return; }
        gallery = imgs.map(function (im) { return { url: im.large, source: im.source, title: im.title }; });
        buildTrack();
        body.innerHTML = '<div class="pm-grid">' + imgs.map(function (im, i) {
          return '<button type="button" class="pm-thumb" data-idx="' + i +
            '" title="' + esc(im.title || "") + '">' +
            '<img loading="lazy" src="' + esc(im.thumb) + '" alt="' + esc(im.title || "") + '">' +
            '<span class="pm-src">' + esc(im.source) + '</span></button>';
        }).join("") + '</div>';
      });
  }

  // Openverse: aggregated CC images (Flickr, museums, Wikimedia…). No key needed;
  // CORS-enabled; thumbnails are served through its own proxy so they always load.
  function photoQ(name) { return PHOTO_REGION ? name + " " + PHOTO_REGION : name; }
  function fetchOpenverse(name) {
    var url = "https://api.openverse.org/v1/images/?page_size=40&mature=false&q=" +
      encodeURIComponent(photoQ(name));
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      return (j.results || []).filter(function (r) { return r.thumbnail; }).map(function (r) {
        return {
          thumb: r.thumbnail, large: r.thumbnail,
          title: r.title || name, source: sourceLabel(r.source)
        };
      });
    });
  }

  // Wikimedia Commons geosearch by coordinate; use the API's own thumb URL for
  // both grid and lightbox (never rewrite widths — unrendered sizes 400).
  function fetchCommons(lat, lon) {
    var url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=geosearch&ggsnamespace=6&ggscoord=" + lat + "%7C" + lon +
      "&ggsradius=5000&ggslimit=40&prop=imageinfo&iiprop=url&iiurlwidth=800";
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var pages = j && j.query && j.query.pages, out = [];
      if (pages) Object.keys(pages).forEach(function (k) {
        var p = pages[k], ii = p.imageinfo && p.imageinfo[0];
        if (!ii || !ii.thumburl) return;
        if (!/\.(jpe?g|png)$/i.test(p.title)) return;   // skip svg/maps/pdf/tif
        out.push({
          thumb: ii.thumburl, large: ii.thumburl,
          title: p.title.replace(/^File:/, "").replace(/\.[^.]+$/, ""), source: "Wikimedia"
        });
      });
      return out;
    });
  }

  function sourceLabel(s) {
    var map = { flickr: "Flickr", wikimedia: "Wikimedia", nappy: "Nappy",
      rawpixel: "Rawpixel", stocksnap: "StockSnap", museumsvictoria: "Museums Victoria",
      met: "The Met", smithsonian: "Smithsonian" };
    return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Openverse");
  }

  function closePhotos() {
    modal.setAttribute("hidden", "");
    modal.querySelector(".pm-light").setAttribute("hidden", "");
    document.body.classList.remove("pm-open");
  }

  function fallbackHTML(name) {
    var commons = "https://commons.wikimedia.org/w/index.php?search=" +
      encodeURIComponent(name) + "&title=Special:MediaSearch&type=image";
    var google = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(photoQ(name));
    return '<div class="pm-note">No geotagged photos here yet. Browse instead:<br><br>' +
      '<a href="' + commons + '" target="_blank" rel="noopener">Wikimedia Commons ↗</a>' +
      ' &nbsp;·&nbsp; <a href="' + google + '" target="_blank" rel="noopener">Google Images ↗</a></div>';
  }
})();
