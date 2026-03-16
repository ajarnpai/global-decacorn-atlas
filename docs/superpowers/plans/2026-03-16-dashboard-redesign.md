# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Refinitiv Financial Dashboard with a slate light-minimal theme, KPI summary cards, pill tabs, and academic disclaimer footer — removing the data table tab.

**Architecture:** Dash app with external CSS stylesheet. All visual styling moves from inline Python dicts to CSS classes in `app/assets/style.css`. Layout in `app/dashboard.py` uses `className` props. Plotly charts themed inline via `update_layout()`.

**Tech Stack:** Dash, Plotly, Pandas (existing). Google Fonts CDN for Inter. No new Python dependencies.

**Spec:** `docs/superpowers/specs/2026-03-16-dashboard-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/assets/style.css` | Create | All CSS: palette custom properties, layout, KPI cards, pill tabs, filter/chart cards, footer, Dash overrides, responsive |
| `app/dashboard.py` | Rewrite | Slate palette, Inter font, KPI cards, pill tabs (2 tabs), bubble + bar charts with new theme, footer, no data table |

Unchanged: `app/data.py`, `app/main.py`, `run.py`, `Dockerfile`

---

## Chunk 1: CSS Foundation

### Task 1: Create `app/assets/style.css`

**Files:**
- Create: `app/assets/style.css`

- [ ] **Step 1: Create the assets directory and CSS file**

Create `app/assets/style.css` with the complete stylesheet:

```css
/* ── Palette (CSS custom properties) ── */
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --border: #e2e8f0;
  --subtle-bg: #f1f5f9;
  --text: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --accent: #334155;
  --positive: #059669;
  --negative: #dc2626;
  --radius-card: 10px;
  --radius-inner: 8px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06);
  --font: 'Inter', -apple-system, system-ui, sans-serif;
}

/* ── Reset & Base ── */
body {
  margin: 0;
  background: var(--bg);
  font-family: var(--font);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

/* ── Page container ── */
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.header-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  padding-left: 18px;
}

/* ── KPI Row ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 1px solid var(--border);
  border-radius: var(--radius-inner);
  padding: 16px;
  transition: box-shadow 0.2s ease;
}

.kpi-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.kpi-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 0 0 6px 0;
}

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.kpi-value--positive { color: var(--positive); }
.kpi-value--negative { color: var(--negative); }

.kpi-detail {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

/* ── Pill Tabs (override Dash defaults) ── */
.pill-tabs-container {
  margin-bottom: 20px;
}

/* Neutralise Dash's default tab wrapper */
.pill-tabs-container .tab-container {
  display: flex !important;
  background: var(--subtle-bg) !important;
  border-radius: var(--radius-inner) !important;
  padding: 3px !important;
  border: none !important;
  gap: 2px;
}

/* Individual tab — inactive */
.pill-tab {
  flex: none !important;
  padding: 8px 20px !important;
  border: none !important;
  border-radius: 6px !important;
  background: transparent !important;
  color: var(--text-secondary) !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  font-family: var(--font) !important;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.pill-tab:hover {
  color: var(--text) !important;
  background: rgba(255,255,255,0.5) !important;
}

/* Individual tab — active */
.pill-tab--active {
  flex: none !important;
  padding: 8px 20px !important;
  border: none !important;
  border-radius: 6px !important;
  background: var(--card) !important;
  color: var(--text) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  font-family: var(--font) !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

/* ── Cards (filter + chart wrappers) ── */
.filter-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-card);
}

.filter-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
}

.chart-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 8px;
  box-shadow: var(--shadow-card);
}

/* ── Dropdown overrides ── */
.Select-control {
  border-color: var(--border) !important;
  border-radius: 6px !important;
}

.Select-control:hover {
  border-color: var(--accent) !important;
}

.Select-menu-outer {
  border-color: var(--border) !important;
  border-radius: 0 0 6px 6px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
}

.Select-option.is-focused {
  background: var(--subtle-bg) !important;
}

/* ── Footer ── */
.footer {
  border-top: 1px solid var(--border);
  padding: 16px 0;
  margin-top: auto;
  text-align: center;
}

.footer p {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .dashboard { padding: 16px; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .header-subtitle { padding-left: 0; }
}

@media (max-width: 480px) {
  .kpi-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Verify Dash finds the assets directory**

Run: `python -c "from app.dashboard import dash_app; print(dash_app.config.assets_folder)"`

Expected: path ending in `app/assets`

---

## Chunk 2: Dashboard Rewrite

### Task 2: Rewrite `app/dashboard.py`

**Files:**
- Rewrite: `app/dashboard.py`

- [ ] **Step 1: Write the complete new dashboard.py**

Replace the entire file with:

```python
import math
import dash
from dash import dcc, html, Input, Output
import plotly.express as px
import plotly.graph_objects as go

