from __future__ import annotations

from typing import Dict, Tuple


# Deterministic mock rules (demo-safe)
# You can replace these with real policy tables later.
def required_docs(nationality: str, work_location: str, role: str) -> Dict[str, str]:
    docs = {
        "passport": "Required for all hires",
        "photo": "Required for badge/ID",
        "address_proof": "Required for payroll/bank KYC",
    }

    if work_location.upper() in {"AE", "UAE"}:
        docs["visa_page"] = "Required (residency/work permit processing)"
        docs["emirates_id"] = "Required post-issuance (can be pending for Day 1)"

    # Role-based
    if "nurse" in (role or "").lower() or "doctor" in (role or "").lower():
        docs["license"] = "Required for clinical roles (DHA/MOH/DOH as applicable)"
        docs["certificates"] = "Required (clinical qualification verification)"

    return docs


def estimate_visa_timeline_weeks(nationality: str, work_location: str) -> int:
    # Simplified: some nationalities take longer in demo to create conflicts
    nat = (nationality or "").upper()
    loc = (work_location or "").upper()
    if loc in {"AE", "UAE"}:
        if nat in {"PK", "BD", "NP"}:
            return 8
        return 4
    return 2


def compliance_risk_flags(nationality: str, work_location: str, role: str, start_date: str | None) -> Tuple[list[str], str]:
    risks = []
    weeks = estimate_visa_timeline_weeks(nationality, work_location)
    if weeks >= 8:
        risks.append("Visa processing likely >= 8 weeks; start date may be at risk.")
    if role and ("intern" in role.lower()) and (work_location or "").upper() in {"AE", "UAE"}:
        risks.append("Intern visas may have additional constraints; verify eligibility.")
    summary = f"Estimated visa timeline: {weeks} weeks."
    return risks, summary
