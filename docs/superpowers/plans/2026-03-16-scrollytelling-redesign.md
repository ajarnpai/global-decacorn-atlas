# Scrollytelling Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dash/Plotly dashboard with a D3.js + Scrollama scrollytelling data journalism piece about global decacorns and the SaaSpocalypse.

**Architecture:** FastAPI backend serves pre-computed JSON via `/api/data` and static files (HTML/CSS/JS) via `/static`. Frontend is a single HTML page with D3 charts that transition on scroll via Scrollama. No build step, no bundler.

**Tech Stack:** FastAPI, D3.js v7, Scrollama, TopoJSON, Inter font (Google Fonts CDN)

**Spec:** `docs/superpowers/specs/2026-03-16-scrollytelling-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/exchange_map.py` | Create | Exchange name → country/code/lat/lon lookup (65 exchanges + fallback) |
| `app/api.py` | Create | `/api/data` aggregation: geography, industries, performance, saaspocalypse, meta |
| `app/main.py` | Rewrite | FastAPI routes: `GET /`, `/api/data`, `/api/health`. Mount StaticFiles. Remove Dash. |
| `requirements.txt` | Modify | Remove dash/plotly, add aiofiles/openpyxl |
| `static/index.html` | Create | Scrollytelling page: hero, 12 scroll steps, footer, CDN scripts |
| `static/css/style.css` | Create | All styling: layout, hero, steps, chart, responsive |
| `static/js/main.js` | Create | D3 charts, Scrollama, 12 step transition handlers |
| `app/dashboard.py` | Delete | Remove Dash app |
| `app/assets/` | Delete | Remove Dash assets |

---

## Chunk 1: Backend

### Task 1: Create exchange_map.py

**Files:**
- Create: `app/exchange_map.py`

- [ ] **Step 1: Create the exchange lookup module**

Create `app/exchange_map.py` with the complete lookup dict mapping all 65 exchanges to country, code, lat, lon:

