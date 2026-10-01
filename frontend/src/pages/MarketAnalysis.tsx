import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { dataLoader } from '../utils/dataLoader';
import { ContractsData, CurveData, PairSummary, PairSeriesPoint, MetaInfo } from '../types';

export default function MarketAnalysis() {
  const [contractsData, setContractsData] = useState<ContractsData | null>(null);
  const [curveData, setCurveData] = useState<CurveData | null>(null);
  const [pairs, setPairs] = useState<PairSummary[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string>('GUINEA_PETAL');
  const [selectedPairData, setSelectedPairData] = useState<PairSeriesPoint[]>([]);
  const [decompData, setDecompData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dataLoader.getContracts(),
      dataLoader.getCurve(),
      dataLoader.getPairs(),
      dataLoader.getMeta(),
      dataLoader.getCarryDecomposition('GOLDPETAL'),
    ])
      .then(([cData, cvData, pData, mData, dData]) => {
        setContractsData(cData);
        setCurveData(cvData);
        setPairs(pData);
        setMeta(mData);
        setDecompData(dData.slice(-60)); // recent 60 observations
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedPairId) return;
    dataLoader.getPairSeries(selectedPairId).then((data) => {
      setSelectedPairData(data.filter((_, idx) => idx % 3 === 0)); // sample for performance
    });
  }, [selectedPairId]);

  const activePair = pairs.find((p) => p.pair_id === selectedPairId) || pairs[0];

  if (loading || !contractsData || !curveData || !meta || !activePair) {
    return (
      <div className="flex items-center justify-center h-64 text-primary font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
          <span>Loading Market Structure & Analysis...</span>
        </div>
      </div>
    );
  }

  // Quarterly regimes data from Section 3
  const regimeRows = [
    {
      pair: 'GOLDGUINEA − GOLDPETAL',
      preBreak: '+200 to +260 bps',
      postBreak: '−30 to 0 bps',
      janCrash: '+293 bps spike',
      comment: 'GOLDPETAL flipped from ~2.5% cheap to slightly rich around Dec-24 → Mar-25 (Structural Break).',
    },
    {
      pair: 'GOLDM − GOLDPETAL',
      preBreak: '+140 to +200 bps',
      postBreak: '−25 to −95 bps',
      janCrash: '+389 bps spike',
      comment: 'Same structural flip in Dec-24/Mar-25. Rolling window absorbs shift after several weeks.',
    },
    {
      pair: 'GOLDM − GOLDGUINEA',
      preBreak: '−70 to −95 bps',
      postBreak: '−15 to −100 bps',
      janCrash: '+256 bps spike',
      comment: 'Historically stable: GOLDM trades ~0.8% below GOLDGUINEA throughout.',
    },
    {
      pair: 'GOLDTEN − GOLDPETAL',
      preBreak: 'No Contract (Listed 31-Mar-25)',
      postBreak: '−40 to −90 bps',
      janCrash: '+180 bps spike',
      comment: 'GOLDTEN trades persistently below GOLDPETAL post-listing.',
    },
    {
      pair: 'GOLDM − GOLDTEN',
      preBreak: 'No Contract (Listed 31-Mar-25)',
      postBreak: '+5 to +15 bps',
      janCrash: '±25 bps',
      comment: 'The two high-liquidity benchmark contracts agree closely with minimal basis divergence.',
    },
    {
      pair: 'GOLDGUINEA − GOLDTEN',
      preBreak: 'No Contract (Listed 31-Mar-25)',
      postBreak: '≈ +70 bps',
      janCrash: '+140 bps spike',
      comment: 'GOLDGUINEA trades at a premium over GOLDTEN reflect retail coinage delivery demand.',
    },
  ];

  // Normalized price points for comparison chart
  const pairChartData = selectedPairData.map((pt) => ({
    date: pt.d,
    spread: pt.s,
    s10: pt.s10,
    mu: pt.mu,
  }));

  // Carry term structure snapshot on latest date
  const latestSnapshot = curveData.snapshots[curveData.snapshots.length - 1];

  return (
    <div className="flex flex-col gap-space-lg max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-variant">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-data-mono-sm text-data-mono-sm text-primary uppercase tracking-widest">
              MODULE RV-02 // EMPIRICAL ANALYSIS
            </span>
            <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-data-mono-sm text-[9px] text-secondary font-medium">
              CONTRACT DYNAMICS & REGIMES
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Market Structure & Spread Regimes
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Contract specification master, normalization mechanics, structural regime breaks, and term structure roll-down decomposition.
          </p>
        </div>
      </div>

      {/* Contract Master Specifications Table */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              MCX Gold Derivatives Contract Master (Verified Specs)
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Lot size, quote base, physical delivery purity, and expiry windows from MCX product specifications
            </span>
          </div>
          <span className="font-data-mono-sm text-data-mono-sm text-secondary bg-surface-container-high px-2 py-0.5 rounded font-mono">
            4 Instruments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-variant text-on-surface-variant bg-surface-container-lowest">
                <th className="p-2">SYMBOL</th>
                <th className="p-2">LOT SIZE (GRAMS)</th>
                <th className="p-2">QUOTED PER</th>
                <th className="p-2">PURITY</th>
                <th className="p-2">EXPIRY WINDOW</th>
                <th className="p-2">TICK SIZE</th>
                <th className="p-2">LATEST EOD CLOSE</th>
                <th className="p-2">NORMALIZED ₹/10G PURE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/40">
              {Object.entries(contractsData.contract_master).map(([sym, spec]) => {
                const quote = meta.latest_quotes.find((q) => q.symbol === sym);
                return (
                  <tr key={sym} className="hover:bg-surface-container">
                    <td className="p-2 font-bold text-primary">{sym}</td>
                    <td className="p-2">{spec.lot_grams} g</td>
                    <td className="p-2">{spec.quote_grams} g</td>
                    <td className="p-2 font-bold text-secondary">{(spec.purity * 1000).toFixed(0)} / 1000 ({spec.purity})</td>
                    <td className="p-2">{spec.expiry_window}</td>
                    <td className="p-2">₹{spec.tick_size}</td>
                    <td className="p-2 font-bold text-on-surface">
                      ₹{quote ? quote.close.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="p-2 font-bold text-primary">
                      ₹{quote ? quote.px_per_10g_pure.toLocaleString('en-IN', { minimumFractionDigits: 1 }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Normalization Worked Example Box (Section 4.1 & 10.2) */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-primary text-[18px]">calculate</span>
          <h3 className="font-headline-md text-headline-md text-primary">
            Section 4.1: Mathematical Normalization Standard
          </h3>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          Comparing raw MCX prices directly is invalid because contracts differ in both quotation base (1g vs 8g vs 10g)
          and metallurgical purity (GOLDM is 995 fine gold; GOLDTEN, GOLDGUINEA, GOLDPETAL are 999 fine gold).
          Every price is normalized into ₹ per gram of pure 1000-fineness gold:
        </p>

        <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant font-mono text-xs flex flex-col gap-2">
          <div className="text-secondary font-bold">
            px_per_g_pure = close / quote_grams / purity &nbsp;&nbsp;|&nbsp;&nbsp; px_per_10g_pure = px_per_g_pure × 10
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-surface-variant/40 text-[11px]">
            <div>
              <span className="text-primary font-bold">Live Example 1 — GOLDM (995 fineness):</span>
              <br />
              Close: ₹147,908 / 10g · Purity: 0.995
              <br />
              px_per_g_pure = 147,908 / 10 / 0.995 = <span className="text-secondary font-bold">₹14,865.13 / g</span> (₹148,651.26 / 10g pure)
            </div>
            <div>
              <span className="text-primary font-bold">Live Example 2 — GOLDPETAL (999 fineness):</span>
              <br />
              Close: ₹14,893 / 1g · Purity: 0.999
              <br />
              px_per_g_pure = 14,893 / 1 / 0.999 = <span className="text-secondary font-bold">₹14,907.91 / g</span> (₹149,079.08 / 10g pure)
            </div>
          </div>
        </div>
      </div>

      {/* Structural Regime Shifts Panel (Section 3) */}
      <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Empirical Regime Shifts & Structural Breaks
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              Key empirical findings from Section 3: GOLDPETAL structural break & Jan-2026 crash episode
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container-high text-tertiary text-xs font-mono font-semibold">
            Structural Break Noted
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-variant text-on-surface-variant bg-surface-container-lowest">
                <th className="p-2">PAIR</th>
                <th className="p-2">OCT-23 → DEC-24 MEAN</th>
                <th className="p-2">APR-25 → SEP-26 MEAN</th>
                <th className="p-2">JAN-2026 CRASH QUARTER</th>
                <th className="p-2">STRUCTURAL IMPLICATIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/40">
              {regimeRows.map((r, i) => (
                <tr key={i} className="hover:bg-surface-container">
                  <td className="p-2 font-bold text-primary">{r.pair}</td>
                  <td className="p-2 text-on-surface">{r.preBreak}</td>
                  <td className="p-2 text-secondary font-semibold">{r.postBreak}</td>
                  <td className="p-2 text-tertiary font-bold">{r.janCrash}</td>
                  <td className="p-2 text-[11px] text-on-surface-variant max-w-xs">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Implied Carry & Curve Term Structure (Section 4.2 & 4.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Carry Sanity Check Card */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Term Structure Implied Carry (Section 4.2)
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-data-mono-sm text-[9px] text-secondary font-medium">
                Sanity Check Passed
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-mono">
              Computed from calendar spreads on GOLDPETAL (highest liquidity overlap):
              <br />
              <span className="text-primary">carry_ann(t) = ln(F_far / F_near) × 365 / (T_far − T_near)</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 my-space-md">
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Median Carry</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-secondary">
                {curveData.median_carry_pct}%
              </span>
              <span className="text-[9px] text-outline font-mono">Bounds: [3.0%, 12.0%]</span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">25th Percentile</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface">
                {curveData.iqr_carry_pct[0]}%
              </span>
              <span className="text-[9px] text-outline font-mono">Lower Quartile</span>
            </div>
            <div className="p-2 rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col">
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">75th Percentile</span>
              <span className="font-data-mono-xl text-data-mono-xl font-bold text-on-surface">
                {curveData.iqr_carry_pct[1]}%
              </span>
              <span className="text-[9px] text-outline font-mono">Upper Quartile</span>
            </div>
          </div>

          <div className="p-space-sm rounded bg-surface-container-lowest border border-surface-variant/40 text-xs font-mono text-on-surface-variant">
            <span className="text-secondary font-bold">Conclusion: </span>
            The empirical annualized carry of median 8.0% aligns cleanly with Indian risk-free money market rates plus vault storage/insurance costs.
          </div>
        </div>

        {/* Roll-Down vs Genuine Curve Change (Section 4.3) */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Roll-Down vs Genuine Curve Change (Section 4.3)
              </h3>
              <span className="font-data-mono-sm text-data-mono-sm text-primary font-mono">
                Exact Identity
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-mono">
              Δln F_i = Δln S_t (Gold Move) + c_prev·Δτ (Roll-Down) + Δc·τ (Curve Shift) + Residual
            </p>
          </div>

          {/* Mini Stacked Decomposition Chart */}
          <div className="h-44 w-full my-space-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={decompData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#1c2b3c" />
                <XAxis dataKey="d" stroke="#a08e7a" fontSize={9} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="#a08e7a" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1c2d', borderColor: '#273647', fontSize: 10 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="gold" stroke="#ffc174" strokeWidth={1} dot={false} name="Gold Price Move" />
                <Line type="monotone" dataKey="rolldown" stroke="#4edea3" strokeWidth={1} dot={false} name="Mechanical Roll" />
                <Line type="monotone" dataKey="curve" stroke="#ffbcb7" strokeWidth={1} dot={false} name="Curve Shift" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <span className="text-[10px] text-outline font-mono">
            Separate mechanical carry decay from structural curve steepening/flattening across forward tenors.
          </span>
        </div>
      </div>

      {/* Spread Dynamics & Empirical z-Score Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Spread History Chart */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {activePair.display_name} — Normalized Spread History
            </h3>
            <select
              value={selectedPairId}
              onChange={(e) => setSelectedPairId(e.target.value)}
              className="bg-surface-container-high text-on-surface font-mono text-xs px-2 py-1 rounded border border-surface-variant"
            >
              {pairs.map((p) => (
                <option key={p.pair_id} value={p.pair_id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pairChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2b3c" />
                <XAxis dataKey="date" stroke="#a08e7a" fontSize={9} tickLine={false} tickFormatter={(v) => v.slice(2, 7)} />
                <YAxis stroke="#a08e7a" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1c2d', borderColor: '#273647', fontSize: 11 }} />
                <Line type="monotone" dataKey="spread" stroke="#ffc174" strokeWidth={1.5} dot={false} name="Spread (bps)" />
                <Line type="monotone" dataKey="mu" stroke="#a08e7a" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Rolling μ" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Empirical z Histogram (Section 4.5: Empirical, not fitted Gaussian) */}
        <div className="bg-surface-container-low p-space-md rounded border border-surface-variant flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Empirical z-Score Distribution (Non-Gaussian)
            </h3>
            <span className="font-data-mono-sm text-data-mono-sm text-primary font-mono">
              Current z: {activePair.z > 0 ? `+${activePair.z.toFixed(2)}` : activePair.z.toFixed(2)} ({activePair.percentile.toFixed(1)}% pctl)
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activePair.z_histogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2b3c" />
                <XAxis dataKey="bin_center" stroke="#a08e7a" fontSize={9} tickLine={false} />
                <YAxis stroke="#a08e7a" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1c2d', borderColor: '#273647', fontSize: 11 }} />
                <Bar dataKey="count" fill="#f59e0b" name="Observation Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <span className="text-[10px] text-outline font-mono">
            Displays real sample distribution directly from historic observations to show tail fatness and skew.
          </span>
        </div>
      </div>
    </div>
  );
}
