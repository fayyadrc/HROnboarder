from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.llm.client import RUNPOD_MODEL, llm_chat, parse_json_lenient
from app.llm.email_prompts import it_low_stock_prompt, welcome_email_prompt
from app.store.case_store import case_store

APP_DIR = Path(__file__).resolve().parents[1]
EMAIL_LOG_DIR = APP_DIR / "logs" / "emails"
OUTBOX_PATH = EMAIL_LOG_DIR / "outbox.jsonl"

try:
    from filelock import FileLock  # type: ignore
except Exception:  # pragma: no cover
    FileLock = None  # type: ignore[assignment]


def _ts_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _ensure_outbox() -> None:
    EMAIL_LOG_DIR.mkdir(parents=True, exist_ok=True)
    OUTBOX_PATH.touch(exist_ok=True)


def _safe_append_record(record: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    try:
        _ensure_outbox()
        line = json.dumps(record, ensure_ascii=False) + "\n"

        if FileLock is not None:
            lock = FileLock(str(OUTBOX_PATH) + ".lock", timeout=3)
            with lock:
                with OUTBOX_PATH.open("a", encoding="utf-8") as f:
                    f.write(line)
            return True, None

        with OUTBOX_PATH.open("a", encoding="utf-8") as f:
            flock_fn = None
            lock_ex = 2
            lock_un = 8
            try:
                import fcntl  # type: ignore

                flock_fn = fcntl.flock
                lock_ex = getattr(fcntl, "LOCK_EX", 2)
                lock_un = getattr(fcntl, "LOCK_UN", 8)
            except Exception:
                flock_fn = None

            if flock_fn is not None:
                try:
                    flock_fn(f.fileno(), lock_ex)
                except Exception:
                    pass

            f.write(line)

            if flock_fn is not None:
                try:
                    flock_fn(f.fileno(), lock_un)
                except Exception:
                    pass
        return True, None
    except Exception as e:
        return False, str(e)


def log_outbox(email: Dict[str, Any]) -> None:
    """Best-effort JSONL outbox append. Never raises."""
    _safe_append_record(email)


def _try_llm_email(prompt: str, *, model: Optional[str] = None, timeout: int = 60) -> Tuple[bool, str, str, Dict[str, Any]]:
    messages = [
        {"role": "system", "content": "Return ONLY strict JSON: {\"subject\":\"...\",\"body\":\"...\"}."},
        {"role": "user", "content": prompt},
    ]
    ok, text, err, meta = llm_chat(messages, model=(model or RUNPOD_MODEL), timeout=timeout, temperature=0.2)
    if not ok:
        return False, "", err or "LLM call failed", {"llm_meta": meta}

    parsed, cleaned, parse_err = parse_json_lenient(text, log_name="email")
    if parse_err or not isinstance(parsed, dict):
        return False, "", parse_err or "Invalid email JSON", {"llm_meta": meta, "cleaned": cleaned}

    subject = parsed.get("subject")
    body = parsed.get("body")
    if not isinstance(subject, str) or not isinstance(body, str) or not subject.strip() or not body.strip():
        return False, "", "JSON missing subject/body", {"llm_meta": meta, "parsed": parsed}

    return True, subject.strip(), body.strip(), {"llm_meta": meta}


def _welcome_fallback(case: Dict[str, Any]) -> Tuple[str, str]:
    seed = case.get("seed") or {}
    name = (case.get("candidateName") or seed.get("candidateName") or "Candidate").strip()
    start = (seed.get("startDate") or "TBD").strip() or "TBD"
    role = (seed.get("role") or "your role").strip() or "your role"

    subject = f"Welcome to the team, {name}"
    body = (
        f"Dear {name},\n\n"
        f"Welcome to the team. Your onboarding is now complete and we are preparing your Day 1 setup for {role}.\n\n"
        f"Start date: {start}\n"
        f"Laptop and seating details will be confirmed shortly.\n\n"
        f"Next steps:\n"
        f"- Please review your onboarding portal for any pending items.\n"
        f"- Reply to this email for any questions.\n\n"
        f"Regards,\nHR Team\n"
    )
    return subject, body


def _it_low_stock_fallback(case: Dict[str, Any], requested_model: str, missing_or_low: List[str]) -> Tuple[str, str]:
    seed = case.get("seed") or {}
    case_id = case.get("caseId") or "UNKNOWN"
    name = (case.get("candidateName") or seed.get("candidateName") or "Candidate").strip()
    start = (seed.get("startDate") or "TBD").strip() or "TBD"
    items = ", ".join([x.strip() for x in missing_or_low if x and x.strip()]) or requested_model

    subject = f"IT support needed: low stock for {requested_model} (Case {case_id})"
    body = (
        f"Hello IT Service Desk,\n\n"
        f"We have onboarding case {case_id} for {name} with start date {start}.\n"
        f"Requested model/items are low or unavailable: {items}.\n\n"
        f"Please confirm availability, ETA, and alternatives if needed.\n\n"
        f"Regards,\nHR Team\n"
    )
    return subject, body


def build_welcome_email(
    case: Dict[str, Any],
    to_email: str,
    use_llm: bool,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    llm_ok = False
    llm_meta: Dict[str, Any] = {}

    if use_llm:
        ok, subject, body, llm_meta = _try_llm_email(welcome_email_prompt(case), model=model, timeout=60)
        llm_ok = ok
        if not ok:
            subject, body = _welcome_fallback(case)
    else:
        subject, body = _welcome_fallback(case)

    return {
        "ts": _ts_z(),
        "to": to_email,
        "subject": subject,
        "body": body,
        "meta": {
            "type": "WELCOME",
            "case_id": case.get("caseId"),
            "llm": llm_ok,
            "llm_meta": llm_meta,
            "model": model or RUNPOD_MODEL,
        },
    }


def build_it_low_stock_email(
    case: Dict[str, Any],
    it_email: str,
    requested_model: str,
    missing_or_low: List[str],
    use_llm: bool,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    llm_ok = False
    llm_meta: Dict[str, Any] = {}

    if use_llm:
        ok, subject, body, llm_meta = _try_llm_email(
            it_low_stock_prompt(case, requested_model, missing_or_low),
            model=model,
            timeout=60,
        )
        llm_ok = ok
        if not ok:
            subject, body = _it_low_stock_fallback(case, requested_model, missing_or_low)
    else:
        subject, body = _it_low_stock_fallback(case, requested_model, missing_or_low)

    return {
        "ts": _ts_z(),
        "to": it_email,
        "subject": subject,
        "body": body,
        "meta": {
            "type": "IT_LOW_STOCK",
            "case_id": case.get("caseId"),
            "llm": llm_ok,
            "llm_meta": llm_meta,
            "model": model or RUNPOD_MODEL,
            "requested_model": requested_model,
            "missing_or_low": missing_or_low,
        },
    }


def mark_flag(case_id: str, flag_key: str) -> None:
    c = case_store.get_case(case_id)
    if not c:
        return
    steps = c.get("steps")
    if not isinstance(steps, dict):
        steps = {}
        c["steps"] = steps
    steps[flag_key] = True
    case_store.persist_case(case_id)


def flag_sent(case_id: str, flag_key: str) -> bool:
    c = case_store.get_case(case_id)
    if not c:
        return False
    steps = c.get("steps") or {}
    if not isinstance(steps, dict):
        return False
    value = steps.get(flag_key)
    if value is True:
        return True
    return bool(isinstance(value, dict) and value.get("sent") is True)


def send_email(case_id: str, email: Dict[str, Any]) -> Dict[str, Any]:
    ok, err = _safe_append_record(email)
    if ok:
        case_store.emit(case_id, "email.sent", email)
        return {"ok": True, "email": email}

    case_store.emit(case_id, "email.error", {"type": (email.get("meta") or {}).get("type"), "error": err or "outbox write failed"})
    return {"ok": False, "error": err or "outbox write failed", "email": email}


def _extract_email_from_step(step: Dict[str, Any]) -> Optional[str]:
    for key in ("email", "workEmail", "personalEmail", "candidateEmail", "primaryEmail"):
        value = step.get(key)
        if isinstance(value, str) and "@" in value:
            return value.strip()
    return None


def _get_candidate_email(case: Dict[str, Any]) -> Optional[str]:
    steps = case.get("steps") or {}
    if isinstance(steps, dict):
        for key in ("identity", "profile", "welcome", "review", "identity_contact"):
            step = steps.get(key) or {}
            if isinstance(step, dict):
                found = _extract_email_from_step(step)
                if found:
                    return found

        for step in steps.values():
            if isinstance(step, dict):
                found = _extract_email_from_step(step)
                if found:
                    return found

    seed = case.get("seed") or {}
    if isinstance(seed, dict):
        for key in ("email", "candidateEmail", "workEmail", "personalEmail"):
            value = seed.get(key)
            if isinstance(value, str) and "@" in value:
                return value.strip()

    return None
