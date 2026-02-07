from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.db.database import SessionLocal
from app.db.models import CaseState


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def _deepcopy_jsonable(obj: Any) -> Any:
    # Avoid pulling in heavy deps; case JSON is already dict/list/str.
    if isinstance(obj, dict):
        return {k: _deepcopy_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deepcopy_jsonable(v) for v in obj]
    return obj


@dataclass
class CaseStore:
    cases: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    appnum_to_caseid: Dict[str, str] = field(default_factory=dict)

    # per-case subscribers (websocket queues)
    subscribers: Dict[str, List[asyncio.Queue]] = field(default_factory=dict)
    recent_events: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)

    # ---------- persistence ----------
    def persist_case(self, case_id: str) -> None:
        """
        Persist current in-memory case JSON to DB for resume-safe operation.
        Safe to call often; write happens only on step/status/agent updates.
        """
        c = self.cases.get(case_id)
        if not c:
            return

        payload = _deepcopy_jsonable(c)
        db = SessionLocal()
        try:
            existing = db.query(CaseState).filter(CaseState.case_id == case_id).first()
            if existing:
                existing.state = payload
            else:
                db.add(CaseState(case_id=case_id, state=payload))
            db.commit()
        finally:
            db.close()

    def load_persisted_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        db = SessionLocal()
        try:
            row = db.query(CaseState).filter(CaseState.case_id == case_id).first()
            if not row or not row.state:
                return None
            return row.state
        finally:
            db.close()

    # ---------- core ----------
    def init_or_get_case(
        self,
        application_number: str,
        seed: Dict[str, Any] | None = None,
        case_id: str | None = None,
    ) -> Dict[str, Any]:
        if application_number in self.appnum_to_caseid:
            cid = self.appnum_to_caseid[application_number]
            existing = self.cases.get(cid)
            if existing is None:
                del self.appnum_to_caseid[application_number]
            else:
                if case_id and case_id != cid:
                    # migrate to stable case_id
                    if case_id in self.cases and self.cases[case_id] is not existing:
                        existing = self.cases[case_id]
                    else:
                        self.cases[case_id] = existing
                        del self.cases[cid]
                    self.appnum_to_caseid[application_number] = case_id
                    existing["caseId"] = case_id
                    if cid in self.subscribers:
                        self.subscribers[case_id] = self.subscribers.pop(cid)
                    if cid in self.recent_events:
                        self.recent_events[case_id] = self.recent_events.pop(cid)

                if seed:
                    existing["seed"] = seed
                    if seed.get("candidateName"):
                        existing["candidateName"] = seed["candidateName"]

                existing["updatedAt"] = _now_iso()
                self.persist_case(existing["caseId"])
                return existing

        cid = case_id or f"CASE-{uuid.uuid4().hex[:8].upper()}"
        case = {
            "caseId": cid,
            "applicationNumber": application_number,
            "candidateName": (seed or {}).get("candidateName") or "Candidate",
            "status": "DRAFT",  # DRAFT | NEGOTIATION_PENDING | ON_HOLD_HR | ONBOARDING_IN_PROGRESS | READY_FOR_DAY1
            "riskStatus": "GREEN",  # GREEN | AT_RISK
            "currentStepIndex": 0,
            "completedSteps": [],
            "steps": {},
            "seed": seed or {},
            "agentOutputs": {},
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        self.cases[cid] = case
        self.appnum_to_caseid[application_number] = cid
        self.subscribers[cid] = []
        self.recent_events[cid] = []
        self.emit(cid, "system.case_created", {"caseId": cid, "applicationNumber": application_number})
        self.persist_case(cid)
        return case

    def set_case_direct(self, case_id: str, case_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Load a persisted case directly into memory.
        """
        case_payload = case_payload or {}
        case_payload["caseId"] = case_id
        case_payload.setdefault("updatedAt", _now_iso())
        self.cases[case_id] = case_payload

        appnum = case_payload.get("applicationNumber")
        if appnum:
            self.appnum_to_caseid[appnum] = case_id

        self.subscribers.setdefault(case_id, [])
        self.recent_events.setdefault(case_id, [])
        return case_payload

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        return self.cases.get(case_id)

    def save_step(self, case_id: str, step_key: str, payload: Dict[str, Any], next_step_index: int | None) -> Optional[Dict[str, Any]]:
        c = self.cases.get(case_id)
        if not c:
            return None

        c["steps"][step_key] = payload
        if step_key not in c["completedSteps"]:
            c["completedSteps"].append(step_key)
        if isinstance(next_step_index, int):
            c["currentStepIndex"] = next_step_index

        c["updatedAt"] = _now_iso()
        self.emit(case_id, "ui.step_saved", {"stepKey": step_key})
        self.persist_case(case_id)
        return c

    def update_agent_output(self, case_id: str, agent_name: str, output: Dict[str, Any]) -> None:
        c = self.cases.get(case_id)
        if not c:
            return
        c["agentOutputs"][agent_name] = output
        c["updatedAt"] = _now_iso()
        self.persist_case(case_id)

    def set_status(self, case_id: str, status: str) -> None:
        c = self.cases.get(case_id)
        if not c:
            return
        c["status"] = status
        c["updatedAt"] = _now_iso()
        self.emit(case_id, "system.status_changed", {"status": status})
        self.persist_case(case_id)

    def set_risk_status(self, case_id: str, risk_status: str) -> None:
        c = self.cases.get(case_id)
        if not c:
            return
        c["riskStatus"] = risk_status
        c["updatedAt"] = _now_iso()
        self.emit(case_id, "system.risk_changed", {"riskStatus": risk_status})
        self.persist_case(case_id)

    def delete_case(self, case_id: str) -> bool:
        c = self.cases.get(case_id)
        if not c:
            return False

        app_num = c.get("applicationNumber")

        if case_id in self.cases:
            del self.cases[case_id]
        if app_num and app_num in self.appnum_to_caseid:
            del self.appnum_to_caseid[app_num]
        if case_id in self.subscribers:
            del self.subscribers[case_id]
        if case_id in self.recent_events:
            del self.recent_events[case_id]

        # Also remove persisted state if present
        db = SessionLocal()
        try:
            db.query(CaseState).filter(CaseState.case_id == case_id).delete()
            db.commit()
        finally:
            db.close()

        return True

    # ---------- events / websockets ----------
    def subscribe(self, case_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.subscribers.setdefault(case_id, []).append(q)
        return q

    def unsubscribe(self, case_id: str, q: asyncio.Queue) -> None:
        subs = self.subscribers.get(case_id, [])
        if q in subs:
            subs.remove(q)

    def emit(self, case_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        evt = {
            "ts": _now_iso(),
            "type": event_type,
            "payload": payload,
        }
        self.recent_events.setdefault(case_id, []).append(evt)
        if len(self.recent_events[case_id]) > 200:
            self.recent_events[case_id] = self.recent_events[case_id][-200:]

        for q in self.subscribers.get(case_id, []):
            try:
                q.put_nowait(evt)
            except Exception:
                pass

    def get_recent_events(self, case_id: str) -> List[Dict[str, Any]]:
        return self.recent_events.get(case_id, [])[-50:]


case_store = CaseStore()
