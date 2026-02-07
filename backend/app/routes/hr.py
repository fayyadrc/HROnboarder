from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import Any, Dict, List, Optional

from app.db.database import SessionLocal
from app.db.models import HRUser, Case, ApplicationCode, EmployeeRecord, WorkplaceAssignment
from app.services.orchestrator_service import run_orchestrator_for_case
from app.services.case_bridge import ensure_case_seeded
from app.store.case_store import case_store

router = APIRouter(prefix="/api/hr", tags=["HR"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login")
def hr_login(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username")
    password = payload.get("password")

    user = db.query(HRUser).filter(HRUser.username == username).first()
    if not user or user.password != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"ok": True}


@router.post("/cases")
def create_case(payload: dict, db: Session = Depends(get_db)):
    case_id = f"CASE-{uuid4().hex[:8].upper()}"

    try:
        new_case = Case(
            id=case_id,
            candidate_name=payload.get("candidate_name"),
            role=payload.get("role"),
            nationality=payload.get("nationality"),
            work_location=payload.get("work_location"),
            start_date=payload.get("start_date"),
            salary=payload.get("salary"),
            benefits=payload.get("benefits", {}),
            prior_notes=payload.get("prior_notes", ""),
            status=payload.get("status", "DRAFT"),
        )

        db.add(new_case)
        db.commit()
        return {"case_id": case_id}
    except Exception:
        db.rollback()
        raise


@router.post("/cases/{case_id}/generate_code")
def generate_application_code(case_id: str, db: Session = Depends(get_db)):
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        active = (
            db.query(ApplicationCode)
            .filter(
                ApplicationCode.case_id == case_id,
                ApplicationCode.active == True,  # noqa: E712
            )
            .first()
        )
        if active:
            return {"applicationCode": active.code}

        db.query(ApplicationCode).filter(
            ApplicationCode.case_id == case_id
        ).update({ApplicationCode.active: False})

        generated = f"APP-{uuid4().hex[:6].upper()}"
        code = ApplicationCode(code=generated, case_id=case_id, active=True)
        db.add(code)
        db.commit()
        db.refresh(code)
        return {"applicationCode": code.code}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cases")
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).all()
    result = []

    for c in cases:
        code = (
            db.query(ApplicationCode)
            .filter(
                ApplicationCode.case_id == c.id,
                ApplicationCode.active == True,  # noqa: E712
            )
            .first()
        )

        # Wizard / candidate feedback
        wizard_data = case_store.get_case(c.id)
        offer_step = (
            wizard_data.get("steps", {}).get("offer", {})
            if wizard_data
            else {}
        )

        # HRIS / employee record
        emp = (
            db.query(EmployeeRecord)
            .filter(EmployeeRecord.case_id == c.id)
            .first()
        )

        result.append(
            {
                "id": c.id,
                "candidate_name": c.candidate_name,
                "role": c.role,
                "nationality": c.nationality,
                "work_location": c.work_location,
                "start_date": c.start_date,
                "salary": c.salary,
                "benefits": c.benefits,
                "prior_notes": c.prior_notes,
                "status": c.status,
                "applicationCode": code.code if code else None,

                # Candidate-facing signals
                "candidate_decision": offer_step.get("decision"),
                "candidate_concerns": offer_step.get("concerns"),
                "salary_appeal": offer_step.get("salaryAppeal"),

                # HRIS outcome
                "employeeId": emp.employee_id if emp else None,
            }
        )

    return result


@router.put("/cases/{case_id}")
def update_case(case_id: str, payload: dict, db: Session = Depends(get_db)):
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        for field in [
            "candidate_name",
            "role",
            "nationality",
            "work_location",
            "start_date",
            "salary",
            "benefits",
            "prior_notes",
            "status",
        ]:
            if field in payload:
                setattr(c, field, payload[field])

        db.commit()
        return {"ok": True, "case_id": case_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cases/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        db.query(ApplicationCode).filter(
            ApplicationCode.case_id == case_id
        ).delete()

        db.delete(c)
        db.commit()

        case_store.delete_case(case_id)

        return {"ok": True, "deleted": case_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cases/{case_id}/resume")
def resume_case(case_id: str, db: Session = Depends(get_db)):
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        c.status = "ONBOARDING_IN_PROGRESS"
        db.commit()

        case_store.set_status(case_id, "ONBOARDING_IN_PROGRESS")

        wizard_data = case_store.get_case(case_id)
        if wizard_data and wizard_data.get("currentStepIndex", 0) == 1:
            wizard_data["currentStepIndex"] = 2
            wizard_data["status"] = "ONBOARDING_IN_PROGRESS"

        return {
            "ok": True,
            "case_id": case_id,
            "status": "ONBOARDING_IN_PROGRESS",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# HR Admin - Employees View
# -----------------------------------------------------------------------------

CONFIRMED_STATUSES = {
    "ONBOARDING_IN_PROGRESS",
    "SUBMITTED",
    "ONBOARDING_COMPLETE",
    "READY_DAY1",
    "HRIS_COMPLETED",
    # keep AT_RISK here for safety if any older cases still have it stored as status
    "AT_RISK",
}


def _get_assets_for_case(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Assets source-of-truth:
    - WorkplaceAssignment table (restart-safe)
    """
    wa = db.query(WorkplaceAssignment).filter(WorkplaceAssignment.case_id == case_id).first()
    if not wa:
        return {
            "laptop": {"assigned": False, "model": None, "asset_id": None},
            "seat": {"assigned": False, "location": None},
        }

    # Seat location
    if isinstance(wa.seating, dict) and wa.seating:
        seat_location = wa.seating.get("location") or wa.seating.get("seat") or wa.seat_id
    else:
        seat_location = wa.seat_id

    # Laptop asset tag/id (persisted in equipment JSON)
    asset_id = None
    if isinstance(wa.equipment, dict) and wa.equipment:
        asset_id = wa.equipment.get("assetId")

    return {
        "laptop": {"assigned": bool(wa.device_model), "model": wa.device_model, "asset_id": asset_id},
        "seat": {"assigned": bool(seat_location), "location": seat_location},
    }


def _get_steps_for_case(case_id: str) -> Dict[str, Any]:
    """
    Steps source-of-truth:
    - case_store persisted JSON via CaseState (restart-safe)
    """
    wizard = case_store.get_case(case_id) or {}
    steps = wizard.get("steps") or {}
    return steps if isinstance(steps, dict) else {}


def _is_confirmed_case(db_case: Optional[Case], wizard: Dict[str, Any]) -> bool:
    db_status = (db_case.status if db_case else None) or ""
    wiz_status = (wizard.get("status") or "") if isinstance(wizard, dict) else ""
    status = wiz_status or db_status
    return bool(status) and status in CONFIRMED_STATUSES


@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(EmployeeRecord).all()
    out: List[Dict[str, Any]] = []

    for emp in employees:
        db_case = db.query(Case).filter(Case.id == emp.case_id).first()
        wizard = case_store.get_case(emp.case_id) or {}

        if not _is_confirmed_case(db_case, wizard):
            continue

        out.append({
            "employee_id": emp.employee_id,
            "case_id": emp.case_id,
            "full_name": emp.full_name,
            "email": emp.email,
            "department": emp.department,
            "role": (db_case.role if db_case else None),
            "start_date": (db_case.start_date if db_case else None),
            "status": (
                wizard.get("status")
                if isinstance(wizard, dict) and wizard.get("status")
                else (db_case.status if db_case else "UNKNOWN")
            ),
            "steps": _get_steps_for_case(emp.case_id),
            "assets": _get_assets_for_case(db, emp.case_id),
        })

    return out


@router.get("/employees/{employee_id}")
def get_employee_details(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(EmployeeRecord).filter(EmployeeRecord.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db_case = db.query(Case).filter(Case.id == emp.case_id).first()
    wizard = case_store.get_case(emp.case_id) or {}

    return {
        "employee_id": emp.employee_id,
        "case_id": emp.case_id,
        "full_name": emp.full_name,
        "email": emp.email,
        "department": emp.department,
        "role": (db_case.role if db_case else None),
        "start_date": (db_case.start_date if db_case else None),
        "status": (
            wizard.get("status")
            if isinstance(wizard, dict) and wizard.get("status")
            else (db_case.status if db_case else "UNKNOWN")
        ),
        "steps": _get_steps_for_case(emp.case_id),
        "assets": _get_assets_for_case(db, emp.case_id),
    }


@router.put("/employees/{employee_id}/assets")
def update_employee_assets(employee_id: str, payload: dict, db: Session = Depends(get_db)):
    """
    Persist assets in workplace_assignments (restart-safe).
    Expected payload:
    {
      "laptop": {"assigned": true, "model": "...", "asset_id": "..."},
      "seat": {"assigned": true, "location": "..."}
    }
    """
    emp = db.query(EmployeeRecord).filter(EmployeeRecord.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    case_id = emp.case_id

    laptop = payload.get("laptop") or {}
    seat = payload.get("seat") or {}

    device_model = laptop.get("model")
    asset_id = laptop.get("asset_id")
    seat_location = seat.get("location")

    wa = db.query(WorkplaceAssignment).filter(WorkplaceAssignment.case_id == case_id).first()

    def _as_dict(v: Any) -> Dict[str, Any]:
        return v if isinstance(v, dict) else {}

    if not wa:
        equipment_payload = {"manual_override": True, "source": "HR_ADMIN"}
        if asset_id is not None:
            equipment_payload["assetId"] = asset_id

        seating_payload = {"manual_override": True}
        if seat_location is not None:
            seating_payload["location"] = seat_location

        wa = WorkplaceAssignment(
            case_id=case_id,
            seat_id=seat_location,
            device_model=device_model,
            equipment=equipment_payload,
            seating=seating_payload,
        )
        db.add(wa)
    else:
        # Update seat
        if seat_location is not None:
            wa.seat_id = seat_location
            seating_dict = _as_dict(wa.seating)
            seating_dict.update({"manual_override": True, "location": seat_location})
            wa.seating = seating_dict

        # Update device model
        if device_model is not None:
            wa.device_model = device_model

        # Update equipment JSON (ALWAYS safe-update)
        equipment_dict = _as_dict(wa.equipment)
        equipment_dict.update({"manual_override": True, "source": "HR_ADMIN"})
        if asset_id is not None:
            equipment_dict["assetId"] = asset_id
        wa.equipment = equipment_dict

    db.commit()

    return {
        "success": True,
        "employee_id": emp.employee_id,
        "assets": _get_assets_for_case(db, case_id),
    }


@router.post("/cases/{case_id}/orchestrate")
async def orchestrate_case(case_id: str, db: Session = Depends(get_db)):
    """
    Real orchestrator trigger for HR Admin view.
    NOTE: run_orchestrator_for_case already returns {"ok": True, "plan": ...}
    """
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    ensure_case_seeded(case_id)

    # FIX: do NOT wrap again
    result = await run_orchestrator_for_case(case_id, notes="hr_admin_orchestrate")

    # Be defensive: if it ever returns raw plan, normalize
    if isinstance(result, dict) and "ok" in result and "plan" in result:
        return result

    return {"ok": True, "plan": result}
