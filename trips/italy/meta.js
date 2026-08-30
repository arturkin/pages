/* =============================================================================
   MAP-ONLY METADATA for the Italy trip — merged into trip.js by assets/sync.js.
   The human-edited plan lives in itinerary.md; this file carries everything the
   map needs that the doc doesn't: coordinates, colours, pins, highlight markers,
   booking links, POI layers and per-leg travel modes.

   `bases` are matched to itinerary.md's bases BY ORDER (counts must match).
   ========================================================================== */

// stay links. The three countryside stays are BOOKED — these point at the property
// pages; only the Florence arrival night is still a search.
const STAY = {
  montelodoli: "https://www.to-tuscany.com/montelodolicapanna/",
  locanda:     "https://www.locandaintuscany.it/"
};
const BOOKING = {
  florence: "https://www.booking.com/searchresults.html?ss=Florence%2C+Italy&checkin=2026-10-03&checkout=2026-10-04&group_adults=2&no_rooms=1&group_children=0"
};

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
  // — Chianti Classico (the Day 8–13 base) —
  { name: "Castello di Brolio", cat: "winery", coord: [43.4135, 11.4639], note: "Gaiole · the Ricasoli castle where the Chianti recipe was written — gardens, cellar tour, tastings (2 km from the house)" },
  { name: "Osteria del Castello di Brolio", cat: "restaurant", coord: [43.4157, 11.4606], note: "Brolio · the castle's own osteria, terrace over the vines — book" },
  { name: "Badia a Coltibuono", cat: "winery", coord: [43.4942, 11.4502], note: "Gaiole · 11th-c. abbey turned wine estate — monastic garden, cellar tasting, Rinuccio 1180 restaurant with the view" },
  { name: "Castello di Meleto", cat: "winery", coord: [43.4500, 11.4244], note: "Gaiole · frescoed castle + cellar, tastings and a tiny theatre" },
  { name: "Castello di Volpaia", cat: "winery", coord: [43.5168, 11.3810], note: "Radda · the winery IS the village — cellars threaded through medieval houses" },
  { name: "Bar Ucci", cat: "bar", coord: [43.5167, 11.3812], note: "Volpaia · the village bar on the square, crostini + a glass of Volpaia" },
  { name: "Antica Macelleria Cecchini", cat: "restaurant", coord: [43.5445, 11.3164], note: "Panzano · Dario Cecchini's butcher-theatre, the Chiantigiana institution — book the set meals" },
  // — Val d'Orcia —
  { name: "Casato Prime Donne", cat: "winery", coord: [43.0882, 11.4643], rating: 4.7, note: "Montalcino · first all-women winery, Brunello tasting in an art-filled cellar" },
  { name: "Ciacci Piccolomini d'Aragona", cat: "winery", coord: [42.9896, 11.5111], rating: 4.6, note: "Castelnuovo dell'Abate · organic Brunello by Sant'Antimo, small tours + terrace" },
  { name: "Salcheto", cat: "winery", coord: [43.0811, 11.7950], rating: 4.4, note: "Montepulciano · off-grid organic Vino Nobile + farm restaurant" },
  { name: "Enoteca Osticcio", cat: "wineshop", coord: [43.0579, 11.4905], rating: 4.3, note: "Montalcino · deep Brunello list + panoramic terrace" },
  { name: "Intralci Wine Bar", cat: "bar", coord: [43.0594, 11.6044], rating: 4.6, note: "San Quirico d'Orcia · tiny natural-wine bar + tapas" },
  { name: "Osteria Acquacheta", cat: "restaurant", coord: [43.0914, 11.7813], rating: 4.8, note: "Montepulciano · legendary bistecca alla fiorentina, shared tables — reserve" },
  { name: "Osteria La Porta", cat: "restaurant", coord: [43.0682, 11.7245], rating: 4.5, note: "Monticchiello · cucina povera + valley-view terrace, book the sunset tables" },
  { name: "Trattoria Toscana al Vecchio Forno", cat: "restaurant", coord: [43.0598, 11.6047], rating: 4.4, note: "San Quirico d'Orcia · pici + steak in a 16th-c. bakery courtyard" },
  // — Maremma & Etruscan coast (the Day-2 drive down) —
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

