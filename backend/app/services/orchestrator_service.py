from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, Optional

from app.agents.compliance_agent import ComplianceAgent
from app.agents.hris_agent import HRISAgent
from app.agents.it_agent import ITProvisioningAgent
from app.agents.logistics_agent import LogisticsAgent
from app.agents.workplace_agent import WorkplaceServicesAgent
from app.db.database import SessionLocal
from app.db.models import Case as DbCase
from app.store.case_store import case_store

compliance_agent = ComplianceAgent()
logistics_agent = LogisticsAgent()
hris_agent = HRISAgent()
workplace_agent = WorkplaceServicesAgent()
it_agent = ITProvisioningAgent()


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(date_str, fmt)
        except Exception:
            continue
    return None


def _days_until(start_date_str: Optional[str]) -> Optional[int]:
    dt = _parse_date(start_date_str)
    if not dt:
        return None
    delta = dt.date() - datetime.utcnow().date()
    return delta.days


def _has_hris(case: Dict[str, Any]) -> bool:
    h = ((case.get("agentOutputs") or {}).get("hris") or {}).get("data") or {}
    return bool(h.get("employeeId"))


def _has_workplace(case: Dict[str, Any]) -> bool:
    w = ((case.get("agentOutputs") or {}).get("workplace") or {}).get("data") or {}
    seating = w.get("seating") or {}
    equipment = w.get("equipment") or {}
    return bool(seating.get("seatId")) and bool(equipment.get("bundleName"))


def _has_it(case: Dict[str, Any]) -> bool:
    it = ((case.get("agentOutputs") or {}).get("it") or {}).get("data") or {}
    tickets = it.get("tickets") or []
    device = it.get("deviceRequest") or {}
    return bool(tickets) and bool(device)


def detect_conflicts(
    case: Dict[str, Any],
    compliance_out: Dict[str, Any],
    logistics_out: Dict[str, Any],
    it_out: Dict[str, Any],
) -> list[dict]:
    conflicts: list[dict] = []

    seed = case.get("seed", {}) or {}
    start_date = seed.get("startDate")
    days_to_start = _days_until(start_date)

    visa_weeks = ((compliance_out.get("data") or {}).get("visaTimelineWeeks")) or 0
    delivery_days = ((logistics_out.get("data") or {}).get("deliveryDays")) or 0

    # Start-date feasibility risk (visa)
    if days_to_start is not None:
        visa_days = int(visa_weeks) * 7
        if visa_days > days_to_start:
            conflicts.append(
                {
                    "type": "VISA_BEFORE_START_RISK",
                    "severity": 9,
                    "message": f"Visa timeline ({visa_weeks} weeks) exceeds time until start date ({days_to_start} days).",
                    "suggestedResolution": "Adjust start date, expedite visa, or convert to remote start (policy permitting).",
                }
            )

        if int(delivery_days) > days_to_start:
            conflicts.append(
                {
                    "type": "DEVICE_AFTER_START_RISK",
                    "severity": 8,
                    "message": f"Device delivery ({delivery_days} days) exceeds time until start date ({days_to_start} days).",
                    "suggestedResolution": "Expedite delivery, issue loaner device, or delay start date.",
                }
            )

    # IT SLA risks (from IT agent)
    sla_risks = ((it_out.get("data") or {}).get("slaRisks")) or []
    for r in sla_risks:
        conflicts.append(
            {
                "type": r.get("code") or "IT_SLA_RISK",
                "severity": int(r.get("severity") or 5),
                "message": r.get("message") or "IT SLA risk detected.",
                "suggestedResolution": r.get("mitigation") or "Review IT provisioning plan and mitigate.",
            }
        )

    return conflicts


def _persist_status(case_id: str, new_status: str) -> None:
    db = SessionLocal()
    try:
        db_case = db.query(DbCase).filter(DbCase.id == case_id).first()
        if db_case:
            db_case.status = new_status
            db.commit()
    finally:
        db.close()

    case_store.set_status(case_id, new_status)


