import json, subprocess
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
SGIM=(11.0431,43.4677);MON=(11.4506,43.0272);PE=(11.2064,42.3924)
legs=[("train",MXP,MIL),("train",MIL,FLO),("car",FLO,SGIM),("car",SGIM,MON),
 ("car",MON,PE),("car",PE,FLO),("train",FLO,MIL),("train",MIL,MXP)]
out=[]
for i,(mode,a,b) in enumerate(legs,1):
    coords,ok=route(a,b); print(f"leg {i} {mode}: {len(coords)} pts {'OSRM' if ok else 'STRAIGHT'}")
    out.append({"mode":mode,"coords":coords})
open("routes.js","w").write("// Auto-generated route geometry (OSRM driving). coords=[lat,lon]. Regenerate with fetchroutes.py.\nwindow.ROUTES = "+json.dumps(out,separators=(',',':'))+";\n")
print("wrote routes.js")
