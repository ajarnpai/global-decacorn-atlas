# Scrollytelling Redesign — Design Spec

## Overview

Replace the Dash/Plotly dashboard with a scroll-driven visual data journalism piece: "The Global Decacorn Atlas — And the SaaSpocalypse Reshaping It." Built with D3.js + Scrollama, served as static HTML from FastAPI. Four-act narrative with animated transitions between visualizations.

The dataset contains global decacorns ($10B+ market cap) from Refinitiv with GICS industry classification, exchange (maps to geography), market cap, P/B ratio, and price change metrics. Exact count is computed dynamically from the cleaned dataframe.

## Architecture

```
FastAPI (backend)
  GET /             → FileResponse("static/index.html")
  GET /api/data     → pre-computed JSON for all four acts
  GET /api/health   → health check (unchanged)

StaticFiles mounted at /static → serves static/css/, static/js/

Static Frontend (no build step, no framework)
  static/index.html       — scrollytelling page
  static/css/style.css    — all styling
  static/js/main.js       — D3 charts, Scrollama triggers, transitions
```

`GET /` returns `FileResponse("static/index.html")` directly. `StaticFiles` is mounted at `/static` so CSS/JS URLs are `/static/css/style.css` and `/static/js/main.js`. This avoids route conflicts with `/api/*`.

No npm, no bundler. D3 v7, Scrollama, and TopoJSON loaded via CDN.

## Data API

### Endpoint: `GET /api/data`

Single endpoint returns all pre-computed data. Computed server-side from `app/data.py`'s `get_dataframe()`.

### Aggregation Logic

All computations use `get_dataframe()` which returns the cleaned dataframe (NaN rows already dropped by `data.py`).

- **Geography**: Group by exchange → map exchange to country via `exchange_map.py` → group by country → `sum(Market Cap)`, `count()`, `mode(GICS Industry)` for top_industry, sector family derived from top_industry
- **Industries**: Group by `GICS Industry` → `sum(Market Cap)`, `count()`, `mean(% Price Change YTD)` (NaN excluded via pandas default), sector family via lookup
- **Performance**: One row per company — `Issuer`, `GICS Industry`, sector family, `% Price Change YTD`, `% Price Change 1Y`, `Market Cap (USD)`. All 1,943 rows included.
- **SaaSpocalypse**: Filter to hardcoded issuer name lists (see below). Read actual values from dataframe — no rounding, no hardcoded numbers.
- **Meta**: `len(df)` for total instruments, `df[Market Cap].sum() / 1e12` for total cap, `df[YTD].mean()` for avg YTD. All computed dynamically.

### Response Shape

```json
{
  "geography": [
    {
      "country": "United States",
      "code": "US",
      "lat": 37.0,
      "lon": -95.7,
      "count": 642,
      "total_cap": 45200000000000,
      "top_industry": "Software",
      "sector_family": "Technology"
    }
  ],
  "industries": [
    {
      "industry": "Diversified Banks",
      "count": 166,
      "total_cap": 8100000000000,
      "avg_ytd": 3.2,
      "sector_family": "Financials"
    }
  ],
  "performance": [
    {
      "issuer": "Apple Inc",
      "industry": "Technology Hardware",
      "sector_family": "Technology",
      "ytd": 12.3,
      "one_y": 18.5,
      "cap": 3800000000000
    }
  ],
  "saaspocalypse": {
    "losers": [
      {
        "issuer": "Atlassian Corp",
        "ytd": -53.6,
        "cap": 20000000000,
        "trbc_sector": "Software (NEC)",
        "news": "AI agents automate the task tracking Jira was built for"
      }
    ],
    "winners": [
      {
        "issuer": "Hanmi Semiconductor Co Ltd",
        "ytd": 139.8,
        "cap": 20000000000,
        "trbc_sector": "Semiconductor Machinery Manufacturing",
        "news": "Chip packaging demand surges as AI training scales"
      }
    ]
  },
  "meta": {
    "total_instruments": 1943,
    "total_cap_trillions": 109.6,
    "avg_ytd": 5.2,
    "date": "2026-03-16"
  }
}
```

