"""
Backend Changes Required for HR Admin Employee View
====================================================

This file documents the backend changes needed to support the new HR Admin 
Employee view feature. Please implement these changes in the corresponding files.

Created: February 7, 2026
Purpose: Document backend API endpoints for employee management in HR Admin page

"""

# =============================================================================
# FILE: backend/app/routes/hr.py
# CHANGES: Add new endpoints for employee listing and management
# =============================================================================

HR_ROUTES_ADDITIONS = '''
# Add these imports at the top of the file
from ..db.models import EmployeeRecord
from sqlalchemy.orm import Session
from typing import List
from ..services.orchestrator_service import run_orchestrator_for_case

# -----------------------------------------------------------------------------
# NEW ENDPOINT: Trigger orchestrator to assign laptop and desk
# -----------------------------------------------------------------------------

@router.post("/cases/{case_id}/orchestrate")
async def orchestrate_case(case_id: str, db: Session = Depends(get_db)):
    """
    Triggers the orchestrator agent to:
    1. Check compliance requirements
    2. Assign laptop based on role (via logistics_tools.laptop_stock)
    3. Assign desk/seat location
    4. Check for conflicts (delivery time vs start date)
    
    Returns the generated day-1 readiness plan.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Run the orchestrator (this calls your existing orchestrator_service.py)
    plan = await run_orchestrator_for_case(case_id)
    
    return {"ok": True, "plan": plan}


# -----------------------------------------------------------------------------
# NEW ENDPOINT: List all employees (with their onboarding status and details)
# -----------------------------------------------------------------------------

@router.get("/employees")
async def list_employees(db: Session = Depends(get_db)):
    """
    Get all employees with their case data and onboarding status.
    Returns employee info merged with their case/application data.
    
    IMPORTANT: Only returns employees who have SUBMITTED their application
    (confirmed hires), not everyone. Draft cases or cases still in progress
    should NOT appear in the Employees list.
    """
    # Only show employees with these statuses (application submitted/completed)
    CONFIRMED_STATUSES = ["ONBOARDING_IN_PROGRESS", "SUBMITTED", "ONBOARDING_COMPLETE", "READY_DAY1", "HRIS_COMPLETED"]
    
    employees = db.query(EmployeeRecord).all()
    result = []
    
    for emp in employees:
        # Get the associated case for full details
        case = db.query(Case).filter(Case.id == emp.case_id).first()
        
        # Skip employees whose case is not in a confirmed status
        if not case or case.status not in CONFIRMED_STATUSES:
            continue
        
        # Get stored step data (you may need to create a StepData model)
        step_data = get_step_data_for_case(db, emp.case_id)
        
        result.append({
            "employee_id": emp.employee_id,
            "case_id": emp.case_id,
            "full_name": emp.full_name,
            "email": emp.email,
            "department": emp.department,
            "role": case.role if case else None,
            "start_date": case.start_date if case else None,
            "status": case.status if case else "UNKNOWN",
            "steps": step_data,
            "assets": get_employee_assets(db, emp.employee_id)
        })
    
    return result


# -----------------------------------------------------------------------------
# NEW ENDPOINT: Get single employee details
# -----------------------------------------------------------------------------

@router.get("/employees/{employee_id}")
async def get_employee_details(employee_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information for a single employee including:
    - Personal info from EmployeeRecord
    - Application steps data (identity, documents, work auth, etc.)
    - Assigned assets (laptop, seat)
    """
    employee = db.query(EmployeeRecord).filter(
        EmployeeRecord.employee_id == employee_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    case = db.query(Case).filter(Case.id == employee.case_id).first()
    step_data = get_step_data_for_case(db, employee.case_id)
    assets = get_employee_assets(db, employee.employee_id)
    
    return {
        "employee_id": employee.employee_id,
        "case_id": employee.case_id,
        "full_name": employee.full_name,
        "email": employee.email,
        "department": employee.department,
        "role": case.role if case else None,
        "start_date": case.start_date if case else None,
        "status": case.status if case else "UNKNOWN",
        "steps": step_data,
        "assets": assets
    }


# -----------------------------------------------------------------------------
# NEW ENDPOINT: Update employee assets (laptop, seat)
# -----------------------------------------------------------------------------

@router.put("/employees/{employee_id}/assets")
async def update_employee_assets(
    employee_id: str, 
    assets: dict,  # You may want to create a Pydantic schema for this
    db: Session = Depends(get_db)
):
    """
    Update employee assets like laptop and seat assignments.
    
    Expected payload format:
    {
        "laptop": {
            "assigned": true,
            "model": "MacBook Pro 14 inch",
            "asset_id": "LAP-2026-0042"
        },
        "seat": {
            "assigned": true,
            "location": "Floor 3, Desk 12B"
        }
    }
    """
    employee = db.query(EmployeeRecord).filter(
        EmployeeRecord.employee_id == employee_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Update or create asset records
    update_or_create_employee_assets(db, employee_id, assets)
    
    db.commit()
    
    return {"success": True, "employee_id": employee_id, "assets": assets}


# -----------------------------------------------------------------------------
# HELPER FUNCTIONS (add these or integrate into existing structure)
# -----------------------------------------------------------------------------

def get_step_data_for_case(db: Session, case_id: str) -> dict:
    """
    Retrieve all step data for a case.
    You may need to create a StepData model if not already exists.
    """
    # Option 1: If steps are stored in a separate table
    # steps = db.query(StepData).filter(StepData.case_id == case_id).all()
    
    # Option 2: If steps are stored in the Case model as JSON
    # case = db.query(Case).filter(Case.id == case_id).first()
    # return case.steps if case else {}
    
    # Return empty dict as placeholder - implement based on your data structure
    return {}


def get_employee_assets(db: Session, employee_id: str) -> dict:
    """
    Get assigned assets for an employee.
    """
    asset = db.query(EmployeeAsset).filter(
        EmployeeAsset.employee_id == employee_id
    ).first()
    
    if not asset:
        return {
            "laptop": {"assigned": False, "model": None, "asset_id": None},
            "seat": {"assigned": False, "location": None}
        }
    
    return {
        "laptop": {
            "assigned": asset.laptop_assigned,
            "model": asset.laptop_model,
            "asset_id": asset.laptop_asset_id
        },
        "seat": {
            "assigned": asset.seat_assigned,
            "location": asset.seat_location
        }
    }


def update_or_create_employee_assets(db: Session, employee_id: str, assets: dict):
    """
    Update or create asset record for an employee.
    """
    asset = db.query(EmployeeAsset).filter(
        EmployeeAsset.employee_id == employee_id
    ).first()
    
    laptop = assets.get("laptop", {})
    seat = assets.get("seat", {})
    
    if asset:
        # Update existing
        asset.laptop_assigned = laptop.get("assigned", False)
        asset.laptop_model = laptop.get("model")
        asset.laptop_asset_id = laptop.get("asset_id")
        asset.seat_assigned = seat.get("assigned", False)
        asset.seat_location = seat.get("location")
    else:
        # Create new
        new_asset = EmployeeAsset(
            employee_id=employee_id,
            laptop_assigned=laptop.get("assigned", False),
            laptop_model=laptop.get("model"),
            laptop_asset_id=laptop.get("asset_id"),
            seat_assigned=seat.get("assigned", False),
            seat_location=seat.get("location")
        )
        db.add(new_asset)
'''


