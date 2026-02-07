from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.types import JSON

from .database import Base


class HRUser(Base):
    __tablename__ = "hr_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, index=True)
    candidate_name = Column(String)
    role = Column(String)
    nationality = Column(String)
    work_location = Column(String)
    start_date = Column(String)
    salary = Column(String)
    benefits = Column(JSON, default={})
    prior_notes = Column(String)
    status = Column(String, default="DRAFT")
    created_at = Column(DateTime, default=datetime.utcnow)


class ApplicationCode(Base):
    __tablename__ = "application_codes"

    code = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmployeeRecord(Base):
    __tablename__ = "employee_records"

    # One employee per case (idempotency)
    case_id = Column(String, ForeignKey("cases.id"), primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String)
    department = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkplaceAssignment(Base):
    """
    Milestone 3.1: Workplace idempotency.
    One workplace assignment per case_id (seat + equipment bundle).
    """
    __tablename__ = "workplace_assignments"

    case_id = Column(String, ForeignKey("cases.id"), primary_key=True, index=True)
    seat_id = Column(String, index=True)
    bundle_name = Column(String, index=True)
    device_model = Column(String, index=True)
    equipment = Column(JSON, default={})
    seating = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)


class CaseState(Base):
    """
    Milestone 3: Resume-safe persistence of in-memory wizard + agent state.
    Stores the full case_store JSON for a case_id.
    """
    __tablename__ = "case_states"

    case_id = Column(String, ForeignKey("cases.id"), primary_key=True, index=True)
    state = Column(JSON, default={})
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
