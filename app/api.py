"""Compute the pre-aggregated JSON payload for /api/data."""

from __future__ import annotations
from datetime import date

from app.data import get_dataframe
from app.exchange_map import lookup as exchange_lookup

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
    low = industry.lower()
    for family, keywords in _FAMILY_RULES:
        if any(kw.lower() in low for kw in keywords):
            return family
    return "Other"


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


def build_data() -> dict:
    df = get_dataframe()
    return {
        "geography": _build_geography(df),
        "industries": _build_industries(df),
        "performance": _build_performance(df),
        "saaspocalypse": _build_saaspocalypse(df),
        "meta": _build_meta(df),
    }


def _build_geography(df) -> list[dict]:
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
    result = []
    for _, row in df.iterrows():
        industry = row.get("GICS Industry", "Unknown")
        ytd = row.get("% Price Change YTD")
        one_y = row.get("% Price Change 1Y")
        result.append({
            "issuer": row["Issuer"],
            "industry": industry,
            "sector_family": sector_family(industry),
            "ytd": round(float(ytd), 2) if not (ytd != ytd) else None,
            "one_y": round(float(one_y), 2) if not (one_y != one_y) else None,
            "cap": float(row["Market Cap (USD)"]),
        })
    return result


def _build_saaspocalypse(df) -> dict:
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
    return {
        "total_instruments": int(len(df)),
        "total_cap_trillions": round(float(df["Market Cap (USD)"].sum()) / 1e12, 1),
        "avg_ytd": round(float(df["% Price Change YTD"].mean()), 1),
        "date": str(date.today()),
    }
