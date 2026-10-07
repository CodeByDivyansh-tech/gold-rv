"""Checks for pipeline/history.py: the data book agrees with our MCX download, and the history check is fair."""
import json
import os

import pandas as pd

from pipeline.history import load_book, cross_check, frozen_params, HISTORY_START, HISTORY_PAIRS

DATA = 'frontend/public/data'


def test_book_has_no_duplicate_rows():
    b = load_book()
    assert len(b) == 55457
    assert not b.duplicated(['symbol', 'expiry', 'date']).any()
    assert (b['date'] <= b['expiry']).all()


def test_book_matches_our_mcx_download_on_every_shared_row():
    ours = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', parse_dates=['date', 'expiry_date'])
    c = cross_check(load_book(), ours)
    assert c['shared_rows'] > 11000
    assert c['mismatches'] == 0


def test_history_uses_frozen_settings_and_only_earlier_days():
    h = json.load(open(os.path.join(DATA, 'history.json'), encoding='utf-8'))
    assert h['window']['from'] == HISTORY_START
    ours_start = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', usecols=['date'])['date'].min()
    assert h['window']['to'] < ours_start                      # never overlaps the years used to tune
    assert h['window']['params'] == frozen_params(os.path.join(DATA, 'site-data.json'))
    assert set(h['window']['pairs']) == set(HISTORY_PAIRS)


def test_history_totals_add_up():
    r = json.load(open(os.path.join(DATA, 'history.json'), encoding='utf-8'))['result']
    s = r['by_slip']['5']
    assert sum(p['n'] for p in r['pairs'].values()) == s['n']
    assert abs(sum(y['net_rs'] for y in r['years']) - s['net_rs']) < 1
    assert r['by_slip']['0']['net_rs'] > s['net_rs'] > r['by_slip']['10']['net_rs']   # more slippage, less profit


def test_long_chart_series_is_weekly_and_stops_before_our_data():
    h = json.load(open(os.path.join(DATA, 'history.json'), encoding='utf-8'))
    L = h['long']
    ours_start = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', usecols=['date'])['date'].min()
    assert L['d'] == sorted(L['d']) and L['d'][-1] < ours_start
    assert L['d'][0].startswith('2003')
    for sym in ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']:
        assert len(L[sym]) == len(L['d'])
    gaps = pd.to_datetime(pd.Series(L['d'])).diff().dt.days.dropna()
    assert gaps.max() <= 14                                   # one point a week (a holiday week can stretch it)