Note: all numeric values in `meta` and `saaspocalypse` are computed from the actual dataframe, not hardcoded. The example values above are illustrative.

### Exchange-to-Country Mapping

Complete lookup dict in `app/exchange_map.py`. Maps all 65 exchange names from the dataset to country, ISO alpha-2 code, and lat/lon centroid. Any unmapped exchange falls back to `{"country": "Other", "code": "XX", "lat": 0, "lon": 0}`.

| Exchange | Country | Code |
|---|---|---|
| NYSE Consolidated | United States | US |
| NASDAQ Global Select Consolidated | United States | US |
| NASDAQ Global Market Consolidated | United States | US |
| NASDAQ Capital Market Consolidated | United States | US |
| NYSE American Consolidated | United States | US |
| Cboe Consolidated | United States | US |
| Shanghai Stock Exchange | China | CN |
| Shenzhen Stock Exchange | China | CN |
| Tokyo Stock Exchange | Japan | JP |
| National Stock Exchange of India | India | IN |
| The Stock Exchange of Hong Kong Ltd | Hong Kong | HK |
| The Toronto Stock Exchange | Canada | CA |
| London Stock Exchange | United Kingdom | GB |
| Euronext Paris | France | FR |
| Euronext Amsterdam | Netherlands | NL |
| Euronext Brussels | Belgium | BE |
| Euronext Lisbon | Portugal | PT |
| Taiwan Stock Exchange | Taiwan | TW |
| Taipei Exchange | Taiwan | TW |
| Xetra | Germany | DE |
| Frankfurt Stock Exchange | Germany | DE |
| Korea Exchange - KSE | South Korea | KR |
| Korea Exchange - KOSDAQ | South Korea | KR |
| SIX Swiss Exchange | Switzerland | CH |
| Australian Stock Exchange Ltd | Australia | AU |
| Singapore Exchange Securities Trading Ltd | Singapore | SG |
| Milan Stock Exchange | Italy | IT |
| BME SPANISH EXCHANGE | Spain | ES |
| OMX Nordic Exchange Stockholm AB - cash | Sweden | SE |
| OMX Nordic Exchange Copenhagen A/S | Denmark | DK |
| OMX Nordic Exchange Helsinki Oy | Finland | FI |
| Oslo Stock Exchange | Norway | NO |
| Vienna Stock Exchange - Cash Market | Austria | AT |
| Warsaw Stock Exchange | Poland | PL |
| Budapest Stock Exchange | Hungary | HU |
| Bucharest Stock Exchange | Romania | RO |
| Athens Stock Exchange | Greece | GR |
| The Irish Stock Exchange | Ireland | IE |
| BORSA ISTANBUL | Turkey | TR |
| Tel Aviv Stock Exchange | Israel | IL |
| Saudi Arabian Stock Exchange | Saudi Arabia | SA |
| Abu Dhabi Stock Exchange | United Arab Emirates | AE |
| Dubai Financial Market | United Arab Emirates | AE |
| QATAR EXCHANGE LEVEL 1 | Qatar | QA |
| Boursa Kuwait | Kuwait | KW |
| Muscat Securities Market | Oman | OM |
| Amman Financial Market | Jordan | JO |
| Johannesburg Stock Exchange | South Africa | ZA |
| Nigerian Stock Exchange | Nigeria | NG |
| Casablanca Stock Exchange | Morocco | MA |
| BM&F Bovespa SA Bolsa de Valores Mercadorias e Futuros | Brazil | BR |
| Bolsa Mexicana de Valores S.A. de C.V. | Mexico | MX |
| Bolsa de Comercio de Buenos Aires | Argentina | AR |
| Bolsa de Comercio de Santiago | Chile | CL |
| Bolsa de Valores de Colombia | Colombia | CO |
| Bolsa de Valores de Lima S.A. | Peru | PE |
| Indonesia Stock Exchange (formerly Jakarta SE) | Indonesia | ID |
| Bursa Malaysia | Malaysia | MY |
| The Stock Exchange of Thailand | Thailand | TH |
| Philippine Stock Exchange, Inc | Philippines | PH |
| PSE CASH MARKET L1 AND L2 | Philippines | PH |
| Hochiminh Stock Exchange | Vietnam | VN |
| New Zealand Stock Exchange | New Zealand | NZ |
| Kazakhstan Stock Exchange | Kazakhstan | KZ |
| Beirut Stock Exchange | Lebanon | LB |