```python
"""Exchange name → country / ISO code / lat-lon centroid."""

_FALLBACK = {"country": "Other", "code": "XX", "lat": 0.0, "lon": 0.0}

EXCHANGE_MAP: dict[str, dict] = {
    # ── United States ──
    "NYSE Consolidated":                    {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    "NASDAQ Global Select Consolidated":    {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    "NASDAQ Global Market Consolidated":    {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    "NASDAQ Capital Market Consolidated":   {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    "NYSE American Consolidated":           {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    "Cboe Consolidated":                    {"country": "United States", "code": "US", "lat": 37.0, "lon": -95.7},
    # ── China ──
    "Shanghai Stock Exchange":              {"country": "China", "code": "CN", "lat": 35.0, "lon": 105.0},
    "Shenzhen Stock Exchange":              {"country": "China", "code": "CN", "lat": 35.0, "lon": 105.0},
    # ── Japan ──
    "Tokyo Stock Exchange":                 {"country": "Japan", "code": "JP", "lat": 36.2, "lon": 138.3},
    # ── India ──
    "National Stock Exchange of India":     {"country": "India", "code": "IN", "lat": 20.6, "lon": 79.0},
    # ── Hong Kong ──
    "The Stock Exchange of Hong Kong Ltd":  {"country": "Hong Kong", "code": "HK", "lat": 22.3, "lon": 114.2},
    # ── Canada ──
    "The Toronto Stock Exchange":           {"country": "Canada", "code": "CA", "lat": 56.1, "lon": -106.3},
    # ── United Kingdom ──
    "London Stock Exchange":                {"country": "United Kingdom", "code": "GB", "lat": 55.4, "lon": -3.4},
    # ── France ──
    "Euronext Paris":                       {"country": "France", "code": "FR", "lat": 46.6, "lon": 1.9},
    # ── Netherlands ──
    "Euronext Amsterdam":                   {"country": "Netherlands", "code": "NL", "lat": 52.1, "lon": 5.3},
    # ── Belgium ──
    "Euronext Brussels":                    {"country": "Belgium", "code": "BE", "lat": 50.5, "lon": 4.5},
    # ── Portugal ──
    "Euronext Lisbon":                      {"country": "Portugal", "code": "PT", "lat": 39.4, "lon": -8.2},
    # ── Taiwan ──
    "Taiwan Stock Exchange":                {"country": "Taiwan", "code": "TW", "lat": 23.7, "lon": 121.0},
    "Taipei Exchange":                      {"country": "Taiwan", "code": "TW", "lat": 23.7, "lon": 121.0},
    # ── Germany ──
    "Xetra":                                {"country": "Germany", "code": "DE", "lat": 51.2, "lon": 10.5},
    "Frankfurt Stock Exchange":             {"country": "Germany", "code": "DE", "lat": 51.2, "lon": 10.5},
    # ── South Korea ──
    "Korea Exchange - KSE":                 {"country": "South Korea", "code": "KR", "lat": 35.9, "lon": 127.8},
    "Korea Exchange - KOSDAQ":              {"country": "South Korea", "code": "KR", "lat": 35.9, "lon": 127.8},
    # ── Switzerland ──
    "SIX Swiss Exchange":                   {"country": "Switzerland", "code": "CH", "lat": 46.8, "lon": 8.2},
    # ── Australia ──
    "Australian Stock Exchange Ltd":        {"country": "Australia", "code": "AU", "lat": -25.3, "lon": 134.8},
    # ── Singapore ──
    "Singapore Exchange Securities Trading Ltd": {"country": "Singapore", "code": "SG", "lat": 1.4, "lon": 103.8},
    # ── Italy ──
    "Milan Stock Exchange":                 {"country": "Italy", "code": "IT", "lat": 41.9, "lon": 12.6},
    # ── Spain ──
    "BME SPANISH EXCHANGE":                 {"country": "Spain", "code": "ES", "lat": 40.5, "lon": -3.7},
    # ── Nordic ──
    "OMX Nordic Exchange Stockholm AB - cash": {"country": "Sweden", "code": "SE", "lat": 60.1, "lon": 18.6},
    "OMX Nordic Exchange Copenhagen A/S":   {"country": "Denmark", "code": "DK", "lat": 56.3, "lon": 9.5},
    "OMX Nordic Exchange Helsinki Oy":      {"country": "Finland", "code": "FI", "lat": 61.9, "lon": 25.7},
    "Oslo Stock Exchange":                  {"country": "Norway", "code": "NO", "lat": 60.5, "lon": 8.5},
    # ── Central/Eastern Europe ──
    "Vienna Stock Exchange - Cash Market":  {"country": "Austria", "code": "AT", "lat": 47.5, "lon": 14.6},
    "Warsaw Stock Exchange":                {"country": "Poland", "code": "PL", "lat": 51.9, "lon": 19.1},
    "Budapest Stock Exchange":              {"country": "Hungary", "code": "HU", "lat": 47.2, "lon": 19.5},
    "Bucharest Stock Exchange":             {"country": "Romania", "code": "RO", "lat": 45.9, "lon": 25.0},
    "Athens Stock Exchange":                {"country": "Greece", "code": "GR", "lat": 39.1, "lon": 21.8},
    "The Irish Stock Exchange":             {"country": "Ireland", "code": "IE", "lat": 53.1, "lon": -7.7},
    # ── Turkey ──
    "BORSA ISTANBUL":                       {"country": "Turkey", "code": "TR", "lat": 38.9, "lon": 35.2},
    # ── Middle East ──
    "Tel Aviv Stock Exchange":              {"country": "Israel", "code": "IL", "lat": 31.0, "lon": 34.9},
    "Saudi Arabian Stock Exchange":         {"country": "Saudi Arabia", "code": "SA", "lat": 23.9, "lon": 45.1},
    "Abu Dhabi Stock Exchange":             {"country": "United Arab Emirates", "code": "AE", "lat": 23.4, "lon": 53.8},
    "Dubai Financial Market":               {"country": "United Arab Emirates", "code": "AE", "lat": 23.4, "lon": 53.8},
    "QATAR EXCHANGE LEVEL 1":               {"country": "Qatar", "code": "QA", "lat": 25.4, "lon": 51.2},
    "Boursa Kuwait":                        {"country": "Kuwait", "code": "KW", "lat": 29.3, "lon": 47.5},
    "Muscat Securities Market":             {"country": "Oman", "code": "OM", "lat": 21.5, "lon": 55.9},
    "Amman Financial Market":               {"country": "Jordan", "code": "JO", "lat": 30.6, "lon": 36.2},
    # ── Africa ──
    "Johannesburg Stock Exchange":          {"country": "South Africa", "code": "ZA", "lat": -30.6, "lon": 22.9},
    "Nigerian Stock Exchange":              {"country": "Nigeria", "code": "NG", "lat": 9.1, "lon": 8.7},
    "Casablanca Stock Exchange":            {"country": "Morocco", "code": "MA", "lat": 31.8, "lon": -7.1},
    # ── Latin America ──
    "BM&F Bovespa SA Bolsa de Valores Mercadorias e Futuros": {"country": "Brazil", "code": "BR", "lat": -14.2, "lon": -51.9},
    "Bolsa Mexicana de Valores S.A. de C.V.":                 {"country": "Mexico", "code": "MX", "lat": 23.6, "lon": -102.6},
    "Bolsa de Comercio de Buenos Aires":    {"country": "Argentina", "code": "AR", "lat": -38.4, "lon": -63.6},
    "Bolsa de Comercio de Santiago":        {"country": "Chile", "code": "CL", "lat": -35.7, "lon": -71.5},
    "Bolsa de Valores de Colombia":         {"country": "Colombia", "code": "CO", "lat": 4.6, "lon": -74.3},
    "Bolsa de Valores de Lima S.A.":        {"country": "Peru", "code": "PE", "lat": -9.2, "lon": -75.0},
    # ── Southeast Asia ──
    "Indonesia Stock Exchange (formerly Jakarta SE)": {"country": "Indonesia", "code": "ID", "lat": -0.8, "lon": 113.9},
    "Bursa Malaysia":                       {"country": "Malaysia", "code": "MY", "lat": 4.2, "lon": 101.9},
    "The Stock Exchange of Thailand":       {"country": "Thailand", "code": "TH", "lat": 15.9, "lon": 100.9},
    "Philippine Stock Exchange, Inc":       {"country": "Philippines", "code": "PH", "lat": 12.9, "lon": 121.8},
    "PSE CASH MARKET L1 AND L2":            {"country": "Philippines", "code": "PH", "lat": 12.9, "lon": 121.8},
    "Hochiminh Stock Exchange":             {"country": "Vietnam", "code": "VN", "lat": 14.1, "lon": 108.3},
    # ── Other Asia-Pacific ──
    "New Zealand Stock Exchange":           {"country": "New Zealand", "code": "NZ", "lat": -40.9, "lon": 174.9},
    "Kazakhstan Stock Exchange":            {"country": "Kazakhstan", "code": "KZ", "lat": 48.0, "lon": 68.0},
    # ── Lebanon ──
    "Beirut Stock Exchange":                {"country": "Lebanon", "code": "LB", "lat": 33.9, "lon": 35.9},
}


def lookup(exchange: str) -> dict:
    """Return country info for an exchange name. Falls back to 'Other' if unmapped."""
    return EXCHANGE_MAP.get(exchange, _FALLBACK)
```

