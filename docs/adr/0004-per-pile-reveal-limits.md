# ADR-0004: Per-pile reveal limits override the global sliders

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Allowable reveal (pile height above existing ground) varies by pile in real designs, for example tighter limits at tracker end piles. The input format can carry `MinReveal` and `MaxReveal` per pile, while the interface also offers global Min and Max Reveal sliders.

## Decision

When a pile row supplies `MinReveal` and `MaxReveal`, they define a hard box [existing ground + Min, existing ground + Max] for that pile in the global solve. The sliders apply only to piles that have no per-pile value.

For the per-tracker warm start, a tracker uses its tightest file bounds (largest Min, smallest Max; collapsed to the midpoint if they cross) only when every pile in the tracker has both values.

CSV and XLSX imports accept the same aliases (`MinReveal`, `min_reveal`, `min reveal`, `minimumreveal`, `minimum reveal`, `minrev`, and the Max equivalents).

## Options considered

No alternatives are recorded. A defect is: the XLSX import path silently ignored the columns while CSV honoured them. It was fixed in `dbb072c` and verified on the 180-pile sample, where the maximum reveal became 5.50 ft instead of the 6.00 ft slider value (`FINDINGS.md` section 1).

## Consequences

**Positive**

- Engineers can encode project-specific tolerances in the data.
- Both import paths now behave the same.

**Negative or to watch**

- Sliders can be overridden without notice: the interface does not show that per-pile limits are in effect.
- The tick and warning marks on the Piles and Fleet tabs compare reveals against the slider limits, not the per-pile boxes the solver used (from code review), so the marks can disagree with the limits actually applied.
- Partially filled columns are accepted; piles without values fall back to the sliders individually.

## Evidence

- `src/App.jsx`: `normalizeRow`, `handleFile` (XLSX alias lists), `optimizeTracker` (warm-start bounds), `buildGlobalSolver` (`minB`, `maxB`).
- `docs/FINDINGS.md` section 1; `public/sample-pile-data.xlsx`; `scripts/make_sample_data.py`.
