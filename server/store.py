"""Versioned run storage for the pile optimizer.

Same lineage model as structcalc (a run is mutable metadata; every save appends
an immutable version), with one difference driven by scale: the payload is a
single gzipped JSON document stored as BYTEA. A 200,000-pile fleet measured
26.3 MB as raw JSON and under 1 MB gzipped columnar; storing compressed bytes
keeps the row small and — because the SHA-256 is taken over the STORED bytes —
integrity can be verified without ever decompressing.

The payload is opaque to this server. It is versioned by a `format` field the
client owns; the server enforces size, not shape.
"""
from __future__ import annotations

import datetime
import gzip
import hashlib
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text,
    UniqueConstraint, create_engine, func, select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

# Compressed ceiling. The measured 200k-pile document is <1 MB compressed; 32 MiB
# is a runaway guard, not a target. The decompression guard is 64 MiB raw: over
# 2x the measured 26.3 MB worst case, while read_payload's transient 2x peak
# (~160 MB with the compressed blob) still fits the 0.5 Gi replica. 256 MiB here
# would let a save through whose own reopen OOM-kills the replica.
MAX_COMPRESSED = 32 * 1024 * 1024
MAX_DECOMPRESSED = 64 * 1024 * 1024


class PayloadTooLarge(Exception):
    pass


class RunConflict(Exception):
    pass


class RunForbidden(Exception):
    pass


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def as_utc(dt: datetime.datetime | None) -> datetime.datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=datetime.timezone.utc) if dt.tzinfo is None else dt


