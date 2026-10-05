# ADR-0015: PostgreSQL in production, SQLite for local development only; no silent fallback without DATABASE_URL

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Container filesystems are ephemeral. SQLite inside the container "would 'work' and then lose every run on the next revision."

## Decision

Production uses a dedicated PostgreSQL flexible server, `castillo-civil-db`, database `civil`, reached through the container-app secret `db-url` exposed as `DATABASE_URL`. A dedicated server follows the same trust-boundary reasoning as `structcalc`'s.

In `engine()`, a missing `DATABASE_URL` raises `RuntimeError` unless `LOCAL_DEV_MODE` is set, in which case SQLite (`CIVIL_SQLITE_PATH`, default `civil.db`) is used. The engine is created lazily on the first database call, so the process still starts and `/healthz` stays up; every database-backed request then fails with HTTP 500 instead of quietly writing to a local file. Tables are created on first use (`create_all`). The PostgreSQL pool is 3 connections plus 2 overflow with a 10 s timeout, pre-ping and a 30-minute recycle. CI asserts the secret reference on every deploy.

## Options considered

**A SQLite fallback in the container.** Rejected explicitly: it would lose data silently.

Sharing `structcalc`'s database server: not used. `DEPLOYMENT.md` records a dedicated server, citing the same trust-boundary reasoning.

## Consequences

**Positive**

- A loud failure instead of silent data loss; durable storage; the same pattern as `structcalc`.

**Negative or to watch**

- `/healthz` does not touch the database, so a missing or invalid database setting looks healthy while every save fails. That is why CI asserts the secret reference.
- There is no migration tool. `create_all` creates missing tables but never alters existing ones, so schema changes need a manual procedure.
- Tests run on SQLite only, so PostgreSQL-specific behaviour (row locks, binary columns) is not covered.
- `psycopg2-binary` is installed on Linux only (requirements marker), so local development elsewhere uses SQLite.

## Evidence

- `server/main.py` (`engine()`); `server/store.py` (`make_engine`, `init_db`); `server/requirements.txt`.
- `docs/DEPLOYMENT.md` (Persistence); `.github/workflows/deploy.yml` ("Assert database wiring is still in place"); commit `c299e84`.
