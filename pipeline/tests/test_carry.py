"""Tests for pipeline/carry.py according to Section 12."""
import pytest
import numpy as np
import pandas as pd
from pipeline.load import load_clean_bhavcopy
from pipeline.carry import compute_reference_carry, compute_carry_decomposition

def test_goldpetal_carry_sanity():
    """GOLDPETAL median implied carry between 3% and 12% (reference: 8.0%)."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, chosen = compute_reference_carry(df, dates)
    
    med = chosen['c'].median() * 100.0
    q25, q75 = chosen['c'].quantile([0.25, 0.75]) * 100.0
    
    print(f"Carry %: median {med:.2f} IQR [{q25:.2f}, {q75:.2f}]")
    assert 3.0 <= med <= 12.0, f"Median carry {med:.2f}% out of bounds [3%, 12%]"
    assert abs(med - 8.03) < 0.1, f"Expected median ~8.03%, got {med:.2f}%"

def test_carry_decomposition_identity():
    """Verify that Δln F_i = gold_move + rolldown + curve_change + residual."""
    df, dates, tdi = load_clean_bhavcopy('data/raw/gold_bhavcopy_clean.csv')
    carry_series, chosen = compute_reference_carry(df, dates)
    decomp = compute_carry_decomposition(df, carry_series, chosen)
    
    assert len(decomp) > 0
    # Check identity
    recon = decomp['gold_move'] + decomp['rolldown'] + decomp['curve_change'] + decomp['residual']
    diff = np.abs(decomp['d_ln_F'] - recon)
    assert np.all(diff < 1e-10), f"Decomposition identity failed with max diff {diff.max()}"
