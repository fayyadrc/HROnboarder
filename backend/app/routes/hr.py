from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4

from app.db.database import SessionLocal
from app.db.models import HRUser, Case, ApplicationCode, EmployeeRecord

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
        # verify case exists
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        # Return existing active code if present (idempotent)
        active = (
            db.query(ApplicationCode)
            .filter(ApplicationCode.case_id == case_id, ApplicationCode.active == True)
            .first()
        )
        if active:
            return {"applicationCode": active.code}

        # Deactivate any lingering rows (defensive)
        db.query(ApplicationCode).filter(ApplicationCode.case_id == case_id).update({ApplicationCode.active: False})

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
    try:
        cases = db.query(Case).all()
        result = []
        for c in cases:
            code = (
                db.query(ApplicationCode)
                .filter(
                    ApplicationCode.case_id == c.id,
                    ApplicationCode.active == True
                )
                .first()
            )
            emp = db.query(EmployeeRecord).filter(EmployeeRecord.case_id == c.id).first()

            result.append({
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
                "employeeId": emp.employee_id if emp else None,
            })
        return result
    except Exception:
        db.rollback()
        raise