- [ ] **Step 2: Verify the module loads**

Run: `python -c "from app.exchange_map import lookup; print(lookup('NYSE Consolidated')); print(lookup('Unknown Exchange'))"`

Expected: `{'country': 'United States', 'code': 'US', 'lat': 37.0, 'lon': -95.7}` then fallback dict.

- [ ] **Step 3: Commit**

```bash
git add app/exchange_map.py
git commit -m "feat: add exchange-to-country lookup for 65 global exchanges"
```

---

### Task 2: Create api.py (data aggregation)

**Files:**
- Create: `app/api.py`

- [ ] **Step 1: Create the API data module**

Create `app/api.py` with all aggregation logic:

```python
"""Compute the pre-aggregated JSON payload for /api/data."""

from __future__ import annotations
import math
from datetime import date

from app.data import get_dataframe
from app.exchange_map import lookup as exchange_lookup

# ---------------------------------------------------------------------------
# Sector family mapping (order matters — first match wins)
# ---------------------------------------------------------------------------
_FAMILY_RULES: list[tuple[str, list[str]]] = [
    ("Technology",  ["Software", "Semiconductor", "IT Services", "Technology Hardware",
                     "Electronic Equipment", "Communications Equipment", "Interactive Media"]),
    ("Financials",  ["Bank", "Capital Markets", "Insurance", "Finance", "Mortgage",
                     "Transaction & Payment"]),
    ("Healthcare",  ["Biotechnology", "Health Care", "Pharma", "Drug"]),
    ("Energy",      ["Gas & Consumable Fuels", "Oil & Gas", "Renewable", "Electric Utilities",
                     "Independent Power", "Utilities"]),
    ("Industrials", ["Aerospace", "Machinery", "Electrical Equipment", "Construction",
                     "Building", "Industrial", "Air Freight", "Ground Transportation",
                     "Marine", "Trading Companies"]),
    ("Materials",   ["Chemicals", "Metals", "Mining", "Steel", "Aluminum", "Copper",
                     "Gold", "Silver", "Paper", "Construction Materials"]),
    ("Consumer",    ["Beverage", "Tobacco", "Retail", "Consumer", "Household", "Hotels",
                     "Entertainment", "Leisure", "Textiles", "Food", "Specialty Retail"]),
    ("Real Estate", ["REIT", "Real Estate"]),
    ("Telecom",     ["Telecommunication", "Wireless"]),
]

FAMILY_COLORS: dict[str, str] = {
    "Technology": "#6366f1", "Financials": "#0ea5e9", "Healthcare": "#8b5cf6",
    "Energy": "#f59e0b", "Industrials": "#64748b", "Materials": "#78716c",
    "Consumer": "#ec4899", "Real Estate": "#0d9488", "Telecom": "#d97706",
    "Other": "#94a3b8",
}


def sector_family(industry: str) -> str:
    """Map a GICS Industry name to a broad sector family."""
    low = industry.lower()
    for family, keywords in _FAMILY_RULES:
        if any(kw.lower() in low for kw in keywords):
            return family
    return "Other"


# ---------------------------------------------------------------------------
# SaaSpocalypse hardcoded lists (issuer names as they appear in the dataset)
# ---------------------------------------------------------------------------
_SAAS_LOSERS = [
    "Atlassian Corp", "Workday Inc", "MongoDB Inc", "GoDaddy Inc",
    "HubSpot Inc", "Intuit Inc", "Zscaler Inc", "Figma Inc",
    "Adobe Inc", "Salesforce Inc", "ServiceNow Inc", "Snowflake Inc",
]

_AI_WINNERS = [
    "Hanmi Semiconductor Co Ltd", "Micron Technology Inc", "Teradyne Inc",
    "SK Hynix Inc", "Applied Materials Inc", "Intel Corp",
    "Taiwan Semiconductor Manufacturing Co Ltd",
]

_NEWS_SNIPPETS: dict[str, str] = {
    "Atlassian Corp": "AI agents automate the task tracking Jira was built for",
    "Adobe Inc": "CEO stepped down; $70M ARR lost to AI image generation",
    "Salesforce Inc": "If AI agents do the work of 100 reps, you need 10 seats, not 100",
    "Workday Inc": "Under intense pressure to prove AI doesn't kill seat-based pricing",
    "HubSpot Inc": "Marketing automation \u2014 exactly the workflow AI agents handle best",
    "MongoDB Inc": "Database demand shifts as AI workloads favor different architectures",
    "Figma Inc": "Design tools face AI-generated UI competition",
    "Intuit Inc": "Tax and accounting automation \u2014 core AI agent territory",
    "GoDaddy Inc": "Web hosting commoditized as AI builds sites in seconds",
    "Zscaler Inc": "Security budgets reallocated toward AI-native platforms",
    "ServiceNow Inc": "IT service management increasingly handled by AI agents",
    "Snowflake Inc": "Data warehouse spending under pressure from AI-native alternatives",
    "Micron Technology Inc": "Memory chips powering the AI that's eating SaaS",
    "SK Hynix Inc": "HBM demand for AI training drives record margins",
    "Taiwan Semiconductor Manufacturing Co Ltd": "Fabricating the chips behind every AI model",
    "Applied Materials Inc": "Semiconductor equipment demand surges with AI buildout",
    "Hanmi Semiconductor Co Ltd": "Chip packaging demand surges as AI training scales",
    "Teradyne Inc": "Test equipment demand rises with AI chip production",
    "Intel Corp": "Foundry pivot positions Intel in the AI supply chain",
}


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------
def build_data() -> dict:
    """Build the complete /api/data response."""
    df = get_dataframe()

    return {
        "geography": _build_geography(df),
        "industries": _build_industries(df),
        "performance": _build_performance(df),
        "saaspocalypse": _build_saaspocalypse(df),
        "meta": _build_meta(df),
    }


def _build_geography(df) -> list[dict]:
    """Aggregate by country via exchange mapping."""
    df = df.copy()
    df["_country_info"] = df["Exchange"].apply(exchange_lookup)
    df["_country"] = df["_country_info"].apply(lambda x: x["country"])
    df["_code"] = df["_country_info"].apply(lambda x: x["code"])
    df["_lat"] = df["_country_info"].apply(lambda x: x["lat"])
    df["_lon"] = df["_country_info"].apply(lambda x: x["lon"])

    grouped = df.groupby("_country")
    result = []
    for country, grp in grouped:
        top_ind = grp["GICS Industry"].mode().iloc[0] if len(grp) > 0 else "Unknown"
        info = grp.iloc[0]
        result.append({
            "country": country,
            "code": info["_code"],
            "lat": float(info["_lat"]),
            "lon": float(info["_lon"]),
            "count": int(len(grp)),
            "total_cap": float(grp["Market Cap (USD)"].sum()),
            "top_industry": top_ind,
            "sector_family": sector_family(top_ind),
        })
    return sorted(result, key=lambda x: x["total_cap"], reverse=True)


def _build_industries(df) -> list[dict]:
    """Aggregate by GICS Industry."""
    grouped = df.groupby("GICS Industry")
    result = []
    for industry, grp in grouped:
        result.append({
            "industry": industry,
            "count": int(len(grp)),
            "total_cap": float(grp["Market Cap (USD)"].sum()),
            "avg_ytd": round(float(grp["% Price Change YTD"].mean()), 2),
            "sector_family": sector_family(industry),
        })
    return sorted(result, key=lambda x: x["total_cap"], reverse=True)


def _build_performance(df) -> list[dict]:
    """One row per company."""
    result = []
    for _, row in df.iterrows():
        industry = row.get("GICS Industry", "Unknown")
        ytd = row.get("% Price Change YTD")
        one_y = row.get("% Price Change 1Y")
        result.append({
            "issuer": row["Issuer"],
            "industry": industry,
            "sector_family": sector_family(industry),
            "ytd": round(float(ytd), 2) if not (ytd != ytd) else None,  # NaN check
            "one_y": round(float(one_y), 2) if not (one_y != one_y) else None,
            "cap": float(row["Market Cap (USD)"]),
        })
    return result


def _build_saaspocalypse(df) -> dict:
    """Build the SaaS losers / AI winners lists."""
    def _extract(issuer_list):
        entries = []
        for name in issuer_list:
            match = df[df["Issuer"] == name]
            if match.empty:
                continue
            row = match.iloc[0]
            ytd = row.get("% Price Change YTD")
            entries.append({
                "issuer": name,
                "ytd": round(float(ytd), 2) if not (ytd != ytd) else None,
                "cap": float(row["Market Cap (USD)"]),
                "trbc_sector": str(row.get("TRBC Sector", "")),
                "news": _NEWS_SNIPPETS.get(name, ""),
            })
        return entries

    losers = _extract(_SAAS_LOSERS)
    losers.sort(key=lambda x: x["ytd"] if x["ytd"] is not None else 0)

    winners = _extract(_AI_WINNERS)
    winners.sort(key=lambda x: x["ytd"] if x["ytd"] is not None else 0, reverse=True)

    return {"losers": losers, "winners": winners}


def _build_meta(df) -> dict:
    """Global summary stats."""
    return {
        "total_instruments": int(len(df)),
        "total_cap_trillions": round(float(df["Market Cap (USD)"].sum()) / 1e12, 1),
        "avg_ytd": round(float(df["% Price Change YTD"].mean()), 1),
        "date": str(date.today()),
    }
```

