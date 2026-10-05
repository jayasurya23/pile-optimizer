# ADR-0003: Layered solver: a per-tracker cascade followed by a global site solve

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Each tracker row is a north-south torque tube on flex joints. It must keep every pile's reveal inside a window, stay within a maximum slope, and keep the change in slope between spans (flex-joint rotation) within a limit. Neighbouring rows add coupling constraints: the difference in end elevations between rows end to end (N-S) and the slope between adjacent rows side by side (E-W). The preferred outcome is no earthwork; where earthwork is unavoidable it should be small.

The engine predates this repository. It was imported as "v1.1" in `dbb072c` and left untouched.

## Decision

Solve in two stages.

**Stage 1, per tracker (`optimizeTracker`).** Step 1: a straight line (least-squares fit of the ground plus the target reveal), accepted if every reveal is inside the window. Step 2, "Terrain Follow (No Grade)": ADMM with a Cholesky solve minimizing the sum of squared slope changes subject to the reveal window and slope limits, accepted if the slope-change limit is met. Step 3, "Terrain Follow (w/ Grade)": start from the average of ground-plus-target and the straight line, clamp slopes and slope changes (up to 20 passes), then rotate and shift the tube (200 rotation steps, bisection so cut equals fill) to minimize earthwork; the ground is adjusted where a reveal is still out of bounds.

**Stage 2, global site solve (`buildGlobalSolver`).** The per-tracker results seed Gauss-Seidel sweeps over all rows (alternating direction, at most 80 sweeps, stopping when the largest move is 0.003 ft or less). Each row is re-solved with ADMM against its per-pile reveal boxes, the slope and slope-change limits, and bands derived from its neighbours' current positions (N-S end bands and E-W pile bands). The primary objective is the smoothest tube (slope-change weight 1e4); the target reveal is only a tie-break.

Slope and slope change are treated as inviolable. If coupling bands make a row infeasible they are dropped and the cross-row limits become flags. If the reveal boxes still conflict, interior boxes yield (end piles keep theirs) and the violation is reported as regrade (cut/fill) amounts, labelled "Requires Regrade".

Optional N-S and E-W corrections then operate on the stored results (see [ADR-0014](0014-save-results-and-hydrate.md)).

## Options considered

No alternative algorithms are recorded. Code comments do record three design findings: E-W corrections use bands rather than fixed values because "hard-fixing corrected piles caused slope-delta violations between them that the smoother was forbidden from repairing"; the Step 3 starting blend "consistently outperforms either alone" (roughly 2x less earthwork on steep terrain); and the global objective makes smoothness primary and target reveal secondary.

## Consequences

**Positive**

- Prefers solutions with no earthwork; physical limits (slope, flex-joint rotation) are never traded away for reveal.
- Cross-row constraints are solved jointly rather than row by row.
- The per-tracker stage explains itself in the interface (method text and decision path).

**Negative or to watch**

- Each row uses dense matrices (cost grows with the square of the piles in a row), and up to 80 sweeps cover all rows. The global stage dominates run time.
- The two stages emit different method labels ("Terrain Follow (...)" versus "Pile Plan (Global)" and "Requires Regrade"); `classifyMethod` maps them onto three buckets.
- The interface keeps two result sets: the per-tracker `results` shown on the Profile, Slope and Piles tabs, and the site-wide `allResults` used by Fleet, Adjacency, export and saved runs. They can differ (reproduced in a browser: issue K2 in the Technical Documentation).
- Tuning constants (penalty parameters, iteration caps, tolerances, margins) are embedded in code with limited rationale, and the engine has no automated tests.

## Evidence

- `src/App.jsx`: `optimizeTracker`, `balanceCutFillRotate`, `buildGlobalSolver`, `applyNSCorrections`, `applyEWCorrections`, `classifyMethod`.
- `docs/FINDINGS.md`; commit `dbb072c` ("3-step per-tracker solve + global site coupling").
