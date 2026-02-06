from __future__ import annotations

from typing import Dict


def laptop_stock(role: str) -> Dict[str, str]:
    # Deterministic stock rules (demo-safe)
    r = (role or "").lower()
    if "engineer" in r or "developer" in r:
        return {"model": "Dell XPS 13", "status": "LOW_STOCK"}
    if "designer" in r:
        return {"model": "MacBook Pro 14", "status": "AVAILABLE"}
    return {"model": "Standard ThinkPad", "status": "AVAILABLE"}


def delivery_days(work_location: str) -> int:
    loc = (work_location or "").upper()
    if loc in {"AE", "UAE"}:
        return 3
    return 7


def facilities_seating_eta_days(work_location: str) -> int:
    loc = (work_location or "").upper()
    if loc in {"AE", "UAE"}:
        return 2
    return 5
