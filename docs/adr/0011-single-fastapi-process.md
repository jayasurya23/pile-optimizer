# ADR-0011: Serve the SPA and the API from one FastAPI process (replace nginx)

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

The first container served `dist/` from nginx and was entirely client-side. Saved runs (named, versioned, attributed, the same model as `structcalc`) became a requirement and need a backend. nginx was doing four jobs: static files, SPA fallback with a cache policy, security headers, and the EasyAuth tripwire.

## Decision

Replace nginx with one `python:3.11-slim` container running uvicorn and FastAPI as a non-root user (UID 1001) on port 8000. It serves the API under `/api`, `/healthz`, the Vite `dist/` (hashed `/assets` mounted statically; other existing files served as they are; everything else falls back to `index.html` with `Cache-Control: no-cache, must-revalidate`), and it re-implements the security headers and the tripwire as middleware. A request-size guard (40 MiB by `Content-Length`) runs before any body is read.

## Options considered

No alternatives are recorded beyond "nginx is gone" (`c299e84`).

## Consequences

**Positive**

- One process, one image and one ingress port; the same topology as `structcalc`.
- The API is same-origin, so the policy can use `connect-src 'self'`.

**Negative or to watch**

- The ingress target port changed from 8080 to 8000, which forces the ordering described in [ADR-0008](0008-ci-cd-oidc-acr.md).
- The security headers and tripwire are now application code. A test covers the tripwire; the response headers are not tested.
- The static mount is created only if `dist/` exists when the module is imported, so a build without `dist/` silently serves the API only.

## Evidence

- `server/main.py`; `Dockerfile`; commit `c299e84`.
