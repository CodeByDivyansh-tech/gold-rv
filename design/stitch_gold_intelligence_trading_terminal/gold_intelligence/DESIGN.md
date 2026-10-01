---
name: Gold Intelligence
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffbcb7'
  on-tertiary: '#68000a'
  tertiary-container: '#ff938c'
  on-tertiary-container: '#8d0012'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  data-mono-xl:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.02em
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.01em
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  data-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.25rem
  gutter-compact: 0.125rem
  margin: 0.5rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system delivers an institutional-grade, high-density analytical terminal interface engineered specifically for precision bullion derivatives, MCX Gold futures (GOLD, GOLDM, GUINEA, PETAL), and macro commodity desk traders. 

The aesthetic is rooted in modern financial brutalism combined with high-contrast data minimalism: razor-sharp boundaries, dark obsidian depth, zero decorative fluff, and maximum screen real estate utilization. The emotional response is one of surgical authority, split-second clarity, and elite execution readiness under market volatility. 

Visual priority is strictly anchored to live price action, liquidity shifts, and predictive algorithmic indicators. Rather than soft decorative layers, the interface treats every pixel as operational utility, pairing luminous metallic amber accents with sharp terminal borders and reactive tabular data.

## Colors

The color architecture is built for persistent screen endurance under dark ambient trading desk conditions while ensuring uncompromised contrast compliance for high-velocity delta changes.

- **Primary Accent (Gold Bullion)**: `#F59E0B` serves as the primary action and benchmark hue, supported by `#FCD34D` for active hover/focus states and `#B45309` for structural indicators. Used exclusively for contract tickers, key execution buttons, gold benchmark prices, and active tracking tabs.
- **Secondary (Bulls / Bids / Longs)**: Crisp cyan-emerald (`#10B981` core, `#2DD4BF` highlight, `#064E3B` container tint) signifies upward ticks, bid dominance, buy-side liquidity, and positive RSI divergence.
- **Tertiary (Bears / Asks / Shorts)**: Crimson-coral (`#EF4444` core, `#F87171` highlight, `#450A0A` container tint) handles downward ticks, ask dominance, sell-side orders, and stop-loss thresholds.
- **Neutrals & Surfaces**: 
  - Base Obsidian Canvas: `#0B0F17` (Canvas base) and `#0E131F` (Viewport floor).
  - Raised Containers: `#141B2D` (Primary Card), `#1A2238` (Elevated/Hovered state), and `#222F4C` (Hard structural 1px dividing borders).
- **Text & Readout Tokens**:
  - Primary text: `#F1F5F9` (96% contrast for fast legibility).
  - Secondary text: `#94A3B8` (Column keys, lot sizes, contract expiries).
  - Tertiary text: `#64748B` (Inactive states, table gridlines, static timestamp markers).

## Typography

Typography enforces a strict dual-engine rule:

1. **System Interface & Metadata (Inter)**: Handles shell navigation, panel headers, tooltips, dialogs, and contract metadata. Tight kerning and balanced x-height optimize density without inducing visual fatigue.
2. **Tabular Quant Engine (JetBrains Mono)**: Mandatory for all numerals, ticks, Last Traded Price (LTP), Open Interest (OI), VWAP, Greeks, Bid/Ask spreads, and timestamps. `font-variant-numeric: tabular-nums` must be enabled across all numerical outputs to guarantee absolute spatial stability when values flash in real-time.

Headlines are intentionally constrained in scale (peaking at 24px) to retain maximum screen utility for multidimensional workspace tiling.

## Layout & Spacing

This design system uses an edge-to-edge, multi-window financial workspace model based on a CSS Grid layout with zero wasted peripheral deadspace. 

- **Layout Grid**: 12 or 24-column layout engines configured for modular pane dockers (Order Book, Tick Chart, Depth Ladder, Technical Matrix, Blotter).
- **Rhythm & Metrics**: Built on a tight 4px base increment. Gutters between analytical modules default to `0.25rem` (4px), creating hairline divisional seams that preserve modular separation without sacrificing data real estate.
- **Adaptive Breakpoints**:
  - **Desktop Multi-Monitor / Ultra-Wide (>= 1440px)**: 4-pane simultaneous view (Chart, Order Book & Tape, Option Chain / Analytics, Blotter).
  - **Standard Desktop / Laptop (1024px - 1439px)**: 3-pane layout; blotter tabbed at bottom dock with auto-hide.
  - **Mobile / Companion Terminal (< 1024px)**: Single-pane priority viewport with sticky top-bar ticker tape, swipeable contract cards, and bottom dock execution trigger.