Lat/lon centroids are approximate country centers (e.g., US: 37.0, -95.7; China: 35.0, 105.0). Stored as part of each dict entry.

### Classification System

**GICS Industry** (extracted from GICS Sector path by `data.py`) is the primary classification used throughout:
- Act 2 treemap: grouped by GICS Industry (99 unique values)
- Act 3 swim lanes: grouped by GICS Industry (top 8 by count, rest as "Other")
- Sector family coloring: derived from GICS Industry name via keyword matching

**TRBC Sector** is used only in Act 4 SaaSpocalypse for the granular sector label (e.g., "Enterprise Software", "Cloud Computing Services") since it's more descriptive for individual company context.

### SaaSpocalypse Company Lists

Hardcoded issuer name lists for Act 4, cross-checked against the dataset. Actual YTD/cap values are read from the dataframe at serve time — not hardcoded.

**Losers (SaaS casualties, all confirmed in data):**
- Atlassian Corp
- Workday Inc
- MongoDB Inc
- GoDaddy Inc
- HubSpot Inc
- Intuit Inc
- Zscaler Inc
- Figma Inc
- Adobe Inc
- Salesforce Inc
- ServiceNow Inc
- Snowflake Inc

**Winners (AI/Semi infrastructure, all confirmed in data):**
- Hanmi Semiconductor Co Ltd
- Micron Technology Inc
- Teradyne Inc
- SK Hynix Inc
- Applied Materials Inc
- Intel Corp
- Taiwan Semiconductor Manufacturing Co Ltd

**News snippets** (editorial annotations, sourced from real reporting):
- Atlassian: "AI agents automate the task tracking Jira was built for"
- Adobe: "CEO stepped down; $70M ARR lost to AI image generation"
- Salesforce: "If AI agents do the work of 100 reps, you need 10 seats, not 100"
- Workday: "Under intense pressure to prove AI doesn't kill seat-based pricing"
- HubSpot: "Marketing automation — exactly the workflow AI agents handle best"
- MongoDB: "Database demand shifts as AI workloads favor different architectures"
- Figma: "Design tools face AI-generated UI competition"
- Intuit: "Tax and accounting automation — core AI agent territory"
- Micron: "Memory chips powering the AI that's eating SaaS"
- SK Hynix: "HBM demand for AI training drives record margins"
- TSMC: "Fabricating the chips behind every AI model"
- Applied Materials: "Semiconductor equipment demand surges with AI buildout"

Sources for annotations:
- Bloomberg: "What's Behind the 'SaaSpocalypse' Plunge in Software Stocks" (2026-02-04)
- CNBC: "AI fears pummel software stocks" (2026-02-06)
- TechCrunch: "SaaS in, SaaS out" (2026-03-01)
- Yahoo Finance: "Adobe Stock Drops 26%" (2026-02-18)
- SaaStr: "The 2026 SaaS Crash" (2026-02)

### Sector Family Mapping

Rule-based: match GICS Industry name against keyword sets. Implemented as a function in `app/api.py`.

