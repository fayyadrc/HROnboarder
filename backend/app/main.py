from __future__ import annotations

import os


def _try_load_dotenv() -> None:
    """
    Load backend/.env (preferred) or cwd/.env early, BEFORE importing anything
    that reads environment variables at import-time.
    """
    try:
        from dotenv import load_dotenv  # type: ignore
    except Exception:
        return

    here = os.path.dirname(os.path.abspath(__file__))  # backend/app
    backend_dir = os.path.abspath(os.path.join(here, ".."))  # backend/

    candidates = [
        os.path.join(backend_dir, ".env"),  # backend/.env (your case)
        os.path.join(os.getcwd(), ".env"),  # fallback
    ]

    for p in candidates:
        if os.path.exists(p):
            load_dotenv(p, override=False)
            break


_try_load_dotenv()

from typing import Any, Dict

from fastapi import BackgroundTasks, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from app.agents.hris_agent import HRISAgent
from app.agents.it_agent import ITProvisioningAgent
from app.agents.workplace_agent import WorkplaceServicesAgent
from app.db.database import SessionLocal, engine
from app.db.models import ApplicationCode, Base, Case, HRUser
from app.llm.routes import router as llm_router
from app.routes.email import router as email_router, send_welcome_email_for_case
from app.routes.hr import router as hr_router
from app.routes.stock import router as stock_router
from app.services.case_bridge import ensure_case_seeded
from app.services.orchestrator_service import run_orchestrator_for_case
from app.store.case_store import case_store

app = FastAPI(title="HR Automator Backend", version="0.1.0")

hris_agent = HRISAgent()
it_agent = ITProvisioningAgent()
workplace_agent = WorkplaceServicesAgent()


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)

    # Only one active application code per case
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_application_codes_case_active "
                    "ON application_codes(case_id) WHERE active=1"
                )
            )
            conn.commit()
    except Exception:
        pass

    # One employee record per case (idempotency)
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_records_case ON employee_records(case_id)"))
            conn.commit()
    except Exception:
        pass

    # Workplace assignment idempotency (one per case)
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_workplace_assignments_case ON workplace_assignments(case_id)"))
            conn.commit()
    except Exception:
        pass

    # Default HR user (hackathon-only)
    db = SessionLocal()
    try:
        existing = db.query(HRUser).filter(HRUser.username == "hr").first()
        if not existing:
            db.add(HRUser(username="hr", password="admin"))
            db.commit()
    finally:
        db.close()


# HR routes
app.include_router(hr_router)
app.include_router(email_router)
app.include_router(stock_router)
app.include_router(llm_router)


