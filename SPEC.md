# Gold RV Intelligence — Build Spec for Antigravity

Hack in Hills '26 · Problem 03: Commodity Derivatives Intelligence
Data, formulas and every number below were checked against real MCX data (11,954 rows pulled from the MCX Bhavcopy API on 01-Oct-2026, cross-checked row-for-row against the manually downloaded files).

---

## 0. How to use this document

Put these in the project root before you start:

| File | What it is |
|---|---|
| `SPEC.md` | This document. The single source of truth for logic and numbers. |
| `data/raw/gold_bhavcopy_clean.csv` | 11,954 cleaned EOD rows: 4 symbols, 138 contracts, 10-Oct-2023 → 30-Sep-2026, no gaps. |
| `data/raw/contract_calendar.csv` | Per-contract lifecycle (first seen, liquid-from, peak OI, last seen). |
| `reference/reference_check.py` | A working reference implementation of Sections 4–5. Run `python reference/reference_check.py data/raw/gold_bhavcopy_clean.csv`. The app's pipeline must reproduce its numbers. Do not copy it as the app; build the modules in Section 8 properly. |
| `reference/reference_summary.csv`, `reference_trades.csv`, `reference_grid.csv` | Its outputs, for acceptance tests. |
| `design/stitch_gold_intelligence_trading_terminal/` | Unzipped Stitch export: 9 screens (`code.html` + `screen.png`) and `gold_intelligence/DESIGN.md`. |

**First prompt to paste into Antigravity:**

> Read `SPEC.md` fully before writing any code. This is a static website: a Python pipeline precomputes everything into JSON files and a React frontend reads them; there is no server at runtime, and it deploys to Render as a Static Site, not a Web Service (Section 8). Build in the order given in Section 11, one step at a time, and run the acceptance tests in Section 12 after each step. `reference/reference_check.py` is a working reference for the maths; your pipeline must reproduce `reference/reference_summary.csv`. The Stitch screens in `design/` are the visual reference only: copy their layout, Tailwind tokens and fonts, but every number shown in the UI must come from the pipeline's JSON files computed from `data/raw/gold_bhavcopy_clean.csv`. Remove any panel listed in Section 10.2. Never hard-code a market number in the frontend.

---

## 1. Goal and the rule that decides judging

Build a working prototype that turns MCX settlement-style EOD data into a defensible relative-value (RV) signal across GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL, tests it walk-forward on unseen data after costs, and separates strategy P&L from gold-price P&L.

The organisers judge **analytical rigour, not profit**. "No persistent edge survives costs" is an accepted result if proven. Therefore:

- The UI must be honest. If a pair has 6 trades, show "6 trades — not statistically meaningful", not a Sharpe ratio.
- The default state of the alert panel is **quiet**. A signal appears only when every gate in Section 6 passes.
- No look-ahead anywhere (Section 5.6).

---

## 2. Data

### 2.1 What we actually have (verified)

| Fact | Value |
|---|---|
| Rows | 11,954 (0 duplicates, 0 conflicting rows, 0 rows dated after expiry) |
| Trading dates | 768, from 2023-10-10 to 2026-09-30, continuous |
| Contracts | 138: GOLDM 39, GOLDPETAL 38, GOLDGUINEA 38, GOLDTEN 23 (see `contract_calendar.csv`) |
| GOLDTEN | First row 2025-03-31 (listing). Shorter history, as the problem says. |
| Weekend rows | 2023-11-12 (Diwali Muhurat session), 2025-02-01 and 2026-02-01 (Union Budget sessions). Real — keep them. |
| No-trade rows | 183 rows with volume = 0 and/or blank Open (exchange carried a theoretical close). Flag `no_trade_day`; never use for signals or fills. |
| Thin rows | 835 rows with volume < 25 lots or OI < 50 lots (mostly far contracts just after listing). |
| Live contracts on last date | 5–6 per symbol (Oct-26 to Feb/Mar-27 expiries). Near months are liquid: GOLDPETAL Oct-26 peak OI 208,412 lots; GOLDM Nov-26 44,601 lots. |
| Cross-check | All 1,215 rows from the earlier manual downloads match this dataset exactly (close, volume, OI). |

### 2.2 Clean CSV schema (`gold_bhavcopy_clean.csv`)

| Column | Type | Notes |
|---|---|---|
| `date` | YYYY-MM-DD | Trading date |
| `symbol` | str | Stripped of spaces |
| `expiry_date` | YYYY-MM-DD | Parsed from "05MAY2025" |
| `open`,`high`,`low` | float | Blank or 0 on no-trade days |
| `close` | float | EOD close as published. Treat as the official EOD reference, **not** an executable fill. |
| `prev_close` | float | |
| `volume_lots` | int | |
| `volume_grams` | int | From "Volume(In 000's)" × 1000 |
| `value_lakhs` | float | Traded value |
| `open_interest_lots` | int | |
| `lot_grams`,`quote_grams`,`purity` | | From contract master (2.3) |
| `px_per_g_pure` | float | Normalized price, Section 4.1 |
| `days_to_expiry` | int | Calendar days |
| `no_trade_day` | bool | volume = 0 or open blank/0 |
| `is_thin` | bool | volume_lots < 25 or OI < 50 |

