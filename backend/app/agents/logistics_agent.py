from __future__ import annotations

from app.agents.base_agent import BaseAgent, AgentResult
from app.tools.logistics_tools import delivery_days, facilities_seating_eta_days, laptop_stock


class LogisticsAgent(BaseAgent):
    name = "logistics"

    async def run(self, case: dict, notes: str = "") -> AgentResult:
        seed = case.get("seed", {}) or {}
        role = seed.get("role") or ""
        work_location = seed.get("workLocation") or ""

        # Source of truth: Workplace deviceModel (if present)
        workplace_equipment = (
            ((case.get("agentOutputs") or {}).get("workplace") or {}).get("data") or {}
        ).get("equipment") or {}
        preferred_model = workplace_equipment.get("deviceModel")

        delivery = delivery_days(work_location)
        seating = facilities_seating_eta_days(work_location)

        # Use existing stock tool as a baseline signal,
        # but override the model if Workplace already decided it.
        stock = laptop_stock(role)
        if preferred_model:
            stock = dict(stock or {})
            stock["model"] = preferred_model

            # Demo-safe, deterministic status rule:
            # treat XPS as low stock, others in stock (avoids mismatch confusion)
            m = (preferred_model or "").lower()
            stock["status"] = "LOW_STOCK" if "xps" in m else "IN_STOCK"

        risks = []
        if (stock.get("status") or "") == "LOW_STOCK":
            risks.append("Selected device model is low stock; risk of delay or substitution.")

        actions = [
            {"type": "DEVICE_SUPPLY_CHECK", "laptop": stock, "deliveryDays": delivery},
            {"type": "FACILITIES_SEATING", "etaDays": seating},
        ]

        summary = (
            f"Logistics validated. Device: {stock.get('model')} ({stock.get('status')}), "
            f"delivery {delivery} days; seating ETA {seating} days."
        )

        return AgentResult(
            agent=self.name,
            summary=summary,
            risks=risks,
            actions=actions,
            data={"laptop": stock, "deliveryDays": delivery, "seatingEtaDays": seating},
        )
