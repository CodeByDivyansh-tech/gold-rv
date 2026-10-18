"""Checks for pipeline/download.py that need no network: conversion, merging, request planning, parsing."""
import datetime as dt
import io
import json

import pandas as pd
import pytest

from pipeline.download import (RAW_COLS, contract_calendar, fetch, merge_raw, plan_requests, raw_to_clean,
                               RAW_PATH, CLEAN_PATH, CAL_PATH)


def test_raw_file_rebuilds_the_committed_clean_csv_and_calendar_byte_for_byte():
    clean = raw_to_clean(pd.read_csv(RAW_PATH))
    buf = io.StringIO(); clean.to_csv(buf, index=False)
    assert buf.getvalue() == open(CLEAN_PATH, encoding='utf-8').read()
    buf = io.StringIO(); contract_calendar(clean).to_csv(buf, index=False)
    assert buf.getvalue() == open(CAL_PATH, encoding='utf-8').read()


def _row(date='09/30/2026', sym='GOLDPETAL', exp='30OCT2026', close=14893, vol=10):
    return {'Date': date, 'Symbol': sym, 'ExpiryDate': exp, 'Open': close, 'High': close, 'Low': close, 'Close': close,
            'PreviousClose': close, 'Volume': vol, 'VolumeInThousands': f'{vol / 1000:.3f} GRMS', 'Value': 1.0, 'OpenInterest': 100}


def test_merge_keeps_identical_rows_once_adds_new_ones_and_refuses_conflicts():
    old = pd.DataFrame([_row()])[RAW_COLS]
    new = pd.DataFrame([_row(), _row(date='10/01/2026')])[RAW_COLS]
    m = merge_raw(old, new)
    assert len(m) == 2
    with pytest.raises(ValueError):
        merge_raw(old, pd.DataFrame([_row(close=99999)])[RAW_COLS])


def test_plan_continues_live_contracts_and_starts_new_ones_400_days_back():
    raw = pd.DataFrame([_row(date='09/30/2026', exp='30OCT2026'), _row(date='09/30/2025', exp='30SEP2025')])[RAW_COLS]
    exp = {'GOLDPETAL': ['30OCT2026', '30SEP2025', '31MAR2027']}
    plan = {(s, e): (a, b) for s, e, a, b in plan_requests(raw, exp, dt.date(2026, 10, 16))}
    assert plan[('GOLDPETAL', '30OCT2026')] == (dt.date(2026, 10, 1), dt.date(2026, 10, 16))
    assert ('GOLDPETAL', '30SEP2025') not in plan                       # long expired
    a, b = plan[('GOLDPETAL', '31MAR2027')]
    assert (dt.date(2027, 3, 31) - a).days == 400 and b == dt.date(2026, 10, 16)


class _Resp:
    def __init__(self, body): self.text = json.dumps(body); self.status_code = 200; self._b = body
    def json(self): return self._b
    def raise_for_status(self): pass


class _Session:
    def __init__(self, body): self.body = body; self.calls = []
    def get(self, url, params=None, headers=None, timeout=None): self.calls.append(params); return _Resp(self.body)
    def post(self, *a, **k): raise AssertionError('GET worked, POST should not be tried')


def test_fetch_strips_symbols_and_drops_rows_outside_the_request_or_after_expiry():
    body = {'IsSuccess': True, 'Data': [dict(_row(date=d), Symbol='GOLDPETAL    ') for d in
                                        ('09/29/2026', '10/01/2026', '10/30/2026', '10/31/2026')]}
    s = _Session(body)
    df = fetch(s, 'GOLDPETAL', '30OCT2026', dt.date(2026, 10, 1), dt.date(2026, 11, 5))
    assert list(df['Date']) == ['10/01/2026', '10/30/2026']             # 29 Sep before the request, 31 Oct after expiry
    assert set(df['Symbol']) == {'GOLDPETAL'}
    assert s.calls[0]['fromDate'] == '01/10/2026' and s.calls[0]['toDate'] == '05/11/2026'   # DD/MM/YYYY out


def test_rows_after_the_test_year_go_to_the_forward_period_not_the_test_year():
    from pipeline.config import segment_of, TRAIN_END, TEST_END
    seg = segment_of([TRAIN_END, '2025-10-01', TEST_END, '2026-10-01'])
    assert list(seg) == ['train', 'test', 'test', 'forward']
    rc = json.load(open('frontend/public/data/backtest/rule_comparison.json', encoding='utf-8'))['current_rule']['by_slip']['5']
    trades = []
    for p in ['M_TEN', 'M_PETAL', 'M_GUINEA', 'TEN_PETAL', 'GUINEA_TEN', 'GUINEA_PETAL']:
        trades += json.load(open(f'frontend/public/data/backtest/{p}_5.json', encoding='utf-8'))['trades']
    in_test = [t for t in trades if '2025-10-01' <= t['entry'] <= TEST_END]
    assert rc['test_n'] == len(in_test)                       # the test year counts only its own window
    assert rc['forward_n'] == sum(1 for t in trades if t['entry'] > TEST_END)