| Family | Color | Keyword matches (case-insensitive, any substring) |
|---|---|---|
| Technology | `#6366f1` | Software, Semiconductor, IT Services, Technology Hardware, Electronic Equipment, Communications Equipment, Interactive Media |
| Financials | `#0ea5e9` | Bank, Capital Markets, Insurance, Finance, Mortgage, Transaction & Payment |
| Healthcare | `#8b5cf6` | Biotechnology, Health Care, Pharma, Drug |
| Energy | `#f59e0b` | Gas & Consumable Fuels, Oil & Gas, Renewable, Electric Utilities, Independent Power, Utilities |
| Industrials | `#64748b` | Aerospace, Machinery, Electrical Equipment, Construction, Building, Industrial, Air Freight, Ground Transportation, Marine, Trading Companies |
| Materials | `#78716c` | Chemicals, Metals, Mining, Steel, Aluminum, Copper, Gold, Silver, Paper, Construction Materials |
| Consumer | `#ec4899` | Beverage, Tobacco, Retail, Consumer, Household, Hotels, Entertainment, Leisure, Textiles, Food, Specialty Retail |
| Real Estate | `#0d9488` | REIT, Real Estate |
| Telecom | `#d97706` | Telecommunication, Wireless |
| Other | `#94a3b8` | Everything that doesn't match above |

Matching is done in order; first match wins. This covers all 99 GICS industries.

## Scrollytelling Layout

### Structure

```html
<body>
  <header class="hero">
    <!-- Title, subtitle, key stat -->
  </header>

  <main class="scrolly">
    <div class="scrolly__steps">
      <!-- 12 text step blocks, left column (40%) -->
    </div>
    <div class="scrolly__chart">
      <!-- Sticky SVG, right column (60%) -->
    </div>
  </main>

  <footer class="sources">
    <!-- Data attribution, disclaimer, news sources -->
  </footer>
</body>
```

- `.scrolly` uses CSS `display: flex`
- `.scrolly__chart` uses `position: sticky; top: 0; height: 100vh`
- `.scrolly__steps` children are `<div class="step" data-step="1">` blocks
- Mobile (< 768px): single column, chart still sticky above text

### Hero Section

Full-viewport intro:
- Title: "The Global Decacorn Atlas"
- Subtitle: "— And the SaaSpocalypse Reshaping It"
- Key stat: dynamically inserted from `meta` (e.g., "1,943 companies · $109.6 trillion · 99 industries")
- Scroll indicator arrow at bottom

### Scroll Steps (12 total)

**Act 1 — "Where the Giants Live" (steps 1-3):**

Step 1: "Every bubble is a country. The bigger the bubble, the more market cap lives there."
- Chart: World map renders. Country bubbles grow in with staggered animation by region.
- D3: `d3.geoNaturalEarth1()` projection, TopoJSON world boundaries (land outlines only, no fill, stroke `#e2e8f0`), bubbles positioned at country centroids from geography data, radius = `d3.scaleSqrt()` mapping total_cap to [4, 60] px.

Step 2: "The United States dominates — $X trillion in decacorn value. China is second at $Y trillion."
- Chart: US and China bubbles pulse/highlight. Annotation labels appear with actual values from data.
- D3: `.transition()` stroke and scale on selected bubbles, append `<text>` annotations.

Step 3: "But what industries drive each country?"
- Chart: Bubbles recolor from slate monochrome (`#334155`) to sector-family color based on each country's `sector_family` field. Legend fades in.
- D3: `.transition().attr("fill", d => familyColor(d.sector_family))`. Each country bubble gets one color based on its dominant industry's family.

**Act 2 — "What They Build" (steps 4-6):**

Step 4: "Let's regroup these companies by industry instead of geography."
- Chart: World map land outlines fade out. Country bubbles transition to industry treemap positions — each bubble morphs to the treemap cell of its `top_industry`. New industry-level rectangles emerge as bubbles arrive and merge.
- D3: Compute `d3.treemap()` layout from industries data. Animate existing country bubbles: `cx/cy` → treemap cell center, then crossfade: circles fade out as rounded `<rect>` elements fade in at same positions. Duration 1200ms.

Step 5: "Banks dominate by count — 166 decacorns. But Tech leads in total value."
- Chart: Top 10 industries highlight (full opacity), others dim to 0.2 opacity. Labels appear on top 10.
- D3: `.transition().style("opacity", d => top10.has(d.industry) ? 1 : 0.2)`.

Step 6: "Here's how much each industry is worth."
- Chart: Total market cap labels appear inside each treemap cell.
- D3: Append `<text>` elements with formatted values.

