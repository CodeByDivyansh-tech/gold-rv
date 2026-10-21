"""Checks for pipeline/history.py: our 2004-2023 MCX download is complete and agrees with a second copy of the same
MCX rows, and the history check is fair."""
import json
import os

import pandas as pd

from pipeline.history import load_book, load_archive, as_ours, cross_check, frozen_params, HISTORY_START, HISTORY_PAIRS

DATA = 'frontend/public/data'


def test_book_has_no_duplicate_rows():
    b = load_book()
    assert len(b) == 43728                                    # 569 contracts, Feb 2004 to Dec 2023 expiries
    assert b.groupby(['symbol', 'expiry']).ngroups == 569
    assert not b.duplicated(['symbol', 'expiry', 'date']).any()
    assert (b['date'] <= b['expiry']).all()


def test_every_history_row_traces_to_a_logged_mcx_request():
    """Each request in the log returned exactly the rows we keep for that contract and date range."""
    log = pd.read_csv('data/raw/retrieval_log.csv')
    log = log[log['expiry'] <= '2023-12-31']
    b = load_book()
    keys = set(zip(b['symbol'], b['expiry'].dt.strftime('%Y-%m-%d')))
    assert keys == set(zip(log['symbol'], log['expiry']))
    for r in log.sample(40, random_state=1).itertuples():
        f, t = pd.to_datetime(r.requested_from, dayfirst=True), pd.to_datetime(r.requested_to, dayfirst=True)
        g = b[(b['symbol'] == r.symbol) & (b['expiry'] == r.expiry) & (b['date'] >= f) & (b['date'] <= t)]
        if r.requested_from == '10/10/2023':                  # second download of the Oct-Dec 2023 contracts: in the supplement
            continue
        assert len(g) == r.rows, r


def test_all_our_mcx_data_matches_the_second_copy_on_every_shared_row():
    ours = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', parse_dates=['date', 'expiry_date'])
    b = load_book()
    c = cross_check(load_archive(), pd.concat([as_ours(b[b['date'] < ours['date'].min()]), ours], ignore_index=True))
    assert c['shared_rows'] == 55457 and c['only_in_book'] == 0   # every row of the second copy is in our download
    assert c['mismatches'] == 0


def test_history_uses_frozen_settings_and_only_earlier_days():
    h = json.load(open(os.path.join(DATA, 'history.json'), encoding='utf-8'))
    assert h['window']['from'] == HISTORY_START
    ours_start = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', usecols=['date'])['date'].min()
    assert h['window']['to'] < ours_start                      # never overlaps the years used to tune
    assert h['window']['params'] == frozen_params(DATA)
    site = json.load(open(os.path.join(DATA, 'site-data.json'), encoding='utf-8'))
    assert all(h['window']['params'][p] == {k: site['pairs'][p]['params'][k] for k in ('W', 'ze', 'mh')} for p in HISTORY_PAIRS)
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


def test_our_data_has_every_contract_and_day_the_data_book_has_in_our_window():
    """Completeness: the Oct-Dec 2023 contracts were once missing from our download. Never again."""
    ours = pd.read_csv('data/raw/gold_bhavcopy_clean.csv', parse_dates=['date', 'expiry_date'])
    b = load_archive()
    w = b[(b['date'] >= ours['date'].min()) & (b['date'] <= ours['date'].max())]
    have = set(zip(ours['symbol'], ours['expiry_date'], ours['date']))
    missing = [k for k in zip(w['symbol'], w['expiry'], w['date']) if k not in have]
    assert missing == [], f'{len(missing)} book rows missing from our data, e.g. {missing[:3]}'
    assert set(w['date']) <= set(ours['date'])
