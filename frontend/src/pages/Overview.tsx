import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { dataLoader } from '../utils/dataLoader';
import { PairSummary, PairSeriesPoint, SignalsToday } from '../types';

export default function Overview() {
  const [pairs, setPairs] = useState<PairSummary[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string>('M_TEN');
  const [seriesData, setSeriesData] = useState<PairSeriesPoint[]>([]);
  const [signalsToday, setSignalsToday] = useState<SignalsToday | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dataLoader.getPairs(), dataLoader.getSignalsToday()])
      .then(([pairsData, sigData]) => {
        setPairs(pairsData);
        setSignalsToday(sigData);
        // Find pair with highest |z|
        if (pairsData.length > 0) {
          const sorted = [...pairsData].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
          setSelectedPairId(sorted[0].pair_id);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedPairId) return;
    dataLoader.getPairSeries(selectedPairId).then((data) => {
      // Last 30 observations for divergence chart
      setSeriesData(data.slice(-30));
    });
  }, [selectedPairId]);

  const activePair = pairs.find((p) => p.pair_id === selectedPairId) || pairs[0];

  if (loading || !activePair) {
    return (
      <div className="flex items-center justify-center h-64 text-primary font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
          <span>Loading Point-in-Time RV Overview...</span>
        </div>
      </div>
    );
  }

  // Chart data preparation
  const chartPoints = seriesData.map((pt) => {
    const mu = pt.mu !== null ? pt.mu : pt.s;
    const sd = pt.sd !== null ? pt.sd : 0;
    const ze = activePair.chosen_params.ze;
    return {
      date: pt.d.slice(5),
      spread: pt.s,
      mu: Math.round(mu * 10) / 10,
      upperBand: Math.round((mu + ze * sd) * 10) / 10,
      lowerBand: Math.round((mu - ze * sd) * 10) / 10,
    };
  });

  const rtCostBps = signalsToday?.round_trip_cost_bps || 24.4;
  const hurdleBps = rtCostBps * 2;
  const deviationBps = Math.abs(activePair.spread_bps - activePair.mu);
  const edgeCostRatio = (deviationBps / hurdleBps).toFixed(2);
  const stopLevelZ = (Math.abs(activePair.chosen_params.ze) + 1.5).toFixed(1);

  return (
    <div className="flex flex-col gap-space-lg max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-variant">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-data-mono-sm text-data-mono-sm text-primary uppercase tracking-widest">
              MODULE RV-01 // DESK RESEARCH
            </span>
            <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-data-mono-sm text-[9px] text-secondary font-medium">
              EOD NORMALIZED RV
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Executive Relative-Value Overview
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Normalized cross-contract relative value across MCX Gold futures. All spreads adjust for carry and lot purity.
            Zero look-ahead: signals decided at close t, executed at close t+1.
          </p>
        </div>

        {/* Global Alert Status Badge */}
        <div className="flex items-center gap-space-sm shrink-0">
          <div className="bg-surface-container-low px-space-md py-1.5 rounded border border-surface-variant flex items-center gap-space-md">
            <div className="flex flex-col text-right">
              <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
                Global Alert Gate
              </span>
              <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-semibold">
                {signalsToday?.headline || 'No meaningful signal today'}
              </span>
            </div>
            <div className={`w-3 h-3 rounded-full ${signalsToday?.all_quiet ? 'bg-outline-variant' : 'bg-primary'}`}></div>
          </div>
        </div>
      </div>

      {/* Top 6-Pair Quick Switcher Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-surface-container-lowest rounded border border-surface-variant">
        <span className="text-label-xs font-mono uppercase text-on-surface-variant px-2">Active Pair:</span>
        {pairs.map((p) => {
          const isSelected = p.pair_id === selectedPairId;
          return (
            <button
              key={p.pair_id}
              onClick={() => setSelectedPairId(p.pair_id)}
              className={`px-3 py-1 rounded font-data-mono-sm text-data-mono-sm transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>{p.display_name}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                isSelected ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-primary'
              }`}>
                z {p.z > 0 ? `+${p.z.toFixed(2)}` : p.z.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Q1: What is happening? Live Basis & Cross-Contract Parity */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="font-data-mono-sm text-data-mono-sm text-primary px-1.5 py-0.5 rounded bg-surface-container-high font-semibold">
              Q1
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              What is happening? — Basis & Cross-Contract Parity
            </h2>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
            AS OF 30-SEP-2026 EOD SETTLEMENT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {/* Leg A Card */}
          <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  {activePair.symbol_a}
                </span>
                <span className="font-label-xs text-label-xs px-1.5 py-0.5 rounded bg-surface-container-highest text-primary font-semibold font-mono">
                  Leg A · {activePair.lot_ratio.split(':')[0].trim()} Lot
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                Expiry: {activePair.expiry_a} ({activePair.td_to_exp_a} TD left)
              </span>
            </div>

            <div className="mt-space-md pt-space-sm bg-surface-container-lowest p-space-sm rounded border border-surface-variant/50 flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
                  MCX EOD Close
                </span>
                <span className="font-data-mono-lg text-data-mono-lg text-on-surface font-semibold">
                  ₹{seriesData[seriesData.length - 1]?.s !== undefined ? 'Quoted EOD' : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-surface-variant/30">
                <span className="font-label-xs text-label-xs text-primary font-medium uppercase">
                  Normalized Pure Basis
                </span>
                <span className="font-data-mono-md text-data-mono-md text-primary font-bold">
                  ₹/10g pure standard
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                <span>Traded Volume: {activePair.vol_a.toLocaleString()} lots</span>
                <span>OI: {activePair.oi_a.toLocaleString()} lots</span>
              </div>
            </div>
          </div>

          {/* Leg B Card */}
          <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  {activePair.symbol_b}
                </span>
                <span className="font-label-xs text-label-xs px-1.5 py-0.5 rounded bg-surface-container-highest text-primary font-semibold font-mono">
                  Leg B · {activePair.lot_ratio.split(':')[1]?.trim() || '1'} Lots
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">
                Expiry: {activePair.expiry_b} ({activePair.td_to_exp_b} TD left)
              </span>
            </div>

            <div className="mt-space-md pt-space-sm bg-surface-container-lowest p-space-sm rounded border border-surface-variant/50 flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
                  MCX EOD Close
                </span>
                <span className="font-data-mono-lg text-data-mono-lg text-on-surface font-semibold">
                  Settlement
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-surface-variant/30">
                <span className="font-label-xs text-label-xs text-primary font-medium uppercase">
                  Normalized Pure Basis
                </span>
                <span className="font-data-mono-md text-data-mono-md text-primary font-bold">
                  ₹/10g pure standard
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                <span>Traded Volume: {activePair.vol_b.toLocaleString()} lots</span>
                <span>OI: {activePair.oi_b.toLocaleString()} lots</span>
              </div>
            </div>
          </div>

          {/* Spread & Carry Card */}
          <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-headline-md text-headline-md text-primary font-bold">
                  CARRY-ADJUSTED SPREAD
                </span>
                <span className="font-label-xs text-label-xs px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
                  {activePair.contracts_label}
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Rolling {activePair.chosen_params.W}-day point-in-time benchmark
              </span>
            </div>

            <div className="mt-space-md pt-space-sm bg-surface-container-lowest p-space-sm rounded border border-surface-variant/50 flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
                  Spread (bps)
                </span>
                <span className={`font-data-mono-lg text-data-mono-lg font-bold ${
                  activePair.spread_bps >= 0 ? 'text-secondary' : 'text-tertiary'
                }`}>
                  {activePair.spread_bps > 0 ? `+${activePair.spread_bps.toFixed(1)}` : activePair.spread_bps.toFixed(1)} bps
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-surface-variant/30">
                <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
                  Rolling Mean / Std
                </span>
                <span className="font-data-mono-md text-data-mono-md text-on-surface font-mono">
                  μ: {activePair.mu.toFixed(1)} bps · σ: {activePair.sd.toFixed(1)} bps
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-surface-variant/30">
                <span className="font-label-xs text-label-xs text-primary font-medium uppercase">
                  Spread in ₹ / 10g
                </span>
                <span className="font-data-mono-md text-data-mono-md text-primary font-bold">
                  {activePair.spread_rs_10g >= 0 ? `+₹${activePair.spread_rs_10g.toFixed(1)}` : `-₹${Math.abs(activePair.spread_rs_10g).toFixed(1)}`} / 10g
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Q2: Is the relationship unusual? (z-score & Gate Checklist) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-variant">
            <div className="flex items-center gap-space-xs">
              <span className="font-data-mono-sm text-data-mono-sm text-primary px-1.5 py-0.5 rounded bg-surface-container-high font-semibold">
                Q2
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Is the relationship unusual? (Statistical Divergence)
              </h3>
            </div>
            <div className={`px-2 py-0.5 rounded font-data-mono-sm text-data-mono-sm font-semibold uppercase ${
              activePair.status === 'SIGNAL' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              {activePair.status}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-space-md">
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Point-in-Time z</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-primary">
                {activePair.z > 0 ? `+${activePair.z.toFixed(2)}` : activePair.z.toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Hurdle Required</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface">
                ±{activePair.z_needed.toFixed(1)} σ
              </span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Deviation</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-secondary">
                {deviationBps.toFixed(1)} bps
              </span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Sample Percentile</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface">
                {activePair.percentile.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 5-Gate Checklist */}
          <div className="flex flex-col gap-1.5 p-space-sm rounded bg-surface-container-lowest border border-surface-variant/40 text-body-sm">
            <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-wider">
              SECTION 6 FIVE-GATE FILTER ENGINE:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className={activePair.gates.enough_history ? 'text-secondary' : 'text-tertiary'}>
                  {activePair.gates.enough_history ? '✓' : '✗'}
                </span>
                <span>1. History: ≥ {activePair.chosen_params.W} obs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={activePair.gates.extreme ? 'text-secondary' : 'text-tertiary'}>
                  {activePair.gates.extreme ? '✓' : '✗'}
                </span>
                <span>2. Extreme: |z| ≥ {activePair.chosen_params.ze} ({Math.abs(activePair.z).toFixed(2)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={activePair.gates.edge_beats_cost ? 'text-secondary' : 'text-tertiary'}>
                  {activePair.gates.edge_beats_cost ? '✓' : '✗'}
                </span>
                <span>3. Edge: {deviationBps.toFixed(1)} ≥ 2×RT {hurdleBps.toFixed(1)} bps</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={activePair.gates.liquidity ? 'text-secondary' : 'text-tertiary'}>
                  {activePair.gates.liquidity ? '✓' : '✗'}
                </span>
                <span>4. Liquidity: Vol≥25 & OI≥50</span>
              </div>
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <span className={activePair.gates.lifecycle ? 'text-secondary' : 'text-tertiary'}>
                  {activePair.gates.lifecycle ? '✓' : '✗'}
                </span>
                <span>5. Lifecycle: ≥7 TD to expiry & not roll day ({activePair.roll_flag ? 'Roll Flag True' : 'Clean'})</span>
              </div>
            </div>
            {activePair.status === 'QUIET' && (
              <div className="mt-1 pt-1 border-t border-surface-variant/30 text-[11px] text-tertiary font-mono">
                Quiet reason: {activePair.failed_gates.map(f => f.toUpperCase()).join(', ')} gate(s) did not pass.
              </div>
            )}
          </div>
        </div>

        {/* Q3: What historical evidence exists? */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-variant">
            <div className="flex items-center gap-space-xs">
              <span className="font-data-mono-sm text-data-mono-sm text-primary px-1.5 py-0.5 rounded bg-surface-container-high font-semibold">
                Q3
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface">
                What historical evidence exists? (Empirical Reversion)
              </h3>
            </div>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Base Scenario (5 bps slip)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 my-space-md">
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Past Signals</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface">
                {activePair.historical_evidence.past_signals_count}
              </span>
              <span className="text-[9px] text-outline font-mono">In-Sample & Test</span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Reverted to |z|≤0.5</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-secondary">
                {activePair.historical_evidence.reverted_count}
              </span>
              <span className="text-[9px] text-secondary font-mono">
                {activePair.historical_evidence.revert_rate_pct}% Reversion Rate
              </span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Median Hold</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-primary">
                {activePair.historical_evidence.median_days_to_revert} TD
              </span>
              <span className="text-[9px] text-outline font-mono">Trading Days (not hours)</span>
            </div>
          </div>

          {/* Q4 Costs & Execution Risk Summary */}
          <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col gap-1 text-body-sm font-mono">
            <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
              Q4: TRANSACTION COSTS & REALISTIC EDGE
            </span>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-on-surface-variant">Round-Trip Cost (Leg A + B @ 5 bps slip):</span>
              <span className="font-bold text-tertiary">~{rtCostBps.toFixed(1)} bps</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Minimum Required Deviation (2× Cost):</span>
              <span className="font-bold text-on-surface">{hurdleBps.toFixed(1)} bps</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Actual Current Deviation / Hurdle:</span>
              <span className={`font-bold ${parseFloat(edgeCostRatio) >= 1.0 ? 'text-secondary' : 'text-tertiary'}`}>
                {deviationBps.toFixed(1)} bps ({edgeCostRatio}× hurdle)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pb-1 border-b border-surface-variant/30">
              <span className="text-on-surface-variant">Model Stop Level:</span>
              <span className="font-bold text-tertiary">|z| ≥ {stopLevelZ}</span>
            </div>
            <span className="text-[10px] text-outline italic">
              Execution Rule: Signal generated at close t fills at close t+1 of the identical contract.
            </span>
          </div>
        </div>
      </div>

      {/* Divergence Chart (Last 30 observations with bands) */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {activePair.display_name} — 30-Day Spread Divergence & Bands
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Spread (bps) vs Rolling Mean (μ) and Entry Bands (μ ± {activePair.chosen_params.ze}·σ)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-2.5 h-0.5 bg-primary inline-block"></span> Spread bps
            </span>
            <span className="flex items-center gap-1 text-on-surface-variant">
              <span className="w-2.5 h-0.5 bg-outline inline-block"></span> Mean (μ)
            </span>
            <span className="flex items-center gap-1 text-tertiary">
              <span className="w-2.5 h-0.5 border-t border-dashed border-tertiary inline-block"></span> Bands (±ze·σ)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2b3c" />
              <XAxis dataKey="date" stroke="#a08e7a" fontSize={10} tickLine={false} />
              <YAxis stroke="#a08e7a" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d1c2d', borderColor: '#273647', color: '#d4e4fa', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="spread" stroke="#ffc174" strokeWidth={2} dot={{ r: 2 }} name="Spread (bps)" />
              <Line type="monotone" dataKey="mu" stroke="#a08e7a" strokeWidth={1} strokeDasharray="2 2" dot={false} name="Mean" />
              <Line type="monotone" dataKey="upperBand" stroke="#ffbcb7" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Upper Band" />
              <Line type="monotone" dataKey="lowerBand" stroke="#ffbcb7" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Lower Band" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scanner Matrix (All 6 pairs) */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Universe Cross-Contract Scanner Matrix
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Live status across all 6 cointegrated pairs · Click row to inspect
            </span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-primary font-mono">
            6 Pairs Precomputed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-variant text-on-surface-variant bg-surface-container-lowest">
                <th className="p-2">PAIR</th>
                <th className="p-2">ACTIVE CONTRACTS</th>
                <th className="p-2 text-right">SPREAD (BPS)</th>
                <th className="p-2 text-right">ROLLING μ</th>
                <th className="p-2 text-right">Z / NEEDED</th>
                <th className="p-2 text-right">LEG A VOL / OI</th>
                <th className="p-2 text-right">LEG B VOL / OI</th>
                <th className="p-2">STATUS</th>
                <th className="p-2">FAILED GATES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/40">
              {pairs.map((p) => {
                const isSelected = p.pair_id === selectedPairId;
                return (
                  <tr
                    key={p.pair_id}
                    onClick={() => setSelectedPairId(p.pair_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-container/20 text-on-surface font-semibold'
                        : 'hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <td className="p-2 font-bold text-primary">{p.display_name}</td>
                    <td className="p-2">{p.contracts_label}</td>
                    <td className={`p-2 text-right font-bold ${p.spread_bps >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                      {p.spread_bps > 0 ? `+${p.spread_bps.toFixed(1)}` : p.spread_bps.toFixed(1)}
                    </td>
                    <td className="p-2 text-right">{p.mu.toFixed(1)}</td>
                    <td className="p-2 text-right">
                      {p.z > 0 ? `+${p.z.toFixed(2)}` : p.z.toFixed(2)} / {p.z_needed.toFixed(1)}
                    </td>
                    <td className="p-2 text-right text-[10px]">
                      {p.vol_a.toLocaleString()} / {p.oi_a.toLocaleString()}
                    </td>
                    <td className="p-2 text-right text-[10px]">
                      {p.vol_b.toLocaleString()} / {p.oi_b.toLocaleString()}
                    </td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        p.status === 'SIGNAL' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-outline'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-2 text-[10px] text-tertiary">
                      {p.failed_gates.length > 0 ? p.failed_gates.join(', ') : 'None (All Pass)'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Regulatory & Model Disclaimer */}
      <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant/40 text-[11px] text-on-surface-variant/80 font-mono">
        <span className="text-primary font-bold">DISCLAIMER & RESEARCH NOTE: </span>
        All relative-value metrics are generated strictly from MCX official settlement Bhavcopy EOD data.
        The default state of this platform is Quiet. Signals execute one day after publication (t+1) to prevent look-ahead bias.
        Past statistical reversion does not guarantee future profitability after exchange turnover, taxes, and liquidity slippage.
      </div>
    </div>
  );
}
