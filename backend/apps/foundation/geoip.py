"""Resolve login-audit IP addresses to a human-readable location.

`LoginActivity` stores the caller's IP at write time and leaves `location`
blank: looking one up is a third-party network call, and nothing on the login
path is allowed to wait on the network. This module is the deferred half,
driven by the `resolve_login_locations` command.

The provider is ip-api.com — no API key, free tier, the same service the
previous platform used. Lookups go through its BATCH endpoint, so a backlog
costs one request per 100 addresses instead of one per address; that keeps even
a large sweep well inside the free tier's rate limit.
"""
import ipaddress
import logging

import requests
from django.conf import settings

logger = logging.getLogger("kaysetu.foundation")

# ip-api's documented maximum number of addresses in one batch request.
BATCH_SIZE = 100

# Private/loopback callers have no public location. Saying so beats leaving the
# row unresolved forever, which is what the log did before this existed.
PRIVATE_LABEL = "Local / Private network"

_FIELDS = "status,message,country,regionName,city,query"


def _is_public(ip):
    """True/False for a real address, None for something that isn't one."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    return not (addr.is_private or addr.is_loopback or addr.is_reserved
                or addr.is_link_local or addr.is_multicast or addr.is_unspecified)


def _format(entry):
    parts = [entry.get("city") or "", entry.get("regionName") or "", entry.get("country") or ""]
    return ", ".join(p for p in parts if p)[:120]


def resolve(ips):
    """Look up `ips` and return ``{ip: location}``.

    A key is present for every address that got a verdict — including one whose
    location is `""`, meaning "this is a real address the provider knows
    nothing about". That is still an answer, and recording it is what stops the
    row being retried on every sweep from now until forever.

    Addresses MISSING from the result could not be reached at all (the provider
    was down, the request timed out). Those are left alone so the next sweep
    picks them up again.
    """
    verdicts = {}
    lookups = []
    for ip in dict.fromkeys(ips):        # de-dupe, preserve order
        public = _is_public(ip) if ip else None
        if public is None:               # blank, or not an IP address at all
            verdicts[ip] = ""
        elif public:
            lookups.append(ip)
        else:
            verdicts[ip] = PRIVATE_LABEL

    if not lookups:
        return verdicts
    if not getattr(settings, "GEOIP_LOOKUP_ENABLED", False):
        # Switched off for this deployment: report nothing rather than guessing,
        # and leave the rows unresolved in case it is switched back on.
        return verdicts

    for start in range(0, len(lookups), BATCH_SIZE):
        chunk = lookups[start:start + BATCH_SIZE]
        try:
            response = requests.post(
                settings.GEOIP_BATCH_URL,
                json=[{"query": ip, "fields": _FIELDS} for ip in chunk],
                timeout=15,
            )
            response.raise_for_status()
            entries = response.json()
        except Exception:   # noqa: BLE001 — network, HTTP and parse failures are all "try again later"
            logger.warning("geoip lookup failed for %d address(es)", len(chunk), exc_info=True)
            continue
        if not isinstance(entries, list):
            logger.warning("geoip returned %s, expected a list", type(entries).__name__)
            continue
        for ip, entry in zip(chunk, entries):
            if not isinstance(entry, dict):
                continue
            # The response echoes `query` back; trust that over positional order.
            verdicts[entry.get("query") or ip] = (
                _format(entry) if entry.get("status") == "success" else "")
    return verdicts
