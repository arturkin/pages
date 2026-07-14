/* =============================================================================
   MAP-ONLY METADATA for the Westfjords trip — merged into trip.js by sync.js.
   Human-edited plan: trips/westfjords/itinerary.md. `bases` match the doc's
   bases BY ORDER. Theme = natural hot pools + fjord scenery; EV road-trip, so
   chargers are a layer and friends' recommendations are a "local tips" layer.
   ========================================================================== */

const BOOKING = {
  strond:    "https://www.booking.com/hotel/is/strond-guesthouse.html?label=gen173bo-10CAsocEIRc3Ryb25kLWd1ZXN0aG91c2VIMVgDaHCIAQGYATO4AQfIAQzYAQPoAQH4AQGIAgGYAgSoAgG4AtLd09IGwAIB0gIkOGYxZWRlNjEtOGQwNS00Y2NiLTlkMjAtZWRlODc5YzYwMzQx2AIB4AIB",
  westfjords: "https://www.booking.com/hotel/is/westfjords-apartment.html?label=gen173bo-10CAsocEIUd2VzdGZqb3Jkcy1hcGFydG1lbnRIMVgDaHCIAQGYATO4AQfIAQzYAQPoAQH4AQGIAgGYAgSoAgG4AtXd09IGwAIB0gIkOTY2MzVlMGYtZmRjZC00MGMzLWEzZjktMGM3Y2Y3NjlkNTI22AIB4AIB"
};

