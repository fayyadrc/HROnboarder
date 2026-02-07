"""
TEMPORARY ROUTES FILE FOR TESTING
==================================
Add this to main.py to enable these routes:
    from app.routes.hr_employees_temp import router as employees_router
    app.include_router(employees_router)

DELETE THIS FILE after your friend implements the real endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import SessionLocal
from app.db.models import Case, EmployeeRecord

router = APIRouter(prefix="/api/hr", tags=["HR Employees (Temp)"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Temporary in-memory storage for assets (will be lost on restart)
# In production, this should be a database table
_employee_assets = {}

# Temporary in-memory storage for step data
_step_data = {}


@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    """
    List all employees with their case data and step information.
    Only returns employees who have SUBMITTED their application (confirmed hires).
    """
    # Statuses that indicate the application has been submitted/completed
    CONFIRMED_STATUSES = ["ONBOARDING_IN_PROGRESS", "SUBMITTED", "ONBOARDING_COMPLETE", "READY_DAY1", "HRIS_COMPLETED"]
    
    employees = db.query(EmployeeRecord).all()
    result = []
    
    for emp in employees:
        case = db.query(Case).filter(Case.id == emp.case_id).first()
        
        # Only include employees whose case status indicates they've submitted
        if not case or case.status not in CONFIRMED_STATUSES:
            continue
        
        result.append({
            "employee_id": emp.employee_id,
            "case_id": emp.case_id,
            "full_name": emp.full_name,
            "email": emp.email,
            "department": emp.department,
            "role": case.role if case else None,
            "start_date": case.start_date if case else None,
            "status": case.status if case else "UNKNOWN",
            "steps": _step_data.get(emp.case_id, get_default_steps(emp, case)),
            "assets": _employee_assets.get(emp.employee_id, get_default_assets())
        })
    
    return result


@router.get("/employees/{employee_id}")
def get_employee_details(employee_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information for a single employee.
    """
    employee = db.query(EmployeeRecord).filter(
        EmployeeRecord.employee_id == employee_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    case = db.query(Case).filter(Case.id == employee.case_id).first()
    
    return {
        "employee_id": employee.employee_id,
        "case_id": employee.case_id,
        "full_name": employee.full_name,
        "email": employee.email,
        "department": employee.department,
        "role": case.role if case else None,
        "start_date": case.start_date if case else None,
        "status": case.status if case else "UNKNOWN",
        "steps": _step_data.get(employee.case_id, get_default_steps(employee, case)),
        "assets": _employee_assets.get(employee.employee_id, get_default_assets())
    }


@router.put("/employees/{employee_id}/assets")
def update_employee_assets(employee_id: str, assets: dict, db: Session = Depends(get_db)):
    """
    Update employee assets (laptop, seat).
    Stored in memory for now - will be lost on restart.
    """
    employee = db.query(EmployeeRecord).filter(
        EmployeeRecord.employee_id == employee_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Store in memory
    _employee_assets[employee_id] = {
        "laptop": assets.get("laptop", {"assigned": False, "model": None, "asset_id": None}),
        "seat": assets.get("seat", {"assigned": False, "location": None})
    }
    
    return {"success": True, "employee_id": employee_id, "assets": _employee_assets[employee_id]}


@router.post("/cases/{case_id}/orchestrate")
def orchestrate_case(case_id: str, db: Session = Depends(get_db)):
    """
    TEMPORARY: Mock orchestrator endpoint for testing.
    In production, this calls run_orchestrator_for_case() from orchestrator_service.py
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get employee record for this case
    employee = db.query(EmployeeRecord).filter(EmployeeRecord.case_id == case_id).first()
    employee_id = employee.employee_id if employee else f"EMP-{case_id}"
    
    # Simulate laptop assignment based on role
    role = (case.role or "").lower()
    if "engineer" in role or "developer" in role or "swe" in role:
        laptop_model = "Dell XPS 15"
    elif "manager" in role or "director" in role:
        laptop_model = "MacBook Pro 14 inch"
    elif "designer" in role:
        laptop_model = "MacBook Pro 16 inch"
    else:
        laptop_model = "Dell Latitude 5540"
    
    # Simulate zone based on location
    location = (case.work_location or "").lower()
    if "uae" in location or "dubai" in location or "abu dhabi" in location:
        zone = "A"
        delivery_days = 3
    else:
        zone = "B"
        delivery_days = 5
    
    # Create mock plan similar to what orchestrator would return
    plan = {
        "overallStatus": "GREEN",
        "day1Readiness": {
            "employeeId": employee_id,
            "ready": True
        },
        "agentSummaries": {
            "compliance": "All documents verified. Work authorization confirmed.",
            "logistics": f"Laptop: {laptop_model} (delivery in {delivery_days} days). Seat assigned: Floor 1, Zone {zone}"
        },
        "conflicts": []
    }
    
    return {"ok": True, "plan": plan}


def get_default_assets():
    """Default asset structure when no assets assigned."""
    return {
        "laptop": {"assigned": False, "model": None, "asset_id": None},
        "seat": {"assigned": False, "location": None}
    }


def get_default_steps(employee, case):
    """
    Build default steps data from employee and case info.
    In production, this would come from a steps table.
    """
    return {
        "offer": {"decision": "ACCEPTED" if case and case.status != "DRAFT" else None},
        "identity": {
            "fullName": employee.full_name if employee else None,
            "email": employee.email if employee else None,
            "phone": None,
            "country": case.nationality if case else None
        },
        "documents": {
            "passport": None,
            "nationalId": None,
            "visa": None
        },
        "workAuth": {
            "workLocation": case.work_location if case else None,
            "sponsorship": None
        }
    }
