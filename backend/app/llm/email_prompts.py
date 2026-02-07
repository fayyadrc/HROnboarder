from __future__ import annotations

from typing import Any, Dict, List


def _s(v: Any) -> str:
    return str(v or "").strip()


def _case_facts(case_json: Dict[str, Any]) -> Dict[str, str]:
    seed = case_json.get("seed") or {}
    outputs = case_json.get("agentOutputs") or {}

    workplace_data = (outputs.get("workplace") or {}).get("data") or {}
    seating = workplace_data.get("seating") or {}
    equipment = workplace_data.get("equipment") or {}

    return {
        "case_id": _s(case_json.get("caseId")),
        "candidate": _s(case_json.get("candidateName") or seed.get("candidateName") or "Candidate"),
        "role": _s(seed.get("role")),
        "location": _s(seed.get("workLocation")),
        "start_date": _s(seed.get("startDate")),
        "seat": _s(seating.get("seatId") or seating.get("location") or seating.get("seat")),
        "laptop": _s(equipment.get("bundleName") or equipment.get("deviceModel") or equipment.get("model")),
    }


def welcome_email_prompt(case_json: Dict[str, Any]) -> str:
    f = _case_facts(case_json)
    seat = f["seat"] or "TBD (pending workplace assignment)"
    laptop = f["laptop"] or "TBD (pending IT confirmation)"

    return (
        "You are drafting a professional HR welcome email.\\n"
        "Return STRICT JSON only and nothing else.\\n"
        'Output schema: {"subject":"...","body":"..."}.\\n'
        "No markdown, no code fences, no explanations.\\n\\n"
        f"Facts:\\n"
        f"- Case ID: {f['case_id']}\\n"
        f"- Candidate name: {f['candidate']}\\n"
        f"- Role: {f['role']}\\n"
        f"- Work location: {f['location']}\\n"
        f"- Start date: {f['start_date']}\\n"
        f"- Laptop: {laptop}\\n"
        f"- Seating: {seat}\\n\\n"
        "Requirements:\\n"
        "- Friendly and professional HR tone\\n"
        "- Mention start date expectations\\n"
        "- Mention laptop + seating (or TBD) clearly\\n"
        "- End with next steps and support contact line signed by HR Team"
    )


def it_low_stock_prompt(case_json: Dict[str, Any], requested_model: str, missing_or_low: List[str]) -> str:
    f = _case_facts(case_json)
    items = ", ".join([x.strip() for x in missing_or_low if x and x.strip()]) or requested_model

    return (
        "You are drafting an HR to IT operations email.\\n"
        "Return STRICT JSON only and nothing else.\\n"
        'Output schema: {"subject":"...","body":"..."}.\\n'
        "No markdown, no code fences, no explanations.\\n\\n"
        f"Facts:\\n"
        f"- Case ID: {f['case_id']}\\n"
        f"- Candidate: {f['candidate']}\\n"
        f"- Role: {f['role']}\\n"
        f"- Location: {f['location']}\\n"
        f"- Start date: {f['start_date']}\\n"
        f"- Requested model: {_s(requested_model)}\\n"
        f"- Missing/low items: {items}\\n\\n"
        "Requirements:\\n"
        "- 6 to 10 concise lines\\n"
        "- Ask for availability confirmation, ETA, and alternatives\\n"
        "- Mention urgency based on start date"
    )


# Backwards-compatible aliases for existing imports.
def build_welcome_email_prompt(case: Dict[str, Any]) -> str:
    return welcome_email_prompt(case)


def build_low_stock_it_email_prompt(
    case: Dict[str, Any],
    *,
    requested_model: str,
    missing_or_low: List[str],
    it_queue: str = "IT Service Desk",
) -> str:
    _ = it_queue
    return it_low_stock_prompt(case, requested_model, missing_or_low)
