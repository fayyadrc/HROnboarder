from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field 


class RiskFlag(BaseModel):
    code: str
    severity: int = Field(ge=1, le=10)
    message: str
    mitigation: Optional[str] = None


class AgentResultBase(BaseModel):
    agent: str
    ok: bool = True
    risks: List[RiskFlag] = Field(default_factory=list)
    output: Dict[str, Any] = Field(default_factory=dict)


class HRISInput(BaseModel):
    case_id: str
    full_name: str
    email: str
    department: str
    start_date: Optional[str] = None


class HRISOutput(BaseModel):
    employee_id: str
    created_at: str
    idempotency_key: str


class ITInput(BaseModel):
    employee_id: str
    role: str
    location: str
    start_date: Optional[str] = None


class ITTicket(BaseModel):
    key: str
    title: str
    owner: str
    sla_days: int


class DeviceRequest(BaseModel):
    model: str
    accessories: List[str] = Field(default_factory=list)
    delivery_days: int = 0


class ITOutput(BaseModel):
    tickets: List[ITTicket] = Field(default_factory=list)
    access_groups: List[str] = Field(default_factory=list)
    device_request: DeviceRequest
    sla_risks: List[RiskFlag] = Field(default_factory=list)


class OrchestratorPlan(BaseModel):
    caseId: str
    overallStatus: str
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    nextActions: List[Dict[str, Any]] = Field(default_factory=list)
    agentSummaries: Dict[str, str] = Field(default_factory=dict)
    day1Readiness: Dict[str, Any] = Field(default_factory=dict)


def iso_now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
