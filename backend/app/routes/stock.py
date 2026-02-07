from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter
from pydantic import BaseModel

from app.tools.stock_tools import check_stock

router = APIRouter(prefix="/api/it", tags=["IT Stock"])

class StockCheckRequest(BaseModel):
    requested_model: str

@router.post("/stock_check")
def stock_check(req: StockCheckRequest) -> Dict[str, Any]:
    return check_stock(req.requested_model)
