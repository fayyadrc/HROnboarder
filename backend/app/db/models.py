from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.types import JSON
from datetime import datetime
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
