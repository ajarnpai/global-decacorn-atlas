# Refinitiv Dashboard Redesign — Design Spec

## Overview

Redesign the Refinitiv Financial Dashboard from an FT-inspired Dash app with 3 tabs to a modern, light-minimal dashboard with a slate blue-grey-black palette, KPI summary cards, pill-style tabs (2 tabs: bubble chart and industry breakdown), and a footer with data attribution and academic disclaimer.

The data table tab is removed to comply with data agreement constraints.

## Visual System

### Color Palette (Slate)

| Token         | Hex       | Usage                        |
|---------------|-----------|------------------------------|
| `bg`          | `#f8fafc` | Page background              |
| `card`        | `#ffffff` | Card/panel backgrounds       |
| `border`      | `#e2e8f0` | Borders, dividers            |
| `subtle-bg`   | `#f1f5f9` | Tab container, KPI card bg   |
| `text`        | `#0f172a` | Primary text                 |
| `text-secondary` | `#64748b` | Labels, secondary text    |
| `text-muted`  | `#94a3b8` | Footer, disclaimer           |
| `accent`      | `#334155` | Active tab, accents          |
| `positive`    | `#059669` | Positive values              |
| `negative`    | `#dc2626` | Negative values              |

### Typography

- **Font**: Inter via Google Fonts CDN: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
- **Fallback**: `-apple-system, system-ui, sans-serif`
- **Title**: 22px, weight 700, color `text`
- **Subtitle**: 13px, weight 400, color `text-secondary`
- **KPI value**: 24px, weight 700
- **KPI label**: 11px, weight 500, uppercase, letter-spacing 0.05em
- **Tab text**: 13px, weight 500 (inactive), 600 (active)
- **Footer**: 12px, weight 400, color `text-muted`

The font is loaded via the `external_stylesheets` parameter of the `dash.Dash()` constructor.

### Surfaces & Depth

- **Card shadow**: `0 1px 3px rgba(0,0,0,0.06)`
- **Card border**: `1px solid #e2e8f0`
- **Card radius**: `10px`
- **Inner element radius**: `8px` (dropdowns, tabs, KPI cards)
- **Spacing grid**: `24px` gaps, `20px` card padding

## Layout Structure

```
┌──────────────────────────────────────────────────┐
│  ●  Refinitiv Analytics                          │  ← header
│     Global equity data · GICS classification     │
├──────────────────────────────────────────────────┤
│  [Total Mkt Cap] [Avg YTD] [Instruments] [Top]  │  ← KPI row
├──────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐     │
│  │ [● Bubble Chart] [ Industry Breakdown ] │     │  ← pill tabs
│  └─────────────────────────────────────────┘     │
├──────────────────────────────────────────────────┤
│  Filter controls (dropdown in card)              │
├──────────────────────────────────────────────────┤
│  Chart area (full width, white card)             │
├──────────────────────────────────────────────────┤
│  Data: Refinitiv (LSEG) · For academic use only  │  ← footer
└──────────────────────────────────────────────────┘
```

- Max content width: `1400px`, centered
- Page padding: `24px 32px`
- Single-column, responsive

## Components

### Header

- Small colored dot (`#334155`) + title "Refinitiv Analytics" in 22px bold
- Subtitle: "Global equity data · GICS industry classification" (no hardcoded count)
- Bottom border: `1px solid #e2e8f0`

### KPI Cards (4-column row)

**Static computation**: KPI values are computed once at layout render time from the full unfiltered dataframe. They are global summary stats and do NOT react to tab filters. This keeps the implementation simple — no callback wiring needed for KPIs.

Computed from `get_dataframe()`:

1. **Total Market Cap** — `df[Market Cap].sum()`, formatted `$X.XT` (trillions)
2. **Avg YTD Change** — `df[YTD].mean()`, formatted `+X.X%`, colored green/red
3. **Instruments** — `len(df)`, formatted with comma separator
4. **Top Industry** — GICS Industry with highest mean YTD, show name + `+X.X%`

Each card:
- Background: `linear-gradient(135deg, #f8fafc, #f1f5f9)`
- Border: `1px solid #e2e8f0`, radius `8px`
- Padding: `16px`
- Label on top (small, uppercase, `text-secondary`), value below (large, bold)
- Hover: slight shadow lift via CSS transition

### Pill Tabs

