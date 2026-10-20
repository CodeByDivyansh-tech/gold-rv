"""'Try your own rule': the real backtest engine run over a grid of settings, for the website's explorer.

Every cell is a genuine run of run_pair_backtest (same contracts, costs, liquidity, expiry and fill rules as
the published results), so the site never has to approximate the engine in the browser. The published rule is
one cell of this grid; tests check that cell reproduces the published numbers exactly.

This is for exploring only. Picking the best cell after seeing every period is exactly the overfitting the
walk-forward design protects against, and the page says so.

Writes frontend/public/data/explore.json:
  grid   the settings tried: window W (days), entry z, max hold (days), slippage (bps), cost line on/off
  years  calendar years in the per-year results
  pairs  {pair: {"W|ze|mh|slip|h": [c_n, c_net, c_wins, tr_n, tr_net, tr_wins, te_n, te_net, te_wins, fw_n, fw_net, fw_wins,
                                     net per year...]}}
         c = clean test 2011-2023 (Parity data book; only the three pairs that existed), tr = training,
         te = test year, fw = after the test year. Net in rupees after costs; wins = trades that made money.
"""
import json
import os
from typing import Any, Dict

import pandas as pd

from pipeline.config import ALERT_RULE, WINDOW_GRID, PAIRS, segment_of
from pipeline.load import load_clean_bhavcopy
from pipeline.carry import compute_reference_carry
from pipeline.pairs import build_all_pairs, build_pair_series
from pipeline.backtest import prepare_contract_lookup, run_pair_backtest
from pipeline.history import HISTORY_PAIRS, HISTORY_START, history_frame, load_book, BOOK_PATH, OURS_PATH

Z_GRID = [1.5, 2.0, 2.5, 3.0]
HOLD_GRID = [5, 10, 20]
SLIP_GRID = [0, 2, 5, 10]
HURDLE = {1: ALERT_RULE, 0: dict(ALERT_RULE, use_hurdle=False)}
ORDER = ['M_PETAL', 'M_GUINEA', 'M_TEN', 'GUINEA_TEN', 'TEN_PETAL', 'GUINEA_PETAL']


def key(W, ze, mh, slip, h) -> str:
    return f'{W}|{ze}|{mh}|{slip}|{h}'


def hindsight(ex: Dict[str, Any], slip: int = 5) -> Dict[str, Any]:
    """How many grid settings make money on the clean test, even picked after seeing every result.

    Counts settings (W, entry z, hold, cost line) of the pairs that existed in the clean window, at one slippage,
    with at least one clean-test trade and a positive clean-test net.
    """
    f = ex['fields']
    i_n, i_net = f.index('clean_n'), f.index('clean_net')
    pairs = [p for p in ORDER if p in HISTORY_PAIRS]
    cells = [v for p in pairs for k, v in ex['pairs'][p].items() if int(k.split('|')[3]) == slip]
    return dict(profitable=sum(1 for v in cells if v[i_n] > 0 and v[i_net] > 0), total=len(cells), slip=slip,
                pairs=pairs, start=ex['cleanFrom'], end=ex['cleanTo'])


def _seg(t: pd.DataFrame):
    return [int(len(t)), round(float(t['net'].sum())), int((t['net'] > 0).sum())] if len(t) else [0, 0, 0]


def build(output_dir: str = 'frontend/public/data') -> Dict[str, Any]:
    df, dates, tdi = load_clean_bhavcopy(OURS_PATH)
    P = prepare_contract_lookup(df)
    carry, _ = compute_reference_carry(df, dates)
    ours = build_all_pairs(df, carry)

    book = load_book(BOOK_PATH)
    end = pd.read_csv(OURS_PATH, parse_dates=['date'])['date'].min() - pd.Timedelta(days=1)
    hdf, hdates, htdi, hcarry = history_frame(book, end)
    HP = prepare_contract_lookup(hdf)
    hist = {pid: build_pair_series(hdf, pid, hcarry) for pid in HISTORY_PAIRS}
    start = pd.Timestamp(HISTORY_START)

    last_year = pd.Timestamp(dates[-1]).year
    years = list(range(start.year, last_year + 1))
    out: Dict[str, Any] = {
        'grid': {'W': WINDOW_GRID, 'ze': Z_GRID, 'mh': HOLD_GRID, 'slip': SLIP_GRID, 'h': [1, 0]},
        'years': years, 'pairs': {}, 'cleanFrom': HISTORY_START, 'cleanTo': end.strftime('%Y-%m-%d'),
        'fields': ['clean_n', 'clean_net', 'clean_wins', 'train_n', 'train_net', 'train_wins',
                   'test_n', 'test_net', 'test_wins', 'fwd_n', 'fwd_net', 'fwd_wins'],
    }
    for pid in ORDER:
        cells = {}
        for W in WINDOW_GRID:
            for ze in Z_GRID:
                for mh in HOLD_GRID:
                    for slip in SLIP_GRID:
                        for h, rule in HURDLE.items():
                            parts = []
                            if pid in hist:
                                t = run_pair_backtest(pid, hist[pid], HP, hdates, htdi, W, ze, mh, slip_bps=slip, rule=rule)
                                if len(t):
                                    t = t[t['entry'] >= start]
                                parts.append(t if len(t) else pd.DataFrame(columns=['entry', 'net']))
                            else:
                                parts.append(pd.DataFrame(columns=['entry', 'net']))
                            o = run_pair_backtest(pid, ours[pid], P, dates, tdi, W, ze, mh, slip_bps=slip, rule=rule)
                            if len(o):
                                o = o.assign(seg=segment_of(o['entry'].values))
                            row = _seg(parts[0])
                            for s in ('train', 'test', 'forward'):
                                row += _seg(o[o['seg'] == s] if len(o) else o)
                            allt = pd.concat([x[['entry', 'net']] for x in (parts[0], o) if len(x)]) if (len(parts[0]) or len(o)) else None
                            by = {}
                            if allt is not None:
                                for y, g in allt.groupby(pd.to_datetime(allt['entry']).dt.year):
                                    by[int(y)] = round(float(g['net'].sum()))
                            cells[key(W, ze, mh, slip, h)] = row + [by.get(y, 0) for y in years]
        out['pairs'][pid] = cells
        print('explore:', pid, len(cells), 'settings')
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, 'explore.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    return out


if __name__ == '__main__':
    build()
