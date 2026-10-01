export interface QuoteItem {
  symbol: string;
  close: number;
  quote_grams: number;
  px_per_10g_pure: number;
  change_rs: number;
  change_pct: number;
  expiry: string;
  vol: number;
  oi: number;
}

export interface MetaInfo {
  coverage_start: string;
  coverage_end: string;
  trading_dates_count: number;
  rows_count: number;
  contracts_count: number;
  no_trade_rows_count: number;
  thin_rows_count: number;
  weekend_sessions: string[];
  manual_cross_check: {
    manual_rows: number;
    mismatches: number;
    status: string;
  };
  latest_quotes: QuoteItem[];
  build_time: string;
  source: string;
}

export interface ContractMasterItem {
  symbol: string;
  lot_grams: number;
  quote_grams: number;
  purity: number;
  expiry_window: string;
  tick_size: number;
}

export interface LifecycleItem {
  symbol: string;
  expiry_date: string;
  first_seen: string;
  liquid_from: string;
  peak_oi_lots: number;
  peak_oi_date: string;
  last_seen: string;
  entry_allowed_start: string;
  entry_allowed_end: string;
  forced_exit_date: string;
  rows: number;
  no_trade_days: number;
}

export interface ContractsData {
  contract_master: Record<string, ContractMasterItem>;
  lifecycle: LifecycleItem[];
}

export interface PairGates {
  enough_history: boolean;
  extreme: boolean;
  edge_beats_cost: boolean;
  liquidity: boolean;
  lifecycle: boolean;
}

export interface HistoricalEvidence {
  past_signals_count: number;
  reverted_count: number;
  stopped_count: number;
  timed_out_count: number;
  revert_rate_pct: number;
  median_days_to_revert: number;
}

export interface PairSummary {
  pair_id: string;
  display_name: string;
  symbol_a: string;
  symbol_b: string;
  close_a?: number;
  close_b?: number;
  quote_grams_a?: number;
  quote_grams_b?: number;
  px_per_10g_pure_a?: number;
  px_per_10g_pure_b?: number;
  px_per_g_pure_a?: number;
  px_per_g_pure_b?: number;
  lot_ratio: string;
  unit_grams: number;
  contracts_label: string;
  expiry_a: string;
  expiry_b: string;
  spread_bps: number;
  spread_rs_10g: number;
  mu: number;
  sd: number;
  z: number;
  z_needed: number;
  percentile: number;
  status: 'SIGNAL' | 'QUIET';
  failed_gates: string[];
  gates: PairGates;
  vol_a: number;
  vol_b: number;
  oi_a: number;
  oi_b: number;
  td_to_exp_a: number;
  td_to_exp_b: number;
  roll_flag: boolean;
  chosen_params: {
    W: number;
    ze: number;
    mh: number;
    zx: number;
  };
  z_histogram: { bin_center: number; count: number }[];
  historical_evidence: HistoricalEvidence;
}

export interface PairSeriesPoint {
  d: string;
  ea: string;
  eb: string;
  s: number;
  s10: number;
  mu: number | null;
  sd: number | null;
  z: number | null;
  roll: boolean;
  seg: 'train' | 'test';
  vol_a: number;
  vol_b: number;
  oi_a: number;
  oi_b: number;
}

export interface AlertPairItem {
  pair_id: string;
  date: string;
  contracts: string;
  expiry_a: string;
  expiry_b: string;
  spread_bps: number;
  spread_rs_10g: number;
  mu: number | null;
  sd: number | null;
  z: number | null;
  z_needed: number;
  deviation_bps: number;
  hurdle_bps: number;
  round_trip_cost_bps: number;
  status: 'SIGNAL' | 'QUIET';
  failed_gates: string[];
  gates: PairGates;
  vol_a: number;
  vol_b: number;
  oi_a: number;
  oi_b: number;
  td_to_exp_a: number;
  td_to_exp_b: number;
  roll_flag: boolean;
}

export interface SignalsToday {
  as_of_date: string;
  headline: string;
  all_quiet: boolean;
  round_trip_cost_bps: number;
  pairs: AlertPairItem[];
}

