from __future__ import annotations

import random
from typing import Any, Dict


def equipment_bundle_by_role(role: str) -> Dict[str, Any]:
    """
    Workplace-managed equipment bundles. Keep deterministic for demo.
    IMPORTANT: includes a concrete `deviceModel` so Logistics/IT can align.
    """
    r = (role or "").lower()

    # Pick concrete models for demo consistency (avoid "either/or" strings)
    if any(k in r for k in ["developer", "engineer", "data", "ai", "ml"]):
        return {
            "bundleName": "Power User (Dev/Data)",
            "deviceModel": "Dell Latitude 5440",
            "monitor": "27-inch monitor",
            "accessories": ["Dock", "Keyboard", "Mouse", "Headset"],
        }

    if any(k in r for k in ["manager", "director", "lead", "head"]):
        return {
            "bundleName": "Leader Bundle",
            "deviceModel": "Dell Latitude 7440",
            "monitor": "34-inch ultrawide",
            "accessories": ["Dock", "Keyboard", "Mouse", "Noise-cancel headset"],
        }

    return {
        "bundleName": "Standard Bundle",
        "deviceModel": "Dell Latitude 5440",
        "monitor": "24-inch monitor",
        "accessories": ["Dock", "Keyboard", "Mouse"],
    }


def seating_plan_for_location(work_location: str, role: str = "", work_mode: str = "ONSITE") -> Dict[str, Any]:
    """
    Simple seat allocator for demo. In a real build you’d check inventory.
    """
    loc = (work_location or "HQ").strip().upper()
    mode = (work_mode or "ONSITE").strip().upper()

    if mode in {"REMOTE", "HYBRID_REMOTE"}:
        return {
            "seatId": "REMOTE-N/A",
            "building": None,
            "floor": None,
            "zone": "Remote",
            "notes": "Remote work mode; no permanent seat allocated.",
        }

    # Deterministic-ish seat id for demo
    random.seed(f"{loc}:{role}")
    floor = random.choice([2, 3, 4, 5, 6])
    zone = random.choice(["A", "B", "C", "D"])
    desk = random.randint(10, 99)

    return {
        "seatId": f"{loc}-{floor}{zone}-{desk}",
        "building": loc,
        "floor": floor,
        "zone": zone,
        "notes": "Auto-assigned demo seat. Replace with real facilities inventory later.",
    }
