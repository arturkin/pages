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

# (lon,lat)
MXP=(8.723,45.630);MIL=(9.204,45.487);FLO=(11.248,43.776)
CRE=(11.5606,43.2340);MON=(11.4506,43.0272);PE=(11.2064,42.3924);BOL=(10.6018,43.2287)
CDP=(10.8760,42.7620)                        # Castiglione della Pescaia (Day-2 coast stop)
SG=(11.1553,43.1494);PET=(11.2995,43.0803)   # San Galgano, Bagni di Petriolo (Day-6 interior stops)

# each leg: (day, mode, from, to). Train legs use the road corridor as an
# approximation of the rail line. Day 15 = drive to Florence + evening train north.
legs=[
 (1,"train",MXP,MIL),(1,"train",MIL,FLO),                     # Day 1: arrive, train to Florence
 (2,"car",FLO,BOL),(2,"car",BOL,CDP),(2,"car",CDP,PE),        # Day 2: coast road south (longest drive)
 (6,"car",PE,PET),(6,"car",PET,SG),(6,"car",SG,CRE),          # Day 6: wild interior up to the Crete
 (11,"car",CRE,MON),                                          # Day 11: short hop to the vineyard
 (15,"car",MON,FLO),(15,"train",FLO,MIL),(15,"train",MIL,MXP),# Day 15: Florence + night run to MXP
]
out=[]
for i,(day,mode,a,b) in enumerate(legs,1):
    coords,km,ok=route(a,b); print(f"leg {i} day{day} {mode}: {len(coords)} pts {km} km {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"day":day,"km":km,"coords":coords})
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"routes.js")
open(OUT,"w").write("// Auto-generated route geometry (OSRM driving), tagged by day. coords=[lat,lon]. Regenerate with routes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote "+OUT)
