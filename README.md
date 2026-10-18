# MCX Gold Relative-Value Intelligence Platform

[![Static Site](https://img.shields.io/badge/Architecture-Static%20Site%20(Zero%20Runtime%20Server)-success)](https://gold-rv.vercel.app)
[![Python Pipeline](https://img.shields.io/badge/Pipeline-Python%203.11%2B%20%7C%20Pandas%20%7C%20NumPy-blue)](#3-how-to-run-locally)
[![Frontend](https://img.shields.io/badge/Frontend-Static%20HTML%20%7C%20no%20runtime%20deps-orange)](#3-how-to-run-locally)
[![CI](https://github.com/CodeByDivyansh-tech/gold-rv/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeByDivyansh-tech/gold-rv/actions/workflows/ci.yml)
[![Pitch Presentation](https://img.shields.io/badge/Pitch-Interactive%203D%20Deck-gold)](https://gold-rv.vercel.app/pitch/)

**Hack in Hills '26 · Problem 03: Commodity Derivatives Intelligence**
A relative-value (RV) research terminal across MCX Gold derivatives (`GOLDM`, `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL`).
• **Live site**: [gold-rv.vercel.app](https://gold-rv.vercel.app) · **Pitch**: [interactive 3D deck](https://gold-rv.vercel.app/pitch/) (`/pitch/`)

---

## 1. Key Analytical Findings

**Verdict: the gaps between the four contracts are real, but no persistent edge is proven after costs.**
Every number below is computed by the pipeline (`frontend/public/data/`), not typed in.

### 1.1 The clean test: 2011–2023, rule frozen (151 trades)

The rule and its settings were frozen before this data was used, and nothing was changed afterwards
(data: the data-book team's MCX Bhavcopy data book, shared with permission; it matches our own MCX download on
all 12,021 shared rows). Only the three pairs that existed then can be tested.

| At 5 bps slippage | Trades | Net after costs | t-stat | Losing years |
|---|---|---|---|---|
| GOLDM − GOLDPETAL, GOLDM − GOLDGUINEA, GOLDGUINEA − GOLDPETAL | 151 | **−₹5,49,070** | −3.63 | 11 of 13 |

With **zero** slippage it still loses ₹2,35,391. This is the result to lead with (`history.json`).

### 1.2 The 2025–26 test year: not a clean test

Settings were tuned on Train (10-Oct-2023 → 30-Sep-2025) and frozen for Test (01-Oct-2025 → 30-Sep-2026),
₹10 lakh per leg, every MCX cost, next-day fills.
**But** the original study's test-year results were known by 2 Oct 2026, and the five-check rule was written on
4 Oct 2026, after that. So the test year helped shape the rule and is **not** a clean out-of-sample test
(`evidence.json → test_year`).

| Rule (5 bps slippage) | Train trades | Train net | Test trades | Test net | t-stat | Closed in Jan–Mar 2026 crash | Test outside crash |
|---|---|---|---|---|---|---|---|
| Five checks (what the site shows) | 38 | −₹16,514 | 20 | +₹1,13,598 | 1.89 | +₹1,37,985 | −₹24,387 |
| Original study (4 checks, no cost line) | 60 | −₹63,801 | 54 | +₹16,387 | −0.08 | +₹1,70,806 | −₹1,54,419 |
| Five checks + training switch | — | — | 4 | +₹22,916 | — | — | — |

- **Significance**: t = 1.89 on 20 trades gives p = 0.07; allowing for the 3 rule versions scored on the test year,
  p = 0.22. 108 settings (18 per pair) were tried on training only, which is tuning, not testing.
- **One crash**: trades that closed in Jan–Mar 2026 made more than the whole test-year profit. That window was named
  after the results were seen, so the split is a check, not a test.
- **Resampling** (10,000 draws): 94% of test-year totals stay above ₹0, 14% without the crash, 30% in training.
- **Training switch**: only GOLDM − GOLDPETAL qualifies, on +₹6,633 over 17 training trades (t = 0.19): close to a coin flip.

### 1.3 Slippage: the number that decides it, and daily data cannot measure it

Slippage (5 bps per order, assumed) is 82% of the 24.4 bps round-trip cost. `pipeline/evidence.py` tries to
measure it from the daily data with two standard estimators (Roll 1984; Corwin & Schultz 2012). Both find no
spread on most contracts and months (it is smaller than a day's price noise); with negative readings set to zero
they give 26–31 bps for every contract alike, which is volatility, not a spread. The hard floor is half a tick,
at most 0.34 bps. Our trades were a median 0.06% of the day's volume.

Break-even slippage per order: **training 4.0 bps · test year 14.3 bps · 2011–2023 never (loses at 0)**.
Only real broker fills (a forward test) can settle it.

### 1.4 Market structure

- **Normalization**: lot sizes 1 g / 8 g / 10 g / 100 g and purities (GOLDM 995; the others 999) are normalized to
  ₹ per gram of pure gold: `px_per_g_pure = close / quote_grams / purity`. Purities match public contract
  descriptions (GOLDTEN 999, GOLDM 995; MCX's 2019 circular prices Gold Guinea on 999); confirm against MCX's own
  spec sheets when possible.
- **GOLDPETAL repriced in November 2024**: GOLDGUINEA − GOLDPETAL fell from +203 to +19 bps between 4 and 11 Nov 2024,
  inside one contract (Nov-2024 expiry). Against GOLDM, GOLDPETAL rose about 249 bps and GOLDGUINEA about 66 bps,
  so most of the move was GOLDPETAL. Median gap +255 bps (May–Nov 2024) vs −29 bps (Feb–Jul 2025). Located by a
  level-shift test in `pipeline/evidence.py`; **cause not confirmed** (no MCX notice found). Because the "normal"
  level moves, signals use a rolling point-in-time window, never a fixed zero or full-sample mean.
- **Carry**: GOLDPETAL calendar spreads imply a median 8.03% a year (IQR 6.18–10.86%).
- **Gold exposure**: equal grams on both legs; gold-price P&L is ~1.4% of gross; correlation of trade returns
  with gold moves −0.10.

### 1.5 The data: what we have, what was missing, what we still need

| | |
|---|---|
| **Coverage** | 10 Oct 2023 → 1 Oct 2026: 769 trading days, 149 contracts, 12,267 daily settlements; every day the MCX history book has in that window is present (a test checks this) |
| **Fixed in Oct 2026** | Our MCX download had skipped 8 contracts: the Oct, Nov and Dec 2023 expiries of GOLDM, GOLDGUINEA and GOLDPETAL (289 traded rows, the busiest contracts in those months). They are now added from the MCX history book, with 1 Oct 2026, in `data/raw/mcx_bhavcopy_supplement.csv`. Effect: training 37 → 38 trades, −₹19,056 → −₹16,514; settings, test year, 2011–2023 check and alerts unchanged |
| **Checked and fine** | No missing days inside any contract's life; no broken high/low/close; the 6%+ days (Jan–Mar 2026, 19 Mar, 13 May 2026) moved all four contracts together, so they are real; GOLDM's Nov-2024 contract expired early, on 31 Oct 2024 |
| **Exchange quirk** | 169 rows where MCX's "previous close" differs from the prior day's close, mostly thin contracts and no-trade days; the pipeline never uses that field for signals |
| **Still missing** | 2 Oct 2026 onward. Run `python -m pipeline.download` on a computer that can reach mcxindia.com (MCX blocks most cloud servers) |
| **Would help most** | Real broker fills or intraday bid/ask, to measure slippage (82% of the cost, and the number that decides the verdict); MCX circulars for Nov 2024 (the GOLDPETAL repricing); MCX's official contract spec sheets (purities, delivery centres) |

---

## 2. Architecture

A fully **static site** (deployed on Vercel from `main`): a Python pipeline precomputes every number into JSON,
and plain HTML/JS pages read it. No server at runtime.

```
gold-rv/
├── SPEC.md                     # Original build spec (maths still current; see its note on what changed)
├── README.md
├── requirements.txt            # pandas, numpy, scipy, pytest, requests
├── .github/workflows/
│   ├── ci.yml                  # tests + build + "committed data matches a fresh run" on every push
│   └── refresh-data.yml        # manual: download new MCX rows, rebuild, test, commit
├── data/raw/
│   ├── mcx_bhavcopy_raw_api.csv   # rows exactly as the MCX endpoint returns them (source of truth)
│   ├── mcx_bhavcopy_supplement.csv # 313 official MCX rows our download missed, from the MCX history book
│   ├── gold_bhavcopy_clean.csv    # 12,267 rows, derived from the raw file + supplement (pipeline/download.py)
│   ├── contract_calendar.csv      # contract lifecycles, derived from the clean file
│   ├── retrieval_log.csv          # one line per MCX request
│   └── mcx_history_book.csv       # 55,457 MCX rows, Nov-2003 → Oct-2026 (data-book team, with permission)
├── reference/                  # reference_check.py + its outputs (the original study's benchmark)
├── pipeline/
│   ├── config.py               # contract master, costs, parameters, split dates, segment_of()
│   ├── download.py             # refresh from MCX; raw -> clean -> calendar
│   ├── load.py · normalize.py · carry.py · pairs.py
│   ├── backtest.py · attribution.py · alerts.py · lifecycle.py
│   ├── history.py              # frozen rule on 2011–2023 (history.json)
│   ├── evidence.py             # test-year status, slippage check, multiple testing, switch, GOLDPETAL break
│   ├── robustness.py           # alert follow-through and resampled 95% ranges (robustness.json)
│   ├── build_site_data.py      # runs everything, writes frontend/public/data/*.json
│   ├── build_web_data.py       # site-data.json, the one file the pages read
│   └── tests/                  # 42 pytest tests
└── frontend/
    ├── index.html · build.mjs · tests/pages.test.mjs
    └── public/
        ├── app/dc.js           # ~375-line renderer: templates, repeats, conditions, components, DOM morphing
        ├── app/main.js         # hash router: #/ #/today #/market #/pairs #/signals #/backtesting #/data
        ├── pages/*.dc.html     # one file per page; Rail.dc.html and TabBar.dc.html are the shared menus
        ├── pitch/              # the 3D pitch deck
        └── data/               # JSON written by the pipeline (committed)
```

---

## 3. How to Run Locally

Prerequisites: Python 3.11+, Node.js 18+ (no npm packages needed to build or test).

```bash
pip install -r requirements.txt
python -m pipeline.build_site_data      # writes frontend/public/data/ (about 20 s)
python -m pytest pipeline/tests/        # 42 tests
cd frontend
npm test                                # page logic against the real data
npm run build                           # writes dist/
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. (`npm install && npm run dev` also works, using Vite as a dev server.)

### Refreshing the data

```bash
python -m pipeline.download             # fetch new rows for live and newly listed contracts
python -m pipeline.build_site_data      # rebuild the website data
```

- Trades entered after 30-Sep-2026 go into a separate **forward** period (the frozen rule on data nobody had
  when it was written). They are never mixed into the training or test-year results, and the site reports them on
  their own.
- Tests that check the published research figures load data only up to 30-Sep-2026, so a refresh doesn't break them.
- MCX may block scripted requests, which is why the download part has not been run from CI yet. If it fails,
  nothing is written. `python -m pipeline.download --rebuild-only` rebuilds the clean CSV and calendar from the raw
  file without the network (CI checks that this reproduces the committed files exactly).
- On GitHub: Actions → **Refresh MCX data** → Run workflow. Once a manual run succeeds, the schedule in
  `.github/workflows/refresh-data.yml` can be switched on.

---

## 4. Deployment

**Vercel (current)**: the live site deploys from `main`. To set it up again: import the repository, set Root
Directory `frontend`, Build Command `npm run build`, Output Directory `dist`.

**Render Static Site (alternative)**: New → Static Site → this repo; Root Directory `frontend`, Build Command
`npm install && npm run build`, Publish Directory `dist`.

When the data changes, re-run the pipeline, commit `frontend/public/data/`, and push. CI fails if the committed data
does not match what the pipeline produces from the committed code.

---

## 5. Verification (pytest, 42 tests)

| Requirement | Test module |
|---|---|
| Normalization fixtures to 0.01; `volume_grams / volume_lots` = lot grams; 0 duplicate keys | `test_load_normalize.py` |
| GOLDPETAL median implied carry within [3%, 12%] (8.03%) | `test_carry.py` |
| Zero look-ahead in rolling z-score and in contract pair selection | `test_pairs.py` |
| Trades inside lifecycle windows; all 6 pairs Quiet on 2026-09-30 | `test_alerts_lifecycle.py` |
| Fills strictly after signals; spread + gold − costs = net; original study reproduces `reference_summary.csv` | `test_backtest.py` |
| Every trade passed the five checks; no fills on 6%+ days; drawdown counts an opening loss; switch uses Train only | `test_rule_fixes.py` |
| Data book matches our MCX download; history uses frozen settings and only earlier days | `test_history.py` |
| Alert follow-through and resampling are repeatable and match the backtest | `test_robustness.py` |
| Verdict leads with the clean test and never calls the test year "unseen"; p-values computed; break-evens fit the scenarios; GOLDPETAL break located from data | `test_evidence.py` |
| Raw MCX file rebuilds the clean CSV and calendar byte for byte; merge refuses conflicts; forward trades never join the test year | `test_download.py` |
| Prohibited strings (`COMEX`, `USD/INR`, `Confidence`, …) absent from the site | `test_frontend_acceptance.py` |

Plus `npm test`: 94 page and menu states rendered against the real data.

---

## 6. Research Limitations

1. **Settlement closes vs fills**: EOD settlement prices are official references, not executable fills.
2. **Volume vs depth**: traded lots show activity, not order-book depth.
3. **Slippage is assumed, not measured** (82% of round-trip cost); daily data cannot measure it (section 1.3).
4. **The test year is not clean**: the five-check rule was written after its first results were seen. The clean test is 2011–2023.
5. **Small test sample**: 20 test-year trades (2–5 per pair).
6. **One crash dominates the test year**: trades closed in Jan–Mar 2026 made more than the whole test-year profit.
7. **GOLDTEN history**: listed 31-Mar-2025; only 6 months in training, and absent from the 2011–2023 check.
8. **GOLDPETAL repricing (Nov 2024)**: located precisely, cause unconfirmed.
9. **Past fee rates**: the 2011–2023 check charges today's MCX fee rates.
10. **Forced exits on contract switches** add cost.
