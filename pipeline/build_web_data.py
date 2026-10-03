"""Builds frontend/public/data/site-data.json: the one file the website reads.

It is made from the JSON files build_site_data.py writes (prices, pairs, backtests,
alerts, methodology) plus the cost settings in config.py, so every number on the
site comes from the pipeline. Run: python -m pipeline.build_web_data
"""
import json
import os

from pipeline import config as C
from pipeline.attribution import calculate_round_trip_cost_bps


def build_web_data(data_dir: str = 'frontend/public/data', out_path: str = None):
    SRC = data_dir
    out_path = out_path or os.path.join(data_dir, 'site-data.json')
    J = lambda p: json.load(open(os.path.join(SRC, p), encoding='utf-8'))
    meta = J('meta.json')
    today = J('signals_today.json')
    meth = J('methodology.json')
    regimes = J('regimes.json')
    history = J('signals_history.json')
    cost_matrix = J('backtest/cost_matrix.json')
    rule_cmp = J('backtest/rule_comparison.json')
    switch = rule_cmp['switch']

    SYMS = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']
    INFO = {
        'GOLDM': dict(name='Gold Mini', lot='100 g', quote='10 g', purity='995', expiry='5th of the month (earlier if a holiday)'),
        'GOLDTEN': dict(name='Gold Ten', lot='10 g', quote='10 g', purity='999', expiry='Last business day of the month'),
        'GOLDGUINEA': dict(name='Gold Guinea', lot='8 g', quote='8 g', purity='999', expiry='Last business day of the month'),
        'GOLDPETAL': dict(name='Gold Petal', lot='1 g', quote='1 g', purity='999', expiry='Last business day of the month'),
    }
    PAIRS = ['M_TEN', 'M_PETAL', 'M_GUINEA', 'TEN_PETAL', 'GUINEA_TEN', 'GUINEA_PETAL']
    LEGS = {'M_TEN': ('GOLDM', 'GOLDTEN'), 'M_PETAL': ('GOLDM', 'GOLDPETAL'), 'M_GUINEA': ('GOLDM', 'GOLDGUINEA'),
            'TEN_PETAL': ('GOLDTEN', 'GOLDPETAL'), 'GUINEA_TEN': ('GOLDGUINEA', 'GOLDTEN'), 'GUINEA_PETAL': ('GOLDGUINEA', 'GOLDPETAL')}

    r1 = lambda x: None if x is None else round(x, 1)

    # ---- most-liquid contract per day, per symbol --------------------------------
    best = {}
    for s in SYMS:
        rows = J(f'prices/{s}.json')
        b = {}
        for r in rows:
            if r['nt']:
                continue
            if r['d'] not in b or r['oi'] > b[r['d']]['oi']:
                b[r['d']] = r
        best[s] = b
    dates = sorted(set(d for s in SYMS for d in best[s]))

    # gold line (GOLDM, per 10 g pure), daily
    gold = [[d, round(best['GOLDM'][d]['p10'])] for d in dates if d in best['GOLDM']]
    # four contracts, per 10 g pure, daily (null where the contract had no trade)
    pure4 = {'d': dates}
    for s in SYMS:
        pure4[s] = [round(best[s][d]['p10']) if d in best[s] else None for d in dates]

    quotes = []
    for q in meta['latest_quotes']:
        s = q['symbol']
        last63 = sorted(best[s])[-63:]
        quotes.append(dict(sym=s, **INFO[s], close=q['close'], chg=q['change_rs'], pct=q['change_pct'],
                           pure=round(q['px_per_10g_pure']), expiryDate=q['expiry'], vol=q['vol'], oi=q['oi'],
                           spark=[round(best[s][d]['c']) for d in last63]))

    # ---- pairs: daily spread, rolling mean and sd --------------------------------
    pairs = {}
    for p in PAIRS:
        rows = J(f'pairs/{p}.json')
        bt5 = J(f'backtest/{p}_5.json')
        trades = [dict(sig=t['sig'], e=t['entry'], x=t['exit'], side=t['side'], z=t['z'], net=round(t['net']),
                       bps=t['net_bps'], why=t['reason'], days=t['days'], seg=t['seg']) for t in bt5['trades']]
        a, b = LEGS[p]
        pairs[p] = dict(a=a, b=b, label=f'{a} · {b}', params=bt5['params'],
                        d=[r['d'] for r in rows], s=[r1(r['s']) for r in rows],
                        mu=[r1(r['mu']) for r in rows], sd=[r1(r['sd']) for r in rows],
                        trades=trades, test=bt5['metrics_test'], train=bt5['metrics_train'], all=bt5['metrics_all'],
                        switch=bt5['switch'])

    # carry-adjusted gap of each contract versus GOLDM (bps) = minus the GOLDM-vs-X spread
    vsM = {}
    for p, s in [('M_TEN', 'GOLDTEN'), ('M_GUINEA', 'GOLDGUINEA'), ('M_PETAL', 'GOLDPETAL')]:
        vsM[s] = [[d, r1(-v)] for d, v in zip(pairs[p]['d'], pairs[p]['s']) if v is not None]

    # ---- today ------------------------------------------------------------------
    todayPairs = []
    for r in today['pairs']:
        a, b = LEGS[r['pair_id']]
        todayPairs.append(dict(id=r['pair_id'], label=f'{a} · {b}', a=a, b=b, contracts=r['contracts'],
                               spread=r['spread_bps'], spreadRs=r['spread_rs_10g'], mu=r['mu'], sd=r['sd'], z=r['z'],
                               zNeed=r['z_needed'], dev=r['deviation_bps'], hurdle=r['hurdle_bps'], rt=r['round_trip_cost_bps'],
                               gates=r['gates'], failed=r['failed_gates'], volA=r['vol_a'], volB=r['vol_b'], oiA=r['oi_a'],
                               oiB=r['oi_b'], tdA=r['td_to_exp_a'], tdB=r['td_to_exp_b'], roll=r['roll_flag'],
                               expA=r['expiry_a'], expB=r['expiry_b'], status=r['status'], stopZ=r['stop_z'],
                               hurdleZ=r['hurdle_z'], canSignal=r['can_signal_now'], pairOn=r['pair_on'],
                               switchWhy=r['pair_switch_reason']))

    # ---- replay: weekly peak gap-from-normal per pair ------------------------------
    dev = {}
    for p in PAIRS:
        for d, s, m in zip(pairs[p]['d'], pairs[p]['s'], pairs[p]['mu']):
            if m is not None and s is not None:
                dev.setdefault(d, {})[p] = abs(s - m)
    idx = list(range(len(dates) - 1, -1, -5))[::-1]
    frames, fdates, sigs = [], [], []
    for k, i in enumerate(idx):
        j = idx[k - 1] + 1 if k > 0 else 0
        block = dates[j:i + 1]
        row, sig = [], []
        for p in PAIRS:
            xs = [dev[d][p] for d in block if d in dev and p in dev[d]]
            row.append(round(max(xs), 1) if xs else None)
            sig.append(1 if any(t['sig'] in block for t in pairs[p]['trades']) else 0)
        frames.append(row)
        sigs.append(sig)
        fdates.append(dates[i])
    HURDLE = today['pairs'][0]['hurdle_bps']
    cross = [any(v is not None and v >= HURDLE for v in r) for r in frames]
    def count(lo, hi):
        sel = [c for c, d in zip(cross, fdates) if lo <= d <= hi]
        return sum(sel), len(sel)
    periods = {
        'Oct 2023 – Mar 2025 (thin, before GOLDTEN listed)': count('2023-10-01', '2025-03-31'),
        'Apr 2025 – Dec 2025': count('2025-04-01', '2025-12-31'),
        'Jan 2026 – Mar 2026 (crash)': count('2026-01-01', '2026-03-31'),
        'Apr 2026 – Sep 2026': count('2026-04-01', '2026-09-30'),
    }
    replay = dict(ids=PAIRS, labels=[pairs[p]['label'] for p in PAIRS], d=fdates, f=frames, sig=sigs, hurdle=HURDLE,
                  signalWeeks=sum(1 for r in sigs if any(r)),
                  crossWeeks=sum(cross), weeks=len(frames), periods=periods)

    # ---- backtest: every pair x slippage ---------------------------------------------
    backtest = {}
    for p in PAIRS:
        backtest[p] = {}
        for slip in (0, 2, 5, 10):
            b = J(f'backtest/{p}_{slip}.json')
            # equity_curve holds running totals; rebuild per-trade values from the trade list instead
            cum, cg, curve = 0.0, 0.0, []
            for tr in b['trades']:
                cum += tr['net']; cg += tr['gross']
                curve.append([tr['entry'], tr['exit'], round(tr['net']), round(cum), round(cg), tr['seg'], round(tr['net_bps'], 1)])
            backtest[p][str(slip)] = dict(test=b['metrics_test'], train=b['metrics_train'], curve=curve,
                                          attr=b['attribution'], params=b['params'], switch=b['switch'])
    pooled = {}
    for slip in (0, 2, 5, 10):
        bps = [c[6] for p in PAIRS for c in backtest[p][str(slip)]['curve'] if c[5] == 'test']
        pooled[str(slip)] = dict(n=len(bps), bps=round(sum(bps) / len(bps), 2),
                                 positive=sum(1 for p in PAIRS if backtest[p][str(slip)]['test']['net_rs'] > 0))

    N, SL = C.NOTIONAL_PER_LEG, C.BASE_SLIPPAGE
    orders = 4  # buy and sell on both legs
    fees = dict(brok=C.BROKERAGE_PER_ORDER * orders, exch=N * C.EXCHANGE_TURNOVER_RATE * orders, sebi=N * C.SEBI_TURNOVER_RATE * orders)
    gst = C.GST_RATE * sum(fees.values())
    items = [
        ('Slippage', f'{SL} bps each time we buy or sell, {orders} times', N * SL / 1e4 * orders),
        ('Commodity transaction tax', f'{C.CTT_RATE*100:.2f}% on each sell', N * C.CTT_RATE * 2),
        ('Exchange fees', f'{C.EXCHANGE_TURNOVER_RATE*100:.4f}% per order value', fees['exch']),
        ('Brokerage', f'₹{C.BROKERAGE_PER_ORDER:.0f} per order, {orders} orders', fees['brok']),
        ('Stamp duty', f'{C.STAMP_DUTY_RATE*100:.3f}% on each buy', N * C.STAMP_DUTY_RATE * 2),
        ('GST', f'{C.GST_RATE*100:.0f}% on brokerage and fees', gst),
        ('SEBI fee', '₹10 per crore', fees['sebi']),
    ]
    costs = [dict(name=a, how=b, bps=round(c / N * 1e4, 2)) for a, b, c in items]
    cost_total = sum(c / N * 1e4 for _, _, c in items)
    assert abs(cost_total - calculate_round_trip_cost_bps(SL)) < 1e-9, (cost_total, calculate_round_trip_cost_bps(SL))
    assert abs(round(cost_total, 1) - today['round_trip_cost_bps']) < 0.051

    events = dict(asOf=meta['coverage_end'], crashStart=rule_cmp['crash']['start'], crashEnd=rule_cmp['crash']['end'],
                  crashLabel='January–March 2026 crash', crashShort='Jan–Mar 2026 crash',
                  petalStart='2024-12-01', petalEnd='2025-03-31',
                  goldtenListed=next(d for d, v in zip(pure4['d'], pure4['GOLDTEN']) if v is not None),
                  regimeLabels=['Oct 2023 – Dec 2024', 'Apr 2025 – Sep 2026', 'Jan–Mar 2026 crash'])

    data = dict(costs=costs, costTotal=round(cost_total, 2), slip=SL, notional=N, events=events,
                minVol=C.MIN_VOLUME_LOTS, minOi=C.MIN_OI_LOTS, minTd=C.MIN_ENTRY_TD,
        asOf=meta['coverage_end'], start=meta['coverage_start'], split=meth['split_dates'],
        meta=dict(rows=meta['rows_count'], contracts=meta['contracts_count'], days=meta['trading_dates_count'],
                  noTrade=meta['no_trade_rows_count'], thin=meta['thin_rows_count'], weekend=meta['weekend_sessions'],
                  checkRows=meta['raw_cross_check']['matched_rows'], mismatches=meta['raw_cross_check']['mismatches'],
                  checkText=meta['raw_cross_check']['status']),
        rule=dict(hurdle=rule_cmp['hurdle_bps'], stopBuffer=rule_cmp['stop_buffer_z'], maxMove=rule_cmp['max_fill_move_pct'],
                  minTrain=rule_cmp['min_train_trades'], switch=switch,
                  current=rule_cmp['current_rule']['by_slip'], original=rule_cmp['original_rule']['by_slip'],
                  originalNote=meth['original_rule_note']),
        quotes=quotes, gold=gold, pure4=pure4, vsM=vsM, today=todayPairs, rt=today['round_trip_cost_bps'],
        replay=replay, pairs=pairs, backtest=backtest, pooled=pooled, costMatrix=cost_matrix,
        history=history, regimes=regimes,
        stages=meth['stages'], rules=meth['point_in_time_rules'], limits=meth['limitations'], conclusion=meth['honest_conclusion'],
        retrieval=[[r['symbol'], r['expiry'], r['requested_from'], r['requested_to'], r['rows'], r['first_date'], r['last_date']]
                   for r in meth['retrieval_log']],
    )
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
    return data


if __name__ == '__main__':
    d = build_web_data()
    print('site-data.json written:', d['meta']['rows'], 'rows,', d['pooled']['5']['n'], 'unseen-year trades')
