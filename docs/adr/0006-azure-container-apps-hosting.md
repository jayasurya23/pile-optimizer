# ADR-0006: Host on Azure Container Apps at civiltools.castillope.com

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

The first deployment plan (Azure Static Web Apps behind Front Door) "was written before the Azure estate was inspected" and proved wrong for the organisation. Every web app in the subscription is a Container App with its own resource group, registry and subdomain on `castillope.com` (`qc.`, `pmo360.`); there is no Front Door, CDN or Static Web App anywhere in the tenant. The tenant has 106 members and 91 guests across 36 external domains, including a racking supplier and five gmail.com accounts.

## Decision

Run the app as a container on Azure Container Apps, behind the built-in authentication (EasyAuth) against Entra ID, at `civiltools.castillope.com` (planned as `pile.castillope.com` in `c813f35`, changed in `7f77e01`). Resources: resource group `rg-pile-optimizer` (East US 2), environment `pile-optimizer-env`, registry `castillopileoptimizeracr` (Basic), container app `pile-optimizer`, 0.25 vCPU and 0.5 GiB.

## Options considered

- **Static Web Apps (Free).** Rejected: it cannot restrict sign-in to this tenant (a custom provider needs the Standard tier, about $9 per app per month); it cannot express the group claim needed, which Container Apps does with `jwtClaimChecks.allowedGroups`; it needs a long-lived deployment token, which contradicts the organisation's rule of OIDC federated credentials with no stored secrets; and it fragments operations.
- **Front Door or path routing.** Rejected: about $35 per month "to solve a problem nobody has"; the house convention is one subdomain per app.
- **Container Apps.** Chosen: it matches what the organisation already operates.

## Consequences

**Positive**

- One hosting model, one auth model and one deploy pattern across the Castillo apps.
- Access can be limited by security-group membership.
- Deployments use OIDC with no stored credentials ([ADR-0008](0008-ci-cd-oidc-acr.md)).

**Negative or to watch**

- A container image pipeline is required.
- An always-on replica has a small monthly cost ([ADR-0009](0009-keep-one-warm-replica.md)).
- One manual step sits outside the repository: a CNAME record for `civiltools` in Squarespace DNS. `DEPLOYMENT.md` recorded it as the only blocker on 2026-08-14.
- Authentication and database configuration live in Azure, not in the repository ([ADR-0007](0007-platform-access-gate.md), [ADR-0015](0015-postgresql-fail-closed.md)).

## Evidence

- `docs/DEPLOYMENT.md`; commits `c813f35` and `7f77e01`; `.github/workflows/deploy.yml`.
