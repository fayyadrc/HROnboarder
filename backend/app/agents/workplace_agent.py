from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from app.agents.base_agent import BaseAgent, AgentResult
from app.db.database import SessionLocal
from app.db.models import WorkplaceAssignment
from app.tools.workplace_tools import equipment_bundle_by_role, seating_plan_for_location


@dataclass
class _WorkplacePlan:
    equipment: Dict[str, Any]
    seating: Dict[str, Any]


class WorkplaceServicesAgent(BaseAgent):
    """
    Workplace Services Agent (Milestone 3.1):
    - Choose equipment bundle (workplace-managed)
    - Assign seating based on location and role
    - DB-backed idempotency: one assignment per case_id
    """
    name = "workplace"

    async def run(self, case: Dict[str, Any], notes: str = "") -> AgentResult:
        seed = case.get("seed", {}) or {}
        steps = case.get("steps", {}) or {}

        case_id = (case.get("caseId") or "").strip()
        role = (seed.get("role") or "").strip()
        work_location = (seed.get("workLocation") or "").strip()

        full_name = seed.get("candidateName") or case.get("candidateName") or "Candidate"

        work_mode = (
            (steps.get("work_preferences") or {}).get("workMode")
            or (steps.get("offer") or {}).get("workMode")
            or "ONSITE"
        )

        risks: List[str] = []
        actions: List[dict] = []

        # --- Idempotency: if assignment exists, return it ---
        if case_id:
            db = SessionLocal()
            try:
                existing = db.query(WorkplaceAssignment).filter(WorkplaceAssignment.case_id == case_id).first()
                if existing:
                    equip = existing.equipment or {}
                    seat = existing.seating or {}
                    summary = (
                        f"Workplace already assigned for {full_name}: "
                        f"Bundle '{existing.bundle_name}' + Seat '{existing.seat_id}'."
                    )
                    actions.append(
                        {
                            "type": "WORKPLACE_IDEMPOTENT_HIT",
                            "seatId": existing.seat_id,
                            "bundleName": existing.bundle_name,
                            "deviceModel": existing.device_model,
                        }
                    )
                    return AgentResult(
                        agent=self.name,
                        summary=summary,
                        risks=[],
                        actions=actions,
                        data={
                            "fullName": full_name,
                            "workMode": work_mode,
                            "equipment": equip,
                            "seating": seat,
                        },
                    )
            finally:
                db.close()

        # --- Create assignment ---
        equip = equipment_bundle_by_role(role)
        seat = seating_plan_for_location(work_location, role=role, work_mode=work_mode)

        if not work_location:
            risks.append("Missing workLocation. Seating assignment may be incorrect.")
        if not role:
            risks.append("Missing role. Equipment bundle may be generic.")

        actions.append({"type": "WORKPLACE_EQUIPMENT_BUNDLE", "bundle": equip})
        actions.append({"type": "WORKPLACE_SEATING_ASSIGNED", "seat": seat})

        summary = (
            f"Workplace planned for {full_name}: "
            f"Bundle '{equip.get('bundleName')}' + Seat '{seat.get('seatId')}'."
        )

        # Persist for idempotency if possible
        if case_id:
            db = SessionLocal()
            try:
                row = WorkplaceAssignment(
                    case_id=case_id,
                    seat_id=(seat.get("seatId") or ""),
                    bundle_name=(equip.get("bundleName") or ""),
                    device_model=(equip.get("deviceModel") or ""),
                    equipment=equip,
                    seating=seat,
                )
                db.merge(row)  # safe upsert for SQLite demo
                db.commit()
            finally:
                db.close()

        return AgentResult(
            agent=self.name,
            summary=summary,
            risks=risks,
            actions=actions,
            data={
                "fullName": full_name,
                "workMode": work_mode,
                "equipment": equip,
                "seating": seat,
            },
        )
