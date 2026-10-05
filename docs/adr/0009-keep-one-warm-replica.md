# ADR-0009: Keep one warm replica (no scale to zero)

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Container Apps scales to zero after a 5-minute cooldown, so the first request after any idle period paid an image pull and container start before anything rendered. The measured delay was about 40 s. The deploy workflow also re-asserted `--min-replicas 0` on every deploy, so a manual fix on the live app would have been reverted by the next push.

## Decision

Deploy with `--min-replicas 1 --max-replicas 2`, set in the workflow as well as on the live app.

## Options considered

**Scale to zero.** Rejected: about 40 s to first render after idle.

## Consequences

**Positive**

- First byte measured at 114 to 179 ms.
- The setting is in code, so a deploy cannot revert it.

**Negative or to watch**

- About $6 per month for the always-on replica.

## Evidence

- Commit `403eddb`; `.github/workflows/deploy.yml` ("Deploy new revision").
