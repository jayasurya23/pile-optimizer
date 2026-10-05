# ADR-0013: Store snapshots as gzipped columnar JSON in the database, hashed over the stored bytes, with size guards

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Recorded** | 2026-10-05 (retroactive: reconstructed from the repository, see [ADR-0001](0001-record-architecture-decisions.md)) |

## Context

A 200,000-pile fleet measured 26.3 MB as raw JSON and under 1 MB as gzipped columnar JSON. The replica has 0.5 GiB of memory. A decompression bomb or an oversized save must not be able to take the replica down, including when the record is reopened later.

## Decision

The client encodes the session as `pileopt/1` JSON, with row arrays stored column by column (`{__cols:{key:[...]},__n}`). It gzips the document in the browser with `CompressionStream` when available, otherwise it sends raw JSON and the server compresses. The upload is multipart: a JSON `meta` field plus the payload.

The server treats the payload as opaque: it enforces size, not shape, and the `format` field belongs to the client. On save it checks that a pre-gzipped upload decompresses within the guard, stores the bytes in `payload_gz` (a binary column), and records `payload_sha256` computed over the stored bytes together with the compressed size. On read it verifies the hash before decompressing.

Limits: 40 MiB request body (by `Content-Length`), 32 MiB compressed and 64 MiB decompressed. The 64 MiB figure is more than twice the measured 26.3 MB worst case, and the transient peak of `read_payload` (about 160 MB with the compressed blob) fits the 0.5 GiB replica; a 256 MiB guard "would let a save through whose own reopen OOM-kills the replica". A compressed payload over the ceiling is refused with a message to split the site into phases.

## Options considered

**Raw JSON rows.** Rejected for row size (26.3 MB measured for 200,000 piles).

Other layouts, such as relational per-pile tables, are not discussed in the repository.

## Consequences

**Positive**

- Small rows; integrity can be checked without decompressing; the server is independent of the payload schema.
- Uploads are never trusted: both the compressed and the decompressed size are bounded.

**Negative or to watch**

- Stored snapshots cannot be queried by pile or tracker content.
- Schema evolution is the client's responsibility: `decodeSnapshot` rejects an unknown `format` with "It may need a newer version of the app."
- SHA-256 detects corruption. It is stored beside the data and is not a message authentication code, so it does not prove authenticity against someone who can write both columns.
- Sites beyond the limits must be split into phases. The guard values are tuned to the current 0.5 GiB replica and must be revisited if the replica size changes.

## Evidence

- `server/store.py` (limits, `accept_payload`, `read_payload`); `src/runs.js` (`columnify`, `toBlob`, `encodeSnapshot`); `server/main.py` (`MAX_BODY`).
- `server/tests/test_runs.py` (round trip, pre-gzipped bytes, oversize, decompression bomb, tamper detection); commit `c299e84`.
