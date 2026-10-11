"""Unchanged engines and other machine models affected by shared UI loading."""
import concurrent.futures
import json
import pathlib
import subprocess
import time

root = pathlib.Path(__file__).resolve().parents[1]
names = '''leveling-engine accuracy-engine intrinsic-inspection confirmed-layouts
irregular-leveling portal-shear-invariants support-coordinate-geometry
spindle-sweep multi-spindle-sweep compact-display-physical compact-fixed-column
compact-yz-exaggeration compact-yz-independent compact-yz-sensitivity
coupled-yz-sweep-independent site-navigation'''.split()

def run(name):
    start = time.monotonic()
    try:
        result = subprocess.run(['node', f'tests/check-{name}.cjs'], cwd=root,
                                capture_output=True, text=True, timeout=180)
        return dict(name=name, code=result.returncode,
                    seconds=round(time.monotonic() - start, 2),
                    stdout=result.stdout, stderr=result.stderr)
    except subprocess.TimeoutExpired as exc:
        return dict(name=name, code=124, seconds=180,
                    stdout=str(exc.stdout), stderr=str(exc.stderr))

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    rows = list(pool.map(run, names))
out = root / 'docs/qa-fixtures-20261011/regressions'
out.mkdir(parents=True, exist_ok=True)
(out / 'core.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(total=len(rows), passed=sum(r['code'] == 0 for r in rows),
                     failures=[r['name'] for r in rows if r['code']]), ensure_ascii=False))
raise SystemExit(any(r['code'] for r in rows))
