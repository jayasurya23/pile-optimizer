# Deployment — civil pile optimizer

> **Supersedes the earlier draft of this file.** That draft recommended Azure
> Static Web Apps behind Front Door. That was written before the Azure estate was
> inspected and is **wrong for this organisation** — see "Why not Static Web Apps"
> below. The authoritative, adversarially-reviewed plan covering **both** the civil
> and structural tools is `docs/AZURE_DEPLOYMENT.md` in the `structcalc` repo.

## The decision

`pile-optimizer` ships as a **Docker container on Azure Container Apps** running
a FastAPI backend (`server/`) that serves both the static Vite `dist/` and the
run-storage API, at **`civiltools.castillope.com`**, behind Container Apps
built-in auth (EasyAuth) against Entra ID.

> **History:** the first deployment served `dist/` with nginx and was 100%
> client-side. When saved runs became a requirement (versioned, named,
> attributed — same model as structcalc), nginx was replaced by the FastAPI
> process, which took over nginx's other three jobs: SPA fallback + caching,
> security headers, and the EasyAuth tripwire. See "Persistence" below.

This matches what Castillo already operates. Every web-facing app in the
subscription is a Container App with its own resource group, its own registry, and
its own subdomain on `castillope.com` (`qc.`, `pmo360.`). There is no Front Door,
no CDN, and no Static Web App anywhere in the tenant.

| | |
|---|---|
| Resource group | `rg-pile-optimizer` (East US 2) |
| Environment | `pile-optimizer-env` |
| Registry | `castillopileoptimizeracr` (Basic) |
| Container app | `pile-optimizer` |
| Hostname | **`civiltools.castillope.com`** |
| Size | 0.25 vCPU / 0.5 GiB |
| Auth | EasyAuth, single-tenant, staff security group |

Parsing, optimization and export all still happen in the browser. The server
never computes; it stores. Pile data leaves the user's machine only when they
explicitly save a run.

## Why not Static Web Apps

- **SWA Free cannot restrict sign-in to this tenant.** Tenant-restricted Entra
  sign-in needs a custom auth provider, which is a Standard-tier feature
  (~$9/app/month). The Free tier's built-in Entra provider accepts any Microsoft
  account.
- **It cannot express the group claim we need.** The tenant has 106 members *and
  91 guests across 36 external domains* — including a racking supplier and five
  gmail.com accounts. "All staff" has to mean a security-group check, which
  Container Apps EasyAuth does via `jwtClaimChecks.allowedGroups` and SWA does not.
- **It needs a long-lived deployment token.** Castillo's CI standard is GitHub
  OIDC federated credentials with no stored secrets. `AZURE_STATIC_WEB_APPS_API_TOKEN`
  contradicts that.
- **It fragments operations.** One hosting model, one auth model, one deploy
  pattern is worth more to a team this size than saving a few dollars a month.

## Why not Front Door / path routing

~$35/month to solve a problem nobody has. The house convention is already a
subdomain per app, and nothing in the estate uses path-based routing.

## Container layout

| File | What it does |
|---|---|
| `Dockerfile` | node:20-alpine build → `python:3.11-slim` + uvicorn (UID 1001, port 8000) |
| `server/main.py` | run API, static `dist/` + SPA fallback, security headers, EasyAuth tripwire |
| `server/store.py` | versioned run storage (gzipped snapshot BYTEA, integrity hashes, size guards) |
| `server/auth.py` | identity from the EasyAuth sidecar headers; never fabricates a UPN |

`/healthz` deliberately bypasses the tripwire — Container Apps probes hit the
container port directly and carry no EasyAuth headers, so gating it would stop
any revision reaching Healthy.

## Persistence

Runs live in a **dedicated PostgreSQL flexible server** `castillo-civil-db`
(same trust-boundary reasoning as structcalc's dedicated server), database
`civil`, wired via the container app secret `db-url` → `DATABASE_URL`. The
server **refuses to start work without it** — with the var unset it raises
rather than silently falling back to SQLite that would lose every run on the
next revision. CI asserts the secret ref on every deploy.

The saved payload is the entire session snapshot — inputs, constraints, solved
results, anchors — because N-S/E-W corrections mutate results *after* the
deterministic solve; a reopen must show the numbers that were on screen, not a
re-solve. Snapshots are gzipped columnar JSON in BYTEA (a measured 200k-pile
fleet is ~26 MB raw, under 1 MB compressed), SHA-256'd over the stored bytes,
with decompression guards sized so nothing that saves can OOM the replica when
reopened. Every save appends an immutable version; a stale `base_version_no`
gets a 409, never a silent overwrite.

## Access control

The gate is **not** in this repo. It is an Entra security group checked by the
Container Apps auth sidecar (`jwtClaimChecks.allowedGroups`). The tripwire (now
middleware in `server/main.py`; it was nginx's job before the FastAPI backend)
only fails closed if that sidecar is removed from the request path, and matches
on header *presence*, never value. The reasoning — including why a
`@castillope.com` domain check is unsafe as the gate — is in
`docs/ACCESS_CONTROL.md` in the `structcalc` repo.

The deploy workflow asserts the group check on every run, because
`az containerapp auth update --set` is lossy and can silently drop it.

## CI/CD

`.github/workflows/deploy.yml` follows the house pattern: GitHub OIDC →
`az acr build` → `az containerapp update` with a git-SHA image tag. The Static
Web Apps version it replaced needed a long-lived deployment token, which
contradicts the org's no-stored-secrets rule.

Deploy = push to `main`. Roll back = point the app at an earlier SHA tag.

The build job runs frontend build + server tests on every push and pull
request; the Azure steps are skipped until the repo variables exist, so a
broken build is caught even before the infrastructure does.

The deploy step updates **ingress before the image**: default readiness probes
hit the ingress target port, so flipping the image to uvicorn (8000) while
ingress still pointed at nginx's 8080 would fail the new revision's activation
and wedge the pipeline. After the one-time transition the ingress update is an
idempotent re-assertion. CI also asserts the auth gate *and* the `db-url`
secret ref on every deploy — both live in Azure config where nothing in the
repo would notice them being dropped.

## Blocking on

**One DNS record**, added by the user in Squarespace: a `CNAME` at `civiltools`
pointing to `pile-optimizer.politerock-3764480f.eastus2.azurecontainerapps.io`.
No `asuid` TXT is needed — `qc.` and `pmo360.` both validated by CNAME alone
and neither has one. Everything else is provisioned and live.
