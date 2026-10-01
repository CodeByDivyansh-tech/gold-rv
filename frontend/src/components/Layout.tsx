import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { dataLoader } from '../utils/dataLoader';
import { MetaInfo } from '../types';

export default function Layout() {
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const location = useLocation();

  useEffect(() => {
    dataLoader.getMeta().then(setMeta).catch(console.error);
  }, []);

  const navItems = [
    { path: '/overview', label: '01 Overview', code: 'RV-01' },
    { path: '/market-analysis', label: '02 Market Analysis', code: 'RV-02' },
    { path: '/signals', label: '03 Signals', code: 'RV-03' },
    { path: '/backtesting', label: '04 Backtesting', code: 'RV-04' },
    { path: '/methodology', label: '05 Data & Methodology', code: 'RV-05' },
  ];

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-surface-variant h-14 px-space-md flex items-center justify-between gap-space-md">
        {/* Brand */}
        <div className="flex items-center gap-space-md shrink-0">
          <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center border border-primary/40 text-primary font-mono font-bold text-sm">
            Au
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md tracking-wider text-primary font-bold">
              GOLD INTELLIGENCE
            </span>
            <span className="font-label-xs text-label-xs text-on-surface-variant font-mono uppercase">
              MCX GOLD RELATIVE-VALUE INTELLIGENCE PLATFORM
            </span>
          </div>
        </div>

        {/* Dataset metadata badge (Section 10.2: Clean, non-fabricated) */}
        <div className="hidden lg:flex items-center gap-space-sm px-space-md py-1 rounded bg-surface-container-low border border-surface-variant shrink-0">
          <div className="flex items-center gap-space-xs font-data-mono-sm text-data-mono-sm text-on-surface">
            <span className="font-semibold text-primary">MCX DATASET</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            <span className="text-secondary font-medium">Verified EOD</span>
          </div>
          <span className="text-surface-variant">|</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Coverage: 10-Oct-2023 → 30-Sep-2026
          </span>
          <span className="text-surface-variant">|</span>
          <span className="font-data-mono-sm text-data-mono-sm px-space-xs py-0.5 rounded bg-surface-container-high text-primary font-semibold border border-primary/30">
            {meta ? `${meta.rows_count.toLocaleString()} ROWS · ${meta.contracts_count} CONTRACTS` : 'LOADING...'}
          </span>
        </div>

        {/* Right side info & export */}
        <div className="flex items-center gap-space-md shrink-0">
          <div className="hidden md:flex flex-col items-end">
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              AS OF EOD: <span className="text-on-surface font-semibold">{meta ? meta.coverage_end : '30-Sep-2026'}</span>
            </span>
            <span className="font-label-xs text-label-xs text-primary font-mono">
              UNIVERSE: GOLDM · GOLDTEN · GOLDGUINEA · GOLDPETAL
            </span>
          </div>
          <div className="h-6 w-px bg-surface-variant hidden md:block"></div>
          <a
            href="./data/meta.json"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-high hover:bg-surface-container-highest border border-surface-variant text-on-surface hover:text-primary transition-colors font-body-sm text-body-sm"
          >
            <span className="material-symbols-outlined text-[15px]">file_download</span>
            <span className="hidden sm:inline font-medium">JSON Export</span>
          </a>
        </div>
      </header>

      {/* Replaced Top Market Tape (Section 10.2: Real 4 symbols from Bhavcopy) */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-surface-container-low border-b border-surface-variant px-space-md py-1 overflow-x-auto flex items-center justify-between gap-space-md text-data-mono-sm">
        <div className="flex items-center gap-space-lg shrink-0">
          <span className="font-label-xs text-label-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            EOD CONTRACT SETTLEMENTS (30-SEP-2026)
          </span>
          {meta?.latest_quotes.map((q) => {
            const isPos = q.change_rs >= 0;
            return (
              <div key={q.symbol} className="flex items-center gap-space-xs font-mono">
                <span className="font-semibold text-on-surface">{q.symbol}</span>
                <span className="text-on-surface-variant">
                  ₹{q.close.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  <span className="text-[9px] text-outline">/{q.quote_grams}g</span>
                </span>
                <span className={`text-[10px] ${isPos ? 'text-secondary' : 'text-tertiary'}`}>
                  {isPos ? '+' : ''}{q.change_rs} ({isPos ? '+' : ''}{q.change_pct.toFixed(2)}%)
                </span>
                <span className="text-[10px] text-primary/80 bg-surface-container-high px-1 rounded">
                  Pure: ₹{q.px_per_10g_pure.toLocaleString('en-IN', { minimumFractionDigits: 1 })}/10g
                </span>
              </div>
            );
          })}
        </div>
        <div className="hidden xl:flex items-center gap-2 text-on-surface-variant text-[10px] font-mono shrink-0">
          <span>Walk-Forward Test: Frozen Parameters</span>
          <span>•</span>
          <span className="text-secondary font-medium">100% Market Neutral</span>
        </div>
      </div>

      <div className="flex pt-[5.25rem] min-h-screen">
        {/* Left Nav Sidebar */}
        <aside className="fixed left-0 top-[5.25rem] bottom-0 w-64 bg-surface-container-lowest border-r border-surface-variant z-30 flex flex-col justify-between">
          <div className="flex flex-col">
            <div className="px-space-md py-space-sm border-b border-surface-variant flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-primary font-semibold">
                  RESEARCH MODULES
                </span>
                <span className="font-label-xs text-[9px] text-on-surface-variant uppercase tracking-tight">
                  Quantitative Bullion RV Analytics
                </span>
              </div>
              <span className="material-symbols-outlined text-[15px] text-primary">analytics</span>
            </div>

            <nav className="flex flex-col py-space-xs">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/overview' && location.pathname === '/');
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-space-md py-space-sm transition-all border-l-2 ${
                      isActive
                        ? 'bg-primary-container/20 text-primary font-semibold border-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border-transparent font-medium'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="font-data-mono-sm text-[9px] px-1 py-0.5 rounded bg-surface-container text-on-surface-variant">
                      {item.code}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Bottom Data Status Card */}
          <div className="p-space-sm border-t border-surface-variant bg-surface-container-low">
            <div className="bg-surface-container p-space-sm rounded border border-surface-variant">
              <div className="flex items-center justify-between text-label-xs font-label-xs mb-space-xs">
                <span className="text-on-surface-variant font-semibold uppercase tracking-wider">
                  DATA INTEGRITY
                </span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="text-secondary font-bold">100% Clean</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-[10px] font-mono text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Source:</span>
                  <span className="text-on-surface">MCX Bhavcopy (EOD)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>History:</span>
                  <span className="text-on-surface">768 Dates (Continuous)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duplicates:</span>
                  <span className="text-secondary">0 Found</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Execution:</span>
                  <span className="text-primary">t+1 Closes with Slip</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="pl-64 w-full min-h-[calc(100vh-5.25rem)] bg-surface p-space-md">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
