# ADR-0010: Self-contained front end: self-hosted font, vendor-registry SheetJS, strict CSP

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-13 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

Loaded from the Google CDN, every Jost font face reported status "error" and text silently fell back to a system font (`e0875fb`). The npm copy of SheetJS (`xlsx`) is stale and carries advisories (`README.md`). The app has no need to make external requests.

## Decision

Serve Jost from the app as one variable `woff2` file (26 KB). The app makes no external requests at runtime. The FastAPI middleware sets: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and `Cross-Origin-Opener-Policy: same-origin`.

Install SheetJS from the vendor's registry (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), pinned in `package-lock.json` with an integrity hash.

## Options considered

- Google Fonts: rejected because the faces failed to load on the network in use.
- The npm `xlsx` package: rejected as stale and carrying advisories.

## Consequences

**Positive**

- Works on restricted networks; no third-party script or font hosts.
- A tight content-security policy.

**Negative or to watch**

- `style-src 'unsafe-inline'` is required because the interface is built with inline `style` attributes.
- Builds need outbound access to `cdn.sheetjs.com`. `npm ci` fails with HTTP 403 where network policy blocks that host (observed in the sandbox used to prepare these documents).
- SheetJS is pinned to a vendor tarball URL, so upgrading it is a manual step.
- The Community Edition cannot write cell styles ([ADR-0005](0005-export-workbook-contract.md)).

## Evidence

- `index.html`; `server/main.py` (`SECURITY_HEADERS`); `package.json`; `package-lock.json`; `README.md`.
- Commit `e0875fb`.