class CivilRun(Base):
    __tablename__ = "civil_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    project: Mapped[str] = mapped_column(String(200), default="")
    owner_oid: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    owner_upn: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    current_version_no: Mapped[int] = mapped_column(Integer, default=0)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow)
    last_saved_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, index=True)
    last_saved_by_upn: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    versions: Mapped[list["CivilRunVersion"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", lazy="noload")


class CivilRunVersion(Base):
    __tablename__ = "civil_run_versions"
    __table_args__ = (
        UniqueConstraint("run_id", "version_no", name="uq_civil_run_version"),
        Index("ix_civil_versions_run", "run_id", "version_no"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("civil_runs.id"), index=True)
    version_no: Mapped[int] = mapped_column(Integer)

    # gzipped JSON; opaque here, shaped and versioned by the client (format field)
    payload_gz: Mapped[bytes] = mapped_column(LargeBinary)
    payload_sha256: Mapped[str] = mapped_column(String(64))   # over the STORED bytes
    payload_bytes: Mapped[int] = mapped_column(Integer)       # compressed size

    # 'complete' = solved; 'inputs_only' = imported but solve not finished —
    # an abandoned 200k-pile solve must never lose the import itself.
    status: Mapped[str] = mapped_column(String(16), default="complete")
    pile_count: Mapped[int] = mapped_column(Integer, default=0)
    tracker_count: Mapped[int] = mapped_column(Integer, default=0)

    engineer: Mapped[str] = mapped_column(String(64), default="")
    checker: Mapped[str] = mapped_column(String(64), default="")
    note: Mapped[str] = mapped_column(Text, default="")

    saved_by_oid: Mapped[str] = mapped_column(String(64))
    saved_by_upn: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    saved_by_name: Mapped[str] = mapped_column(String(128), default="")
    saved_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow)
    app_build: Mapped[str] = mapped_column(String(64), default="")

    run: Mapped[CivilRun] = relationship(back_populates="versions")


def make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, future=True)
    return create_engine(url, future=True, pool_size=3, max_overflow=2,
                         pool_timeout=10, pool_pre_ping=True, pool_recycle=1800)


def init_db(engine) -> None:
    Base.metadata.create_all(engine)


# ----------------------------------------------------------------------- payload

def accept_payload(data: bytes, already_gzipped: bool) -> tuple[bytes, str]:
    """Validate, (maybe) compress, and hash. Returns (stored_bytes, sha256)."""
    if already_gzipped:
        if len(data) > MAX_COMPRESSED:
            raise PayloadTooLarge(
                f"Compressed payload is {len(data) / 1e6:.1f} MB; the ceiling is "
                f"{MAX_COMPRESSED / 1e6:.0f} MB. Split the site into phases.")
        # Sanity-decompress with a bomb guard so a corrupt upload fails on save,
        # not on the reopen months later.
        with gzip.GzipFile(fileobj=__import__("io").BytesIO(data)) as g:
            total = 0
            while True:
                chunk = g.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DECOMPRESSED:
                    raise PayloadTooLarge("Payload expands past the decompression guard.")
        stored = data
    else:
        stored = gzip.compress(data, 6)
        if len(stored) > MAX_COMPRESSED:
            raise PayloadTooLarge(
                f"Payload is {len(stored) / 1e6:.1f} MB compressed; the ceiling is "
                f"{MAX_COMPRESSED / 1e6:.0f} MB. Split the site into phases.")
    return stored, hashlib.sha256(stored).hexdigest()


def read_payload(version: CivilRunVersion) -> bytes:
    if hashlib.sha256(version.payload_gz).hexdigest() != version.payload_sha256:
        raise ValueError(
            f"Stored payload for run {version.run_id} v{version.version_no} fails "
            "its integrity hash — do not trust this record.")
    with gzip.GzipFile(fileobj=__import__("io").BytesIO(version.payload_gz)) as g:
        out = bytearray()
        while True:
            chunk = g.read(1024 * 1024)
            if not chunk:
                break
            out.extend(chunk)
            if len(out) > MAX_DECOMPRESSED:
                raise PayloadTooLarge("Stored payload expands past the guard.")
    return bytes(out)


# --------------------------------------------------------------------------- ops

def summary(run: CivilRun) -> dict:
    return {
        "id": run.id, "name": run.name, "project": run.project,
        "version_no": run.current_version_no, "archived": run.archived,
        "owner_upn": run.owner_upn, "last_saved_by_upn": run.last_saved_by_upn,
        "last_saved_at": as_utc(run.last_saved_at), "created_at": as_utc(run.created_at),
    }


def version_meta(v: CivilRunVersion) -> dict:
    return {
        "version_no": v.version_no, "status": v.status,
        "pile_count": v.pile_count, "tracker_count": v.tracker_count,
        "engineer": v.engineer, "checker": v.checker, "note": v.note,
        "saved_by_upn": v.saved_by_upn, "saved_by_name": v.saved_by_name,
        "saved_at": as_utc(v.saved_at), "app_build": v.app_build,
        "payload_bytes": v.payload_bytes, "payload_sha256": v.payload_sha256,
    }


def create_run(session: Session, *, name, project, principal, stored, sha, meta) -> tuple[CivilRun, CivilRunVersion]:
    run = CivilRun(name=name or "Untitled run", project=project or "",
                   owner_oid=principal.oid, owner_upn=principal.upn,
                   last_saved_by_upn=principal.upn, current_version_no=0)
    session.add(run)
    session.flush()
    v = _append(session, run, principal, stored, sha, meta)
    return run, v


def append_version(session: Session, run_id: int, *, base_version_no: int,
                   principal, stored, sha, meta,
                   name: str | None = None, project: str | None = None,
                   admins: set[str] | None = None) -> CivilRunVersion:
    run = session.get(CivilRun, run_id, with_for_update=True)
    if run is None:
        raise KeyError(f"No run {run_id}")
    if base_version_no != run.current_version_no:
        raise RunConflict(
            f"This run is at version {run.current_version_no}; you were editing "
            f"version {base_version_no}. Reload to see the newer version first.")
    # Appending is open to everyone (it destroys nothing), but renaming the run
    # is owner/admin-only — a colleague's save keeps its content while the
    # run's display name stays the owner's.
    if name is not None or project is not None:
        try:
            require_can_manage(run, principal, admins or set())
        except RunForbidden:
            name = project = None
        if name is not None:
            run.name = name
        if project is not None:
            run.project = project
    return _append(session, run, principal, stored, sha, meta)


def _append(session, run, principal, stored, sha, meta) -> CivilRunVersion:
    v = CivilRunVersion(
        run_id=run.id, version_no=run.current_version_no + 1,
        payload_gz=stored, payload_sha256=sha, payload_bytes=len(stored),
        status=meta.get("status", "complete"),
        pile_count=int(meta.get("pile_count") or 0),
        tracker_count=int(meta.get("tracker_count") or 0),
        engineer=meta.get("engineer") or "", checker=meta.get("checker") or "",
        note=meta.get("note") or "",
        saved_by_oid=principal.oid, saved_by_upn=principal.upn,
        saved_by_name=principal.name or "",
        app_build=meta.get("app_build") or "",
    )
    session.add(v)
    run.current_version_no = v.version_no
    run.last_saved_by_upn = principal.upn
    run.last_saved_at = utcnow()
    session.flush()
    return v


def list_runs(session: Session, *, q=None, include_archived=False, limit=50, before=None):
    limit = max(1, min(limit, 200))
    stmt = select(CivilRun.id, CivilRun.name, CivilRun.project,
                  CivilRun.current_version_no, CivilRun.archived, CivilRun.owner_upn,
                  CivilRun.last_saved_by_upn, CivilRun.last_saved_at, CivilRun.created_at)
    if not include_archived:
        stmt = stmt.where(CivilRun.archived.is_(False))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(func.lower(CivilRun.name).like(func.lower(like))
                          | func.lower(CivilRun.project).like(func.lower(like)))
    if before is not None:
        stmt = stmt.where(CivilRun.last_saved_at < before)
    stmt = stmt.order_by(CivilRun.last_saved_at.desc(), CivilRun.id.desc()).limit(limit)
    return [
        {"id": r.id, "name": r.name, "project": r.project,
         "version_no": r.current_version_no, "archived": r.archived,
         "owner_upn": r.owner_upn, "last_saved_by_upn": r.last_saved_by_upn,
         "last_saved_at": as_utc(r.last_saved_at), "created_at": as_utc(r.created_at)}
        for r in session.execute(stmt).all()
    ]


def get_version(session: Session, run_id: int, version_no: int | None = None):
    run = session.get(CivilRun, run_id)
    if run is None:
        raise KeyError(f"No run {run_id}")
    wanted = version_no or run.current_version_no
    v = session.scalar(select(CivilRunVersion).where(
        CivilRunVersion.run_id == run_id, CivilRunVersion.version_no == wanted))
    if v is None:
        raise KeyError(f"No version {wanted} of run {run_id}")
    return run, v


def list_versions(session: Session, run_id: int):
    rows = session.execute(
        select(CivilRunVersion).where(CivilRunVersion.run_id == run_id)
        .order_by(CivilRunVersion.version_no.desc())).scalars().all()
    return [version_meta(v) for v in rows]


def require_can_manage(run: CivilRun, principal, admins: set[str]) -> None:
    upn = (principal.upn or "").lower()
    if upn and upn in {a.lower() for a in admins}:
        return
    if run.owner_oid and principal.oid and run.owner_oid == principal.oid:
        return
    raise RunForbidden(
        f"This run belongs to {run.owner_upn or 'an unidentified user'}. "
        "Ask them, or a run administrator, to change it.")
