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
    { key: "birkimelur", name: "Birkimelur", color: "#2f7f8f", pin: 1, coord: [65.5340, -23.0180],
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
        { name: "Sandafell", type: "viewpoint", coord: [65.8760, -23.4400], note: "short gravel drive to a fjord panorama above Þingeyri — Day 3" },
        { name: "Ísafjörður", type: "town", coord: [66.0748, -23.1350], note: "the Westfjords' capital — old town, cafés, harbour" },
        { name: "Westfjords Heritage Museum", type: "museum", coord: [66.0730, -23.1290], note: "Byggðasafn Vestfjarða in Ísafjörður's old harbour — a good rainy-day stop" },
        { name: "Súðavík Arctic Fox Centre", type: "wildlife", coord: [66.0430, -22.9930], note: "Iceland's only native land mammal — indoor, Day 4" },
        { name: "Bolafjall", type: "viewpoint", coord: [66.1630, -23.2260], note: "clifftop viewing platform above Bolungarvík — clear days only" },
        { name: "Vigur", type: "wildlife", coord: [66.0400, -22.8300], note: "island boat trip from Ísafjörður: puffins & eider — Day 4, weather-permitting" },
        { name: "Hólmavík", type: "town", coord: [65.7050, -21.6870], note: "Strandir hub — the Day-5 drive home" }
      ] }
  ],

  layers: [
    { key: "pools", label: "Hot pools & springs", icon: "♨️", on: true, points: [
      { name: "Hellulaug", coord: [65.5560, -23.1870], note: "natural seaside pool at Flókalundur, Vatnsfjörður — a short hop from Birkimelur" },
      { name: "Birkimelslaug", coord: [65.5335, -23.0170], note: "the little swimming pool right at Birkimelur" },
      { name: "Reykjafjarðarlaug", coord: [65.6900, -23.4400], note: "a built pool + a natural hot pool above it, Arnarfjörður" },
      { name: "Pollurinn", coord: [65.6230, -23.8080], note: "three natural hot tubs on the hillside above Tálknafjörður" },
      { name: "Reykjanes", coord: [65.9200, -22.4120], note: "big geothermal swimming pool out in Ísafjarðardjúp" },
      { name: "Heydalur", coord: [65.8790, -22.6260], note: "nature pool + greenhouse hideaway in Mjóifjörður" },
      { name: "Drangsnes hot pots", coord: [65.6870, -21.4470], note: "free seaside hot pots on the Strandir coast — the Day-5 finale soak" }
    ] },
    { key: "chargers", label: "EV chargers", icon: "🔌", on: false, photos: false, points: [
      { name: "Borgarnes charger", coord: [64.5386, -21.9223], note: "ON/Ísorka fast chargers at the N1/Hyrnan hub — Day-1 top-up" },
      { name: "Búðardalur charger", coord: [65.1130, -21.7530], note: "charger in the village — handy before the Rte 60 passes" },
      { name: "Patreksfjörður charger", coord: [65.5960, -23.9990], note: "south-Westfjords charging — Day-2 lunch stop" },
      { name: "Þingeyri charger", coord: [65.8730, -23.4930], note: "charging in Dýrafjörður — Day-3 stop" },
      { name: "Ísafjörður charger", coord: [66.0740, -23.1350], note: "the main Westfjords fast-charging hub" },
      { name: "Bolungarvík charger", coord: [66.1545, -23.2600], note: "charging in town by your base" },
      { name: "Hólmavík charger", coord: [65.7050, -21.6870], note: "Strandir charging — Day-5 stop before the run south" }
    ] },
    { key: "tips", label: "Friends' local tips", icon: "💬", on: true, points: [
      { name: "Ytri-Tunga (seals)", coord: [64.8020, -23.0870], note: "harbour & grey seal colony on Snæfellsnes, best at low tide — Day 1" },
      { name: "Surtarbrandsgil", coord: [65.5450, -23.1600], note: "12-million-year plant fossils + a free exhibition at Brjánslækur (canyon hike only with a ranger) — Day 1/2" },
      { name: "Ósvör", coord: [66.1520, -23.2870], note: "open-air replica of an old fishing station just outside Bolungarvík — Day 4" },
      { name: "Þuríður settler statue", coord: [66.1552, -23.2605], note: "memorial to Bolungarvík's first settler, in town — Day 4" },
      { name: "Natural History Museum", coord: [66.1568, -23.2635], note: "Náttúrugripasafn Bolungarvíkur: the stuffed polar bear + Iceland's biggest bird collection — Day 4" },
      { name: "Whale watching (Hólmavík)", coord: [65.7050, -21.6830], note: "Láki Tours on sheltered Steingrímsfjörður — the 14:00 sailing if the sighting rate looks good — Day 5" },
      { name: "Museum of Sorcery & Witchcraft", coord: [65.7060, -21.6820], note: "Galdrasýning á Ströndum, Hólmavík — Day 5" }
    ] }
  ],

  // travel-mode for each transfer day (>> line). Days 2 & 4 are based-day loops.
  legMode: { 1: "car", 3: "car", 5: "car" }
};
