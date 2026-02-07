from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from app.tools.logistics_tools import delivery_days


def equipment_bundle_by_role(role: str) -> Dict[str, object]:
    r = (role or "").strip().lower()

    if "engineer" in r or "developer" in r or "software" in r:
        return {
            "model": "Dell Latitude 5440",
            "accessories": ["USB-C Dock", "Noise-cancelling Headset", "Laptop Sleeve"],
        }
    if "data" in r or "analyst" in r:
        return {
            "model": "Lenovo ThinkPad T14",
            "accessories": ["USB-C Dock", "External Monitor (24\")"],
        }
    if "manager" in r or "lead" in r:
        return {
            "model": "Apple MacBook Air (M2)",
            "accessories": ["USB-C Hub", "External Monitor (27\")"],
        }

    # Default bundle
    return {
        "model": "HP EliteBook 840",
        "accessories": ["USB-C Dock"],
    }


def access_groups_by_role(role: str) -> List[str]:
    r = (role or "").strip().lower()
    groups = ["BASELINE-EMPLOYEE"]

    if "engineer" in r or "developer" in r or "software" in r:
        groups += ["ENG-ALL", "GIT-ACCESS", "JIRA-ACCESS"]
    if "data" in r or "analyst" in r:
        groups += ["DATA-ALL", "BI-ACCESS"]
    if "manager" in r or "lead" in r:
        groups += ["MGMT-ALL", "FINANCE-READONLY"]

    return sorted(set(groups))


def it_delivery_days_for_location(work_location: str) -> int:
    # Reuse deterministic logistics rule for delivery SLA consistency.
    return int(delivery_days(work_location))


def ticket_templates() -> List[Dict[str, object]]:
    # SLA days are hackathon-friendly defaults.
    return [
        {"key": "IT-AD", "title": "Create corporate identity (AD/SSO)", "owner": "IT", "sla_days": 1},
        {"key": "IT-EMAIL", "title": "Provision corporate mailbox", "owner": "IT", "sla_days": 1},
        {"key": "IT-DEVICE", "title": "Provision laptop and accessories", "owner": "IT", "sla_days": 3},
        {"key": "IT-ACCESS", "title": "Assign role-based access groups", "owner": "IT", "sla_days": 1},
    ]
