from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


@dataclass
class CaseStore:
    cases: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    appnum_to_caseid: Dict[str, str] = field(default_factory=dict)

    # per-case subscribers (websocket queues)
    subscribers: Dict[str, List[asyncio.Queue]] = field(default_factory=dict)
    recent_events: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)

    def init_or_get_case(self, application_number: str, seed: Dict[str, Any] | None = None, case_id: str | None = None) -> Dict[str, Any]:
        if application_number in self.appnum_to_caseid:
            cid = self.appnum_to_caseid[application_number]
            existing = self.cases.get(cid)
            if existing is None:
                # stale mapping, fall through to create
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
                        # Only overwrite if we have a real name
                        existing["candidateName"] = seed["candidateName"]
                return existing

        cid = case_id or f"CASE-{uuid.uuid4().hex[:8].upper()}"
        case = {
            "caseId": cid,
            "applicationNumber": application_number,
            "candidateName": (seed or {}).get("candidateName") or "Candidate",
            "status": "DRAFT",  # DRAFT | NEGOTIATION_PENDING | ON_HOLD_HR | SUBMITTED | READY_DAY1
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
        return case

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
        return c

    def update_agent_output(self, case_id: str, agent_name: str, output: Dict[str, Any]) -> None:
        c = self.cases.get(case_id)
        if not c:
            return
        c["agentOutputs"][agent_name] = output
        c["updatedAt"] = _now_iso()

    def set_status(self, case_id: str, status: str) -> None:
        c = self.cases.get(case_id)
        if not c:
            return
        c["status"] = status
        c["updatedAt"] = _now_iso()
        self.emit(case_id, "system.status_changed", {"status": status})

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
        # cap buffer
        if len(self.recent_events[case_id]) > 200:
            self.recent_events[case_id] = self.recent_events[case_id][-200:]

        for q in self.subscribers.get(case_id, []):
            try:
                q.put_nowait(evt)
            except Exception:
                # don't let one bad subscriber kill demo
                pass

    def get_recent_events(self, case_id: str) -> List[Dict[str, Any]]:
        return self.recent_events.get(case_id, [])[-50:]


case_store = CaseStore()
