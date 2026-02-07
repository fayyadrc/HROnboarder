from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.agents.base_agent import BaseAgent, AgentResult
from app.tools.it_tools import (
    access_groups_by_role,
    equipment_bundle_by_role,
    it_delivery_days_for_location,
    ticket_templates,
)


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


class ITProvisioningAgent(BaseAgent):
    name = "it"

    async def run(self, case: Dict[str, Any], notes: str = "") -> AgentResult:
        seed = case.get("seed", {}) or {}
        role = seed.get("role") or ""
        work_location = seed.get("workLocation") or ""
        start_date = seed.get("startDate")

        hris_out = ((case.get("agentOutputs") or {}).get("hris") or {}).get("data") or {}
        employee_id = hris_out.get("employeeId")

        risks: List[str] = []
        if not employee_id:
            risks.append("Missing employeeId (HRIS not completed). IT provisioning cannot proceed.")
            return AgentResult(
                agent=self.name,
                summary="IT provisioning blocked: HRIS employeeId missing.",
                risks=risks,
                actions=[{"type": "BLOCKED", "reason": "HRIS_NOT_READY"}],
                data={"blocked": True},
            )

        # Workplace decision (if present) overrides IT fallback bundle model
        workplace_equipment = (
            ((case.get("agentOutputs") or {}).get("workplace") or {}).get("data") or {}
        ).get("equipment") or {}
        workplace_model = workplace_equipment.get("deviceModel")

        it_bundle = equipment_bundle_by_role(role)  # fallback
        delivery = it_delivery_days_for_location(work_location)
        groups = access_groups_by_role(role)
        tickets = ticket_templates()

        device_model = workplace_model or it_bundle.get("model")
        accessories = workplace_equipment.get("accessories") or it_bundle.get("accessories") or []

        # SLA risk: device delivery after start date (or too close to start)
        days_to_start = _days_until(start_date)
        sla_risks = []
        if days_to_start is not None:
            if delivery > days_to_start:
                sla_risks.append(
                    {
                        "code": "DEVICE_AFTER_START",
                        "severity": 8,
                        "message": f"Device delivery ({delivery} days) is after start date (in {days_to_start} days).",
                        "mitigation": "Expedite shipment, issue loaner device, or adjust start date.",
                    }
                )
            elif delivery >= max(0, days_to_start - 1):
                sla_risks.append(
                    {
                        "code": "DEVICE_TIGHT_SLA",
                        "severity": 5,
                        "message": f"Device delivery SLA is tight: {delivery} days, start date in {days_to_start} days.",
                        "mitigation": "Confirm stock and shipment; prepare fallback device.",
                    }
                )

        if sla_risks:
            risks.append("IT SLA risk detected for device provisioning.")

        actions = [
            {"type": "CREATE_TICKETS", "count": len(tickets)},
            {"type": "ASSIGN_ACCESS_GROUPS", "groups": groups},
            {"type": "REQUEST_DEVICE", "model": device_model, "deliveryDays": delivery},
        ]
        if workplace_model:
            actions.append({"type": "DEVICE_SOURCE_OF_TRUTH", "source": "WORKPLACE", "model": workplace_model})
        if sla_risks:
            actions.append({"type": "SLA_RISKS", "risks": sla_risks})

        summary = (
            f"IT provisioning planned for {employee_id}. "
            f"Device: {device_model} (delivery {delivery} days). "
            f"Tickets: {len(tickets)}. Groups: {len(groups)}."
        )

        return AgentResult(
            agent=self.name,
            summary=summary,
            risks=risks,
            actions=actions,
            data={
                "employeeId": employee_id,
                "deviceRequest": {"model": device_model, "accessories": accessories, "deliveryDays": delivery},
                "tickets": tickets,
                "accessGroups": groups,
                "slaRisks": sla_risks,
            },
        )
