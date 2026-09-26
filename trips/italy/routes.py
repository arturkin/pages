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
ALB=(11.2148,42.5056)                        # Albinia shops (Day-2)
GRO=(11.1242,42.7614);CBE=(11.5043,43.3426)  # Grosseto farmers market, Castelnuovo Berardenga (Day-6)
SAN=(11.3570,43.2602)                        # Caseificio Podere Sant'Anna (Day-6)
ORB=(11.2128,42.4414);FEN=(11.2441,42.4134);TAR=(11.4683,42.4247)  # Orbetello, Feniglia, Tarocchi (Day-4)
GRE=(11.3193,43.5825);PAN=(11.3164,43.5445);VOL=(11.3809,43.5167);RAD=(11.3747,43.4871)  # Chiantigiana (Day-8)
SIE=(11.3308,43.3188);MRG=(11.2238,43.3897)  # Siena, Monteriggioni (Day-10)
SAT=(11.5155,42.9995);MTC=(11.4868,43.0588);SQO=(11.6039,43.0592)  # Sant'Antimo, Montalcino, San Quirico (Day-14/15)
PIE=(11.6781,43.0770);VIT=(11.6344,43.0709);MCH=(11.7246,43.0681)  # Pienza, Vitaleta, Monticchiello (Day-14)

# each leg: (day, mode, from, to). Train legs use the road corridor as an
# approximation of the rail line. Day 15 = drive to Florence + evening train north.
# Days 4/8/10/14 are day-trip loops from the base; 3/5/7/9/11/13 are car-free.
legs=[
 (1,"train",MXP,MIL),(1,"train",MIL,FLO),                      # Day 1: arrive, train to Florence
 (2,"car",FLO,BOL),(2,"car",BOL,CDP),(2,"car",CDP,ALB),(2,"car",ALB,PSS),  # Day 2: coast road south (longest drive)
 (4,"car",PSS,ORB),(4,"car",ORB,FEN),(4,"car",FEN,TAR),(4,"car",TAR,PSS),  # Day 4: lagoon, Feniglia, Tarocchi
 (6,"car",PSS,GRO),(6,"car",GRO,PET),(6,"car",PET,SG),(6,"car",SG,SAN),(6,"car",SAN,CBE),(6,"car",CBE,CHI),  # Day 6: up to Chianti
 (8,"car",CHI,GRE),(8,"car",GRE,PAN),(8,"car",PAN,VOL),(8,"car",VOL,RAD),(8,"car",RAD,CHI),  # Day 8: the Chiantigiana
 (10,"car",CHI,SIE),(10,"car",SIE,MRG),(10,"car",MRG,CHI),     # Day 10: Siena + Monteriggioni
 (12,"car",CHI,MOM),(12,"car",MOM,ASC),(12,"car",ASC,BUO),(12,"car",BUO,LOC),  # Day 12: across the Crete Senesi
 (14,"car",LOC,SAT),(14,"car",SAT,MTC),(14,"car",MTC,SQO),(14,"car",SQO,PIE),(14,"car",PIE,VIT),(14,"car",VIT,MCH),(14,"car",MCH,LOC),  # Day 14: Montalcino + Pienza loop
 (15,"car",LOC,SQO),(15,"car",SQO,FLO),(15,"train",FLO,MIL),(15,"train",MIL,MXP), # Day 15: Florence + night run to MXP
]
out=[]
for i,(day,mode,a,b) in enumerate(legs,1):
    coords,km,ok=route(a,b); print(f"leg {i} day{day} {mode}: {len(coords)} pts {km} km {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"day":day,"km":km,"coords":coords})
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"routes.js")
open(OUT,"w").write("// Auto-generated route geometry (OSRM driving), tagged by day. coords=[lat,lon]. Regenerate with routes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote "+OUT)