- [ ] **Step 2: Verify the module builds data correctly**

Run: `python -c "from app.api import build_data; d = build_data(); print('Geography:', len(d['geography']), 'countries'); print('Industries:', len(d['industries'])); print('Performance:', len(d['performance']), 'companies'); print('Losers:', len(d['saaspocalypse']['losers'])); print('Winners:', len(d['saaspocalypse']['winners'])); print('Meta:', d['meta'])"`

Expected: ~40 countries, 99 industries, ~1943 companies, 12 losers, 7 winners, meta with dynamic values.

- [ ] **Step 3: Commit**

```bash
git add app/api.py
git commit -m "feat: add data API aggregation for scrollytelling (geography, industries, performance, saaspocalypse)"
```

---

### Task 3: Rewrite main.py and update requirements

**Files:**
- Rewrite: `app/main.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Update requirements.txt**

```
fastapi
uvicorn[standard]
pandas
openpyxl
aiofiles
```

Remove `dash` and `plotly`. Add `aiofiles` (for FastAPI StaticFiles async serving). Keep `openpyxl` (already implicitly used if Excel path is restored).

- [ ] **Step 2: Install updated dependencies**

Run: `pip install aiofiles`

- [ ] **Step 3: Rewrite main.py**

```python
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import build_data

app = FastAPI(title="Refinitiv Analytics API")

