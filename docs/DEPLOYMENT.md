# Deployment — civil pile optimizer

> **Supersedes the earlier draft of this file.** That draft recommended Azure
> Static Web Apps behind Front Door. That was written before the Azure estate was
> inspected and is **wrong for this organisation** — see "Why not Static Web Apps"
> below. The authoritative, adversarially-reviewed plan covering **both** the civil
> and structural tools is `docs/AZURE_DEPLOYMENT.md` in the `structcalc` repo.

## The decision

`pile-optimizer` ships as a **Docker container on Azure Container Apps** running
nginx over the static Vite `dist/`, at **`pile.castillope.com`**, behind Container
Apps built-in auth (EasyAuth) against Entra ID.

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

The app stays 100% client-side. The container only serves files — parsing,
optimization and export all still happen in the browser, and no pile data leaves
the user's machine.

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
| `Dockerfile` | node:20-alpine build → `nginx-unprivileged` (UID 101, port 8080) |
| `nginx/default.conf` | SPA fallback, cache policy, `/healthz`, EasyAuth tripwire |
| `nginx/snippets/require-easyauth.conf` | fails closed if the auth sidecar is missing |
| `nginx/snippets/security-headers.conf` | CSP allowing only the two Google Fonts hosts |
| `nginx/denied.html` | 403 page with a working sign-out link |

Cache policy matches Vite's output: `index.html` is `no-cache` (it names the
content-hashed bundles, so a stale copy points at assets that no longer exist),
`/assets/*` is `immutable` for a year.

`/healthz` deliberately bypasses the tripwire — Container Apps probes hit the
container port directly and carry no EasyAuth headers, so gating it would stop
any revision reaching Healthy.

## Access control

The gate is **not** in this repo. It is an Entra security group checked by the
Container Apps auth sidecar (`jwtClaimChecks.allowedGroups`). The nginx tripwire
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

The build job runs on every push and pull request; the Azure steps are skipped
until the repo variables exist, so a broken build is caught even before the
infrastructure does.

## Blocking on

1. **Go-ahead to provision** — nothing exists in Azure yet.
2. **One DNS record**, added by the user in Squarespace once the app exists:
   a `CNAME` at `civiltools` pointing to the container app's ingress FQDN.
   No `asuid` TXT is needed — `qc.` and `pmo360.` both validated by CNAME alone
   and neither has one.
3. The `SG-Castillo-Internal-Apps` security group, and an owner for its
   membership.
