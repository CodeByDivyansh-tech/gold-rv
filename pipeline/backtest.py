"""Walk-forward backtesting engine (Sections 5.1–5.8)."""
import itertools
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from pipeline.config import (
    SPEC_TUPLES,
    PAIR_DEFINITIONS,
    NOTIONAL_PER_LEG,
    TENDER_BUFFER_TD,
    MIN_ENTRY_TD,
    MIN_VOLUME_LOTS,
    MIN_OI_LOTS,
    TRAIN_START,
    TRAIN_END,
    TEST_START,
    TEST_END,
    WINDOW_GRID,
    Z_ENTRY_GRID,
    Z_EXIT,
    MAX_HOLD_GRID,
    SLIPPAGE_SCENARIOS,
    BASE_SLIPPAGE,
)
from pipeline.attribution import calculate_leg_cost, compute_attribution_metrics

def prepare_contract_lookup(df: pd.DataFrame) -> pd.DataFrame:
    """Prepares dataframe indexed by (symbol, expiry, date) for fast lookup."""
    return df.set_index(['symbol', 'expiry', 'date'])

def run_pair_backtest(
    pair_id: str,
    pair_series: pd.DataFrame,
    P: pd.DataFrame,
    dates: np.ndarray,
    tdi: Dict[pd.Timestamp, int],
    W: int,
    ze: float,
    mh: int,
    slip_bps: float,
    zx: float = Z_EXIT,
    start: Optional[pd.Timestamp] = None,
    end: Optional[pd.Timestamp] = None,
) -> pd.DataFrame:
    """
    Simulates walk-forward backtest for a pair series (Sections 5.1–5.5).
    """
    sym_a, sym_b, _ = PAIR_DEFINITIONS[pair_id]
    x = pair_series.copy()
    
    # Point-in-time rolling statistics (strictly past observations only)
    mu = x['spread'].rolling(W).mean().shift(1)
    sd = x['spread'].rolling(W).std().shift(1)
    x['mu'] = mu
    x['sd'] = sd
    x['z'] = (x['spread'] - mu) / sd
    
    if start is not None:
        x = x[x['date'] >= start]
    if end is not None:
        x = x[x['date'] <= end]
        
    x = x.reset_index(drop=True)
    n = len(x)
    trades: List[Dict[str, Any]] = []
    i = 0
    
    def get_row(sym: str, exp: pd.Timestamp, d: pd.Timestamp):
        try:
            return P.loc[(sym, exp, d)]
        except KeyError:
            return None

    while i < n - 1:
        z = x.at[i, 'z']
        
        # Section 5.2: Entry conditions decided at close of t
        ok = (
            not np.isnan(z)
            and abs(z) >= ze
            and x.at[i, 'vol_a'] >= MIN_VOLUME_LOTS
            and x.at[i, 'vol_b'] >= MIN_VOLUME_LOTS
            and x.at[i, 'oi_a'] >= MIN_OI_LOTS
            and x.at[i, 'oi_b'] >= MIN_OI_LOTS
            and x.at[i, 'td_to_exp_a'] >= MIN_ENTRY_TD
            and x.at[i, 'td_to_exp_b'] >= MIN_ENTRY_TD
            and not x.at[i, 'roll']
        )
        if not ok:
            i += 1
            continue
            
        ea = x.at[i, 'expiry_a']
        eb = x.at[i, 'expiry_b']
        sig_date = x.at[i, 'date']
        
        # Section 5.5: Fill at close of t+1
        curr_ti = tdi[sig_date]
        if curr_ti + 1 >= len(dates):
            break
        d1 = dates[curr_ti + 1]
        
        ra = get_row(sym_a, ea, d1)
        rb = get_row(sym_b, eb, d1)
        if ra is None or rb is None or ra['no_trade'] or rb['no_trade']:
            # Skip if t+1 is no-trade day
            i += 1
            continue
            
        side = -np.sign(z)  # z > 0 -> short A, long B (side = -1); z < 0 -> long A, short B (side = +1)
        
        # Walk forward on series rows while same contracts
        j_match = x.index[x['date'] == d1]
        j = j_match[0] if len(j_match) > 0 else i + 1
        k_ = j
        reason = 'end'
        
        while True:
            if k_ >= n - 1:
                reason = 'data_end'
                break
            if x.at[k_, 'expiry_a'] != ea or x.at[k_, 'expiry_b'] != eb:
                k_ -= 1
                reason = 'roll'
                break
            zz = x.at[k_, 'z']
            if min(x.at[k_, 'td_to_exp_a'], x.at[k_, 'td_to_exp_b']) <= TENDER_BUFFER_TD:
                reason = 'expiry'
                break
            if not np.isnan(zz) and abs(zz) <= zx:
                reason = 'revert'
                break
            if not np.isnan(zz) and abs(zz) >= ze + 1.5:
                reason = 'stop'
                break
            if tdi[x.at[k_, 'date']] - tdi[d1] >= mh:
                reason = 'time'
                break
            k_ += 1
            
        k_ = max(k_, j)
        
        # Exit fill at close of k+1 (or k if k+1 no-trade / end)
        exit_sig_date = x.at[k_, 'date']
        exit_ti = tdi[exit_sig_date]
        dx = dates[exit_ti + 1] if exit_ti + 1 < len(dates) else exit_sig_date
        xa = get_row(sym_a, ea, dx)
        xb = get_row(sym_b, eb, dx)
        if xa is None or xb is None or xa['no_trade'] or xb['no_trade']:
            dx = exit_sig_date
            xa = get_row(sym_a, ea, dx)
            xb = get_row(sym_b, eb, dx)
            
        # Section 5.4: Sizing (equal grams, ~NOTIONAL_PER_LEG per leg)
        lot_g_a, quote_g_a, purity_a = SPEC_TUPLES[sym_a]
        lot_g_b, quote_g_b, purity_b = SPEC_TUPLES[sym_b]
        
        g = (lot_g_a * lot_g_b) // np.gcd(lot_g_a, lot_g_b)
        units = max(1, round(NOTIONAL_PER_LEG / (g * ra['px'])))
        grams = g * units
        
        # P&L in ₹ (Section 5.8)
        pnl_a = side * grams * (xa['close'] - ra['close']) / quote_g_a
        pnl_b = -side * grams * (xb['close'] - rb['close']) / quote_g_b
        gross = pnl_a + pnl_b
        
        # Gold attribution: net pure grams * ref change
        net_pure = side * grams * purity_a - side * grams * purity_b
        gold = net_pure * (xb['px'] - rb['px'])
        spread_pnl = gross - gold
        
        notA = grams * ra['px'] * purity_a
        notB = grams * rb['px'] * purity_b
        
        # Section 5.7: Costs for both legs (entry + exit)
        cost_a = calculate_leg_cost(notA, side_buy=(side > 0), slip_bps=slip_bps, is_thin=ra['thin']) + \
                 calculate_leg_cost(notA, side_buy=(side < 0), slip_bps=slip_bps, is_thin=xa['thin'])
        cost_b = calculate_leg_cost(notB, side_buy=(side < 0), slip_bps=slip_bps, is_thin=rb['thin']) + \
                 calculate_leg_cost(notB, side_buy=(side > 0), slip_bps=slip_bps, is_thin=xb['thin'])
        cost = cost_a + cost_b
        net = gross - cost
        
        gross_bps = (gross / notA) * 1e4
        net_bps = (net / notA) * 1e4
        holding_days = tdi[dx] - tdi[d1]
        
        lots_a = grams / lot_g_a
        lots_b = grams / lot_g_b
        cap_flag = (lots_a > 0.05 * x.at[i, 'vol_a']) or (lots_b > 0.05 * x.at[i, 'vol_b'])
        gold_ret_bps = (xb['px'] / rb['px'] - 1.0) * 1e4

        trades.append({
            'pair': pair_id,
            'sig': sig_date,
            'entry': d1,
            'exit': dx,
            'expA': ea.date() if hasattr(ea, 'date') else ea,
            'expB': eb.date() if hasattr(eb, 'date') else eb,
            'z': round(float(z), 2),
            'side': int(side),
            'grams': int(grams),
            'notional': round(float(notA)),
            'gross': float(gross),
            'gold': float(gold),
            'spread_pnl': float(spread_pnl),
            'cost': float(cost),
            'net': float(net),
            'gross_bps': float(gross_bps),
            'net_bps': float(net_bps),
            'gold_ret_bps': float(gold_ret_bps),
            'reason': reason,
            'days': int(holding_days),
            'capacity_flag': bool(cap_flag),
        })
        
        # Resume scanning after exit signal date
        i = x.index[x['date'] == exit_sig_date][0] + 1
        
    return pd.DataFrame(trades)