from app.data import get_dataframe, get_industries, remove_outliers

# ---------------------------------------------------------------------------
# Slate palette constants (used in Plotly figures only; CSS handles the rest)
# ---------------------------------------------------------------------------
SL_TEXT      = "#0f172a"
SL_SUBTLE_BG = "#f1f5f9"
SL_BORDER    = "#e2e8f0"
SL_MUTED     = "#94a3b8"
SL_POSITIVE  = "#059669"
SL_NEGATIVE  = "#dc2626"

SLATE_COLORS = [
    "#334155", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
    "#059669", "#64748b", "#dc2626", "#0d9488", "#7c3aed", "#d97706",
    "#2563eb", "#475569", "#be185d", "#0891b2", "#4f46e5", "#78716c",
]

# ---------------------------------------------------------------------------
# Column constants
# ---------------------------------------------------------------------------
SECTOR_COL = "GICS Industry"
MARKET_CAP = "Market Cap (USD)"
PB_RATIO   = "Price to Book Ratio"
YTD        = "% Price Change YTD"
ONE_Y      = "% Price Change 1Y"

METRIC_OPTIONS = [
    {"label": "YTD Price Change (%)", "value": YTD},
    {"label": "1-Year Price Change (%)", "value": ONE_Y},
    {"label": "Avg Market Cap (USD)", "value": MARKET_CAP},
]

# ---------------------------------------------------------------------------
# Plotly layout defaults (reused by both charts)
# ---------------------------------------------------------------------------
_PLOTLY_LAYOUT = dict(
    paper_bgcolor="#ffffff",
    plot_bgcolor="#ffffff",
    font=dict(family="Inter, -apple-system, system-ui, sans-serif", color=SL_TEXT),
    xaxis=dict(gridcolor=SL_SUBTLE_BG, linecolor=SL_BORDER, zerolinecolor=SL_BORDER),
    yaxis=dict(gridcolor=SL_SUBTLE_BG, linecolor=SL_BORDER, zerolinecolor=SL_BORDER),
    margin=dict(l=48, r=24, t=48, b=48),
)

# ---------------------------------------------------------------------------
# Dash app
# ---------------------------------------------------------------------------
dash_app = dash.Dash(
    __name__,
    requests_pathname_prefix="/dashboard/",
    title="Refinitiv Analytics",
    external_stylesheets=[
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    ],
)