module.exports = {
  // map-wide options
  map: {
    photoRegion: "Italy",                 // appended to image searches for context
    legend: {
      car:   "Car (round-trip from Florence)",
      train: "Train",
      hub:   "Malpensa airport",
      sleep: "Where you sleep (1–4) · 5 = day visit",
      sleepColor: "#8e3b46"
    }
  },

  hubs: [
    { name: "Malpensa (MXP)", coord: [45.630, 8.723], note: "arrive Day 1 · depart Day 16" }
  ],
  waypoints: [],

  bases: [
    { key: "florence", name: "Florence", color: "#5b6b8c", pin: 1, coord: [43.776, 11.248],
      book: [{ site: "booking", url: BOOKING.florence }], highlights: [] },
    { key: "argentario", name: "Argentario · Porto Santo Stefano", color: "#2f8f8a", pin: 2, coord: [42.43726, 11.13755],
      book: [],
      highlights: [
        { name: "Porto Santo Stefano", type: "town", coord: [42.4356, 11.1178], note: "the harbour below the house — groceries, seafood, Spanish Fortress views" },
        { name: "Spiaggia della Feniglia", type: "beach", coord: [42.4080, 11.1850], note: "pine-backed sandy beach + dune reserve (~25 min)" },
        { name: "Parco della Maremma", type: "nature", coord: [42.6558, 11.1053], note: "wild coastal park, trails, cattle (~45 min)" },
        { name: "Orbetello lagoon", type: "nature", coord: [42.4510, 11.2050], note: "WWF reserve, flamingos" },
        { name: "Cala del Gesso", type: "beach", coord: [42.3620, 11.1320], note: "clear-water cove, footpath down" },
        { name: "Giardino dei Tarocchi", type: "art", coord: [42.4028, 11.4308], note: "mosaic sculpture park (closes 15 Oct)" },
        { name: "Castiglione della Pescaia", type: "town", coord: [42.7620, 10.8760], note: "medieval seaside town (Day-2 coast drive down)" },
        { name: "Bolgheri", type: "wine", coord: [43.2287, 10.6018], note: "cypress avenue + Super Tuscan wine (Day-2 coast drive down)" },
        { name: "Isola del Giglio", type: "beach", coord: [42.3630, 10.9010], note: "island ferry day-trip" },
        { name: "Golfo di Baratti", type: "nature", coord: [42.9959, 10.4980], note: "Etruscan bay + Populonia (Day-2 coast drive down)" },
        { name: "Massa Marittima", type: "town", coord: [43.0500, 10.8880], note: "underrated medieval town in the Colline Metallifere (~1 h inland day-trip)" }
      ] },
    { key: "chianti", name: "Chianti Classico · Montelodoli Capanna", color: "#7d1f3c", pin: 3, coord: [43.41452, 11.44093],
      book: [{ site: "hotel", url: STAY.montelodoli }],
      highlights: [
        { name: "Castello di Brolio", type: "wine", coord: [43.4135, 11.4639], note: "2 km — the Ricasoli castle, gardens + Brunello-of-Chianti tastings" },
        { name: "Monti in Chianti", type: "town", coord: [43.4019, 11.4255], note: "the hamlet at your gate (2 km)" },
        { name: "Gaiole in Chianti", type: "town", coord: [43.4683, 11.4342], note: "the market town — COOP supermarket, cafés (11 km / 12 min)" },
        { name: "Castello di Meleto", type: "wine", coord: [43.4500, 11.4244], note: "frescoed castle + cellar tastings (10 min)" },
        { name: "Badia a Coltibuono", type: "wine", coord: [43.4942, 11.4502], note: "abbey turned wine estate, garden + restaurant (17 min)" },
        { name: "Radda in Chianti", type: "town", coord: [43.4871, 11.3747], note: "walled hill town, the ring-road walk (20 min)" },
        { name: "Volpaia", type: "wine", coord: [43.5168, 11.3810], note: "a whole medieval village that is one winery (27 min)" },
        { name: "Panzano in Chianti", type: "town", coord: [43.5449, 11.3159], note: "Dario Cecchini's butcher-theatre on the Chiantigiana (35 min)" },
        { name: "Greve in Chianti", type: "town", coord: [43.6069, 11.3320], note: "the arcaded triangular square, top of the SR222 (44 min)" },
        { name: "San Gusmè", type: "town", coord: [43.3879, 11.4983], note: "tiny walled hamlet just south (15 min)" },
        { name: "Siena", type: "town", coord: [43.3188, 11.3308], note: "Piazza del Campo, Duomo — 28 min" },
        { name: "Monteriggioni", type: "town", coord: [43.3906, 11.2231], note: "circular walled castle-village (41 min)" },
        { name: "San Gimignano", type: "town", coord: [43.4677, 11.0431], note: "the towers — Day-10 day-trip (~1 h 10)" },
        { name: "Abbazia di San Galgano", type: "church", coord: [43.1494, 11.1553], note: "roofless Gothic abbey + the sword in the stone (Montesiepi) — on the Day-6 drive up from the coast" },
        { name: "Bagni di Petriolo", type: "thermal", coord: [43.0803, 11.2995], note: "wild free hot springs in a river gorge — on the Day-6 drive up from the coast" }
      ] },
    { key: "valdorcia", name: "Val d'Orcia · Locanda in Tuscany", color: "#8e3b46", pin: 4, coord: [43.00459, 11.69611],
      book: [{ site: "hotel", url: STAY.locanda }],
      highlights: [
        { name: "Castiglione d'Orcia", type: "town", coord: [43.0071, 11.6155], note: "your comune — stone hill town (10 min)" },
        { name: "Rocca d'Orcia", type: "town", coord: [43.0096, 11.6142], note: "the Rocca di Tentennano tower over the valley (10 min)" },
        { name: "Bagno Vignoni", type: "thermal", coord: [43.0281, 11.6187], note: "thermal square + the free Parco dei Mulini pools (17 min)" },
        { name: "Bagni San Filippo", type: "thermal", coord: [42.9260, 11.6180], note: "white travertine hot springs, 'Fosso Bianco' (25 min)" },
        { name: "Pienza", type: "town", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city' (30 min)" },
        { name: "Pieve di Corsignano", type: "church", coord: [43.0770, 11.6714], note: "Romanesque parish church below Pienza's walls" },
        { name: "Montepulciano", type: "wine", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town (38 min)" },
        { name: "Monticchiello", type: "town", coord: [43.0699, 11.7007], note: "quiet walled hilltop village, sunset terraces" },
        { name: "Montalcino", type: "wine", coord: [43.0570, 11.4890], note: "Brunello town, Fortezza, enoteca — FRIDAY market (40 min)" },
        { name: "Abbey of Sant'Antimo", type: "church", coord: [43.0170, 11.5120], note: "Romanesque abbey below Montalcino" },
        { name: "San Quirico d'Orcia", type: "town", coord: [43.0592, 11.6039], note: "Horti Leonini gardens, walled town (15 min)" },
        { name: "Cappella di Vitaleta", type: "church", coord: [43.0668, 11.6355], note: "the iconic cypress-framed chapel" },
        { name: "Podere Belvedere", type: "nature", coord: [43.0621, 11.6205], note: "the most photographed farmhouse in the Val d'Orcia" },
        { name: "Asciano", type: "town", coord: [43.2340, 11.5606], note: "Crete Senesi market town — on the Day-12 drive down" },
        { name: "Monte Oliveto Maggiore", type: "church", coord: [43.1719, 11.5478], note: "great abbey in a cypress wood, Signorelli & Sodoma — on the Day-12 drive down" },
        { name: "Buonconvento", type: "town", coord: [43.1382, 11.4821], note: "walled town, good market — on the Day-12 drive down" },
        { name: "Trequanda", type: "town", coord: [43.1817, 11.6486], note: "quiet Crete hilltop village (35 min)" }
      ] },
    { key: "florence2", name: "Florence", color: "#7a6b9c", pin: 5, coord: [43.7696, 11.2558],
      book: [],
      highlights: [
        { name: "Ponte Vecchio", type: "town", coord: [43.7680, 11.2531], note: "goldsmiths' bridge" },
        { name: "Piazzale Michelangelo", type: "town", coord: [43.7629, 11.2650], note: "the classic city view" },
        { name: "Duomo di Firenze", type: "church", coord: [43.7731, 11.2560], note: "Brunelleschi's dome" },
        { name: "Uffizi Gallery", type: "art", coord: [43.7678, 11.2553], note: "Renaissance masterpieces" },
        { name: "San Lorenzo Market", type: "market", coord: [43.7766, 11.2536], note: "leather + the food hall" },
        { name: "Boboli Gardens", type: "nature", coord: [43.7629, 11.2486], note: "Pitti palace gardens" }
      ] },
    { key: "home", name: "Home", color: "#9a9186", pin: "\u2708", coord: null, book: [], highlights: [] }
  ],

  // toggleable POI layers (each renders a legend toggle + map markers)
  layers: [
    { key: "food", label: "Food & wine (>4★)", on: false,
      cats: {
        winery:     { icon: "🍇", label: "Winery / tasting" },
        wineshop:   { icon: "🥂", label: "Wine shop / enoteca" },
        restaurant: { icon: "🍽️", label: "Restaurant" },
        bar:        { icon: "🍸", label: "Bar / aperitivo" }
      },
      points: FOOD }
  ],

  // travel-mode for each transfer day (doc's ">>" line gives the text, not the mode)
  legMode: { 2: "car", 6: "car", 12: "car", 15: "car" }
};
