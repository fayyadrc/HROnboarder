from __future__ import annotations

from app.agents.base_agent import BaseAgent, AgentResult
from app.tools.compliance_tools import required_docs, compliance_risk_flags, estimate_visa_timeline_weeks


class ComplianceAgent(BaseAgent):
    name = "compliance"

    async def run(self, case: dict, notes: str = "") -> AgentResult:
        seed = case.get("seed", {}) or {}
        role = seed.get("role") or ""
        work_location = seed.get("workLocation") or ""
        nationality = seed.get("nationality") or ""
        start_date = seed.get("startDate")

        docs = required_docs(nationality, work_location, role)
        risks, summary2 = compliance_risk_flags(nationality, work_location, role, start_date)
        weeks = estimate_visa_timeline_weeks(nationality, work_location)

        summary = f"Compliance complete. {summary2}"

        actions = [
            {"type": "REQUEST_DOCS", "docs": docs},
            {"type": "VISA_TIMELINE", "weeks": weeks},
        ]

        return AgentResult(
            agent=self.name,
            summary=summary,
            risks=risks,
            actions=actions,
            data={"requiredDocs": docs, "visaTimelineWeeks": weeks},
        )