# ---------------------------------------------------------------------------
# KPI helpers
# ---------------------------------------------------------------------------
def _build_kpi_cards():
    df = get_dataframe()

    total_cap = df[MARKET_CAP].sum()
    avg_ytd = df[YTD].mean()
    count = len(df)

    top_industry = (
        df.groupby(SECTOR_COL)[YTD]
        .mean()
        .sort_values(ascending=False)
        .head(1)
    )
    top_name = top_industry.index[0] if len(top_industry) else "N/A"
    top_val = top_industry.values[0] if len(top_industry) else 0

    ytd_cls = "kpi-value kpi-value--positive" if avg_ytd >= 0 else "kpi-value kpi-value--negative"
    top_cls = "kpi-value kpi-value--positive" if top_val >= 0 else "kpi-value kpi-value--negative"

    return html.Div(className="kpi-row", children=[
        html.Div(className="kpi-card", children=[
            html.P("Total Market Cap", className="kpi-label"),
            html.P(f"${total_cap / 1e12:.1f}T", className="kpi-value"),
        ]),
        html.Div(className="kpi-card", children=[
            html.P("Avg YTD Change", className="kpi-label"),
            html.P(f"{avg_ytd:+.1f}%", className=ytd_cls),
        ]),
        html.Div(className="kpi-card", children=[
            html.P("Instruments", className="kpi-label"),
            html.P(f"{count:,}", className="kpi-value"),
        ]),
        html.Div(className="kpi-card", children=[
            html.P("Top Industry", className="kpi-label"),
            html.P(top_name, className=top_cls, style={"fontSize": "16px"}),
            html.P(f"{top_val:+.1f}% avg YTD", className="kpi-detail"),
        ]),
    ])


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
dash_app.layout = html.Div(className="dashboard", children=[
    # Header
    html.Div(className="header", children=[
        html.H1(className="header-title", children=[
            html.Span(className="header-dot"),
            "Refinitiv Analytics",
        ]),
        html.P(
            "Global equity data · GICS industry classification",
            className="header-subtitle",
        ),
    ]),

    # KPI cards
    _build_kpi_cards(),

    # Pill tabs
    dcc.Tabs(
        id="tabs",
        value="bubble",
        parent_className="pill-tabs-container",
        className="tab-container",
        children=[
            dcc.Tab(
                label="Bubble Chart",
                value="bubble",
                className="pill-tab",
                selected_className="pill-tab--active",
            ),
            dcc.Tab(
                label="Industry Breakdown",
                value="bar",
                className="pill-tab",
                selected_className="pill-tab--active",
            ),
        ],
    ),

    # Tab content
    html.Div(id="tab-content"),

    # Footer
    html.Div(className="footer", children=[
        html.P("Data: Refinitiv (LSEG) — Global equity instruments, GICS classification"),
        html.P("For academic illustration only. Not investment advice."),
    ]),
])


# ---------------------------------------------------------------------------
# Tab router
# ---------------------------------------------------------------------------
@dash_app.callback(Output("tab-content", "children"), Input("tabs", "value"))
def render_tab(tab):
    if tab == "bubble":
        return _bubble_layout()
    return _bar_layout()


# ---------------------------------------------------------------------------
# Bubble chart
# ---------------------------------------------------------------------------
def _bubble_layout():
    industries = get_industries()
    return html.Div([
        html.Div(className="filter-card", children=[
            html.P("Filter by GICS Industry", className="filter-label"),
            dcc.Dropdown(
                id="bubble-sector-filter",
                options=[{"label": i, "value": i} for i in industries],
                multi=True,
                placeholder="All industries",
            ),
        ]),
        html.Div(className="chart-card", children=[
            dcc.Graph(id="bubble-chart", style={"height": "620px"}),
        ]),
    ])


@dash_app.callback(
    Output("bubble-chart", "figure"),
    Input("bubble-sector-filter", "value"),
)
def update_bubble(selected):
    df = get_dataframe().copy()
    if selected:
        df = df[df[SECTOR_COL].isin(selected)]

    df = remove_outliers(df, [PB_RATIO, YTD])
    df["_size"] = df[MARKET_CAP].apply(lambda x: max(math.log10(x + 1) - 8, 1) if x > 0 else 1)

    fig = px.scatter(
        df,
        x=PB_RATIO,
        y=YTD,
        size="_size",
        color=SECTOR_COL,
        hover_name="Issuer",
        hover_data={"RIC": True, "Exchange": True, MARKET_CAP: ":,.0f", "_size": False},
        labels={PB_RATIO: "Price / Book Ratio", YTD: "YTD Price Change (%)"},
        title="Price-to-Book vs YTD Performance",
        template="plotly_white",
        color_discrete_sequence=SLATE_COLORS,
    )
    fig.update_layout(
        **_PLOTLY_LAYOUT,
        title=dict(font=dict(size=16, color=SL_TEXT)),
        legend=dict(
            bgcolor="#ffffff",
            bordercolor=SL_BORDER,
            borderwidth=1,
            font=dict(size=11, color=SL_TEXT),
        ),
    )
    fig.add_hline(y=0, line_dash="dot", line_color=SL_BORDER, line_width=1)
    return fig


