"""Price normalization according to Section 4.1 of SPEC.md."""
import numpy as np
import pandas as pd
from pipeline.config import CONTRACT_SPECS, SPEC_TUPLES

def calculate_px_per_g_pure(close: float | pd.Series | np.ndarray, 
                           quote_grams: float | pd.Series | np.ndarray, 
                           purity: float | pd.Series | np.ndarray) -> float | pd.Series | np.ndarray:
    """
    Section 4.1: Normalization
    px_per_g_pure = close / quote_grams / purity
    """
    return close / quote_grams / purity

def normalize_prices(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensures lot_grams, quote_grams, purity, and px_per_g_pure are populated on the dataframe.
    """
    df = df.copy()
    if 'lot_grams' not in df.columns or df['lot_grams'].isna().any():
        df['lot_grams'] = df['symbol'].map(lambda s: CONTRACT_SPECS[s].lot_grams)
    if 'quote_grams' not in df.columns or df['quote_grams'].isna().any():
        df['quote_grams'] = df['symbol'].map(lambda s: CONTRACT_SPECS[s].quote_grams)
    if 'purity' not in df.columns or df['purity'].isna().any():
        df['purity'] = df['symbol'].map(lambda s: CONTRACT_SPECS[s].purity)
        
    df['px_per_g_pure'] = calculate_px_per_g_pure(df['close'], df['quote_grams'], df['purity'])
    df['px_per_10g_pure'] = df['px_per_g_pure'] * 10.0
    return df
