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
            "Global equity data \u00b7 GICS industry classification",
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
        html.P("Data: Refinitiv (LSEG) \u2014 Global equity instruments, GICS classification"),
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
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font=dict(family="Inter, -apple-system, system-ui, sans-serif", color=SL_TEXT),
        margin=dict(l=48, r=24, t=48, b=48),
        title=dict(text=f"Average {label} by GICS Industry", font=dict(size=16, color=SL_TEXT)),
        xaxis_title="GICS Industry",
        yaxis_title=label,
        template="plotly_white",
        xaxis=dict(tickangle=-40, tickfont=dict(size=10), gridcolor=SL_SUBTLE_BG, linecolor=SL_BORDER, zerolinecolor=SL_BORDER),
        yaxis=dict(gridcolor=SL_SUBTLE_BG, linecolor=SL_BORDER, zerolinecolor=SL_BORDER),
    )
    fig.add_hline(y=0, line_dash="dot", line_color=SL_BORDER, line_width=1)
    return fig
