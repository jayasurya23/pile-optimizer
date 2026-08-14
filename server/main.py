"""Pile-optimizer backend: run persistence + static hosting.

Replaces nginx in the container. The optimisation still happens entirely in the
browser — this server only stores named, versioned, attributed runs and hands
back the built SPA. Same topology as structcalc, so both apps are one pattern.

The nginx security headers and the EasyAuth tripwire move here as middleware.
"""
from __future__ import annotations

import datetime
import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from server import store
from server.auth import (
    ID_HEADER, NAME_HEADER, PRINCIPAL_HEADER, DEV_MODE, Principal,
    current_principal, run_admins,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Castillo Pile Plan Optimizer",
    docs_url="/docs" if DEV_MODE else None,
    redoc_url=None,
    openapi_url="/openapi.json" if DEV_MODE else None,
)

_engine = None


def engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL", "")
        if not url:
            if not DEV_MODE:
                # sqlite in the container would "work" and then lose every run
                # on the next revision. Refuse loudly instead.
                raise RuntimeError("DATABASE_URL is not set.")
            url = f"sqlite:///{os.environ.get('CIVIL_SQLITE_PATH', 'civil.db')}"
        _engine = store.make_engine(url)
        store.init_db(_engine)
    return _engine


# ------------------------------------------------------------------- middleware

SECURITY_HEADERS = {
    # Self-contained app: Jost is self-hosted, no external requests at all.
    "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; "
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
}

# The compressed ceiling is 32 MiB; leave multipart overhead headroom.
MAX_BODY = 40 * 1024 * 1024


@app.middleware("http")
async def guard(request: Request, call_next):
    # Body cap before anything reads it — a 0.5 GiB replica must never buffer
    # an unbounded upload.
    length = request.headers.get("content-length")
    if length and int(length) > MAX_BODY:
        return JSONResponse(status_code=413, content={
            "detail": f"Request body over {MAX_BODY // (1024 * 1024)} MB."})

    # EasyAuth tripwire, previously nginx's job: fail closed if the auth sidecar
    # is not in the request path. /healthz stays open — Container Apps probes
    # hit the container port directly with no EasyAuth headers.
    if not DEV_MODE and request.url.path != "/healthz":
        present = any(request.headers.get(h)
                      for h in (ID_HEADER, PRINCIPAL_HEADER, NAME_HEADER))
        if not present:
            return JSONResponse(status_code=403, content={
                "detail": "This app is not reachable directly. Sign in at the published address."})

    response = await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        response.headers.setdefault(k, v)
    return response


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@app.get("/api/me")
def me(principal: Principal = Depends(current_principal)) -> dict:
    return {"user": principal.upn or "", "oid": principal.oid,
            "build": os.environ.get("GIT_SHA", "dev")}


# ------------------------------------------------------------------------- runs

def _meta_from(meta_json: str) -> dict:
    try:
        meta = json.loads(meta_json)
        assert isinstance(meta, dict)
        return meta
    except Exception:
        raise HTTPException(status_code=422, detail="meta must be a JSON object") from None


def _accept(payload: UploadFile, payload_encoding: str) -> tuple[bytes, str]:
    data = payload.file.read(MAX_BODY + 1)
    if len(data) > MAX_BODY:
        raise HTTPException(status_code=413, detail="Payload over the request ceiling.")
    try:
        return store.accept_payload(data, already_gzipped=payload_encoding == "gzip")
    except store.PayloadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from None


@app.get("/api/runs")
def list_runs(q: Optional[str] = None, include_archived: bool = False,
              limit: int = Query(50, ge=1, le=200),
              before: Optional[datetime.datetime] = None,
              _p: Principal = Depends(current_principal)) -> list[dict]:
    with Session(engine()) as session:
        return store.list_runs(session, q=q, include_archived=include_archived,
                               limit=limit, before=before)


@app.post("/api/runs", status_code=201)
def create_run(meta: str = Form(...), payload: UploadFile = File(...),
               payload_encoding: str = Form("json"),
               principal: Principal = Depends(current_principal)) -> dict:
    m = _meta_from(meta)
    stored, sha = _accept(payload, payload_encoding)
    m.setdefault("app_build", os.environ.get("GIT_SHA", "dev"))
    with Session(engine()) as session:
        run, v = store.create_run(
            session, name=m.get("name") or "", project=m.get("project") or "",
            principal=principal, stored=stored, sha=sha, meta=m)
        session.commit()
        return {"run": store.summary(run), "version": store.version_meta(v)}


@app.post("/api/runs/{run_id}/versions", status_code=201)
def append_version(run_id: int, meta: str = Form(...), payload: UploadFile = File(...),
                   payload_encoding: str = Form("json"),
                   principal: Principal = Depends(current_principal)) -> dict:
    m = _meta_from(meta)
    if m.get("base_version_no") is None:
        raise HTTPException(status_code=422,
                            detail="base_version_no is required in meta.")
    stored, sha = _accept(payload, payload_encoding)
    m.setdefault("app_build", os.environ.get("GIT_SHA", "dev"))
    with Session(engine()) as session:
        try:
            v = store.append_version(
                session, run_id, base_version_no=int(m["base_version_no"]),
                principal=principal, stored=stored, sha=sha, meta=m,
                name=m.get("name"), project=m.get("project"),
                admins=run_admins())
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        except store.RunConflict as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from None
        session.commit()
        run = session.get(store.CivilRun, run_id)
        return {"run": store.summary(run), "version": store.version_meta(v)}


@app.get("/api/runs/{run_id}")
def get_run(run_id: int, version_no: Optional[int] = None,
            _p: Principal = Depends(current_principal)) -> dict:
    with Session(engine()) as session:
        try:
            run, v = store.get_version(session, run_id, version_no)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        return {"run": store.summary(run), "version": store.version_meta(v)}


@app.get("/api/runs/{run_id}/payload")
def get_payload(run_id: int, version_no: Optional[int] = None,
                _p: Principal = Depends(current_principal)) -> Response:
    """The stored document, decompressed server-side and integrity-checked."""
    with Session(engine()) as session:
        try:
            _run, v = store.get_version(session, run_id, version_no)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        try:
            raw = store.read_payload(v)
        except (ValueError, store.PayloadTooLarge) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from None
        return Response(content=raw, media_type="application/json")


@app.get("/api/runs/{run_id}/versions")
def run_history(run_id: int, _p: Principal = Depends(current_principal)) -> list[dict]:
    with Session(engine()) as session:
        return store.list_versions(session, run_id)


@app.post("/api/runs/{run_id}/archive")
def archive(run_id: int, principal: Principal = Depends(current_principal)) -> dict:
    return _set_archived(run_id, principal, True)


@app.post("/api/runs/{run_id}/restore")
def restore(run_id: int, principal: Principal = Depends(current_principal)) -> dict:
    return _set_archived(run_id, principal, False)


def _set_archived(run_id: int, principal: Principal, archived: bool) -> dict:
    with Session(engine()) as session:
        run = session.get(store.CivilRun, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"No run {run_id}")
        try:
            store.require_can_manage(run, principal, run_admins())
        except store.RunForbidden as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from None
        run.archived = archived
        session.commit()
        return store.summary(run)


# ---------------------------------------------------------------- static SPA

_STATIC = Path(__file__).resolve().parents[1] / "dist"

if _STATIC.is_dir():
    app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        candidate = (_STATIC / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(_STATIC):
            # Vite hashes /assets; everything else (fonts, sample xlsx) is stable
            return FileResponse(candidate)
        index = FileResponse(_STATIC / "index.html")
        index.headers["Cache-Control"] = "no-cache, must-revalidate"
        return index
