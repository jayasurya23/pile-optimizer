// Saved-run client: snapshot codec + API calls.
//
// A snapshot captures everything needed to reopen a session with the SAME
// numbers on screen — including the results, because N-S / E-W corrections
// mutate results after the deterministic solve and cannot be replayed.
//
// Row arrays are stored column-wise ({__cols:{key:[...]},__n}) purely for
// size: a 200k-pile fleet is ~4x smaller columnar, and repeated per-tracker
// strings (Method, Explanation) all but vanish under gzip.

export const SNAPSHOT_FORMAT = "pileopt/1";

export function columnify(rows) {
  const keys = [];
  const seen = new Set();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  const cols = {};
  for (const k of keys) cols[k] = rows.map((r) => (r[k] === undefined ? null : r[k]));
  return { __cols: cols, __n: rows.length };
}

export function rowify(packed) {
  if (Array.isArray(packed)) return packed; // tolerate uncompacted docs
  const { __cols: cols, __n: n } = packed;
  const keys = Object.keys(cols);
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = {};
    for (const k of keys) r[k] = cols[k][i];
    rows[i] = r;
  }
  return rows;
}

export function encodeSnapshot({ constraints, rawData, allResults, selectedTracker, ewAnchors }) {
  const results = {};
  for (const [tid, rows] of Object.entries(allResults || {})) {
    if (rows && rows.length) results[tid] = columnify(rows);
  }
  return {
    format: SNAPSHOT_FORMAT,
    constraints,
    rawData: columnify(rawData),
    results,
    selectedTracker,
    ewAnchors: [...(ewAnchors || [])],
  };
}

export function decodeSnapshot(doc) {
  if (doc.format !== SNAPSHOT_FORMAT) {
    throw new Error(`This run was saved in an unknown format (${doc.format}). ` +
      "It may need a newer version of the app.");
  }
  const allResults = {};
  for (const [tid, packed] of Object.entries(doc.results || {})) {
    allResults[tid] = rowify(packed);
  }
  return {
    constraints: doc.constraints,
    rawData: rowify(doc.rawData),
    allResults,
    selectedTracker: doc.selectedTracker,
    ewAnchors: new Set(doc.ewAnchors || []),
  };
}

// gzip in the browser when CompressionStream exists (all evergreen browsers);
// otherwise ship raw JSON and let the server compress.
async function toBlob(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === "undefined") {
    return { blob: new Blob([json]), encoding: "json" };
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return { blob: await new Response(stream).blob(), encoding: "gzip" };
}

// ---------------------------------------------------------------------- API

async function jfetch(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch { /* not JSON */ }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function me() {
  return (await jfetch("/api/me")).json();
}

export async function listRuns({ q = "", includeArchived = false, before = null } = {}) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (includeArchived) p.set("include_archived", "true");
  if (before) p.set("before", before);
  return (await jfetch(`/api/runs?${p}`)).json();
}

async function postSnapshot(url, meta, snapshot) {
  const { blob, encoding } = await toBlob(snapshot);
  const form = new FormData();
  form.append("meta", JSON.stringify(meta));
  form.append("payload_encoding", encoding);
  form.append("payload", blob, "snapshot");
  return (await jfetch(url, { method: "POST", body: form })).json();
}

export function createRun(meta, snapshot) {
  return postSnapshot("/api/runs", meta, snapshot);
}

export function appendRunVersion(runId, meta, snapshot) {
  return postSnapshot(`/api/runs/${runId}/versions`, meta, snapshot);
}

export async function getRun(runId, versionNo = null) {
  const p = versionNo ? `?version_no=${versionNo}` : "";
  return (await jfetch(`/api/runs/${runId}${p}`)).json();
}

export async function getRunSnapshot(runId, versionNo = null) {
  const p = versionNo ? `?version_no=${versionNo}` : "";
  return (await jfetch(`/api/runs/${runId}/payload${p}`)).json();
}

export async function getRunHistory(runId) {
  return (await jfetch(`/api/runs/${runId}/versions`)).json();
}

export async function archiveRun(runId) {
  return (await jfetch(`/api/runs/${runId}/archive`, { method: "POST" })).json();
}

export async function restoreRun(runId) {
  return (await jfetch(`/api/runs/${runId}/restore`, { method: "POST" })).json();
}
