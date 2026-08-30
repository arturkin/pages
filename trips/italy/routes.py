import json, subprocess, os
# OSRM geometry for the reversed Italy trip, tagged by day so each transfer
# day's route can be toggled on the map (same pattern as westfjords).
# Regenerate:  python3 trips/italy/routes.py   (then run: node assets/sync.js)
BASE="https://router.project-osrm.org/route/v1/driving/{}?overview=simplified&geometries=geojson"
def route(a,b):
    url=BASE.format(f"{a[0]},{a[1]};{b[0]},{b[1]}")
    try:
        r=json.loads(subprocess.run(["curl","-s","--max-time","30",url],capture_output=True,text=True).stdout)['routes'][0]
        g=r['geometry']['coordinates']
        return [[round(c[1],5),round(c[0],5)] for c in g], round(r.get('distance',0)/1000), True
    except Exception as e:
        print("  fallback:",e); return [[a[1],a[0]],[b[1],b[0]]], 0, False

# (lon,lat) — the three countryside stays are the real booked addresses
MXP=(8.723,45.630);MIL=(9.204,45.487);FLO=(11.248,43.776)
PSS=(11.13755,42.43726)                      # the house at Poggio Calvello, Porto Santo Stefano
CHI=(11.44093,43.41452)                      # Montelodoli Capanna, Monti in Chianti
LOC=(11.69611,43.00459)                      # Locanda in Tuscany, Gallina (Castiglione d'Orcia)
BOL=(10.6018,43.2287);CDP=(10.8760,42.7620)  # Bolgheri, Castiglione della Pescaia (Day-2 coast stops)
SG=(11.1553,43.1494);PET=(11.2995,43.0803)   # San Galgano, Bagni di Petriolo (Day-6 interior stops)
ASC=(11.5606,43.2340);MOM=(11.5478,43.1719)  # Asciano, Monte Oliveto Maggiore (Day-12 crete stops)
BUO=(11.4821,43.1382)                        # Buonconvento (Day-12)

# each leg: (day, mode, from, to). Train legs use the road corridor as an
# approximation of the rail line. Day 15 = drive to Florence + evening train north.
legs=[
 (1,"train",MXP,MIL),(1,"train",MIL,FLO),                      # Day 1: arrive, train to Florence
 (2,"car",FLO,BOL),(2,"car",BOL,CDP),(2,"car",CDP,PSS),        # Day 2: coast road south (longest drive)
 (6,"car",PSS,PET),(6,"car",PET,SG),(6,"car",SG,CHI),          # Day 6: wild interior up to Chianti
 (12,"car",CHI,ASC),(12,"car",ASC,MOM),(12,"car",MOM,BUO),(12,"car",BUO,LOC),  # Day 12: across the Crete Senesi
 (15,"car",LOC,FLO),(15,"train",FLO,MIL),(15,"train",MIL,MXP), # Day 15: Florence + night run to MXP
]
out=[]
for i,(day,mode,a,b) in enumerate(legs,1):
    coords,km,ok=route(a,b); print(f"leg {i} day{day} {mode}: {len(coords)} pts {km} km {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"day":day,"km":km,"coords":coords})
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"routes.js")
open(OUT,"w").write("// Auto-generated route geometry (OSRM driving), tagged by day. coords=[lat,lon]. Regenerate with routes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote "+OUT)
