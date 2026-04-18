"""formation-box.json — box-count distribution by offensive formation.

Combines BDB 2020 (rushing plays, 2017 season, n~31k) and BDB 2021 (passing
plays, 2018 season, n~19k) to get the defender-in-the-box distribution the
defense calls against each formation, split by play type. Also derives the
linear YPC slope per extra defender in the box from the 2020 rushing grid —
the sim uses this as the run-matchup shift component for box count.
"""

from __future__ import annotations

import csv
import statistics
from pathlib import Path

from lib import (
    BANDS_DIR,
    BDB_DATA_ROOT,
    Counter,
    defaultdict,
    rate_distribution,
    write_band,
)


FORMATIONS = ("SHOTGUN", "EMPTY", "SINGLEBACK", "I_FORM", "PISTOL", "JUMBO")
MIN_N = 100


def run_distribution() -> dict:
    """Box counts + YPC on rushing plays (BDB 2020 train.csv)."""
    by_form_box: dict[str, Counter] = defaultdict(Counter)
    ypc_cells: dict[tuple[str, int], list[int]] = defaultdict(list)
    totals: Counter = Counter()
    seen: set[tuple[str, str]] = set()
    with open(BDB_DATA_ROOT / "2020" / "train.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row["GameId"], row["PlayId"])
            if key in seen:
                continue
            seen.add(key)
            form = row["OffenseFormation"] or ""
            if form not in FORMATIONS:
                continue
            try:
                box = int(row["DefendersInTheBox"])
                yards = int(row["Yards"])
            except (TypeError, ValueError):
                continue
            by_form_box[form][box] += 1
            ypc_cells[(form, box)].append(yards)
            totals[form] += 1

    by_formation = {}
    for form in FORMATIONS:
        n = totals[form]
        if n < MIN_N:
            continue
        boxes = [b for b, c in by_form_box[form].items() for _ in range(c)]
        by_formation[form] = {
            "n": n,
            "mean_box": round(statistics.mean(boxes), 3),
            "distribution": rate_distribution(by_form_box[form], min_share=0.005),
        }

    slope = _ypc_slope(ypc_cells)
    return {"by_formation": by_formation, "ypc_slope_per_defender": slope}


def pass_distribution() -> dict:
    """Box counts on passing plays (BDB 2021 plays.csv)."""
    by_form_box: dict[str, Counter] = defaultdict(Counter)
    totals: Counter = Counter()
    with open(BDB_DATA_ROOT / "2021" / "plays.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            form = row["offenseFormation"] or ""
            if form not in FORMATIONS:
                continue
            try:
                box = int(row["defendersInTheBox"])
            except (TypeError, ValueError):
                continue
            by_form_box[form][box] += 1
            totals[form] += 1

    by_formation = {}
    for form in FORMATIONS:
        n = totals[form]
        if n < MIN_N:
            continue
        boxes = [b for b, c in by_form_box[form].items() for _ in range(c)]
        by_formation[form] = {
            "n": n,
            "mean_box": round(statistics.mean(boxes), 3),
            "distribution": rate_distribution(by_form_box[form], min_share=0.005),
        }
    return {"by_formation": by_formation}


def _ypc_slope(cells: dict[tuple[str, int], list[int]]) -> dict:
    """Pooled within-formation regression: how much YPC drops per extra defender.

    Each (formation, box) cell contributes its mean YPC; we pool cells with
    n >= 30 and regress mean_ypc ~ box_offset_from_formation_mean. Reports the
    slope, intercept, and r (for sanity).
    """
    points: list[tuple[float, float, int]] = []
    per_form_mean_box: dict[str, float] = {}
    per_form_boxes: dict[str, list[int]] = defaultdict(list)
    for (form, box), yards in cells.items():
        per_form_boxes[form].extend([box] * len(yards))
    for form, boxes in per_form_boxes.items():
        per_form_mean_box[form] = statistics.mean(boxes)

    for (form, box), yards in cells.items():
        if len(yards) < 30:
            continue
        offset = box - per_form_mean_box[form]
        points.append((offset, statistics.mean(yards), len(yards)))

    total_w = sum(w for _, _, w in points)
    mean_x = sum(x * w for x, _, w in points) / total_w
    mean_y = sum(y * w for _, y, w in points) / total_w
    num = sum(w * (x - mean_x) * (y - mean_y) for x, y, w in points)
    den = sum(w * (x - mean_x) ** 2 for x, _, w in points)
    slope = num / den
    intercept = mean_y - slope * mean_x
    var_y = sum(w * (y - mean_y) ** 2 for _, y, w in points)
    r = num / (den * var_y) ** 0.5 if den and var_y else 0.0

    return {
        "slope_ypc_per_defender": round(slope, 4),
        "intercept_ypc": round(intercept, 4),
        "r": round(r, 4),
        "n_cells": len(points),
    }


def main() -> None:
    bands = {"run": run_distribution(), "pass": pass_distribution()}
    notes = (
        "Box-count (defenders in the box) distribution by offensive formation, "
        "split by play type. Run side from BDB 2020 (2017 season rushing plays, "
        "31k unique plays after dedup from 22-row-per-play tracking); pass side "
        "from BDB 2021 (2018 season passing plays, 19k plays). Formations with "
        f"n<{MIN_N} in a given play-type window are omitted. `mean_box` is the "
        "per-formation expected defender count — the sim should tilt the run "
        "matchup shift by (sampled_box - mean_box_for_formation) × "
        "`ypc_slope_per_defender`. Slope is a weighted within-formation "
        "regression of mean YPC against box count, pooling (formation, box) "
        "cells with n>=30."
    )
    path = BANDS_DIR / "formation-box.json"
    write_band(
        path,
        sources=[
            "BDB 2020 train.csv (2017 rushing plays)",
            "BDB 2021 plays.csv (2018 passing plays)",
        ],
        bands=bands,
        notes=notes,
    )
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
