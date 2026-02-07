from __future__ import annotations
from typing import Dict, List

# Demo-only stock table (replace with DB/ITSM later)
DEMO_STOCK = {
    "qwen2.5 laptop bundle": {"available": 2, "threshold": 3},
    "standard laptop": {"available": 10, "threshold": 3},
    "usb-c dock": {"available": 0, "threshold": 2},
    "monitor-27": {"available": 1, "threshold": 2},
}

def check_stock(requested_model: str) -> Dict[str, object]:
    """
    Deterministic stock check.
    Returns:
      { ok, model, stockStatus, missingItems }
    """
    model_key = (requested_model or "").strip().lower()
    missing: List[str] = []

    # match model
    model_rec = None
    for k, v in DEMO_STOCK.items():
        if model_key and model_key in k.lower():
            model_rec = (k, v)
            break

    if not model_rec:
        # Unknown model -> treat as low (forces IT email)
        return {
            "ok": True,
            "model": requested_model,
            "stockStatus": "UNKNOWN",
            "missingItems": [requested_model],
        }

    k, v = model_rec
    available = int(v.get("available", 0))
    threshold = int(v.get("threshold", 0))

    status = "OK"
    if available <= 0:
        status = "OUT_OF_STOCK"
        missing.append(k)
    elif available < threshold:
        status = "LOW_STOCK"
        missing.append(k)

    # add related items checks (optional)
    # Example: dock + monitor bundled expectations
    for related in ("usb-c dock", "monitor-27"):
        rv = DEMO_STOCK.get(related)
        if rv and int(rv.get("available", 0)) <= 0:
            missing.append(related)

    return {
        "ok": True,
        "model": k,
        "stockStatus": status,
        "missingItems": missing,
    }
