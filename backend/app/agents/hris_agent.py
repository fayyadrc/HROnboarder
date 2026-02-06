from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents.base_agent import BaseAgent, AgentResult
from app.db.models import EmployeeRecord


def _iso_now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


class HRISAgent(BaseAgent):
    name = "hris"

    async def run(self, case: Dict[str, Any], notes: str = "", db: Optional[Session] = None) -> AgentResult:
        if db is None:
            raise RuntimeError("HRISAgent requires db Session")

        case_id = str(case.get("caseId") or "")
        seed = case.get("seed", {}) or {}
        steps = case.get("steps", {}) or {}

        full_name = seed.get("candidateName") or case.get("candidateName") or "Candidate"
        # Try to pick email from a step if it exists; otherwise fallback to seed/prior.
        identity_step = steps.get("identity_contact") or steps.get("identity") or {}
        email = (
            identity_step.get("email")
            or identity_step.get("personalEmail")
            or seed.get("personalEmail")
            or "unknown@example.com"
        )

        # Hackathon: use role as department placeholder unless you later add department to HR create form.
        department = seed.get("department") or seed.get("role") or "General"
        start_date = seed.get("startDate")

        # Idempotency: one employee record per case
        existing = db.query(EmployeeRecord).filter(EmployeeRecord.case_id == case_id).first()
        if existing:
            return AgentResult(
                agent=self.name,
                summary=f"HRIS already exists for case. Employee {existing.employee_id}.",
                risks=[],
                actions=[{"type": "HRIS_IDEMPOTENT_HIT", "employeeId": existing.employee_id}],
                data={
                    "employeeId": existing.employee_id,
                    "createdAt": existing.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if existing.created_at else _iso_now(),
                    "idempotencyKey": f"case:{case_id}",
                    "fullName": existing.full_name,
                    "email": existing.email,
                    "department": existing.department,
                },
            )

        employee_id = f"EMP-{case_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        rec = EmployeeRecord(
            case_id=case_id,
            employee_id=employee_id,
            full_name=full_name,
            email=email,
            department=department,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

        return AgentResult(
            agent=self.name,
            summary=f"HRIS created employee record {employee_id}.",
            risks=[],
            actions=[{"type": "HRIS_CREATED", "employeeId": employee_id}],
            data={
                "employeeId": employee_id,
                "createdAt": rec.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if rec.created_at else _iso_now(),
                "idempotencyKey": f"case:{case_id}",
                "fullName": full_name,
                "email": email,
                "department": department,
                "startDate": start_date,
            },
        )