# ---------------------------------------------------------------------------
# Bar chart (Industry Breakdown)
# ---------------------------------------------------------------------------
def _bar_layout():
    return html.Div([
        html.Div(className="filter-card", children=[
            html.P("Metric", className="filter-label"),
            dcc.Dropdown(
                id="bar-metric",
                options=METRIC_OPTIONS,
                value=YTD,
                clearable=False,
            ),
        ]),
        html.Div(className="chart-card", children=[
            dcc.Graph(id="bar-chart", style={"height": "560px"}),
        ]),
    ])


@dash_app.callback(
    Output("bar-chart", "figure"),
    Input("bar-metric", "value"),
)
def update_bar(metric):
    df = get_dataframe().copy()

    if metric != MARKET_CAP:
        df = remove_outliers(df, [metric])

    label = next(o["label"] for o in METRIC_OPTIONS if o["value"] == metric)
    agg = df.groupby(SECTOR_COL)[metric].mean().dropna().sort_values(ascending=False).reset_index()
    agg.columns = [SECTOR_COL, metric]

    colors = [SL_POSITIVE if v >= 0 else SL_NEGATIVE for v in agg[metric]]
    fig = go.Figure(go.Bar(
        x=agg[SECTOR_COL],
        y=agg[metric],
        marker_color=colors,
        hovertemplate="%{x}<br>" + label + ": %{y:.2f}<extra></extra>",
    ))
    fig.update_layout(
        **_PLOTLY_LAYOUT,
        title=dict(text=f"Average {label} by GICS Industry", font=dict(size=16, color=SL_TEXT)),
        xaxis_title="GICS Industry",
        yaxis_title=label,
        template="plotly_white",
        xaxis=dict(tickangle=-40, tickfont=dict(size=10), gridcolor=SL_SUBTLE_BG, linecolor=SL_BORDER, zerolinecolor=SL_BORDER),
    )
    fig.add_hline(y=0, line_dash="dot", line_color=SL_BORDER, line_width=1)
    return fig
```

- [ ] **Step 2: Verify the app starts without errors**

Run: `cd C:\Users\KS-ROG\Desktop\data-analytics-server && timeout 8 python -c "from app.dashboard import dash_app; print('Layout OK:', type(dash_app.layout).__name__)"`

Expected: `Layout OK: Div`

- [ ] **Step 3: Start the dev server and verify visually**

Run: `python run.py`

Open `http://localhost:8050` in browser. Verify:
- Slate background, Inter font loaded
- 4 KPI cards with real data
- Pill-style tabs (Bubble Chart / Industry Breakdown)
- Bubble chart renders with slate color palette
- Industry Breakdown tab renders bar chart
- Footer with data attribution and disclaimer
- No Data Table tab

- [ ] **Step 4: Commit**

```bash
git add app/assets/style.css app/dashboard.py
git commit -m "redesign: slate minimal theme with KPI cards, pill tabs, footer

- Replace FT-inspired inline styles with external CSS stylesheet
- Add 4 KPI summary cards (market cap, avg YTD, instruments, top industry)
- Convert to pill-style tabs, rename Bar Chart to Industry Breakdown
- Remove data table tab (data agreement compliance)
- Add footer with Refinitiv attribution and academic disclaimer
- Load Inter font via Google Fonts CDN"
```
