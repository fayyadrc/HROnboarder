from __future__ import annotations

import asyncio
from typing import Any, Dict

from app.store.case_store import case_store
from app.agents.compliance_agent import ComplianceAgent
from app.agents.logistics_agent import LogisticsAgent


compliance_agent = ComplianceAgent()
logistics_agent = LogisticsAgent()


def detect_conflicts(compliance_out: Dict[str, Any], logistics_out: Dict[str, Any]) -> list[dict]:
    conflicts = []

    visa_weeks = ((compliance_out.get("data") or {}).get("visaTimelineWeeks")) or 0
    delivery_days = ((logistics_out.get("data") or {}).get("deliveryDays")) or 0

    # Demo conflict: Visa long but laptop arriving quickly -> “wasted” provisioning / timing mismatch
    if visa_weeks >= 8 and delivery_days <= 3:
        conflicts.append({
            "type": "TIMELINE_MISMATCH",
            "message": "Visa timeline is long but laptop is scheduled to arrive immediately. Risk: idle asset + wasted effort.",
            "suggestedResolution": "Delay IT provisioning until visa milestone OR issue temporary virtual desktop access.",
        })

    return conflicts


async def run_orchestrator_for_case(case_id: str, notes: str = "") -> Dict[str, Any]:
    case = case_store.get_case(case_id)
    if not case:
        return {"error": "Case not found"}

    case_store.emit(case_id, "agent.orchestrator_start", {"msg": "Orchestrator starting agents in parallel..."})

    # Run in parallel
    case_store.emit(case_id, "agent.compliance_start", {"msg": "Compliance agent running..."})
    case_store.emit(case_id, "agent.logistics_start", {"msg": "Logistics agent running..."})

    compliance_task = compliance_agent.run(case, notes=notes)
    logistics_task = logistics_agent.run(case, notes=notes)
    compliance_res, logistics_res = await asyncio.gather(compliance_task, logistics_task)

    # Store outputs
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

    # Orchestrator conflict detection
    conflicts = detect_conflicts(compliance_out, logistics_out)
    if conflicts:
        case_store.emit(case_id, "agent.orchestrator_conflict", {"conflicts": conflicts})

    # Final plan (simple deterministic plan)
    plan = {
        "caseId": case_id,
        "overallStatus": "ON_TRACK" if not conflicts else "AT_RISK",
        "conflicts": conflicts,
        "nextActions": [
            {"owner": "Candidate", "action": "Upload required documents (passport, photo, address proof, any role-specific docs)."},
            {"owner": "HR", "action": "Review compliance risks and confirm start date feasibility."},
            {"owner": "IT", "action": "Proceed with provisioning OR delay based on conflict resolution."},
            {"owner": "Facilities", "action": "Assign seating and building access."},
        ],
        "agentSummaries": {
            "compliance": compliance_out["summary"],
            "logistics": logistics_out["summary"],
        },
    }

    case_store.update_agent_output(case_id, "orchestrator", {"plan": plan})
    case_store.emit(case_id, "agent.orchestrator_done", {"msg": "Orchestrator finished. Plan generated.", "plan": plan})

    return {"ok": True, "plan": plan, "agentOutputs": case_store.get_case(case_id).get("agentOutputs", {})}
