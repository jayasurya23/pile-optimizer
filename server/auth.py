"""Identity from the Azure Container Apps auth sidecar.

Same contract as structcalc's api/auth.py: the GATE is jwtClaimChecks.allowedGroups
on the sidecar; this is the tripwire that fails closed if the sidecar leaves the
request path, plus the attribution source for saved runs. The UPN comparison
rules (exact domain, #EXT# rejection) are documented in the structcalc repo at
docs/ACCESS_CONTROL.md §5.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

_log = logging.getLogger("pileopt.auth")

MEMBER_DOMAINS = frozenset({"castillope.com"})
PRINCIPAL_HEADER = "x-ms-client-principal"
NAME_HEADER = "x-ms-client-principal-name"
ID_HEADER = "x-ms-client-principal-id"
_UPN_CLAIMS = (
    "upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
    "preferred_username",
)

DEV_MODE = os.environ.get("LOCAL_DEV_MODE", "").lower() in ("1", "true", "yes")
DEV_USER = os.environ.get("DEV_USER", "dev@castillope.com")


@dataclass(frozen=True)
class Principal:
    oid: str
    upn: str | None      # None when no UPN-shaped claim was found — never a sentinel
    name: str
    raw: str | None


def domain_of(address: str) -> str | None:
    a = address.strip().lower()
    if a.count("@") != 1:
        return None
    local, _, dom = a.partition("@")
    if not local or not dom or any(c in local for c in " \t,"):
        return None
    return dom


def is_member_address(address: str | None) -> bool:
    if not address:
        return False
    a = address.strip().lower()
    if "#ext#" in a:
        return False
    return domain_of(a) in MEMBER_DOMAINS


def _decode_principal(blob: str) -> list[dict]:
    s = blob.strip().replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    try:
        obj = json.loads(base64.b64decode(s, validate=False).decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return []
    claims = obj.get("claims")
    return [c for c in claims if isinstance(c, dict)] if isinstance(claims, list) else []


def _identity(request: Request) -> str | None:
    blob = request.headers.get(PRINCIPAL_HEADER)
    if blob:
        for typ in _UPN_CLAIMS:
            vals = [c["val"] for c in _decode_principal(blob)
                    if c.get("typ") == typ and isinstance(c.get("val"), str)]
            if len(vals) == 1:
                return vals[0]
    name = request.headers.get(NAME_HEADER)
    if name and "@" in name:
        return name
    return None


async def current_principal(request: Request) -> Principal:
    if DEV_MODE:
        return Principal(oid="local-dev", upn=DEV_USER, name="Local dev", raw=None)

    present = any(request.headers.get(h) for h in (ID_HEADER, PRINCIPAL_HEADER, NAME_HEADER))
    if not present:
        _log.error("DENY: no EasyAuth headers on %s %s", request.method, request.url.path)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This service is not reachable directly. Sign in at the published address.")

    who = _identity(request)
    if who is not None and not is_member_address(who):
        _log.error("DENY: non-member %r reached the app — CHECK allowedGroups", who)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Limited to Castillo Engineering staff accounts (@castillope.com).")

    oid = request.headers.get(ID_HEADER) or ""
    if not oid:
        _log.error("DENY: EasyAuth present but no principal id header")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Could not establish your identity. Sign in again.")
    if who is None:
        _log.error("AUTH SHAPE UNKNOWN: storing raw principal, UPN left null")
    return Principal(
        oid=oid,
        upn=who.strip().lower() if who else None,
        name=request.headers.get(NAME_HEADER) or "",
        raw=None if who else request.headers.get(PRINCIPAL_HEADER),
    )


def run_admins() -> set[str]:
    return {a.strip().lower() for a in os.environ.get("RUN_ADMINS", "").split(",") if a.strip()}
