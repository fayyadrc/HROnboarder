from __future__ import annotations

import json
import os
import re
import socket
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# -----------------------------------------------------------------------------
# Env / Config
# -----------------------------------------------------------------------------
def _env(name: str, default: str = "") -> str:
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip()


RUNPOD_BASE_URL = _env("RUNPOD_BASE_URL", "").rstrip("/")
RUNPOD_GENERATE_PATH = _env("RUNPOD_GENERATE_PATH", "/api/generate")
RUNPOD_CHAT_PATH = _env("RUNPOD_CHAT_PATH", "/api/chat")
RUNPOD_TAGS_PATH = _env("RUNPOD_TAGS_PATH", "/api/tags")

RUNPOD_MODEL = _env("RUNPOD_MODEL", "qwen2.5:latest")

DEFAULT_TIMEOUT = int(_env("RUNPOD_TIMEOUT", "45"))
RETRY_TOTAL = int(_env("RUNPOD_RETRY_TOTAL", "2"))
RETRY_BACKOFF = float(_env("RUNPOD_RETRY_BACKOFF", "1"))

# No API key required for your setup; token is embedded in URL. Keep support anyway.
RUNPOD_API_KEY = _env("RUNPOD_API_KEY", "")

APP_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LOG_DIR = APP_DIR / "logs" / "llm"
_log_dir_env = _env("LLM_LOG_DIR", "")
if _log_dir_env:
    _log_path = Path(_log_dir_env).expanduser()
    LOG_DIR = (_log_path if _log_path.is_absolute() else (APP_DIR / _log_path)).resolve()
else:
    LOG_DIR = DEFAULT_LOG_DIR

_TAGS_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_TAGS_TTL_SECONDS = 30.0


# -----------------------------------------------------------------------------
# HTTP helpers
# -----------------------------------------------------------------------------
def _normalize_base_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    return u.rstrip("/")


def _full_url(path: str) -> str:
    base = _normalize_base_url(RUNPOD_BASE_URL)
    if not base:
        return ""
    p = path if path.startswith("/") else "/" + path
    return f"{base}{p}"


def _host_from_base(url: str) -> str:
    base = _normalize_base_url(url)
    if not base:
        return ""
    return base.split("://", 1)[-1].split("/", 1)[0]


def _dns_ok(host: str, tries: int = 2, delay: float = 0.25) -> bool:
    if not host:
        return False
    for _ in range(tries):
        try:
            socket.getaddrinfo(host, 443)
            return True
        except socket.gaierror:
            time.sleep(delay)
    return False


def _build_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=RETRY_TOTAL,
        connect=RETRY_TOTAL,
        read=RETRY_TOTAL,
        backoff_factor=RETRY_BACKOFF,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["POST", "GET"]),
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.mount("http://", HTTPAdapter(max_retries=retries))

    headers = {"Content-Type": "application/json"}
    if RUNPOD_API_KEY:
        headers["Authorization"] = f"Bearer {RUNPOD_API_KEY}"
    s.headers.update(headers)
    return s


_SESSION = _build_session()


# -----------------------------------------------------------------------------
# Output cleanup / JSON parsing
# -----------------------------------------------------------------------------
_FENCE_RE = re.compile(r"^```[a-zA-Z0-9_-]*\s*|\s*```$", re.MULTILINE)
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _clean_llm_text(raw: str) -> str:
    if not raw:
        return ""
    s = raw.strip().replace("\r", "")
    s = re.sub(_THINK_RE, "", s).strip()
    s = re.sub(_FENCE_RE, "", s).strip()
    s = s.replace("```", "").strip()
    s = s.replace("\u200b", "").strip()
    return s


def _extract_first_json_object(s: str) -> str:
    if not s:
        return ""
    s = s.strip()

    i_obj = s.find("{")
    i_arr = s.find("[")
    if i_obj == -1 and i_arr == -1:
        return ""

    if i_obj != -1 and (i_arr == -1 or i_obj < i_arr):
        start = i_obj
        end = s.rfind("}")
        if end == -1 or end <= start:
            return ""
        return s[start : end + 1].strip()

    start = i_arr
    end = s.rfind("]")
    if end == -1 or end <= start:
        return ""
    return s[start : end + 1].strip()


def _fix_common_json_issues(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r",(\s*[\]}])", r"\1", s)  # trailing commas
    return s.strip()


def parse_json_lenient(raw: str, *, log_name: str) -> Tuple[Optional[Union[dict, list]], str, Optional[str]]:
    cleaned = _clean_llm_text(raw)
    candidate = _extract_first_json_object(cleaned)
    candidate = _fix_common_json_issues(candidate)

    if not candidate:
        return None, cleaned, "No JSON object/array found in LLM output."

    try:
        parsed = json.loads(candidate)
        return parsed, cleaned, None
    except Exception as e:
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            ts = int(time.time() * 1000)
            (LOG_DIR / f"bad_{log_name}_{ts}_raw.txt").write_text(raw or "<empty>", encoding="utf-8")
            (LOG_DIR / f"bad_{log_name}_{ts}_cleaned.txt").write_text(cleaned or "<empty>", encoding="utf-8")
            (LOG_DIR / f"bad_{log_name}_{ts}_candidate.json").write_text(candidate or "<empty>", encoding="utf-8")
        except Exception:
            pass
        return None, cleaned, f"JSON parse failed: {e}"


