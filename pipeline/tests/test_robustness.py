"""Checks for pipeline/robustness.py: follow-through logic, fixed-seed bootstrap, totals match the backtest."""
import json
import os
import random

from pipeline.robustness import follow_through, bootstrap, build

DATA = 'frontend/public/data'


def _row(d, s, mu, z=2.5, ea='A', eb='B'):
    return dict(d=d, s=s, mu=mu, z=z, ea=ea, eb=eb)


def test_follow_through_closes_halfway():
    series = [_row('d0', 100, 0), _row('d1', 80, 0), _row('d2', 40, 0)]
    g0, halfway, closed, days = follow_through(series, 0, horizon=10)
    assert g0 == 100 and halfway and days == 2 and closed == 60


def test_follow_through_stops_at_contract_change():
    series = [_row('d0', 100, 0), _row('d1', 90, 0), _row('d2', 0, 0, ea='C')]
    g0, halfway, closed, days = follow_through(series, 0, horizon=10)
    assert not halfway and closed == 10 and days is None


def test_follow_through_uses_only_later_days():
    # day 0's own value is the starting gap; nothing before day 0 is read
    series = [_row('d0', 50, 0), _row('d1', 50, 0)]
    assert follow_through(series, 1, horizon=10) is None   # no later day


def test_bootstrap_is_repeatable():
    vals = [100.0, -50.0, 30.0, 10.0]
    a = bootstrap(vals, random.Random(7), draws=2000)
    b = bootstrap(vals, random.Random(7), draws=2000)
    assert a == b and a['lo'] <= a['total'] <= a['hi']


def test_published_file_matches_backtest():
    if not os.path.exists(os.path.join(DATA, 'backtest/rule_comparison.json')):
        return
    out = build(DATA)
    by = json.load(open(os.path.join(DATA, 'backtest/rule_comparison.json')))['current_rule']['by_slip']['5']
    b = out['bootstrap']['5']
    assert b['all']['n'] == by['test_n'] and abs(b['all']['total'] - by['test_net_rs']) < 0.01
    assert b['crash']['n'] == by['crash_n'] and b['without_crash']['n'] == by['ex_crash_n']
    assert 0 <= b['without_crash']['above_zero_pct'] <= b['all']['above_zero_pct'] <= 100
    assert out['alerts']['alert']['n'] >= out['alerts']['alert_test']['n'] > 0
