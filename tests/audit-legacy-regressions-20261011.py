# Historical suite comparison; failures are retained, not converted to success.
import concurrent.futures, json, pathlib, subprocess, sys, time
root=pathlib.Path(sys.argv[1]); phase=sys.argv[2]
names='leveling-engine accuracy-engine intrinsic-inspection compact-bending compact-table-path compact-display-physical compact-fixed-column compact-yz-exaggeration compact-yz-independent compact-yz-sensitivity coupled-yz-sweep-independent confirmed-layouts irregular-leveling guide-response-invariants portal-shear-invariants structural-invariants support-coordinate-geometry reference-fixtures reference-zero spindle-sweep multi-spindle-sweep lathe-independent-20261009 horizontal-fixture-independent-20261010 horizontal-fixture-independent-arms-20261010 horizontal-fixture-independent-yaw-20261010 horizontal-yz-fixture-20261010 horizontal-parallel-independent horizontal-parallel-machine horizontal-fine-summary-20261010 horizontal-probe-diagram-20261010 live-squareness-values squareness-display adjustment-flow measurement-reference level-stages settings-menu-ui site-navigation scene-zoom ideal-display'.split()
def run(n):
 t=time.time()
 try:
  r=subprocess.run(['node',f'tests/check-{n}.cjs'],cwd=root,capture_output=True,text=True,timeout=150)
  return dict(name=n,code=r.returncode,seconds=round(time.time()-t,2),stdout=r.stdout,stderr=r.stderr)
 except subprocess.TimeoutExpired as e:return dict(name=n,code=124,seconds=150,stdout=str(e.stdout),stderr=str(e.stderr))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: rows=list(ex.map(run,names))
out=pathlib.Path(__file__).resolve().parents[1]/'docs/qa-all-measurements-20261011/regressions';out.mkdir(exist_ok=True)
(out/f'{phase}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'phase':phase,'passed':sum(x['code']==0 for x in rows),'total':len(rows),'failures':[{k:x[k] for k in ['name','code']} for x in rows if x['code']]},indent=2))