**Act 3 — "How They Performed" (steps 7-9):**

Step 7: "Now let's see how each company actually performed this year."
- Chart: Treemap cells dissolve (fade out). Individual dots emerge from treemap cell centers — one per company from `performance` data — spreading along a horizontal YTD % axis.
- D3: Remove treemap rects. Create `<circle>` elements (r=3) for each company, initially positioned at their industry's treemap cell center, then run `d3.forceSimulation()` with `forceX(d => xScale(d.ytd))`, `forceY(height/2)`, and `forceCollide(3.5)`. Simulation runs for ~300 ticks then stops. Color by sector family.
- **Performance note**: 1,943 nodes in force simulation is acceptable for ~300 ticks. Circles are small (r=3) and SVG handles 2K elements fine on desktop. On mobile, reduce to top 500 companies by market cap and note "showing top 500 by market cap" in the step text.

Step 8: "Clustering by industry reveals clear winners and losers."
- Chart: Dots reorganize into industry swim lanes (top 8 industries by company count, rest grouped as "Other"). Y-axis becomes categorical.
- D3: Update `forceY` targets to `d3.scaleBand()` positions for industry lanes. Reheat simulation briefly. Duration ~800ms.

Step 9: "The extremes tell the real story."
- Chart: Best and worst 5 performers get highlighted (full opacity, larger radius) with name labels. Others dim to 0.15 opacity.
- D3: Conditional opacity + append `<text>` for top/bottom performers by YTD.

**Act 4 — "The SaaSpocalypse" (steps 10-12):**

Step 10: "On February 3, 2026, Anthropic launched Claude Cowork. $285 billion vanished in a day."
- Chart: All dots except SaaS losers and AI/Semi winners fade out (opacity 0, then remove). Remaining ~19 dots fly to butterfly chart positions — red bars growing left (losers), green bars growing right (winners).
- D3: Remove force simulation. Filter performance data to hardcoded issuer lists. Create butterfly layout: `d3.scaleBand()` for y-axis (company names, losers top half, winners bottom half), `d3.scaleLinear()` for x-axis (YTD %, centered at 0). Bars animate from center (width 0) outward. Duration 800ms.

Step 11: "The casualties. Software companies built for a world with more humans, not fewer."
- Chart: Loser bars highlight (full opacity). News annotation text appears next to each bar.
- D3: Append `<text>` annotations positioned to the left of each red bar. Stagger entrance by 50ms per bar.

Step 12: "The winners aren't the AI companies themselves — they're the picks and shovels."
- Chart: Winner bars highlight. News annotations appear. Final stat annotation: "NVIDIA -3.4% · The real winners are the supply chain."
- D3: Append `<text>` annotations to the right of green bars. Fade in final editorial callout box.

## Visual Design

### Color Palette (Slate)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#f8fafc` | Page background |
| `--card` | `#ffffff` | Chart background, step cards |
| `--border` | `#e2e8f0` | Borders, axes, map outlines |
| `--text` | `#0f172a` | Primary text |
| `--text-secondary` | `#64748b` | Step body text |
| `--text-muted` | `#94a3b8` | Footer, annotations |
| `--accent` | `#334155` | Emphasis, active step border, default bubble fill |
| `--positive` | `#059669` | Positive YTD values, winner bars |
| `--negative` | `#dc2626` | Negative YTD values, loser bars |

### Typography

- **Font**: Inter via Google Fonts CDN (`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`)
- **Hero title**: 48px, weight 800, `--text`
- **Hero subtitle**: 20px, weight 400, `--text-secondary`
- **Step headline**: 20px, weight 700, `--text`
- **Step body**: 16px, weight 400, line-height 1.6, `--text-secondary`
- **Pull-quote stats**: 32px, weight 700 (e.g. "$285 billion")
- **Chart labels**: 12px, weight 500, `--text-secondary`
- **Annotations**: 13px, weight 500, `--text`
- **Footer**: 12px, weight 400, `--text-muted`

### Step Card Styling

