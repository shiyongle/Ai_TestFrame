from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AssetRef(BaseModel):
    asset_type: str = Field(..., max_length=50)
    asset_id: int


class BaselineCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    project_id: int
    version_id: Optional[int] = None
    description: Optional[str] = None
    asset_refs: Optional[List[AssetRef]] = None
    freeze: bool = True
    created_by: str = "QA"


class BaselineFreezeRequest(BaseModel):
    frozen_by: str = "QA"


class AssetApprovalRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")
    approver: str = "QA"
    comment: Optional[str] = None


class AiCaseConfirmRequest(BaseModel):
    approver: str = "QA"
    comment: Optional[str] = None


class AuditEventCreateRequest(BaseModel):
    asset_type: str = Field(..., max_length=50)
    asset_id: int
    project_id: int
    action: str = Field(..., max_length=50)
    actor: str = "system"
    detail: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    after_hash: Optional[str] = None
