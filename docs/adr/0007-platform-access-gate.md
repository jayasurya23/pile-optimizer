# ADR-0007: Gate access at the platform with an Entra group; the app fails closed and attributes identity

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

"All staff" has to mean membership of a security group, because the tenant includes 91 guest accounts. A `@castillope.com` domain check is unsafe as the gate; the reasoning is in `docs/ACCESS_CONTROL.md` of the `structcalc` repository, which is outside this repository. Microsoft's statement that clients cannot set `X-MS-CLIENT-PRINCIPAL-*` headers is one undocumented sentence, so matching on header values "could 403 all 106 staff". Saved runs need attribution.

## Decision

1. **The gate** is the Container Apps auth sidecar with `jwtClaimChecks.allowedGroups`. It is configured in Azure, not in this repository.
2. **Tripwire.** Middleware in `server/main.py` returns 403 for every request except `/healthz` that carries none of the three EasyAuth headers (`x-ms-client-principal-id`, `x-ms-client-principal`, `x-ms-client-principal-name`). It matches header presence, never value, so removal of the sidecar fails closed. `/healthz` stays open because Container Apps probes hit the container port directly.
3. **Identity.** `current_principal` takes the UPN from the principal's claims (`upn`, the WS-Federation upn claim, or `preferred_username`) or from the name header. It refuses non-member addresses (anything not exactly `@castillope.com`, or containing `#EXT#`) and a missing principal id, and it never fabricates a UPN (it stores null if none is found).
4. **CI assertions.** Every deploy asserts that EasyAuth is enabled, unauthenticated requests are redirected to login, `excludedPaths` is empty, and the allowed group id matches, because `az containerapp auth update --set` is lossy and can silently drop the group check.
5. **Local development.** `LOCAL_DEV_MODE=1` bypasses all of this, substitutes a fixed development principal, and enables `/docs` and `/openapi.json`.

## Options considered

- SWA built-in authentication: rejected ([ADR-0006](0006-azure-container-apps-hosting.md)).
- A `@castillope.com` domain check as the gate: rejected as unsafe (see `structcalc` `docs/ACCESS_CONTROL.md`).
- A tripwire that matches header values: rejected in `7f77e01` because it could lock out all staff if the header contents are not as assumed.

## Consequences

**Positive**

- Defence in depth: the platform gate plus an app-side fail-closed check.
- Every saved version records who saved it.

**Negative or to watch**

- The real gate lives outside the repository; the CI assertions are the only safeguard against configuration drift, and they run only at deploy time.
- The tripwire is not authentication. It detects a missing sidecar but does not verify header contents, so the platform must keep the container reachable only through the sidecar.
- `LOCAL_DEV_MODE` fully bypasses the app-side checks. Nothing in CI asserts that it is unset in the deployed app (the workflow asserts authentication and database wiring only).
- Any authenticated staff member can read any saved run; only rename, archive and restore are restricted ([ADR-0012](0012-append-only-run-versions.md)).

## Evidence

- `server/auth.py`; `server/main.py` (`guard` middleware, `/healthz`); `server/tests/test_runs.py` (`test_healthz_is_open_and_api_is_tripwired_without_dev_mode`).
- `.github/workflows/deploy.yml` ("Assert access control is still in place"); `docs/DEPLOYMENT.md` (Access control).
- Commits `7f77e01` and `c299e84`.
