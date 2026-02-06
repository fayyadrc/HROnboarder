from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class AgentResult:
    agent: str
    summary: str
    risks: List[str]
    actions: List[Dict[str, Any]]
    data: Dict[str, Any]


class BaseAgent:
    name: str = "base"

    async def run(self, case: Dict[str, Any], notes: str = "") -> AgentResult:
        raise NotImplementedError("Agent must implement run()")
