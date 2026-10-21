"""Every data file the site serves must be strict JSON: no NaN or Infinity, which browsers cannot parse."""
import glob
import json


def _refuse(token):
    raise ValueError(f'non-standard JSON value {token}')


def test_site_data_is_strict_json():
    files = sorted(glob.glob('frontend/public/data/**/*.json', recursive=True))
    assert files, 'no data files found'
    for f in files:
        with open(f, encoding='utf-8') as fh:
            json.load(fh, parse_constant=_refuse)   # raises on NaN / Infinity / -Infinity
