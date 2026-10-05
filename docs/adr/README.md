# Architecture Decision Records

This directory is the log of significant architecture decisions for the Pile Plan Optimizer: what was decided, why, what else was considered, and what the decision costs. It answers the question "why is it built this way?" for developers, reviewers and operators.

The same records are reproduced as Appendix A of `docs/Pile-Optimizer-Technical-Documentation.docx`.

## Index

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-05 |
| [0002](0002-browser-side-computation.md) | Run the optimizer in the browser; the server only stores | Accepted | 2026-08-12 |
| [0003](0003-layered-solver.md) | Layered solver: a per-tracker cascade followed by a global site solve | Accepted | 2026-08-12 |
| [0004](0004-per-pile-reveal-limits.md) | Per-pile reveal limits override the global sliders | Accepted | 2026-08-12 |
| [0005](0005-export-workbook-contract.md) | Export a three-sheet workbook as the downstream contract | Accepted | 2026-08-12 |
| [0006](0006-azure-container-apps-hosting.md) | Host on Azure Container Apps at civiltools.castillope.com | Accepted | 2026-08-12 |
| [0007](0007-platform-access-gate.md) | Gate access at the platform with an Entra group; the app fails closed and attributes identity | Accepted | 2026-08-12 |
| [0008](0008-ci-cd-oidc-acr.md) | Deploy with GitHub OIDC, ACR builds and SHA-tagged revisions; assert Azure-side configuration on every deploy | Accepted | 2026-08-12 |
| [0009](0009-keep-one-warm-replica.md) | Keep one warm replica (no scale to zero) | Accepted | 2026-08-12 |
| [0010](0010-self-contained-frontend.md) | Self-contained front end: self-hosted font, vendor-registry SheetJS, strict CSP | Accepted | 2026-08-13 |
| [0011](0011-single-fastapi-process.md) | Serve the SPA and the API from one FastAPI process (replace nginx) | Accepted | 2026-08-14 |
| [0012](0012-append-only-run-versions.md) | Persist runs as append-only versions with optimistic concurrency | Accepted | 2026-08-14 |
| [0013](0013-snapshot-storage-format.md) | Store snapshots as gzipped columnar JSON in the database, hashed over the stored bytes, with size guards | Accepted | 2026-08-14 |
| [0014](0014-save-results-and-hydrate.md) | Save the solved results with the inputs; reopen without re-solving | Accepted | 2026-08-14 |
| [0015](0015-postgresql-fail-closed.md) | PostgreSQL in production, SQLite for local development only; no silent fallback without DATABASE_URL | Accepted | 2026-08-14 |

## How this log works

- One Markdown file per decision, named `NNNN-short-title.md`, numbered in the order they are recorded.
- Start from [`template.md`](template.md). Keep records short and factual: context, the decision, the options that were actually weighed, the consequences, and where the evidence is.
- Statuses: **Proposed**, **Accepted**, **Deprecated**, **Superseded by ADR-NNNN**.
- An accepted record is not rewritten when circumstances change. Write a new record that supersedes it and update only the old record's status line.
- Add the new record to the index above in the same pull request as the change it describes.

## About ADR-0002 to ADR-0015

These fourteen records were written on 2026-10-05 from the repository itself (source code and comments, commit messages, `docs/DEPLOYMENT.md`, `docs/FINDINGS.md`). Each date is the date of the commit in which the decision was made or first documented. Where the repository does not record which alternatives were considered, the record says so instead of inventing them.

Because they are reconstructed, the maintainers should review them and amend any record where the original reasoning differs from what the evidence suggests.

## Related documents

- [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md): hosting, access control, CI/CD runbook.
- [`docs/FINDINGS.md`](../FINDINGS.md): defects found while packaging v1.1 and the open items.