# =============================================================================
# FILE: backend/app/db/models.py
# CHANGES: Add new model for employee assets
# =============================================================================

MODELS_ADDITIONS = '''
# Add this new model to models.py

class EmployeeAsset(Base):
    """
    Stores asset assignments for employees (laptop, desk/seat).
    One record per employee.
    """
    __tablename__ = "employee_assets"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employee_records.employee_id"), unique=True, index=True)
    
    # Laptop information
    laptop_assigned = Column(Boolean, default=False)
    laptop_model = Column(String, nullable=True)
    laptop_asset_id = Column(String, nullable=True)
    
    # Seat/desk information
    seat_assigned = Column(Boolean, default=False)
    seat_location = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Also consider adding a StepData model if steps are not already stored:

class StepData(Base):
    """
    Stores onboarding step data for each case.
    """
    __tablename__ = "step_data"
    
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), index=True)
    step_key = Column(String, index=True)  # e.g., 'identity', 'documents', 'workAuth'
    data = Column(JSON, default={})
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
'''


# =============================================================================
# FILE: backend/app/schemas/employees.py (NEW FILE)
# CHANGES: Create Pydantic schemas for employee endpoints
# =============================================================================

EMPLOYEES_SCHEMAS = '''
# Create this new file: backend/app/schemas/employees.py

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class LaptopAsset(BaseModel):
    assigned: bool = False
    model: Optional[str] = None
    asset_id: Optional[str] = None


class SeatAsset(BaseModel):
    assigned: bool = False
    location: Optional[str] = None


class EmployeeAssets(BaseModel):
    laptop: LaptopAsset = LaptopAsset()
    seat: SeatAsset = SeatAsset()


class DocumentInfo(BaseModel):
    name: str
    size: int
    status: str = "pending"  # pending, verified, rejected


class DocumentsData(BaseModel):
    passport: Optional[DocumentInfo] = None
    nationalId: Optional[DocumentInfo] = None
    visa: Optional[DocumentInfo] = None


class IdentityData(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None


class WorkAuthData(BaseModel):
    workLocation: Optional[str] = None
    sponsorship: Optional[str] = None


class OfferData(BaseModel):
    decision: Optional[str] = None


class StepsData(BaseModel):
    offer: Optional[OfferData] = None
    identity: Optional[IdentityData] = None
    documents: Optional[DocumentsData] = None
    workAuth: Optional[WorkAuthData] = None


class EmployeeResponse(BaseModel):
    employee_id: str
    case_id: str
    full_name: str
    email: str
    department: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    status: str
    steps: StepsData = StepsData()
    assets: EmployeeAssets = EmployeeAssets()


class EmployeeListResponse(BaseModel):
    employees: list[EmployeeResponse]


class UpdateAssetsRequest(BaseModel):
    laptop: Optional[LaptopAsset] = None
    seat: Optional[SeatAsset] = None


class UpdateAssetsResponse(BaseModel):
    success: bool
    employee_id: str
    assets: EmployeeAssets
'''


