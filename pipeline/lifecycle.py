"""Contract lifecycle calculations and Gantt timeline data (Section 7)."""
import pandas as pd
import numpy as np
from typing import Dict, List, Any

def compute_contract_lifecycle(df: pd.DataFrame) -> pd.DataFrame:
    """
    Recomputes contract calendar with lifecycle windows (Section 7):
    - first_seen
    - liquid_from: first date OI >= 25% of peak OI
    - peak_oi_lots, peak_oi_date
    - last_seen
    - entry_allowed_window: liquid_from -> (expiry - 7 TD)
    - forced_exit_date: (expiry - 4 TD)
    """
    records = []
    
    for (sym, exp), g in df.groupby(['symbol', 'expiry']):
        g = g.sort_values('date').reset_index(drop=True)
        first_seen = g['date'].min()
        last_seen = g['date'].max()
        rows_count = len(g)
        no_trade_count = int(g['no_trade'].sum())
        
        peak_idx = g['oi'].idxmax()
        peak_oi = int(g.loc[peak_idx, 'oi'])
        peak_date = g.loc[peak_idx, 'date']
        
        # liquid_from: first date OI >= 25% of peak OI
        if peak_oi > 0:
            liq_sub = g[g['oi'] >= 0.25 * peak_oi]
            liquid_from = liq_sub['date'].min() if not liq_sub.empty else first_seen
        else:
            liquid_from = first_seen
            
        # Entry allowed end (expiry - 7 TD)
        # In our precalculated td_to_exp, we find dates where td_to_exp >= 7
        td7_rows = g[g['td_to_exp'] >= 7]
        entry_allowed_end = td7_rows['date'].max() if not td7_rows.empty else last_seen
        
        # Forced exit date (expiry - 4 TD)
        td4_rows = g[g['td_to_exp'] <= 4]
        forced_exit_date = td4_rows['date'].min() if not td4_rows.empty else last_seen
        
        records.append({
            'symbol': sym,
            'expiry_date': exp.strftime('%Y-%m-%d') if hasattr(exp, 'strftime') else str(exp),
            'first_seen': first_seen.strftime('%Y-%m-%d'),
            'liquid_from': liquid_from.strftime('%Y-%m-%d'),
            'peak_oi_lots': peak_oi,
            'peak_oi_date': peak_date.strftime('%Y-%m-%d'),
            'last_seen': last_seen.strftime('%Y-%m-%d'),
            'entry_allowed_start': liquid_from.strftime('%Y-%m-%d'),
            'entry_allowed_end': entry_allowed_end.strftime('%Y-%m-%d') if pd.notna(entry_allowed_end) else last_seen.strftime('%Y-%m-%d'),
            'forced_exit_date': forced_exit_date.strftime('%Y-%m-%d') if pd.notna(forced_exit_date) else last_seen.strftime('%Y-%m-%d'),
            'rows': rows_count,
            'no_trade_days': no_trade_count,
        })
        
    return pd.DataFrame(records).sort_values(['symbol', 'expiry_date']).reset_index(drop=True)


def calendar_check(trades: pd.DataFrame, lifecycle_df: pd.DataFrame) -> Dict[str, Any]:
    """Every trade must sit inside both contracts' calendars: entered on a day both were listed, closed on or
    before the last day either traded and never after expiry. Also counts trades the calendar closed early
    (a contract roll or the approach of expiry and its tender period)."""
    from pipeline.config import PAIR_DEFINITIONS
    lc = lifecycle_df.set_index(['symbol', 'expiry_date'])
    ds = lambda v: pd.Timestamp(v).strftime('%Y-%m-%d')
    inside = 0
    for _, t in trades.iterrows():
        a, b, _ = PAIR_DEFINITIONS[t['pair']]
        e, x = ds(t['entry']), ds(t['exit'])
        ok = True
        for sym, exp in ((a, ds(t['expA'])), (b, ds(t['expB']))):
            if (sym, exp) not in lc.index:
                ok = False
                break
            c = lc.loc[(sym, exp)]
            ok = ok and c['first_seen'] <= e <= c['last_seen'] and e <= x <= c['last_seen'] and x <= exp
        inside += bool(ok)
    reasons = trades['reason'].value_counts() if len(trades) else pd.Series(dtype=int)
    return {'n': int(len(trades)), 'inside': int(inside),
            'closed_roll': int(reasons.get('roll', 0)), 'closed_expiry': int(reasons.get('expiry', 0))}
