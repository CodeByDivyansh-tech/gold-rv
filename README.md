# MCX Gold Relative-Value Intelligence Platform

[![Static Site](https://img.shields.io/badge/Architecture-Static%20Site%20(Zero%20Runtime%20Server)-success)](https://render.com)
[![Python Pipeline](https://img.shields.io/badge/Pipeline-Python%203.11%2B%20%7C%20Pandas%20%7C%20NumPy-blue)](#python-pipeline)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind%20%7C%20Recharts-orange)](#frontend-application)
[![Acceptance Tests](https://img.shields.io/badge/Tests-Pytest%20Passing-brightgreen)](#acceptance-tests)

**Hack in Hills '26 · Problem 03: Commodity Derivatives Intelligence**  
A production-grade, audit-ready relative-value (RV) research terminal across MCX Gold derivatives (`GOLDM`, `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL`).

---

## 1. Key Analytical Findings

1. **Normalized Basis & Structural Regime Shift**:
   - Gold futures contracts quote across different lot sizes (1g, 8g, 10g, 100g) and metallurgical purities (`GOLDM` is 995 fine gold; `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL` are 999 fine gold). All contracts are mathematically normalized to pure gold equivalent via:
     $$\text{px\_per\_g\_pure} = \frac{\text{close}}{\text{quote\_grams} \times \text{purity}}$$
   - Cross-contract basis is not equal and experienced a verified **structural regime break** between Dec-2024 and Mar-2025: `GOLDPETAL` flipped from ~2.5% cheap (+200 to +260 bps) relative to `GOLDGUINEA` to slightly rich (−30 to 0 bps).
   - Because of this regime shift, relative-value signals must be measured strictly against a **rolling point-in-time window**, never an arbitrary static zero or full-sample mean.

2. **Term Structure Carry Sanity**:
   - Implied annualized carry derived from liquid `GOLDPETAL` calendar spreads exhibits a **median of 8.03%** (interquartile range 6.18% – 10.86%), directly consistent with Indian money market financing rates plus bullion vaulting and insurance expenses.

3. **Walk-Forward Out-of-Sample Backtest (12 Months Unseen)**:
   - Walk-forward segmentation: Parameters tuned strictly on Train (10-Oct-2023 → 30-Sep-2025) and frozen for 12 months unseen Test (01-Oct-2025 → 30-Sep-2026).
   - Sizing calibrated at ₹10 Lakh per leg with flat brokerage, MCX turnover fees, SEBI charges, stamp duty, CTT, GST, and execution slippage (0, 2, 5, 10 bps).
   - **Market Neutrality**: Daily strategy correlation and beta to gold price returns are both near zero ($< 0.02$). Gold price exposure accounts for $< 1.5\%$ of gross P&L.
   - **Honest Scientific Verdict**:
     > *"Cross-contract gold spreads are real, measurable and partly mean-reverting, but after realistic costs no pair shows a statistically significant edge on 12 months of unseen data. The only profits come from a single crisis episode (Jan-2026 crash). No persistent edge survives costs."*

---

## 2. Architecture & Design Principles

The application is engineered as a **Render Static Site**, completely eliminating server runtime overhead, cold starts, and container spin-down delays:

```
gold-rv/
├── SPEC.md                           # Problem specification & truth source
├── README.md                         # Architecture, findings, and deployment guide
├── data/
│   └── raw/
│       ├── gold_bhavcopy_clean.csv   # 11,954 verified EOD rows (10-Oct-2023 → 30-Sep-2026)
│       └── contract_calendar.csv     # Contract lifecycles (liquid-from, peak OI, expiry)
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
└── frontend/                         # React + Vite + Tailwind + Recharts static web application
    ├── public/data/                  # Precomputed JSON files (committed to git)
    ├── tailwind.config.js            # Design tokens matching Stitch terminal theme
    └── src/
        ├── App.tsx                   # HashRouter configuration
        ├── components/Layout.tsx     # Terminal shell, market tape, navigation
        └── pages/
            ├── Overview.tsx          # 01 Overview (Q1–Q4, divergence bands, scanner)
            ├── MarketAnalysis.tsx    # 02 Market Analysis (Specs, regimes, carry curve)
            ├── Signals.tsx           # 03 Signals (Gate verification, liquidity check)
            ├── Backtesting.tsx       # 04 Backtesting (KPIs, equity curve, cost stress)
            └── Methodology.tsx       # 05 Data & Methodology (Provenance, Gantt, verdict)
```

---

## 3. How to Run Locally

### Prerequisites
- Python 3.11+ with `pandas`, `numpy`, `scipy`, `pytest`
- Node.js 18+ and `npm`

### Step 1: Precompute Site Data
Run the pipeline to process all Bhavcopy records, simulate the walk-forward backtest across parameter grids and cost scenarios, evaluate gates, and output JSON files:

```bash
python -m pipeline.build_site_data
```

All generated files will land in `frontend/public/data/` (total payload $< 5\text{ MB}$).

### Step 2: Run Acceptance Tests
Verify mathematical equivalence, zero look-ahead, and test fixtures:

```bash
python -m pytest pipeline/tests/
```

### Step 3: Run the Frontend Application
Launch the local Vite development server:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` or the terminal URL in your browser.

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
   - Render automatically executes the Vite build, generating optimized HTML, CSS, and JS bundles reading directly from static JSON endpoints.
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
| Backtest exact reproduction of `reference_summary.csv` | `test_backtest.py` | Verified Pass |
| All 6 pairs Quiet on latest date (2026-09-30) | `test_alerts_lifecycle.py` | Verified Pass |
| Prohibited strings grep (`COMEX`, `USD/INR`, `Confidence`, etc.) | `test_frontend_acceptance.py` | 0 Hits (Verified) |

---

## 6. Documented Research Limitations

1. **Settlement Closes vs Order-Book Fills**: EOD Bhavcopy settlement prices reflect official settlement determinations rather than executable limit-order book fills.
2. **Volume vs Liquidity Depth**: Traded lots indicate activity but do not capture instantaneous book depth or market impact for sizes exceeding typical retail flow.
3. **GOLDTEN History**: `GOLDTEN` commenced trading on 31-Mar-2025, providing only 6 months of in-sample training data.
4. **Sample Size Constraints**: The 12-month unseen test period yielded 6 to 16 trades per pair, precluding high statistical significance on individual pair t-tests.
5. **Structural Break Causality**: The 250 bps structural flip in `GOLDPETAL` basis between Dec-2024 and Mar-2025 warrants ongoing investigation into physical delivery logistics and contract settlement circulars.
