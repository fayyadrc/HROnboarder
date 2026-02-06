from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException

from app.db.database import SessionLocal
from app.db.models import ApplicationCode, Case as DbCase
from app.store.case_store import case_store


def _build_seed(db_case: DbCase) -> Dict[str, Any]:
    return {
        "candidateName": db_case.candidate_name,
        "role": db_case.role,
        "workLocation": db_case.work_location,
        "nationality": db_case.nationality,
        "startDate": db_case.start_date,
        "compensation": {"salary": db_case.salary},
        "benefitsContext": db_case.benefits or {},
        "priorNotes": db_case.prior_notes or "",
    }


def ensure_case_seeded(case_id: str) -> Dict[str, Any]:
    """
    Ensure a case exists in the in-memory case_store.

    Why this exists:
    - The DB is authoritative for cases, codes, and status.
    - case_store is authoritative for wizard state and agent event streaming.
    - Curl-first endpoints must work even if /api/case/init wasn't called.

    Contract:
    - If case_store already has case_id -> return it.
    - Else load from DB and seed case_store using stable case_id = DB Case.id.
    - Also sync status into case_store.
    """
    existing = case_store.get_case(case_id)
    if existing:
        return existing

    db = SessionLocal()
    try:
        db_case = db.query(DbCase).filter(DbCase.id == case_id).first()
        if not db_case:
            raise HTTPException(status_code=404, detail="Case not found")

        active_code = (
            db.query(ApplicationCode)
            .filter(ApplicationCode.case_id == case_id, ApplicationCode.active == True)  # noqa: E712
            .first()
        )

        # Use application code if present (nice for traceability), otherwise use a stable unique placeholder
        application_number = active_code.code if active_code else f"CASEID-{case_id}"

        seeded = case_store.init_or_get_case(
            application_number=application_number,
            seed=_build_seed(db_case),
            case_id=db_case.id,
        )

        # Sync DB status into case_store
        if getattr(db_case, "status", None):
            case_store.set_status(db_case.id, db_case.status)

        return seeded
    finally:
        db.close()
