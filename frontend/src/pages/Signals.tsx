import React, { useEffect, useState } from 'react';
import { dataLoader } from '../utils/dataLoader';
import { PairSummary, SignalsToday, SignalHistoryItem } from '../types';

export default function Signals() {
  const [pairs, setPairs] = useState<PairSummary[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string>('M_TEN');
  const [signalsToday, setSignalsToday] = useState<SignalsToday | null>(null);
  const [signalsHistory, setSignalsHistory] = useState<SignalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dataLoader.getPairs(),
      dataLoader.getSignalsToday(),
      dataLoader.getSignalsHistory(),
    ])
      .then(([pData, sData, hData]) => {
        setPairs(pData);
        setSignalsToday(sData);
        setSignalsHistory(hData);
        if (pData.length > 0) {
          const sorted = [...pData].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
          setSelectedPairId(sorted[0].pair_id);
        }
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const activePair = pairs.find((p) => p.pair_id === selectedPairId) || pairs[0];

  if (loading || !activePair || !signalsToday) {
    return (
      <div className="flex items-center justify-center h-64 text-primary font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
          <span>Loading Signal Analytics & Gate Engine...</span>
        </div>
      </div>
    );
  }

  const rtCostBps = signalsToday.round_trip_cost_bps; // 24.4
  const grossEdgeBps = Math.abs(activePair.spread_bps - activePair.mu);
  const netEdgeBps = grossEdgeBps - rtCostBps;
  const edgeCostRatio = (grossEdgeBps / rtCostBps).toFixed(2);

  // Filter history for active pair
  const pairHistory = signalsHistory.filter((h) => h.pair === activePair.pair_id);

  return (
    <div className="flex flex-col gap-space-lg max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-variant">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-data-mono-sm text-data-mono-sm text-primary uppercase tracking-widest">
              MODULE RV-03 // SIGNAL ENGINE
            </span>
            <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-data-mono-sm text-[9px] text-secondary font-medium">
              FIVE-GATE POINT-IN-TIME FILTER
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Signal Intelligence & Gate Verification
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            "Quiet is a feature." Signals appear only when all 5 statistical, edge, liquidity, and lifecycle gates pass simultaneously.
          </p>
        </div>

        {/* Pair Status Pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-on-surface-variant uppercase">Pair Status:</span>
          <span className={`px-3 py-1 rounded font-mono font-bold text-xs uppercase ${
            activePair.status === 'SIGNAL' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-outline'
          }`}>
            {activePair.status}
          </span>
        </div>
      </div>

      {/* Pair Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-surface-container-lowest rounded border border-surface-variant">
        <span className="text-label-xs font-mono uppercase text-on-surface-variant px-2">Select Pair:</span>
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

      {/* Edge Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Gross Deviation Edge</span>
          <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface mt-1">
            {grossEdgeBps.toFixed(1)} bps
          </span>
          <span className="text-[10px] text-outline font-mono mt-1">
            |Spread ({activePair.spread_bps.toFixed(1)}) − μ ({activePair.mu.toFixed(1)})|
          </span>
        </div>

        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Round-Trip Total Cost</span>
          <span className="font-data-mono-xl text-data-mono-xl font-bold text-tertiary mt-1">
            {rtCostBps.toFixed(1)} bps
          </span>
          <span className="text-[10px] text-outline font-mono mt-1">
            Statutory Taxes + 5 bps Slippage
          </span>
        </div>

        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Net Theoretical Edge</span>
          <span className={`font-data-mono-xl text-data-mono-xl font-bold mt-1 ${netEdgeBps >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
            {netEdgeBps >= 0 ? `+${netEdgeBps.toFixed(1)}` : netEdgeBps.toFixed(1)} bps
          </span>
          <span className="text-[10px] text-outline font-mono mt-1">
            Gross Edge − 1× Round-Trip Cost
          </span>
        </div>

        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col">
          <span className="text-[10px] font-mono uppercase text-on-surface-variant">Edge / Cost Ratio</span>
          <span className={`font-data-mono-xl text-data-mono-xl font-bold mt-1 ${parseFloat(edgeCostRatio) >= 2.0 ? 'text-secondary' : 'text-primary'}`}>
            {edgeCostRatio}×
          </span>
          <span className="text-[10px] text-outline font-mono mt-1">
            Gate 3 requires ≥ 2.00× (Hurdle: {(rtCostBps * 2).toFixed(1)} bps)
          </span>
        </div>
      </div>

      {/* Main Signal Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Pipeline Progression / Gate Checklist */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div className="pb-space-sm border-b border-surface-variant flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Gate Checklist (Section 6)
            </h3>
            <span className="font-data-mono-sm text-data-mono-sm text-primary font-mono">
              All 5 Must Pass
            </span>
          </div>

          <div className="flex flex-col divide-y divide-surface-variant/40 my-space-sm">
            <div className="py-2.5 flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">1. Sufficient Sample History</span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  ≥ {activePair.chosen_params.W} prior trading observations in current window
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activePair.gates.enough_history ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
              }`}>
                {activePair.gates.enough_history ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="py-2.5 flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">2. Statistical Extremity</span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  |z| = {Math.abs(activePair.z).toFixed(2)} ≥ {activePair.chosen_params.ze} threshold
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activePair.gates.extreme ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
              }`}>
                {activePair.gates.extreme ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="py-2.5 flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">3. Edge Beats 2× Round-Trip Cost</span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  Deviation {grossEdgeBps.toFixed(1)} bps ≥ 2× RT cost ({(rtCostBps * 2).toFixed(1)} bps)
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activePair.gates.edge_beats_cost ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
              }`}>
                {activePair.gates.edge_beats_cost ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="py-2.5 flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">4. Liquidity & Non-Thin Depth</span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  Both legs Volume ≥ 25 lots & OI ≥ 50 lots
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activePair.gates.liquidity ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
              }`}>
                {activePair.gates.liquidity ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="py-2.5 flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-bold text-xs text-on-surface">5. Lifecycle & Roll Window</span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  Both legs ≥ 7 TD to expiry & not a contract roll day
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activePair.gates.lifecycle ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
              }`}>
                {activePair.gates.lifecycle ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>

          <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant text-xs font-mono">
            Status: <span className="text-primary font-bold">{activePair.status}</span>.
            {activePair.failed_gates.length > 0 && (
              <span className="text-tertiary ml-1">
                Failed gates: {activePair.failed_gates.join(', ')}.
              </span>
            )}
          </div>
        </div>

        {/* Liquidity Check Table (Replaces Order-Book Depth per Section 10.2) */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div className="pb-space-sm border-b border-surface-variant flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Liquidity Check (EOD Settlement Basis)
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Verified from MCX Bhavcopy
            </span>
          </div>

          <div className="overflow-x-auto my-space-sm">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-surface-variant text-on-surface-variant bg-surface-container-lowest">
                  <th className="p-2">METRIC</th>
                  <th className="p-2">{activePair.symbol_a} (LEG A)</th>
                  <th className="p-2">{activePair.symbol_b} (LEG B)</th>
                  <th className="p-2">CRITERIA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/40">
                <tr>
                  <td className="p-2 text-on-surface-variant">Active Expiry</td>
                  <td className="p-2 font-bold text-primary">{activePair.expiry_a}</td>
                  <td className="p-2 font-bold text-primary">{activePair.expiry_b}</td>
                  <td className="p-2 text-secondary">Aligned Tenors</td>
                </tr>
                <tr>
                  <td className="p-2 text-on-surface-variant">Trading Days to Expiry</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.td_to_exp_a} TD</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.td_to_exp_b} TD</td>
                  <td className="p-2 text-secondary">≥ 7 TD Required</td>
                </tr>
                <tr>
                  <td className="p-2 text-on-surface-variant">Traded Volume (Lots)</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.vol_a.toLocaleString()}</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.vol_b.toLocaleString()}</td>
                  <td className="p-2 text-secondary">≥ 25 Lots</td>
                </tr>
                <tr>
                  <td className="p-2 text-on-surface-variant">Open Interest (Lots)</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.oi_a.toLocaleString()}</td>
                  <td className="p-2 font-bold text-on-surface">{activePair.oi_b.toLocaleString()}</td>
                  <td className="p-2 text-secondary">≥ 50 Lots</td>
                </tr>
                <tr>
                  <td className="p-2 text-on-surface-variant">Thin Flag Triggered</td>
                  <td className="p-2 text-secondary">No</td>
                  <td className="p-2 text-secondary">No</td>
                  <td className="p-2 text-secondary">Slippage 1× (Normal)</td>
                </tr>
                <tr>
                  <td className="p-2 text-on-surface-variant">Contract Roll Day</td>
                  <td colSpan={2} className={`p-2 font-bold ${activePair.roll_flag ? 'text-tertiary' : 'text-secondary'}`}>
                    {activePair.roll_flag ? 'Yes (Choice Changed Today)' : 'No (Continuous Selection)'}
                  </td>
                  <td className="p-2 text-secondary">No-Roll Required</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Historical Similarity Scenario */}
          <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant flex flex-col gap-1 text-xs font-mono">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
              SCENARIO ON HISTORY (EMPIRICAL RESOLUTION OF SIMILAR SIGNALS):
            </span>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-surface-container p-1 rounded">
                <span className="text-secondary font-bold">{activePair.historical_evidence.reverted_count}</span>
                <span className="text-[10px] text-on-surface-variant block">Reverted (|z|≤0.5)</span>
              </div>
              <div className="bg-surface-container p-1 rounded">
                <span className="text-tertiary font-bold">{activePair.historical_evidence.stopped_count}</span>
                <span className="text-[10px] text-on-surface-variant block">Stopped Out</span>
              </div>
              <div className="bg-surface-container p-1 rounded">
                <span className="text-primary font-bold">{activePair.historical_evidence.timed_out_count}</span>
                <span className="text-[10px] text-on-surface-variant block">Timed Out</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Signals Blotter */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Historical Signal Log & Outcomes
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Every past gate-passing signal recorded point-in-time with trade outcome
            </span>
          </div>
          <span className="text-xs font-mono text-primary">
            {pairHistory.length} Recorded Signal{pairHistory.length === 1 ? '' : 's'} for {activePair.display_name}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-variant text-on-surface-variant bg-surface-container-lowest">
                <th className="p-2">SIGNAL DATE</th>
                <th className="p-2">ENTRY FILL (t+1)</th>
                <th className="p-2">EXIT FILL</th>
                <th className="p-2">CONTRACTS</th>
                <th className="p-2 text-right">Z-SCORE</th>
                <th className="p-2">DIRECTION</th>
                <th className="p-2">OUTCOME</th>
                <th className="p-2 text-right">NET BPS</th>
                <th className="p-2 text-right">NET ₹</th>
                <th className="p-2 text-right">HOLDING (TD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/40">
              {pairHistory.length > 0 ? (
                pairHistory.map((h, i) => {
                  const isPos = h.net_bps >= 0;
                  return (
                    <tr key={i} className="hover:bg-surface-container">
                      <td className="p-2 font-bold text-primary">{h.date}</td>
                      <td className="p-2">{h.entry_date}</td>
                      <td className="p-2">{h.exit_date}</td>
                      <td className="p-2 text-[10px]">{h.expA} / {h.expB}</td>
                      <td className="p-2 text-right font-bold">{h.z > 0 ? `+${h.z.toFixed(2)}` : h.z.toFixed(2)}</td>
                      <td className="p-2">{h.direction}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          h.outcome === 'revert' ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest text-tertiary'
                        }`}>
                          {h.outcome}
                        </span>
                      </td>
                      <td className={`p-2 text-right font-bold ${isPos ? 'text-secondary' : 'text-tertiary'}`}>
                        {isPos ? `+${h.net_bps.toFixed(1)}` : h.net_bps.toFixed(1)}
                      </td>
                      <td className={`p-2 text-right font-bold ${h.net_rs >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                        {h.net_rs >= 0 ? `+₹${h.net_rs.toLocaleString()}` : `-₹${Math.abs(h.net_rs).toLocaleString()}`}
                      </td>
                      <td className="p-2 text-right">{h.holding_days} d</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-on-surface-variant">
                    No historical gate-passing signals recorded for this pair.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
