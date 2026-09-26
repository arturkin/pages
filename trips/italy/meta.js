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
  { name: "Badia a Coltibuono", cat: "winery", coord: [43.4947, 11.4497], note: "Gaiole · 11th-c. abbey turned wine estate — cellar tour + tasting from €30; abbey restaurant 12:00–14:30 / 19:00–21:30, closed Tue" },
  { name: "Castello di Meleto", cat: "winery", coord: [43.4500, 11.4244], note: "Gaiole · frescoed castle + cellar, tastings and a tiny theatre" },
  { name: "Castello di Volpaia", cat: "winery", coord: [43.5168, 11.3810], note: "Radda · the winery IS the village — cellars threaded through medieval houses" },
  { name: "Bar Ucci", cat: "bar", coord: [43.5167, 11.3812], note: "Volpaia · the village bar on the square, crostini + a glass of Volpaia" },
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

// Farmers markets + producer shops on the driving days. Hours checked 26 Sep 2026 for the exact
// date (official sites / comune calendars / Google listings). Names are linked in the day text.
// cat: market | cheese | butcher | oil | deli | bakery | fish | farmshop | wine | grocery
const gm = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
const PRODUCE = [
  // — Day 2 · Sun 4 Oct · coast road south —
  { name: "Piccolo Frantoio di Bolgheri", cat: "oil", coord: [43.2374, 10.5749], rating: 4.8, url: gm("Piccolo Frantoio di Bolgheri"), note: "Day 2 · Sun 09:00–12:30, 14:00–18:00 · tiny family mill, single-variety oils" },
  { name: "Terre del Marchesato", cat: "wine", coord: [43.2148, 10.5814], rating: 4.8, url: gm("Terre del Marchesato Bolgheri"), note: "Day 2 · daily 11:30–17:30 · Bolgheri DOC, book tastings (+39 0565 749752)" },
  { name: "Gastronomia Agricola Pavone", cat: "deli", coord: [42.7833, 10.9135], rating: 4.5, url: gm("Agriturismo Pavone Castiglione della Pescaia"), note: "Day 2 · Sun 09:00–22:00 (closed Mon) · farm deli + table: own artichokes, passata, oil" },
  { name: "Antica Fattoria La Parrina", cat: "farmshop", coord: [42.4918, 11.2479], rating: 4.3, url: gm("Antica Fattoria La Parrina bottega Albinia"), note: "Day 2 · Sun 09:30–17:00 (safe window — call +39 0564 862626) · organic estate: cheese, wine, oil, veg" },
  { name: "Azienda Agricola Romualdi", cat: "farmshop", coord: [42.4760, 11.1907], rating: 5.0, url: gm("Azienda Agricola Riccardo Romualdi Orbetello"), note: "Days 2–5 · daily 08:00–13:00, 15:00–19:30 · farm stand on the Giannella road, own fruit + veg" },
  { name: "Famila Albinia", cat: "grocery", coord: [42.5056, 11.2148], url: gm("Famila Market Albinia"), note: "Day 2 · Sun 08:00–20:00 · big supermarket w/ deli counters — the Sunday fallback" },
  { name: "Conad City Porto Santo Stefano", cat: "grocery", coord: [42.4400, 11.1134], url: gm("Conad City Via Panoramica Porto Santo Stefano"), note: "Day 2 · Sun 08:00–13:00, 17:00–20:00 (afternoon unconfirmed) · the only in-town Sunday-evening option" },
  // — Argentario off days (Day 3 Mon · Day 5 Wed) —
  { name: "Alocci", cat: "bakery", coord: [42.4341, 11.1223], rating: 4.6, url: gm("Alocci Porto Santo Stefano"), note: "Days 3–5 · daily 06:00–19:30 · bakery + pastry" },
  { name: "Panificio Dalmazzi", cat: "bakery", coord: [42.4372, 11.1194], rating: 4.8, url: gm("Panificio Dalmazzi Porto Santo Stefano"), note: "Days 3–5 · Mon–Sat 07:15–13:15, 17:00–20:00" },
  { name: "Pescheria Da Roberto", cat: "fish", coord: [42.4366, 11.1204], rating: 4.7, url: gm("Pescheria Da Roberto Porto Santo Stefano"), note: "Day 5 · Wed 08:00–19:00 · CLOSED Mon · the harbour fishmonger" },
  // — Day 4 · Tue 6 Oct · lagoon, Feniglia, Tarocchi —
  { name: "Porto Santo Stefano Tuesday market", cat: "market", coord: [42.4326, 11.1233], url: gm("Mercato del martedì Porto Santo Stefano"), note: "Day 4 · Tue morning (hours unverified) · general market with fruit + veg" },
  { name: "I Pescatori di Orbetello", cat: "fish", coord: [42.4414, 11.2128], rating: 4.3, url: gm("Cooperativa I Pescatori di Orbetello Via Leopardi"), note: "Day 4 · Tue 08:30–13:00 · the lagoon co-op: own bottarga, smoked mullet + eel" },
  { name: "La Casareccia", cat: "deli", coord: [42.4379, 11.2097], rating: 4.8, url: gm("La Casareccia pasta fresca Orbetello"), note: "Day 4 · Tue 09:00–13:00, 16:45–19:30 · fresh pici + pasta" },
  { name: "Il Raggio", cat: "oil", coord: [42.4183, 11.4473], rating: 5.0, url: gm("Azienda Agricola Il Raggio Capalbio"), note: "Day 4 · Tue 09:00–13:00, 16:00–19:00 · organic oil at the farm, 2 km from the Tarocchi" },
  { name: "Caseificio Sociale Manciano", cat: "cheese", coord: [42.5380, 11.4429], rating: 4.6, url: gm("Caseificio Sociale Manciano"), note: "Day 4 (detour) · 07:00–19:30 · co-op dairy, Pecorino Toscano DOP" },
  // — Day 6 · Thu 8 Oct · coast → Chianti —
  { name: "Agrimercato Campagna Amica Grosseto", cat: "market", coord: [42.7614, 11.1242], url: gm("Agrimercato Campagna Amica Grosseto Via Scansanese"), note: "Day 6 · Thu 08:00–13:00 · farmers-only market (Cottolengo parish courtyard)" },
  { name: "Caseificio Podere Sant'Anna", cat: "cheese", coord: [43.2602, 11.3570], rating: 4.8, url: gm("Caseificio Podere Sant'Anna Siena"), note: "Day 6 · Thu 10:00–13:00, 17:00–20:00 · farm dairy, own pecorino (+39 0577 378007)" },
  { name: "Macelleria Minucci", cat: "butcher", coord: [43.3426, 11.5043], rating: 4.4, url: gm("A&O Castelnuovo Berardenga Via Turati"), note: "Day 6 · Thu 07:30–13:00, 15:30–19:30 · butcher counter inside the A&O, Castelnuovo Berardenga — full grocery too" },
  { name: "Macelleria Chini", cat: "butcher", coord: [43.4691, 11.4334], rating: 4.8, url: gm("Macelleria Chini Gaiole in Chianti"), note: "Days 6–11 · Mon–Sat 08:00–13:00, 16:30–19:30 · historic Cinta Senese butcher" },
  { name: "Coop Gaiole", cat: "grocery", coord: [43.4688, 11.4335], url: gm("Coop Gaiole in Chianti"), note: "Days 6–11 · Mon–Sat 08:00–12:45, 16:30–19:30 · Sun 08:30–12:30" },
  // — Day 8 · Sat 10 Oct · the Chiantigiana —
  { name: "Greve Saturday market", cat: "market", coord: [43.5825, 11.3193], url: gm("Piazza della Resistenza Greve in Chianti"), note: "Day 8 · Sat morning (~08:00–13:00) · food stalls in Piazza della Resistenza" },
  { name: "Antica Macelleria Falorni", cat: "butcher", coord: [43.5823, 11.3167], rating: 4.5, url: gm("Antica Macelleria Falorni Greve"), note: "Day 8 · Sat 09:00–19:30 · salumi, finocchiona, cheese cave" },
  { name: "Frantoio del Grevepesa", cat: "oil", coord: [43.5831, 11.3178], rating: 5.0, url: gm("O! Olio e dintorni Greve in Chianti"), note: "Day 8 · Sat 10:00–18:00 · the co-op mill's shop: taste + buy EVO" },
  { name: "Antica Macelleria Cecchini", cat: "butcher", coord: [43.5445, 11.3164], rating: 4.6, url: gm("Antica Macelleria Cecchini Panzano"), note: "Day 8 · daily 09:00–16:00 · Dario Cecchini's butcher-theatre; book Solociccia next door" },
  // — Day 10 · Mon 12 Oct · Siena —
  { name: "Pizzicheria de' Miccoli", cat: "deli", coord: [43.3165, 11.3301], url: gm("Pizzicheria de' Miccoli Siena"), note: "Day 10 · daily 10:00–20:00 · 1889 pizzicheria, Cinta Senese salumi, panini" },
  { name: "Panificio Il Magnifico", cat: "bakery", coord: [43.3183, 11.3298], url: gm("Panificio Il Magnifico Siena"), note: "Day 10 · Mon 08:00–19:30 · ricciarelli, panforte, cavallucci" },
  { name: "Consorzio Agrario di Siena", cat: "deli", coord: [43.3212, 11.3301], rating: 4.5, url: gm("Consorzio Agrario Siena Via Pianigiani"), note: "Days 6/10 · 08:30–20:00 · the farmers' co-op food hall: pecorino, salumi, oil, wine" },
  { name: "Gaiole monthly market", cat: "market", coord: [43.4682, 11.4340], url: gm("Piazza Ricasoli Gaiole in Chianti"), note: "Day 10 · 2nd Monday 14:00–20:00 (not confirmed by the comune) · general market" },
  // — Day 12 · Wed 14 Oct · Crete Senesi —
  { name: "La Botteghina di Luisa", cat: "deli", coord: [43.2341, 11.5607], url: gm("La Botteghina di Luisa Asciano"), note: "Day 12 · Wed from 12:30 — lunch stop (call +39 0577 718175) · Crete pecorino, Cinta Senese boards" },
  { name: "Agricola Monte Oliveto", cat: "wine", coord: [43.1747, 11.5447], url: gm("Agricola Monte Oliveto Maggiore cantina"), note: "Day 12 · 10:00–13:00, 14:30–18:30 · the monks' wine, oil, saffron, truffles" },
  { name: "Bottega delle Carni Orlandi", cat: "butcher", coord: [43.1372, 11.4820], url: gm("Bottega delle Carni Orlandi Buonconvento"), note: "Day 12 · Wed 08:00–13:00, 16:00–19:30 · 4th-generation butcher, own finocchiona" },
  // — Day 13 · Thu 15 Oct (off, optional) —
  { name: "Fattoria Pianporcino", cat: "cheese", coord: [43.0122, 11.7431], rating: 4.9, url: gm("Fattoria Pianporcino Pienza"), note: "Day 13 (optional, 13 min) · Thu 09:00–13:00, 15:00–19:00 · own sheep, Pecorino di Pienza; book tastings" },
  // — Day 14 · Fri 16 Oct · Montalcino + Pienza —
  { name: "Montalcino Friday market", cat: "market", coord: [43.0588, 11.4868], url: gm("Viale della Libertà Montalcino"), note: "Day 14 · Fri 08:00–13:00 · produce, porchetta, cheese" },
  { name: "Forno Valdorcia", cat: "bakery", coord: [43.0602, 11.4899], rating: 4.6, url: gm("Forno Valdorcia Montalcino"), note: "Day 14 · 06:30–13:00, 16:30–19:30" },
  { name: "Da Rizieri", cat: "deli", coord: [43.0589, 11.4898], rating: 4.6, url: gm("Da Rizieri Montalcino"), note: "Day 14 · Fri 10:00–19:00 (closed Sat) · deli on the piazza" },
  { name: "Enoteca Bruno Dalmazio", cat: "wine", coord: [43.0544, 11.4908], rating: 4.6, url: gm("Enoteca Bruno Dalmazio Montalcino"), note: "Day 14 · 09:00–20:00 · deep Brunello stock, ships abroad" },
  { name: "Marusco e Maria", cat: "cheese", coord: [43.0770, 11.6781], rating: 4.5, url: gm("Marusco e Maria Pienza"), note: "Day 14 · 09:30–13:00, 14:30–19:00 · Pienza pecorino since 1974, own ageing cave" },
  { name: "Caseificio Cugusi", cat: "cheese", coord: [43.1010, 11.7549], rating: 4.8, url: gm("Caseificio Cugusi"), note: "Day 14 (optional) · ~08:00–19:30 — call +39 0578 757558 · family dairy since 1962" },
  // — Day 15 · Sat 17 Oct · Val d'Orcia → Florence —
  { name: "Panificio Caselli", cat: "bakery", coord: [43.0587, 11.6038], rating: 4.9, url: gm("Panificio Caselli San Quirico d'Orcia"), note: "Day 15 · Mon–Sat 05:30–13:00 · San Quirico bakery, on the way out" },
  { name: "Mercato di Sant'Ambrogio", cat: "market", coord: [43.7705, 11.2668], url: gm("Mercato di Sant'Ambrogio Firenze"), note: "Day 15 · Sat 07:00–14:00 · the locals' food market" },
  { name: "Mercato Centrale", cat: "market", coord: [43.7766, 11.2532], url: gm("Mercato Centrale Firenze"), note: "Day 15 · ground floor Sat 07:00–17:00 (food hall upstairs to 23:00)" },
  { name: "Campagna Amica San Frediano", cat: "market", coord: [43.7708, 11.2386], url: gm("Mercato contadino San Frediano Firenze Via Pisana"), note: "Day 15 · Sat 08:30–14:00 · covered farmers' market, ~50 producers" },
  { name: "Pegna", cat: "deli", coord: [43.7721, 11.2568], rating: 4.4, url: gm("Pegna Firenze Via dello Studio"), note: "Day 15 · 10:00–19:00 · grocer since 1860: vacuum-packed pecorino, oil" },
  { name: "Procacci", cat: "deli", coord: [43.7718, 11.2515], rating: 4.5, url: gm("Procacci 1885 Firenze"), note: "Day 15 · 10:00–21:00 · truffle specialist, jars to take home" }
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
        { name: "Spiaggia della Feniglia", type: "beach", coord: [42.4134, 11.2441], note: "pine-backed sandy beach + dune reserve (~25 min)" },
        { name: "Parco della Maremma", type: "nature", coord: [42.6558, 11.1053], note: "wild coastal park, trails, cattle (~45 min)" },
        { name: "Orbetello lagoon", type: "nature", coord: [42.4510, 11.2050], note: "WWF reserve, flamingos" },
        { name: "Cala del Gesso", type: "beach", coord: [42.3620, 11.1320], note: "clear-water cove, footpath down" },
        { name: "Giardino dei Tarocchi", type: "art", coord: [42.4247, 11.4683], note: "Niki de Saint Phalle mosaic park · daily 14:30–19:30 until 15 Oct · €15, buy online" },
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
        { name: "Badia a Coltibuono", type: "wine", coord: [43.4947, 11.4497], note: "abbey turned wine estate, garden + restaurant, closed Tue (17 min)" },
        { name: "Radda in Chianti", type: "town", coord: [43.4871, 11.3747], note: "walled hill town, the ring-road walk (20 min)" },
        { name: "Volpaia", type: "wine", coord: [43.5168, 11.3810], note: "a whole medieval village that is one winery (27 min)" },
        { name: "Panzano in Chianti", type: "town", coord: [43.5449, 11.3159], note: "Dario Cecchini's butcher-theatre on the Chiantigiana (35 min)" },
        { name: "Greve in Chianti", type: "town", coord: [43.6069, 11.3320], note: "the arcaded triangular square, top of the SR222 (44 min)" },
        { name: "San Gusmè", type: "town", coord: [43.3879, 11.4983], note: "tiny walled hamlet just south (15 min)" },
        { name: "Siena", type: "town", coord: [43.3188, 11.3308], note: "Piazza del Campo, Duomo — 28 min" },
        { name: "Monteriggioni", type: "town", coord: [43.3906, 11.2231], note: "circular walled castle-village (41 min)" },
        { name: "San Gimignano", type: "town", coord: [43.4677, 11.0431], note: "the towers — not scheduled (~1 h 10 each way), a swap for Siena if you prefer" },
        { name: "Abbazia di San Galgano", type: "church", coord: [43.1494, 11.1553], note: "roofless Gothic abbey + the sword in the stone (Montesiepi) · 09:00–19:00, €8 — Day-6 drive up" },
        { name: "Bagni di Petriolo", type: "thermal", coord: [43.0803, 11.2995], note: "wild free hot springs in a river gorge — on the Day-6 drive up from the coast" }
      ] },
    { key: "valdorcia", name: "Val d'Orcia · Locanda in Tuscany", color: "#8e3b46", pin: 4, coord: [43.00459, 11.69611],
      book: [{ site: "hotel", url: STAY.locanda }],
      highlights: [
        { name: "Castiglione d'Orcia", type: "town", coord: [43.0071, 11.6155], note: "your comune — stone hill town (10 min)" },
        { name: "Rocca d'Orcia", type: "town", coord: [43.0096, 11.6142], note: "the Rocca di Tentennano tower over the valley (10 min)" },
        { name: "Bagno Vignoni", type: "thermal", coord: [43.0281, 11.6187], note: "thermal square + the free Parco dei Mulini pools (17 min)" },
        { name: "Bagni San Filippo", type: "thermal", coord: [42.9254, 11.7015], note: "white travertine hot springs, 'Fosso Bianco' — free, open all year (15 min)" },
        { name: "Pienza", type: "town", coord: [43.0766, 11.6787], note: "pecorino, the 'ideal city' (30 min)" },
        { name: "Pieve di Corsignano", type: "church", coord: [43.0770, 11.6714], note: "Romanesque parish church below Pienza's walls" },
        { name: "Montepulciano", type: "wine", coord: [43.0989, 11.7869], note: "Vino Nobile cellars under the town (38 min)" },
        { name: "Monticchiello", type: "town", coord: [43.0699, 11.7007], note: "quiet walled hilltop village, sunset terraces" },
        { name: "Montalcino", type: "wine", coord: [43.0570, 11.4890], note: "Brunello town, Fortezza, enoteca — FRIDAY market (40 min)" },
        { name: "Abbey of Sant'Antimo", type: "church", coord: [42.9995, 11.5155], note: "Romanesque abbey below Montalcino · 10:00–18:00" },
        { name: "San Quirico d'Orcia", type: "town", coord: [43.0592, 11.6039], note: "Horti Leonini gardens, walled town (15 min)" },
        { name: "Cappella di Vitaleta", type: "church", coord: [43.0709, 11.6344], note: "the iconic cypress-framed chapel — gate on the track, ~1 km on foot" },
        { name: "Podere Belvedere", type: "nature", coord: [43.0621, 11.6205], note: "the most photographed farmhouse in the Val d'Orcia" },
        { name: "Asciano", type: "town", coord: [43.2340, 11.5606], note: "Crete Senesi market town — on the Day-12 drive down" },
        { name: "Monte Oliveto Maggiore", type: "church", coord: [43.1752, 11.5440], note: "great abbey in a cypress wood, Signorelli & Sodoma · 09:30–12:40, 14:30–18:00 — Day-12 drive down" },
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
    { key: "produce", label: "Markets & produce (by day)", on: true, linkify: true,
      cats: {
        market:   { icon: "🧺", label: "Farmers / food market" },
        cheese:   { icon: "🧀", label: "Cheese / dairy" },
        butcher:  { icon: "🥩", label: "Butcher / salumi" },
        oil:      { icon: "🫒", label: "Olive oil" },
        deli:     { icon: "🥖", label: "Deli / pasta" },
        bakery:   { icon: "🥐", label: "Bakery" },
        fish:     { icon: "🐟", label: "Fish" },
        farmshop: { icon: "🌾", label: "Farm shop" },
        wine:     { icon: "🍾", label: "Wine shop / cellar door" },
        grocery:  { icon: "🛒", label: "Supermarket" }
      },
      points: PRODUCE },
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
  legMode: { 2: "car", 4: "car", 6: "car", 8: "car", 10: "car", 12: "car", 14: "car", 15: "car" }
};
