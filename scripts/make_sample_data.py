"""Generate a deterministic sample/test dataset in the app's input format.

Written to public/ so it ships with the app as a downloadable format template
and doubles as the browser test fixture.

Layout: 4 rows (eastings) x 3 trackers each, 15 piles per tracker at ~27.1 ft
northing spacing. Terrain mixes a gentle plane, a rolling swale, and a steep
ridge so the export exercises all three solver paths (straight line, terrain
follow without grading, terrain follow with grading).
"""
import math
from pathlib import Path

from openpyxl import Workbook

OUT = Path(__file__).resolve().parents[1] / "public" / "sample-pile-data.xlsx"

N0 = 548077.0          # first pile northing
DN = 27.0977           # pile spacing along the tracker (ft)
PILES = 15
E0 = 2525548.547       # first row easting
DE = 24.9              # E-W pile spacing between adjacent tracker rows
ROWS = 4               # tracker rows across (eastings)
BLOCKS = 3             # tracker blocks along northing


def ground(n: float, e: float) -> float:
    """Synthetic but well-behaved terrain: a tilted plane + a swale + a ridge."""
    x = (n - N0) / 100.0
    y = (e - E0) / 100.0
    plane = 461.0 - 0.55 * y + 0.30 * x
    swale = -1.9 * math.exp(-(((x - 1.6) ** 2) / 0.65 + ((y - 0.55) ** 2) / 1.5))
    ridge = 3.4 * math.exp(-(((x - 3.4) ** 2) / 0.9 + ((y - 1.5) ** 2) / 2.2))
    ripple = 0.06 * math.sin(x * 5.1) * math.cos(y * 3.7)
    return plane + swale + ridge + ripple


def main() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Pile Layout"
    ws.append(["TrackerID", "Northing", "Easting", "ExistingGround",
               "MinReveal", "MaxReveal"])

    count = 0
    for row in range(ROWS):
        easting = E0 + row * DE
        for block in range(BLOCKS):
            tracker = f"{block + 1}-{row * 12 + 1}"
            base_n = N0 + block * (PILES * DN + 18.0)   # 18 ft gap between blocks
            for p in range(PILES):
                northing = base_n + p * DN
                elev = ground(northing, easting)
                # Per-pile allowable reveal box. Most piles use the standard
                # 2.0-6.0 ft window; the two end piles of each tracker are held
                # tighter, which is what the per-pile columns exist to express.
                if p in (0, PILES - 1):
                    mn, mx = 2.5, 5.5
                else:
                    mn, mx = 2.0, 6.0
                ws.append([tracker, round(northing, 4), round(easting, 4),
                           round(elev, 4), mn, mx])
                count += 1

    for col, width in zip("ABCDEF", (14, 14, 14, 16, 12, 12)):
        ws.column_dimensions[col].width = width

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f"wrote {OUT} — {count} piles, {ROWS * BLOCKS} trackers")


if __name__ == "__main__":
    main()
