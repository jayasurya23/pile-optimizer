# ADR-0005: Export a three-sheet workbook as the downstream contract

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Results are consumed outside the app. The downstream CAD workflow reconstructs each tracker from its two end piles ("The tube is fully defined by its two ends, which is what the downstream CAD workflow wants", `README.md`). Engineers also need per-pile detail and a record of the parameters that produced the numbers.

## Decision

Export `TrackerOptimization_Results.xlsx` with three sheets:

- **Optimization Results**: one row per pile, ordered north to south within each tracker to match the convention of the source files. Columns: Tracker ID, Northing, Easting, Existing Ground, Top of Pile, Pile Reveal, Solution Type, Final FG, Ground Adj, Cut / Fill, Tube Slope, Slope Delta.
- **Tracker Ends**: TrackerID, North Pile TOP, South Pile TOP.
- **Design Parameters**: target, minimum and maximum reveal, maximum tube slope and slope delta, run date, totals, and counts by solution class.

Solution classes are exported through `classifyMethod`: Straight Line, Optimized (no regrade), Needs Regrade. Tube Slope and Slope Delta are always written when defined, because they are the governing geometry checks.

## Options considered

No alternatives are recorded.

## Consequences

**Positive**

- CAD receives the end elevations directly.
- The parameter snapshot travels with the numbers.

**Negative or to watch**

- The file name is constant, so repeated exports overwrite each other in the download folder. The structural tool stamps job number and date into its file name (`FINDINGS.md` section 5).
- The header fill and banded rows set in code use a SheetJS Pro feature and are ignored by the Community Edition build, so they do not appear (`FINDINGS.md` section 5).
- Design Parameters records the reveal and tube limits but not the adjacency limits, the grading preference, or whether per-pile limits were used. Slope values are rounded to 0.1 % there.
- The help text inside the app still says the workbook has two sheets.

## Evidence

- `src/App.jsx`: `exportXLSX`, `classifyMethod`.
- `README.md` (Output); `docs/FINDINGS.md` sections 2, 3 and 5.