- Background: white, subtle left border (4px `--accent`) on active step
- Padding: 32px
- Margin-bottom: 40vh (creates scroll space between steps)
- Opacity: 0.3 when inactive, 1.0 when active (via Scrollama `step-enter`/`step-exit` events)
- Transition: `opacity 0.3s ease`

### Chart Area

- SVG fills the sticky container (100% width, 100vh height)
- White background with subtle border
- D3 margins: `{ top: 40, right: 40, bottom: 60, left: 60 }`
- All transitions: 800ms, `d3.easeCubicInOut` (unless noted otherwise)

### Responsive

- **Desktop (> 1024px)**: side-by-side layout, 40/60 split
- **Tablet (768-1024px)**: 45/55 split, smaller fonts
- **Mobile (< 768px)**: single column, chart sticky at top (50vh), steps below. Beeswarm reduced to top 500 companies.

## Footer

- Data attribution: "Data: Refinitiv (LSEG) — Global decacorns, GICS classification, March 2026" (no hardcoded count)
- Disclaimer: "For academic illustration only. Not investment advice."
- News sources as clickable links: Bloomberg, CNBC, TechCrunch, Yahoo Finance, SaaStr
- All text centered, `--text-muted` color

## Dependencies

| Library | Size (gzipped) | CDN |
|---|---|---|
| D3.js v7 | ~90KB | `https://cdn.jsdelivr.net/npm/d3@7` |
| Scrollama | ~5KB | `https://cdn.jsdelivr.net/npm/scrollama@3` |
| TopoJSON Client | ~2KB | `https://cdn.jsdelivr.net/npm/topojson-client@3` |
| World TopoJSON | ~100KB | `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` |
| Inter font | ~20KB | Google Fonts CDN |

**Total: ~217KB** (vs Plotly at ~3.5MB)

## Files

| File | Action | Purpose |
|---|---|---|
| `static/index.html` | Create | Scrollytelling page — hero, scrolly layout, footer, CDN script tags |
| `static/css/style.css` | Create | All styling — layout, hero, steps, chart, responsive, transitions |
| `static/js/main.js` | Create | D3 charts, Scrollama setup, all 12 step transition handlers |
| `app/api.py` | Create | `/api/data` endpoint logic — aggregation, sector family mapping, exchange mapping |
| `app/exchange_map.py` | Create | Exchange name → country/code/lat/lon lookup dict (all 65 exchanges + fallback) |
| `app/main.py` | Modify | `GET /` returns `FileResponse("static/index.html")`. Mount `StaticFiles` at `/static`. Add `/api/data` route. Remove Dash WSGI mount and import. |
| `app/dashboard.py` | Delete | Remove Dash app entirely |
| `app/assets/style.css` | Delete | Remove Dash assets |
| `requirements.txt` | Modify | Remove `dash`, `plotly`. Add `aiofiles` for async static file serving. |

### Unchanged
- `app/data.py` — still loads and cleans the data
- `Dockerfile` — same port, same base image
- `firebase.json` — same hosting config
- `run.py` — still runs uvicorn

## Edge Cases

- **Slow network**: D3/Scrollama are small; world TopoJSON (~100KB) is the biggest asset. Acceptable.
- **No JS**: Page shows hero text and step text as a plain article. Charts don't render but the narrative is still readable as text.
- **Mobile performance**: Beeswarm (Act 3) reduced to top 500 companies by market cap on viewports < 768px. All other acts use aggregated data (< 100 elements) and are fine.
- **Desktop performance**: 1,943 circles in SVG with force simulation is acceptable. Force runs for ~300 ticks then freezes. No canvas fallback needed.
- **Data API failure**: JS shows a "Data unavailable" message in the chart area if fetch fails. Narrative text still readable.
- **Unmapped exchanges**: Any exchange not in the lookup dict falls back to "Other" country at lat 0, lon 0. These will cluster at the map origin but won't break the visualization.

## Out of Scope

- No user interactivity beyond scrolling (no filters, no dropdowns)
- No server-side rendering of charts
- No build step or bundler
- No additional data sources beyond the Refinitiv Excel/CSV
