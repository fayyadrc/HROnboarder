from __future__ import annotations

from app.agents.base_agent import BaseAgent, AgentResult
from app.tools.logistics_tools import laptop_stock, delivery_days, facilities_seating_eta_days


class LogisticsAgent(BaseAgent):
    name = "logistics"

    async def run(self, case: dict, notes: str = "") -> AgentResult:
        seed = case.get("seed", {}) or {}
        role = seed.get("role") or ""
        work_location = seed.get("workLocation") or ""

        stock = laptop_stock(role)
        delivery = delivery_days(work_location)
        seating = facilities_seating_eta_days(work_location)

        risks = []
        if stock["status"] == "LOW_STOCK":
            risks.append("Preferred laptop model is low stock; risk of delay or substitution.")

        actions = [
            {"type": "IT_PROVISION", "laptop": stock, "deliveryDays": delivery},
            {"type": "FACILITIES_SEATING", "etaDays": seating},
        ]

        summary = f"Logistics planned. Laptop: {stock['model']} ({stock['status']}), delivery {delivery} days; seating ETA {seating} days."

        return AgentResult(
            agent=self.name,
            summary=summary,
            risks=risks,
            actions=actions,
            data={"laptop": stock, "deliveryDays": delivery, "seatingEtaDays": seating},
        )
