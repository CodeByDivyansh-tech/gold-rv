"""Check that the committed website data is what the pipeline produces from the committed code.

Run after `python -m pipeline.build_site_data`. Compares every JSON file in frontend/public/data/ with the
version committed at HEAD:
  - strings, keys, list lengths, booleans and nulls must match exactly;
  - numbers may differ by a tiny rounding amount (different numpy/pandas builds can change the last digit);
  - meta.json's build_time is ignored.
Differences are printed as GitHub Actions error annotations (the first 30), and the exit code is 1.
Usage: python -m pipeline.check_data
"""
import json
import math
import os
import subprocess
import sys

DATA = 'frontend/public/data'
REL_TOL, ABS_TOL = 1e-6, 0.06     # JSON numbers are rounded to 0.1 or finer, so 0.06 absorbs one rounding step


def committed(path: str):
    try:
        return json.loads(subprocess.check_output(['git', 'show', f'HEAD:{path}'], stderr=subprocess.DEVNULL))
    except subprocess.CalledProcessError:
        return None


def compare(a, b, where: str, out: list):
    if len(out) >= 200:
        return
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
        if a != b:
            out.append(f'{where}: {a!r} -> {b!r}')
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if math.isnan(a) and math.isnan(b):
            return
        if not math.isclose(a, b, rel_tol=REL_TOL, abs_tol=ABS_TOL):
            out.append(f'{where}: {a!r} -> {b!r}')
    elif isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f'{where}.{k}: {"missing in committed" if k not in a else "missing in fresh build"}')
            else:
                compare(a[k], b[k], f'{where}.{k}', out)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append(f'{where}: list length {len(a)} -> {len(b)}')
        for i, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f'{where}[{i}]', out)
    elif a != b:
        out.append(f'{where}: {str(a)[:80]!r} -> {str(b)[:80]!r}')


def main() -> int:
    problems = []
    tracked = subprocess.check_output(['git', 'ls-files', DATA]).decode().split()
    files = sorted(set(tracked) | {os.path.join(r, f).replace(os.sep, '/') for r, _, fs in os.walk(DATA) for f in fs if f.endswith('.json')})
    for path in files:
        if not path.endswith('.json'):
            continue
        old = committed(path)
        if old is None:
            problems.append((path, 'new file, not committed'))
            continue
        if not os.path.exists(path):
            problems.append((path, 'committed but no longer produced'))
            continue
        new = json.load(open(path, encoding='utf-8'))
        if path.endswith('meta.json'):
            old.pop('build_time', None); new.pop('build_time', None)
        diffs = []
        compare(old, new, os.path.basename(path), diffs)
        problems += [(path, d) for d in diffs]
    for path, d in problems[:30]:
        print(f'::error file={path}::{d}')
    if problems:
        print(f'{len(problems)} difference(s) between committed data and a fresh build. '
              f'Run python -m pipeline.build_site_data and commit frontend/public/data/.')
        return 1
    print(f'Committed data matches a fresh build ({len(files)} files).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
