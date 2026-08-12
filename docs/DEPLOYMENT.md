# Deployment — two separate tools, one Castillo site

The civil and structural tools stay **independent applications**: separate repos,
separate build pipelines, separate release cadence. Neither can break the other.
They share only a hostname and the sign-in.

| | Civil — Pile Plan Optimizer | Structural — Calc Tool |
|---|---|---|
| Repo | `pile-optimizer` | `structcalc` |
| Stack | React SPA, **fully client-side** | Python / Streamlit, server-side |
| Artifact | `dist/` — static files | container / App Service app |
| Needs a server? | **No** | Yes (plus PostgreSQL) |
| Cost to host | ~free | App Service plan + DB |

The asymmetry matters: the civil tool does all its work in the browser, so it
wants static hosting, not an App Service.

## Recommended — one hostname, path routing (Azure Front Door)

```
                          apps.castilloeng.com
                                   │
                        ┌─── Azure Front Door ───┐
                        │                        │
              /civil/*  │                        │  /structural/*
                        ▼                        ▼
        Static Web App (or Storage       App Service (Linux)
        static website)                  Streamlit + Easy Auth
        civil dist/                      structcalc
```

- **One URL** for the team; a landing page at `/` links to both tools.
- **Independent deploys** — pushing civil never redeploys structural.
- **Entra ID once**: Easy Auth on the App Service, built-in Entra auth on the
  Static Web App, both restricted to the tenant. Front Door forwards the session.
- Front Door Standard is roughly $35/month plus trivial traffic charges.

## Cheaper alternative — two subdomains

`civil.castilloeng.com` → Static Web App, `structural.castilloeng.com` →
App Service. No Front Door, so no extra spend, and everything else is identical.
The only thing lost is a single shared path prefix. **If cost matters more than
having one hostname, take this option.**

## Not recommended — folding civil into the Streamlit app

Streamlit can serve the React build from its `static/` directory and show it in
an iframe. It works, but it couples the two teams' release cycles, puts a
client-side tool behind a server that does nothing for it, and inherits
Streamlit's iframe sandbox for the export download. Only worth it if the org
refuses to run a second hosting resource.

## Civil app — what deploying it actually takes

```bash
npm ci
npm run build     # -> dist/
```

Upload `dist/` anywhere that serves static files. `base: "./"` in
`vite.config.js` keeps asset URLs relative, so the same build works at `/`,
`/civil/`, or `/civil/pile-optimizer/` with no rebuild.

A GitHub Actions workflow is committed at
`.github/workflows/deploy.yml` — it builds on every push to `main` and uploads
to Azure Static Web Apps. It needs one repository secret,
`AZURE_STATIC_WEB_APPS_API_TOKEN`, from the Static Web App's **Manage deployment
token** blade. Until that secret exists the workflow builds and stops, which is
harmless.

## To provision this, I need from you

1. Which option — Front Door (one hostname) or two subdomains.
2. Azure subscription access, and the resource group / region to use.
3. The DNS zone (who manages `castilloeng.com` records).
4. The Entra tenant ID and whether access is all-staff or a security group.
5. For structural only: whether to stand up Azure Database for PostgreSQL now or
   keep the SQLite fallback for the first pilot.

With 1–4 I can provision both, wire the auth, and hand back working URLs.

## Security notes

- The civil tool sends **no data anywhere** — file parsing, optimization and
  export all happen in the browser. Nothing to secure beyond the sign-in.
- The structural tool stores project payloads in its database; that is the only
  place client data comes to rest.
- Neither app implements authentication itself. Both rely on the platform
  (Easy Auth / Static Web Apps auth). Do not expose either origin publicly
  without that in front of it — if Front Door is used, lock the origins to
  accept traffic only from it.
