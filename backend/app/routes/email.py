from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.db.database import SessionLocal
from app.db.models import Case as DbCase
from app.llm.client import RUNPOD_MODEL
from app.services.case_bridge import ensure_case_seeded
from app.services.email_service import (
    _get_candidate_email,
    build_it_low_stock_email,
    build_welcome_email,
    flag_sent,
    mark_flag,
    send_email,
)
from app.store.case_store import case_store

router = APIRouter(prefix="/api/email", tags=["Email"])

WELCOME_FLAG = "email_welcome_sent"
LOW_STOCK_FLAG = "email_it_low_stock_sent"


class WelcomeEmailRequest(BaseModel):
    to_email: Optional[str] = Field(None, description="Optional override candidate email")
    requested_model: Optional[str] = Field(None, description="Optional LLM model override")


class LowStockEmailRequest(BaseModel):
    it_email: str = Field(..., description="Destination IT email address")
    requested_model: str = Field(..., description="Requested laptop/model/bundle name")
    missing_or_low: List[str] = Field(default_factory=list, description="List of items that are low or missing")
    model: Optional[str] = Field(None, description="Override LLM model")
    force: bool = Field(False, description="If true, send even if previously sent")


def _resolve_candidate_email(case_id: str, case: Dict[str, Any], override_email: Optional[str]) -> Optional[str]:
    if isinstance(override_email, str) and "@" in override_email:
        return override_email.strip()

    found = _get_candidate_email(case)
    if found:
        return found

    db = SessionLocal()
    try:
        db_case = db.query(DbCase).filter(DbCase.id == case_id).first()
        if not db_case:
            return None

        candidate_email = getattr(db_case, "candidate_email", None)
        if isinstance(candidate_email, str) and "@" in candidate_email:
            return candidate_email.strip()
    finally:
        db.close()

    return None


def send_welcome_email_for_case(case_id: str, to_email: Optional[str] = None, requested_model: Optional[str] = None) -> Dict[str, Any]:
    """Background task target: send WELCOME email. Never raises."""
    try:
        ensure_case_seeded(case_id)
        case = case_store.get_case(case_id)
        if not case:
            case_store.emit(case_id, "email.error", {"type": "WELCOME", "error": "Case not found"})
            return {"ok": False, "error": "Case not found"}

        if flag_sent(case_id, WELCOME_FLAG):
            return {"ok": True, "skipped": True, "reason": "welcome already sent"}

        to_addr = _resolve_candidate_email(case_id, case, to_email)
        if not to_addr:
            msg = "Candidate email not found. Capture email in wizard or pass to_email."
            case_store.emit(case_id, "email.error", {"type": "WELCOME", "error": msg})
            return {"ok": False, "error": msg}

        email_obj = build_welcome_email(case, to_addr, use_llm=True, model=requested_model or RUNPOD_MODEL)
        result = send_email(case_id, email_obj)
        if result.get("ok"):
            mark_flag(case_id, WELCOME_FLAG)
        return result
    except Exception as e:
        case_store.emit(case_id, "email.error", {"type": "WELCOME", "error": str(e)})
        return {"ok": False, "error": str(e)}


def send_it_low_stock_email_for_case(
    case_id: str,
    it_email: str,
    requested_model: str,
    missing_or_low: List[str],
    model: Optional[str] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Background task target: send IT_LOW_STOCK email. Never raises."""
    try:
        ensure_case_seeded(case_id)
        case = case_store.get_case(case_id)
        if not case:
            case_store.emit(case_id, "email.error", {"type": "IT_LOW_STOCK", "error": "Case not found"})
            return {"ok": False, "error": "Case not found"}

        if (not force) and flag_sent(case_id, LOW_STOCK_FLAG):
            return {"ok": True, "skipped": True, "reason": "it low stock email already sent"}

        email_obj = build_it_low_stock_email(
            case,
            it_email=it_email,
            requested_model=requested_model,
            missing_or_low=missing_or_low,
            use_llm=True,
            model=model or RUNPOD_MODEL,
        )
        result = send_email(case_id, email_obj)
        if result.get("ok"):
            mark_flag(case_id, LOW_STOCK_FLAG)
        return result
    except Exception as e:
        case_store.emit(case_id, "email.error", {"type": "IT_LOW_STOCK", "error": str(e)})
        return {"ok": False, "error": str(e)}


@router.post("/welcome/{case_id}")
def queue_welcome_email(case_id: str, background_tasks: BackgroundTasks, req: Optional[WelcomeEmailRequest] = None) -> Dict[str, Any]:
    try:
        ensure_case_seeded(case_id)
        case = case_store.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        if req and req.to_email and "@" not in req.to_email:
            raise HTTPException(status_code=400, detail="Invalid to_email")

        if flag_sent(case_id, WELCOME_FLAG):
            return {"ok": True, "skipped": True, "reason": "welcome already sent"}

        to_email = _resolve_candidate_email(case_id, case, req.to_email if req else None)
        if not to_email:
            raise HTTPException(status_code=400, detail="Candidate email not found. Capture email in wizard or pass to_email.")

        requested_model = (req.requested_model if req else None) or RUNPOD_MODEL
        background_tasks.add_task(send_welcome_email_for_case, case_id, to_email, requested_model)
        case_store.emit(case_id, "email.queued", {"type": "WELCOME", "to": to_email})

        return {
            "ok": True,
            "queued": True,
            "message": "Welcome email will be sent shortly.",
            "to": to_email,
        }
    except HTTPException:
        raise
    except Exception as e:
        case_store.emit(case_id, "email.error", {"type": "WELCOME", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Email generation failed: {e}")


@router.post("/it_low_stock/{case_id}")
def queue_it_low_stock_email(case_id: str, req: LowStockEmailRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    try:
        ensure_case_seeded(case_id)
        case = case_store.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        if "@" not in req.it_email:
            raise HTTPException(status_code=400, detail="Invalid it_email")

        if (not req.force) and flag_sent(case_id, LOW_STOCK_FLAG):
            return {"ok": True, "skipped": True, "reason": "it low stock email already sent"}

        preview = build_it_low_stock_email(
            case,
            it_email=req.it_email,
            requested_model=req.requested_model,
            missing_or_low=req.missing_or_low,
            use_llm=False,
            model=req.model or RUNPOD_MODEL,
        )

        background_tasks.add_task(
            send_it_low_stock_email_for_case,
            case_id,
            req.it_email,
            req.requested_model,
            req.missing_or_low,
            req.model,
            req.force,
        )
        case_store.emit(case_id, "email.queued", {"type": "IT_LOW_STOCK", "to": req.it_email})

        return {
            "ok": True,
            "queued": True,
            "message": "IT low stock email will be sent shortly.",
            "email": preview,
        }
    except HTTPException:
        raise
    except Exception as e:
        case_store.emit(case_id, "email.error", {"type": "IT_LOW_STOCK", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Email generation failed: {e}")