# =============================================================================
# FILE: backend/app/db/database.py
# CHANGES: Ensure new tables are created
# =============================================================================

DATABASE_CHANGES = '''
# After adding the new models, run migrations or ensure tables are created.
# If using Alembic for migrations, create a new migration:
#   alembic revision --autogenerate -m "Add employee_assets and step_data tables"
#   alembic upgrade head

# If not using Alembic, ensure Base.metadata.create_all() is called in main.py
# to create the new tables.
'''


# =============================================================================
# SUMMARY OF CHANGES
# =============================================================================

SUMMARY = """
SUMMARY OF BACKEND CHANGES NEEDED:

1. backend/app/db/models.py:
   - Add EmployeeAsset model for storing laptop and seat assignments
   - Optionally add StepData model if step data isn't already stored

2. backend/app/schemas/employees.py (NEW FILE):
   - Create Pydantic schemas for employee data validation

3. backend/app/routes/hr.py:
   - Add POST /api/hr/cases/{case_id}/orchestrate - Trigger orchestrator for auto-assignment
   - Add GET /api/hr/employees - List all employees with their details
     IMPORTANT: Only return employees with CONFIRMED statuses:
     ["ONBOARDING_IN_PROGRESS", "SUBMITTED", "ONBOARDING_COMPLETE", "READY_DAY1", "HRIS_COMPLETED"]
     Do NOT return employees whose cases are still in DRAFT status.
   - Add GET /api/hr/employees/{employee_id} - Get single employee details
   - Add PUT /api/hr/employees/{employee_id}/assets - Update employee assets
   - Add helper functions for fetching/updating employee data

4. Database:
   - Run migrations to create new tables (employee_assets, optionally step_data)

ORCHESTRATOR INTEGRATION:
The /orchestrate endpoint calls run_orchestrator_for_case() which triggers:
- LogisticsAgent.run() to check laptop_stock() for role-based laptop assignment
- Compliance checks and conflict detection (delivery days vs start date)
- Returns a day-1 readiness plan that the frontend uses to update assets

FRONTEND MOCK DATA NOTE:
The frontend currently uses mock data in mockApi.js that will be replaced
by actual API calls once the backend endpoints are implemented. The mock
API functions will attempt to call the real endpoints first and fall back
to mock data if the endpoints don't exist yet.
"""

if __name__ == "__main__":
    print(SUMMARY)
    print("\n" + "="*60)
    print("See the constants above for detailed code snippets to add.")
    print("="*60)