def run_grid_search(
    pairs_dict: Dict[str, pd.DataFrame],
    P: pd.DataFrame,
    dates: np.ndarray,
    tdi: Dict[pd.Timestamp, int],
    train_end: str = TRAIN_END,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Evaluates parameter grid on Train and Test segments.
    Selects best parameters per pair on Train at 5 bps slippage.
    """
    t_end = pd.Timestamp(train_end)
    grid = list(itertools.product(WINDOW_GRID, Z_ENTRY_GRID, MAX_HOLD_GRID))
    res: List[Dict[str, Any]] = []
    
    for pair_id, p_df in pairs_dict.items():
        for W, ze, mh in grid:
            t = run_pair_backtest(pair_id, p_df, P, dates, tdi, W, ze, mh, slip_bps=BASE_SLIPPAGE)
            if not t.empty:
                t_train = t[t['entry'] <= t_end]
                t_test = t[t['entry'] > t_end]
            else:
                t_train = pd.DataFrame()
                t_test = pd.DataFrame()
                
            res.append({
                'pair': pair_id,
                'W': W,
                'ze': ze,
                'mh': mh,
                'seg': 'train',
                'n': len(t_train),
                'net': float(t_train['net'].sum()) if len(t_train) else 0.0,
                'net_bps': float(t_train['net_bps'].mean()) if len(t_train) else np.nan,
            })
            res.append({
                'pair': pair_id,
                'W': W,
                'ze': ze,
                'mh': mh,
                'seg': 'test',
                'n': len(t_test),
                'net': float(t_test['net'].sum()) if len(t_test) else 0.0,
                'net_bps': float(t_test['net_bps'].mean()) if len(t_test) else np.nan,
            })
            
    grid_df = pd.DataFrame(res)
    
    # Best per pair on Train by total net ₹
    best_df = (
        grid_df[grid_df['seg'] == 'train']
        .sort_values('net', ascending=False)
        .groupby('pair')
        .head(1)
        .set_index('pair')[['W', 'ze', 'mh']]
    )
    
    return grid_df, best_df

def run_all_scenarios(
    pairs_dict: Dict[str, pd.DataFrame],
    best_params: pd.DataFrame,
    P: pd.DataFrame,
    dates: np.ndarray,
    tdi: Dict[pd.Timestamp, int],
    train_end: str = TRAIN_END,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Runs best configuration per pair across all slippage scenarios (0, 2, 5, 10 bps).
    Returns (all_trades_df, summary_df).
    """
    t_end = pd.Timestamp(train_end)
    all_trades: List[pd.DataFrame] = []
    
    for pair_id, row in best_params.iterrows():
        W, ze, mh = int(row['W']), float(row['ze']), int(row['mh'])
        p_df = pairs_dict[pair_id]
        
        for slip in SLIPPAGE_SCENARIOS:
            t = run_pair_backtest(pair_id, p_df, P, dates, tdi, W, ze, mh, slip_bps=slip)
            if not t.empty:
                t['seg'] = np.where(t['entry'] <= t_end, 'train', 'test')
                t['slip'] = slip
                all_trades.append(t)
                
    if not all_trades:
        return pd.DataFrame(), pd.DataFrame()
        
    all_trades_df = pd.concat(all_trades, ignore_index=True)
    
    # Aggregated summary matching reference_summary.csv
    summary_df = (
        all_trades_df.groupby(['pair', 'slip', 'seg'])
        .agg(
            n=('net', 'size'),
            gross_bps=('gross_bps', 'mean'),
            net_bps=('net_bps', 'mean'),
            net_rs=('net', 'sum'),
            gold_rs=('gold', 'sum'),
            spread_rs=('spread_pnl', 'sum'),
            cost_rs=('cost', 'sum'),
            hit=('net', lambda s: (s > 0).mean()),
        )
        .round(1)
    )
    
    return all_trades_df, summary_df