## Elevation & Depth

Visual hierarchy uses tonal surface layering combined with razor-thin structural borders rather than heavy ambient blur:

- **Level 0 (Canvas Base)**: `#0B0F17` - Terminal foundation, inactive window dock.
- **Level 1 (Module Tile)**: `#141B2D` framed by a continuous `1px solid #222F4C` border. Inset shadow: `inset 0 1px 0 rgba(255, 255, 255, 0.03)`.
- **Level 2 (Active/Hover/Interacting Element)**: `#1A2238` with `border: 1px solid #3B4E75` and shadow: `0 4px 12px rgba(0, 0, 0, 0.45)`.
- **Level 3 (Overlays, Contextual Tooltips & Menus)**: `#141B2D` with subtle glassmorphic backdrop filter (`backdrop-filter: blur(8px)`) and a subtle gold ambient perimeter `0 8px 24px rgba(11, 15, 23, 0.85), 0 0 1px #F59E0B`.
- **Tick Flash Feedback**: Real-time price flashes utilize zero elevation offset, relying strictly on a 150ms instantaneous CSS background pulse (`rgba(16, 185, 129, 0.2)` for upticks, `rgba(239, 68, 68, 0.2)` for downticks).

## Shapes

The interface embraces an engineered, industrial geometric aesthetic. Shape curvature is minimized to keep data alignment precise:

- Standard controls, tabular row selectors, inputs, and analytical modules utilize a compact `0.25rem` (4px) corner radius.
- System-wide utility tags and contract pills (e.g., `MCX: GOLD 05JUN24`) maintain `0.25rem` (4px) to retain maximum horizontal label length.
- Action icons and standalone mini-toggles use `0.125rem` (2px) or sharp `0px` bevels within order matrices to mimic physical hardware execution consoles.

## Components

### 1. Buttons & Execution Triggers
- **Primary Order Buy / Long**: Background `#10B981`, foreground `#0B0F17` font bold `Inter 12px`, padding `6px 12px`, radius 4px. Hover: `#14B8A6`.
- **Primary Order Sell / Short**: Background `#EF4444`, foreground `#FFFFFF` font bold `Inter 12px`, padding `6px 12px`, radius 4px. Hover: `#DC2626`.
- **Terminal System Buttons**: Background `#1A2238`, border `1px solid #222F4C`, text `#F1F5F9`. Hover: border `#F59E0B`, text `#F59E0B`.

### 2. Tickers & Real-Time Status Chips
- Pulsing status badges feature a live ping dot (`w-1.5 h-1.5 rounded-full`) paired with JetBrains Mono readouts.
- Bullion Contract Chips: Dark slate capsule `#141B2D`, `1px solid #222F4C`, featuring amber gold asset highlights (`#F59E0B`) for commodity symbols.

### 3. Order Book & Market Depth Ladder
- Dual-sided stacked columns showing Bid Size, Bid Price, Ask Price, Ask Size.
- Dynamic horizontal background depth bars using alpha fills (`rgba(16, 185, 129, 0.12)` for bids, `rgba(239, 68, 68, 0.12)` for asks).
- Zero vertical margins between rows; fixed height `20px` per row for instantaneous eye scanning.

### 4. Input Fields (Limit Price / Lot Quantity / Trigger)
- Background `#0E131F`, border `1px solid #222F4C`, text `JetBrains Mono 12px #F1F5F9`.
- Stepper triggers (+ / -) embedded directly inside the input bounding box. Focus state creates an amber ring: `1px solid #F59E0B`.

### 5. Cards & Dock Panels
- Pane headers are fixed `28px` height with breadcrumb pathing (`MCX > BULLION > GOLD 1KG`), quick timeframe toggles (`1m`, `5m`, `15m`, `1H`, `1D`), and active stream ping indicator.

### 6. Mini Sparklines & RSI Matrix
- Micro trend graphs embedded directly within watchlist rows: 60px width, 18px height, stroke width `1.5px`, zero fill, with stroke color tracking delta direction (`#10B981` or `#EF4444`).