export interface SignalHistoryItem {
  date: string;
  pair: string;
  entry_date: string;
  exit_date: string;
  expA: string;
  expB: string;
  z: number;
  direction: string;
  outcome: string;
  net_bps: number;
  net_rs: number;
  holding_days: number;
  seg: string;
}

export interface TradeItem {
  pair: string;
  sig: string;
  entry: string;
  exit: string;
  expA: string;
  expB: string;
  z: number;
  side: number;
  grams: number;
  notional: number;
  gross: number;
  gold: number;
  spread_pnl: number;
  cost: number;
  net: number;
  gross_bps: number;
  net_bps: number;
  reason: string;
  days: number;
  seg: 'train' | 'test';
}

export interface MetricsSummary {
  n_trades: number;
  hit_rate: number;
  gross_rs: number;
  cost_rs: number;
  net_rs: number;
  spread_rs: number;
  gold_rs: number;
  gross_bps: number;
  net_bps: number;
  max_drawdown_rs: number;
  avg_holding_days: number;
  sharpe: string | number;
  t_stat: number;
  ci_95: [number, number];
}

export interface EquityPoint {
  date: string;
  exit_date: string;
  seg: 'train' | 'test';
  net: number;
  gross: number;
  cost: number;
  gold: number;
  spread: number;
  trade_net_bps: number;
}

export interface BacktestData {
  pair_id: string;
  slip_bps: number;
  params: {
    W: number;
    ze: number;
    zx: number;
    mh: number;
    notional_per_leg: number;
  };
  metrics_all: MetricsSummary;
  metrics_train: MetricsSummary;
  metrics_test: MetricsSummary;
  trades: TradeItem[];
  equity_curve: EquityPoint[];
  attribution: {
    gross_rs: number;
    costs_rs: number;
    net_rs: number;
    spread_rs: number;
    gold_rs: number;
    direct_gold_pnl_pct?: number;
    pair_correlation_to_gold: number;
    pair_beta_to_gold: number;
    pair_n_trades?: number;
    pair_note?: string;
    pooled_correlation_to_gold?: number;
    pooled_beta_to_gold?: number;
    pooled_n_trades?: number;
    summary_text?: string;
  };
}

export interface RegimeRecord {
  pair_id: string;
  pair: string;
  pre_break_mean: number | null;
  pre_break_text: string;
  post_break_mean: number | null;
  post_break_text: string;
  q1_mean: number | null;
  q1_min: number | null;
  q1_max: number | null;
  q1_text: string;
  comment: string;
}

export interface CostMatrixItem {
  pair_id: string;
  slip_bps: number;
  trades: number;
  gross_bps: number;
  net_bps: number;
  net_rs: number;
  hit_rate: number;
  breakeven_slip_bps: number;
}

export interface GridItem {
  pair: string;
  W: number;
  ze: number;
  mh: number;
  seg: 'train' | 'test';
  n: number;
  net: number;
  net_bps: number;
}

export interface MethodologyData {
  stages: { step: number; name: string; desc: string }[];
  split_dates: {
    train_start: string;
    train_end: string;
    test_start: string;
    test_end: string;
  };
  point_in_time_rules: string[];
  limitations: string[];
  honest_conclusion: string;
}

export interface CurveSnapshotItem {
  symbol: string;
  expiry: string;
  days_to_exp: number;
  px_per_g_pure: number;
  px_per_10g_pure: number;
  oi: number;
}

export interface CurveSnapshot {
  date: string;
  reference_carry_pct: number;
  contracts: CurveSnapshotItem[];
}

export interface CurveData {
  median_carry_pct: number;
  iqr_carry_pct: [number, number];
  reference_carry_series: { date: string; carry_pct: number }[];
  snapshots: CurveSnapshot[];
}

export interface DecompositionRecord {
  d: string;
  e: string;
  p: number;
  tau: number;
  d_ln_F: number;
  gold: number;
  rolldown: number;
  curve: number;
  residual: number;
}
