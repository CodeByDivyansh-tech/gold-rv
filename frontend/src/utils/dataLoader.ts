import {
  MetaInfo,
  ContractsData,
  PairSummary,
  PairSeriesPoint,
  SignalsToday,
  SignalHistoryItem,
  BacktestData,
  CostMatrixItem,
  GridItem,
  MethodologyData,
  CurveData,
  DecompositionRecord,
  RegimeRecord,
  RetrievalLogItem,
} from '../types';

const BASE_URL = './data';

async function fetchJson<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const dataLoader = {
  getMeta: () => fetchJson<MetaInfo>('meta.json'),
  getContracts: () => fetchJson<ContractsData>('contracts.json'),
  getPairs: () => fetchJson<PairSummary[]>('pairs.json'),
  getPairSeries: (pairId: string) => fetchJson<PairSeriesPoint[]>(`pairs/${pairId}.json`),
  getSignalsToday: () => fetchJson<SignalsToday>('signals_today.json'),
  getSignalsHistory: () => fetchJson<SignalHistoryItem[]>('signals_history.json'),
  getBacktest: (pairId: string, slipBps: number) => fetchJson<BacktestData>(`backtest/${pairId}_${slipBps}.json`),
  getCostMatrix: () => fetchJson<CostMatrixItem[]>('backtest/cost_matrix.json'),
  getGrid: () => fetchJson<GridItem[]>('backtest/grid.json'),
  getMethodology: () => fetchJson<MethodologyData>('methodology.json'),
  getCurve: () => fetchJson<CurveData>('curve.json'),
  getCarryDecomposition: (symbol: string) => fetchJson<DecompositionRecord[]>(`carry_decomposition/${symbol}.json`),
  getRegimes: () => fetchJson<RegimeRecord[]>('regimes.json'),
  getRetrievalLog: () => fetchJson<RetrievalLogItem[]>('retrieval_log.json'),
};
