"""Tests for pipeline/load.py and pipeline/normalize.py according to Section 12."""
import pytest
import pandas as pd
import numpy as np
from pipeline.load import load_clean_bhavcopy
from pipeline.normalize import calculate_px_per_g_pure
from pipeline.config import CONTRACT_SPECS

def test_normalization_fixtures():
    """Fixtures from Section 4.1 must match to 2 decimals."""
    fixtures = [
        ('GOLDM', '2025-05-05', '2025-05-02', 93126, 9359.40),
        ('GOLDPETAL', '2025-04-30', '2025-04-29', 9659, 9668.67),
        ('GOLDTEN', '2025-06-30', '2025-06-02', 97533, 9763.06),
        ('GOLDGUINEA', '2025-06-30', '2025-06-02', 78139, 9777.15),
        ('GOLDPETAL', '2025-06-30', '2025-06-02', 9788, 9797.80),
        ('GOLDM', '2027-02-05', '2026-09-25', 156019, 15680.30),
        ('GOLDPETAL', '2027-02-26', '2026-09-25', 15895, 15910.91),
    ]
    for sym, exp, dt, close, expected_px in fixtures:
        spec = CONTRACT_SPECS[sym]
        calc_px = calculate_px_per_g_pure(close, spec.quote_grams, spec.purity)
        assert round(float(calc_px), 2) == expected_px, f"Fixture mismatch for {sym} {exp} {dt}: expected {expected_px}, got {calc_px:.2f}"

def test_dataset_integrity():
    """Test primary key uniqueness and volume_grams / volume_lots consistency."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    
    # 0 duplicate primary keys
    assert not df.duplicated(subset=['symbol', 'expiry', 'date']).any(), "Duplicate primary keys found!"
    
    # volume_grams / volume_lots == lot_grams on traded rows
    traded = df[~df['no_trade_day'] & (df['vol'] > 0)]
    if 'volume_grams' in traded.columns:
        gram_per_lot = (traded['volume_grams'] / traded['vol']).round().astype(int)
        assert (gram_per_lot == traded['lot_grams']).all(), "volume_grams / volume_lots does not match lot_grams!"

    # Fixture verification directly in loaded data
    fixtures = [
        ('GOLDM', '2025-05-05', '2025-05-02', 9359.40),
        ('GOLDPETAL', '2025-04-30', '2025-04-29', 9668.67),
        ('GOLDTEN', '2025-06-30', '2025-06-02', 9763.06),
        ('GOLDGUINEA', '2025-06-30', '2025-06-02', 9777.15),
        ('GOLDPETAL', '2025-06-30', '2025-06-02', 9797.80),
        ('GOLDM', '2027-02-05', '2026-09-25', 15680.30),
        ('GOLDPETAL', '2027-02-26', '2026-09-25', 15910.91),
    ]
    for sym, exp, dt, expected_px in fixtures:
        row = df[(df['symbol'] == sym) & (df['expiry'] == pd.Timestamp(exp)) & (df['date'] == pd.Timestamp(dt))]
        assert len(row) == 1, f"Missing fixture row in data: {sym} {exp} {dt}"
        assert round(float(row.iloc[0]['px_per_g_pure']), 2) == expected_px
