# Pile Plan Optimizer — Castillo Engineering (Civil)

Terrain-following pile plan optimizer for utility-scale solar: N–S torque tube
on flex joints. **Import an Excel file, adjust the sliders, export the results.**

The optimization runs entirely in the browser — loading a file does not upload
it. A small FastAPI back end serves the app and stores **saved runs** (named,
versioned, attributed); pile data leave the browser only when a user presses
*Save Run*.

## Documentation

| Document | For | Content |
|---|---|---|
| [`docs/Pile-Optimizer-User-Guide.docx`](docs/Pile-Optimizer-User-Guide.docx) | Engineers using the tool | Input preparation, the workspace, limits, reviewing results, corrections, export, saved runs, troubleshooting, known issues |
| [`docs/Pile-Optimizer-Technical-Documentation.docx`](docs/Pile-Optimizer-Technical-Documentation.docx) | Developers, operators, reviewers | Architecture, optimization engine, data formats, API, security, build/deploy, operations, issue register |
| [`docs/adr/`](docs/adr/README.md) | Maintainers | Architecture Decision Records (also Appendix A of the technical documentation) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Operators | Hosting decision, persistence, access control, CI/CD |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | Maintainers | Defects found while packaging v1.1, open items |

**Known issue:** after N–S or E–W corrections the exported *Tube Slope*, *Slope
Delta* and *Solution Type* are not recalculated, so they can disagree with the
exported tops (K13 in the technical documentation's issue register). The other
open items are listed there and in the User Guide.

## What it does

For each tracker row it finds the torque-tube position that satisfies every
constraint at once:

1. **Straight line** — if a single grade fits the reveal window, use it (no earthwork).
2. **Terrain follow, no grade** — otherwise find the smoothest tube (minimum
   flex-joint rotation, ADMM with a direct Cholesky solve) that keeps every
   reveal inside its box without touching the ground.
3. **Terrain follow with grade** — if terrain slope itself breaks the limits,
   follow the terrain with slope/delta clamping, then rotate and shift the tube
   to balance cut against fill within the row.

A **global site solve** then couples all trackers, enforcing N–S end-elevation
limits and E–W band slopes across neighbouring rows jointly rather than row by row.

## Input format

`.xlsx` (first sheet with the required headers) or `.csv`. Column names are
case-insensitive.

| Column | Required | Meaning |
|---|---|---|
| `TrackerID` | yes | groups piles into a tracker row |
| `Northing` | yes | ft |
| `Easting` | recommended | ft — needed for E–W adjacency checks; always include it (`.xlsx` fills in 0 when absent, `.csv` leaves it undefined) |
| `ExistingGround` | yes | ft |
| `MinReveal` | no | ft above EG — per-pile hard lower bound |
| `MaxReveal` | no | ft above EG — per-pile hard upper bound |

`MinReveal`/`MaxReveal` **override the sliders** for those piles. If absent, the
global slider values apply to every pile.

`public/sample-pile-data.xlsx` (180 piles, 12 trackers) ships as a format
template — regenerate with `python scripts/make_sample_data.py`.

## Output

`TrackerOptimization_Results.xlsx`, three sheets:

- **Optimization Results** — one row per pile (N→S within each tracker):
  coordinates, existing ground, top of pile, reveal, solution type, final finished
  grade, ground adjustment, cut/fill, tube slope, slope delta.
- **Tracker Ends** — north and south end TOP per tracker. The tube is fully
  defined by its two ends, which is what the downstream CAD workflow wants.
- **Design Parameters** — the constraint snapshot the run used, plus fleet totals.

## Local development

```bash
npm ci
LOCAL_DEV_MODE=1 uvicorn server.main:app --port 8001   # API + SQLite; second terminal
npm run dev      # http://localhost:5173 (proxies /api to :8001)
npm run build    # -> dist/, served by the FastAPI container
python -m pytest server/tests -q                       # needs: pip install -r server/requirements.txt pytest httpx
```

Requires Node 18+ (CI and the Dockerfile use Node 20) and Python 3.11. SheetJS
comes from the vendor's own registry (`cdn.sheetjs.com`) rather than the npm
mirror (the npm copy is stale and carries advisories), so builds need outbound
access to that host. `LOCAL_DEV_MODE=1` bypasses authentication and must never
be set in a deployed environment.

## Deployment

`npm run build` emits a self-contained `dist/` of static files. In production
the Docker image serves it from the FastAPI process (`server/`), which also
exposes `/api/runs` for saved runs; the container runs on Azure Container Apps
behind Entra ID. `vite.config.js` sets `base: "./"` so the same build works from
any sub-path without rebuilding.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for how this sits alongside the
structural tool on one Castillo site behind Entra ID, and the technical
documentation for the architecture, API and operations.

## Changes from the v1.1 source

The optimizer's numerical engine is untouched. Packaging fixed three defects in
the data path and the export, plus the UI contrast — all recorded with evidence
in [`docs/FINDINGS.md`](docs/FINDINGS.md):

1. Per-pile `MinReveal`/`MaxReveal` were silently ignored on `.xlsx` import
   (they worked for `.csv`), so Excel runs quietly used the sliders instead.
2. The exported **Tube Slope** and **Slope Delta** columns were blank on every
   row — the two governing geometry checks the tool exists to enforce.
3. The Fleet Summary method breakdown always read 0/0/0 after a global solve.
4. The UI was a dark theme recoloured onto white; help text sat at 1.61:1
   contrast. Now Castillo-branded at WCAG AA.
