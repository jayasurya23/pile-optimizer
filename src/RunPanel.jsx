// Save/open UI for stored runs. Lives in the header; owns all run state so
// App.jsx only provides getSnapshot() and onOpen().
//
// Versioning contract (same as structcalc): saves APPEND — they never
// overwrite. base_version_no is always the run's head; opening an older
// version to look at it does not move the base, so saving from that view
// appends a new head rather than rewriting history.
import React, { useEffect, useRef, useState } from "react";
import * as api from "./runs.js";

const btn = {
  padding: "7px 12px", background: "#f0f0f0", border: "1px solid #bcbec0",
  borderRadius: 5, color: "#333132", cursor: "pointer", fontSize: 11,
};
const btnPrimary = {
  ...btn, background: "#ffffff", border: "1px solid #ffffff",
  color: "#ad1f2b", fontWeight: 600,
};
const field = {
  width: "100%", background: "#ffffff", border: "1px solid #bcbec0",
  borderRadius: 3, color: "#333132", padding: "6px 8px", fontSize: 12,
  fontFamily: "inherit", boxSizing: "border-box",
};
const label = {
  fontSize: 9, color: "#4d4d4f", letterSpacing: "0.08em",
  textTransform: "uppercase", display: "block", marginBottom: 3,
};

function when(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleString([], {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function RunBar({ getSnapshot, onOpen, busy }) {
  // The run this session is attached to; null = unsaved scratch session.
  const [run, setRun] = useState(null);          // {id, name, project, baseVersion, viewing}
  const [fields, setFields] = useState({ name: "", project: "", engineer: "", checker: "", note: "" });
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);          // {text, tone: "ok"|"warn"|"err"}
  const [browserOpen, setBrowserOpen] = useState(false);
  const [user, setUser] = useState("");

  useEffect(() => {
    api.me().then((m) => setUser(m.user || "")).catch(() => setUser(""));
  }, []);

  const flash = (text, tone = "ok") => setMsg({ text, tone });

  async function save() {
    if (busy) {
      // The solve can (re)start while the modal is open — a snapshot taken now
      // would pair new constraints with results solved under the old ones.
      flash("A solve is still running — wait for it to finish, then save.", "warn");
      return;
    }
    if (!fields.name.trim() && !run) { flash("Give the run a name first.", "warn"); return; }
    setSaving(true); setMsg(null);
    try {
      const snap = getSnapshot();
      const doc = api.encodeSnapshot(snap);
      const complete = Object.keys(snap.allResults || {}).length > 0;
      const meta = {
        name: fields.name.trim() || run?.name || "Untitled run",
        project: fields.project.trim(),
        engineer: fields.engineer.trim(), checker: fields.checker.trim(),
        note: fields.note.trim(),
        status: complete ? "complete" : "inputs_only",
        pile_count: snap.rawData.length,
        tracker_count: Object.keys(snap.allResults || {}).length ||
          new Set(snap.rawData.map((r) => r.TrackerID)).size,
      };
      let out;
      if (run) {
        out = await api.appendRunVersion(run.id, { ...meta, base_version_no: run.baseVersion }, doc);
      } else {
        out = await api.createRun(meta, doc);
      }
      setRun({
        id: out.run.id, name: out.run.name, project: out.run.project,
        baseVersion: out.run.version_no, viewing: null,
      });
      setFields((f) => ({ ...f, note: "" }));
      flash(`Saved version ${out.version.version_no}.`);
      setSaveOpen(false);
    } catch (e) {
      if (e.status === 409 && run) {
        try {
          const head = await api.getRun(run.id);
          setRun((r) => ({ ...r, baseVersion: head.run.version_no }));
          flash(`Someone saved version ${head.run.version_no} while you were editing. ` +
            "Nothing was lost — click Save again to add your changes as the next version.", "warn");
        } catch { flash(e.message, "err"); }
      } else {
        flash(e.message, "err");
      }
    } finally {
      setSaving(false);
    }
  }

  async function open(runRow, versionNo = null) {
    setMsg(null);
    try {
      const [info, doc] = await Promise.all([
        api.getRun(runRow.id, versionNo),
        api.getRunSnapshot(runRow.id, versionNo),
      ]);
      onOpen(api.decodeSnapshot(doc));
      const head = info.run.version_no;
      const v = info.version;
      setRun({
        id: info.run.id, name: info.run.name, project: info.run.project,
        baseVersion: head,
        viewing: v.version_no !== head ? { no: v.version_no, of: head } : null,
      });
      setFields({
        name: info.run.name, project: info.run.project || "",
        engineer: v.engineer || "", checker: v.checker || "", note: "",
      });
      setBrowserOpen(false);
      flash(v.version_no !== head
        ? `Viewing version ${v.version_no} of ${head} — saving will create version ${head + 1}.`
        : `Opened “${info.run.name}” (version ${head}).`);
    } catch (e) { flash(e.message, "err"); }
  }

  function detach() {
    setRun(null);
    setFields({ name: "", project: "", engineer: "", checker: "", note: "" });
    setMsg(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {run && (
          <span style={{ fontSize: 10, color: "#f0c9cd", maxWidth: 260, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.name}>
            {run.name} · v{run.viewing ? `${run.viewing.no} of ${run.viewing.of}` : run.baseVersion}
            <button onClick={detach} title="Close this run (start a new unsaved session)"
              style={{ marginLeft: 6, background: "none", border: "none", color: "#f0c9cd",
                cursor: "pointer", fontSize: 10, padding: 0 }}>✕</button>
          </span>
        )}
        <button style={btn} onClick={() => setBrowserOpen(true)}>📁 Runs</button>
        <button style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }} disabled={busy}
          title={busy ? "Wait for the solve to finish" : ""}
          onClick={() => { setSaveOpen((o) => !o); setMsg(null); }}>
          💾 {run ? `Save v${run.baseVersion + 1}` : "Save Run"}
        </button>
      </div>
      {user && <div style={{ fontSize: 9, color: "#f0c9cd" }}>signed in as {user}</div>}
      {msg && !saveOpen && !browserOpen && (
        <div style={{ fontSize: 10, maxWidth: 340, textAlign: "right",
          color: msg.tone === "err" ? "#ffd7d7" : msg.tone === "warn" ? "#ffe9b8" : "#ffffff" }}>
          {msg.text}
        </div>
      )}

      {saveOpen && (
        <Modal title={run ? `Save version ${run.baseVersion + 1} of “${run.name}”` : "Save this run"}
          onClose={() => setSaveOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={label}>Run name</span>
              <input style={field} value={fields.name} autoFocus
                onChange={(e) => setFields({ ...fields, name: e.target.value })}
                placeholder="e.g. Trigo Ranch — Phase 2 pile plan" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={label}>Project / job number</span>
              <input style={field} value={fields.project}
                onChange={(e) => setFields({ ...fields, project: e.target.value })} />
            </div>
            <div>
              <span style={label}>Engineer (of record)</span>
              <input style={field} value={fields.engineer}
                onChange={(e) => setFields({ ...fields, engineer: e.target.value })} />
            </div>
            <div>
              <span style={label}>Checker</span>
              <input style={field} value={fields.checker}
                onChange={(e) => setFields({ ...fields, checker: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={label}>Note for this version</span>
              <input style={field} value={fields.note}
                onChange={(e) => setFields({ ...fields, note: e.target.value })}
                placeholder="what changed" />
            </div>
          </div>
          {msg && (
            <div style={{ fontSize: 11, marginTop: 10,
              color: msg.tone === "err" ? "#e12a3f" : msg.tone === "warn" ? "#c2571c" : "#1a7a3c" }}>
              {msg.text}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button style={btn} onClick={() => setSaveOpen(false)}>Cancel</button>
            <button onClick={save} disabled={saving || busy}
              style={{ ...btn, background: "#ad1f2b", border: "1px solid #ad1f2b",
                color: "#ffffff", fontWeight: 600, opacity: saving || busy ? 0.6 : 1 }}>
              {saving ? "Saving…" : busy ? "Solving…" : run ? `Save v${run.baseVersion + 1}` : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {browserOpen && (
        <RunBrowser onOpenRun={open} onClose={() => setBrowserOpen(false)} />
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(51,49,50,0.45)",
        zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#ffffff", color: "#333132", borderRadius: 8,
          border: "1px solid #bcbec0", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          marginTop: 70, padding: 18, width: wide ? "min(860px, 94vw)" : "min(460px, 94vw)",
          maxHeight: "80vh", overflowY: "auto", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none",
            fontSize: 16, cursor: "pointer", color: "#4d4d4f" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RunBrowser({ onOpenRun, onClose }) {
  const [rows, setRows] = useState(null);        // null = loading
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [historyFor, setHistoryFor] = useState(null);   // run id with history expanded
  const [history, setHistory] = useState([]);
  const [exhausted, setExhausted] = useState(false);
  const timer = useRef(null);

  async function load({ append = false, query = q, archived = showArchived } = {}) {
    setError("");
    try {
      const before = append && rows?.length ? rows[rows.length - 1].last_saved_at : null;
      const page = await api.listRuns({ q: query, includeArchived: archived, before });
      setExhausted(page.length < 50);
      setRows((prev) => (append && prev ? [...prev, ...page] : page));
    } catch (e) { setError(e.message); if (!append) setRows([]); }
  }

  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function search(value) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load({ query: value }), 250);
  }

  async function toggleHistory(id) {
    if (historyFor === id) { setHistoryFor(null); return; }
    try {
      setHistory(await api.getRunHistory(id));
      setHistoryFor(id);
    } catch (e) { setError(e.message); }
  }

  async function setArchived(row, archived) {
    setError("");
    try {
      await (archived ? api.archiveRun(row.id) : api.restoreRun(row.id));
      load();
    } catch (e) { setError(e.message); }
  }

  const td = { padding: "6px 8px", fontSize: 11, borderBottom: "1px solid #eceded" };

  return (
    <Modal title="Saved runs" onClose={onClose} wide>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <input style={{ ...field, width: 280 }} placeholder="Search name or project…"
          value={q} onChange={(e) => search(e.target.value)} />
        <label style={{ fontSize: 11, color: "#4d4d4f", display: "flex", gap: 5, alignItems: "center" }}>
          <input type="checkbox" checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); load({ archived: e.target.checked }); }} />
          show archived
        </label>
      </div>
      {error && <div style={{ color: "#e12a3f", fontSize: 11, marginBottom: 8 }}>{error}</div>}
      {rows === null ? (
        <div style={{ color: "#4d4d4f", fontSize: 12, padding: 20 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "#4d4d4f", fontSize: 12, padding: 20 }}>
          No saved runs yet. Solve a site, then use 💾 Save Run.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Name", "Project", "Ver", "Last saved", "By", ""].map((h) => (
                <th key={h} style={{ ...td, textAlign: "left", fontSize: 9, color: "#4d4d4f",
                  textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr style={{ opacity: r.archived ? 0.5 : 1 }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); onOpenRun(r); }}
                      style={{ color: "#ad1f2b", textDecoration: "none" }}>{r.name}</a>
                    {r.archived && <span style={{ fontSize: 9, color: "#4d4d4f" }}> (archived)</span>}
                  </td>
                  <td style={td}>{r.project}</td>
                  <td style={td}>v{r.version_no}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{when(r.last_saved_at)}</td>
                  <td style={td}>{r.last_saved_by_upn || "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    <button style={{ ...btn, padding: "3px 8px", fontSize: 10 }}
                      onClick={() => toggleHistory(r.id)}>
                      {historyFor === r.id ? "hide history" : "history"}
                    </button>{" "}
                    <button style={{ ...btn, padding: "3px 8px", fontSize: 10 }}
                      onClick={() => setArchived(r, !r.archived)}>
                      {r.archived ? "restore" : "archive"}
                    </button>
                  </td>
                </tr>
                {historyFor === r.id && (
                  <tr>
                    <td colSpan={6} style={{ ...td, background: "#fafafa" }}>
                      {history.map((v) => (
                        <div key={v.version_no} style={{ display: "flex", gap: 12, fontSize: 11,
                          padding: "3px 0", alignItems: "baseline" }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); onOpenRun(r, v.version_no); }}
                            style={{ color: "#ad1f2b", minWidth: 28 }}>v{v.version_no}</a>
                          <span style={{ color: "#4d4d4f", minWidth: 150 }}>{when(v.saved_at)}</span>
                          <span style={{ minWidth: 160 }}>{v.saved_by_upn || "—"}</span>
                          <span style={{ color: "#4d4d4f" }}>
                            {v.pile_count.toLocaleString()} piles
                            {v.status === "inputs_only" ? " · inputs only" : ""}
                            {v.note ? ` · ${v.note}` : ""}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
      {rows && rows.length > 0 && !exhausted && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button style={btn} onClick={() => load({ append: true })}>Load more</button>
        </div>
      )}
    </Modal>
  );
}
