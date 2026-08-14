"""Civil run storage: gzip integrity, append-only lineage, API round trip."""
import gzip
import io
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from server import auth as auth_mod
from server import main as main_mod
from server import store
from server.auth import Principal

ALICE = Principal(oid="oid-alice", upn="alice@castillope.com", name="Alice", raw=None)
BOB = Principal(oid="oid-bob", upn="bob@castillope.com", name="Bob", raw=None)

DOC = json.dumps({"format": "pileopt/1", "constraints": {"minReveal": 2.0},
                  "rawData": {"__cols": {"TrackerID": ["1-1"]}, "__n": 1},
                  "results": {}}).encode()


# -------------------------------------------------------------------- payload

def test_raw_json_is_compressed_and_round_trips():
    stored, sha = store.accept_payload(DOC, already_gzipped=False)
    assert len(stored) < len(DOC) or len(DOC) < 200   # tiny docs may not shrink
    v = store.CivilRunVersion(payload_gz=stored, payload_sha256=sha,
                              run_id=1, version_no=1)
    assert store.read_payload(v) == DOC


def test_pre_gzipped_bytes_are_stored_verbatim():
    gz = gzip.compress(DOC, 9)
    stored, sha = store.accept_payload(gz, already_gzipped=True)
    assert stored == gz                                # byte-identical, sha meaningful
    v = store.CivilRunVersion(payload_gz=stored, payload_sha256=sha,
                              run_id=1, version_no=1)
    assert store.read_payload(v) == DOC


def test_oversized_payload_is_refused(monkeypatch):
    monkeypatch.setattr(store, "MAX_COMPRESSED", 64)
    with pytest.raises(store.PayloadTooLarge):
        store.accept_payload(b"x" * 100_000, already_gzipped=False)


def test_decompression_bomb_is_refused_on_save(monkeypatch):
    monkeypatch.setattr(store, "MAX_DECOMPRESSED", 1024)
    bomb = gzip.compress(b"\x00" * 100_000)
    with pytest.raises(store.PayloadTooLarge):
        store.accept_payload(bomb, already_gzipped=True)


def test_tampered_payload_fails_integrity_on_read():
    stored, sha = store.accept_payload(DOC, already_gzipped=False)
    tampered = bytes([stored[0] ^ 0xFF]) + stored[1:]
    v = store.CivilRunVersion(payload_gz=tampered, payload_sha256=sha,
                              run_id=1, version_no=1)
    with pytest.raises(ValueError, match="integrity"):
        store.read_payload(v)


# -------------------------------------------------------------------- lineage

@pytest.fixture()
def session(tmp_path):
    eng = store.make_engine(f"sqlite:///{tmp_path / 'civil.db'}")
    store.init_db(eng)
    with Session(eng) as s:
        yield s


def _mk(session, principal=ALICE, name="Trigo Ranch"):
    stored, sha = store.accept_payload(DOC, already_gzipped=False)
    run, v = store.create_run(session, name=name, project="265-100",
                              principal=principal, stored=stored, sha=sha,
                              meta={"engineer": "LB", "pile_count": 1, "tracker_count": 1})
    session.commit()
    return run, v


def test_saves_append_and_never_overwrite(session):
    run, _ = _mk(session)
    stored, sha = store.accept_payload(b'{"v": 2}', already_gzipped=False)
    store.append_version(session, run.id, base_version_no=1, principal=BOB,
                         stored=stored, sha=sha, meta={"note": "revised"})
    session.commit()
    _, v1 = store.get_version(session, run.id, 1)
    _, v2 = store.get_version(session, run.id)
    assert v2.version_no == 2 and v2.saved_by_upn == "bob@castillope.com"
    assert store.read_payload(v1) == DOC               # Alice's bytes untouched
    assert v1.saved_by_upn == "alice@castillope.com" and v1.engineer == "LB"


def test_stale_base_version_is_refused(session):
    run, _ = _mk(session)
    stored, sha = store.accept_payload(b"{}", already_gzipped=False)
    store.append_version(session, run.id, base_version_no=1, principal=ALICE,
                         stored=stored, sha=sha, meta={})
    session.commit()
    with pytest.raises(store.RunConflict, match="version 2"):
        store.append_version(session, run.id, base_version_no=1, principal=BOB,
                             stored=stored, sha=sha, meta={})


