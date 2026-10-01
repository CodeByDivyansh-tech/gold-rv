"""Configuration constants for the Gold Relative-Value Intelligence Pipeline."""
import datetime
from typing import Dict, Tuple, NamedTuple

class ContractSpec(NamedTuple):
    symbol: str
    lot_grams: int
    quote_grams: int
    purity: float
    expiry_window: str
    tick_size: float = 1.0

# Section 2.3: Contract Master
CONTRACT_SPECS: Dict[str, ContractSpec] = {
    'GOLDM': ContractSpec(
        symbol='GOLDM',
        lot_grams=100,
        quote_grams=10,
        purity=0.995,
        expiry_window='3rd-5th',
        tick_size=1.0,
    ),
    'GOLDTEN': ContractSpec(
        symbol='GOLDTEN',
        lot_grams=10,
        quote_grams=10,
        purity=0.999,
        expiry_window='27th-31st',
        tick_size=1.0,
    ),
    'GOLDGUINEA': ContractSpec(
        symbol='GOLDGUINEA',
        lot_grams=8,
        quote_grams=8,
        purity=0.999,
        expiry_window='27th-31st',
        tick_size=1.0,
    ),
    'GOLDPETAL': ContractSpec(
        symbol='GOLDPETAL',
        lot_grams=1,
        quote_grams=1,
        purity=0.999,
        expiry_window='27th-31st',
        tick_size=1.0,
    ),
}

# Quick lookup tuple format matching reference: (lot_g, quote_g, purity)
SPEC_TUPLES: Dict[str, Tuple[int, int, float]] = {
    k: (v.lot_grams, v.quote_grams, v.purity) for k, v in CONTRACT_SPECS.items()
}

# Section 4.4: Pairs Specification
# Pair ID -> (Leg A, Leg B, max_gap_days, lot_ratio_str, unit_grams)
class PairSpec(NamedTuple):
    pair_id: str
    symbol_a: str
    symbol_b: str
    max_gap_days: int
    lot_ratio_str: str
    unit_grams: int

PAIRS: Dict[str, PairSpec] = {
    'GUINEA_PETAL': PairSpec('GUINEA_PETAL', 'GOLDGUINEA', 'GOLDPETAL', 0, '1 : 8', 8),
    'TEN_PETAL': PairSpec('TEN_PETAL', 'GOLDTEN', 'GOLDPETAL', 0, '1 : 10', 10),
    'GUINEA_TEN': PairSpec('GUINEA_TEN', 'GOLDGUINEA', 'GOLDTEN', 0, '5 : 4', 40),
    'M_PETAL': PairSpec('M_PETAL', 'GOLDM', 'GOLDPETAL', 25, '1 : 100', 100),
    'M_TEN': PairSpec('M_TEN', 'GOLDM', 'GOLDTEN', 25, '1 : 10', 100),
    'M_GUINEA': PairSpec('M_GUINEA', 'GOLDM', 'GOLDGUINEA', 25, '2 : 25', 200),
}

# Quick lookup format matching reference
PAIR_DEFINITIONS = {
    'GUINEA_PETAL': ('GOLDGUINEA', 'GOLDPETAL', 0),
    'TEN_PETAL': ('GOLDTEN', 'GOLDPETAL', 0),
    'GUINEA_TEN': ('GOLDGUINEA', 'GOLDTEN', 0),
    'M_PETAL': ('GOLDM', 'GOLDPETAL', 25),
    'M_TEN': ('GOLDM', 'GOLDTEN', 25),
    'M_GUINEA': ('GOLDM', 'GOLDGUINEA', 25),
}

# Dates (Section 5.1)
TRAIN_START = '2023-10-10'
TRAIN_END = '2025-09-30'
TEST_START = '2025-10-01'
TEST_END = '2026-09-30'

# Trading parameters & thresholds (Sections 5.2, 5.3, 5.4)
TENDER_BUFFER_TD = 4        # Days before expiry to force square-off
MIN_ENTRY_TD = 7            # Min trading days to expiry on entry
MIN_VOLUME_LOTS = 25        # Liquidity filter
MIN_OI_LOTS = 50            # Liquidity filter
THIN_VOLUME_THRESHOLD = 25  # Volume below which is considered thin
THIN_OI_THRESHOLD = 50      # OI below which is considered thin
NOTIONAL_PER_LEG = 1_000_000 # Target notional in ₹ per leg (~₹10 Lakh)
DEFAULT_CARRY = 0.06        # Default reference carry if none available

# Grid search parameters (Section 5.1)
WINDOW_GRID = [10, 20, 30]
Z_ENTRY_GRID = [1.5, 2.0, 2.5]
Z_EXIT = 0.5
MAX_HOLD_GRID = [5, 10]
SLIPPAGE_SCENARIOS = [0, 2, 5, 10] # bps
BASE_SLIPPAGE = 5                  # bps

# Section 5.7: Statutory & Transaction Cost rates
BROKERAGE_PER_ORDER = 20.0          # Flat ₹20 per order
EXCHANGE_TURNOVER_RATE = 0.000021   # 0.0021% on notional
SEBI_TURNOVER_RATE = 0.000001       # ₹10 per crore (0.0001%)
CTT_RATE = 0.0001                   # 0.01% on sell side
STAMP_DUTY_RATE = 0.00002           # 0.002% on buy side
GST_RATE = 0.18                     # 18% on (brokerage + exchange + sebi)
THIN_SLIPPAGE_MULTIPLIER = 3.0      # 3x slippage when thin
