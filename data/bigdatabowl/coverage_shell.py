"""coverage-shell.json — coverage-type and shell distribution by offensive formation.

Source: BDB 2023 plays.csv, which carries PFF labels for every passing play
(`pff_passCoverageType` = Man/Zone/Other, `pff_passCoverage` = specific shell).
Covers roughly 8.5k plays from weeks 1-8 of the 2021 season. Consumers use
these priors to sample a defensive shell pre-snap given the offensive
formation.
"""

from __future__ import annotations

import csv

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

# Map raw PFF labels to the sim's canonical CoverageShell enum values.
SHELL_MAP = {
    "Cover-0": "COVER_0",
    "Cover-1": "COVER_1",
    "Cover-2": "COVER_2",
    "Cover-3": "COVER_3",
    "Cover-6": "COVER_6",
    "Quarters": "QUARTERS",
    "2-Man": "TWO_MAN",
    "Bracket": "OTHER",
    "Red Zone": "OTHER",
    "Prevent": "OTHER",
    "Goal Line": "OTHER",
    "Miscellaneous": "OTHER",
}
TYPE_MAP = {"Zone": "zone", "Man": "man", "Other": "other"}


def main() -> None:
    overall_type: Counter = Counter()
    overall_shell: Counter = Counter()
    by_form_type: dict[str, Counter] = defaultdict(Counter)
    by_form_shell: dict[str, Counter] = defaultdict(Counter)
    totals: Counter = Counter()

    with open(BDB_DATA_ROOT / "2023" / "plays.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            form = row["offenseFormation"] or ""
            if form not in FORMATIONS:
                continue
            cov_type = TYPE_MAP.get(row["pff_passCoverageType"] or "", None)
            shell = SHELL_MAP.get(row["pff_passCoverage"] or "", None)
            if cov_type is None or shell is None:
                continue
            overall_type[cov_type] += 1
            overall_shell[shell] += 1
            by_form_type[form][cov_type] += 1
            by_form_shell[form][shell] += 1
            totals[form] += 1

    bands = {
        "overall": {
            "n": sum(totals.values()),
            "type": rate_distribution(overall_type),
            "shell": rate_distribution(overall_shell),
        },
        "by_formation": {},
    }
    for form in FORMATIONS:
        n = totals[form]
        if n < MIN_N:
            continue
        bands["by_formation"][form] = {
            "n": n,
            "type": rate_distribution(by_form_type[form]),
            "shell": rate_distribution(by_form_shell[form], min_share=0.005),
        }

    notes = (
        "Defensive coverage priors by offensive formation on passing plays. "
        "PFF labels via BDB 2023 plays.csv (2021 season, weeks 1-8, 8.5k "
        "passing plays). `type` is the Man/Zone/Other split; `shell` is the "
        "specific call (COVER_0/1/2/3, QUARTERS, COVER_6, TWO_MAN, OTHER). "
        f"Formations with n<{MIN_N} are omitted. JUMBO and PISTOL may fall "
        "under threshold — fall back to `overall` in that case. The sim "
        "samples shell pre-snap given the offensive formation; concept × "
        "shell fit then drives the pass matchup shift."
    )
    path = BANDS_DIR / "coverage-shell.json"
    write_band(
        path,
        sources=["BDB 2023 plays.csv (2021 passing plays, PFF-labeled)"],
        bands=bands,
        notes=notes,
    )
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
