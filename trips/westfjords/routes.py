import json, subprocess, os
# OSRM driving geometry for the Westfjords loop, tagged by day so each day's
# driving can be toggled on the map. coords passed as (lon,lat).
# Regenerate:  python3 trips/westfjords/routes.py   (then run: node assets/sync.js)
BASE="https://router.project-osrm.org/route/v1/driving/{}?overview=simplified&geometries=geojson"
def route(a,b):
    url=BASE.format(f"{a[0]},{a[1]};{b[0]},{b[1]}")
    try:
        out=subprocess.run(["curl","-s","--max-time","30",url],capture_output=True,text=True).stdout
        g=json.loads(out)['routes'][0]['geometry']['coordinates']
        return [[round(c[1],5),round(c[0],5)] for c in g], True
    except Exception as e:
        print("  fallback:",e); return [[a[1],a[0]],[b[1],b[0]]], False

# (lon,lat)
RVK=(-21.9426,64.1466);STY=(-22.7276,65.0748);BUD=(-21.7530,65.1130)
BIRK=(-23.0180,65.5340);RAUD=(-24.0500,65.4667);POLL=(-23.8080,65.6230);REYKJA=(-23.4400,65.6900)
THING=(-23.4930,65.8730);BOL=(-23.2620,66.1560)
SUD=(-22.9930,66.0430);REYK=(-22.4120,65.9200);HEY=(-22.6260,65.8790)
HOLM=(-21.6870,65.7050)

# each leg: (day, mode, from, to). BUD via forces the land route (not the Baldur
# ferry); THING routes Day 3 past Dynjandi. Days 2 & 4 are the based-day loops.
legs=[
 (1,"car",RVK,STY),(1,"car",STY,BUD),(1,"car",BUD,BIRK),                 # Day 1: Reykjavík → Birkimelur (via Snæfellsnes)
 (2,"car",BIRK,RAUD),(2,"car",RAUD,POLL),(2,"car",POLL,REYKJA),(2,"car",REYKJA,BIRK),  # Day 2: Rauðasandur + pools loop
 (3,"car",BIRK,THING),(3,"car",THING,BOL),                              # Day 3: over the passes via Dynjandi → Bolungarvík
 (4,"car",BOL,SUD),(4,"car",SUD,REYK),(4,"car",REYK,HEY),(4,"car",HEY,BOL),  # Day 4: Ísafjarðardjúp loop
 (5,"car",BOL,HOLM),(5,"car",HOLM,RVK),                                 # Day 5: home via Strandir
]
out=[]
for i,(day,mode,a,b) in enumerate(legs,1):
    coords,ok=route(a,b); print(f"leg {i} day{day} {mode}: {len(coords)} pts {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"day":day,"coords":coords})
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"routes.js")
open(OUT,"w").write("// Auto-generated route geometry (OSRM driving), tagged by day. coords=[lat,lon]. Regenerate with routes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote "+OUT)
