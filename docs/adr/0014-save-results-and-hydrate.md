# ADR-0014: Save the solved results with the inputs; reopen without re-solving

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

After the deterministic solve, engineers can apply N-S and E-W corrections that change the results. Those corrections cannot be replayed from the inputs alone. A reopened run must show the numbers that were on screen when it was saved. Re-solving would also be slow for large sites.

## Decision

The snapshot contains the constraints, the raw inputs, every tracker's results, the selected tracker and the E-W anchors. Opening a run installs the stored results through `pendingHydrateRef`; the fleet effect consumes it and skips the solve. Saving is blocked while a solve or file parse is running, because a snapshot taken mid-solve would pair new constraints with old results. A version saved without results is marked `inputs_only`.

## Options considered

**Re-solve on open.** Rejected: it would silently discard the corrections (`c299e84`).

## Consequences

**Positive**

- Exact reproduction of what was saved; corrections survive; fast open.

**Negative or to watch**

- Stored results are not re-validated against newer engine versions; each version records the build id (`app_build`) for traceability.
- Changing any constraint after opening a run re-solves the site and discards the saved corrections, because the solve effect depends on the constraints.
- The Revert buttons for N-S and E-W corrections are not restored on reopening; their undo snapshots are not saved.

## Evidence

- `src/runs.js`; `src/App.jsx` (`openSnapshot`, `pendingHydrateRef`, the fleet effect); `src/RunPanel.jsx`; `server/store.py` (`status`).
- Commit `c299e84`.
