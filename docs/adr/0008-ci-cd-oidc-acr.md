# ADR-0008: Deploy with GitHub OIDC, ACR builds and SHA-tagged revisions; assert Azure-side configuration on every deploy

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Castillo's CI standard is GitHub OIDC federated credentials with no stored secrets; the earlier Static Web Apps workflow needed a long-lived `AZURE_STATIC_WEB_APPS_API_TOKEN`. There is no Docker on the runner. Authentication and database wiring live in Azure configuration, where nothing in the repository would notice them being dropped.

## Decision

A push to `main` (filtered to application and build paths) runs the `build` job (`npm ci`, `npm run build`, `pytest`) and then the `deploy` job, which is skipped until the repository variables exist. Pull requests run the build job only.

1. Log in to Azure with OIDC.
2. `az acr build` in Azure Container Registry, tagging the image with the git SHA (and `latest`) and passing `GIT_SHA` as a build argument.
3. Update the ingress target port to 8000 **before** updating the image. Default readiness probes use the ingress target port, so the reverse order fails activation of the new revision during the nginx to uvicorn transition.
4. `az containerapp update` with the SHA-tagged image, re-asserting 0.25 vCPU, 0.5 Gi and 1 to 2 replicas.
5. Assert the auth gate and the `db-url` secret reference ([ADR-0007](0007-platform-access-gate.md), [ADR-0015](0015-postgresql-fail-closed.md)), then print the rollout.

Rollback means pointing the app at an earlier SHA tag. The concurrency group does not cancel an in-progress run, so a deploy is never aborted mid-rollout.

## Options considered

The Static Web Apps deployment-token workflow was replaced because it contradicts the no-stored-secrets rule. No other options are recorded.

## Consequences

**Positive**

- No stored cloud credentials; reproducible builds in Azure; rollback by tag.
- Configuration drift in Azure is caught on the next deploy.

**Negative or to watch**

- Drift is detected only when a deploy runs, not continuously.
- CI runs the server tests but no frontend or engine tests; it proves the frontend builds, not that it works.
- The `docs/**` and `README.md` paths are not in the trigger filter, so documentation-only changes never deploy.

## Evidence

- `.github/workflows/deploy.yml`; commits `7f77e01`, `403eddb`, `c299e84`.