**Primary key: (`symbol`, `expiry_date`, `date`).** Never build a continuous near-month series of prices.

### 2.3 Contract master (put in `config.py`)

| Symbol | Lot (g) | Quoted per (g) | Purity | Expiry window |
|---|---|---|---|---|
| GOLDM | 100 | 10 | 0.995 | 3rd–5th |
| GOLDTEN | 10 | 10 | 0.999 | 27th–31st |
| GOLDGUINEA | 8 | 8 | 0.999 | 27th–31st |
| GOLDPETAL | 1 | 1 | 0.999 | 27th–31st |

Verified from the data itself: `volume_grams / volume_lots` equals 100, 10, 8, 1 on every traded row, and `volume_grams × close / (value_lakhs × 1e5)` gives quote bases of 10.005, 10.006, 8.002, 1.000.

All four are staggered-delivery contracts. Brokers force square-off about 3 trading days before expiry (e.g. GOLDM Jan-2026 expiry: square-off by 31-Dec-2025; GOLDPETAL/GOLDGUINEA/GOLDTEN Dec-2025 expiry: by 26-Dec-2025). Hence `TENDER_BUFFER_TD = 4` in Section 5.3. Tick size and fee rates should be confirmed from https://www.mcxindia.com/products/bullion/gold and kept in `config.py`, never inlined.

### 2.4 Data downloader (optional, for refreshing the data)

