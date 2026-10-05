# ADR-0002: Run the optimizer in the browser; the server only stores

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

The optimizer and its Excel import and export were written as a client-side application (React and SheetJS). Users import a `.xlsx` or `.csv` of pile locations, adjust limits, and iterate. Sites can be large: the code comments target fleets of up to 200,000 piles (about 14,000 trackers). The input is project survey data. The deployed replica is small (0.25 vCPU, 0.5 GiB).

## Decision

File parsing, the per-tracker and global optimization, adjacency checks and corrections, and the Excel export all run in the user's browser. Work is done on the main thread in chunks (50 trackers per `setTimeout` tick, then solver sweeps) so the interface stays responsive.

The server never computes. It authenticates the caller, stores snapshots of sessions the user chooses to save, and returns them. Pile data leave the user's machine only when they press **Save Run**.

## Options considered

No alternatives are recorded in the repository. The record shows the engine was imported as-is ("The numerical engine ... is untouched", `dbb072c`) and the hosting was sized for storage rather than compute.

## Consequences

**Positive**

- Pile data are not uploaded unless the user saves a run.
- The server stays small and cheap; compute capacity scales with the number of users' machines.
- Interactivity: changing a limit re-solves locally with no round trip.

**Negative or to watch**

- Solve time depends on the user's machine and runs on the browser's main thread. 180 piles took about 30 s on the first run, and the 200,000-pile target has not been timed (`FINDINGS.md` section 5).
- There is no server-side engine, so results cannot be recomputed or verified on the server. Saved runs must therefore carry the solved results (see [ADR-0014](0014-save-results-and-hydrate.md)).
- Very large sites are bounded by browser memory and by the 32 MiB compressed snapshot ceiling ([ADR-0013](0013-snapshot-storage-format.md)).

## Evidence

- `docs/DEPLOYMENT.md`: "Parsing, optimization and export all still happen in the browser. The server never computes; it stores."
- `server/main.py` module docstring: "The optimisation still happens entirely in the browser."
- `src/App.jsx`: `optimizeTracker`, `buildGlobalSolver`, and the chunked fleet effect.
- `docs/FINDINGS.md` section 5 (solve time); commit `dbb072c`.
