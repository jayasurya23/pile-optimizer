# ADR-0012: Persist runs as append-only versions with optimistic concurrency

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Engineers need to save, name, reopen and hand over runs, and several people may work on the same site. A lost update would silently discard hours of work. The sister tool `structcalc` uses the same lineage model.

## Decision

Two tables: `civil_runs` (mutable metadata: name, project, owner, archived flag, current version number, last-saved fields) and `civil_run_versions` (one immutable row per save, unique on `(run_id, version_no)`). Every save appends a version.

The client sends `base_version_no`, the head version it last loaded. The server locks the run row (`SELECT ... FOR UPDATE`) and compares it with `current_version_no`. A mismatch is a 409; the client refreshes its base and the user presses Save again, which appends their work as the next version.

Anyone may append a version. Renaming the run or changing its project is ignored unless the saver is the owner or a listed administrator, and archive and restore are owner or administrator only (403 otherwise). Opening an older version does not move the base, so saving from it appends a new head.

Each version records engineer, checker, note, saver (id, UPN, name), the build id (`GIT_SHA`), pile and tracker counts, and a status of `complete` or `inputs_only`.

## Options considered

No alternatives are recorded; the `structcalc` lineage model is the stated precedent.

## Consequences

**Positive**

- No lost work, a full audit trail, and the same model as the sister tool.

**Negative or to watch**

- There is no delete and no retention policy: versions accumulate (under 1 MB each for a 200,000-pile fleet, by measurement) and archiving only hides a run.
- Reading is open to every authenticated staff member; there is no per-run read control.
- A non-owner's rename attempt is dropped without telling them.
- Row locking has no effect on SQLite (development and tests), and the tests check the stale-version conflict logically, not under concurrent writers.

## Evidence

- `server/store.py` (`append_version`, `require_can_manage`); `server/main.py`; `server/tests/test_runs.py`; `src/RunPanel.jsx`.
- Commit `c299e84`.