- Container: `#f1f5f9` background, `8px` radius, `3px` padding
- Active pill: white background, `box-shadow: 0 1px 2px rgba(0,0,0,0.06)`, `text` color, weight 600
- Inactive: transparent, `text-secondary` color
- CSS transition: `background 0.2s, color 0.2s, box-shadow 0.2s`
- Two tabs: "Bubble Chart", "Industry Breakdown" (renamed from "Bar Chart")

**Implementation**: Dash `dcc.Tabs` with `className`, `parent_className`, and `selected_className` props. The `parent_className` on `dcc.Tabs` is needed to override Dash's default tab container chrome (bottom border, ink bar). All default Dash tab styling must be neutralized via CSS.

### Filter Controls

- Dropdown in a card container
- Same card styling as chart container
- Label above: small uppercase text
- Bubble tab: multi-select GICS Industry filter
- Bar tab: metric selector dropdown

### Charts (Plotly)

Both charts rendered in white card containers.

**Bubble Chart:**
- X: Price to Book Ratio, Y: YTD Price Change (%)
- Bubble size: log-scaled Market Cap
- Color: GICS Industry (slate-based qualitative palette)
- Hover: Issuer, RIC, Exchange, Market Cap
- Outlier removal on both axes
- Zero line: dotted, `#e2e8f0`

**Bar Chart (Industry Breakdown):**
- Metric selector: YTD Change, 1Y Change, Avg Market Cap
- Grouped by GICS Industry, sorted descending
- Green/red coloring based on positive/negative
- Zero line: dotted, `#e2e8f0`

**Plotly theming (both):**
- `paper_bgcolor`: `#ffffff`
- `plot_bgcolor`: `#ffffff`
- `font.family`: Inter, system-ui, sans-serif
- `font.color`: `#0f172a`
- `gridcolor`: `#f1f5f9`
- `linecolor`: `#e2e8f0`

**Chart color sequence (slate qualitative):**
```
#334155, #0ea5e9, #6366f1, #8b5cf6, #ec4899, #f59e0b,
#059669, #64748b, #dc2626, #0d9488, #7c3aed, #d97706,
#2563eb, #475569, #be185d, #0891b2, #4f46e5, #78716c
```

### Footer

- Top border: `1px solid #e2e8f0`
- Padding: `16px 0`
- Two lines, centered, `12px`, color `#94a3b8`:
  - "Data: Refinitiv (LSEG) — Global equity instruments, GICS classification"
  - "For academic illustration only. Not investment advice."

## Files

### Modified: `app/dashboard.py`

Full rewrite:
- Replace FT palette constants with slate palette
- Remove data table tab, `_table_layout()` function, and `dash_table` import
- Remove unused column constants: `VS_INDEX`, `VS_SECTOR`
- Add KPI card computation and layout
- Rename "Bar Chart" tab to "Industry Breakdown"
- Switch from inline `style={}` dicts to `className` props
- Update Plotly figure theming
- Add footer component
- Load Inter font via `external_stylesheets` in `dash.Dash()` constructor

### New: `app/assets/style.css`

Create `app/assets/` directory. Dash auto-serves files from `assets/` relative to the app module. Since the Dash app is mounted via WSGIMiddleware at `/dashboard`, asset serving uses the `requests_pathname_prefix` already set to `/dashboard/`. Dash resolves assets to `/dashboard/assets/style.css` automatically — no additional configuration needed.

Contains:
- CSS custom properties for the palette
- `.dashboard` page container
- `.header` styling
- `.kpi-row` and `.kpi-card` with hover effect
- Tab overrides: neutralize Dash default tab chrome, apply pill styling
- `.filter-card` for dropdown containers
- `.chart-card` for chart containers
- `.footer` styling
- Dropdown overrides for Dash's default dropdown styling
- Responsive breakpoints (stack KPI cards on mobile)

### Unchanged: `app/data.py`, `app/main.py`

No modifications needed.

## Edge Cases

- **Empty filter results**: If a filter selection yields zero matching rows, the chart displays Plotly's default empty state (blank axes). No custom empty-state UI needed — the user can clear the filter.
- **Data load**: The dataframe is lazily loaded and cached. If the Excel file is missing, the Python process will raise an exception on first request — this is acceptable for a development/academic tool and does not need a custom error page.

## Out of Scope

- No new Python dependencies
- No React/JS frontend rewrite
- No additional chart types
- No data table view
