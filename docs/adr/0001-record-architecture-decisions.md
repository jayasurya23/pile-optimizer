# ADR-0001: Record architecture decisions

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-05 |
| **Recorded** | 2026-10-05 |

## Context

The design rationale for this project is spread across code comments, commit messages and two documents (`docs/DEPLOYMENT.md`, `docs/FINDINGS.md`). Several significant decisions, for example why the app runs on Container Apps rather than Static Web Apps, or why the decompression guard is 64 MiB, are explained only in commit messages. There is no single place to find out why the system is the way it is.

## Decision

Keep a log of Architecture Decision Records (ADRs) in `docs/adr/`: one Markdown file per decision, numbered sequentially (`NNNN-short-title.md`), written from `docs/adr/template.md` (Context, Decision, Options considered, Consequences, Evidence).

Statuses are **Proposed**, **Accepted**, **Deprecated** and **Superseded by ADR-NNNN**. An accepted record is not rewritten when circumstances change; it is superseded by a new record, and only its status line is edited.

[ADR-0002](0002-browser-side-computation.md) to [ADR-0015](0015-postgresql-fail-closed.md) record decisions that were already taken. They were reconstructed from the repository on 2026-10-05. Each carries the date of the commit in which the decision was made or first documented. Where the repository does not record which alternatives were weighed, the record says so and does not invent them.

## Options considered

**Keep the status quo** (rationale in commit messages and `DEPLOYMENT.md`). Rejected: hard to find, and it mixes operating steps with reasoning.

**An external wiki.** Rejected: it is not versioned with the code and drifts from it. ADRs in the repository are reviewed in the same pull request as the change they describe.

## Consequences

**Positive**

- One findable place for the reasoning behind the design, reviewed alongside the code.

**Negative or to watch**

- Requires discipline: a new significant decision needs a new record.
- Retroactive records reflect the evidence in the repository, not necessarily everything the original participants considered. The maintainers should review [ADR-0002](0002-browser-side-computation.md) to [ADR-0015](0015-postgresql-fail-closed.md) and amend them where the real reasoning differs.

## Evidence

- `docs/DEPLOYMENT.md`, `docs/FINDINGS.md`: existing rationale, now cross-referenced from the records.
- Commit messages `c813f35`, `7f77e01`, `403eddb`, `e0875fb`, `c299e84`: the main sources for the retroactive records.
