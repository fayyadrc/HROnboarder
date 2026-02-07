from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, Optional

from app.store.case_store import case_store

from app.agents.compliance_agent import ComplianceAgent
from app.agents.logistics_agent import LogisticsAgent
from app.agents.hris_agent import HRISAgent
from app.agents.it_agent import ITProvisioningAgent

from app.db.database import SessionLocal
from app.db.models import Case as DbCase


compliance_agent = ComplianceAgent()
logistics_agent = LogisticsAgent()
hris_agent = HRISAgent()
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

    # Demo conflict: Visa long but laptop arriving quickly -> “wasted” provisioning / timing mismatch
    if visa_weeks >= 8 and delivery_days <= 3:
        conflicts.append(
            {
                "type": "TIMELINE_MISMATCH",
                "severity": 6,
                "message": "Visa timeline is long but laptop is scheduled to arrive immediately. Risk: idle asset + wasted effort.",
                "suggestedResolution": "Delay IT provisioning until visa milestone OR issue temporary virtual desktop access.",
            }
        )

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
                    "message": f"Laptop delivery ({delivery_days} days) exceeds time until start date ({days_to_start} days).",
                    "suggestedResolution": "Expedite delivery, issue loaner device, or delay start date.",
                }
            )

    # IT SLA risks (from IT agent)
    sla_risks = ((it_out.get("data") or {}).get("slaRisks")) or []
    for r in sla_risks:
        conflicts.append(
            {
                "type": r.get("type") or "IT_SLA_RISK",
                "severity": int(r.get("severity") or 5),
                "message": r.get("message") or "IT SLA risk detected.",
                "suggestedResolution": r.get("mitigation") or "Review IT provisioning plan and mitigate.",
            }
        )

    return conflicts


def _persist_status(case_id: str, new_status: str) -> None:
    """
    Persist status to DB and keep case_store in sync.
    """
    db = SessionLocal()
    try:
        db_case = db.query(DbCase).filter(DbCase.id == case_id).first()
        if db_case:
            db_case.status = new_status
            db.commit()
    finally:
        db.close()

    case_store.set_status(case_id, new_status)


async def run_orchestrator_for_case(case_id: str, notes: str = "") -> Dict[str, Any]:
    """
    Orchestrator:
    - Compliance + Logistics run in parallel
    - HRIS runs next (DB-backed, idempotent)
    - IT runs last (needs employeeId; deterministic plan)
    - Conflicts detected and emitted
    - READY_FOR_DAY1 set when safe
    """
    case = case_store.get_case(case_id)
    if not case:
        return {"error": "Case not found"}

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

    # Sequential: HRIS (DB-backed) — skip if already present
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

        if any(a.get("type") == "HRIS_IDEMPOTENT_HIT" for a in (hris_res.actions or [])):
            case_store.emit(case_id, "agent.hris_idempotent_hit", {"employeeId": (hris_res.data or {}).get("employeeId")})

        case_store.emit(
            case_id,
            "agent.hris_done",
            {"summary": hris_res.summary, "employeeId": (hris_res.data or {}).get("employeeId")},
        )

    # Sequential: IT — skip if already present
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

        sla_risks = ((it_res.data or {}).get("slaRisks")) or []
        if sla_risks:
            case_store.emit(case_id, "agent.it_sla_risk", {"risks": sla_risks})

        case_store.emit(case_id, "agent.it_done", {"summary": it_res.summary, "risks": it_res.risks})

    # Conflicts (now includes IT SLA + start-date feasibility)
    case = case_store.get_case(case_id) or case
    conflicts = detect_conflicts(case, compliance_out, logistics_out, it_out)
    if conflicts:
        case_store.emit(case_id, "agent.orchestrator_conflict", {"conflicts": conflicts})

    overall = "ON_TRACK" if not conflicts else "AT_RISK"
    employee_id = (hris_out.get("data") or {}).get("employeeId")

    plan = {
        "caseId": case_id,
        "overallStatus": overall,
        "conflicts": conflicts,
        "nextActions": [
            {"owner": "Candidate", "action": "Upload required documents (passport, photo, address proof, any role-specific docs)."},
            {"owner": "HR", "action": "Review compliance and IT risks; confirm start date feasibility and resolve conflicts."},
            {"owner": "IT", "action": "Track tickets and provisioning SLAs; apply mitigation if risks flagged."},
            {"owner": "Facilities", "action": "Assign seating and building access (optional in Milestone 2)."},
        ],
        "agentSummaries": {
            "compliance": compliance_out["summary"],
            "logistics": logistics_out["summary"],
            "hris": hris_out["summary"],
            "it": it_out["summary"],
        },
        "day1Readiness": {
            "employeeId": employee_id,
            "itTickets": ((it_out.get("data") or {}).get("tickets")) or [],
            "deviceRequest": ((it_out.get("data") or {}).get("deviceRequest")) or {},
        },
    }

    case_store.update_agent_output(case_id, "orchestrator", {"plan": plan})
    case_store.emit(case_id, "agent.orchestrator_done", {"msg": "Orchestrator finished. Plan generated.", "plan": plan})

    # If everything is clean, mark READY_FOR_DAY1 (DB + case_store)
    current_status = (case_store.get_case(case_id) or {}).get("status")
    if (not conflicts) and current_status == "ONBOARDING_IN_PROGRESS":
        _persist_status(case_id, "READY_FOR_DAY1")
        case_store.emit(case_id, "agent.orchestrator_ready_for_day1", {"msg": "Case marked READY_FOR_DAY1"})

    return {"ok": True, "plan": plan, "agentOutputs": (case_store.get_case(case_id) or {}).get("agentOutputs", {})}