STATIC_DIR = Path(__file__).parent.parent / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
def root():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/data")
def data():
    return build_data()
```

- [ ] **Step 4: Create static directory stubs**

Run: `mkdir -p static/css static/js`

Create a minimal `static/index.html` placeholder so the server starts:

```html
<!DOCTYPE html>
<html><body><h1>Coming soon</h1></body></html>
```

- [ ] **Step 5: Verify server starts and API works**

Run: `python run.py` (in background)

Then: `curl http://localhost:8050/api/health` → `{"status":"ok"}`
Then: `curl http://localhost:8050/api/data | python -m json.tool | head -20` → JSON with geography array
Then: `curl -o /dev/null -w "%{http_code}" http://localhost:8050/` → `200`

- [ ] **Step 6: Commit**

```bash
git add app/main.py requirements.txt static/index.html
git commit -m "feat: rewrite FastAPI routes for static frontend + data API, remove Dash dependency"
```

---

## Chunk 2: Frontend Skeleton (HTML + CSS)

### Task 4: Create index.html

**Files:**
- Rewrite: `static/index.html`

- [ ] **Step 1: Write the complete scrollytelling HTML page**

The page has: hero section, 12 scroll steps in a scrolly layout, sticky chart SVG, footer with sources. All CDN scripts loaded at bottom.

