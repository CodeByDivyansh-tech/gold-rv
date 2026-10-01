"""Alert engine and gate evaluation (Section 6)."""
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple
from pipeline.config import (
    BASE_SLIPPAGE,
    MIN_ENTRY_TD,
    MIN_VOLUME_LOTS,
    MIN_OI_LOTS,
)
from pipeline.attribution import calculate_round_trip_cost_bps

def evaluate_pair_gates(
    row: pd.Series,
    W: int,
    ze: float,
    round_trip_cost_bps: float,
) -> Tuple[bool, List[str], Dict[str, bool]]:
    """
    Evaluates 5 gates from Section 6 for a given pair row:
    1. Enough history: >= W prior observations
    2. Extreme: |z| >= z_entry
    3. Edge beats cost: |spread - mu| >= 2 * round_trip_cost_bps
    4. Liquidity: both legs volume >= 25 lots and OI >= 50, not thin
    5. Lifecycle: both legs >= 7 trading days to expiry, not a roll day
    """
    gates = {}
    failed_reasons = []
    
    # Gate 1: Enough history
    z = row.get('z', np.nan)
    mu = row.get('mu', np.nan)
    has_history = not np.isnan(z) and not np.isnan(mu)
    gates['enough_history'] = has_history
    if not has_history:
        failed_reasons.append('history')
        
    # Gate 2: Extreme
    is_extreme = has_history and (abs(z) >= ze)
    gates['extreme'] = is_extreme
    if not is_extreme:
        failed_reasons.append('extreme')
        
    # Gate 3: Edge beats cost
    deviation_bps = abs(row['spread'] - mu) if has_history else 0.0
    hurdle_bps = 2.0 * round_trip_cost_bps
    edge_beats_cost = has_history and (deviation_bps >= hurdle_bps)
    gates['edge_beats_cost'] = edge_beats_cost
    if not edge_beats_cost:
        failed_reasons.append('edge')
        
    # Gate 4: Liquidity
    vol_ok = (row['vol_a'] >= MIN_VOLUME_LOTS) and (row['vol_b'] >= MIN_VOLUME_LOTS)
    oi_ok = (row['oi_a'] >= MIN_OI_LOTS) and (row['oi_b'] >= MIN_OI_LOTS)
    not_thin = not bool(row.get('thin_a', False)) and not bool(row.get('thin_b', False))
    liquidity_ok = vol_ok and oi_ok and not_thin
    gates['liquidity'] = liquidity_ok
    if not liquidity_ok:
        failed_reasons.append('liquidity')
        
    # Gate 5: Lifecycle
    td_ok = (row['td_to_exp_a'] >= MIN_ENTRY_TD) and (row['td_to_exp_b'] >= MIN_ENTRY_TD)
    not_roll = not bool(row.get('roll', False)) and not bool(row.get('roll_flag', False))
    lifecycle_ok = td_ok and not_roll
    gates['lifecycle'] = lifecycle_ok
    if not lifecycle_ok:
        failed_reasons.append('lifecycle')
        
    is_signal = all(gates.values())
    return is_signal, failed_reasons, gates

