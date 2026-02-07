from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.llm.client import (
    RUNPOD_BASE_URL,
    RUNPOD_MODEL,
    get_tags,
    llm_chat,
    llm_generate,
    model_available,
    parse_json_lenient,
)

router = APIRouter(prefix="/api/llm", tags=["LLM"])


class LLMJsonRequest(BaseModel):
    prompt: str = Field(..., description="Prompt text (ideally instruct model to output ONLY JSON).")
    mode: str = Field("chat", description="chat | generate")
    model: Optional[str] = Field(None, description="Override model (e.g., qwen2.5:latest).")
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    timeout: int = Field(45, ge=5, le=300)


@router.get("/ping")
def llm_ping() -> Dict[str, Any]:
    tags = get_tags(timeout=8)
    tags_ok = isinstance(tags, dict) and "models" in tags and isinstance(tags.get("models"), list)
    model_ok = model_available(RUNPOD_MODEL)

    return {
        "ok": bool(tags_ok and model_ok),
        "base_url_set": bool(RUNPOD_BASE_URL),
        "base_url": RUNPOD_BASE_URL,
        "default_model": RUNPOD_MODEL,
        "tags_ok": tags_ok,
        "model_ok": model_ok,
        "tags_error": tags.get("error") if isinstance(tags, dict) else "unknown",
    }


@router.post("/json")
def llm_json(req: LLMJsonRequest) -> Dict[str, Any]:
    model = (req.model or RUNPOD_MODEL).strip()
    mode = (req.mode or "chat").strip().lower()

    if mode == "generate":
        ok, text, err, meta = llm_generate(
            req.prompt,
            model=model,
            timeout=req.timeout,
            temperature=req.temperature,
        )
    else:
        messages = [
            {"role": "system", "content": "Output ONLY JSON. No markdown. No prose."},
            {"role": "user", "content": req.prompt},
        ]
        ok, text, err, meta = llm_chat(
            messages,
            model=model,
            timeout=req.timeout,
            temperature=req.temperature,
        )

    if not ok:
        return {
            "ok": False,
            "mode": mode,
            "model": model,
            "error": err or "LLM call failed",
            "meta": meta,
            "raw_text": text,
            "parsed": None,
        }

    parsed, cleaned_text, parse_err = parse_json_lenient(text, log_name="llm_json")
    if parse_err:
        return {
            "ok": False,
            "mode": mode,
            "model": model,
            "error": parse_err,
            "meta": meta,
            "raw_text": text,
            "cleaned_text": cleaned_text,
            "parsed": None,
        }

    return {
        "ok": True,
        "mode": mode,
        "model": model,
        "meta": meta,
        "raw_text": text,
        "cleaned_text": cleaned_text,
        "parsed": parsed,
    }