Create `static/index.html` — complete HTML with all 12 step text blocks, hero, footer, CDN links for D3/Scrollama/TopoJSON/Inter font. Steps have `data-step` attributes 1-12.

Content for each step:

- Step 1: Act 1 heading + "Every bubble is a country..."
- Step 2: "The United States dominates..."
- Step 3: "But what industries drive each country?"
- Step 4: Act 2 heading + "Let's regroup by industry..."
- Step 5: "Banks dominate by count..."
- Step 6: "Here's how much each industry is worth."
- Step 7: Act 3 heading + "Now let's see how each company performed..."
- Step 8: "Clustering by industry reveals winners and losers."
- Step 9: "The extremes tell the real story."
- Step 10: Act 4 heading + "On February 3, 2026, Anthropic launched Claude Cowork..."
- Step 11: "The casualties..."
- Step 12: "The winners aren't the AI companies themselves..."

- [ ] **Step 2: Commit**

```bash
git add static/index.html
git commit -m "feat: add scrollytelling HTML page with hero, 12 narrative steps, and footer"
```

---

### Task 5: Create style.css

**Files:**
- Create: `static/css/style.css`

- [ ] **Step 1: Write the complete stylesheet**

CSS custom properties for palette, base styles, hero section (full viewport, centered), scrolly layout (flex, 40/60 split), step cards (white bg, left border on active, 40vh margin-bottom, opacity transitions), sticky chart container, footer, responsive breakpoints.

Key classes: `.hero`, `.hero__title`, `.hero__subtitle`, `.hero__stat`, `.hero__scroll-hint`, `.scrolly`, `.scrolly__steps`, `.scrolly__chart`, `.step`, `.step.is-active`, `.step__act`, `.step__headline`, `.step__body`, `.step__stat`, `.sources`, `.sources__link`.

- [ ] **Step 2: Verify visually**

Run dev server, open `http://localhost:8050/`. Should see hero section and scrollable step cards with correct typography, colors, and layout. Chart area should be a white sticky box.

