import pandas as pd
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent / "refinitiv" / "data.csv"

_df = None  # type: pd.DataFrame


def get_dataframe() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = _load()
    return _df


def _load() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)

    # Normalise column names
    df.columns = [c.strip() for c in df.columns]

    # Identify the actual column names present
    col_map = {}
    for col in df.columns:
        lc = col.lower()
        if "market cap" in lc:
            col_map[col] = "Market Cap (USD)"
        elif "price to book" in lc:
            col_map[col] = "Price to Book Ratio"
        elif "year to date" in lc and "relative" not in lc:
            col_map[col] = "% Price Change YTD"
        elif "relative to index" in lc:
            col_map[col] = "% Price Change vs Index YTD"
        elif "relative to sector" in lc:
            col_map[col] = "% Price Change vs Sector YTD"
        elif "1y" in lc or "1 y" in lc:
            col_map[col] = "% Price Change 1Y"
    df.rename(columns=col_map, inplace=True)

    # Extract GICS Industry (3rd component: Sector > Industry Group > Industry > Sub-Industry)
    if "GICS Sector" in df.columns:
        df["GICS Industry"] = df["GICS Sector"].apply(_parse_gics_industry)

    # Cast numeric columns, coercing errors to NaN
    numeric_cols = [
        "Market Cap (USD)",
        "Price to Book Ratio",
        "% Price Change YTD",
        "% Price Change vs Index YTD",
        "% Price Change vs Sector YTD",
        "% Price Change 1Y",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df.dropna(subset=["Market Cap (USD)", "Price to Book Ratio"], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def _parse_gics_industry(value) -> str:
    """Extract the Industry level (3rd part) from GICS full path string."""
    if not isinstance(value, str):
        return "Unknown"
    parts = [p.strip() for p in value.split(",")]
    if len(parts) >= 3:
        return parts[2]
    if len(parts) >= 2:
        return parts[1]
    return parts[0] if parts else "Unknown"


def remove_outliers(df: pd.DataFrame, cols: list, iqr_factor: float = 1.5) -> pd.DataFrame:
    """Remove rows where any of the given numeric columns fall outside IQR bounds."""
    mask = pd.Series([True] * len(df), index=df.index)
    for col in cols:
        if col not in df.columns:
            continue
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        mask &= df[col].between(q1 - iqr_factor * iqr, q3 + iqr_factor * iqr)
    return df[mask]


def get_industries() -> list:
    df = get_dataframe()
    return sorted(df["GICS Industry"].dropna().unique().tolist())
