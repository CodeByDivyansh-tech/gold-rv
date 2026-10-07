# MCX Gold Relative-Value Intelligence Platform

[![Static Site](https://img.shields.io/badge/Architecture-Static%20Site%20(Zero%20Runtime%20Server)-success)](https://render.com)
[![Python Pipeline](https://img.shields.io/badge/Pipeline-Python%203.11%2B%20%7C%20Pandas%20%7C%20NumPy-blue)](#python-pipeline)
[![Frontend](https://img.shields.io/badge/Frontend-Static%20HTML%20%7C%20no%20runtime%20deps-orange)](#3-how-to-run-locally)
[![Acceptance Tests](https://img.shields.io/badge/Tests-Pytest%20Passing-brightgreen)](#acceptance-tests)
[![Pitch Presentation](https://img.shields.io/badge/Pitch-Interactive%203D%20Deck-gold)](https://gold-rv.vercel.app/pitch/)

**Hack in Hills '26 · Problem 03: Commodity Derivatives Intelligence**  
A production-grade, audit-ready relative-value (RV) research terminal across MCX Gold derivatives (`GOLDM`, `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL`).  
• **Judge Pitch Deck**: [Interactive 3D Pitch Presentation](https://gold-rv.vercel.app/pitch/) (`/pitch/`)

---

## 1. Key Analytical Findings

1. **Normalized Basis & Structural Regime Shift**:
   - Gold futures contracts quote across different lot sizes (1g, 8g, 10g, 100g) and metallurgical purities (`GOLDM` is 995 fine gold; `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL` are 999 fine gold). All contracts are mathematically normalized to pure gold equivalent via:
     $$\text{px\_per\_g\_pure} = \frac{\text{close}}{\text{quote\_grams} \times \text{purity}}$$
   - Cross-contract basis is not equal and shifted sharply between Dec-2024 and Mar-2025: `GOLDPETAL` moved from ~2.5% cheap (+200 to +260 bps) relative to `GOLDGUINEA` to slightly rich (−30 to 0 bps). **The cause is not yet confirmed**; a shift this large usually means a change in contract terms, so it should be checked against MCX circulars for that period.
   - Purity values in `pipeline/config.py` (GOLDM 995; GOLDTEN, GOLDGUINEA, GOLDPETAL 999) should be re-checked against MCX's own contract specifications: GOLDTEN sits about 30 bps away from GOLDPETAL and GOLDGUINEA most of the time.
   - Because of this regime shift, relative-value signals must be measured strictly against a **rolling point-in-time window**, never an arbitrary static zero or full-sample mean.

2. **Term Structure Carry Sanity**:
   - Implied annualized carry derived from `GOLDPETAL` calendar spreads has a **median of 8.03%** (interquartile range 6.18% – 10.86%). That is above typical Indian money-market rates over the period; we have not tested what explains the gap (financing, storage or demand).

3. **Walk-Forward Out-of-Sample Backtest (12 Months Unseen)**:
   - Walk-forward segmentation: Parameters tuned strictly on Train (10-Oct-2023 → 30-Sep-2025) and frozen for 12 months unseen Test (01-Oct-2025 → 30-Sep-2026).
   - Sizing calibrated at ₹10 Lakh per leg with flat brokerage, MCX turnover fees, SEBI charges, stamp duty, CTT, GST, and execution slippage (0, 2, 5, 10 bps).
   - **One rule everywhere**: the backtest now uses the same five checks as today's alerts (including the cost line: gap ≥ 2 × round-trip cost = 48.8 bps), never enters beyond its own stop-loss, never fills on a day a leg moved 6% or more, and never fills an exit at the signal's own close.
   - **Walk-forward switch**: a pair is traded in Test only if training gave ≥ 10 trades and a profit. Only `GOLDM − GOLDPETAL` qualifies.
   - **Gold exposure**: equal grams on both legs, so direct gold P&L is ~1.4% of gross; pooled correlation of trade returns with gold moves is −0.10 (computed, see `backtest/*_5.json`).
   - **Results at 5 bps slippage** (all computed in `backtest/rule_comparison.json`):

     | Rule | Train trades | Train net | Test trades | Test net | Test avg / trade | t-stat | Closed in Jan–Mar 2026 crash | Test outside crash |
     |---|---|---|---|---|---|---|---|---|
     | Five checks (current) | 37 | −₹19,056 | 20 | +₹1,13,598 | +39.4 bps | 1.89 | +₹1,37,985 | −₹24,387 |
     | Original study (4 checks, no cost line) | 59 | −₹66,783 | 54 | +₹16,387 | −1.0 bps | −0.08 | +₹1,70,806 | −₹1,54,419 |
     | Five checks + training switch | — | — | 4 | +₹22,916 | — | — | — | — |

   - **Honest Scientific Verdict**:
     > *"Cross-contract gold gaps are real and measurable. With the same five checks the site shows, the rule lost ₹19,056 over 37 training trades, then made ₹1,13,598 over 20 unseen-year trades. But trades that closed during the Jan–Mar 2026 crash made ₹1,37,985; outside it the rule lost ₹24,387. The result is not proven (t = 1.89, below the usual bar of 2), and training would have switched on only 1 of 6 pairs. No persistent edge is proven after costs."*

   - **Audit fixes (Oct-2026)**: max drawdown now starts from zero (it missed opening losses); the "0 mismatches" data claim is now a real check of the raw MCX file against the cleaned data on every build; gold-share, correlation, weekend sessions, limitations and the verdict are computed instead of typed in. The original study is kept (`LEGACY_RULE`) and still reproduces `reference/reference_summary.csv`.

---

## 2. Architecture & Design Principles

The application is a fully **static site** (deployed on Vercel; Render Static Site works the same way), completely eliminating server runtime overhead, cold starts, and container spin-down delays:

```
gold-rv/
├── SPEC.md                           # Problem specification & truth source
├── README.md                         # Architecture, findings, and deployment guide
├── data/
│   └── raw/
│       ├── gold_bhavcopy_clean.csv   # 11,954 verified EOD rows (10-Oct-2023 → 30-Sep-2026)
│       ├── contract_calendar.csv     # Contract lifecycles (liquid-from, peak OI, expiry)
│       └── parity_data_book.csv      # 55,457 MCX rows, Nov-2003 → Oct-2026, shared by the Parity team (used for the 2011–2023 history check)
├── reference/                        # Mathematical reference scripts & benchmarks
│   ├── reference_check.py            # Verification reference
│   ├── reference_summary.csv         # Target benchmark table reproduced by pipeline
│   └── reference_grid.csv            # 18-combination parameter grid benchmark
├── pipeline/                         # Deterministic Python data processing pipeline
│   ├── config.py                     # Contract master, cost rates, parameters, dates
│   ├── load.py                       # Bhavcopy loader, primary key & integrity validation
│   ├── normalize.py                  # Section 4.1 price normalization
│   ├── carry.py                      # Section 4.2 carry & Section 4.3 curve decomposition
│   ├── pairs.py                      # Section 4.4 pair builder & Section 4.5 rolling z-scores
│   ├── backtest.py                   # Sections 5.1–5.5 walk-forward backtesting engine
│   ├── attribution.py                # Section 5.7 costs & Section 5.8 P&L attribution
│   ├── alerts.py                     # Section 6 five-gate alert evaluation
│   ├── lifecycle.py                  # Section 7 contract calendar & lifecycle windows
│   ├── build_site_data.py            # Master builder writing frontend/public/data/*.json
│   └── tests/                        # Comprehensive Section 12 test suite
│   ├── build_web_data.py             # Writes frontend/public/data/site-data.json for the website
│   ├── robustness.py                 # Alert follow-through and resampled 95% ranges (robustness.json)
│   ├── history.py                    # Frozen rule on 2011–2023 from the Parity data book (history.json)
└── frontend/                         # The website: static HTML + JS, no runtime dependencies
    ├── index.html                    # Shell: meta tags, favicon, theme before first paint
    ├── build.mjs                     # `npm run build` → dist/ (copies index.html + public/)
    ├── tests/pages.test.mjs          # Runs every page's logic against site-data.json
    └── public/
        ├── app/dc.js                 # ~350-line renderer: templates, repeats, conditions, events, DOM morphing
        ├── app/main.js               # Hash router: #/ #/today #/market #/pairs #/signals #/backtesting #/data
        ├── pages/*.dc.html           # One file per page: template + logic class (same files as the design)
        └── data/site-data.json       # Everything the pages show, built by the pipeline
```

---

## 3. How to Run Locally

### Prerequisites
- Python 3.11+ with `pandas`, `numpy`, `pytest`
- Node.js 18+ (no packages needed to build or test the site)

### Step 1: Precompute Site Data
Run the pipeline to process all Bhavcopy records, simulate the walk-forward backtest across parameter grids and cost scenarios, evaluate gates, and output JSON files:

```bash
python -m pipeline.build_site_data
```

All generated files land in `frontend/public/data/`. Step 8 writes `site-data.json`, the main file the website reads; step 9 writes `robustness.json` (does the gap close after an alert, and a resampled 95% range for each result); step 10 writes `history.json` (the same frozen rule on 2011–2023, years the model never saw, using `data/raw/parity_data_book.csv`, official MCX Bhavcopy rows shared with us by the Parity team with their permission; it also holds a weekly price series back to 2003 for the 10Y and All chart ranges on Home and Market).

### Step 2: Run Acceptance Tests
Verify mathematical equivalence, zero look-ahead, and test fixtures:

```bash
python -m pytest pipeline/tests/
```

### Step 3: Build, Test and Open the Website

```bash
cd frontend
npm test              # page logic against the real data (no install needed)
npm run build         # writes dist/ (no install needed)
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. (`npm install && npm run dev` also works, using Vite as a dev server.)

---

## 4. Deployment Guide: Render Static Site (Section 8.2)

Because the site requires zero backend at runtime, it deploys to Render as a **Static Site** (not a Web Service):

1. **Push Repository**: Ensure `frontend/public/data/` is committed and pushed to GitHub.
2. **Create New Static Site**:
   - In Render Dashboard: Click **New +** → **Static Site**.
   - Connect your GitHub repository.
3. **Configure Settings**:
   - **Name**: `gold-rv-intelligence`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Deploy**:
   - The build copies the static site into `dist/`; nothing runs on a server.
   - When new data is added, re-run `python -m pipeline.build_site_data` locally, commit the JSON files, and push to GitHub.

---

## 5. Verification Checklist (Section 12 Tests)

| Requirement | Test Module | Status |
|---|---|---|
| Normalization fixtures match Section 4.1 to 0.01 | `test_load_normalize.py` | Verified Pass |
| `volume_grams / volume_lots` == lot_grams on all rows | `test_load_normalize.py` | Verified Pass |
| 0 duplicate primary keys; no `no_trade_day` used for fills | `test_load_normalize.py` | Verified Pass |
| GOLDPETAL median implied carry within [3%, 12%] (8.03%) | `test_carry.py` | Verified Pass |
| Zero look-ahead in rolling z-score | `test_pairs.py` | Verified Pass |
| Zero look-ahead in contract pair selection | `test_pairs.py` | Verified Pass |
| All trade entries and exits within contract lifecycle windows | `test_alerts_lifecycle.py` | Verified Pass |
| Every fill date strictly follows signal date ($t+1$) | `test_backtest.py` | Verified Pass |
| Attribution identity: $\text{Spread} + \text{Gold} - \text{Costs} = \text{Net}$ | `test_backtest.py` | Verified Pass |
| Original study (`LEGACY_RULE`) still reproduces `reference_summary.csv` | `test_backtest.py` | Verified Pass |
| Every backtest trade passed the same five checks as the alerts (incl. cost line, below stop-loss) | `test_rule_fixes.py` | Verified Pass |
| No fills on 6%+ move days; exits never fill at the signal's own close | `test_rule_fixes.py` | Verified Pass |
| Max drawdown counts an opening loss | `test_rule_fixes.py` | Verified Pass |
| Training switch uses Train data only | `test_rule_fixes.py` | Verified Pass |
| Data book matches our MCX download on every shared row; history check uses the frozen settings and only days before our data; long chart series is weekly and stops before our data | `test_history.py` | Verified Pass |
| All 6 pairs Quiet on latest date (2026-09-30) | `test_alerts_lifecycle.py` | Verified Pass |
| Prohibited strings grep (`COMEX`, `USD/INR`, `Confidence`, etc.) | `test_frontend_acceptance.py` | 0 Hits (Verified) |

---

## 6. Documented Research Limitations

1. **Settlement Closes vs Order-Book Fills**: EOD Bhavcopy settlement prices reflect official settlement determinations rather than executable limit-order book fills.
2. **Volume vs Liquidity Depth**: Traded lots indicate activity but do not capture instantaneous book depth or market impact for sizes exceeding typical retail flow.
3. **GOLDTEN History**: `GOLDTEN` commenced trading on 31-Mar-2025, providing only 6 months of in-sample training data.
4. **Sample Size Constraints**: The 12-month unseen test period yielded 2 to 5 trades per pair (20 in total) under the five-check rule, precluding high statistical significance. The long-history check (step 10) adds 151 trades on 2011–2023 for the three pairs that existed then; at 5 bps slippage the same frozen rule lost money after costs (see `history.json`). It applies today's MCX fee rates to past years.
5. **Structural Break Causality**: The 250 bps structural flip in `GOLDPETAL` basis between Dec-2024 and Mar-2025 warrants ongoing investigation into physical delivery logistics and contract settlement circulars.
6. **One Crash Dominates**: Trades that closed during the Jan–Mar 2026 crash made more than the whole unseen-year profit; outside it the rule lost money.
7. **Assumed Slippage**: Slippage (82% of round-trip cost) is assumed at 5 bps per order, not measured. In training the five-check rule breaks even at about 3.8 bps per order, close to that assumption.
8. **Forced Exits on Contract Switches**: When the pair series moves to new contracts, open trades are closed, which adds cost.
