/* =============================================================================
   TRIP CONTENT — this is the ONLY file you edit to change the itinerary.
   app.js reads window.TRIP and renders both the map and the day cards from it.
   Coordinates are [latitude, longitude].
   ========================================================================== */
window.TRIP = {
  meta: {
    title: "Italy — Two Weeks: Wine Country + Two Coasts",
    dates: "Sat 3 Oct – Sun 18 Oct 2026 · 15 nights",
    route: "Florence → Val d'Orcia → Maremma → Cinque Terre → Santa Margherita → Milan",
    flyOut: "Icelandair KEF 09:00 → MXP 15:10",
    flyBack: "Wizz Air MXP 16:00 → KEF 18:20"
  },

  // Milan hub + airport (start & end); shown as grey dots
  hubs: [
    { name: "Malpensa (MXP)",  coord: [45.630, 8.723], note: "arrive Day 1 · depart Day 16" },
    { name: "Milano Centrale", coord: [45.487, 9.204], note: "train hub" }
  ],

  // non-overnight stops (car drop etc.)
  waypoints: [
    { name: "La Spezia", coord: [44.107, 9.828], note: "drop rental car (Day 12)" }
  ],

  // Where you sleep, in order. Each base owns its days + nearby highlights.
  bases: [
    {
      key: "florence", pin: 1, emoji: "📍", name: "Florence",
      stay: "Arrival hotel (nr Santa Maria Novella)", nights: 1, dates: "Sat 3 Oct",
      color: "#5b6b8c", coord: [43.776, 11.248], carFree: false,
      book: [
        { site: "booking", url: "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0" }
      ],
      highlights: [],
      days: [
        { d: 1, date: "Sat 3 Oct", arrive: true, title: "Fly in, train to Florence",
          items: [
            "KEF 09:00 → MXP 15:10; Malpensa Express to Milano Centrale (~50 min)",
            "Frecciarossa Milan → Florence (~2 h, direct). Arrive ~19:30",
            "Check in near SMN; easy dinner, early night"
          ] }
      ]
    },
    {
      key: "valdorcia", pin: 2, emoji: "🍷", name: "Val d'Orcia",
      stay: "Vineyard villa w/ pool (Airbnb)", nights: 6, dates: "Sun 4 – Sat 10 Oct",
      color: "#8e3b46", coord: [43.057, 11.489], carFree: false,
      book: [
        { site: "airbnb",  url: "https://www.airbnb.com/s/Montalcino--Tuscany--Italy/homes?checkin=2026-10-04&checkout=2026-10-10&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7" },
        { site: "booking", url: "https://www.booking.com/searchresults.html?ss=Montalcino%2C+Italy&checkin=2026-10-04&checkout=2026-10-10&group_adults=2&no_rooms=1&group_children=0" }
      ],
      highlights: [
        { name: "Pienza", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city'" },
        { name: "Montepulciano", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town" },
        { name: "Bagno Vignoni", coord: [43.0280, 11.6170], note: "thermal square + free pools" },
        { name: "Abbey of Sant'Antimo", coord: [43.0170, 11.5120], note: "Romanesque abbey" }
      ],
      days: [
        { d: 2, date: "Sun 4 Oct", arrive: true, title: "Pick up car, down to Val d'Orcia",
          leg: { mode: "car", text: "Florence → Montalcino · ~1 h 45 / 150 km" },
          items: [
            "Collect rental at Firenze SMN; drive south (avoid the Florence ZTL)",
            "Check in at the villa; stock up on groceries en route",
            "Pool, sunset over the Val d'Orcia; pre-book one Brunello tasting"
          ] },
        { d: 3, date: "Mon 5 Oct", title: "Settle in + Montalcino town",
          items: [
            "Slow morning at the villa (pool, vineyard walk)",
            "Montalcino (~15 min): Fortezza, enoteca Brunello flight, Museo Civico",
            "Dinner in town — pinci, cinta senese"
          ] },
        { d: 4, date: "Tue 6 Oct", title: "Pienza & the pecorino",
          items: [
            "Pienza (~30 min): cheese shops, the 'ideal city', Piccolomini palace",
            "Cypress viewpoints (Cappella di Vitaleta, the 'Gladiator' road) at late light"
          ] },
        { d: 5, date: "Wed 7 Oct", title: "Thermal Val d'Orcia",
          items: [
            "San Quirico d'Orcia (Horti Leonini) + walled Monticchiello",
            "Bagno Vignoni thermal square + free Parco dei Mulini pools"
          ] },
        { d: 6, date: "Thu 8 Oct", title: "Montepulciano (walkable cellars)",
          items: [
            "Vino Nobile cellars carved under the town — Contucci & De' Ricci, no estate drive",
            "Optional Bagni San Filippo white travertine springs on the way back"
          ] },
        { d: 7, date: "Fri 9 Oct", title: "Market, abbey, or just the pool",
          items: [
            "Friday market in Montalcino: produce, cheese, new-harvest oil",
            "Romanesque Abbey of Sant'Antimo",
            "Buy/ship wine + oil before the coast; pack"
          ] }
      ]
    },
    {
      key: "argentario", pin: 3, emoji: "🏖️", name: "Argentario / Maremma",
      stay: "Coast hotel (Argentario Golf Resort / La Roqqa)", nights: 4, dates: "Sat 10 – Wed 14 Oct",
      color: "#2f8f8a", coord: [42.393, 11.207], carFree: false,
      book: [
        { site: "airbnb",  url: "https://www.airbnb.com/s/Monte-Argentario--Tuscany--Italy/homes?checkin=2026-10-10&checkout=2026-10-14&adults=2&room_types%5B%5D=Entire%20home%2Fapt&amenities%5B%5D=7" },
        { site: "booking", url: "https://www.booking.com/searchresults.html?ss=Monte+Argentario%2C+Italy&checkin=2026-10-10&checkout=2026-10-14&group_adults=2&no_rooms=1&group_children=0" }
      ],
      highlights: [
        { name: "Spiaggia della Feniglia", coord: [42.409, 11.190], note: "pine-backed sandy beach" },
        { name: "Orbetello lagoon", coord: [42.441, 11.216], note: "WWF reserve, flamingos" },
        { name: "Isola del Giglio", coord: [42.363, 10.901], note: "ferry day-trip" }
      ],
      days: [
        { d: 8, date: "Sat 10 Oct", arrive: true, title: "Val d'Orcia → Argentario",
          leg: { mode: "car", text: "Montalcino → Porto Ercole · ~1 h 30 / 110 km" },
          items: [
            "Check in on the Argentario; first beach afternoon",
            "Seafood dinner in Porto Ercole"
          ] },
        { d: 9, date: "Sun 11 Oct", title: "Beach + Feniglia",
          items: [
            "Spiaggia della Feniglia: long pine-backed beach; bike the Duna Feniglia reserve",
            "Aperitivo on the Argentario; do nothing, on purpose"
          ] },
        { d: 10, date: "Mon 12 Oct", title: "Nature: Maremma park or the lagoon",
          items: [
            "Parco della Maremma (Alberese): coastal trails, wild beach, longhorn cattle",
            "OR Orbetello lagoon WWF reserve (flamingos) + causeway town",
            "Lagoon seafood and bottarga for dinner"
          ] },
        { d: 11, date: "Tue 13 Oct", title: "Boat day (weather permitting)",
          items: [
            "Ferry to Isola del Giglio, or a boat around the Argentario coves",
            "Last Maremma swim; early night (longer drive tomorrow)"
          ] }
      ]
    },
    {
      key: "cinqueterre", pin: 4, emoji: "🪨", name: "Cinque Terre",
      stay: "Monterosso hotel", nights: 2, dates: "Wed 14 – Fri 16 Oct", carFree: true,
      color: "#d2683f", coord: [44.146, 9.654],
      book: [
        { site: "airbnb",  url: "https://www.airbnb.com/s/Monterosso-al-Mare--Italy/homes?checkin=2026-10-14&checkout=2026-10-16&adults=2" },
        { site: "booking", url: "https://www.booking.com/searchresults.html?ss=Monterosso+al+Mare%2C+Italy&checkin=2026-10-14&checkout=2026-10-16&group_adults=2&no_rooms=1&group_children=0" }
      ],
      highlights: [
        { name: "Vernazza", coord: [44.135, 9.684], note: "harbour + castle" },
        { name: "Manarola", coord: [44.107, 9.729], note: "sunset icon" },
        { name: "Portovenere", coord: [44.048, 9.837], note: "boat trip, just south" }
      ],
      days: [
        { d: 12, date: "Wed 14 Oct", arrive: true, title: "Maremma → La Spezia (drop car) → Cinque Terre",
          leg: { mode: "car", text: "Porto Ercole → La Spezia · ~3 h 30 / 330 km · then train, no more driving" },
          items: [
            "Drive to La Spezia; return the rental at La Spezia Centrale",
            "Cinque Terre Express train to Monterosso (~15 min); check in",
            "Buy a Cinque Terre Card; evening on the beachfront"
          ] },
        { d: 13, date: "Thu 15 Oct", title: "The five villages by train + boat",
          items: [
            "Vernazza, Corniglia, Manarola (sunset icon), Riomaggiore",
            "Walk an OPEN trail section (low Blue Trail is often closed)",
            "Boat back if seas allow; seafood + Sciacchetrà wine"
          ] }
      ]
    },
    {
      key: "santamargherita", pin: 5, emoji: "⛵", name: "Santa Margherita Ligure",
      stay: "Harbour hotel", nights: 2, dates: "Fri 16 – Sun 18 Oct", carFree: true,
      color: "#2b5f8c", coord: [44.335, 9.210],
      book: [
        { site: "airbnb",  url: "https://www.airbnb.com/s/Santa-Margherita-Ligure--Italy/homes?checkin=2026-10-16&checkout=2026-10-18&adults=2" },
        { site: "booking", url: "https://www.booking.com/searchresults.html?ss=Santa+Margherita+Ligure%2C+Italy&checkin=2026-10-16&checkout=2026-10-18&group_adults=2&no_rooms=1&group_children=0" }
      ],
      highlights: [
        { name: "Portofino", coord: [44.303, 9.210], note: "piazzetta, Castello Brown, lighthouse" },
        { name: "San Fruttuoso", coord: [44.318, 9.174], note: "abbey in a hidden cove" },
        { name: "Camogli", coord: [44.349, 9.155], note: "quiet fishing village" }
      ],
      days: [
        { d: 14, date: "Fri 16 Oct", arrive: true, title: "Cinque Terre morning → Santa Margherita",
          leg: { mode: "train", text: "Monterosso → Santa Margherita · ~1 h (change at Levanto/Sestri)" },
          items: [
            "Monterosso beach, or boat to Portovenere (gorgeous, just south)",
            "Train north to Santa Margherita; check in",
            "Harbour passeggiata + aperitivo; focaccia, pesto"
          ] },
        { d: 15, date: "Sat 17 Oct", title: "Portofino, San Fruttuoso & Camogli",
          items: [
            "Ferry to Portofino: piazzetta, Castello Brown, lighthouse; swim at Paraggi cove",
            "Boat to the San Fruttuoso abbey in its hidden cove",
            "Last Riviera dinner; pack"
          ] }
      ]
    },
    {
      key: "home", pin: "✈", emoji: "🛫", name: "Home",
      stay: "", nights: 0, dates: "Sun 18 Oct", carFree: false,
      color: "#9a9186", coord: null, highlights: [],
      days: [
        { d: 16, date: "Sun 18 Oct", title: "Riviera → Malpensa, fly home (no car)",
          leg: { mode: "train", text: "Santa Margherita → Malpensa · ~3 h 15 door-to-door by train" },
          items: [
            "Train Sta Margherita → Milano Centrale (~2 h 15); leave by ~09:30",
            "Malpensa Express to MXP (~50 min); Wizz Air departs Terminal 2",
            "MXP 16:00 → KEF 18:20; be at the terminal by ~13:30"
          ] }
      ]
    }
  ]
};
