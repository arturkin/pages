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
    var book = (b.book || []).map(function (x) {
      var s = SITES[x.site] || { label: x.site, icon: "🔗" };
      return '<a class="book ' + x.site + '" href="' + esc(x.url) + '" target="_blank" rel="noopener">' +
        s.icon + ' ' + esc(s.label) + '</a>';
    }).join("");
    var photos = b.coord
      ? '<a class="book photos" href="#" ' + photoAttrs(b.name, b.coord) + '>📷 Photos</a>'
      : '';
    var right = (photos || book || tag) ? '<span class="bandright">' + photos + book + tag + '</span>' : '';
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
      '<ul>' + day.items.map(function (i) { return '<li>' + linkifyItem(i) + '</li>'; }).join("") + '</ul>' +
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
        (b.nights ? b.nights + " night" + (b.nights > 1 ? "s" : "") + " · " : "") + esc(b.dates) +
        popupPhotos(b.name, b.coord));
      bounds.push(b.coord);
    }
    (b.highlights || []).forEach(function (hl) {
      marker(hl.coord, divIcon('<div class="hl" style="color:' + b.color + '">★</div>', 16, 16, 8, 8),
        "<b>" + esc(hl.name) + "</b>" + (hl.note ? "<br>" + esc(hl.note) : "") +
        '<br><span style="color:#7a7167">near ' + esc(b.name) + "</span>" +
        popupPhotos(hl.name, hl.coord));
      bounds.push(hl.coord);
    });
  });

  if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.12));

  /* ---------- legend (built from what's in the data) ---------- */
  document.getElementById("legend").innerHTML =
    '<div class="row"><span class="seg train"></span> Train</div>' +
    '<div class="row"><span class="seg car"></span> Car (round-trip from Florence)</div>' +
    '<div class="row"><span class="dot" style="background:#9a9186"></span> Malpensa airport</div>' +
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
          '<a class="pm-ext" target="_blank" rel="noopener">More images ↗</a>' +
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
      "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(name + " Italy");
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
  function fetchOpenverse(name) {
    var url = "https://api.openverse.org/v1/images/?page_size=40&mature=false&q=" +
      encodeURIComponent(name + " Italy");
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
    var google = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(name + " Italy");
    return '<div class="pm-note">No geotagged photos here yet. Browse instead:<br><br>' +
      '<a href="' + commons + '" target="_blank" rel="noopener">Wikimedia Commons ↗</a>' +
      ' &nbsp;·&nbsp; <a href="' + google + '" target="_blank" rel="noopener">Google Images ↗</a></div>';
  }
})();
