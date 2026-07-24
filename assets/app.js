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
    function add(name, coord) {
      if (!name || !coord) return;
      var k = name.toLowerCase();
      if (seen[k]) return; seen[k] = 1;
      out.push({ name: name, coord: coord });
    }
    (TRIP.bases || []).forEach(function (b) {
      add(b.name, b.coord);
      (b.highlights || []).forEach(function (h) { add(h.name, h.coord); });
    });
    (TRIP.waypoints || []).forEach(function (w) { add(w.name, w.coord); });
    (TRIP.hubs || []).forEach(function (h) { add(h.name, h.coord); });
    out.sort(function (a, b) { return b.name.length - a.name.length; }); // longest-match first
    return out;
  })();
  var placeByName = {};
  PLACES.forEach(function (p) { placeByName[p.name.toLowerCase()] = p.coord; });
  var placeRe = PLACES.length
    ? new RegExp("\\b(" + PLACES.map(function (p) { return reEsc(esc(p.name)); }).join("|") + ")\\b", "gi")
    : null;

  function linkifyItem(text) {
    var s = esc(text);
    if (!placeRe) return s;
    return s.replace(placeRe, function (match) {
      var coord = placeByName[match.toLowerCase()];
      if (!coord) return match;
      return '<a class="pl" href="#" ' + photoAttrs(match, coord) + '>' + match + '</a>';
    });
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* ---------- header ---------- */
  var m = TRIP.meta;
  var sub = esc(m.dates) + (m.route ? ' · ' + esc(m.route) : '');
  var flyHTML = (m.flyOut || m.flyBack)
    ? '<div class="fly">✈︎ <b>Out:</b> ' + esc(m.flyOut) +
        ' &nbsp;·&nbsp; <b>Back:</b> ' + esc(m.flyBack) + '</div>'
    : '';
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
    var right = (photos || book || tag) ? '<span class="bandright">' + photos + book + tag + '</span>' : '';
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
  function liList(items) {
    return '<ul>' + (items || []).map(function (i) { return '<li>' + linkifyItem(i) + '</li>'; }).join("") + '</ul>';
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
  function dayHTML(day, color) {
    var leg = day.leg
      ? '<div class="leg"><span class="mode ' + day.leg.mode + '">' + day.leg.mode + '</span> ' + esc(day.leg.text) + '</div>'
      : '';
    var arrive = day.arrive ? ' <span class="arrivetag">›› arrive &amp; check in</span>' : '';
    var wx = day.weather ? '<div class="wx">' + esc(day.weather) + '</div>' : '';
    var shared = (day.items && day.items.length) ? liList(day.items) : '';
    var variants = (day.variants && day.variants.length) ? variantsHTML(day) : '';
    return '<div class="day">' +
      '<div class="dhead">' +
        '<span class="dno" style="background:' + color + '">DAY ' + day.d + '</span>' +
        '<span class="ddate">' + esc(day.date) + '</span>' +
        '<span class="dtitle">' + esc(day.title) + arrive + '</span>' +
      '</div>' +
      wx + shared + variants + leg + '</div>';
  }

  /* ---------- map ---------- */
  var map = L.map("map", { scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);

  // full-screen toggle (mobile; CSS pseudo-fullscreen so it works everywhere incl. iOS)
  var FsCtrl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      var c = L.DomUtil.create("div", "leaflet-bar fs-ctrl");
      var a = L.DomUtil.create("a", "fs-btn", c);
      a.href = "#"; a.title = "Full screen"; a.setAttribute("role", "button"); a.innerHTML = "⛶";
      L.DomEvent.on(a, "click", function (e) {
        L.DomEvent.stop(e);
        var el = document.querySelector(".mapwrap");
        var on = el.classList.toggle("fs-on");
        a.innerHTML = on ? "✕" : "⛶";
        a.title = on ? "Exit full screen" : "Full screen";
        setTimeout(function () { map.invalidateSize(); }, 150);
      });
      return c;
    }
  });
  map.addControl(new FsCtrl());

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
        (showPhotos ? popupPhotos(p.name, p.coord) : "");
      L.marker(p.coord, { icon: divIcon('<div class="poipin">' + (ct.icon || layer.icon || "📍") + "</div>", 22, 22, 11, 11) })
        .bindPopup(pop).addTo(layerGroups[li]);
      bounds.push(p.coord);
    });
  });

  if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.12));

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
        '<button type="button" class="pm-nav pm-prev" aria-label="Previous photo">‹</button>' +
        '<img alt="">' +
        '<button type="button" class="pm-nav pm-next" aria-label="Next photo">›</button>' +
        '<span class="pm-count"></span>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector(".pm-backdrop").addEventListener("click", closePhotos);
    el.querySelector(".pm-close").addEventListener("click", closePhotos);
    // click the dark area (not the image or arrows) closes the lightbox
    el.querySelector(".pm-light").addEventListener("click", function (e) {
      if (e.target === this) hideLight();
    });
    el.querySelector(".pm-prev").addEventListener("click", function (e) { e.stopPropagation(); stepLight(-1); });
    el.querySelector(".pm-next").addEventListener("click", function (e) { e.stopPropagation(); stepLight(1); });
    el.querySelector(".pm-light img").addEventListener("click", function (e) { e.stopPropagation(); stepLight(1); });
    el.querySelector(".pm-body").addEventListener("click", function (e) {
      var th = e.target.closest ? e.target.closest(".pm-thumb") : null;
      if (!th) return;
      showLight(+th.getAttribute("data-idx"));
    });
    return el;
  }

  var preloaded = {};
  function preload(i) {
    if (!gallery.length) return;
    var u = gallery[(i + gallery.length) % gallery.length].url;
    if (preloaded[u]) return;
    preloaded[u] = true;
    var im = new Image(); im.src = u;
  }
  function showLight(i) {
    if (!gallery.length) return;
    lightIdx = (i + gallery.length) % gallery.length;
    var light = modal.querySelector(".pm-light");
    light.querySelector("img").src = gallery[lightIdx].url;
    var src = gallery[lightIdx].source;
    light.querySelector(".pm-count").textContent =
      (lightIdx + 1) + " / " + gallery.length + (src ? " · " + src : "");
    var multi = gallery.length > 1;
    light.querySelector(".pm-prev").style.display = multi ? "" : "none";
    light.querySelector(".pm-next").style.display = multi ? "" : "none";
    light.removeAttribute("hidden");
    preload(lightIdx + 1); preload(lightIdx - 1);   // neighbours ready before you click
  }
  function stepLight(delta) { showLight(lightIdx + delta); }
  function hideLight() { modal.querySelector(".pm-light").setAttribute("hidden", ""); }

  function openPhotos(name, lat, lon) {
    var id = ++reqId;
    gallery = []; preloaded = {};
    modal.removeAttribute("hidden");
    modal.querySelector(".pm-light").setAttribute("hidden", "");
    document.body.classList.add("pm-open");
    modal.querySelector(".pm-title").textContent = name;
    modal.querySelector(".pm-ext").href =
      "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(photoQ(name));

    // driving links — only when the place carries a coordinate
    var gm = modal.querySelector(".pm-gmaps"), wz = modal.querySelector(".pm-waze");
    if (!isNaN(lat) && !isNaN(lon)) {
      gm.href = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lon;
      wz.href = "https://waze.com/ul?ll=" + lat + "," + lon + "&navigate=yes";
      gm.removeAttribute("hidden"); wz.removeAttribute("hidden");
    } else { gm.setAttribute("hidden", ""); wz.setAttribute("hidden", ""); }
    var body = modal.querySelector(".pm-body");
    body.innerHTML = '<div class="pm-note">Loading photos…</div>';

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
        gallery = imgs.map(function (im) { return { url: im.large, source: im.source }; });
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