- [ ] **Step 3: Commit**

```bash
git add static/css/style.css
git commit -m "feat: add scrollytelling CSS — layout, hero, steps, chart, responsive"
```

---

## Chunk 3: D3 Visualization — Acts 1-2

### Task 6: Create main.js with initialization + Acts 1-2

**Files:**
- Create: `static/js/main.js`

- [ ] **Step 1: Write the JS initialization and Act 1 (world map + bubbles)**

The JS file:
1. Fetches `/api/data`
2. Sets up SVG in `.scrolly__chart`
3. Initializes Scrollama on `.step` elements
4. Dispatches to step handler functions on scroll
5. Implements steps 1-3 (Act 1: world map, bubbles, recolor)

Key D3 functions:
- `initMap(svg, geo, projection)` — draws world land outlines from TopoJSON
- `step1(svg, data)` — add country bubbles with staggered grow-in
- `step2(svg, data)` — highlight US/China, add annotations
- `step3(svg, data)` — recolor bubbles by sector family, add legend

Uses `d3.geoNaturalEarth1()` projection, `d3.scaleSqrt()` for bubble radius, sector family colors from the API data.

- [ ] **Step 2: Add Act 2 (treemap)**

Implement steps 4-6:
- `step4(svg, data)` — fade out map, transition bubbles to treemap positions, crossfade to rects
- `step5(svg, data)` — highlight top 10 industries, dim others
- `step6(svg, data)` — add market cap labels

Uses `d3.treemap()` with `d3.hierarchy()`, rounded rects, 1200ms transition for step 4.

- [ ] **Step 3: Verify Acts 1-2 visually**

Run dev server, scroll through steps 1-6. Verify:
- World map renders with land outlines
- Country bubbles appear sized by market cap
- US/China highlight with annotations
- Bubbles recolor by sector family
- Transition to treemap
- Top 10 highlight and labels

- [ ] **Step 4: Commit**

```bash
git add static/js/main.js
git commit -m "feat: add D3 Acts 1-2 — world bubble map and industry treemap with scroll transitions"
```

---

## Chunk 4: D3 Visualization — Acts 3-4 + Cleanup

### Task 7: Add Acts 3-4 to main.js

**Files:**
- Modify: `static/js/main.js`

- [ ] **Step 1: Implement Act 3 (beeswarm / performance)**

Add steps 7-9:
- `step7(svg, data)` — dissolve treemap, create per-company dots, run force simulation spreading on YTD axis
- `step8(svg, data)` — reorganize dots into industry swim lanes
- `step9(svg, data)` — highlight top/bottom 5 performers with name labels

Uses `d3.forceSimulation()` with `forceX`, `forceY`, `forceCollide`. Mobile check: if viewport < 768px, filter to top 500 by market cap.

- [ ] **Step 2: Implement Act 4 (SaaSpocalypse butterfly chart)**

Add steps 10-12:
- `step10(svg, data)` — fade all non-SaaSpocalypse dots, create butterfly bar chart (losers left red, winners right green)
- `step11(svg, data)` — highlight losers, add news annotations
- `step12(svg, data)` — highlight winners, add news annotations, final editorial callout

Uses `d3.scaleBand()` for y-axis, bars animate from center outward.

- [ ] **Step 3: Verify Acts 3-4 visually**

Scroll through all 12 steps. Verify full narrative flow with transitions.

- [ ] **Step 4: Commit**

```bash
git add static/js/main.js
git commit -m "feat: add D3 Acts 3-4 — beeswarm performance plot and SaaSpocalypse butterfly chart"
```

---

### Task 8: Delete Dash files and final cleanup

**Files:**
- Delete: `app/dashboard.py`
- Delete: `app/assets/style.css`
- Delete: `app/assets/` directory

- [ ] **Step 1: Remove Dash files**

```bash
rm app/dashboard.py
rm -rf app/assets
```

- [ ] **Step 2: Verify full app works end-to-end**

Run: `python run.py`

Open `http://localhost:8050/`:
- Hero section loads with dynamic stats from API
- All 12 scroll steps trigger correct D3 transitions
- Footer shows attribution and disclaimer with source links
- No console errors
- `/api/health` returns OK
- `/api/data` returns full JSON

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Dash/Plotly files, complete scrollytelling migration"
```