module.exports = {
  map: {
    page: "westfjords.html",
    photoRegion: "Iceland Westfjords",
    legend: {
      car:   "Car (round-trip from Reykjavík)",
      sleep: "Where you sleep (1–2)",
      sleepColor: "#2f7f8f"
    }
  },

  hubs: [],        // no flights — a domestic road trip from/to Reykjavík
  waypoints: [],

  bases: [
    { key: "birkimelur", name: "Birkimelur", color: "#2f7f8f", pin: 1, coord: [65.5209, -23.4191],
      book: [{ site: "booking", url: BOOKING.strond }],
      highlights: [
        { name: "Kirkjufell", type: "viewpoint", coord: [64.9275, -23.3086], note: "iconic peak + Kirkjufellsfoss at Grundarfjörður — Day-1 drive up (fair weather)" },
        { name: "Stykkishólmur", type: "town", coord: [65.0748, -22.7276], note: "Snæfellsnes harbour town, Súgandisey lighthouse — Day-1 lunch stop" },
        { name: "Rauðasandur", type: "beach", coord: [65.4667, -24.0500], note: "vast red-gold sand beach — Day 2 (Rte 614, gravel — go slow)" },
        { name: "Látrabjarg", type: "wildlife", coord: [65.5030, -24.5330], note: "Europe's westernmost cliffs, puffins to early Aug — Day-2 fair-weather add-on" }
      ] },
    { key: "bolungarvik", name: "Bolungarvík", color: "#7a4b6b", pin: 2, coord: [66.1560, -23.2620],
      book: [{ site: "booking", url: BOOKING.westfjords }],
      highlights: [
        { name: "Dynjandi", type: "waterfall", coord: [65.7333, -23.2050], note: "the Westfjords' great tiered waterfall — the Day-3 transfer highlight" },
        { name: "Þingeyri", type: "town", coord: [65.8730, -23.4930], note: "Dýrafjörður village, lunch stop — Day 3" },
        { name: "Sandafell", type: "viewpoint", coord: [65.8726, -23.5061], note: "short gravel drive to a fjord panorama above Þingeyri — Day 3" },
        { name: "Ísafjörður", type: "town", coord: [66.0748, -23.1350], note: "the Westfjords' capital — old town, cafés, harbour" },
        { name: "Westfjords Heritage Museum", type: "museum", coord: [66.0681, -23.1275], note: "Byggðasafn Vestfjarða in Ísafjörður's old harbour — a good rainy-day stop" },
        { name: "Súðavík Arctic Fox Centre", type: "wildlife", coord: [66.0304, -22.9914], note: "Iceland's only native land mammal — indoor, Day 4" },
        { name: "Bolafjall", type: "viewpoint", coord: [66.1790, -23.3325], note: "clifftop viewing platform above Bolungarvík — clear days only" },
        { name: "Vigur", type: "wildlife", coord: [66.0500, -22.8289], note: "island boat trip from Ísafjörður: puffins & eider — Day 4, weather-permitting" },
        { name: "Hólmavík", type: "town", coord: [65.7057, -21.6710], note: "Strandir hub — the Day-5 drive home" }
      ] }
  ],

  layers: [
    { key: "pools", label: "Hot pools & springs", icon: "♨️", on: true, points: [
      { name: "Hellulaug", coord: [65.5772, -23.1595], note: "natural seaside pool at Flókalundur, Vatnsfjörður — a short hop from Birkimelur" },
      { name: "Birkimelslaug", coord: [65.5209, -23.4083], note: "the little swimming pool right at Birkimelur" },
      { name: "Reykjafjarðarlaug", coord: [65.6231, -23.4691], note: "a built pool + a natural hot pool above it, Arnarfjörður" },
      { name: "Pollurinn", coord: [65.6491, -23.8949], note: "three natural hot tubs on the hillside above Tálknafjörður" },
      { name: "Reykjanes", coord: [65.9272, -22.4270], note: "big geothermal swimming pool (50 × 12.5 m) out in Ísafjarðardjúp" },
      { name: "Heydalur", coord: [65.8441, -22.6800], note: "nature pool + greenhouse hideaway in Mjóifjörður" },
      { name: "Hörgshlíðarlaug", coord: [65.8310, -22.6288], note: "tiny seaside hot pool in Mjóifjörður (road 633) — ask the farmer's permission; near the Day-4 loop" },
      { name: "Drangsnes hot pots", coord: [65.6870, -21.4470], note: "free seaside hot pots on the Strandir coast — the Day-5 finale soak" },
      { name: "Gvendarlaug (Laugarhóll)", coord: [65.7815, -21.5201], note: "pool + the historic natural 'Gvendarlaug' at Hotel Laugarhóll, Bjarnarfjörður — a Strandir detour north of Drangsnes" },
      { name: "Krossneslaug", coord: [66.0556, -21.5080], note: "iconic beachside pool at Krossnes, far NE Strandir — spectacular but a long detour (~2 h+ past Hólmavík), not really on this route" }
    ] },
    { key: "chargers", label: "EV chargers", icon: "🔌", on: false, photos: false,
      cats: {
        fast: { icon: "⚡", label: "Fast charger (DC)" },
        slow: { icon: "🔌", label: "Standard (AC)" }
      },
      // ALL PlugShare public/restricted chargers in the route corridor (verified Jul 2026),
      // north→south. Live status: check the PlugShare / ON / Ísorka apps before relying on one.
      points: [
      { name: "Ráðhús Bolungarvíkur", coord: [66.1581, -23.2497], cat: "slow", note: "22 kW · AC charger" },
      { name: "Sundlaug Bolungarvíkur", coord: [66.1558, -23.2523], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Suðureyri", coord: [66.129, -23.5277], cat: "slow", note: "22 kW · AC charger" },
      { name: "N1 hraðhleðsla", coord: [66.0746, -23.1243], cat: "fast", note: "DC fast charger" },
      { name: "Menntaskólinn Ísafirði", coord: [66.0736, -23.1314], cat: "slow", note: "22 kW · AC charger" },
      { name: "Police", coord: [66.0727, -23.1212], cat: "slow", note: "AC charger" },
      { name: "Ísafjörður", coord: [66.0701, -23.122], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Avis Hraðhleðsla (Ísorka)", coord: [66.0544, -23.1434], cat: "fast", note: "75 kW · DC fast charger" },
      { name: "Flateyri Swimming Pool", coord: [66.0518, -23.5176], cat: "slow", note: "22 kW · AC charger" },
      { name: "Urðartindur guesthouse", coord: [66.0502, -21.5678], cat: "slow", note: "AC charger" },
      { name: "Ögur Travel", coord: [66.0395, -22.7288], cat: "slow", note: "AC charger" },
      { name: "Súðavík", coord: [66.026, -22.992], cat: "slow", note: "AC charger" },
      { name: "Holt Inn Country Hotel", coord: [66.0075, -23.4397], cat: "slow", note: "AC charger" },
      { name: "Hvítanes - Orkubú Vestfjarða", coord: [65.9923, -22.8142], cat: "slow", note: "22 kW · AC charger" },
      { name: "Korpudalur", coord: [65.9847, -23.3404], cat: "slow", note: "AC charger" },
      { name: "Hotel Djúpavík", coord: [65.9445, -21.5594], cat: "slow", note: "22 kW · AC charger" },
      { name: "Reykjanes - Orkubú Vestfjarða", coord: [65.9265, -22.4301], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Þingeyri", coord: [65.8801, -23.4918], cat: "slow", note: "22 kW · AC charger" },
      { name: "Heydalur Hotel", coord: [65.8441, -22.68], cat: "slow", note: "AC charger" },
      { name: "Hótel Laugarhóll", coord: [65.7811, -21.5188], cat: "slow", note: "22 kW · AC charger" },
      { name: "Mjólkárvirkjun", coord: [65.7731, -23.1674], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Gistihús Hólmavíkur", coord: [65.7068, -21.6674], cat: "slow", note: "22 kW · AC charger" },
      { name: "Museum of Icelandic Sorcery & Witchcraft", coord: [65.7065, -21.6659], cat: "fast", note: "240 kW · DC fast charger" },
      { name: "Campground in Hólmavík", coord: [65.7021, -21.6836], cat: "slow", note: "AC charger" },
      { name: "Stoppustuð við sundlaugina og tjaldstæðið", coord: [65.7019, -21.6853], cat: "slow", note: "AC charger" },
      { name: "Krambúðin Supermarket (1)", coord: [65.7012, -21.6861], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Hveravík", coord: [65.7011, -21.5618], cat: "slow", note: "AC charger" },
      { name: "Krambúðin Supermarket (2)", coord: [65.7011, -21.6862], cat: "fast", note: "250 kW · DC fast charger" },
      { name: "OV - Drangsnes", coord: [65.6886, -21.4468], cat: "slow", note: "22 kW · AC charger" },
      { name: "Orkubú Vestfjarða", coord: [65.6856, -23.5994], cat: "fast", note: "DC fast charger" },
      { name: "Harbour Inn Guesthouse", coord: [65.6854, -23.602], cat: "slow", note: "AC charger" },
      { name: "Vesturbyggð", coord: [65.6838, -23.603], cat: "slow", note: "22 kW · AC charger" },
      { name: "Tálknafjörður Swimming Pool", coord: [65.6284, -23.8456], cat: "slow", note: "22 kW · AC charger" },
      { name: "450 Patreksfjörður Patreksfjörður", coord: [65.5964, -24.0023], cat: "fast", note: "40 kW · DC fast charger" },
      { name: "Stoppustuð Íþróttasmiðstöðin Patreksfirði", coord: [65.5954, -23.9846], cat: "slow", note: "AC charger" },
      { name: "Fosshótel - Patreksfirði", coord: [65.5916, -23.977], cat: "slow", note: "22 kW · AC charger" },
      { name: "Djúpidalur", coord: [65.5828, -22.2819], cat: "fast", note: "30 kW · DC fast charger" },
      { name: "Hótel Flókalundur", coord: [65.5761, -23.1688], cat: "fast", note: "50 kW · DC fast charger" },
      { name: "Hótel Bjarkalundur", coord: [65.5559, -22.1035], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "OV - Reykhólar", coord: [65.4515, -22.2018], cat: "slow", note: "22 kW · AC charger" },
      { name: "Vogur Country Lodge", coord: [65.1769, -22.367], cat: "slow", note: "AC charger" },
      { name: "Dalakot Búðardal", coord: [65.1097, -21.7656], cat: "fast", note: "50 kW · DC fast charger" },
      { name: "Stjórnsýsluhúsið í Búðardal", coord: [65.1095, -21.7659], cat: "slow", note: "AC charger" },
      { name: "ON - Búðardal", coord: [65.1083, -21.7628], cat: "fast", note: "DC fast charger" },
      { name: "Ísorka - Kjörbúðin", coord: [65.1082, -21.763], cat: "fast", note: "DC fast charger" },
      { name: "The Castle Guesthouse", coord: [65.1061, -21.7711], cat: "slow", note: "AC charger" },
      { name: "Fransiskus Hótel", coord: [65.0775, -22.7223], cat: "slow", note: "AC charger" },
      { name: "Narfeyrarstofa", coord: [65.077, -22.7251], cat: "slow", note: "22 kW · AC charger" },
      { name: "Ísorka Stykkishólmur", coord: [65.0733, -22.7296], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Sundlaug Stykkishólmar/Swimming Pool", coord: [65.0732, -22.7303], cat: "slow", note: "AC charger" },
      { name: "Fosshótel Stykkishólmur", coord: [65.0722, -22.7251], cat: "slow", note: "AC charger" },
      { name: "Camping/Golf Club", coord: [65.0707, -22.7319], cat: "slow", note: "AC charger" },
      { name: "Hótel Stundarfriður", coord: [65.0037, -22.7078], cat: "slow", note: "AC charger" },
      { name: "Erpsstaðir Creamery", coord: [64.9998, -21.6253], cat: "fast", note: "30 kW · DC fast charger" },
      { name: "DÍS Cottages", coord: [64.9922, -23.2085], cat: "slow", note: "AC charger" },
      { name: "Ravencliff Lodge", coord: [64.9786, -21.7406], cat: "slow", note: "AC charger" },
      { name: "Bjargsteinn - Mathús (Ísorka)", coord: [64.9278, -23.2611], cat: "slow", note: "AC charger" },
      { name: "Fjölbrautaskóli Snæfellinga", coord: [64.9256, -23.2629], cat: "slow", note: "22 kW · AC charger" },
      { name: "Kaffi 59", coord: [64.9244, -23.2669], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Ólafsvík (Sker veitingastaður)", coord: [64.8954, -23.7072], cat: "slow", note: "AC charger" },
      { name: "ON - Ólafsvík", coord: [64.8953, -23.7085], cat: "fast", note: "150 kW · DC fast charger" },
      { name: "Við Hafið Guesthouse", coord: [64.8939, -23.7035], cat: "slow", note: "AC charger" },
      { name: "Ólafsvík Disc Golf Course", coord: [64.888, -23.6878], cat: "slow", note: "22 kW · AC charger" },
      { name: "eONE 50kW charger", coord: [64.86, -22.6652], cat: "fast", note: "DC fast charger" },
      { name: "Ræktunarstöðin Lágafell við Vegamót", coord: [64.8492, -22.7416], cat: "slow", note: "AC charger" },
      { name: "ON Power Charging Station - Hótel Snaefellsnes", coord: [64.8491, -22.7353], cat: "fast", note: "DC fast charger" },
      { name: "Lýsuhólslaug", coord: [64.8417, -23.213], cat: "slow", note: "AC charger" },
      { name: "Stoppustuð", coord: [64.8415, -23.213], cat: "slow", note: "AC charger" },
      { name: "Hótel Búðir", coord: [64.8231, -23.3842], cat: "slow", note: "11 kW · AC charger" },
      { name: "Hraunsnef Sveitahótel", coord: [64.7876, -21.5073], cat: "slow", note: "AC charger" },
      { name: "Háskólinn á Bifröst", coord: [64.7667, -21.5515], cat: "slow", note: "AC charger" },
      { name: "Arnarstapi", coord: [64.7665, -23.63], cat: "fast", note: "DC fast charger" },
      { name: "Fosshotel Hellnar", coord: [64.7522, -23.6491], cat: "slow", note: "22 kW · AC charger" },
      { name: "Háafell Goat farm", coord: [64.7095, -21.2518], cat: "slow", note: "AC charger" },
      { name: "Munaðarnes", coord: [64.698, -21.6192], cat: "slow", note: "22 kW · AC charger" },
      { name: "Hotel Varmaland", coord: [64.6881, -21.5939], cat: "slow", note: "22 kW · AC charger" },
      { name: "Orkan - Baulan", coord: [64.675, -21.6649], cat: "fast", note: "400 kW · DC fast charger" },
      { name: "ON Power Charging Station - Fosshótel Reykholt", coord: [64.6656, -21.2912], cat: "slow", note: "AC charger" },
      { name: "ON Power Charging Station - N1 Reykholt", coord: [64.6628, -21.2825], cat: "fast", note: "DC fast charger" },
      { name: "Nes Ferðaþjónusta", coord: [64.6626, -21.3397], cat: "slow", note: "22 kW · AC charger" },
      { name: "Hverinn Restaurant", coord: [64.6551, -21.4061], cat: "slow", note: "AC charger" }
    ] },
    { key: "tips", label: "Friends' local tips", icon: "💬", on: true, points: [
      { name: "Ytri-Tunga (seals)", coord: [64.8047, -23.0790], note: "harbour & grey seal colony on Snæfellsnes, best at low tide — Day 1" },
      { name: "Surtarbrandsgil", coord: [65.5279, -23.2555], note: "12-million-year plant fossils + a free exhibition at Brjánslækur (canyon hike only with a ranger) — Day 1/2" },
      { name: "Ósvör", coord: [66.1501, -23.2160], note: "open-air replica of an old fishing station just outside Bolungarvík — Day 4" },
      { name: "Þuríður settler statue", coord: [66.1552, -23.2605], note: "memorial to Bolungarvík's first settler, in town — Day 4" },
      { name: "Natural History Museum", coord: [66.1568, -23.2635], note: "Náttúrugripasafn Bolungarvíkur: the stuffed polar bear + Iceland's biggest bird collection — Day 4" },
      { name: "Whale watching (Hólmavík)", coord: [65.7052, -21.6712], note: "Láki Tours on sheltered Steingrímsfjörður — the 14:00 sailing if the sighting rate looks good — Day 5" },
      { name: "Museum of Sorcery & Witchcraft", coord: [65.7065, -21.6654], note: "Galdrasýning á Ströndum, Hólmavík — Day 5" }
    ] }
  ],

  // travel-mode for each transfer day (>> line). Days 2 & 4 are based-day loops.
  legMode: { 1: "car", 3: "car", 5: "car" }
};