# Dev-friendly CORS (hackathon). Tighten later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.post("/api/case/init")
def init_case(payload: dict) -> Dict[str, Any]:
    """
    Candidate entry-point:
    - Validate applicationCode in DB
    - Seed case_store using DB Case.id so frontend and backend agree
    """
    application_code = payload.get("applicationCode")
    if not application_code:
        raise HTTPException(status_code=400, detail="applicationCode required")

    db = SessionLocal()
    try:
        code = (
            db.query(ApplicationCode)
            .filter(ApplicationCode.code == application_code, ApplicationCode.active == True)  # noqa: E712
            .first()
        )
        if not code:
            raise HTTPException(status_code=404, detail="Invalid application code")

        case = db.query(Case).filter(Case.id == code.case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        seeded_case = case_store.init_or_get_case(
            application_number=application_code,
            seed={
                "candidateName": case.candidate_name,
                "role": case.role,
                "workLocation": case.work_location,
                "nationality": case.nationality,
                "startDate": case.start_date,
                "compensation": {"salary": case.salary},
                "benefitsContext": case.benefits or {},
                "priorNotes": case.prior_notes or "",
            },
            case_id=case.id,
        )

        if case.status:
            case_store.set_status(case.id, case.status)

        return seeded_case
    finally:
        db.close()


@app.get("/api/case/{case_id}")
def get_case(case_id: str) -> Dict[str, Any]:
    ensure_case_seeded(case_id)
    c = case_store.get_case(case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return c


class SaveStepRequest(BaseModel):
    payload: dict
    nextStepIndex: int | None = None


@app.post("/api/case/{case_id}/step/{step_key}")
def save_step(case_id: str, step_key: str, req: SaveStepRequest) -> Dict[str, Any]:
    ensure_case_seeded(case_id)
    c = case_store.save_step(case_id, step_key, req.payload, req.nextStepIndex)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return c


class RunAgentsRequest(BaseModel):
    notes: str | None = None


class SetStatusRequest(BaseModel):
    status: str


class SubmitRequest(BaseModel):
    notes: str | None = None


@app.post("/api/onboard/run/{case_id}")
async def run_agents(case_id: str, req: RunAgentsRequest) -> Dict[str, Any]:
    ensure_case_seeded(case_id)
    result = await run_orchestrator_for_case(case_id, notes=req.notes or "")
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=404, detail=str(result["error"]))
    return result


@app.post("/api/case/{case_id}/status")
def set_case_status(case_id: str, req: SetStatusRequest) -> Dict[str, Any]:
    ensure_case_seeded(case_id)

    db = SessionLocal()
    try:
        db_case = db.query(Case).filter(Case.id == case_id).first()
        if not db_case:
            raise HTTPException(status_code=404, detail="Case not found")
        db_case.status = req.status
        db.commit()
    finally:
        db.close()

    case_store.set_status(case_id, req.status)
    payload = case_store.get_case(case_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Case not found")
    return payload


@app.post("/api/case/{case_id}/submit")
async def submit_case(case_id: str, req: SubmitRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    ensure_case_seeded(case_id)

    db = SessionLocal()
    try:
        db_case = db.query(Case).filter(Case.id == case_id).first()
        if not db_case:
            raise HTTPException(status_code=404, detail="Case not found")
        db_case.status = "ONBOARDING_IN_PROGRESS"
        db.commit()
    finally:
        db.close()

    case_store.set_status(case_id, "ONBOARDING_IN_PROGRESS")
    case_store.emit(case_id, "case.submitted", {"status": "ONBOARDING_IN_PROGRESS"})
    orchestrator_result = await run_orchestrator_for_case(case_id, notes=req.notes or "")
    if isinstance(orchestrator_result, dict) and orchestrator_result.get("error"):
        raise HTTPException(status_code=500, detail=str(orchestrator_result["error"]))

    if orchestrator_result.get("ok"):
        try:
            background_tasks.add_task(send_welcome_email_for_case, case_id, None, None)
            case_store.emit(case_id, "email.queued", {"type": "WELCOME", "case_id": case_id})
            orchestrator_result["message"] = "Welcome email will be sent shortly."
        except Exception as e:
            case_store.emit(case_id, "email.error", {"type": "WELCOME", "error": str(e)})

    return orchestrator_result


@app.post("/api/hris/create/{case_id}")
async def hris_create(case_id: str) -> Dict[str, Any]:
    """
    Curl-testable HRIS stub endpoint:
    - Auto-seeds case_store from DB/persisted state if needed.
    - Creates employee_records row idempotently (one per case).
    """
    c = ensure_case_seeded(case_id)
    case_store.emit(case_id, "agent.hris_start", {"msg": "HRIS create invoked via API..."})

    db = SessionLocal()
    try:
        res = await hris_agent.run(c, notes="api", db=db)
        db.commit()
    finally:
        db.close()

    out = {
        "summary": res.summary,
        "risks": res.risks,
        "actions": res.actions,
        "data": res.data,
    }
    case_store.update_agent_output(case_id, "hris", out)
    case_store.emit(case_id, "agent.hris_done", {"summary": res.summary, "employeeId": (res.data or {}).get("employeeId")})
    return {"ok": True, "hris": out}


@app.post("/api/workplace/assign/{case_id}")
async def workplace_assign(case_id: str) -> Dict[str, Any]:
    """
    Curl-testable Workplace endpoint:
    - Auto-seeds case_store from DB/persisted state if needed.
    - Persists assignment idempotently (one per case).
    """
    c = ensure_case_seeded(case_id)
    case_store.emit(case_id, "agent.workplace_start", {"msg": "Workplace assign invoked via API..."})
    res = await workplace_agent.run(c, notes="api")

    out = {
        "summary": res.summary,
        "risks": res.risks,
        "actions": res.actions,
        "data": res.data,
    }
    case_store.update_agent_output(case_id, "workplace", out)
    case_store.emit(case_id, "agent.workplace_done", {"summary": res.summary, "risks": res.risks})
    return {"ok": True, "workplace": out}


@app.post("/api/it/provision/{case_id}")
async def it_provision(case_id: str) -> Dict[str, Any]:
    """
    Curl-testable IT provisioning endpoint:
    - Auto-seeds case_store from DB/persisted state if needed.
    - Runs HRIS idempotently if missing employeeId.
    """
    c = ensure_case_seeded(case_id)

    hris_out = ((c.get("agentOutputs") or {}).get("hris") or {}).get("data") or {}
    if not hris_out.get("employeeId"):
        case_store.emit(case_id, "agent.hris_start", {"msg": "HRIS required for IT; running HRIS idempotently..."})
        db = SessionLocal()
        try:
            hris_res = await hris_agent.run(c, notes="api", db=db)
            db.commit()
        finally:
            db.close()
        hris_payload = {
            "summary": hris_res.summary,
            "risks": hris_res.risks,
            "actions": hris_res.actions,
            "data": hris_res.data,
        }
        case_store.update_agent_output(case_id, "hris", hris_payload)
        c = case_store.get_case(case_id) or c

    case_store.emit(case_id, "agent.it_start", {"msg": "IT provisioning invoked via API..."})
    res = await it_agent.run(c, notes="api")

    out = {
        "summary": res.summary,
        "risks": res.risks,
        "actions": res.actions,
        "data": res.data,
    }
    case_store.update_agent_output(case_id, "it", out)

    case_store.emit(case_id, "agent.it_done", {"summary": res.summary, "risks": res.risks})
    return {"ok": True, "it": out}


@app.websocket("/ws/{case_id}")
async def ws_case(ws: WebSocket, case_id: str) -> None:
    await ws.accept()
    try:
        for evt in case_store.get_recent_events(case_id):
            await ws.send_json(evt)

        q = case_store.subscribe(case_id)
        while True:
            evt = await q.get()
            await ws.send_json(evt)
    except WebSocketDisconnect:
        pass
    finally:
        case_store.unsubscribe(case_id, q)