def _decision_for_conflicts(case: Dict[str, Any], conflicts: list[dict], compliance_out: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert conflicts into decision-ready output for judges.
    """
    seed = case.get("seed", {}) or {}
    start_date = seed.get("startDate")
    days_to_start = _days_until(start_date)

    visa_weeks = int(((compliance_out.get("data") or {}).get("visaTimelineWeeks")) or 0)
    visa_days = visa_weeks * 7

    if not conflicts:
        return {
            "primaryRecommendation": "PROCEED",
            "options": [],
            "impact": "Day-1 readiness is achievable with current plan.",
            "rationale": "No blocking conflicts detected across compliance, workplace, logistics, and IT.",
        }

    # Default options (demo-safe, actionable)
    options = ["DELAY_START_DATE", "EXPEDITE_VISA", "REMOTE_START_TEMP"]

    # Pick a primary based on the most severe conflict type
    primary = "REVIEW_REQUIRED"
    impact = "Day-1 cannot be met unless action is taken."
    rationale = "One or more risks exceed the start-date window."

    types = {c.get("type") for c in conflicts}

    if "VISA_BEFORE_START_RISK" in types:
        if days_to_start is not None and visa_days > days_to_start:
            primary = "EXPEDITE_VISA"
            impact = f"Day-1 is at risk: visa estimate {visa_weeks} weeks exceeds time to start ({days_to_start} days)."
            rationale = "Visa timeline is the critical path. Expedite or adjust start mode/date."

            # If the gap is very large, remote start becomes the most realistic “wow” option
            if (visa_days - days_to_start) >= 7:
                primary = "REMOTE_START_TEMP"
                rationale = "Remote start is the fastest path to productivity while visa is processed."

    elif "DEVICE_AFTER_START_RISK" in types:
        primary = "ISSUE_LOANER_DEVICE"
        options = ["EXPEDITE_DEVICE", "ISSUE_LOANER_DEVICE", "DELAY_START_DATE"]
        impact = "Day-1 is at risk due to device delivery after start date."
        rationale = "Device availability is required for day-1 productivity."

    return {
        "primaryRecommendation": primary,
        "options": options,
        "impact": impact,
        "rationale": rationale,
    }


async def run_orchestrator_for_case(case_id: str, notes: str = "") -> Dict[str, Any]:
    """
    Orchestrator (Milestone 2 + 3.1):
    - Compliance + Logistics in parallel
    - HRIS (DB-backed, idempotent)
    - Workplace Services (equipment + seating) with DB idempotency
    - IT provisioning last (needs employeeId)
    - Detect conflicts
    - Always sets case status to READY_FOR_DAY1 or AT_RISK after run (demo clarity)
    """
    case = case_store.get_case(case_id)
    if not case:
        return {"error": "Case not found"}

    # For demo clarity: once orchestrator runs, we are in-progress (even if candidate never submitted)
    _persist_status(case_id, "ONBOARDING_IN_PROGRESS")

    case_store.emit(case_id, "agent.orchestrator_start", {"msg": "Orchestrator starting agents..."})

    # Parallel: Compliance + Logistics
    case_store.emit(case_id, "agent.compliance_start", {"msg": "Compliance agent running..."})
    case_store.emit(case_id, "agent.logistics_start", {"msg": "Logistics agent running..."})

    compliance_task = compliance_agent.run(case, notes=notes)
    logistics_task = logistics_agent.run(case, notes=notes)
    compliance_res, logistics_res = await asyncio.gather(compliance_task, logistics_task)

    compliance_out = {
        "summary": compliance_res.summary,
        "risks": compliance_res.risks,
        "actions": compliance_res.actions,
        "data": compliance_res.data,
    }
    logistics_out = {
        "summary": logistics_res.summary,
        "risks": logistics_res.risks,
        "actions": logistics_res.actions,
        "data": logistics_res.data,
    }

    case_store.update_agent_output(case_id, "compliance", compliance_out)
    case_store.update_agent_output(case_id, "logistics", logistics_out)

    case_store.emit(case_id, "agent.compliance_done", {"summary": compliance_res.summary, "risks": compliance_res.risks})
    case_store.emit(case_id, "agent.logistics_done", {"summary": logistics_res.summary, "risks": logistics_res.risks})

    # HRIS — skip if present
    case = case_store.get_case(case_id) or case
    if _has_hris(case):
        case_store.emit(case_id, "agent.hris_skipped", {"msg": "HRIS already present; skipping."})
        hris_out = (case.get("agentOutputs") or {}).get("hris") or {}
    else:
        case_store.emit(case_id, "agent.hris_start", {"msg": "HRIS agent running..."})
        db = SessionLocal()
        try:
            hris_res = await hris_agent.run(case, notes=notes, db=db)
        finally:
            db.close()

        hris_out = {
            "summary": hris_res.summary,
            "risks": hris_res.risks,
            "actions": hris_res.actions,
            "data": hris_res.data,
        }
        case_store.update_agent_output(case_id, "hris", hris_out)
        case_store.emit(case_id, "agent.hris_done", {"summary": hris_res.summary, "employeeId": (hris_res.data or {}).get("employeeId")})

    # Workplace — skip if present
    case = case_store.get_case(case_id) or case
    if _has_workplace(case):
        case_store.emit(case_id, "agent.workplace_skipped", {"msg": "Workplace already present; skipping."})
        workplace_out = (case.get("agentOutputs") or {}).get("workplace") or {}
    else:
        case_store.emit(case_id, "agent.workplace_start", {"msg": "Workplace Services agent running..."})
        w_res = await workplace_agent.run(case, notes=notes)
        workplace_out = {
            "summary": w_res.summary,
            "risks": w_res.risks,
            "actions": w_res.actions,
            "data": w_res.data,
        }
        case_store.update_agent_output(case_id, "workplace", workplace_out)
        case_store.emit(case_id, "agent.workplace_done", {"summary": w_res.summary, "risks": w_res.risks})

    # IT — skip if present
    case = case_store.get_case(case_id) or case
    if _has_it(case):
        case_store.emit(case_id, "agent.it_skipped", {"msg": "IT output already present; skipping."})
        it_out = (case.get("agentOutputs") or {}).get("it") or {}
    else:
        case_store.emit(case_id, "agent.it_start", {"msg": "IT provisioning agent running..."})
        it_res = await it_agent.run(case, notes=notes)

        it_out = {
            "summary": it_res.summary,
            "risks": it_res.risks,
            "actions": it_res.actions,
            "data": it_res.data,
        }
        case_store.update_agent_output(case_id, "it", it_out)
        case_store.emit(case_id, "agent.it_done", {"summary": it_res.summary, "risks": it_res.risks})

    # Conflicts + decision
    case = case_store.get_case(case_id) or case
    conflicts = detect_conflicts(case, compliance_out, logistics_out, it_out)
    if conflicts:
        case_store.emit(case_id, "agent.orchestrator_conflict", {"conflicts": conflicts})

    decision = _decision_for_conflicts(case, conflicts, compliance_out)

    overall = "ON_TRACK" if not conflicts else "AT_RISK"
    employee_id = ((hris_out.get("data") or {}) if isinstance(hris_out, dict) else {}).get("employeeId")

    plan = {
        "caseId": case_id,
        "overallStatus": overall,
        "conflicts": conflicts,
        "decision": decision,
        "nextActions": [
            {"owner": "Candidate", "action": "Upload required documents (passport, photo, address proof, any role-specific docs)."},
            {"owner": "HR", "action": "Review decision recommendation; choose expedite/delay/remote start and confirm policy."},
            {"owner": "Workplace", "action": "Confirm seating and equipment bundle; adjust for role/work-mode changes."},
            {"owner": "IT", "action": "Track tickets and provisioning SLAs; apply mitigation if risks flagged."},
        ],
        "agentSummaries": {
            "compliance": compliance_out.get("summary"),
            "logistics": logistics_out.get("summary"),
            "hris": hris_out.get("summary") if isinstance(hris_out, dict) else None,
            "workplace": workplace_out.get("summary") if isinstance(workplace_out, dict) else None,
            "it": it_out.get("summary") if isinstance(it_out, dict) else None,
        },
        "day1Readiness": {
            "employeeId": employee_id,
            "itTickets": ((it_out.get("data") or {}).get("tickets")) if isinstance(it_out, dict) else [],
            "deviceRequest": ((it_out.get("data") or {}).get("deviceRequest")) if isinstance(it_out, dict) else {},
            "seating": ((workplace_out.get("data") or {}).get("seating")) if isinstance(workplace_out, dict) else {},
            "workplaceEquipment": ((workplace_out.get("data") or {}).get("equipment")) if isinstance(workplace_out, dict) else {},
        },
    }

    case_store.update_agent_output(case_id, "orchestrator", {"plan": plan})
    case_store.emit(case_id, "agent.orchestrator_done", {"msg": "Orchestrator finished. Plan generated.", "plan": plan})

    # Risk status reflects outcome; lifecycle status stays onboarding-in-progress after run
    if conflicts:
        case_store.set_risk_status(case_id, "AT_RISK")
    else:
        case_store.set_risk_status(case_id, "GREEN")

    return {
        "ok": True,
        "plan": plan,
        "agentOutputs": (case_store.get_case(case_id) or {}).get("agentOutputs", {}),
    }
