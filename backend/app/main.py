from __future__ import annotations

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db.database import engine, SessionLocal
from sqlalchemy import text
from app.db.models import Base, HRUser, ApplicationCode, Case
from app.routes.hr import router as hr_router
from app.store.case_store import case_store
from app.services.orchestrator_service import run_orchestrator_for_case

app = FastAPI(title="HR Automator Backend", version="0.1.0")

# Startup: create tables + seed default HR user
@app.on_event("startup")
def _startup():
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Ensure only one active application code per case at the DB level (SQLite partial index)
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_application_codes_case_active ON application_codes(case_id) WHERE active=1"
                )
            )
            conn.commit()
    except Exception:
        # Non-fatal for demo, index creation may not be supported in some envs
        pass

    # Seed default HR user (hackathon-only)
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

# Dev-friendly CORS (hackathon). Tighten later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/case/init")
def init_case(payload: dict):
    application_code = payload.get("applicationCode")
    if not application_code:
        raise HTTPException(status_code=400, detail="applicationCode required")

    db = SessionLocal()
    try:
        code = (
            db.query(ApplicationCode)
            .filter(
                ApplicationCode.code == application_code,
                ApplicationCode.active == True
            )
            .first()
        )

        if not code:
            raise HTTPException(status_code=404, detail="Invalid application code")

        case = db.query(Case).filter(Case.id == code.case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        # Seed case_store (wizard engine)
        seeded_case = case_store.init_or_get_case(
            application_number=application_code,
            seed={
                "candidateName": case.candidate_name,
                "role": case.role,
                "workLocation": case.work_location,
                "nationality": case.nationality,
                "startDate": case.start_date,
                "compensation": {
                    "salary": case.salary
                },
                "benefitsContext": case.benefits or {},
                "priorNotes": case.prior_notes or "",
            },
            case_id=case.id,
        )

        return seeded_case

    finally:
        db.close()


@app.get("/api/case/{case_id}")
def get_case(case_id: str):
    c = case_store.get_case(case_id)
    if not c:
        return {"error": "Case not found"}
    return c


class SaveStepRequest(BaseModel):
    payload: dict
    nextStepIndex: int | None = None


@app.post("/api/case/{case_id}/step/{step_key}")
def save_step(case_id: str, step_key: str, req: SaveStepRequest):
    c = case_store.save_step(case_id, step_key, req.payload, req.nextStepIndex)
    if not c:
        return {"error": "Case not found"}
    return c


class RunAgentsRequest(BaseModel):
    # Optional overrides / extra context from UI
    notes: str | None = None


class SetStatusRequest(BaseModel):
    status: str


@app.post("/api/onboard/run/{case_id}")
async def run_agents(case_id: str, req: RunAgentsRequest):
    c = case_store.get_case(case_id)
    if not c:
        return {"error": "Case not found"}

    # Fire orchestrator (runs compliance + logistics in parallel)
    result = await run_orchestrator_for_case(case_id, notes=req.notes or "")
    return result


@app.post("/api/case/{case_id}/status")
def set_case_status(case_id: str, req: SetStatusRequest):
    c = case_store.get_case(case_id)
    if not c:
        return {"error": "Case not found"}
    db = SessionLocal()
    try:
        db_case = db.query(Case).filter(Case.id == case_id).first()
        if not db_case:
            return {"error": "Case not found"}
        db_case.status = req.status
        db.commit()
    finally:
        db.close()

    case_store.set_status(case_id, req.status)
    return case_store.get_case(case_id)


@app.websocket("/ws/{case_id}")
async def ws_case_events(ws: WebSocket, case_id: str):
    await ws.accept()
    q = case_store.subscribe(case_id)
    try:
        # Push existing recent events first (helps UI load mid-stream)
        for evt in case_store.get_recent_events(case_id):
            await ws.send_json(evt)

        while True:
            evt = await q.get()
            await ws.send_json(evt)
    except WebSocketDisconnect:
        pass
    finally:
        case_store.unsubscribe(case_id, q)