# -----------------------------------------------------------------------------
# Tags + model checks
# -----------------------------------------------------------------------------
def get_tags(timeout: int = 8) -> Dict[str, Any]:
    now = time.time()
    if _TAGS_CACHE["data"] is not None and (now - float(_TAGS_CACHE["ts"])) < _TAGS_TTL_SECONDS:
        return _TAGS_CACHE["data"]  # type: ignore[return-value]

    if not RUNPOD_BASE_URL:
        data = {"error": "RUNPOD_BASE_URL not set"}
        _TAGS_CACHE.update({"ts": now, "data": data})
        return data

    host = _host_from_base(RUNPOD_BASE_URL)
    if not _dns_ok(host):
        data = {"error": f"DNS lookup failed for host: {host}"}
        _TAGS_CACHE.update({"ts": now, "data": data})
        return data

    url = _full_url(RUNPOD_TAGS_PATH)
    try:
        r = _SESSION.get(url, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        _TAGS_CACHE.update({"ts": now, "data": data})
        return data
    except Exception as e:
        data = {"error": f"tags request failed: {e}"}
        _TAGS_CACHE.update({"ts": now, "data": data})
        return data


def model_available(model: str) -> bool:
    tags = get_tags(timeout=8)
    models = tags.get("models") if isinstance(tags, dict) else None
    if not isinstance(models, list):
        return False
    for m in models:
        if not isinstance(m, dict):
            continue
        name = (m.get("name") or "").strip()
        mm = (m.get("model") or "").strip()
        if model == name or model == mm:
            return True
    return False


# -----------------------------------------------------------------------------
# LLM calls
# -----------------------------------------------------------------------------
def llm_generate(
    prompt: str,
    *,
    model: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT,
    temperature: float = 0.0,
) -> Tuple[bool, str, Optional[str], Dict[str, Any]]:
    model = (model or RUNPOD_MODEL).strip()

    if not RUNPOD_BASE_URL:
        return False, "", "RUNPOD_BASE_URL not set", {}

    host = _host_from_base(RUNPOD_BASE_URL)
    if not _dns_ok(host):
        return False, "", f"DNS lookup failed for host: {host}", {}

    if not model_available(model):
        return False, "", f"Model not available: {model}", {}

    url = _full_url(RUNPOD_GENERATE_PATH)
    payload = {"model": model, "prompt": prompt, "stream": False, "temperature": temperature}

    t0 = time.time()
    resp: Optional[requests.Response] = None
    try:
        resp = _SESSION.post(url, data=json.dumps(payload), timeout=timeout)
        t1 = time.time()
        resp.raise_for_status()
        data = resp.json() if resp.content else {}
        text = (data.get("response") or "").strip()
        meta = {
            "model": data.get("model") or model,
            "total_duration": data.get("total_duration"),
            "load_duration": data.get("load_duration"),
            "eval_count": data.get("eval_count"),
            "latency_ms": int((t1 - t0) * 1000),
        }
        if not text:
            return False, "", "Empty response from /api/generate", meta
        return True, text, None, meta
    except Exception as e:
        t1 = time.time()
        meta = {"latency_ms": int((t1 - t0) * 1000)}
        try:
            meta["http_body"] = (resp.text[:2000] if resp is not None else "")
        except Exception:
            pass
        return False, "", f"generate request failed: {e}", meta


def llm_chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT,
    temperature: float = 0.0,
) -> Tuple[bool, str, Optional[str], Dict[str, Any]]:
    model = (model or RUNPOD_MODEL).strip()

    if not RUNPOD_BASE_URL:
        return False, "", "RUNPOD_BASE_URL not set", {}

    host = _host_from_base(RUNPOD_BASE_URL)
    if not _dns_ok(host):
        return False, "", f"DNS lookup failed for host: {host}", {}

    if not model_available(model):
        return False, "", f"Model not available: {model}", {}

    url = _full_url(RUNPOD_CHAT_PATH)
    payload = {"model": model, "messages": messages, "stream": False, "temperature": temperature}

    t0 = time.time()
    resp: Optional[requests.Response] = None
    try:
        resp = _SESSION.post(url, data=json.dumps(payload), timeout=timeout)
        t1 = time.time()
        resp.raise_for_status()
        data = resp.json() if resp.content else {}

        msg = data.get("message") or {}
        text = (msg.get("content") or "").strip()
        if not text:
            text = (data.get("response") or "").strip()

        meta = {
            "model": data.get("model") or model,
            "total_duration": data.get("total_duration"),
            "load_duration": data.get("load_duration"),
            "eval_count": data.get("eval_count"),
            "latency_ms": int((t1 - t0) * 1000),
        }

        if not text:
            return False, "", "Empty response from /api/chat", meta

        return True, text, None, meta
    except Exception as e:
        t1 = time.time()
        meta = {"latency_ms": int((t1 - t0) * 1000)}
        try:
            meta["http_body"] = (resp.text[:2000] if resp is not None else "")
        except Exception:
            pass
        return False, "", f"chat request failed: {e}", meta
