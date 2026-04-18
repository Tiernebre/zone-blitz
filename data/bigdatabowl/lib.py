"""Shared helpers for Big Data Bowl band-generation scripts.

Mirrors the R helpers in ../R/lib.R: consistent band envelope, consistent
rounding. Scripts live per band and write into ../bands/.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import statistics
from collections import Counter, defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BDB_DATA_ROOT = Path(os.environ.get("BDB_DATA_ROOT", Path.home() / "data" / "bigdatabowl"))
BANDS_DIR = REPO_ROOT / "data" / "bands"


def _round(x: float, digits: int = 4) -> float:
    return round(float(x), digits)


def rate_distribution(counts: Counter, min_share: float = 0.0) -> dict:
    """Convert a count map into a rate map, dropping entries below min_share."""
    total = sum(counts.values())
    if total == 0:
        return {}
    out = {}
    for key, n in counts.most_common():
        share = n / total
        if share < min_share:
            continue
        out[str(key)] = _round(share)
    return out


def distribution_summary(values: list) -> dict:
    """Same shape as R's distribution_summary()."""
    vs = [v for v in values if v is not None]
    if not vs:
        return {"n": 0}
    vs_sorted = sorted(vs)
    def q(p: float) -> float:
        return vs_sorted[min(len(vs_sorted) - 1, int(p * len(vs_sorted)))]
    return {
        "n": len(vs),
        "mean": _round(statistics.mean(vs)),
        "sd": _round(statistics.stdev(vs)) if len(vs) > 1 else 0.0,
        "min": min(vs),
        "p10": q(0.10),
        "p25": q(0.25),
        "p50": q(0.50),
        "p75": q(0.75),
        "p90": q(0.90),
        "max": max(vs),
    }


def write_band(path: Path, sources: list[str], bands: dict, notes: str) -> None:
    envelope = {
        "generated_at": _dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": sources,
        "notes": notes,
        "bands": bands,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope, indent=2) + "\n")


__all__ = [
    "BDB_DATA_ROOT",
    "BANDS_DIR",
    "Counter",
    "defaultdict",
    "distribution_summary",
    "rate_distribution",
    "write_band",
]
