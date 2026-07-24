import json, subprocess, os
BASE="https://router.project-osrm.org/route/v1/driving/{}?overview=simplified&geometries=geojson"
def route(a,b):
    url=BASE.format(f"{a[0]},{a[1]};{b[0]},{b[1]}")
    try:
        out=subprocess.run(["curl","-s","--max-time","30",url],capture_output=True,text=True).stdout
        g=json.loads(out)['routes'][0]['geometry']['coordinates']
        return [[round(c[1],5),round(c[0],5)] for c in g], True
    except Exception as e:
        print("  fallback:",e); return [[a[1],a[0]],[b[1],b[0]]], False
MXP=(8.723,45.630);MIL=(9.204,45.487);FLO=(11.248,43.776)
CRE=(11.5606,43.2340);MON=(11.4506,43.0272);PE=(11.2064,42.3924);BOL=(10.6018,43.2287)
CDP=(10.8760,42.7620)                        # Castiglione della Pescaia (Day-2 coast stop)
SG=(11.1553,43.1494);PET=(11.2995,43.0803)   # San Galgano, Bagni di Petriolo (Day-6 interior stops)
legs=[("train",MXP,MIL),("train",MIL,FLO),
 ("car",FLO,BOL),("car",BOL,CDP),("car",CDP,PE),
 ("car",PE,PET),("car",PET,SG),("car",SG,CRE),
 ("car",CRE,MON),("car",MON,FLO),
 ("train",FLO,MIL),("train",MIL,MXP)]
out=[]
for i,(mode,a,b) in enumerate(legs,1):
    coords,ok=route(a,b); print(f"leg {i} {mode}: {len(coords)} pts {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"coords":coords})
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"routes.js")
open(OUT,"w").write("// Auto-generated route geometry (OSRM driving). coords=[lat,lon]. Regenerate with fetchroutes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote "+OUT)
