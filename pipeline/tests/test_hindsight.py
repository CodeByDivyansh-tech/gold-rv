"""The "N of M settings" line: site-data.json's hindsight count must match the explorer grid it summarises."""
import json

DATA = 'frontend/public/data'


def _load(name):
    return json.load(open(f'{DATA}/{name}', encoding='utf-8'))


def test_hindsight_count_matches_explore_grid():
    ex, site = _load('explore.json'), _load('site-data.json')
    h = site['hindsight']
    i_n, i_net = ex['fields'].index('clean_n'), ex['fields'].index('clean_net')
    total = profitable = 0
    for pid in ('M_PETAL', 'M_GUINEA', 'GUINEA_PETAL'):          # the pairs that existed in 2011-2023
        for k, v in ex['pairs'][pid].items():
            W, ze, mh, slip, hurdle = k.split('|')
            if int(slip) != h['slip']:
                continue
            total += 1
            profitable += v[i_n] > 0 and v[i_net] > 0
    g = ex['grid']
    assert total == 3 * len(g['W']) * len(g['ze']) * len(g['mh']) * len(g['h'])
    assert (h['profitable'], h['total']) == (profitable, total)
    assert h['slip'] == site['slip'] == 5
    assert sorted(h['pairs']) == sorted(site['longrun']['pairs'])
    assert (h['start'], h['end']) == (site['longrun']['start'], site['longrun']['end'])


def test_hindsight_is_a_small_minority():
    # the published claim: only a handful of settings make money on the clean test even with hindsight
    h = _load('site-data.json')['hindsight']
    assert 0 <= h['profitable'] < h['total'] / 10
