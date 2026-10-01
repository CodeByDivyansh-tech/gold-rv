"""Tests for pipeline/alerts.py and pipeline/lifecycle.py (Sections 6, 7, 12)."""
import pytest
import pandas as pd
import numpy as np
from pipeline.load import load_clean_bhavcopy
from pipeline.carry import compute_reference_carry
from pipeline.pairs import build_all_pairs
from pipeline.backtest import prepare_contract_lookup, run_grid_search, run_all_scenarios
from pipeline.alerts import generate_today_alerts
from pipeline.lifecycle import compute_contract_lifecycle

def test_alerts_on_last_date():
    """Alerts on 2026-09-30: all six pairs QUIET with failed gates matching Section 6."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, _ = compute_reference_carry(df, dates)
    pairs = build_all_pairs(df, carry_series)
    P = prepare_contract_lookup(df)
    
    _, best_params = run_grid_search(pairs, P, dates, tdi)
    alerts = generate_today_alerts(pairs, best_params)
    
    # 1. Headline and all quiet
    assert alerts['all_quiet'] is True
    assert alerts['headline'] == "No meaningful signal today"
    assert len(alerts['pairs']) == 6
    
    # Check individual failed gates per pair
    expected_failures = {
        'M_PETAL': ['edge'],
        'M_GUINEA': ['extreme', 'edge', 'lifecycle'],
        'M_TEN': ['extreme', 'edge'],
        'GUINEA_TEN': ['extreme', 'edge'],
        'TEN_PETAL': ['extreme', 'edge'],
        'GUINEA_PETAL': ['extreme', 'edge'],
    }
    
    for p in alerts['pairs']:
        pid = p['pair_id']
        assert p['status'] == 'QUIET', f"{pid} should be QUIET but was {p['status']}"
        assert pid in expected_failures, f"Unexpected pair {pid}"
        for expected_fail in expected_failures[pid]:
            assert expected_fail in p['failed_gates'], f"{pid} expected failed gate '{expected_fail}', got {p['failed_gates']}"

def test_trades_within_lifecycle_windows():
    """Every trade's entry and exit lie inside its contracts' lifecycle windows."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, _ = compute_reference_carry(df, dates)
    pairs = build_all_pairs(df, carry_series)
    P = prepare_contract_lookup(df)
    
    _, best_params = run_grid_search(pairs, P, dates, tdi)
    all_trades, _ = run_all_scenarios(pairs, best_params, P, dates, tdi)
    lifecycle_df = compute_contract_lifecycle(df).set_index(['symbol', 'expiry_date'])
    
    for _, t in all_trades.iterrows():
        # Leg A and B lifecycles
        expA_str = pd.Timestamp(t['expA']).strftime('%Y-%m-%d')
        expB_str = pd.Timestamp(t['expB']).strftime('%Y-%m-%d')
        
        # Symbol A, Symbol B
        from pipeline.config import PAIR_DEFINITIONS
        symA, symB, _ = PAIR_DEFINITIONS[t['pair']]
        
        lcA = lifecycle_df.loc[(symA, expA_str)]
        lcB = lifecycle_df.loc[(symB, expB_str)]
        
        entry_str = pd.Timestamp(t['entry']).strftime('%Y-%m-%d')
        exit_str = pd.Timestamp(t['exit']).strftime('%Y-%m-%d')
        
        # Entry must be on or after first_seen and before or on last_seen
        assert entry_str >= lcA['first_seen'] and entry_str <= lcA['last_seen']
        assert entry_str >= lcB['first_seen'] and entry_str <= lcB['last_seen']
        # Exit must be on or after entry and before or on last_seen
        assert exit_str >= entry_str
        assert exit_str <= lcA['last_seen']
        assert exit_str <= lcB['last_seen']
