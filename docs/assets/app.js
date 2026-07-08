/* =============================================================================
   LOGIC — renders the header, day cards, and Leaflet map from window.TRIP
   (content) + window.ROUTES (geometry). No trip content lives here.
   ========================================================================== */
(function () {
  var TRIP = window.TRIP, ROUTES = window.ROUTES || [];
  if (!TRIP) { console.error("trip.js not loaded"); return; }

  var MODE = { car: { color: "#c07a2b" }, train: { color: "#2b5f8c" } };

  /* ---------- header ---------- */
  var m = TRIP.meta;
  document.getElementById("top").innerHTML =
    '<h1>' + esc(m.title) + '</h1>' +
    '<div class="sub">' + esc(m.dates) + ' · ' + esc(m.route) + '</div>' +
    '<div class="fly">✈︎ <b>Out:</b> ' + esc(m.flyOut) +
      ' &nbsp;·&nbsp; <b>Back:</b> ' + esc(m.flyBack) + '</div>';

  /* ---------- itinerary cards ---------- */
  var itin = document.getElementById("itin");
  TRIP.bases.forEach(function (b) {
    var nights = b.nights ? (b.nights + " night" + (b.nights > 1 ? "s" : "")) : "fly out";
    var tag = b.carFree ? '<span class="tag">Car-free</span>' : '';
    var book = b.book
      ? '<a class="book" href="' + esc(b.book.url) + '" target="_blank" rel="noopener">🔎 ' + esc(b.book.label) + '</a>'
      : '';
    var right = (book || tag) ? '<span class="bandright">' + book + tag + '</span>' : '';
    var stay = b.stay ? esc(b.stay) + " · " : "";
    var card = document.createElement("div");
    card.className = "basecard";
    card.innerHTML =
      '<div class="baseband" style="background:' + b.color + '">' +
        '<span class="name">' + b.emoji + ' ' + esc(b.name) + '</span>' +
        '<span class="meta">· ' + stay + nights + ' · ' + esc(b.dates) + '</span>' +
        right +
      '</div>' +
      '<div class="days">' + b.days.map(function (d) { return dayHTML(d, b.color); }).join("") + '</div>';
    itin.appendChild(card);
  });

  function dayHTML(day, color) {
    var leg = day.leg
      ? '<div class="leg"><span class="mode ' + day.leg.mode + '">' + day.leg.mode + '</span> ' + esc(day.leg.text) + '</div>'
      : '';
    var arrive = day.arrive ? ' <span class="arrivetag">›› arrive &amp; check in</span>' : '';
    return '<div class="day">' +
      '<div class="dhead">' +
        '<span class="dno" style="background:' + color + '">DAY ' + day.d + '</span>' +
        '<span class="ddate">' + esc(day.date) + '</span>' +
        '<span class="dtitle">' + esc(day.title) + arrive + '</span>' +
      '</div>' +
      '<ul>' + day.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join("") + '</ul>' +
      leg + '</div>';
  }

  /* ---------- map ---------- */
  var map = L.map("map", { scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);

  var bounds = [];

  // route legs (real road/rail-corridor geometry)
  ROUTES.forEach(function (leg) {
    var style = leg.mode === "car"
      ? { color: MODE.car.color, weight: 4, opacity: .9 }
      : { color: MODE.train.color, weight: 3, opacity: .85, dashArray: "2,9", lineCap: "round" };
    L.polyline(leg.coords, style).addTo(map);
    leg.coords.forEach(function (c) { bounds.push(c); });
  });

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
        (b.nights ? b.nights + " night" + (b.nights > 1 ? "s" : "") + " · " : "") + esc(b.dates));
      bounds.push(b.coord);
    }
    (b.highlights || []).forEach(function (hl) {
      marker(hl.coord, divIcon('<div class="hl" style="color:' + b.color + '">★</div>', 16, 16, 8, 8),
        "<b>" + esc(hl.name) + "</b>" + (hl.note ? "<br>" + esc(hl.note) : "") +
        '<br><span style="color:#7a7167">near ' + esc(b.name) + "</span>");
      bounds.push(hl.coord);
    });
  });

  if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.12));

  /* ---------- legend (built from what's in the data) ---------- */
  document.getElementById("legend").innerHTML =
    '<div class="row"><span class="seg train"></span> Train</div>' +
    '<div class="row"><span class="seg car"></span> Car (Florence → La Spezia)</div>' +
    '<div class="row"><span class="dot" style="background:#9a9186"></span> Milan hub / airport</div>' +
    '<div class="row"><span class="star">★</span> Sights &amp; day-trips</div>';

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
})();