The MCX Bhavcopy page (https://www.mcxindia.com/market-data/bhavcopy) calls a JSON endpoint:

```
GET https://www.mcxindia.com/market-data/bhavcopy/GetCommoditywiseBhavCopy
    ?InstrumentName=FUTCOM&Symbol=GOLDPETAL&Expiry=30SEP2025
    &fromDate=01/06/2025&toDate=30/09/2025          # DD/MM/YYYY
Headers: Content-Type: application/json, X-Requested-With: XMLHttpRequest
```

Response: `{"IsSuccess":true,"Data":[{"Date":"09/30/2025" (MM/DD/YYYY), "Symbol":"GOLDPETAL    " (space-padded), "ExpiryDate":"30SEP2025", "Open","High","Low","Close","PreviousClose","Volume","VolumeInThousands":"0.913 GRMS ","Value","OpenInterest", ...}]}`.

The list of all expiries per symbol is embedded in the page as JSON inside the element `#symbol-data` (fields `InstrumentName`, `SymbolValue`, `ExpiryDate`). The current dataset was collected with one request per (symbol, expiry), `fromDate = expiry − 400 days`, 0.4 s between requests. The endpoint worked from a normal browser session; a plain Python `requests` call may be blocked, so if the downloader fails, fall back to the provided CSV. Always: strip `Symbol`, parse both date formats, drop rows whose `Date` falls outside the requested range, de-duplicate on the primary key, and fail loudly on conflicting duplicates.

Manually downloaded `BhavCopyCommodiyWise_*.xls` files are HTML tables: read with `pandas.read_html(path)[0]`, `Date` format `%d %b %Y`.

---

## 3. Key empirical findings the product must show (not hide)

All from `reference_check.py` on the full dataset.

1. **Normalized prices are not equal, and the gaps change regime.** Spread = A vs B in bps of ₹ per gram of pure gold (carry-adjusted where expiries differ):

   | Pair | Oct-23 → Dec-24 | Apr-25 → Sep-26 (typical quarter mean) | Comment |
   |---|---|---|---|
   | GOLDGUINEA − GOLDPETAL | +200 to +260 | −30 to 0 | GOLDPETAL flipped from ~2.5% cheap to slightly rich around Dec-24 → Mar-25 |
   | GOLDM − GOLDPETAL | +140 to +200 | −25 to −95 | Same flip |
   | GOLDM − GOLDGUINEA | −70 to −95 | −15 to −100 | Stable: GOLDM ~0.8% below GOLDGUINEA throughout |
   | GOLDTEN − GOLDPETAL | (no GOLDTEN) | −40 to −90 | GOLDTEN below GOLDPETAL |
   | GOLDM − GOLDTEN | (no GOLDTEN) | +5 to +15 | The two big contracts agree closely |
   | GOLDGUINEA − GOLDTEN | (no GOLDTEN) | ≈ +70 | |

   Jan–Mar 2026 (a violent gold move; 30-Jan-2026 alone moved spreads by 300–700 bps) is an outlier quarter for every pair.

   Consequences: (a) the signal must be the deviation from a **rolling** mean, never from zero or from a full-sample mean; (b) the GOLDPETAL flip is a **structural break** — show it on the Market Analysis screen as such and do not claim to know its cause (it may relate to a contract or delivery change; check MCX circulars if time allows); (c) a rolling window needs a few weeks to adapt after a break, so signals during the transition are mostly false — the backtest includes them rather than hiding them.

2. **Carry sanity check passes.** GOLDPETAL calendar spreads imply an annualized carry of median **8.0%** (IQR 6.2–10.9%), in line with Indian interest rates plus storage/insurance. Automated test: median between 3% and 12%.

3. **Day-to-day spread changes are negatively autocorrelated** (lag-1 −0.01 to −0.28). Part of the apparent mean reversion is closes printed at different moments on contracts of different liquidity, which cannot be captured. Hence trades execute one day after the signal (Section 5.5).

4. **Walk-forward result (reference).** Train 2023-10 → 2025-09 (parameter grid 18 combos per pair, chosen by net ₹ at 5 bps slippage), Test 2025-10-01 → 2026-09-30 (12 months unseen, parameters frozen). Sizing ≈ ₹10 lakh notional per leg, equal grams. Costs per Section 5.7.

   Best in-sample configuration per pair already **loses money on Train** for 4 of 6 pairs (GOLDM−GOLDTEN, GOLDM−GOLDPETAL, GOLDM−GOLDGUINEA, GOLDGUINEA−GOLDPETAL).

   Test period, mean net bps per trade by slippage (bps per leg per side):

   | Pair | Trades | Gross bps | Net @0 | Net @2 | Net @5 (base) | Net @10 | t-stat @5 | 95% CI @5 (bootstrap) |
   |---|---|---|---|---|---|---|---|---|
   | GOLDGUINEA−GOLDPETAL | 9 | +12.8 | +8.5 | +0.5 | −11.5 | −31.6 | −1.64 | [−23, +3] |
   | GOLDTEN−GOLDPETAL | 16 | +4.9 | +0.5 | −7.6 | −19.7 | −39.8 | −1.75 | [−40, +3] |
   | GOLDGUINEA−GOLDTEN | 8 | +36.3 | +32.0 | +24.0 | +12.1 | −7.8 | 0.27 | [−60, +103] |
   | GOLDM−GOLDPETAL | 8 | +65.2 | +61.0 | +52.9 | +40.8 | +20.6 | 0.72 | [−46, +154] |
   | GOLDM−GOLDTEN | 6 | −2.9 | −7.1 | −15.1 | −27.2 | −47.3 | −2.78 | [−44, −10] |
   | GOLDM−GOLDGUINEA | 7 | +39.1 | +35.3 | +27.2 | +15.1 | −5.1 | 0.37 | [−36, +100] |

   All six pairs together on Test at 5 bps: 54 trades, mean **−1.0 bps** per trade, total ≈ +₹16k on ~₹10 lakh legs. The three pairs that are positive at 5 bps (GOLDM−GOLDPETAL, GOLDGUINEA−GOLDTEN, GOLDM−GOLDGUINEA) each owe it to one trade in the Jan-2026 crash fortnight (+389, +293, +256 bps); without each pair's single best trade, the six pairs together lose ≈ ₹1.57 lakh. Gold-price P&L is 1.4% of gross P&L, so the strategy is genuinely market-neutral — the problem is the edge, not gold exposure.

   **Honest conclusion to present: "Cross-contract gold spreads are real, measurable and partly mean-reverting, but after realistic costs no pair shows a statistically significant edge on 12 months of unseen data. The only profits come from a single crisis episode. No persistent edge survives costs."** The app must recompute these numbers; `reference_summary.csv` is the check.

---

## 4. Formulas

All prices use `close`. All spreads in **basis points (bps)** so pairs are comparable over time; also show ₹ per 10 g for traders.

### 4.1 Normalization

```
px_per_g_pure = close / quote_grams / purity
```

Test fixtures (must match to 2 decimals):

| symbol | expiry | date | close | px_per_g_pure |
|---|---|---|---|---|
| GOLDM | 2025-05-05 | 2025-05-02 | 93126 | 9359.40 |
| GOLDPETAL | 2025-04-30 | 2025-04-29 | 9659 | 9668.67 |
| GOLDTEN | 2025-06-30 | 2025-06-02 | 97533 | 9763.06 |
| GOLDGUINEA | 2025-06-30 | 2025-06-02 | 78139 | 9777.15 |
| GOLDPETAL | 2025-06-30 | 2025-06-02 | 9788 | 9797.80 |
| GOLDM | 2027-02-05 | 2026-09-25 | 156019 | 15680.30 |
| GOLDPETAL | 2027-02-26 | 2026-09-25 | 15895 | 15910.91 |

Display helper: `px_per_10g_pure = px_per_g_pure × 10`.

### 4.2 Implied carry (term structure)

For any two contracts of the same symbol alive on date t, near expiry T1 and far expiry T2:

```
carry_ann(t) = ln(F_far / F_near) × 365 / (T2 − T1)
```

Daily reference carry `c_t` = carry from the GOLDPETAL pair with the highest min(OI) on t−1 (it has the most overlapping contracts). If not available on t, use the last known value (forward-fill only, never backward). If none ever known, default 0.06 (config).

### 4.3 Roll-down vs genuine curve change

For each contract i with time to expiry τ (years), using the identity ln F = ln S + c·τ and a spot proxy `ln S_t = ln F_ref,t − c_t · τ_ref,t` (ref = the GOLDPETAL contract used for c_t):

```
Δln F_i  =  Δln S_t                          (gold price move)
          + c_{t−1} · (τ_t − τ_{t−1})          (mechanical roll-down; negative as τ shrinks)
          + (c_t − c_{t−1}) · τ_t              (genuine curve change)
          + residual                           (contract-specific / noise)
```

Show this stacked per contract on the Market Analysis screen. This is the "separate roll-down from genuine change" requirement.

### 4.4 Pair construction

Pairs (A vs B), lot ratio for equal grams:

| Pair id | A | B | Expiry rule | Lots A : B (grams) |
|---|---|---|---|---|
| `GUINEA_PETAL` | GOLDGUINEA | GOLDPETAL | same expiry | 1 : 8 (8 g) |
| `TEN_PETAL` | GOLDTEN | GOLDPETAL | same expiry | 1 : 10 (10 g) |
| `GUINEA_TEN` | GOLDGUINEA | GOLDTEN | same expiry | 5 : 4 (40 g) |
| `M_PETAL` | GOLDM | GOLDPETAL | nearest, \|T_A − T_B\| ≤ 25 days | 1 : 100 (100 g) |
| `M_TEN` | GOLDM | GOLDTEN | nearest, \|T_A − T_B\| ≤ 25 days | 1 : 10 (100 g) |
| `M_GUINEA` | GOLDM | GOLDGUINEA | nearest, \|T_A − T_B\| ≤ 25 days | 2 : 25 (200 g) |

On each date t, among all eligible contract combinations where neither leg is a `no_trade_day`, choose the one with the **highest min(OI_A, OI_B) as of t−1** (not t — avoids look-ahead). Store which (expiry_A, expiry_B) was chosen; set `roll_flag = true` on dates where the choice changed.

Spread:

```
gap_days   = expiry_A − expiry_B            (0 for same-expiry pairs)
spread_bps = (px_A / px_B − 1 − c_t × gap_days / 365) × 10,000
```

The carry term removes the mechanical difference between expiries (e.g. GOLDM expiring ~5 days after GOLDPETAL).

Note: GOLDM is 995 and the others 999; equal-gram lots leave a 0.4% residual gold exposure. It is captured in the gold bucket of attribution (5.8), not ignored.

### 4.5 Rolling z-score (point-in-time)

```
mu_t = mean(spread_{t−W} … spread_{t−1})
sd_t = std (spread_{t−W} … spread_{t−1})
z_t  = (spread_t − mu_t) / sd_t
```

The window counts observations of the pair series (not calendar days) and **excludes day t**. Require ≥ W prior observations, else z = null. If a future data file has holes, reset the window when two consecutive observations are > 10 calendar days apart (the current file has none). W is chosen from {10, 20, 30} on Train (5.1); 60 is longer than one contract's liquid life.

Also report, per pair, an empirical z histogram and percentile of current z (not a fitted Gaussian curve).

---

## 5. Strategy and walk-forward backtest

### 5.1 Time split (frozen before testing)

| Segment | Dates | Use |
|---|---|---|
| Train / tune | 2023-10-10 → 2025-09-30 | Pick parameters (GOLDTEN pairs only have Apr–Sep 2025 here) |
| Test (unseen) | 2025-10-01 → 2026-09-30 | Report headline results — 12 months, parameters frozen |

A trade belongs to the segment of its entry date. z-scores are computed on the full series (they only use the past), so the Test segment needs no warm-up gap.

Parameter grid (tune on Train by total net ₹ at the base cost scenario, chosen separately per pair): W ∈ {10, 20, 30}, z_entry ∈ {1.5, 2.0, 2.5}, z_exit = 0.5, max_hold ∈ {5, 10} days. **Show the whole grid's Train and Test results in a table** so judges can see nothing was cherry-picked.

### 5.2 Entry (decided at close of t)

All must hold:
- |z_t| ≥ z_entry
- both legs: not `no_trade_day`, `volume_lots ≥ 25`, `OI ≥ 50` on t
- both legs: ≥ 7 trading days to expiry (keeps entry outside the delivery/tender window)
- not a `roll_flag` day
- no open position in this pair

Direction: z > 0 (A rich) → short A, long B. z < 0 → long A, short B.

### 5.3 Exit (decided at close of k)

First of:
- |z_k| ≤ z_exit (reversion)
- |z_k| ≥ z_entry + 1.5 (stop)
- held max_hold trading days
- either leg ≤ 4 trading days to expiry (forced exit before broker square-off / tender — config `TENDER_BUFFER_TD = 4`, see 2.3)
- the position's contracts are no longer the chosen pair (roll) — exit, do not roll

Positions are held in **specific contracts** (symbol, expiry). P&L always uses those contracts' own prices, never the pair series.

### 5.4 Sizing

One "unit" = the lot ratio in 4.4 (equal grams). Trade `units = max(1, round(NOTIONAL_PER_LEG / (unit_grams × px_per_g_pure_A)))` with `NOTIONAL_PER_LEG = ₹10,00,000` (config), so flat brokerage does not dominate small pairs. Capacity check (display only): flag trades where lots exceed 5% of the thinner leg's `volume_lots` on signal day. Report notional per trade in ₹.

### 5.5 Execution (no look-ahead)

Signal at close t → fill at **close t+1** of the same contracts, then apply slippage. Exit signal at close k → fill at close k+1 (if k+1 is a `no_trade_day` for either leg, exit at close k). If t+1 is a `no_trade_day` for either leg, skip the trade.

### 5.6 Look-ahead checklist (build a test for each)

- z uses only t−1 and earlier (shifted window)
- pair selection uses t−1 OI
- parameters chosen on Train only, frozen for Test
- fills at t+1
- carry `c_t` forward-filled only

### 5.7 Cost model (config, per leg, per side)

| Item | Default | Applied |
|---|---|---|
| Brokerage | ₹20 per order | each order |
| Exchange transaction charge | 0.0021% of notional (confirm current MCX rate) | both sides |
| SEBI fee | ₹10 per crore | both sides |
| CTT | 0.01% | sell side |
| Stamp duty | 0.002% | buy side |
| GST | 18% on brokerage + exchange + SEBI | |
| Slippage | scenario: 0 / 2 / 5 / 10 bps of notional; ×3 if the leg is `is_thin` on the fill day | both sides |

Base scenario for headline = 5 bps. Show all four scenarios in a cost stress table, plus the **break-even slippage** (bps at which total net P&L = 0).

### 5.8 P&L and attribution (in ₹)

Daily mark-to-market per open position:

```
leg_pnl = side × lots × (lot_grams / quote_grams) × (close_t − close_{t−1})
total   = Σ legs
gold    = net_pure_grams × (ref_px_per_g_pure_t − ref_px_per_g_pure_{t−1})
          where net_pure_grams = Σ side × lots × lot_grams × purity
          and ref = leg B's contract (the same contract the position holds)
spread  = total − gold
net     = spread + gold − costs (costs booked on fill days)
```

Report per trade and aggregated: spread P&L, gold P&L, costs, net. Plus over the test period: correlation and beta of daily strategy returns vs daily gold returns (ref series). Expect both near 0.

Metrics: trades, hit rate, mean/median net bps per trade, total net ₹, max drawdown, average holding days. Show Sharpe only if trades ≥ 20; otherwise show "n/a (too few trades)". Also a simple significance check: t-stat of per-trade net bps and a bootstrap 95% CI.

---

## 6. Alert logic ("quiet is a feature")

Evaluated on the latest date in the data (currently 2026-09-30). For each pair, compute gates:

| Gate | Pass condition |
|---|---|
| Enough history | ≥ W prior observations in current segment |
| Extreme | \|z\| ≥ z_entry (frozen) |
| Edge beats cost | \|spread − mu\| ≥ 2 × round-trip cost bps (base scenario) |
| Liquidity | both legs volume ≥ 25 lots and OI ≥ 50, not thin |
| Lifecycle | both legs ≥ 7 trading days to expiry, not a roll day |

Status: `SIGNAL` only if all pass; otherwise `QUIET` with the list of failed gates (e.g. "Quiet — z −2.14 passes, but deviation 36 bps < 2 × round-trip cost 24 bps"). The Overview headline is "No meaningful signal today" when every pair is QUIET.

Expected result on 2026-09-30 with the Train-chosen parameters (reference): **all six pairs QUIET.**

| Pair | Contracts | Spread | Rolling mean | z / needed | Failed gates |
|---|---|---|---|---|---|
| GOLDM−GOLDPETAL | Nov-26 / Oct-26 | −46.8 | −11.0 | −2.14 / 2.0 | edge (36 bps < 2 × 24) |
| GOLDM−GOLDGUINEA | Nov-26 / Oct-26 | −52.1 | −18.4 | −1.95 / 2.5 | extreme, edge, lifecycle (roll day) |
| GOLDM−GOLDTEN | Nov-26 / Oct-26 | −5.9 | +15.4 | −2.39 / 2.5 | extreme, edge |
| GOLDGUINEA−GOLDTEN | Oct-26 / Oct-26 | +46.3 | +32.7 | +1.80 / 2.5 | extreme, edge |
| GOLDTEN−GOLDPETAL | Oct-26 / Oct-26 | −40.8 | −28.8 | −1.45 / 2.0 | extreme, edge |
| GOLDGUINEA−GOLDPETAL | Oct-26 / Oct-26 | +5.3 | +3.6 | +0.41 / 2.5 | extreme, edge |

Round-trip cost here = statutory costs + 5 bps slippage per leg per side, both legs, on ₹10 lakh notional ≈ 24.4 bps.

Trading days to expiry: count trading dates present in the data; for dates beyond the last data date, count weekdays (`numpy.busday_count`). Do not let future expiries collapse to 0.

---

## 7. Contract lifecycle

From `contract_calendar.csv` (recompute in the pipeline): `first_seen`, `liquid_from` (first date OI ≥ 25% of that contract's peak OI), `peak_oi`, `peak_oi_date`, `last_seen`, entry-allowed window (liquid_from → expiry − 7 TD), forced-exit date (expiry − 4 TD). Show a Gantt-style timeline with every backtest entry/exit plotted on it; a test asserts every trade falls inside its window.

---

## 8. Architecture — a static website (no live server)

The site is deployed as a **Render Static Site**, not a Web Service, so it never shows a spin-down loading screen. All numbers are precomputed by a Python pipeline and written as JSON files that the frontend reads. There is **no FastAPI / no server at runtime**.

```
gold-rv/
├── SPEC.md
├── data/
│   └── raw/                  # gold_bhavcopy_clean.csv, contract_calendar.csv
├── reference/                # reference_check.py + its CSV outputs (read-only)
├── pipeline/                 # Python, run locally, never deployed
│   ├── config.py             # contract master, costs, params, dates
│   ├── load.py               # read CSV (+ optional raw .xls parser, 2.4)
│   ├── normalize.py          # 4.1
│   ├── carry.py              # 4.2, 4.3
│   ├── pairs.py              # 4.4, 4.5
│   ├── backtest.py           # 5.x
│   ├── attribution.py        # 5.8
│   ├── alerts.py             # 6
│   ├── lifecycle.py          # 7
│   ├── build_site_data.py    # runs everything, writes frontend/public/data/*.json
│   └── tests/                # Section 12
└── frontend/                 # React + Vite + Tailwind + Recharts (static build)
    ├── public/data/          # JSON written by the pipeline — COMMITTED to git
    ├── tailwind.config.js    # tokens copied from Stitch code.html
    └── src/pages/{Overview,MarketAnalysis,Signals,Backtesting,Methodology}.tsx
```

Pipeline: Python 3.11+, pandas, numpy, scipy, pytest. Frontend: React, Vite, Tailwind, Recharts. Use a hash router (`HashRouter`) so page refreshes work on a static host.

Workflow: `python -m pipeline.build_site_data` → JSON lands in `frontend/public/data/` → `cd frontend && npm run dev` to view locally → commit the JSON with the code. Every interactive control (pair selector, cost scenario 0/2/5/10 bps, parameter grid) switches between precomputed files; nothing is computed in the browser except formatting and chart rendering.

### 8.1 Data files (replace an API)

All under `frontend/public/data/`, fetched with `fetch('data/...')`:

| File | Contents |
|---|---|
| `meta.json` | coverage dates, row/contract counts, no-trade/thin counts, weekend sessions, manual cross-check (5,666 rows, 0 mismatches), last date, build time |
| `contracts.json` | contract master + lifecycle table (Section 7) |
| `prices/{SYMBOL}.json` | per contract: date, close, px_per_g_pure, volume, oi, flags |
| `curve.json` | per date (weekly sample is fine) and symbol: expiry, px_per_g_pure, days_to_expiry, implied carry; daily reference carry series |
| `carry_decomposition/{SYMBOL}.json` | per contract: date, gold, rolldown, curve, residual (4.3) |
| `pairs.json` | scanner: for each pair the latest spread bps & ₹/10g, mu, sd, z, percentile, status, failed gates |
| `pairs/{PAIR_ID}.json` | date, expiry_A, expiry_B, spread_bps, mu, sd, z, roll_flag, segment |
| `signals_today.json` | Section 6 output for the last date |
| `signals_history.json` | every historical gate-passing day with outcome |
| `backtest/{PAIR_ID}_{SLIP}.json` | SLIP ∈ {0,2,5,10}: params, metrics, equity curve with segment, trades, attribution |
| `backtest/cost_matrix.json`, `backtest/grid.json` | cost stress table with break-even slippage; full parameter grid Train vs Test |
| `methodology.json` | pipeline stages, split dates, limitations, honest-conclusion text built from results |

Keep the total under ~10 MB (round floats to 4 decimals; prices can be sampled weekly for the long-history charts).

### 8.2 Deploying on Render (Static Site)

- Push the repo to GitHub (including `frontend/public/data/`).
- Render → New → **Static Site** (not Web Service) → connect the repo.
- Root directory: `frontend` · Build command: `npm install && npm run build` · Publish directory: `dist`.
- The site updates whenever new JSON is committed. To refresh data: re-run the pipeline locally, commit, push.

---

## 9. Design system

Use the YAML front-matter tokens in `DESIGN.md` (these are what the screens' Tailwind config uses). Ignore the different hex values in the prose part of DESIGN.md.

- Background/surface `#051424`; containers `#0d1c2d` / `#122131` / `#1c2b3c` / `#273647`
- Primary (gold) `#ffc174`, primary-container `#f59e0b`; secondary (positive) `#4edea3`; tertiary (negative) `#ffbcb7` / `#ff938c`
- Text `#d4e4fa`, muted `#d8c3ad`, outline `#a08e7a` / `#534434`
- Fonts: Inter (UI), JetBrains Mono with `tabular-nums` (all numbers); Material Symbols Outlined icons
- Radius 4px; 4px spacing grid; dense layout

Copy the `tailwind.config` block from `design/.../overview/code.html` verbatim.

---

## 10. Screens

### 10.1 Which Stitch files to use

The export has two generations of screens. Use the **"MCX GOLD RELATIVE-VALUE INTELLIGENCE PLATFORM" shell** from `overview` and `market_analysis` (left nav: 01 Overview … 05 Data & Methodology) for all five pages. Borrow panel layouts from the other files, restyled into that shell.

| Page | Base file | Borrow panels from |
|---|---|---|
| 01 Overview | `overview` | — |
| 02 Market Analysis | `market_analysis` | — |
| 03 Signals | `rv_signal_analysis` | `executive_rv_analytics` (pair header cards) |
| 04 Backtesting | `strategy_backtesting` | — |
| 05 Data & Methodology | `data_and_methodology` | — |

Not used: `gold_intelligence_terminal_dashboard`, `detailed_rv_analytics` (intraday/order-book terminal). Logo: `gold_intelligence_terminal_logo`.

### 10.2 Remove everywhere (Bhavcopy has no such data — showing it would be fabricated)

- Top "MCX BULLION TAPE" with GOLD 1KG, SILVER, USD/INR, COMEX, Gold/Silver ratio → replace with the 4 symbols' latest EOD close and day change
- "LIVE", millisecond IST clock, latency "12ms", WebSocket feed, "256-bit SSL", Margin util, Risk status, Margin available, Unhedged exposure
- Order book, bid/ask, depth, "Top 5 bid-ask depth", "Executed fill rate"
- Anything intraday: 1-min ticks, "4.88M records", hours/minutes holding times, "23:15 IST flatten", VWAP
- "Confidence 91%", "Model conviction 88/100", Monte Carlo probabilities (72%/22%/6%), "Audit grade A+", "ISO 8000", SHA-256 checksum, Hampel filter, "1.24 GB parquet"
- Any pair with GOLD (1 kg) — not in our universe
- "DEMO DATA / Illustrative" badges → "Source: MCX Bhavcopy (EOD) · Data to 30-Sep-2026"
- **Wrong normalization on the mock Overview** ("₹71,480/10g → ₹7,148/1g" ignores purity, and those prices are not real). Use 4.1.

### 10.3 Page-by-page mapping

**01 Overview** (`overview`)
- Q1 cards: pick the pair with the highest |z| today. Leg cards show quoted close, unit, normalized ₹/g pure and ₹/10g pure, expiry, OI. Third card: spread in bps and ₹/10g, rolling mean.
- Q2 "Is the relationship unusual?": z, threshold, the gate checklist from Section 6. When quiet, the orange "SIGNAL DETECTED" badge becomes a grey "QUIET" badge with reasons.
- Q3 "What historical evidence exists?": computed from history — count of past gate-passing events for this pair, how many reverted to |z| ≤ 0.5, median days to revert (days, not hours).
- Divergence chart: last 30 observations of spread_bps with mu and ±z_entry·sd bands.
- Scanner matrix: all 6 pairs from `pairs.json`, with status and failed gates; liquidity column from real volume/OI.
- Q4 costs & risks: round-trip cost bps (base), expected edge, edge/cost ratio, stop level — all computed.
- Keep the disclaimer.

**02 Market Analysis** (`market_analysis`)
- Specification table from contract master (correct purities and expiry windows).
- "Why normalization is required" box: show 4.1 with a live worked example from the latest date.
- Normalized price chart: all four symbols' chosen contracts in ₹/10g pure.
- Regime panel: quarterly mean spread per pair (Section 3 table), highlighting the GOLDPETAL structural break (Dec-24 → Mar-25) and the Jan-2026 crash quarter.
- Liquidity structure: volume and OI share by symbol (grams-equivalent), real.
- Spread dynamics + z distribution: empirical histogram with current percentile.
- Historical similarity → "Past episodes" table: date, peak z, spread, days to revert, outcome. No invented macro "context" column.
- Term structure & carry: curve per symbol on a chosen date, implied carry (expect ~5%), and the 4.3 decomposition chart. Remove "ADF" unless actually computed with statsmodels on Train data.

**03 Signals** (`rv_signal_analysis`)
- Header toggle "Active / Quiet" reflects real status of the selected pair.
- Edge cards: gross edge bps, cost bps, net edge bps, edge/cost — computed.
- Replace the execution/depth table with "Liquidity check (EOD)": volume, OI, thin flag, days to expiry, per leg.
- Replace the Monte Carlo section with a "Scenario on history" panel: of past similar signals, % reverted / stopped / timed out (computed counts).
- Pipeline progression → Gate checklist (5 gates, pass/fail).
- Signal log and calendar heatmap from `signals_history.json`, dates only.

**04 Backtesting** (`strategy_backtesting`)
- Parameter bar shows frozen params and the split dates; preset buttons switch pair and cost scenario.
- KPI row: trades, gross, costs, net (₹ and bps), hit rate, max DD, avg holding days, Sharpe or "n/a (too few trades)", t-stat and bootstrap CI.
- Equity curve with Train / Test shaded differently; mark the Jan-2026 crash week.
- Benchmark attribution panel: spread P&L vs gold P&L vs costs, correlation and beta to gold.
- Alpha retention waterfall: gross → statutory costs → slippage → net.
- Cost stress matrix: 0/2/5/10 bps rows + break-even slippage.
- Trade blotter: entry/exit dates, contracts (symbol + expiry), direction, entry/exit z, spread change, gross, costs, net, exit reason.
- Add: parameter grid table (all combos, Train vs Test).

**05 Data & Methodology** (`data_and_methodology`)
- Provenance: source (MCX Bhavcopy API), 138 contracts, 11,954 rows, 768 trading dates, 0 duplicates, 183 no-trade rows, 835 thin rows, 3 weekend sessions, cross-check against manual downloads — all from `meta.json`.
- Contract master + lifecycle Gantt (Section 7).
- Pipeline stages (real ones): load → validate → normalize → carry → pair → z-score → gates → backtest → attribution.
- Walk-forward segmentation bar with the real dates of 5.1.
- Point-in-time rules (5.6).
- Limitations: close ≠ fill; volume ≠ depth; GOLDTEN only from 31-Mar-2025; 6–16 test trades per pair; GOLDPETAL structural break of unknown cause; results depend on one crisis week; cost rates to be confirmed against MCX.
- Honest conclusion box, filled from backtest results (expected: "No persistent edge survives costs"; show break-even slippage per pair).

---

## 11. Build order for Antigravity

1. Scaffold folders (Section 8); `config.py` with contract master, costs, params, split dates.
2. `pipeline/load.py` + `normalize.py`; pass fixture test 4.1.
3. `carry.py` (4.2, 4.3); pass carry sanity test.
4. `pairs.py` (4.4, 4.5); pass look-ahead tests.
5. `backtest.py` + `attribution.py` (5.x); reproduce `reference/reference_summary.csv` (Section 12).
6. `alerts.py` + `lifecycle.py` (6, 7).
7. `pipeline/build_site_data.py` writes every JSON file in Section 8.1 into `frontend/public/data/`.
8. Frontend shell from Stitch (tokens, fonts, nav, HashRouter); then pages 01 → 05, each reading its JSON files. Apply Section 10.2 removals.
9. README: how to run (`python -m pipeline.build_site_data`, then `cd frontend && npm install && npm run dev`), how to deploy (8.2), findings, limitations.
10. Deploy to Render as a Static Site (8.2).

---

## 12. Acceptance tests (pytest)

- Normalization fixtures in 4.1 match to 0.01.
- `volume_grams / volume_lots` equals lot_grams for every traded row.
- No duplicate primary keys; no row with `no_trade_day` used for a signal or fill.
- GOLDPETAL median implied carry between 3% and 12% (reference: 8.0%).
- z at t is unchanged if all data after t is deleted (look-ahead test: recompute on truncated data and compare).
- Pair selection at t is unchanged if data after t is deleted.
- Every trade's entry and exit lie inside its contracts' lifecycle windows (Section 7).
- Every fill date is strictly after its signal date.
- With slippage = 0, per-trade gross P&L equals sum of leg P&Ls computed from the contracts' own closes.
- Attribution: spread + gold − costs = net, to the rupee.
- Alerts on 2026-09-30: all six pairs QUIET with the failed gates listed in Section 6.
- Backend reproduces `reference/reference_summary.csv` (trade counts exact; mean bps within ±1).
- Frontend: grep build output for "71,480", "COMEX", "USD/INR", "Confidence", "Monte Carlo" → zero hits.

---

## 13. Do not

- Build a continuous near-month price series.
- Compare raw prices without 4.1.
- Assume normalized prices should be equal (they are not; see Section 3).
- Use day t in its own z-score, or fill at the signal day's close.
- Treat volume as depth, or close as a guaranteed fill.
- Report Sharpe on a handful of trades.
- Show any number in the UI that the pipeline did not compute.
- Add a server (FastAPI/Flask/Express) or deploy as a Render Web Service.
