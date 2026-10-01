"""Tests for pipeline/pairs.py: look-ahead avoidance and series correctness."""
import pytest
import numpy as np
import pandas as pd
from pipeline.load import load_clean_bhavcopy
from pipeline.carry import compute_reference_carry
from pipeline.pairs import build_pair_series, compute_rolling_z, build_all_pairs

def test_pair_counts_and_spreads():
    """Verify pair counts and last spreads match reference."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, _ = compute_reference_carry(df, dates)
    pairs = build_all_pairs(df, carry_series)
    
    expected = {
        'GUINEA_PETAL': (754, 5.3),
        'TEN_PETAL': (387, -40.8),
        'GUINEA_TEN': (387, 46.3),
        'M_PETAL': (743, -46.8),
        'M_TEN': (387, -5.9),
        'M_GUINEA': (743, -52.1),
    }
    
    for pid, (n_exp, last_spread_exp) in expected.items():
        p_df = pairs[pid]
        assert len(p_df) == n_exp, f"{pid} length mismatch: expected {n_exp}, got {len(p_df)}"
        last_spread = p_df['spread'].iloc[-1]
        assert round(last_spread, 1) == last_spread_exp, f"{pid} last spread mismatch: expected {last_spread_exp}, got {last_spread:.1f}"

def test_lookahead_pair_selection():
    """Pair selection at date t must be strictly identical if future data is truncated."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, _ = compute_reference_carry(df, dates)
    
    # Pick a test trading date in the middle of the series
    full_pair = build_pair_series(df, 'M_PETAL', carry_series)
    cutoff_date = full_pair['date'].iloc[len(full_pair) // 2]
    row_full = full_pair[full_pair['date'] == cutoff_date].iloc[0]
    
    # Truncated dataset run
    df_trunc = df[df['date'] <= cutoff_date].copy()
    dates_trunc = np.array(sorted(df_trunc['date'].unique()))
    carry_trunc, _ = compute_reference_carry(df_trunc, dates_trunc)
    trunc_pair = build_pair_series(df_trunc, 'M_PETAL', carry_trunc)
    row_trunc = trunc_pair[trunc_pair['date'] == cutoff_date].iloc[0]
    
    assert row_full['expiry_a'] == row_trunc['expiry_a']
    assert row_full['expiry_b'] == row_trunc['expiry_b']
    assert row_full['spread'] == row_trunc['spread']

def test_lookahead_rolling_z():
    """z at date t must be strictly identical if future data is truncated."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, _ = compute_reference_carry(df, dates)
    
    cutoff_date = pd.Timestamp('2025-11-20')
    
    # Full calculation
    p_full = build_pair_series(df, 'GUINEA_PETAL', carry_series)
    z_full = compute_rolling_z(p_full, W=20)
    val_full = z_full[z_full['date'] == cutoff_date].iloc[0]['z']
    
    # Truncated calculation
    p_trunc = p_full[p_full['date'] <= cutoff_date].copy()
    z_trunc = compute_rolling_z(p_trunc, W=20)
    val_trunc = z_trunc[z_trunc['date'] == cutoff_date].iloc[0]['z']
    
    assert not np.isnan(val_full)
    assert np.isclose(val_full, val_trunc, rtol=1e-12, atol=1e-12), "Look-ahead violation in rolling z!"
