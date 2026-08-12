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
| Hostname | `pile.castillope.com` |
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

## CI/CD

The committed `.github/workflows/deploy.yml` is still the **Static Web Apps**
version and must be replaced with the house pattern — GitHub OIDC →
`az acr build` → `az containerapp update` with a git-SHA image tag — before first
deploy. The replacement workflow, the `Dockerfile`, and the `nginx.conf` are all
specified in the runbook (§5, "Files to add"). They are not committed yet because
the Azure resources they target do not exist.

Deploy = push to `main`. Roll back = point the app at an earlier SHA tag.

## Blocking on

1. Confirmation of the hostname `pile.castillope.com`.
2. Two DNS records created by whoever administers `castillope.com` (it is **not**
   in Azure DNS): a `CNAME` for `pile` and a `TXT` at `asuid.pile`. Exact values in
   the runbook §4.7.
3. A staff security group to scope access, and an owner for its membership.

Nothing has been provisioned. See the runbook for the ordered command list.