def generate_today_alerts(
    pairs_dict: Dict[str, pd.DataFrame],
    best_params: pd.DataFrame,
    as_of_date: pd.Timestamp = None,
) -> Dict[str, Any]:
    """
    Evaluates alerts across all pairs for the latest date (Section 6).
    """
    rt_cost_bps = calculate_round_trip_cost_bps(slip_bps=BASE_SLIPPAGE)
    hurdle_bps = 2.0 * rt_cost_bps
    
    pairs_alerts = []
    
    for pair_id, row in best_params.iterrows():
        W, ze, mh = int(row['W']), float(row['ze']), int(row['mh'])
        p_df = pairs_dict[pair_id].copy()
        
        # Calculate rolling stats with chosen W
        mu = p_df['spread'].rolling(W).mean().shift(1)
        sd = p_df['spread'].rolling(W).std().shift(1)
        p_df['mu'] = mu
        p_df['sd'] = sd
        p_df['z'] = (p_df['spread'] - mu) / sd
        
        if as_of_date is not None:
            sub = p_df[p_df['date'] <= as_of_date]
        else:
            sub = p_df
            
        last_row = sub.iloc[-1]
        dt = last_row['date']
        
        is_signal, failed_reasons, gates = evaluate_pair_gates(
            last_row, W=W, ze=ze, round_trip_cost_bps=rt_cost_bps
        )
        
        exp_a_str = last_row['expiry_a'].strftime('%b-%y') if hasattr(last_row['expiry_a'], 'strftime') else str(last_row['expiry_a'])
        exp_b_str = last_row['expiry_b'].strftime('%b-%y') if hasattr(last_row['expiry_b'], 'strftime') else str(last_row['expiry_b'])
        
        pairs_alerts.append({
            'pair_id': pair_id,
            'date': dt.strftime('%Y-%m-%d'),
            'contracts': f"{exp_a_str} / {exp_b_str}",
            'expiry_a': last_row['expiry_a'].strftime('%Y-%m-%d') if hasattr(last_row['expiry_a'], 'strftime') else str(last_row['expiry_a']),
            'expiry_b': last_row['expiry_b'].strftime('%Y-%m-%d') if hasattr(last_row['expiry_b'], 'strftime') else str(last_row['expiry_b']),
            'spread_bps': round(float(last_row['spread']), 1),
            'spread_rs_10g': round(float(last_row.get('spread_rs_10g', (last_row['px_a'] - last_row['px_b']) * 10)), 1),
            'mu': round(float(last_row['mu']), 1) if not np.isnan(last_row['mu']) else None,
            'sd': round(float(last_row['sd']), 1) if not np.isnan(last_row['sd']) else None,
            'z': round(float(last_row['z']), 2) if not np.isnan(last_row['z']) else None,
            'z_needed': ze,
            'deviation_bps': round(abs(float(last_row['spread'] - last_row['mu'])), 1) if not np.isnan(last_row['mu']) else 0.0,
            'hurdle_bps': round(hurdle_bps, 1),
            'round_trip_cost_bps': round(rt_cost_bps, 1),
            'status': 'SIGNAL' if is_signal else 'QUIET',
            'failed_gates': failed_reasons,
            'gates': gates,
            'vol_a': int(last_row['vol_a']),
            'vol_b': int(last_row['vol_b']),
            'oi_a': int(last_row['oi_a']),
            'oi_b': int(last_row['oi_b']),
            'td_to_exp_a': int(last_row['td_to_exp_a']),
            'td_to_exp_b': int(last_row['td_to_exp_b']),
            'roll_flag': bool(last_row.get('roll', False)),
        })
        
    all_quiet = all(p['status'] == 'QUIET' for p in pairs_alerts)
    headline = "No meaningful signal today" if all_quiet else "RV Divergence Signals Detected"
    
    return {
        'as_of_date': pairs_alerts[0]['date'] if pairs_alerts else '',
        'headline': headline,
        'all_quiet': all_quiet,
        'round_trip_cost_bps': round(rt_cost_bps, 1),
        'pairs': pairs_alerts,
    }

def generate_signals_history(
    all_trades_df: pd.DataFrame,
) -> List[Dict[str, Any]]:
    """
    Extracts every historical signal and its outcome from the executed trades (at base slippage).
    """
    if all_trades_df.empty:
        return []
        
    base_trades = all_trades_df[all_trades_df['slip'] == BASE_SLIPPAGE].copy()
    history = []
    
    for _, t in base_trades.iterrows():
        history.append({
            'date': t['sig'].strftime('%Y-%m-%d') if hasattr(t['sig'], 'strftime') else str(t['sig']),
            'pair': t['pair'],
            'entry_date': t['entry'].strftime('%Y-%m-%d') if hasattr(t['entry'], 'strftime') else str(t['entry']),
            'exit_date': t['exit'].strftime('%Y-%m-%d') if hasattr(t['exit'], 'strftime') else str(t['exit']),
            'expA': str(t['expA']),
            'expB': str(t['expB']),
            'z': t['z'],
            'direction': 'Long A / Short B' if t['side'] > 0 else 'Short A / Long B',
            'outcome': t['reason'],
            'net_bps': round(float(t['net_bps']), 1),
            'net_rs': round(float(t['net']), 1),
            'holding_days': int(t['days']),
            'seg': str(t.get('seg', 'test')),
        })
        
    # Sort descending by date
    history.sort(key=lambda x: x['date'], reverse=True)
    return history