def test_non_owner_save_keeps_content_but_not_the_rename(session):
    run, _ = _mk(session)
    stored, sha = store.accept_payload(b"{}", already_gzipped=False)
    store.append_version(session, run.id, base_version_no=1, principal=BOB,
                         stored=stored, sha=sha, meta={}, name="hijacked")
    session.commit()
    assert run.name == "Trigo Ranch" and run.current_version_no == 2
    store.append_version(session, run.id, base_version_no=2, principal=ALICE,
                         stored=stored, sha=sha, meta={}, name="renamed by owner")
    assert run.name == "renamed by owner"


def test_only_owner_or_admin_manage_archival(session):
    run, _ = _mk(session)
    with pytest.raises(store.RunForbidden):
        store.require_can_manage(run, BOB, set())
    store.require_can_manage(run, ALICE, set())
    store.require_can_manage(run, BOB, {"bob@castillope.com"})


def test_timestamps_are_utc(session):
    _mk(session)
    row = store.list_runs(session)[0]
    assert row["last_saved_at"].utcoffset().total_seconds() == 0


# ------------------------------------------------------------------------ API

@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_mod, "DEV_MODE", True)
    monkeypatch.setattr(main_mod, "DEV_MODE", True)
    eng = store.make_engine(f"sqlite:///{tmp_path / 'api.db'}")
    store.init_db(eng)
    monkeypatch.setattr(main_mod, "_engine", eng)
    return TestClient(main_mod.app)


def _post(client, url, meta, payload=DOC, encoding="json"):
    return client.post(url, data={"meta": json.dumps(meta), "payload_encoding": encoding},
                       files={"payload": ("snapshot", io.BytesIO(payload))})


def test_api_round_trip(client):
    r = _post(client, "/api/runs", {"name": "Phase 2", "project": "265-100",
                                    "engineer": "LB", "pile_count": 1, "tracker_count": 1})
    assert r.status_code == 201, r.text
    run_id = r.json()["run"]["id"]
    assert r.json()["version"]["version_no"] == 1

    # gzip upload path, exactly as the browser sends it
    r2 = _post(client, f"/api/runs/{run_id}/versions",
               {"base_version_no": 1, "note": "v2"},
               payload=gzip.compress(b'{"v": 2}'), encoding="gzip")
    assert r2.status_code == 201, r2.text

    stale = _post(client, f"/api/runs/{run_id}/versions", {"base_version_no": 1})
    assert stale.status_code == 409

    missing_base = _post(client, f"/api/runs/{run_id}/versions", {})
    assert missing_base.status_code == 422

    assert client.get("/api/runs").json()[0]["version_no"] == 2
    assert client.get(f"/api/runs/{run_id}/payload").json() == {"v": 2}
    assert client.get(f"/api/runs/{run_id}/payload?version_no=1").content == DOC
    assert len(client.get(f"/api/runs/{run_id}/versions").json()) == 2

    assert client.post(f"/api/runs/{run_id}/archive").status_code == 200
    assert client.get("/api/runs").json() == []
    assert client.post(f"/api/runs/{run_id}/restore").status_code == 200
    assert len(client.get("/api/runs").json()) == 1


def test_api_refuses_non_json_meta(client):
    r = client.post("/api/runs", data={"meta": "not json"},
                    files={"payload": ("snapshot", io.BytesIO(DOC))})
    assert r.status_code == 422


def test_healthz_is_open_and_api_is_tripwired_without_dev_mode(monkeypatch, tmp_path):
    monkeypatch.setattr(auth_mod, "DEV_MODE", False)
    monkeypatch.setattr(main_mod, "DEV_MODE", False)
    eng = store.make_engine(f"sqlite:///{tmp_path / 'trip.db'}")
    store.init_db(eng)
    monkeypatch.setattr(main_mod, "_engine", eng)
    c = TestClient(main_mod.app)
    assert c.get("/healthz").status_code == 200
    assert c.get("/api/runs").status_code == 403       # no EasyAuth headers
